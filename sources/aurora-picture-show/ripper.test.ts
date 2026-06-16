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
import AuroraPictureShowRipper from "./ripper.js";
import type { Ripper, RipperCalendarEvent } from "../../lib/config/schema.js";

describe("Aurora Picture Show Ripper", () => {
    let sampleHtml: string;
    let ripper: AuroraPictureShowRipper;

    beforeAll(() => {
        const testDir = dirname(new URL(import.meta.url).pathname);
        const samplePath = resolve(testDir, "./sample-data.html");
        sampleHtml = readFileSync(samplePath, "utf-8");
        ripper = new AuroraPictureShowRipper();
    });

    it("should have sample data available", () => {
        expect(sampleHtml).toBeTruthy();
        expect(sampleHtml).toContain("eventlist-event");
        expect(sampleHtml).toContain("Extremely Shorts Film Festival 2026");
    });

    it("should extract multiple events from the sample data", async () => {
        const mockRipper: Ripper = {
            config: {
                url: new URL("https://www.aurorapictureshow.org/programs"),
                name: "aurora-picture-show",
                calendars: [
                    {
                        name: "aurora-picture-show",
                        friendlyname: "Aurora Picture Show",
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
        expect(calendar.name).toBe("aurora-picture-show");

        // Should have 4 events in sample data
        const events = calendar.events as RipperCalendarEvent[];
        expect(events.length).toBeGreaterThanOrEqual(4);
    });

    it("should extract event titles correctly", async () => {
        const mockRipper: Ripper = {
            config: {
                url: new URL("https://www.aurorapictureshow.org/programs"),
                name: "aurora-picture-show",
                calendars: [
                    {
                        name: "aurora-picture-show",
                        friendlyname: "Aurora Picture Show",
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

        expect(events[0]!.summary).toBe("Extremely Shorts Film Festival 2026");
        expect(events[1]!.summary).toBe("The Films of Roy Fridge");
        expect(events[2]!.summary).toBe("2026 Summer Series");
        expect(events[3]!.summary).toBe("Artist Residency Showcase");
    });

    it("should extract event dates correctly", async () => {
        const mockRipper: Ripper = {
            config: {
                url: new URL("https://www.aurorapictureshow.org/programs"),
                name: "aurora-picture-show",
                calendars: [
                    {
                        name: "aurora-picture-show",
                        friendlyname: "Aurora Picture Show",
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

        const tz = ZoneId.of("America/Chicago");

        // First event: May 29-30, 2026, 8:00 PM - 10:00 PM
        expect(events[0]!.date.year()).toBe(2026);
        expect(events[0]!.date.monthValue()).toBe(5);
        expect(events[0]!.date.dayOfMonth()).toBe(29);
        expect(events[0]!.date.hour()).toBe(20); // 8 PM

        // Second event: May 16, 2026, 7:00 PM
        expect(events[1]!.date.year()).toBe(2026);
        expect(events[1]!.date.monthValue()).toBe(5);
        expect(events[1]!.date.dayOfMonth()).toBe(16);
        expect(events[1]!.date.hour()).toBe(19); // 7 PM

        // Third event: June 21, 2026, 6:00 PM
        expect(events[2]!.date.year()).toBe(2026);
        expect(events[2]!.date.monthValue()).toBe(6);
        expect(events[2]!.date.dayOfMonth()).toBe(21);
        expect(events[2]!.date.hour()).toBe(18); // 6 PM
    });

    it("should extract descriptions", async () => {
        const mockRipper: Ripper = {
            config: {
                url: new URL("https://www.aurorapictureshow.org/programs"),
                name: "aurora-picture-show",
                calendars: [
                    {
                        name: "aurora-picture-show",
                        friendlyname: "Aurora Picture Show",
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

        // First event should have description about short films
        expect(events[0]!.description).toContain("short films");

        // Second event should have description about Roy Fridge
        expect(events[1]!.description).toContain("retrospective");
    });

    it("should generate stable event IDs from title and date", async () => {
        const mockRipper: Ripper = {
            config: {
                url: new URL("https://www.aurorapictureshow.org/programs"),
                name: "aurora-picture-show",
                calendars: [
                    {
                        name: "aurora-picture-show",
                        friendlyname: "Aurora Picture Show",
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
        expect(events[0]!.id).toBe(
            "extremely-shorts-film-festival-2026-2026-05-29",
        );
        expect(events[1]!.id).toBe("the-films-of-roy-fridge-2026-05-16");
        expect(events[2]!.id).toBe("2026-summer-series-2026-06-21");
        expect(events[3]!.id).toBe(
            "artist-residency-showcase-2026-07-10",
        );
    });

    it("should extract location information", async () => {
        const mockRipper: Ripper = {
            config: {
                url: new URL("https://www.aurorapictureshow.org/programs"),
                name: "aurora-picture-show",
                calendars: [
                    {
                        name: "aurora-picture-show",
                        friendlyname: "Aurora Picture Show",
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

        // All events in sample have "Aurora Picture Show" as location,
        // which should fall back to the default address
        events.forEach((event) => {
            expect(event.location).toBeDefined();
        });
    });

    it("should handle multiday events with correct duration", async () => {
        const mockRipper: Ripper = {
            config: {
                url: new URL("https://www.aurorapictureshow.org/programs"),
                name: "aurora-picture-show",
                calendars: [
                    {
                        name: "aurora-picture-show",
                        friendlyname: "Aurora Picture Show",
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

        // First event (May 29-30) and fourth event (Jul 10-12) are multiday
        // They should have durations greater than the default 2 hours
        const multiday1 = events[0]!;
        const multiday2 = events[3]!;

        expect(multiday1.duration.toHours()).toBeGreaterThanOrEqual(24);
        expect(multiday2.duration.toHours()).toBeGreaterThanOrEqual(48);
    });

    it("should have all required event fields", async () => {
        const mockRipper: Ripper = {
            config: {
                url: new URL("https://www.aurorapictureshow.org/programs"),
                name: "aurora-picture-show",
                calendars: [
                    {
                        name: "aurora-picture-show",
                        friendlyname: "Aurora Picture Show",
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
        });
    });
});
