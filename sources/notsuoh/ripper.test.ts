import { describe, it, expect, beforeAll } from "vitest";
import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import {
    LocalDate,
    LocalTime,
    ZoneId,
    ZonedDateTime,
} from "@js-joda/core";
import "@js-joda/timezone";
import NotsuohRipper from "./ripper.js";
import type { Ripper, RipperCalendarEvent } from "../../lib/config/schema.js";

describe("Notsuoh Ripper", () => {
    let sampleHtml: string;
    let ripper: NotsuohRipper;

    beforeAll(() => {
        const testDir = dirname(new URL(import.meta.url).pathname);
        const samplePath = resolve(testDir, "./sample-data.html");
        sampleHtml = readFileSync(samplePath, "utf-8");
        ripper = new NotsuohRipper();
    });

    it("should have sample data available", () => {
        expect(sampleHtml).toBeTruthy();
        expect(sampleHtml).toContain("event-card");
        expect(sampleHtml).toContain("Summer DJ Series");
    });

    it("should extract 8 events from the sample data", async () => {
        const mockRipper: Ripper = {
            config: {
                url: new URL("https://notsuoh.com/events"),
                name: "notsuoh",
                calendars: [
                    {
                        name: "notsuoh",
                        friendlyname: "Notsuoh",
                        timezone: ZoneId.of("America/Chicago"),
                    },
                ],
            } as any,
        };

        // Mock fetch to return sample data
        global.fetch = async () => ({
            ok: true,
            text: async () => sampleHtml,
        }) as any;

        const calendars = await ripper.rip(mockRipper);
        expect(calendars).toHaveLength(1);

        const calendar = calendars[0]!;
        expect(calendar.name).toBe("notsuoh");

        // Should have 8 events in sample data
        const events = calendar.events as RipperCalendarEvent[];
        expect(events).toHaveLength(8);
    });

    it("should extract event titles correctly", async () => {
        const mockRipper: Ripper = {
            config: {
                url: new URL("https://notsuoh.com/events"),
                name: "notsuoh",
                calendars: [
                    {
                        name: "notsuoh",
                        friendlyname: "Notsuoh",
                        timezone: ZoneId.of("America/Chicago"),
                    },
                ],
            } as any,
        };

        global.fetch = async () => ({
            ok: true,
            text: async () => sampleHtml,
        }) as any;

        const calendars = await ripper.rip(mockRipper);
        const events = calendars[0]!.events as RipperCalendarEvent[];

        expect(events[0]!.summary).toBe("Summer DJ Series");
        expect(events[1]!.summary).toBe("Live Band Night");
        expect(events[2]!.summary).toBe("Friday Night Throwback");
        expect(events[3]!.summary).toBe("Tech House Rave");
        expect(events[4]!.summary).toBe("Rooftop Sunset Sessions");
        expect(events[5]!.summary).toBe("Funk Fusion Night");
        expect(events[6]!.summary).toBe("Ladies Night Special");
        expect(events[7]!.summary).toBe("Indie Rock Showcase");
    });

    it("should extract event dates correctly", async () => {
        const mockRipper: Ripper = {
            config: {
                url: new URL("https://notsuoh.com/events"),
                name: "notsuoh",
                calendars: [
                    {
                        name: "notsuoh",
                        friendlyname: "Notsuoh",
                        timezone: ZoneId.of("America/Chicago"),
                    },
                ],
            } as any,
        };

        global.fetch = async () => ({
            ok: true,
            text: async () => sampleHtml,
        }) as any;

        const calendars = await ripper.rip(mockRipper);
        const events = calendars[0]!.events as RipperCalendarEvent[];

        // First event: Fri, Jun 14, 2026 8:00 PM
        expect(events[0]!.date.year()).toBe(2026);
        expect(events[0]!.date.monthValue()).toBe(6);
        expect(events[0]!.date.dayOfMonth()).toBe(14);
        expect(events[0]!.date.hour()).toBe(20); // 8 PM

        // Second event: Sat, Jun 21, 2026 9:00 PM
        expect(events[1]!.date.year()).toBe(2026);
        expect(events[1]!.date.monthValue()).toBe(6);
        expect(events[1]!.date.dayOfMonth()).toBe(21);
        expect(events[1]!.date.hour()).toBe(21); // 9 PM

        // Fourth event: Sat, Jul 05, 2026 11:00 PM
        expect(events[3]!.date.year()).toBe(2026);
        expect(events[3]!.date.monthValue()).toBe(7);
        expect(events[3]!.date.dayOfMonth()).toBe(5);
        expect(events[3]!.date.hour()).toBe(23); // 11 PM
    });

    it("should extract event descriptions", async () => {
        const mockRipper: Ripper = {
            config: {
                url: new URL("https://notsuoh.com/events"),
                name: "notsuoh",
                calendars: [
                    {
                        name: "notsuoh",
                        friendlyname: "Notsuoh",
                        timezone: ZoneId.of("America/Chicago"),
                    },
                ],
            } as any,
        };

        global.fetch = async () => ({
            ok: true,
            text: async () => sampleHtml,
        }) as any;

        const calendars = await ripper.rip(mockRipper);
        const events = calendars[0]!.events as RipperCalendarEvent[];

        // First event should have description about summer DJ
        expect(events[0]!.description).toContain("summer");
        expect(events[0]!.description).toContain("DJ");

        // Second event should have description about live band
        expect(events[1]!.description).toContain("live music");
        expect(events[1]!.description).toContain("band");
    });

    it("should generate stable event IDs from title and date", async () => {
        const mockRipper: Ripper = {
            config: {
                url: new URL("https://notsuoh.com/events"),
                name: "notsuoh",
                calendars: [
                    {
                        name: "notsuoh",
                        friendlyname: "Notsuoh",
                        timezone: ZoneId.of("America/Chicago"),
                    },
                ],
            } as any,
        };

        global.fetch = async () => ({
            ok: true,
            text: async () => sampleHtml,
        }) as any;

        const calendars = await ripper.rip(mockRipper);
        const events = calendars[0]!.events as RipperCalendarEvent[];

        // IDs should be deterministic combinations of title and date
        expect(events[0]!.id).toBe("summer-dj-series-2026-06-14");
        expect(events[1]!.id).toBe("live-band-night-2026-06-21");
        expect(events[2]!.id).toBe("friday-night-throwback-2026-06-28");
        expect(events[3]!.id).toBe("tech-house-rave-2026-07-05");
        expect(events[4]!.id).toBe("rooftop-sunset-sessions-2026-07-12");
        expect(events[5]!.id).toBe("funk-fusion-night-2026-07-19");
        expect(events[6]!.id).toBe("ladies-night-special-2026-07-26");
        expect(events[7]!.id).toBe("indie-rock-showcase-2026-08-02");
    });

    it("should extract location information", async () => {
        const mockRipper: Ripper = {
            config: {
                url: new URL("https://notsuoh.com/events"),
                name: "notsuoh",
                calendars: [
                    {
                        name: "notsuoh",
                        friendlyname: "Notsuoh",
                        timezone: ZoneId.of("America/Chicago"),
                    },
                ],
            } as any,
        };

        global.fetch = async () => ({
            ok: true,
            text: async () => sampleHtml,
        }) as any;

        const calendars = await ripper.rip(mockRipper);
        const events = calendars[0]!.events as RipperCalendarEvent[];

        // All events should have location defined
        events.forEach((event) => {
            expect(event.location).toBeDefined();
            expect(event.location).toContain("Houston");
        });
    });

    it("should calculate duration correctly for multi-day events", async () => {
        const mockRipper: Ripper = {
            config: {
                url: new URL("https://notsuoh.com/events"),
                name: "notsuoh",
                calendars: [
                    {
                        name: "notsuoh",
                        friendlyname: "Notsuoh",
                        timezone: ZoneId.of("America/Chicago"),
                    },
                ],
            } as any,
        };

        global.fetch = async () => ({
            ok: true,
            text: async () => sampleHtml,
        }) as any;

        const calendars = await ripper.rip(mockRipper);
        const events = calendars[0]!.events as RipperCalendarEvent[];

        // First event: Fri 8:00 PM to Sun 2:00 AM (multi-day)
        const multiday1 = events[0]!;
        expect(multiday1.duration.toHours()).toBeGreaterThan(24);

        // Single day event: Sat 9:00 PM to Sun 2:00 AM (but still crosses midnight)
        const singleNight = events[1]!;
        expect(singleNight.duration.toHours()).toBeGreaterThan(0);

        // Daytime event: Sun 6:00 PM to 10:00 PM (4 hours)
        const daytime = events[4]!;
        expect(daytime.duration.toHours()).toBe(4);
    });

    it("should extract event URLs", async () => {
        const mockRipper: Ripper = {
            config: {
                url: new URL("https://notsuoh.com/events"),
                name: "notsuoh",
                calendars: [
                    {
                        name: "notsuoh",
                        friendlyname: "Notsuoh",
                        timezone: ZoneId.of("America/Chicago"),
                    },
                ],
            } as any,
        };

        global.fetch = async () => ({
            ok: true,
            text: async () => sampleHtml,
        }) as any;

        const calendars = await ripper.rip(mockRipper);
        const events = calendars[0]!.events as RipperCalendarEvent[];

        // First event should have a URL
        expect(events[0]!.url).toBeDefined();
        expect(events[0]!.url).toContain("notsuoh.com");
        expect(events[0]!.url).toContain("/events/");
    });

    it("should have all required event fields", async () => {
        const mockRipper: Ripper = {
            config: {
                url: new URL("https://notsuoh.com/events"),
                name: "notsuoh",
                calendars: [
                    {
                        name: "notsuoh",
                        friendlyname: "Notsuoh",
                        timezone: ZoneId.of("America/Chicago"),
                    },
                ],
            } as any,
        };

        global.fetch = async () => ({
            ok: true,
            text: async () => sampleHtml,
        }) as any;

        const calendars = await ripper.rip(mockRipper);
        const events = calendars[0]!.events as RipperCalendarEvent[];

        // Every event should have all required fields
        events.forEach((event) => {
            expect(event.id).toBeDefined();
            expect(event.ripped).toBeDefined();
            expect(event.date).toBeDefined();
            expect(event.duration).toBeDefined();
            expect(event.summary).toBeDefined();
            expect(event.location).toBeDefined();
        });
    });

    it("should handle missing title gracefully", async () => {
        const badHtml = `
            <div class="event-card">
                <h2><a href="/event"></a></h2>
                <ul><li>Fri, Jun 14, 2026 8:00 PM – Sun, Jun 21, 2026 2:00 AM</li></ul>
                <p>Description</p>
            </div>
        `;

        const mockRipper: Ripper = {
            config: {
                url: new URL("https://notsuoh.com/events"),
                name: "notsuoh",
                calendars: [
                    {
                        name: "notsuoh",
                        friendlyname: "Notsuoh",
                        timezone: ZoneId.of("America/Chicago"),
                    },
                ],
            } as any,
        };

        global.fetch = async () => ({
            ok: true,
            text: async () => badHtml,
        }) as any;

        const calendars = await ripper.rip(mockRipper);
        const calendar = calendars[0]!;

        // Should have errors, no events
        expect(calendar.events).toHaveLength(0);
        expect(calendar.errors.length).toBeGreaterThan(0);
        expect(calendar.errors[0]!.reason).toContain("title");
    });

    it("should handle missing date/time gracefully", async () => {
        const badHtml = `
            <div class="event-card">
                <h2><a href="/event">Test Event</a></h2>
                <ul><li></li></ul>
                <p>Description</p>
            </div>
        `;

        const mockRipper: Ripper = {
            config: {
                url: new URL("https://notsuoh.com/events"),
                name: "notsuoh",
                calendars: [
                    {
                        name: "notsuoh",
                        friendlyname: "Notsuoh",
                        timezone: ZoneId.of("America/Chicago"),
                    },
                ],
            } as any,
        };

        global.fetch = async () => ({
            ok: true,
            text: async () => badHtml,
        }) as any;

        const calendars = await ripper.rip(mockRipper);
        const calendar = calendars[0]!;

        // Should have errors, no events
        expect(calendar.events).toHaveLength(0);
        expect(calendar.errors.length).toBeGreaterThan(0);
        expect(calendar.errors[0]!.reason).toContain("date");
    });

    it("should handle malformed date/time string gracefully", async () => {
        const badHtml = `
            <div class="event-card">
                <h2><a href="/event">Test Event</a></h2>
                <ul><li>Invalid date format here</li></ul>
                <p>Description</p>
            </div>
        `;

        const mockRipper: Ripper = {
            config: {
                url: new URL("https://notsuoh.com/events"),
                name: "notsuoh",
                calendars: [
                    {
                        name: "notsuoh",
                        friendlyname: "Notsuoh",
                        timezone: ZoneId.of("America/Chicago"),
                    },
                ],
            } as any,
        };

        global.fetch = async () => ({
            ok: true,
            text: async () => badHtml,
        }) as any;

        const calendars = await ripper.rip(mockRipper);
        const calendar = calendars[0]!;

        // Should have errors, no events
        expect(calendar.events).toHaveLength(0);
        expect(calendar.errors.length).toBeGreaterThan(0);
        expect(calendar.errors[0]!.reason).toContain("unparseable");
    });

    it("should never return null from parseEvent", async () => {
        const mockRipper: Ripper = {
            config: {
                url: new URL("https://notsuoh.com/events"),
                name: "notsuoh",
                calendars: [
                    {
                        name: "notsuoh",
                        friendlyname: "Notsuoh",
                        timezone: ZoneId.of("America/Chicago"),
                    },
                ],
            } as any,
        };

        global.fetch = async () => ({
            ok: true,
            text: async () => sampleHtml,
        }) as any;

        const calendars = await ripper.rip(mockRipper);
        const calendar = calendars[0]!;

        // Combined count of events and errors should equal total cards
        expect(calendar.events.length + calendar.errors.length).toBe(8);

        // Every result should be either an event or an error
        calendar.events.forEach((event) => {
            expect(event).toBeTruthy();
            expect(event.id).toBeTruthy();
        });

        calendar.errors.forEach((error) => {
            expect(error).toBeTruthy();
            expect(error.type).toBe("ParseError");
        });
    });
});
