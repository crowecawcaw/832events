/**
 * Proxy-aware, cache-aware fetch utility.
 *
 *   - proxy: true  → route through Browserbase's Fetch API (executes JS,
 *                    follows redirects, bypasses bot detection)
 *   - proxy: false → direct fetch (default)
 *
 * Every fetch function returned here is wrapped in `withCache`, so when the
 * build has injected a fetch cache (initFetchCache) each request is served from
 * cache while fresh and only hits the network at most once per TTL window. When
 * no cache is injected (unit tests, single-ripper runs) `withCache` is a
 * transparent pass-through. See lib/fetch-cache.ts and
 * docs/fetch-cache.md.
 *
 * Usage in rippers:
 *   const fetchFn = getFetchForConfig(ripper.config);
 *   const res = await fetchFn(url, init);
 */

import {
    keyFor,
    getFetchCache,
    lookupFreshEntry,
    lookupAnyEntry,
    storeEntry,
    recordStaleServe,
} from "../fetch-cache.js";

export type FetchFn = (url: string | URL, init?: RequestInit) => Promise<Response>;

/** Plain network fetch. */
const directFetch: FetchFn = (url, init) => fetch(url, init);

/**
 * Wraps an underlying fetch function with the shared fetch cache:
 *   1. Fresh cache hit → serve cached body, no network call.
 *   2. Miss/stale → call `liveFetch`, cache the body on a 2xx response.
 *   3. `liveFetch` throws → fall back to the last good copy if one exists
 *      (recorded as a stale serve so the build report flags it); otherwise
 *      rethrow.
 *
 * Only the network call is skipped; callers always get a fresh Response they can
 * read. With no cache injected this is a near-transparent pass-through (the body
 * is still round-tripped so the returned Response is independently readable).
 */
export function withCache(liveFetch: FetchFn): FetchFn {
    return async (url: string | URL, init?: RequestInit) => {
        // No cache injected (unit tests, single-ripper runs) → transparent
        // pass-through. We must not touch the response
        // body here so callers/mocks that return a partial Response shape keep
        // working exactly as before.
        if (getFetchCache() === null) {
            return liveFetch(url, init);
        }

        const key = keyFor(url, init);
        const urlStr = String(url);
        const nowMs = Date.now();

        // 1. Fresh cache hit — no network call.
        const fresh = lookupFreshEntry(key, nowMs);
        if (fresh) {
            return new Response(fresh.content, {
                status: fresh.status,
                headers: { "Content-Type": fresh.contentType },
            });
        }

        // 2. Stale or missing — perform a real fetch.
        try {
            const res = await liveFetch(url, init);
            const content = await res.text();
            // Only cache successful responses so transient upstream error pages
            // don't poison the cache.
            if (res.status >= 200 && res.status < 300) {
                storeEntry(key, {
                    fetchedAt: new Date(nowMs).toISOString(),
                    status: res.status,
                    contentType: res.headers.get("content-type") ?? "",
                    content,
                });
            }
            // Reconstruct a fresh, independently-readable Response. Only the
            // Content-Type is preserved (mirrors the cache-hit path) to avoid
            // content-encoding/length headers that no longer match the decoded
            // body we re-wrap.
            return new Response(content, {
                status: res.status,
                headers: { "Content-Type": res.headers.get("content-type") ?? "" },
            });
        } catch (err) {
            // 3. Live fetch failed — fall back to the last good copy if we have
            //    one, recording a stale serve so the build report flags it.
            const stale = lookupAnyEntry(key);
            if (stale) {
                const ageHours = Math.round((nowMs - Date.parse(stale.fetchedAt)) / 3_600_000);
                const message = err instanceof Error ? err.message : String(err);
                recordStaleServe({ url: urlStr, cachedAt: stale.fetchedAt, ageHours, error: message });
                console.warn(`[fetch-cache] live fetch failed for ${urlStr}; serving stale cache from ${stale.fetchedAt} (~${ageHours}h old): ${message}`);
                return new Response(stale.content, {
                    status: stale.status,
                    headers: { "Content-Type": stale.contentType },
                });
            }
            throw err;
        }
    };
}

/**
 * Returns a fetch function appropriate for the ripper/calendar config, wrapped
 * in the shared fetch cache.
 */
export function getFetchForConfig(config: { proxy?: boolean }): FetchFn {
    if (config.proxy) {
        return withCache(browserbaseFetchFn);
    }
    return withCache(directFetch);
}

// Browserbase allows at most 5 concurrent /v1/fetch requests per account;
// exceeding it returns HTTP 429 ("max concurrent fetch requests limit"). The
// build rips all sources in parallel, so every Browserbase call is gated
// through this small semaphore — 4 slots, leaving one for any other consumer
// of the same key. Each completion wakes exactly one waiter, so `active`
// never exceeds the limit.
const BROWSERBASE_MAX_CONCURRENT = 4;
let browserbaseActive = 0;
const browserbaseWaiters: Array<() => void> = [];

async function withBrowserbaseSlot<T>(fn: () => Promise<T>): Promise<T> {
    if (browserbaseActive >= BROWSERBASE_MAX_CONCURRENT) {
        await new Promise<void>((resolve) => browserbaseWaiters.push(resolve));
    }
    browserbaseActive++;
    try {
        return await fn();
    } finally {
        browserbaseActive--;
        browserbaseWaiters.shift()?.();
    }
}

/** Performs a single live Browserbase API fetch. Throws if the key is unset
 *  or the API call fails. */
async function browserbaseLiveFetch(
    urlStr: string,
): Promise<{ statusCode: number; content: string; contentType: string }> {
    const apiKey = process.env.BROWSERBASE_API_KEY;
    if (!apiKey) {
        throw new Error("BROWSERBASE_API_KEY not set — required for browserbase proxy");
    }
    const response = await fetch("https://api.browserbase.com/v1/fetch", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "X-BB-API-Key": apiKey,
        },
        body: JSON.stringify({
            url: urlStr,
            allowRedirects: true,
        }),
    });
    if (!response.ok) {
        const body = await response.text().catch(() => "");
        throw new Error(`Browserbase fetch failed: HTTP ${response.status} — ${body.slice(0, 200)}`);
    }
    try {
        return await response.json() as { statusCode: number; content: string; contentType: string };
    } catch {
        throw new Error(`Browserbase API returned invalid JSON (HTTP ${response.status})`);
    }
}

/** Browserbase fetch as a plain FetchFn (no caching) — the live arm wrapped by
 *  `withCache`. Browserbase executes JavaScript and follows redirects, bypassing
 *  bot detection (e.g. SiteGround sgcaptcha, NinjaFirewall). Calls are gated by
 *  the concurrency semaphore above, and a 429/5xx from Browserbase itself
 *  (transient instability, or another key consumer racing the limit) gets one
 *  retry after a short pause. */
const browserbaseFetchFn: FetchFn = async (url: string | URL) => {
    const attempt = () => withBrowserbaseSlot(() => browserbaseLiveFetch(String(url)));
    let data;
    try {
        data = await attempt();
    } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        if (!/Browserbase fetch failed: HTTP (429|5\d\d)/.test(message)) {
            throw err;
        }
        await new Promise((resolve) => setTimeout(resolve, 3000));
        data = await attempt();
    }
    return new Response(data.content, {
        status: data.statusCode,
        headers: { "Content-Type": data.contentType },
    });
};

/**
 * Creates a fetch function that routes requests through Browserbase's Fetch API,
 * wrapped in the shared fetch cache. Retained for callers that want a browserbase
 * fetch without a full config object; `getFetchForConfig({ proxy: "browserbase" })`
 * is equivalent.
 */
export function createBrowserbaseFetch(): FetchFn {
    return withCache(browserbaseFetchFn);
}
