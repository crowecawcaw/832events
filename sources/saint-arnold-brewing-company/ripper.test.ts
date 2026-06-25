import { describe, it, expect } from "vitest";
import { parse } from "node-html-parser";
import { LocalDateTime, ZoneId } from "@js-joda/core";
import {
    parseEventDatesFromContent,
    hashEventId as ripperHashEventId,
} from "./ripper.js";

describe("Saint Arnold Brewing Company Ripper", () => {
    it("should parse event links from post grid", () => {
        const html = `
        <div class="nectar-post-grid-item">
            <h3 class="post-heading"><a href="https://www.saintarnold.com/soccer-at-saint-arnold/">Soccer at Saint Arnold</a></h3>
        </div>
        <div class="nectar-post-grid-item">
            <h3 class="post-heading"><a href="https://www.saintarnold.com/brewery-tours/">Brewery Tours</a></h3>
        </div>
        `;

        const root = parse(html);
        const postItems = root.querySelectorAll(".nectar-post-grid-item");

        expect(postItems).toHaveLength(2);
        const firstTitle = postItems[0]?.querySelector("h3.post-heading a")?.textContent;
        expect(firstTitle).toBe("Soccer at Saint Arnold");
    });

    it("should handle multiple date/time pairs in event content", () => {
        const html = `
        <article>
            <div class="content-inner">
                <p><strong>Thursday, June 11</strong> Mexico v South Africa | 2:00 PM</p>
                <p><strong>Friday, June 12</strong> USA v Paraguay | 8:00 PM</p>
                <p><strong>Saturday, June 13</strong> Brazil v Morocco | 5:00 PM</p>
            </div>
        </article>
        `;

        const root = parse(html);
        const contentInner = root.querySelector(".content-inner");
        expect(contentInner).toBeDefined();

        // Verify we can extract the text
        const text = contentInner?.textContent || "";
        expect(text).toContain("June 11");
        expect(text).toContain("2:00 PM");
    });

    it("should parse different date formats", () => {
        const htmlFormats = [
            `<strong>June 11</strong> Event at 2:00 PM`,
            `<strong>Thursday, June 11</strong> Event at 2:00 PM`,
            `<strong>Friday, June 12</strong> Event at 8:00 PM`,
            `<strong>Saturday, June 13</strong> Event at 5:00 PM`,
        ];

        htmlFormats.forEach((html) => {
            // Check if the pattern can be found
            const dateTimePattern = /(<strong>[\s\w,]*?(\d{1,2})[\s\w,]*?<\/strong>[\s\S]{0,300}?(\d{1,2}):(\d{2})\s*(AM|PM))/i;
            const match = html.match(dateTimePattern);
            expect(match).toBeTruthy();
            if (match) {
                expect(match[2]).toBeDefined(); // day number
                expect(match[3]).toBeDefined(); // hour
                expect(match[4]).toBeDefined(); // minute
                expect(match[5]).toBeDefined(); // AM/PM
            }
        });
    });

    it("should generate stable event IDs", () => {
        // Two calls with same title/date should produce same ID
        const title = "Soccer at Saint Arnold";
        const dateStr = "2026-06-11";

        const id1 = hashEventId(title, dateStr);
        const id2 = hashEventId(title, dateStr);

        expect(id1).toBe(id2);
        expect(id1).toContain("soccer-at-saint-arnold");
        expect(id1).toContain("2026-06-11");
    });

    it("should generate different IDs for different dates", () => {
        const title = "Soccer at Saint Arnold";
        const id1 = hashEventId(title, "2026-06-11");
        const id2 = hashEventId(title, "2026-06-12");

        expect(id1).not.toBe(id2);
    });

    it("should handle PM time conversion", () => {
        // 2:00 PM should become 14:00 in 24-hour format
        const hour = "2";
        const ampm = "PM";

        const hourNum = parseInt(hour, 10);
        const adjustedHour =
            ampm === "PM" && hourNum !== 12 ? hourNum + 12 : ampm === "AM" && hourNum === 12 ? 0 : hourNum;

        expect(adjustedHour).toBe(14);
    });

    it("should handle AM time conversion", () => {
        // 8:00 AM should remain 8
        const hour = "8";
        const ampm = "AM";

        const hourNum = parseInt(hour, 10);
        const adjustedHour =
            ampm === "PM" && hourNum !== 12 ? hourNum + 12 : ampm === "AM" && hourNum === 12 ? 0 : hourNum;

        expect(adjustedHour).toBe(8);
    });

    it("should handle 12:00 PM correctly", () => {
        // 12:00 PM should remain 12
        const hour = "12";
        const ampm = "PM";

        const hourNum = parseInt(hour, 10);
        const adjustedHour =
            ampm === "PM" && hourNum !== 12 ? hourNum + 12 : ampm === "AM" && hourNum === 12 ? 0 : hourNum;

        expect(adjustedHour).toBe(12);
    });

    it("should handle 12:00 AM correctly", () => {
        // 12:00 AM should become 0 (midnight)
        const hour = "12";
        const ampm = "AM";

        const hourNum = parseInt(hour, 10);
        const adjustedHour =
            ampm === "PM" && hourNum !== 12 ? hourNum + 12 : ampm === "AM" && hourNum === 12 ? 0 : hourNum;

        expect(adjustedHour).toBe(0);
    });

    // --- parseEventDatesFromContent: real code-path coverage ---

    function isError(item: unknown): boolean {
        return typeof item === "object" && item !== null && (item as { error?: unknown }).error === true;
    }

    it("parses a dated event post into a calendar event (success path)", () => {
        const html = `
        <article>
            <div class="content-inner">
                <p>Ride with the team! <strong>Friday, October 17</strong> Kickoff party | 6:00 PM</p>
            </div>
        </article>`;

        const result = parseEventDatesFromContent(html, "Bike Around the Bay");

        const events = result.filter((r) => !isError(r));
        const errors = result.filter((r) => isError(r));
        expect(errors).toHaveLength(0);
        expect(events).toHaveLength(1);
        // id is stable + derived from title/date
        expect((events[0] as { id: string }).id).toContain("bike-around-the-bay");
        expect((events[0] as { summary: string }).summary).toBe("Bike Around the Bay");
    });

    it("parses multiple distinct dated entries in one post", () => {
        const html = `
        <article>
            <div class="content-inner">
                <p><strong>Thursday, June 11</strong> Match A | 2:00 PM</p>
                <p><strong>Friday, June 12</strong> Match B | 8:00 PM</p>
            </div>
        </article>`;

        const result = parseEventDatesFromContent(html, "Soccer at Saint Arnold");
        const events = result.filter((r) => !isError(r));
        expect(events.length).toBeGreaterThanOrEqual(2);
        expect(result.filter((r) => isError(r))).toHaveLength(0);
    });

    it("skips an undated/evergreen post silently (no error, no event)", () => {
        // Regression: evergreen promo posts (tours, giveaways, ongoing
        // collaborations) carry no calendar date and must NOT emit a counted
        // "No dated events found in content" error.
        const html = `
        <article>
            <div class="content-inner">
                <p>Enter to win a $100 gift card and a VIP brewery tour. No purchase necessary.
                Must be 21+. Watch the best soccer this summer on our Super Screen.</p>
            </div>
        </article>`;

        const result = parseEventDatesFromContent(html, "Enter to Win Saint Arnold Prizes");
        expect(result).toHaveLength(0);
        expect(result.some(isError)).toBe(false);
    });

    it("skips a post that has a time but no <strong> calendar date (promo prose)", () => {
        // A time mentioned in flowing prose is not enough to place an event on a
        // calendar. Without a structured <strong> date these are promotional
        // posts (pub-crawl lineups, festival bills) and must be skipped silently,
        // not counted as errors against the build gate.
        const html = `
        <article>
            <div class="content-inner">
                <p>Doors at 8:00 PM. See you there!</p>
            </div>
        </article>`;

        const result = parseEventDatesFromContent(html, "Mystery Show");
        expect(result).toHaveLength(0);
        expect(result.some(isError)).toBe(false);
    });

    it("creates an all-day event from a <strong> date with no adjacent time", () => {
        // All-day / time-TBD happenings (e.g. "Bike Around the Bay | Saturday,
        // October 17 & Sunday, October 18") carry a <strong> date but no headline
        // time. They must still publish as events using a default midday start,
        // not be dropped or flagged.
        const html = `
        <article>
            <div class="content-inner">
                <p><strong>Saturday, October 17 & Sunday, October 18</strong></p>
                <p>Join us all weekend for the ride. Activities throughout the day.</p>
            </div>
        </article>`;

        const result = parseEventDatesFromContent(html, "Bike Around the Bay");
        const events = result.filter((r) => !isError(r));
        expect(result.some(isError)).toBe(false);
        expect(events.length).toBeGreaterThanOrEqual(1);
        expect((events[0] as { summary: string }).summary).toBe("Bike Around the Bay");
    });

    it("does not mint a spurious event from a year in a <strong> tag", () => {
        // "June 1994" must not be read as "June 19"; a post whose only <strong>
        // tag is prose with a year carries no event date and is skipped.
        const html = `
        <article>
            <div class="content-inner">
                <p><strong>Brewing since June 1994</strong> — celebrating Houston culture.</p>
            </div>
        </article>`;

        const result = parseEventDatesFromContent(html, "Our Story");
        expect(result).toHaveLength(0);
        expect(result.some(isError)).toBe(false);
    });

    it("errors when the post is missing the expected article structure", () => {
        const result = parseEventDatesFromContent("<div>no article here</div>", "Broken Post");
        expect(result).toHaveLength(1);
        expect(isError(result[0])).toBe(true);
        expect((result[0] as { reason: string }).reason).toBe("No article element found");
    });

    it("exported hashEventId matches the local helper (stable ids)", () => {
        const a = ripperHashEventId("Soccer at Saint Arnold", "2026-06-11");
        const b = hashEventId("Soccer at Saint Arnold", "2026-06-11");
        expect(a).toBe(b);
    });
});

// Helper function for testing (duplicated from ripper.ts for test purposes)
function hashEventId(title: string, dateStr: string): string {
    const slugify = (s: string) =>
        s
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, "-")
            .replace(/^-+|-+$/g, "");

    const key = `${slugify(title)}-${dateStr}`;
    const crypto = require("crypto");
    const hash = crypto
        .createHash("sha256")
        .update(key)
        .digest("hex")
        .substring(0, 8);
    return `${key}-${hash}`;
}
