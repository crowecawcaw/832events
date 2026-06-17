import { describe, it, expect } from "vitest";
import { parse } from "node-html-parser";
import { LocalDate, LocalTime } from "@js-joda/core";
import crypto from "crypto";
import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));

describe("Karbach Brewing Ripper", () => {
    it("should extract event info from article cards", () => {
        const html = `
        <article class="article">
            <a href="/community/event/summer-soccer-at-karbach/" class="thumb">
                <div class="flag">At The Brewery</div>
            </a>
            <div class="excerpt">
                <time><a href="/community/event/summer-soccer-at-karbach/">June 11, 2026</a></time>
                <h1><a href="/community/event/summer-soccer-at-karbach/">Summer Soccer at Karbach</a></h1>
                <p></p>
            </div>
        </article>
        <article class="article">
            <a href="/community/event/juneteenth/" class="thumb">
                <div class="flag">At The Brewery</div>
            </a>
            <div class="excerpt">
                <time><a href="/community/event/juneteenth/">June 19, 2026</a></time>
                <h1><a href="/community/event/juneteenth/">Juneteenth Celebration</a></h1>
                <p></p>
            </div>
        </article>
        `;

        const root = parse(html);
        const articles = root.querySelectorAll("article.article");

        expect(articles).toHaveLength(2);

        const firstTitle = articles[0]?.querySelector("h1 a")?.textContent;
        expect(firstTitle).toBe("Summer Soccer at Karbach");

        const firstDate = articles[0]?.querySelector("time a")?.textContent;
        expect(firstDate).toBe("June 11, 2026");

        const secondTitle = articles[1]?.querySelector("h1 a")?.textContent;
        expect(secondTitle).toBe("Juneteenth Celebration");
    });

    it("should filter out recurring events without explicit dates", () => {
        const html = `
        <article class="article">
            <div class="excerpt">
                <time><a href="/community/event/summer-soccer/">June 11, 2026</a></time>
                <h1><a href="/community/event/summer-soccer/">Summer Soccer</a></h1>
            </div>
        </article>
        <article class="article">
            <div class="excerpt">
                <time><a href="/community/event/running-club/">Every Thursday</a></time>
                <h1><a href="/community/event/running-club/">Running Club</a></h1>
            </div>
        </article>
        <article class="article">
            <div class="excerpt">
                <time><a href="/community/event/trivia/">Bi-weekly on Tuesdays</a></time>
                <h1><a href="/community/event/trivia/">Trivia Night</a></h1>
            </div>
        </article>
        `;

        const root = parse(html);
        const articles = root.querySelectorAll("article.article");

        expect(articles).toHaveLength(3);

        // Filter to only explicit dates
        const eventsWithDates = articles.filter((article) => {
            const timeElement = article.querySelector("time a");
            const dateStr = timeElement?.textContent?.trim() || "";
            const hasExplicitDate = /\b(January|February|March|April|May|June|July|August|September|October|November|December|Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)\s+(\d{1,2})(?:\s*,\s*(\d{4}))?\b/i.test(dateStr);
            return hasExplicitDate;
        });

        expect(eventsWithDates).toHaveLength(1);
        const title = eventsWithDates[0]?.querySelector("h1 a")?.textContent;
        expect(title).toBe("Summer Soccer");
    });

    it("should load and parse sample data", () => {
        const sampleFile = join(__dirname, "sample-data.html");
        const html = readFileSync(sampleFile, "utf-8");
        const root = parse(html);
        const articles = root.querySelectorAll("article.article");

        expect(articles.length).toBeGreaterThan(0);

        // Check that events with explicit dates are found
        let datedEvents = 0;
        articles.forEach((article) => {
            const timeElement = article.querySelector("time a");
            const dateStr = timeElement?.textContent?.trim() || "";
            const hasExplicitDate = /\b(January|February|March|April|May|June|July|August|September|October|November|December|Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)\s+(\d{1,2})(?:\s*,\s*(\d{4}))?\b/i.test(dateStr);
            if (hasExplicitDate) {
                datedEvents++;
            }
        });

        expect(datedEvents).toBeGreaterThan(0);
    });

    it("should parse dates like 'June 11, 2026'", () => {
        const dateStr = "June 11, 2026";
        const monthMap: Record<string, number> = {
            january: 1, february: 2, march: 3, april: 4, may: 5, june: 6,
            july: 7, august: 8, september: 9, october: 10, november: 11, december: 12,
            jan: 1, feb: 2, mar: 3, apr: 4, jun: 6, jul: 7, aug: 8,
            sep: 9, sept: 9, oct: 10, nov: 11, dec: 12,
        };

        const match = dateStr.match(/(January|February|March|April|May|June|July|August|September|October|November|December|Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)\s+(\d{1,2})(?:\s*,\s*(\d{4}))?/i);

        expect(match).toBeTruthy();
        if (match) {
            const month = monthMap[match[1].toLowerCase()];
            const day = parseInt(match[2], 10);
            const year = match[3] ? parseInt(match[3], 10) : LocalDate.now().year();

            expect(month).toBe(6);
            expect(day).toBe(11);
            expect(year).toBe(2026);

            const date = LocalDate.of(year, month, day);
            expect(date.toString()).toBe("2026-06-11");
        }
    });

    it("should extract time from event content (11am opening)", () => {
        const html = `
        <div class="content">
            <p>We will be open daily at 11am for all matches during the tournament, showing them on our 14-foot LED screen with sound in the Biergarten.</p>
        </div>
        `;

        const match = html.match(/open[^<]*?(?:at|@)\s*(\d{1,2})(?::(\d{2}))?\s*(am|pm)/i);

        expect(match).toBeTruthy();
        if (match) {
            const hour = parseInt(match[1], 10);
            const minutes = match[2] ? parseInt(match[2], 10) : 0;
            const ampm = match[3].toLowerCase();

            expect(hour).toBe(11);
            expect(minutes).toBe(0);
            expect(ampm).toBe("am");

            const adjustedHour = ampm === "pm" && hour !== 12 ? hour + 12 : ampm === "am" && hour === 12 ? 0 : hour;
            const time = LocalTime.of(adjustedHour, minutes);
            expect(time.hour()).toBe(11);
            expect(time.minute()).toBe(0);
        }
    });

    it("should generate stable event IDs", () => {
        const slugify = (s: string) =>
            s
                .toLowerCase()
                .replace(/[^a-z0-9]+/g, "-")
                .replace(/^-+|-+$/g, "");

        const hashEventId = (title: string, dateStr: string): string => {
            const key = `${slugify(title)}-${dateStr}`;
            const hash = crypto
                .createHash("sha256")
                .update(key)
                .digest("hex")
                .substring(0, 8);
            return `${key}-${hash}`;
        };

        const title = "Summer Soccer at Karbach";
        const dateStr = "2026-06-11";

        const id1 = hashEventId(title, dateStr);
        const id2 = hashEventId(title, dateStr);

        expect(id1).toBe(id2);
        expect(id1).toContain("summer-soccer-at-karbach");
        expect(id1).toContain("2026-06-11");
    });

    it("should generate different IDs for different dates", () => {
        const slugify = (s: string) =>
            s
                .toLowerCase()
                .replace(/[^a-z0-9]+/g, "-")
                .replace(/^-+|-+$/g, "");

        const hashEventId = (title: string, dateStr: string): string => {
            const key = `${slugify(title)}-${dateStr}`;
            const hash = crypto
                .createHash("sha256")
                .update(key)
                .digest("hex")
                .substring(0, 8);
            return `${key}-${hash}`;
        };

        const title = "Summer Soccer at Karbach";
        const id1 = hashEventId(title, "2026-06-11");
        const id2 = hashEventId(title, "2026-06-18");

        expect(id1).not.toBe(id2);
    });

    it("should handle AM/PM time conversion correctly", () => {
        const testCases = [
            { hour: "11", ampm: "am", expected: 11 },
            { hour: "2", ampm: "pm", expected: 14 },
            { hour: "12", ampm: "pm", expected: 12 },
            { hour: "12", ampm: "am", expected: 0 },
            { hour: "6", ampm: "am", expected: 6 },
            { hour: "6", ampm: "pm", expected: 18 },
        ];

        testCases.forEach(({ hour, ampm, expected }) => {
            const hourNum = parseInt(hour, 10);
            const adjustedHour =
                ampm === "pm" && hourNum !== 12
                    ? hourNum + 12
                    : ampm === "am" && hourNum === 12
                      ? 0
                      : hourNum;
            expect(adjustedHour).toBe(expected);
        });
    });

    it("should handle dates without year (assume current or next year)", () => {
        const dateStr = "June 11";
        const monthMap: Record<string, number> = {
            june: 6,
        };

        const match = dateStr.match(/(January|February|March|April|May|June|July|August|September|October|November|December|Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)\s+(\d{1,2})(?:\s*,\s*(\d{4}))?/i);

        expect(match).toBeTruthy();
        if (match) {
            const month = monthMap[match[1].toLowerCase()];
            const day = parseInt(match[2], 10);
            let year = match[3] ? parseInt(match[3], 10) : LocalDate.now().year();

            expect(month).toBe(6);
            expect(day).toBe(11);
            // Year should be determined based on current date logic
        }
    });
});
