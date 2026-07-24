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

describe("Notsuoh ripper", () => {
    it("parses >0 events from sample data", () => {
        const results = parseEvents(html, tz, "notsuoh");
        const events = results.filter((r) => "date" in r) as RipperCalendarEvent[];
        expect(events.length).toBeGreaterThan(0);
    });

    it("parses at least 8 events from sample data", () => {
        const results = parseEvents(html, tz, "notsuoh");
        const events = results.filter((r) => "date" in r) as RipperCalendarEvent[];
        expect(events.length).toBeGreaterThanOrEqual(8);
    });

    it("first event has a non-empty summary", () => {
        const results = parseEvents(html, tz, "notsuoh");
        const events = results.filter((r) => "date" in r) as RipperCalendarEvent[];
        expect(events[0]?.summary).toBeTruthy();
    });

    it("first event date year is >= 2026", () => {
        const results = parseEvents(html, tz, "notsuoh");
        const events = results.filter((r) => "date" in r) as RipperCalendarEvent[];
        expect(events[0]?.date.year()).toBeGreaterThanOrEqual(2026);
    });

    it("all event ids are unique", () => {
        const results = parseEvents(html, tz, "notsuoh");
        const events = results.filter((r) => "date" in r) as RipperCalendarEvent[];
        const ids = events.map((e) => e.id).filter(Boolean);
        const unique = new Set(ids);
        expect(unique.size).toBe(ids.length);
    });

    it("events have valid times (hour 0-23)", () => {
        const results = parseEvents(html, tz, "notsuoh");
        const events = results.filter((r) => "date" in r) as RipperCalendarEvent[];
        for (const e of events) {
            expect(e.date.hour()).toBeGreaterThanOrEqual(0);
            expect(e.date.hour()).toBeLessThanOrEqual(23);
        }
    });

    it("multiday event has duration > 1 day", () => {
        const results = parseEvents(html, tz, "notsuoh");
        const events = results.filter((r) => "date" in r) as RipperCalendarEvent[];
        // The karaoke event should span from Jun 14 to Dec 27 (multiday)
        const multiday = events.find((e) =>
            e.summary?.includes("Karaoke")
        );
        if (multiday) {
            expect(multiday.duration.toDays()).toBeGreaterThan(1);
        }
    });

    it("single event with time range has duration >= 2 hours", () => {
        const results = parseEvents(html, tz, "notsuoh");
        const events = results.filter((r) => "date" in r) as RipperCalendarEvent[];
        // Latin Night should be 7pm - 11pm = 4 hours
        const latinNight = events.find((e) =>
            e.summary?.includes("Latin Night")
        );
        if (latinNight) {
            expect(latinNight.duration.toHours()).toBeGreaterThanOrEqual(2);
        }
    });

    it("events have image URLs when present", () => {
        const results = parseEvents(html, tz, "notsuoh");
        const events = results.filter((r) => "date" in r) as RipperCalendarEvent[];
        const withImages = events.filter((e) => e.imageUrl);
        expect(withImages.length).toBeGreaterThan(0);
        for (const e of withImages) {
            expect(e.imageUrl).toMatch(/^https?:\/\//);
        }
    });

    it("events have descriptions when present", () => {
        const results = parseEvents(html, tz, "notsuoh");
        const events = results.filter((r) => "date" in r) as RipperCalendarEvent[];
        const withDescriptions = events.filter((e) => e.description);
        expect(withDescriptions.length).toBeGreaterThan(0);
    });

    it("events have absolute URLs", () => {
        const results = parseEvents(html, tz, "notsuoh");
        const events = results.filter((r) => "date" in r) as RipperCalendarEvent[];
        for (const e of events) {
            if (e.url) {
                expect(e.url).toMatch(/^https?:\/\//);
            }
        }
    });
});
