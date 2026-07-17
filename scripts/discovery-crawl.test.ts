import { describe, it, expect } from "vitest";
import { mkdtemp, writeFile, rm } from "fs/promises";
import { tmpdir } from "os";
import { join } from "path";
import {
    registrableDomain, canonicalUrl, loadQueries, rotateQueries, detectPlatform,
    braveSearch, sniffVcalendar, parseDtstartDate, futureDtstartCount, analyzeIcsBody,
    computeTier, buildShortlist, probeDomain, loadKnownDomains, run,
    SKIP_DOMAINS, CONFIG_PLATFORMS,
    type FetchImpl, type CandidateProbe, type ProbeResult,
} from "./discovery-crawl.js";

const mkProbe = (p: Partial<CandidateProbe> & { domain: string }): CandidateProbe => ({
    url: `https://${p.domain}/`, reachable: true, platformGuess: null, icsUrl: null,
    verified: false, eventCount: 0, upcomingCount: 0, queryHits: 1, ...p,
});

describe("registrableDomain", () => {
    it("strips www and path", () => {
        expect(registrableDomain("https://www.axelradhouston.com/calendar")).toBe("axelradhouston.com");
    });
    it("collapses subdomains to eTLD+1", () => {
        expect(registrableDomain("https://events.example.org/x")).toBe("example.org");
    });
    it("handles multi-part TLDs", () => {
        expect(registrableDomain("https://foo.bar.co.uk/")).toBe("bar.co.uk");
    });
    it("returns null on garbage", () => {
        expect(registrableDomain("not a url")).toBeNull();
    });
});

describe("canonicalUrl", () => {
    it("drops fragment, tracking params, trailing slash, www", () => {
        expect(canonicalUrl("https://www.Foo.com/Events/?utm_source=x&id=5#top"))
            .toBe("https://foo.com/Events/?id=5".replace(/\/$/, ""));
    });
    it("is stable for already-clean urls", () => {
        expect(canonicalUrl("https://foo.com/a")).toBe("https://foo.com/a");
    });
});

describe("loadQueries", () => {
    it("ignores comments and blanks", () => {
        expect(loadQueries("# c\n\nfoo\n  bar baz \n#x")).toEqual(["foo", "bar baz"]);
    });
});

describe("rotateQueries", () => {
    const all = ["a", "b", "c", "d", "e"];
    it("returns all when max >= length", () => {
        expect(rotateQueries(all, 10)).toEqual(all);
    });
    it("returns a window of size max", () => {
        const r = rotateQueries(all, 2, new Date(Date.UTC(2026, 0, 1)));
        expect(r).toHaveLength(2);
        expect(all).toContain(r[0]);
    });
    it("advances the window across days", () => {
        const d1 = rotateQueries(all, 2, new Date(Date.UTC(2026, 0, 1)));
        const d2 = rotateQueries(all, 2, new Date(Date.UTC(2026, 0, 2)));
        expect(d1).not.toEqual(d2);
    });
});

describe("detectPlatform", () => {
    it("finds an ics link tag", () => {
        const { platform, icsUrl } = detectPlatform(
            '<link rel="alternate" type="text/calendar" href="/feed.ics">', "https://v.com/");
        expect(icsUrl).toBe("https://v.com/feed.ics");
        expect(platform).toBe("ics");
    });
    it("detects squarespace", () => {
        expect(detectPlatform("<script src='https://static1.squarespace.com/x'></script>", "https://v.com").platform).toBe("squarespace");
    });
    it("detects tribe events ical query and resolves it absolute", () => {
        const r = detectPlatform('<a href="/events/?ical=1">subscribe</a>', "https://v.com/events");
        expect(r.icsUrl).toBe("https://v.com/events/?ical=1");
        expect(r.platform).toBe("ics");
    });
    it("returns nulls when nothing matches", () => {
        expect(detectPlatform("<p>hello</p>", "https://v.com")).toEqual({ platform: null, icsUrl: null });
    });
});

describe("skip list", () => {
    it("folds platforms, socials, and the old ignore-domains list", () => {
        for (const d of ["eventbrite.com", "ticketmaster.com", "facebook.com", "meetup.com",
            "culturemap.com", "houstonchronicle.com", "timeout.com", "downtownhouston.org"]) {
            expect(SKIP_DOMAINS.has(d)).toBe(true);
        }
    });
});

describe("sniffVcalendar", () => {
    const ics = [
        "BEGIN:VCALENDAR",
        "BEGIN:VEVENT",
        "DTSTART:20260101T180000Z",
        "END:VEVENT",
        "BEGIN:VEVENT",
        "DTSTART;TZID=America/Chicago:20200301T090000",
        "END:VEVENT",
        "END:VCALENDAR",
    ].join("\r\n");
    it("detects a calendar, counts events, extracts DTSTARTs", () => {
        const r = sniffVcalendar(ics);
        expect(r.isCalendar).toBe(true);
        expect(r.eventCount).toBe(2);
        expect(r.dtstarts).toEqual(["20260101T180000Z", "20200301T090000"]);
    });
    it("flags a non-calendar HTML body", () => {
        expect(sniffVcalendar("<html><body>Not found</body></html>").isCalendar).toBe(false);
    });
});

describe("parseDtstartDate / futureDtstartCount", () => {
    const now = new Date(Date.UTC(2026, 0, 1));
    it("parses YYYYMMDD prefixes across value formats", () => {
        expect(parseDtstartDate("20260615T180000Z")?.getUTCFullYear()).toBe(2026);
        expect(parseDtstartDate("20260615")?.getUTCMonth()).toBe(5);
        expect(parseDtstartDate("garbage")).toBeNull();
    });
    it("counts only future DTSTARTs relative to injected now", () => {
        expect(futureDtstartCount(["20260101T180000Z", "20200301T090000", "20261231"], now)).toBe(2);
    });
});

describe("analyzeIcsBody (verify + demotion)", () => {
    const now = new Date(Date.UTC(2026, 0, 1));
    it("verifies a real VCALENDAR with a future event", () => {
        const body = "BEGIN:VCALENDAR\r\nBEGIN:VEVENT\r\nDTSTART:20260601T000000Z\r\nEND:VEVENT\r\nEND:VCALENDAR";
        expect(analyzeIcsBody(body, now)).toEqual({ verified: true, eventCount: 1, upcomingCount: 1 });
    });
    it("demotes an HTML page served where an .ics was expected", () => {
        expect(analyzeIcsBody("<!DOCTYPE html><title>Events</title>", now))
            .toEqual({ verified: false, eventCount: 0, upcomingCount: 0 });
    });
    it("verifies a stale feed but reports 0 upcoming", () => {
        const body = "BEGIN:VCALENDAR\r\nBEGIN:VEVENT\r\nDTSTART:20200101T000000Z\r\nEND:VEVENT\r\nEND:VCALENDAR";
        expect(analyzeIcsBody(body, now)).toEqual({ verified: true, eventCount: 1, upcomingCount: 0 });
    });
});

describe("computeTier", () => {
    const base: ProbeResult = {
        url: "https://v.com/", domain: "v.com", reachable: true, platformGuess: null,
        icsUrl: null, verified: false, eventCount: 0, upcomingCount: 0,
    };
    it("tier 1 for a verified feed with upcoming events", () => {
        expect(computeTier({ ...base, verified: true, upcomingCount: 3 })).toBe(1);
    });
    it("NOT tier 1 for a verified feed with no upcoming events", () => {
        expect(computeTier({ ...base, verified: true, upcomingCount: 0 })).toBe(3);
    });
    it("tier 2 for a config-only platform", () => {
        expect(computeTier({ ...base, platformGuess: "squarespace" })).toBe(2);
    });
    it("tier 3 for reachable-but-unidentified (incl. demoted ics platform)", () => {
        expect(computeTier({ ...base, platformGuess: "ics", icsUrl: "https://v.com/x.ics", verified: false })).toBe(3);
        expect(computeTier({ ...base })).toBe(3);
    });
    it("tier 0 for unreachable", () => {
        expect(computeTier({ ...base, reachable: false })).toBe(0);
    });
});

describe("buildShortlist", () => {
    it("keeps only tier 1-2, feeds before platforms, dedups by domain, caps", () => {
        const items: CandidateProbe[] = [
            mkProbe({ domain: "feed.com", verified: true, upcomingCount: 5, queryHits: 1 }),
            mkProbe({ domain: "sq.com", platformGuess: "eventbrite", queryHits: 3 }),
            mkProbe({ domain: "u.com", reachable: true }),                       // tier 3 -> excluded
            mkProbe({ domain: "dead.com", reachable: false }),                   // tier 0 -> excluded
            mkProbe({ domain: "feed.com", platformGuess: "axs", url: "https://feed.com/2" }), // dup domain
        ];
        const sl = buildShortlist(items, 15);
        expect(sl.map(s => s.domain)).toEqual(["feed.com", "sq.com"]);
        expect(sl[0].tier).toBe(1); // kept the verified feed entry for feed.com
    });
    it("orders same-tier by upcomingCount then queryHits desc", () => {
        const items: CandidateProbe[] = [
            mkProbe({ domain: "a.com", verified: true, upcomingCount: 2, queryHits: 9 }),
            mkProbe({ domain: "b.com", verified: true, upcomingCount: 10, queryHits: 1 }),
        ];
        expect(buildShortlist(items).map(s => s.domain)).toEqual(["b.com", "a.com"]);
    });
    it("respects the cap of 15", () => {
        const items = Array.from({ length: 30 }, (_, i) => mkProbe({ domain: `e${i}.com`, platformGuess: "axs" }));
        expect(buildShortlist(items, 15)).toHaveLength(15);
    });
});

describe("probeDomain", () => {
    const now = new Date(Date.UTC(2026, 0, 1));

    it("verifies a linked .ics feed → tier 1", async () => {
        const fetchImpl: FetchImpl = (async (input: any) => {
            const u = input.toString();
            if (u.endsWith("/feed.ics")) {
                return new Response("BEGIN:VCALENDAR\r\nBEGIN:VEVENT\r\nDTSTART:20260601T000000Z\r\nEND:VEVENT\r\nEND:VCALENDAR", { status: 200 });
            }
            return new Response('<link type="text/calendar" href="/feed.ics">', { status: 200 });
        }) as FetchImpl;
        const r = await probeDomain("https://good.com/", { fetchImpl, now });
        expect(r.verified).toBe(true);
        expect(r.upcomingCount).toBe(1);
        expect(computeTier(r)).toBe(1);
    });

    it("DEMOTES a feed link whose .ics now returns HTML", async () => {
        const fetchImpl: FetchImpl = (async (input: any) => {
            const u = input.toString();
            if (u.endsWith("/feed.ics")) return new Response("<!doctype html><title>oops</title>", { status: 200 });
            return new Response('<link type="text/calendar" href="/feed.ics">', { status: 200 });
        }) as FetchImpl;
        const r = await probeDomain("https://rotten.com/", { fetchImpl, now });
        expect(r.icsUrl).toContain("feed.ics"); // recorded what was tried
        expect(r.verified).toBe(false);
        expect(computeTier(r)).toBe(3); // demoted out of tier 1
    });

    it("finds a feed via a well-known endpoint when the HTML has none", async () => {
        const calls: string[] = [];
        const fetchImpl: FetchImpl = (async (input: any) => {
            const u = input.toString();
            calls.push(u);
            if (u === "https://wp.com/events/?ical=1") return new Response("<html>no</html>", { status: 404 });
            if (u === "https://wp.com/?post_type=tribe_events&ical=1") {
                return new Response("BEGIN:VCALENDAR\r\nBEGIN:VEVENT\r\nDTSTART:20260701\r\nEND:VEVENT\r\nEND:VCALENDAR", { status: 200 });
            }
            return new Response("<html>plain page, no feed link</html>", { status: 200 });
        }) as FetchImpl;
        const r = await probeDomain("https://wp.com/", { fetchImpl, now });
        expect(r.verified).toBe(true);
        expect(r.icsUrl).toBe("https://wp.com/?post_type=tribe_events&ical=1");
        expect(computeTier(r)).toBe(1);
    });

    it("respects the per-domain request budget (page + 2 well-known)", async () => {
        let n = 0;
        const fetchImpl: FetchImpl = (async () => {
            n++;
            return new Response("<html>plain</html>", { status: 200 }); // never a VCALENDAR
        }) as FetchImpl;
        const r = await probeDomain("https://budget.com/", { fetchImpl, now, maxRequests: 3 });
        expect(n).toBe(3); // 1 page + 2 well-known probes, capped
        expect(r.reachable).toBe(true);
        expect(r.verified).toBe(false);
    });

    it("marks an unreachable domain (network error) as tier 0", async () => {
        const fetchImpl: FetchImpl = (async () => { throw new Error("ECONNREFUSED"); }) as FetchImpl;
        const r = await probeDomain("https://down.com/", { fetchImpl, now });
        expect(r.reachable).toBe(false);
        expect(computeTier(r)).toBe(0);
    });
});

describe("braveSearch pagination", () => {
    it("paginates until an empty page and reports per-page counts", async () => {
        const pages: Record<number, number> = { 0: 20, 1: 20, 2: 0 };
        const fetchImpl: FetchImpl = (async (input: any) => {
            const off = parseInt(new URL(input.toString()).searchParams.get("offset")!, 10);
            const nn = pages[off] ?? 0;
            const results = Array.from({ length: nn }, (_, i) => ({ url: `https://r${off}-${i}.com` }));
            return new Response(JSON.stringify({ web: { results } }), { status: 200 });
        }) as FetchImpl;
        const { results, perPage } = await braveSearch("q", { pages: 5, key: "k", fetchImpl, throttleMs: 0 });
        expect(perPage).toEqual([20, 20, 0]);
        expect(results).toHaveLength(40);
    });
    it("stops paginating on 429", async () => {
        const fetchImpl: FetchImpl = (async () => new Response("rate", { status: 429 })) as FetchImpl;
        const { perPage } = await braveSearch("q", { pages: 5, key: "k", fetchImpl, throttleMs: 0 });
        expect(perPage).toEqual([0]);
    });
});

describe("loadKnownDomains (stateless memory)", () => {
    it("reads candidate URLs from a temp source-candidates dir and dedups them", async () => {
        const sourcesDir = await mkdtemp(join(tmpdir(), "src-"));
        const candDir = await mkdtemp(join(tmpdir(), "cand-"));
        try {
            await writeFile(join(sourcesDir, "a.yaml"),
                'icsUrl: "https://integratedvenue.com/feed.ics"\ninfoUrl: "https://integratedvenue.com/cal"\n');
            await writeFile(join(candDir, "x.yaml"),
                "name: Rejected Thing\nstatus: notviable\nurl: https://rejected.com/\n");
            await writeFile(join(candDir, "y.yaml"),
                "name: No URL\nstatus: dead\n"); // no url field — must not throw
            const known = await loadKnownDomains(sourcesDir, candDir);
            expect(known.has("integratedvenue.com")).toBe(true);
            expect(known.has("rejected.com")).toBe(true);
        } finally {
            await rm(sourcesDir, { recursive: true, force: true });
            await rm(candDir, { recursive: true, force: true });
        }
    });

    it("returns empty on a missing sources/candidates dir (cold copy)", async () => {
        const known = await loadKnownDomains(join(tmpdir(), "nope-src"), join(tmpdir(), "nope-cand"));
        expect(known.size).toBe(0);
    });
});

describe("run", () => {
    it("no-ops with an empty key: empty shortlist, skippedNoKey, no fetch", async () => {
        let called = false;
        const fetchImpl: FetchImpl = (async () => { called = true; return new Response("{}"); }) as FetchImpl;
        const res = await run({
            pages: 1, maxQueries: 1, rotate: false, probeCap: 5, key: "", fetchImpl,
        });
        expect(res.items).toEqual([]);
        expect(res.stats.skippedNoKey).toBe(true);
        expect(called).toBe(false);
    });
});

describe("CONFIG_PLATFORMS", () => {
    it("excludes bare ics feeds (those must be verified, not config)", () => {
        expect(CONFIG_PLATFORMS.has("ics")).toBe(false);
        expect(CONFIG_PLATFORMS.has("squarespace")).toBe(true);
    });
});
