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

describe("Warehouse Live ripper", () => {
    it("parses >0 events from sample data", () => {
        const results = parseEvents(html, tz, "warehouse-live");
        const events = results.filter((r) => "date" in r) as RipperCalendarEvent[];
        expect(events.length).toBeGreaterThan(0);
    });

    it("parses at least 5 events from sample data", () => {
        const results = parseEvents(html, tz, "warehouse-live");
        const events = results.filter((r) => "date" in r) as RipperCalendarEvent[];
        expect(events.length).toBeGreaterThanOrEqual(5);
    });

    it("first event has a non-empty summary", () => {
        const results = parseEvents(html, tz, "warehouse-live");
        const events = results.filter((r) => "date" in r) as RipperCalendarEvent[];
        expect(events[0]?.summary).toBeTruthy();
    });

    it("first event has DRAKE NIGHT as summary", () => {
        const results = parseEvents(html, tz, "warehouse-live");
        const events = results.filter((r) => "date" in r) as RipperCalendarEvent[];
        expect(events[0]?.summary).toContain("DRAKE");
    });

    it("first event date year is 2026", () => {
        const results = parseEvents(html, tz, "warehouse-live");
        const events = results.filter((r) => "date" in r) as RipperCalendarEvent[];
        expect(events[0]?.date.year()).toBe(2026);
    });

    it("all event ids are unique", () => {
        const results = parseEvents(html, tz, "warehouse-live");
        const events = results.filter((r) => "date" in r) as RipperCalendarEvent[];
        const ids = events.map((e) => e.id).filter(Boolean);
        const unique = new Set(ids);
        expect(unique.size).toBe(ids.length);
    });

    it("events have valid times (hour 0-23)", () => {
        const results = parseEvents(html, tz, "warehouse-live");
        const events = results.filter((r) => "date" in r) as RipperCalendarEvent[];
        for (const e of events) {
            expect(e.date.hour()).toBeGreaterThanOrEqual(0);
            expect(e.date.hour()).toBeLessThanOrEqual(23);
        }
    });

    it("events have image URLs", () => {
        const results = parseEvents(html, tz, "warehouse-live");
        const events = results.filter((r) => "date" in r) as RipperCalendarEvent[];
        for (const e of events) {
            expect(e.imageUrl).toBeTruthy();
            expect(e.imageUrl).toMatch(/^https?:\/\//);
        }
    });

    it("events have descriptions", () => {
        const results = parseEvents(html, tz, "warehouse-live");
        const events = results.filter((r) => "date" in r) as RipperCalendarEvent[];
        for (const e of events) {
            expect(e.description).toBeTruthy();
        }
    });

    it("events have absolute URLs", () => {
        const results = parseEvents(html, tz, "warehouse-live");
        const events = results.filter((r) => "date" in r) as RipperCalendarEvent[];
        for (const e of events) {
            expect(e.url).toBeTruthy();
            expect(e.url).toMatch(/^https?:\/\//);
        }
    });

    it("Drake Night event is on July 24", () => {
        const results = parseEvents(html, tz, "warehouse-live");
        const events = results.filter((r) => "date" in r) as RipperCalendarEvent[];
        const drake = events.find((e) => e.summary?.includes("DRAKE"));
        expect(drake).toBeDefined();
        if (drake) {
            expect(drake.date.monthValue()).toBe(7);
            expect(drake.date.dayOfMonth()).toBe(24);
        }
    });

    it("events have 2-hour duration by default", () => {
        const results = parseEvents(html, tz, "warehouse-live");
        const events = results.filter((r) => "date" in r) as RipperCalendarEvent[];
        for (const e of events) {
            expect(e.duration.toHours()).toBe(2);
        }
    });
});
