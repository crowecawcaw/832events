import { describe, it, expect } from "vitest";
import { writeFile } from "fs/promises";
import { tmpdir } from "os";
import { join } from "path";
import {
    registrableDomain, canonicalUrl, loadQueries, rotateQueries,
    nextCheck, detectPlatform, braveSearch, reclassifyIgnored, loadIgnoreDomains,
    type FetchImpl, type LedgerEntry,
} from "./discovery-crawl.js";

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

describe("nextCheck backoff", () => {
    const now = new Date(Date.UTC(2026, 0, 1));
    it("rechecks new items the next day", () => {
        expect(nextCheck("new", 0, now)).toBe("2026-01-02");
    });
    it("backs off dead items exponentially", () => {
        const a = nextCheck("dead", 1, now);
        const b = nextCheck("dead", 4, now);
        expect(new Date(b).getTime()).toBeGreaterThan(new Date(a).getTime());
    });
    it("parks promoted sources far out", () => {
        expect(new Date(nextCheck("promoted", 0, now)).getUTCFullYear()).toBeGreaterThan(2030);
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
    it("detects tribe events ical query", () => {
        const r = detectPlatform('<a href="https://v.com/events/?ical=1">subscribe</a>', "https://v.com");
        expect(r.icsUrl).toContain("ical=1");
    });
});

describe("reclassifyIgnored", () => {
    const mk = (domain: string, status: LedgerEntry["status"]): LedgerEntry => ({
        url: `https://${domain}/x`, domain, firstSeen: "", lastSeen: "",
        lastChecked: null, checkCount: 0, status, nextCheckAfter: "", queries: [],
    });
    const ignore = new Set(["culturemap.com", "houstonchronicle.com"]);
    it("downgrades now-ignored domains and leaves real ones", () => {
        const entries: Record<string, LedgerEntry> = {
            a: mk("culturemap.com", "probed"),       // editorial -> ignore
            b: mk("spindletap.com", "new"),           // real venue -> keep
            c: mk("houstonchronicle.com", "ignored"), // already ignored -> no change
        };
        const n = reclassifyIgnored(entries, ignore, new Date(Date.UTC(2026, 0, 1)));
        expect(n).toBe(1);
        expect(entries.a.status).toBe("ignored");
        expect(entries.b.status).toBe("new");
    });
});

describe("loadIgnoreDomains", () => {
    it("unions the core set with the data file", async () => {
        const tmp = join(tmpdir(), `ign-${Date.now()}.txt`);
        await writeFile(tmp, "# comment\nculturemap.com\n\nEXAMPLE.COM\n");
        const set = await loadIgnoreDomains(tmp);
        expect(set.has("facebook.com")).toBe(true); // core
        expect(set.has("culturemap.com")).toBe(true); // file
        expect(set.has("example.com")).toBe(true); // lowercased
    });
    it("falls back to core when the file is missing", async () => {
        const set = await loadIgnoreDomains(join(tmpdir(), "nope-does-not-exist.txt"));
        expect(set.has("facebook.com")).toBe(true);
    });
});

describe("braveSearch pagination", () => {
    it("paginates until an empty page and reports per-page counts", async () => {
        const pages: Record<number, number> = { 0: 20, 1: 20, 2: 0 };
        const fetchImpl: FetchImpl = (async (input: any) => {
            const off = parseInt(new URL(input.toString()).searchParams.get("offset")!, 10);
            const n = pages[off] ?? 0;
            const results = Array.from({ length: n }, (_, i) => ({ url: `https://r${off}-${i}.com` }));
            return new Response(JSON.stringify({ web: { results } }), { status: 200 });
        }) as FetchImpl;
        const { results, perPage } = await braveSearch("q", { pages: 5, key: "k", fetchImpl, throttleMs: 0 });
        expect(perPage).toEqual([20, 20, 0]);
        expect(results).toHaveLength(40);
    });
    it("stops paginating on 429", async () => {
        const fetchImpl: FetchImpl = (async () =>
            new Response("rate", { status: 429 })) as FetchImpl;
        const { perPage } = await braveSearch("q", { pages: 5, key: "k", fetchImpl, throttleMs: 0 });
        expect(perPage).toEqual([0]);
    });
});
