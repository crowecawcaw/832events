import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { ZoneId } from "@js-joda/core";
import "@js-joda/timezone";
import { parseEvents } from "./ripper.js";
import type { RipperCalendarEvent } from "../../lib/config/schema.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

const sampleJson = readFileSync(join(__dirname, "sample-data.json"), "utf-8");
const tz = ZoneId.of("America/Chicago");

describe("Houston Grand Opera ripper", () => {
    it("parses >0 events from sample data", () => {
        const results = parseEvents(sampleJson, tz, "houston-grand-opera");
        const events = results.filter((r) => "date" in r) as RipperCalendarEvent[];
        expect(events.length).toBeGreaterThan(0);
    });

    it("parses events from both main season and additional productions", () => {
        const results = parseEvents(sampleJson, tz, "houston-grand-opera");
        const events = results.filter((r) => "date" in r) as RipperCalendarEvent[];
        // Main season has 6 operas, additional has 5 special events
        expect(events.length).toBeGreaterThanOrEqual(10);
    });

    it("first event has a valid summary (opera/production name)", () => {
        const results = parseEvents(sampleJson, tz, "houston-grand-opera");
        const events = results.filter((r) => "date" in r) as RipperCalendarEvent[];
        expect(events[0]?.summary).toBeTruthy();
        // Should be an actual production name, not a fallback
        expect(events[0]?.summary.length).toBeGreaterThan(2);
    });

    it("parses Susannah production correctly", () => {
        const results = parseEvents(sampleJson, tz, "houston-grand-opera");
        const events = results.filter((r) => "date" in r) as RipperCalendarEvent[];
        const susannah = events.find((e) => e.summary === "Susannah");
        expect(susannah).toBeDefined();
        expect(susannah?.date.year()).toBe(2026);
        expect(susannah?.date.monthValue()).toBe(10);
        expect(susannah?.date.dayOfMonth()).toBe(23);
    });

    it("all events have a start date in 2026 or 2027", () => {
        const results = parseEvents(sampleJson, tz, "houston-grand-opera");
        const events = results.filter((r) => "date" in r) as RipperCalendarEvent[];
        for (const e of events) {
            const year = e.date.year();
            expect(year).toBeGreaterThanOrEqual(2026);
            expect(year).toBeLessThanOrEqual(2027);
        }
    });

    it("all event ids are unique", () => {
        const results = parseEvents(sampleJson, tz, "houston-grand-opera");
        const events = results.filter((r) => "date" in r) as RipperCalendarEvent[];
        const ids = events.map((e) => e.id).filter(Boolean);
        const unique = new Set(ids);
        expect(unique.size).toBe(ids.length);
    });

    it("event IDs include the production name and date", () => {
        const results = parseEvents(sampleJson, tz, "houston-grand-opera");
        const events = results.filter((r) => "date" in r) as RipperCalendarEvent[];
        const susannah = events.find((e) => e.summary === "Susannah");
        expect(susannah?.id).toMatch(/susannah-2026-10-23/);
    });

    it("all events have location set to Wortham Theater Center", () => {
        const results = parseEvents(sampleJson, tz, "houston-grand-opera");
        const events = results.filter((r) => "date" in r) as RipperCalendarEvent[];
        for (const e of events) {
            expect(e.location).toContain("Wortham");
            expect(e.location).toContain("500 Main St");
        }
    });

    it("events have 3-hour duration (typical for opera)", () => {
        const results = parseEvents(sampleJson, tz, "houston-grand-opera");
        const events = results.filter((r) => "date" in r) as RipperCalendarEvent[];
        for (const e of events) {
            expect(e.duration.toHours()).toBe(3);
        }
    });

    it("events have 7 PM start time (default for performances)", () => {
        const results = parseEvents(sampleJson, tz, "houston-grand-opera");
        const events = results.filter((r) => "date" in r) as RipperCalendarEvent[];
        for (const e of events) {
            expect(e.date.hour()).toBe(19); // 7 PM
        }
    });

    it("production with composer info includes it in description", () => {
        const results = parseEvents(sampleJson, tz, "houston-grand-opera");
        const events = results.filter((r) => "date" in r) as RipperCalendarEvent[];
        const susannah = events.find((e) => e.summary === "Susannah");
        expect(susannah?.description).toContain("Floyd");
    });

    it("Show Boat includes both composer and librettist in description", () => {
        const results = parseEvents(sampleJson, tz, "houston-grand-opera");
        const events = results.filter((r) => "date" in r) as RipperCalendarEvent[];
        const showBoat = events.find((e) => e.summary === "Show Boat");
        expect(showBoat?.description).toContain("Kern");
        expect(showBoat?.description).toContain("Hammerstein II");
    });

    it("events without composer info have empty or undefined description", () => {
        const results = parseEvents(sampleJson, tz, "houston-grand-opera");
        const events = results.filter((r) => "date" in r) as RipperCalendarEvent[];
        const butlerShowcase = events.find((e) => e.summary === "The Butler Studio Showcase");
        expect(butlerShowcase?.description).toBeFalsy();
    });

    it("events have image URLs from coverImage", () => {
        const results = parseEvents(sampleJson, tz, "houston-grand-opera");
        const events = results.filter((r) => "date" in r) as RipperCalendarEvent[];
        const susannah = events.find((e) => e.summary === "Susannah");
        expect(susannah?.imageUrl).toBeTruthy();
        expect(susannah?.imageUrl).toContain("datocms-assets.com");
    });

    it("events have preview URLs to HGO website", () => {
        const results = parseEvents(sampleJson, tz, "houston-grand-opera");
        const events = results.filter((r) => "date" in r) as RipperCalendarEvent[];
        const susannah = events.find((e) => e.summary === "Susannah");
        expect(susannah?.url).toBeTruthy();
        expect(susannah?.url).toContain("houstongrandopera.org");
        expect(susannah?.url).toContain("on-stage");
    });

    it("handles events with null endDate (single-day events)", () => {
        const results = parseEvents(sampleJson, tz, "houston-grand-opera");
        const events = results.filter((r) => "date" in r) as RipperCalendarEvent[];
        const butlerShowcase = events.find((e) => e.summary === "The Butler Studio Showcase");
        // Should not throw and should produce a valid event
        expect(butlerShowcase).toBeDefined();
        expect(butlerShowcase?.date).toBeTruthy();
    });
});
