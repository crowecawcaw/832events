/**
 * Deterministic Houston event-source discovery crawler.
 *
 * Runs as the `crawl` pre-step of the source pipeline (before the Claude agent):
 *   1. Run a FIXED list of Brave web searches (discovery/queries.txt),
 *      paginated a few pages deep, rotated by day so the whole list is covered
 *      over time inside the free-tier budget.
 *   2. Dedup every result's registrable domain against what we ALREADY know:
 *        (a) a built-in skip list of aggregator/platform/news domains,
 *        (b) every domain referenced by sources/**.yaml (already integrated),
 *        (c) every domain in docs/source-candidates/*.yaml (already evaluated).
 *   3. Probe each surviving new domain (bounded, ≤3 requests): fetch the page,
 *      fingerprint the platform, and — the key upgrade — VERIFY any calendar
 *      feed by fetching the .ics and sniffing it for a real VCALENDAR with
 *      upcoming events. Also try a few well-known feed endpoints.
 *   4. Emit a ranked, capped shortlist to output/discovery-shortlist.json (an
 *      artifact — never committed) and print it. The agent then works the
 *      shortlist top-down.
 *
 * NO STATE ON MAIN. There is deliberately no ledger / metrics / cache file: a
 * daily blob push to main is rejected by the branch ruleset (GH013), and it
 * duplicated the pipeline's memory. The crawler's ONLY memory is git itself —
 * sources/** (integrated) and docs/source-candidates/*.yaml (evaluated). The
 * agent records every rejection as a `status: notviable` candidate in its PR,
 * which closes the dedup loop for the next crawl. See docs/discovery-crawler.md.
 *
 * Usage:
 *   tsx scripts/discovery-crawl.ts [--max-queries N] [--pages N] [--rotate]
 *                                  [--probe-cap N] [--out PATH]
 *
 * Env: BRAVE_API_KEY. If unset, writes an empty shortlist and exits 0.
 */
import { readFile, writeFile, readdir, mkdir } from "fs/promises";
import * as path from "path";
import { fileURLToPath } from "url";
import { loadSourceCandidates } from "../lib/source-candidates.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.join(__dirname, "..");
const SOURCES_DIR = path.join(REPO, "sources");
const QUERIES_FILE = path.join(REPO, "discovery", "queries.txt");
const CANDIDATES_DIR = path.join(REPO, "docs", "source-candidates");
const DEFAULT_OUT = path.join(REPO, "output", "discovery-shortlist.json");

// ---------------------------------------------------------------------------
// Skip list — domains that can NEVER be a scrapable venue calendar for us.
// Folds the old hardcoded CORE set, the generic ticketing/platform hosts, and
// the whole old discovery/ignore-domains.txt data file into one built-in
// constant. Aggregators/platforms are always skipped: a venue that merely
// *embeds* an Eventbrite/Squarespace widget is still detected during the probe
// (via its own domain), so we lose nothing by never surfacing the platform host
// itself. Grow this list in code, not in a committed data file.
// ---------------------------------------------------------------------------

export const SKIP_DOMAINS = new Set<string>([
    // --- Ticketing / platform hosts (many distinct orgs share one domain) ---
    "eventbrite.com", "eventbrite.co.uk", "eventbrite.ca", "eventbrite.com.au",
    "ticketmaster.com", "livenation.com", "dice.fm", "axs.com",
    "squarespace.com", "ra.co", "withfriends.co", "seetickets.us",
    "wl.seetickets.us", "etix.com", "prekindle.com", "meetup.com",
    // --- Social / review / search / commerce ---
    "facebook.com", "instagram.com", "twitter.com", "x.com", "youtube.com",
    "tiktok.com", "yelp.com", "tripadvisor.com", "reddit.com", "wikipedia.org",
    "pinterest.com", "linkedin.com", "amazon.com", "spotify.com", "google.com",
    "maps.google.com", "yellowpages.com", "foursquare.com", "patch.com",
    // --- Reservation / ordering platforms (not event sources) ---
    "resy.com", "toasttab.com", "opentable.com",
    // --- News / magazines / TV (write ABOUT events, not a venue feed) ---
    "houstonchronicle.com", "chron.com", "houstonpress.com", "houstoniamag.com",
    "papercitymag.com", "outsmartmagazine.com", "culturemap.com", "eater.com",
    "click2houston.com", "abc13.com", "khou.com", "timeout.com",
    // --- Tourism / "things to do" / listicle aggregators ---
    "visithoustontexas.com", "myguidehouston.com", "365thingsinhouston.com",
    "hellowoodlands.com", "houstonrestaurantweeks.com", "musicfestivalwizard.com",
    "downtownhouston.org",
    // --- Hobby directories / out-of-market round-ups ---
    "beeradvocate.com", "beerfests.com", "brewsology.com", "brewersassociation.org",
    "texasbrewloop.com", "beerchronicle.com", "houstonbeerguide.com",
    "craftbeeraustin.com", "metropolitanshuttle.com",
]);

/** Built-in platforms that need only a config ripper.yaml (no custom code) —
 * tier 2. `ics`/`tribe-events-ics` are intentionally NOT here: an ICS feed is
 * tier 1 only when VERIFIED, otherwise it demotes to tier 3. */
export const CONFIG_PLATFORMS = new Set<string>([
    "squarespace", "eventbrite", "ticketmaster", "dice", "axs", "shopify",
]);

/** Well-known feed endpoints tried (in order, first hit wins) when the page
 * HTML exposes no feed marker. Bounded by the per-domain request budget. */
export const WELL_KNOWN_ICS_PATHS = [
    "/events/?ical=1",
    "/?post_type=tribe_events&ical=1",
    "/events.ics",
];

// ---------------------------------------------------------------------------
// Domain / URL helpers
// ---------------------------------------------------------------------------

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

/** Canonicalize a URL for stable per-run dedup keys: lowercase host, drop
 * fragment + tracking params, strip trailing slash. */
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
    return u.toString().replace(/\/$/, "");
}

// ---------------------------------------------------------------------------
// Known-domain index (what we already pull from OR have already evaluated)
// ---------------------------------------------------------------------------

const URL_RE = /https?:\/\/[^\s"'<>)]+/g;

/** Scan every source YAML + docs/source-candidates/*.yaml and collect the set
 * of registrable domains we already know about — the crawler's stateless
 * "memory". A missing dir yields nothing (cold copy runs fine). */
export async function loadKnownDomains(
    sourcesDir = SOURCES_DIR,
    candidatesDir = CANDIDATES_DIR,
): Promise<Set<string>> {
    const known = new Set<string>();
    const addUrl = (s: string) => {
        const d = registrableDomain(s);
        if (d) known.add(d);
    };

    // Walk sources/ recursively for *.yaml and harvest every URL-looking string
    // (url:, friendlyLink:, icsUrl:, infoUrl:, and anything else). This is the
    // "already integrated" set.
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

    // Candidate URLs, all statuses — the "already evaluated" set. This is how a
    // notviable rejection the agent recorded last run keeps the domain out of
    // this run's shortlist.
    const { candidates } = await loadSourceCandidates(candidatesDir);
    for (const c of candidates) if (c.url) addUrl(c.url);

    return known;
}

// ---------------------------------------------------------------------------
// Brave search
// ---------------------------------------------------------------------------

export interface SearchResult { url: string; title?: string; }
export type FetchImpl = typeof fetch;

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

/** Run one query across `pages` pages (Brave: count<=20, offset 0..9).
 * Throttled to respect the free-tier ~1 req/sec limit. */
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
            perPage.push(0);
            if (resp.status === 429) break; // out of budget / rate-limited
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

// ---------------------------------------------------------------------------
// Platform fingerprint (pure — scans page HTML for feed + platform markers)
// ---------------------------------------------------------------------------

export function detectPlatform(html: string, finalUrl: string): { platform: string | null; icsUrl: string | null } {
    const h = html.toLowerCase();
    let icsUrl: string | null = null;
    const icsLink = html.match(/<link[^>]+type=["']text\/calendar["'][^>]*href=["']([^"']+)["']/i)
        || html.match(/href=["']([^"']*(?:\?ical=1|\.ics(?:\?|["'#])|\/ical\/|outlook=ical)[^"']*)["']/i)
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

// ---------------------------------------------------------------------------
// ICS verification (pure — sniff a fetched body for a real, upcoming calendar)
// ---------------------------------------------------------------------------

/** Cheap structural sniff of an .ics body: is it a VCALENDAR, how many VEVENTs,
 * and the raw DTSTART value strings. */
export function sniffVcalendar(body: string): { isCalendar: boolean; eventCount: number; dtstarts: string[] } {
    const isCalendar = /BEGIN:VCALENDAR/i.test(body);
    const eventCount = (body.match(/BEGIN:VEVENT/gi) ?? []).length;
    const dtstarts: string[] = [];
    // DTSTART, optionally with params (;TZID=…, ;VALUE=DATE), then the value.
    const re = /^DTSTART[^:\r\n]*:([^\r\n]+)/gim;
    let m: RegExpExecArray | null;
    while ((m = re.exec(body)) !== null) dtstarts.push(m[1].trim());
    return { isCalendar, eventCount, dtstarts };
}

/** Parse the leading YYYYMMDD of an iCal DTSTART value to a UTC date (day
 * granularity is enough for a future/past decision). */
export function parseDtstartDate(value: string): Date | null {
    const m = value.match(/(\d{4})(\d{2})(\d{2})/);
    if (!m) return null;
    const dt = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
    return Number.isNaN(dt.getTime()) ? null : dt;
}

/** How many DTSTART values fall on or after `now`'s UTC day. `now` is injected
 * so tests are deterministic. */
export function futureDtstartCount(dtstarts: string[], now: Date): number {
    const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
    let n = 0;
    for (const v of dtstarts) {
        const dt = parseDtstartDate(v);
        if (dt && dt.getTime() >= today) n++;
    }
    return n;
}

export interface IcsAnalysis { verified: boolean; eventCount: number; upcomingCount: number; }

/** Verdict on a fetched .ics body: non-VCALENDAR (e.g. an HTML error page or a
 * feed endpoint that now returns a listing page) → verified:false, which
 * DEMOTES the item out of tier 1. */
export function analyzeIcsBody(body: string, now: Date): IcsAnalysis {
    const { isCalendar, eventCount, dtstarts } = sniffVcalendar(body);
    if (!isCalendar) return { verified: false, eventCount: 0, upcomingCount: 0 };
    return { verified: true, eventCount, upcomingCount: futureDtstartCount(dtstarts, now) };
}

// ---------------------------------------------------------------------------
// Domain probe (bounded network: ≤ maxRequests GETs per domain)
// ---------------------------------------------------------------------------

export interface ProbeResult {
    url: string;
    domain: string;
    reachable: boolean;
    platformGuess: string | null;
    icsUrl: string | null;
    verified: boolean;
    eventCount: number;
    upcomingCount: number;
}

const UA = "Mozilla/5.0 (compatible; 832events-discovery/1.0)";
const ICS_BODY_CAP = 500_000;

export interface ProbeOpts {
    fetchImpl?: FetchImpl;
    now?: Date;
    maxRequests?: number;
    pageTimeoutMs?: number;
    icsTimeoutMs?: number;
    wellKnown?: string[];
}

/** Probe ONE domain within a small request budget: fetch the page, fingerprint
 * the platform, verify any feed found (fetch + VCALENDAR sniff), and — if the
 * HTML exposed no feed — try a couple of well-known feed endpoints. */
export async function probeDomain(rawUrl: string, opts: ProbeOpts = {}): Promise<ProbeResult> {
    const fetchImpl = opts.fetchImpl ?? fetch;
    const now = opts.now ?? new Date();
    const maxRequests = opts.maxRequests ?? 3;
    const wellKnown = opts.wellKnown ?? WELL_KNOWN_ICS_PATHS;
    const result: ProbeResult = {
        url: rawUrl, domain: registrableDomain(rawUrl) ?? "", reachable: false,
        platformGuess: null, icsUrl: null, verified: false, eventCount: 0, upcomingCount: 0,
    };

    let requests = 0;
    const get = async (u: string, timeoutMs: number) => {
        requests++;
        return fetchImpl(u, {
            redirect: "follow",
            headers: { "User-Agent": UA },
            signal: AbortSignal.timeout(timeoutMs),
        });
    };

    let pageResp: Response;
    try {
        pageResp = await get(rawUrl, opts.pageTimeoutMs ?? 12000);
    } catch {
        return result; // unreachable
    }
    if (!pageResp.ok) return result;
    result.reachable = true;
    const finalUrl = pageResp.url || rawUrl;
    const html = (await pageResp.text()).slice(0, 200_000);
    const fp = detectPlatform(html, finalUrl);
    result.platformGuess = fp.platform;

    // Verify a candidate .ics: on success, promote to tier-1 shape; on failure,
    // record it (so the shortlist shows what was tried) but leave verified:false.
    const verify = async (icsCandidate: string): Promise<boolean> => {
        if (requests >= maxRequests) return false;
        try {
            const resp = await get(icsCandidate, opts.icsTimeoutMs ?? 10000);
            if (!resp.ok) return false;
            const body = (await resp.text()).slice(0, ICS_BODY_CAP);
            const a = analyzeIcsBody(body, now);
            if (a.verified) {
                result.icsUrl = icsCandidate;
                result.verified = true;
                result.eventCount = a.eventCount;
                result.upcomingCount = a.upcomingCount;
                return true;
            }
        } catch { /* timeout / network — treat as unverified */ }
        return false;
    };

    if (fp.icsUrl) {
        const ok = await verify(fp.icsUrl);
        if (!ok) result.icsUrl = fp.icsUrl; // demoted: found but not a live VCALENDAR
    } else {
        let origin: string | null = null;
        try { origin = new URL(finalUrl).origin; } catch { /* ignore */ }
        if (origin) {
            for (const p of wellKnown) {
                if (requests >= maxRequests) break;
                if (await verify(origin + p)) break;
            }
        }
    }
    return result;
}

// ---------------------------------------------------------------------------
// Tiering + shortlist (pure)
// ---------------------------------------------------------------------------

export interface CandidateProbe extends ProbeResult {
    title?: string;
    queryHits: number;
}

export interface ShortlistItem {
    url: string;
    domain: string;
    tier: number;
    platformGuess: string | null;
    icsUrl: string | null;
    verified: boolean;
    eventCount: number;
    upcomingCount: number;
    queryHits: number;
    title?: string;
}

/** Confidence tier (see docs/discovery-crawler.md):
 *   1 = verified ICS feed with ≥1 upcoming event (cheapest, near-certain)
 *   2 = config-only built-in platform match (ripper.yaml, no code)
 *   3 = reachable but unidentified (needs human investigation)
 *   0 = dead / unreachable → dropped. */
export function computeTier(item: ProbeResult): number {
    if (item.verified && item.upcomingCount >= 1) return 1;
    if (item.platformGuess && CONFIG_PLATFORMS.has(item.platformGuess)) return 2;
    if (item.reachable) return 3;
    return 0;
}

/** Ranked, capped shortlist of tier 1-2 candidates handed to the agent. Ordered
 * tier asc, then upcomingCount desc, then queryHits desc; one entry per
 * registrable domain (best kept); capped. */
export function buildShortlist(items: CandidateProbe[], cap = 15): ShortlistItem[] {
    const tiered = items
        .map(i => ({ i, tier: computeTier(i) }))
        .filter(x => x.tier === 1 || x.tier === 2);
    tiered.sort((a, b) =>
        a.tier - b.tier ||
        b.i.upcomingCount - a.i.upcomingCount ||
        b.i.queryHits - a.i.queryHits);
    const seen = new Set<string>();
    const out: ShortlistItem[] = [];
    for (const { i, tier } of tiered) {
        if (seen.has(i.domain)) continue;
        seen.add(i.domain);
        out.push({
            url: i.url, domain: i.domain, tier,
            platformGuess: i.platformGuess, icsUrl: i.icsUrl, verified: i.verified,
            eventCount: i.eventCount, upcomingCount: i.upcomingCount,
            queryHits: i.queryHits, title: i.title,
        });
        if (out.length >= cap) break;
    }
    return out;
}

// ---------------------------------------------------------------------------
// Run
// ---------------------------------------------------------------------------

export interface RunStats {
    queriesRun: number;
    totalResults: number;
    newDomains: number;
    probed: number;
    tier1: number;
    tier2: number;
    shortlistSize: number;
    skippedNoKey: boolean;
}

export interface RunResult {
    items: ShortlistItem[];
    stats: RunStats;
}

export interface RunOpts {
    pages: number;
    maxQueries: number;
    rotate: boolean;
    probeCap: number;
    key: string;
    fetchImpl?: FetchImpl;
    probeFetchImpl?: FetchImpl;
    throttleMs?: number;
    now?: Date;
    shortlistCap?: number;
    concurrency?: number;
}

/** Bounded-concurrency map. */
async function mapLimit<T, R>(items: T[], limit: number, fn: (t: T) => Promise<R>): Promise<R[]> {
    const out: R[] = new Array(items.length);
    let idx = 0;
    const worker = async () => {
        while (idx < items.length) {
            const i = idx++;
            out[i] = await fn(items[i]);
        }
    };
    await Promise.all(Array.from({ length: Math.min(limit, items.length) || 0 }, worker));
    return out;
}

export async function run(opts: RunOpts): Promise<RunResult> {
    const emptyStats: RunStats = {
        queriesRun: 0, totalResults: 0, newDomains: 0, probed: 0,
        tier1: 0, tier2: 0, shortlistSize: 0, skippedNoKey: false,
    };
    if (!opts.key) {
        return { items: [], stats: { ...emptyStats, skippedNoKey: true } };
    }

    const now = opts.now ?? new Date();
    const allQueries = loadQueries(await readFile(QUERIES_FILE, "utf8"));
    const queries = opts.rotate
        ? rotateQueries(allQueries, opts.maxQueries, now)
        : allQueries.slice(0, opts.maxQueries > 0 ? opts.maxQueries : allQueries.length);

    const known = await loadKnownDomains();

    // Gather results, deduped per-run by registrable domain, counting how many
    // distinct queries surfaced each domain (a cheap relevance signal).
    const byDomain = new Map<string, { url: string; domain: string; title?: string; queries: Set<string> }>();
    let totalResults = 0;
    const seenUrls = new Set<string>();
    for (const query of queries) {
        const { results } = await braveSearch(query, {
            pages: opts.pages, key: opts.key, fetchImpl: opts.fetchImpl, throttleMs: opts.throttleMs,
        });
        totalResults += results.length;
        for (const r of results) {
            const canon = canonicalUrl(r.url);
            const domain = registrableDomain(r.url);
            if (!canon || !domain) continue;
            if (seenUrls.has(canon)) continue;
            seenUrls.add(canon);
            if (SKIP_DOMAINS.has(domain) || known.has(domain)) continue;
            const existing = byDomain.get(domain);
            if (existing) existing.queries.add(query);
            else byDomain.set(domain, { url: canon, domain, title: r.title, queries: new Set([query]) });
        }
    }

    // Probe the most-surfaced new domains first, up to the cap.
    const candidates = [...byDomain.values()]
        .map(c => ({ url: c.url, domain: c.domain, title: c.title, queryHits: c.queries.size }))
        .sort((a, b) => b.queryHits - a.queryHits);
    const toProbe = candidates.slice(0, opts.probeCap);

    const probeFetch = opts.probeFetchImpl ?? opts.fetchImpl;
    const probed: CandidateProbe[] = await mapLimit(toProbe, opts.concurrency ?? 6, async c => {
        const r = await probeDomain(c.url, { fetchImpl: probeFetch, now });
        return { ...r, url: c.url, domain: c.domain, title: c.title, queryHits: c.queryHits };
    });

    const items = buildShortlist(probed, opts.shortlistCap ?? 15);
    const tier1 = items.filter(i => i.tier === 1).length;

    return {
        items,
        stats: {
            queriesRun: queries.length,
            totalResults,
            newDomains: byDomain.size,
            probed: toProbe.length,
            tier1,
            tier2: items.length - tier1,
            shortlistSize: items.length,
            skippedNoKey: false,
        },
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

async function writeShortlist(outPath: string, items: ShortlistItem[], now: Date): Promise<void> {
    await mkdir(path.dirname(outPath), { recursive: true });
    await writeFile(outPath, JSON.stringify({ generated: now.toISOString(), count: items.length, items }, null, 2) + "\n");
}

async function emitShortlistSize(size: number): Promise<void> {
    if (process.env.GITHUB_OUTPUT) {
        await writeFile(process.env.GITHUB_OUTPUT, `shortlist_size=${size}\n`, { flag: "a" });
    }
}

async function main() {
    const pages = parseInt(arg("--pages", "3")!, 10);
    const maxQueries = parseInt(arg("--max-queries", "5")!, 10);
    const probeCap = parseInt(arg("--probe-cap", "25")!, 10);
    const outPath = path.resolve(arg("--out", DEFAULT_OUT)!);
    const now = new Date();
    const key = process.env.BRAVE_API_KEY ?? "";

    if (!key) {
        // Never fail the pipeline on a missing key — emit an empty shortlist so
        // the agent falls back to its own discovery, and exit 0.
        await writeShortlist(outPath, [], now);
        await emitShortlistSize(0);
        console.log("discovery-crawl: BRAVE_API_KEY unset — wrote empty shortlist, skipping crawl.");
        return;
    }

    const { items, stats } = await run({
        pages, maxQueries, rotate: flag("--rotate"), probeCap, key, now,
    });
    await writeShortlist(outPath, items, now);

    console.log(
        `discovery-crawl: queries=${stats.queriesRun} results=${stats.totalResults} ` +
        `newDomains=${stats.newDomains} probed=${stats.probed} ` +
        `shortlist=${stats.shortlistSize} (tier1=${stats.tier1} tier2=${stats.tier2}) → ${outPath}`,
    );
    for (const i of items) {
        console.log(
            `  [t${i.tier}] ${i.domain}${i.verified ? ` ✓ics(${i.upcomingCount} upcoming)` : ""}` +
            `${i.platformGuess ? ` platform=${i.platformGuess}` : ""} hits=${i.queryHits} — ${i.url}`,
        );
    }

    await emitShortlistSize(stats.shortlistSize);
}

if (path.resolve(process.argv[1] ?? "") === path.resolve(fileURLToPath(import.meta.url))) {
    main().catch(e => { console.error(e); process.exit(1); });
}
