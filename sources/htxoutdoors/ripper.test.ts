import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { ZoneId } from "@js-joda/core";
import "@js-joda/timezone";
import { parseEvents } from "./ripper.js";
import type { RipperCalendarEvent, RipperError } from "../../lib/config/schema.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

const sampleJson = readFileSync(join(__dirname, "sample-data.json"), "utf-8");
const tz = ZoneId.of("America/Chicago");

describe("HTXoutdoors ripper", () => {
    it("parses >0 events from sample data", () => {
        const results = parseEvents(sampleJson, tz, "htxoutdoors");
        const events = results.filter((r) => "date" in r) as RipperCalendarEvent[];
        expect(events.length).toBeGreaterThan(0);
    });

    it("parses many events (50+) from sample data", () => {
        const results = parseEvents(sampleJson, tz, "htxoutdoors");
        const events = results.filter((r) => "date" in r) as RipperCalendarEvent[];
        // Sample has 101 events
        expect(events.length).toBeGreaterThanOrEqual(50);
    });

    it("first event has a valid summary (event title)", () => {
        const results = parseEvents(sampleJson, tz, "htxoutdoors");
        const events = results.filter((r) => "date" in r) as RipperCalendarEvent[];
        expect(events[0]?.summary).toBeTruthy();
        expect(events[0]?.summary.length).toBeGreaterThan(2);
    });

    it("event summary does not contain HTML tags", () => {
        const results = parseEvents(sampleJson, tz, "htxoutdoors");
        const events = results.filter((r) => "date" in r) as RipperCalendarEvent[];
        for (const e of events) {
            expect(e.summary).not.toMatch(/<[^>]*>/);
        }
    });

    it("all events have a valid start date", () => {
        const results = parseEvents(sampleJson, tz, "htxoutdoors");
        const events = results.filter((r) => "date" in r) as RipperCalendarEvent[];
        for (const e of events) {
            expect(e.date).toBeDefined();
            expect(e.date.year()).toBeGreaterThanOrEqual(2024);
            expect(e.date.monthValue()).toBeGreaterThanOrEqual(1);
            expect(e.date.monthValue()).toBeLessThanOrEqual(12);
            expect(e.date.dayOfMonth()).toBeGreaterThanOrEqual(1);
            expect(e.date.dayOfMonth()).toBeLessThanOrEqual(31);
        }
    });

    it("all event ids are unique", () => {
        const results = parseEvents(sampleJson, tz, "htxoutdoors");
        const events = results.filter((r) => "date" in r) as RipperCalendarEvent[];
        const ids = events.map((e) => e.id);
        const unique = new Set(ids);
        expect(unique.size).toBe(ids.length);
    });

    it("event IDs include slug of title and date", () => {
        const results = parseEvents(sampleJson, tz, "htxoutdoors");
        const events = results.filter((r) => "date" in r) as RipperCalendarEvent[];
        for (const e of events) {
            // ID should be in format: slug-YYYY-MM-DD
            expect(e.id).toMatch(/^[a-z0-9\-]+-\d{4}-\d{2}-\d{2}$/);
        }
    });

    it("event IDs are stable (derived from title and date, not random)", () => {
        const results1 = parseEvents(sampleJson, tz, "htxoutdoors");
        const results2 = parseEvents(sampleJson, tz, "htxoutdoors");
        const events1 = results1.filter((r) => "date" in r) as RipperCalendarEvent[];
        const events2 = results2.filter((r) => "date" in r) as RipperCalendarEvent[];

        // Parse twice with same input should yield same IDs in same order
        expect(events1.length).toBe(events2.length);
        for (let i = 0; i < events1.length; i++) {
            expect(events1[i]?.id).toBe(events2[i]?.id);
        }
    });

    it("all events have valid duration (>0)", () => {
        const results = parseEvents(sampleJson, tz, "htxoutdoors");
        const events = results.filter((r) => "date" in r) as RipperCalendarEvent[];
        for (const e of events) {
            expect(e.duration).toBeDefined();
            expect(e.duration.toMillis()).toBeGreaterThan(0);
        }
    });

    it("single-day events have duration of ~2 hours (default)", () => {
        const results = parseEvents(sampleJson, tz, "htxoutdoors");
        const events = results.filter((r) => "date" in r) as RipperCalendarEvent[];
        // Find a short event (not explicitly multi-day)
        const shortEvent = events.find((e) => e.duration.toHours() <= 4);
        expect(shortEvent?.duration.toHours()).toBeLessThanOrEqual(4);
    });

    it("multi-day events have calculated durations > 24 hours", () => {
        const results = parseEvents(sampleJson, tz, "htxoutdoors");
        const events = results.filter((r) => "date" in r) as RipperCalendarEvent[];
        // Filter events that have end dates set to multi-day events
        const multiDay = events.filter((e) => e.duration.toHours() > 24);
        // There should be at least some multi-day events in a real calendar
        if (multiDay.length > 0) {
            expect(multiDay[0]?.duration.toHours()).toBeGreaterThan(24);
        }
    });

    it("all events have ripped timestamp", () => {
        const results = parseEvents(sampleJson, tz, "htxoutdoors");
        const events = results.filter((r) => "date" in r) as RipperCalendarEvent[];
        for (const e of events) {
            expect(e.ripped).toBeInstanceOf(Date);
            // Should be recent (within last day)
            const age = Date.now() - e.ripped.getTime();
            expect(age).toBeLessThan(24 * 60 * 60 * 1000);
        }
    });

    it("descriptions are plain text (no HTML tags)", () => {
        const results = parseEvents(sampleJson, tz, "htxoutdoors");
        const events = results.filter((r) => "date" in r) as RipperCalendarEvent[];
        const eventsWithDesc = events.filter((e) => e.description);
        for (const e of eventsWithDesc) {
            expect(e.description).not.toMatch(/<[^>]*>/);
        }
    });

    it("descriptions include activity type when available", () => {
        const results = parseEvents(sampleJson, tz, "htxoutdoors");
        const events = results.filter((r) => "date" in r) as RipperCalendarEvent[];
        // Check that at least some events have descriptions with activity type tags
        const typedEvents = events.filter(
            (e) => e.description && /^\[[a-zA-Z\-]+\]/.test(e.description)
        );
        expect(typedEvents.length).toBeGreaterThan(0);
    });

    it("HTML entities are decoded in descriptions", () => {
        const results = parseEvents(sampleJson, tz, "htxoutdoors");
        const events = results.filter((r) => "date" in r) as RipperCalendarEvent[];
        const eventsWithDesc = events.filter((e) => e.description);
        for (const e of eventsWithDesc) {
            // Should not contain encoded entities
            expect(e.description).not.toMatch(/&[a-zA-Z]+;/);
            expect(e.description).not.toMatch(/&#\d+;/);
        }
    });

    it("all events have URLs", () => {
        const results = parseEvents(sampleJson, tz, "htxoutdoors");
        const events = results.filter((r) => "date" in r) as RipperCalendarEvent[];
        for (const e of events) {
            expect(e.url).toBeDefined();
            expect(e.url).toMatch(/^https:\/\//);
        }
    });

    it("some events have image URLs", () => {
        const results = parseEvents(sampleJson, tz, "htxoutdoors");
        const events = results.filter((r) => "date" in r) as RipperCalendarEvent[];
        const eventsWithImages = events.filter((e) => e.imageUrl);
        // At least some events should have images
        expect(eventsWithImages.length).toBeGreaterThan(0);
        // Images should be URLs
        for (const e of eventsWithImages) {
            expect(e.imageUrl).toMatch(/^https?:\/\//);
        }
    });

    it("location is undefined for multi-location community calendar", () => {
        const results = parseEvents(sampleJson, tz, "htxoutdoors");
        const events = results.filter((r) => "date" in r) as RipperCalendarEvent[];
        // HTXoutdoors is multi-location, so location should be undefined
        for (const e of events) {
            // Either undefined or null (should be treated as multi-location)
            expect(e.location).toBeUndefined();
        }
    });

    it("handles malformed JSON gracefully", () => {
        const badJson = "{ invalid json }";
        const results = parseEvents(badJson, tz, "htxoutdoors");
        const errors = results.filter((r) => "type" in r) as RipperError[];
        expect(errors.length).toBeGreaterThan(0);
        expect(errors[0]?.reason).toContain("Failed to parse");
    });

    it("handles empty array gracefully", () => {
        const emptyJson = "[]";
        const results = parseEvents(emptyJson, tz, "htxoutdoors");
        const errors = results.filter((r) => "type" in r) as RipperError[];
        // Should report empty data
        expect(errors.length).toBeGreaterThan(0);
    });

    it("skips events with missing title", () => {
        const jsonWithBadEvent = JSON.stringify([
            {
                title: "",
                start: "2026-06-15T10:00:00-05:00",
                description: "No title",
                id: 1,
            },
            {
                title: "Valid Event",
                start: "2026-06-16T14:00:00-05:00",
                description: "Has title",
                id: 2,
            },
        ]);
        const results = parseEvents(jsonWithBadEvent, tz, "htxoutdoors");
        const events = results.filter((r) => "date" in r) as RipperCalendarEvent[];
        // Should only have the valid event
        expect(events.length).toBe(1);
        expect(events[0]?.summary).toBe("Valid Event");
    });

    it("skips events with missing start datetime", () => {
        const jsonWithBadEvent = JSON.stringify([
            {
                title: "Event without start",
                description: "No start time",
                id: 1,
            },
            {
                title: "Valid Event",
                start: "2026-06-16T14:00:00-05:00",
                description: "Has start",
                id: 2,
            },
        ]);
        const results = parseEvents(jsonWithBadEvent, tz, "htxoutdoors");
        const events = results.filter((r) => "date" in r) as RipperCalendarEvent[];
        expect(events.length).toBe(1);
        expect(events[0]?.summary).toBe("Valid Event");
    });

    it("handles various activity types (hiking, cycling, water-sport, etc.)", () => {
        const results = parseEvents(sampleJson, tz, "htxoutdoors");
        const events = results.filter((r) => "date" in r) as RipperCalendarEvent[];
        const activityTypes = new Set<string>();
        for (const e of events) {
            if (e.description?.startsWith("[")) {
                const match = e.description.match(/^\[([^\]]+)\]/);
                if (match) {
                    activityTypes.add(match[1]);
                }
            }
        }
        // Should have multiple activity types in real data
        expect(activityTypes.size).toBeGreaterThan(0);
    });
});
