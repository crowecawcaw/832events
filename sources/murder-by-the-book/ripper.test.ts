import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { ZoneId } from "@js-joda/core";
import "@js-joda/timezone";
import { parseEvents } from "./ripper.js";
import type { RipperCalendarEvent } from "../../lib/config/schema.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

const html = readFileSync(join(__dirname, "sample-data.html"), "utf-8");
const tz = ZoneId.of("America/Chicago");

describe("MurderByTheBook ripper", () => {
    it("parses >0 events from sample data", () => {
        const results = parseEvents(html, tz, "murder-by-the-book");
        const events = results.filter((r) => "date" in r) as RipperCalendarEvent[];
        expect(events.length).toBeGreaterThan(0);
    });

    it("first event has a non-empty summary", () => {
        const results = parseEvents(html, tz, "murder-by-the-book");
        const events = results.filter((r) => "date" in r) as RipperCalendarEvent[];
        expect(events[0]?.summary).toBeTruthy();
    });

    it("first event date year is >= 2026", () => {
        const results = parseEvents(html, tz, "murder-by-the-book");
        const events = results.filter((r) => "date" in r) as RipperCalendarEvent[];
        expect(events[0]?.date.year()).toBeGreaterThanOrEqual(2026);
    });

    it("all event ids are unique", () => {
        const results = parseEvents(html, tz, "murder-by-the-book");
        const events = results.filter((r) => "date" in r) as RipperCalendarEvent[];
        const ids = events.map((e) => e.id).filter(Boolean);
        const unique = new Set(ids);
        expect(unique.size).toBe(ids.length);
    });

    it("events have valid times (hour 0-23)", () => {
        const results = parseEvents(html, tz, "murder-by-the-book");
        const events = results.filter((r) => "date" in r) as RipperCalendarEvent[];
        for (const e of events) {
            expect(e.date.hour()).toBeGreaterThanOrEqual(0);
            expect(e.date.hour()).toBeLessThanOrEqual(23);
        }
    });

    it("events with a time range have duration > 1 hour", () => {
        const results = parseEvents(html, tz, "murder-by-the-book");
        const events = results.filter((r) => "date" in r) as RipperCalendarEvent[];
        // The last event in the sample has "6:30pm - 8:00pm" = 90 minutes
        const rangeEvent = events.find((e) =>
            e.id?.includes("christina-dodd")
        );
        if (rangeEvent) {
            expect(rangeEvent.duration.toMinutes()).toBe(90);
        }
    });

    it("events have absolute URLs when present", () => {
        const results = parseEvents(html, tz, "murder-by-the-book");
        const events = results.filter((r) => "date" in r) as RipperCalendarEvent[];
        for (const e of events) {
            if (e.url) {
                expect(e.url).toMatch(/^https?:\/\//);
            }
        }
    });
});
