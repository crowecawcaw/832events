/**
 * Deterministic Houston event-source discovery crawler.
 *
 * Replaces the LLM "discovery" phase with a normal crawler:
 *   1. Run a FIXED list of Brave web searches (discovery/queries.txt),
 *      paginated several pages deep.
 *   2. Dedup every result URL against what we ALREADY pull from
 *      (every URL in sources/**.yaml + docs/source-candidates.json) and
 *      against the persistent ledger.
 *   3. Optionally fingerprint brand-new domains (one cheap GET) to guess the
 *      platform.
 *   4. Record everything in a backoff-scheduled ledger
 *      (docs/discovery-ledger.json) and append per-run, per-query metrics to
 *      docs/discovery-metrics.jsonl.
 *
 * The LLM (separate workflow job) only runs when this crawler reports NEW
 * items — it reads the ledger, applies human-judgment quality gates, and
 * implements sources. This script never calls an LLM and never touches
 * source-candidates.json.
 *
 * Usage:
 *   tsx scripts/discovery-crawl.ts [--max-queries N] [--pages N] [--rotate]
 *                                  [--probe] [--probe-cap N] [--no-write]
 *                                  [--mock <file.json>]
 *
 * Env: BRAVE_API_KEY (required unless --mock).
 */
import { readFile, writeFile, readdir, appendFile } from "fs/promises";
import * as path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.join(__dirname, "..");
const SOURCES_DIR = path.join(REPO, "sources");
const QUERIES_FILE = path.join(REPO, "discovery", "queries.txt");
const CANDIDATES_FILE = path.join(REPO, "docs", "source-candidates.json");
const LEDGER_FILE = path.join(REPO, "docs", "discovery-ledger.json");
const METRICS_FILE = path.join(REPO, "docs", "discovery-metrics.jsonl");
const IGNORE_FILE = path.join(REPO, "discovery", "ignore-domains.txt");
const SHORTLIST_FILE = path.join(REPO, "docs", "discovery-shortlist.json");

// ---------------------------------------------------------------------------
// Domain helpers
// ---------------------------------------------------------------------------

/** Generic ticketing/platform hosts where many DISTINCT sources share a domain.
 * Never added to the known-domain blocklist (a hit here may be a NEW organizer
 * / venue we don't yet cover); deduped by full URL via the ledger instead. */
export const PLATFORM_DOMAINS = new Set([
    "eventbrite.com", "ticketmaster.com", "livenation.com", "dice.fm",
    "axs.com", "squarespace.com", "google.com", "withfriends.co", "ra.co",
    "seetickets.us", "etix.com", "prekindle.com", "wl.seetickets.us",
]);

/** CORE ignore set: structural hosts that can NEVER be a scrapable venue
 * calendar for us (social, search, reservation platforms). Hardcoded so the
 * crawler always filters them even with no data file. The editorial / news /
 * aggregator long tail lives in the data file discovery/ignore-domains.txt
 * (see loadIgnoreDomains), which the implement job and humans grow over time. */
export const IGNORE_DOMAINS = new Set([
    // Social / review / search
    "facebook.com", "instagram.com", "twitter.com", "x.com", "youtube.com",
    "tiktok.com", "yelp.com", "tripadvisor.com", "reddit.com", "wikipedia.org",
    "pinterest.com", "linkedin.com", "amazon.com", "spotify.com", "google.com",
    "maps.google.com", "yellowpages.com", "foursquare.com", "patch.com",
    // Reservation / ordering platforms (not event sources)
    "resy.com", "toasttab.com", "opentable.com",
]);

/** Effective ignore set = CORE ∪ discovery/ignore-domains.txt. The data file is
 * the tunable, human/LLM-maintained list of editorial/aggregator domains. */
export async function loadIgnoreDomains(file = IGNORE_FILE): Promise<Set<string>> {
    const set = new Set(IGNORE_DOMAINS);
    try {
        const text = await readFile(file, "utf8");
        for (const line of text.split("\n")) {
            const d = line.trim().toLowerCase();
            if (d && !d.startsWith("#")) set.add(d);
        }
    } catch {
        /* data file optional */
    }
    return set;
}

const MULTI_PART_TLDS = new Set(["co.uk", "org.uk", "com.au", "co.nz"]);

/** Registrable ("eTLD+1") domain, lowercased, no leading www. */
export function registrableDomain(rawUrl: string): string | null {
    let host: string;
    try {
        host = new URL(rawUrl).hostname.toLowerCase();
    } catch {
        return null;
    }
    host = host.replace(/^www\./, "");
    const labels = host.split(".");
    if (labels.length <= 2) return host;
    const lastTwo = labels.slice(-2).join(".");
    const lastThree = labels.slice(-3).join(".");
    if (MULTI_PART_TLDS.has(lastTwo)) return lastThree;
    return lastTwo;
}

/** Canonicalize a URL for stable ledger keys: lowercase host, drop fragment,
 * drop tracking params, strip trailing slash. */
export function canonicalUrl(rawUrl: string): string | null {
    let u: URL;
    try {
        u = new URL(rawUrl);
    } catch {
        return null;
    }
    u.hash = "";
    u.hostname = u.hostname.toLowerCase().replace(/^www\./, "");
    const drop = [...u.searchParams.keys()].filter(k =>
        /^utm_|^fbclid$|^gclid$|^mc_|^ref$|^source$/i.test(k));
    for (const k of drop) u.searchParams.delete(k);
    let s = u.toString();
    s = s.replace(/\/$/, "");
    return s;
}

// ---------------------------------------------------------------------------
// Known-URL index (what we already pull from)
// ---------------------------------------------------------------------------

const URL_RE = /https?:\/\/[^\s"'<>)]+/g;

/** Scan every source YAML + source-candidates.json and collect the set of
 * registrable domains we already know about (excluding generic platform
 * domains, which can legitimately host new sources). */
export async function loadKnownDomains(
    sourcesDir = SOURCES_DIR,
    candidatesFile = CANDIDATES_FILE,
): Promise<Set<string>> {
    const known = new Set<string>();
    const addUrl = (s: string) => {
        const d = registrableDomain(s);
        if (d && !PLATFORM_DOMAINS.has(d)) known.add(d);
    };

    // Walk sources/ recursively for *.yaml and harvest every URL-looking string.
    const stack = [sourcesDir];
    while (stack.length) {
        const dir = stack.pop()!;
        let entries;
        try {
            entries = await readdir(dir, { withFileTypes: true });
        } catch {
            continue;
        }
        for (const e of entries) {
            const full = path.join(dir, e.name);
            if (e.isDirectory()) {
                stack.push(full);
            } else if (e.name.endsWith(".yaml") || e.name.endsWith(".yml")) {
                const text = await readFile(full, "utf8");
                for (const m of text.matchAll(URL_RE)) addUrl(m[0]);
            }
        }
    }

    // Candidate URLs (all statuses — don't re-surface anything already triaged).
    try {
        const cands = JSON.parse(await readFile(candidatesFile, "utf8"));
        for (const c of cands) if (c.url) addUrl(c.url);
    } catch {
        /* candidates file optional */
    }

    return known;
}

// ---------------------------------------------------------------------------
// Ledger
// ---------------------------------------------------------------------------

export type LedgerStatus =
    | "new" | "probed" | "dead" | "ignored" | "promoted" | "rejected";

export interface LedgerEntry {
    url: string;
    domain: string;
    firstSeen: string;
    lastSeen: string;
    lastChecked: string | null;
    checkCount: number;
    status: LedgerStatus;
    httpStatus?: number | null;
    platformGuess?: string | null;
    icsUrl?: string | null;
    nextCheckAfter: string;
    queries: string[];
    title?: string;
}

export interface Ledger {
    updated: string;
    entries: Record<string, LedgerEntry>;
}

export async function loadLedger(file = LEDGER_FILE): Promise<Ledger> {
    try {
        const l = JSON.parse(await readFile(file, "utf8"));
        if (l && l.entries) return l;
    } catch {
        /* cold start */
    }
    return { updated: new Date().toISOString(), entries: {} };
}

/** Exponential backoff: a URL that keeps failing/being-uninteresting is
 * rechecked ever less often. Returns an ISO date string. */
export function nextCheck(status: LedgerStatus, checkCount: number, now = new Date()): string {
    let days: number;
    switch (status) {
        case "promoted": days = 3650; break;          // it's a source now
        case "rejected": days = 3650; break;          // evaluated, not viable
        case "ignored": days = 90; break;             // social/aggregator junk
        case "dead": days = Math.min(2 ** checkCount, 60); break; // 1,2,4..60d
        case "probed": days = 14; break;              // looked plausible, recheck fortnightly
        case "new": default: days = 1; break;         // probe again next run
    }
    const d = new Date(now);
    d.setUTCDate(d.getUTCDate() + days);
    return d.toISOString().slice(0, 10);
}

/** Reclassify any ledger entry whose domain is now in the ignore set to
 * "ignored" (and back off its recheck). Returns the count changed. */
export function reclassifyIgnored(entries: Record<string, LedgerEntry>, ignore: Set<string>, now = new Date()): number {
    let n = 0;
    for (const e of Object.values(entries)) {
        if (ignore.has(e.domain) && e.status !== "ignored") {
            e.status = "ignored";
            e.nextCheckAfter = nextCheck("ignored", e.checkCount, now);
            n++;
        }
    }
    return n;
}

// ---------------------------------------------------------------------------
// Brave search
// ---------------------------------------------------------------------------

export interface SearchResult { url: string; title?: string; }
export type FetchImpl = typeof fetch;

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

/** Run one query across `pages` pages (Brave: count<=20, offset 0..9).
 * Throttled to respect the free-tier 1 req/sec limit. Returns results plus
 * the per-page count so we can tune depth from metrics. */
export async function braveSearch(
    query: string,
    opts: { pages: number; key: string; fetchImpl?: FetchImpl; throttleMs?: number },
): Promise<{ results: SearchResult[]; perPage: number[] }> {
    const fetchImpl = opts.fetchImpl ?? fetch;
    const throttleMs = opts.throttleMs ?? 1100;
    const results: SearchResult[] = [];
    const perPage: number[] = [];
    for (let offset = 0; offset < Math.min(opts.pages, 10); offset++) {
        const url = new URL("https://api.search.brave.com/res/v1/web/search");
        url.searchParams.set("q", query);
        url.searchParams.set("count", "20");
        url.searchParams.set("offset", String(offset));
        url.searchParams.set("country", "us");
        const resp = await fetchImpl(url, {
            headers: { Accept: "application/json", "X-Subscription-Token": opts.key },
        });
        if (!resp.ok) {
            // 429 => out of budget/rate; stop paginating this query.
            perPage.push(0);
            if (resp.status === 429) break;
            continue;
        }
        const data: any = await resp.json();
        const page: SearchResult[] = (data?.web?.results ?? []).map((r: any) => ({
            url: r.url, title: r.title,
        }));
        perPage.push(page.length);
        results.push(...page);
        if (page.length === 0) break; // no more pages
        if (offset < opts.pages - 1) await sleep(throttleMs);
    }
    return { results, perPage };
}

// ---------------------------------------------------------------------------
// Fingerprint (best-effort, one GET per new domain)
// ---------------------------------------------------------------------------

export interface Fingerprint { httpStatus: number | null; platform: string | null; icsUrl: string | null; }

export function detectPlatform(html: string, finalUrl: string): { platform: string | null; icsUrl: string | null } {
    const h = html.toLowerCase();
    let icsUrl: string | null = null;
    const icsLink = html.match(/<link[^>]+type=["']text\/calendar["'][^>]*href=["']([^"']+)["']/i)
        || html.match(/href=["']([^"']*(?:\?ical=1|\.ics|\/ical\/|outlook=ical)[^"']*)["']/i)
        || html.match(/(webcal:\/\/[^\s"'<>]+)/i);
    if (icsLink) {
        try { icsUrl = new URL(icsLink[1].replace(/^webcal:/, "https:"), finalUrl).toString(); } catch { /* ignore */ }
    }
    let platform: string | null = null;
    if (h.includes("squarespace.com") || h.includes("static1.squarespace")) platform = "squarespace";
    else if (h.includes("eventbrite.com")) platform = "eventbrite";
    else if (h.includes("dice.fm") || h.includes("cdn.dice.fm")) platform = "dice";
    else if (h.includes("ticketmaster.com") || h.includes("livenation")) platform = "ticketmaster";
    else if (h.includes("axs.com") || h.includes(".eventitem")) platform = "axs";
    else if (h.includes("cdn.shopify.com") || h.includes("shopify")) platform = "shopify";
    else if (h.includes("tribe-events") || h.includes("the-events-calendar")) platform = "tribe-events-ics";
    else if (icsUrl) platform = "ics";
    return { platform, icsUrl };
}

export async function fingerprint(rawUrl: string, fetchImpl: FetchImpl = fetch): Promise<Fingerprint> {
    try {
        const ctrl = AbortSignal.timeout(12000);
        const resp = await fetchImpl(rawUrl, {
            redirect: "follow",
            headers: { "User-Agent": "Mozilla/5.0 (compatible; 832events-discovery/1.0)" },
            signal: ctrl,
        });
        if (!resp.ok) return { httpStatus: resp.status, platform: null, icsUrl: null };
        const html = (await resp.text()).slice(0, 200_000);
        const { platform, icsUrl } = detectPlatform(html, resp.url || rawUrl);
        return { httpStatus: resp.status, platform, icsUrl };
    } catch {
        return { httpStatus: null, platform: null, icsUrl: null };
    }
}

// ---------------------------------------------------------------------------
// Triage shortlist — deterministic ranking handed to the implement job so it
// never wades through the whole ledger and never auto-attempts expensive tiers.
// ---------------------------------------------------------------------------

/** Built-in platforms that need only a config ripper.yaml (no custom code). */
export const BUILTIN_PLATFORMS = new Set([
    "squarespace", "eventbrite", "ticketmaster", "dice", "axs", "shopify",
]);

/** Cheapness/confidence tier for a candidate (see docs/discovery-crawler.md):
 *   1 = real calendar feed found (cheapest, near-certain)
 *   2 = config-only built-in platform
 *   3 = reachable but unknown platform (needs investigation)
 *   4 = dead / unreachable / custom / proxy (expensive, low yield)
 *   0 = not a candidate (ignored / already a source). */
export function candidateTier(e: LedgerEntry): number {
    if (e.status === "ignored" || e.status === "promoted" || e.status === "rejected") return 0;
    if (e.icsUrl || e.platformGuess === "ics" || e.platformGuess === "tribe-events-ics") return 1;
    if (e.platformGuess && BUILTIN_PLATFORMS.has(e.platformGuess)) return 2;
    if (e.status === "probed" && (e.httpStatus ?? 0) >= 200 && (e.httpStatus ?? 999) < 400) return 3;
    return 4;
}

export interface ShortlistItem {
    url: string;
    domain: string;
    tier: number;
    platformGuess: string | null;
    icsUrl: string | null;
    queryHits: number;
    firstSeen: string;
}

/** Pre-ranked, capped shortlist of cheap/high-confidence candidates. Tier 1-2
 * only by default (tier 3-4 are deferred to humans). Ordered: tier asc, then
 * relevance (distinct queries that surfaced the domain) desc, then recency. */
export function buildShortlist(
    entries: Record<string, LedgerEntry>, cap = 20, maxTier = 2,
): ShortlistItem[] {
    const items = Object.values(entries)
        .map(e => ({ e, tier: candidateTier(e) }))
        .filter(x => x.tier >= 1 && x.tier <= maxTier)
        .map(({ e, tier }): ShortlistItem => ({
            url: e.url, domain: e.domain, tier,
            platformGuess: e.platformGuess ?? null, icsUrl: e.icsUrl ?? null,
            queryHits: e.queries.length, firstSeen: e.firstSeen,
        }));
    items.sort((a, b) =>
        a.tier - b.tier ||
        b.queryHits - a.queryHits ||
        (a.firstSeen < b.firstSeen ? 1 : a.firstSeen > b.firstSeen ? -1 : 0));
    return items.slice(0, cap);
}

// ---------------------------------------------------------------------------
// Classification + run
// ---------------------------------------------------------------------------

export interface QueryMetric {
    query: string;
    pages: number;
    results: number;
    perPage: number[];
    newItems: number;
    oldItems: number;
    ignored: number;
}

export interface RunMetrics {
    ts: string;
    queriesRun: number;
    pagesRequested: number;
    searchesUsed: number;
    totalResults: number;
    uniqueUrls: number;
    newItems: number;
    oldItems: number;
    ignored: number;
    ledgerSize: number;
    shortlistSize: number;
    newDomains: string[];
    perQuery: QueryMetric[];
}

export function loadQueries(text: string): string[] {
    return text.split("\n").map(l => l.trim()).filter(l => l && !l.startsWith("#"));
}

/** Deterministically rotate the query list by UTC day so the whole list is
 * covered over time while each run stays within budget. */
export function rotateQueries(all: string[], max: number, day = new Date()): string[] {
    if (max >= all.length || max <= 0) return all.slice(0, max <= 0 ? all.length : max);
    const doy = Math.floor((day.getTime() - Date.UTC(day.getUTCFullYear(), 0, 0)) / 86400000);
    const start = (doy * max) % all.length;
    const out: string[] = [];
    for (let i = 0; i < max; i++) out.push(all[(start + i) % all.length]);
    return out;
}

interface RunOpts {
    pages: number;
    maxQueries: number;
    rotate: boolean;
    probe: boolean;
    probeCap: number;
    write: boolean;
    key: string;
    fetchImpl?: FetchImpl;
    throttleMs?: number;
    now?: Date;
    shortlistCap?: number;
}

export async function run(opts: RunOpts): Promise<RunMetrics> {
    const now = opts.now ?? new Date();
    const allQueries = loadQueries(await readFile(QUERIES_FILE, "utf8"));
    const queries = opts.rotate
        ? rotateQueries(allQueries, opts.maxQueries, now)
        : allQueries.slice(0, opts.maxQueries > 0 ? opts.maxQueries : allQueries.length);

    const known = await loadKnownDomains();
    const ignore = await loadIgnoreDomains();
    const ledger = await loadLedger();

    // Clean up any existing entries whose domain is now in the ignore list
    // (e.g. editorial/aggregator domains added to discovery/ignore-domains.txt
    // after they were first logged), so the LLM gate never considers them.
    const reclassified = reclassifyIgnored(ledger.entries, ignore, now);
    if (reclassified) console.error(`reclassified ${reclassified} ledger entries to ignored`);

    const perQuery: QueryMetric[] = [];
    const newDomains = new Set<string>();
    let searchesUsed = 0, totalResults = 0, newItems = 0, oldItems = 0, ignored = 0;
    const seenThisRun = new Set<string>();
    const newlyAdded: LedgerEntry[] = [];

    for (const query of queries) {
        const { results, perPage } = await braveSearch(query, {
            pages: opts.pages, key: opts.key, fetchImpl: opts.fetchImpl, throttleMs: opts.throttleMs,
        });
        searchesUsed += perPage.length;
        totalResults += results.length;
        let qNew = 0, qOld = 0, qIgnored = 0;

        for (const r of results) {
            const canon = canonicalUrl(r.url);
            const domain = registrableDomain(r.url);
            if (!canon || !domain) continue;
            if (seenThisRun.has(canon)) continue;
            seenThisRun.add(canon);

            const inLedger = ledger.entries[canon];
            if (ignore.has(domain)) {
                qIgnored++; ignored++;
                if (!inLedger) ledger.entries[canon] = mkEntry(canon, domain, r.title, query, "ignored", now);
                continue;
            }
            if (inLedger) {
                qOld++; oldItems++;
                inLedger.lastSeen = now.toISOString();
                if (!inLedger.queries.includes(query)) inLedger.queries.push(query);
                continue;
            }
            if (known.has(domain)) {
                // We already pull from this domain — record so we never re-probe it.
                qOld++; oldItems++;
                ledger.entries[canon] = mkEntry(canon, domain, r.title, query, "promoted", now);
                continue;
            }
            // Genuinely new.
            qNew++; newItems++;
            newDomains.add(domain);
            const entry = mkEntry(canon, domain, r.title, query, "new", now);
            ledger.entries[canon] = entry;
            newlyAdded.push(entry);
        }

        perQuery.push({ query, pages: perPage.length, results: results.length, perPage, newItems: qNew, oldItems: qOld, ignored: qIgnored });
    }

    // Fingerprint new entries (capped, best-effort).
    if (opts.probe && newlyAdded.length) {
        let n = 0;
        for (const entry of newlyAdded) {
            if (n >= opts.probeCap) break;
            n++;
            const fp = await fingerprint(entry.url, opts.fetchImpl);
            entry.httpStatus = fp.httpStatus;
            entry.platformGuess = fp.platform;
            entry.icsUrl = fp.icsUrl;
            entry.lastChecked = now.toISOString();
            entry.status = fp.httpStatus === null || (fp.httpStatus >= 400) ? "dead"
                : fp.platform ? "probed" : "new";
            entry.checkCount = 1;
            entry.nextCheckAfter = nextCheck(entry.status, entry.checkCount, now);
        }
    }

    ledger.updated = now.toISOString();

    // Deterministic, capped, cheapest-first shortlist for the implement job.
    const shortlist = buildShortlist(ledger.entries, opts.shortlistCap ?? 20);

    const metrics: RunMetrics = {
        ts: now.toISOString(),
        queriesRun: queries.length,
        pagesRequested: opts.pages,
        searchesUsed,
        totalResults,
        uniqueUrls: seenThisRun.size,
        newItems, oldItems, ignored,
        ledgerSize: Object.keys(ledger.entries).length,
        shortlistSize: shortlist.length,
        newDomains: [...newDomains],
        perQuery,
    };

    if (opts.write) {
        await writeFile(LEDGER_FILE, JSON.stringify(ledger, null, 2) + "\n");
        await writeFile(SHORTLIST_FILE, JSON.stringify({ updated: now.toISOString(), items: shortlist }, null, 2) + "\n");
        await appendFile(METRICS_FILE, JSON.stringify(metrics) + "\n");
    }
    return metrics;
}

function mkEntry(url: string, domain: string, title: string | undefined, query: string, status: LedgerStatus, now: Date): LedgerEntry {
    const iso = now.toISOString();
    return {
        url, domain, title,
        firstSeen: iso, lastSeen: iso, lastChecked: null,
        checkCount: 0, status,
        httpStatus: null, platformGuess: null, icsUrl: null,
        nextCheckAfter: nextCheck(status, 0, now),
        queries: [query],
    };
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

function arg(name: string, def?: string): string | undefined {
    const i = process.argv.indexOf(name);
    return i !== -1 ? (process.argv[i + 1] ?? "true") : def;
}
function flag(name: string): boolean {
    return process.argv.includes(name);
}

async function main() {
    const mock = arg("--mock");
    const pages = parseInt(arg("--pages", "1")!, 10);
    const maxQueries = parseInt(arg("--max-queries", "0")!, 10);
    const probeCap = parseInt(arg("--probe-cap", "12")!, 10);
    const write = !flag("--no-write");

    let fetchImpl: FetchImpl | undefined;
    let key = process.env.BRAVE_API_KEY ?? "";
    if (mock) {
        const fixtures = JSON.parse(await readFile(mock, "utf8")) as Record<string, { web: { results: { url: string; title?: string }[] } }>;
        key = "mock";
        fetchImpl = (async (input: any) => {
            const u = new URL(typeof input === "string" ? input : input.toString());
            const q = u.searchParams.get("q") ?? "";
            const off = parseInt(u.searchParams.get("offset") ?? "0", 10);
            const data = off === 0 ? (fixtures[q] ?? { web: { results: [] } }) : { web: { results: [] } };
            return new Response(JSON.stringify(data), { status: 200, headers: { "content-type": "application/json" } });
        }) as FetchImpl;
    } else if (!key) {
        console.error("BRAVE_API_KEY is required (or pass --mock <file>)");
        process.exit(1);
    }

    const metrics = await run({
        pages, maxQueries, rotate: flag("--rotate"),
        probe: flag("--probe") && !mock, probeCap, write,
        key, fetchImpl,
    });

    console.error(`queries=${metrics.queriesRun} searches=${metrics.searchesUsed} ` +
        `results=${metrics.totalResults} new=${metrics.newItems} old=${metrics.oldItems} ` +
        `ignored=${metrics.ignored} ledger=${metrics.ledgerSize} shortlist=${metrics.shortlistSize}`);
    if (metrics.newDomains.length) console.error("new domains:\n  " + metrics.newDomains.join("\n  "));

    // GitHub Actions outputs: gate the LLM job on the shortlist (cheap, ready
    // candidates), not just raw new items (which may be all junk).
    if (process.env.GITHUB_OUTPUT) {
        await appendFile(process.env.GITHUB_OUTPUT,
            `new_items=${metrics.newItems}\nnew_domains=${metrics.newDomains.length}\n` +
            `shortlist_size=${metrics.shortlistSize}\n`);
    }
}

if (path.resolve(process.argv[1] ?? "") === path.resolve(fileURLToPath(import.meta.url))) {
    main().catch(e => { console.error(e); process.exit(1); });
}
