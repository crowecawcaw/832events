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
import LakeHoustonBreweryRipper from "./ripper.js";
import type { Ripper, RipperCalendarEvent } from "../../lib/config/schema.js";

describe("Lake Houston Brewery Ripper", () => {
    let sampleHtml: string;
    let ripper: LakeHoustonBreweryRipper;

    beforeAll(() => {
        const testDir = dirname(new URL(import.meta.url).pathname);
        const samplePath = resolve(testDir, "./sample-data.html");
        sampleHtml = readFileSync(samplePath, "utf-8");
        ripper = new LakeHoustonBreweryRipper();
    });

    it("should have sample data available", () => {
        expect(sampleHtml).toBeTruthy();
        expect(sampleHtml).toContain("data-hook");
        expect(sampleHtml).toContain("Sunday Brunch");
    });

    it("should extract multiple events from the sample data", async () => {
        const mockRipper: Ripper = {
            config: {
                url: new URL("https://www.lakehoustonbrew.com/events"),
                name: "lake-houston-brewery",
                calendars: [
                    {
                        name: "lake-houston-brewery",
                        friendlyname: "Lake Houston Brewery",
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
        expect(calendar.name).toBe("lake-houston-brewery");

        // Should have at least 17 events in sample data
        const events = calendar.events as RipperCalendarEvent[];
        expect(events.length).toBeGreaterThanOrEqual(17);
    });

    it("should extract event titles correctly", async () => {
        const mockRipper: Ripper = {
            config: {
                url: new URL("https://www.lakehoustonbrew.com/events"),
                name: "lake-houston-brewery",
                calendars: [
                    {
                        name: "lake-houston-brewery",
                        friendlyname: "Lake Houston Brewery",
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

        // All events in the sample data should be "Sunday Brunch!"
        events.forEach((event) => {
            expect(event.summary).toContain("Sunday Brunch");
        });
    });

    it("should extract event dates correctly", async () => {
        const mockRipper: Ripper = {
            config: {
                url: new URL("https://www.lakehoustonbrew.com/events"),
                name: "lake-houston-brewery",
                calendars: [
                    {
                        name: "lake-houston-brewery",
                        friendlyname: "Lake Houston Brewery",
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

        // All events should be in 2026 with proper time format (11:00 AM = hour 11)
        events.forEach((event) => {
            expect(event.date.year()).toBe(2026);
            expect(event.date.hour()).toBe(11);
            expect(event.date.minute()).toBe(0);
        });

        // Should have events from June through October
        const months = new Set(events.map(e => e.date.monthValue()));
        expect(months.has(6)).toBe(true); // June
        expect(months.has(7)).toBe(true); // July
        expect(months.has(8)).toBe(true); // August
    });

    it("should extract descriptions correctly", async () => {
        const mockRipper: Ripper = {
            config: {
                url: new URL("https://www.lakehoustonbrew.com/events"),
                name: "lake-houston-brewery",
                calendars: [
                    {
                        name: "lake-houston-brewery",
                        friendlyname: "Lake Houston Brewery",
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

        // Events should have description about food/drinks
        events.forEach((event) => {
            expect(event.description).toContain("Espresso Martini");
        });
    });

    it("should generate stable event IDs from title and date", async () => {
        const mockRipper: Ripper = {
            config: {
                url: new URL("https://www.lakehoustonbrew.com/events"),
                name: "lake-houston-brewery",
                calendars: [
                    {
                        name: "lake-houston-brewery",
                        friendlyname: "Lake Houston Brewery",
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

        // IDs should be deterministic: "sunday-brunch-2026-06-21"
        const firstEventId = events[0]!.id;
        expect(firstEventId).toMatch(/^sunday-brunch-\d{4}-\d{2}-\d{2}$/);
    });

    it("should extract location information", async () => {
        const mockRipper: Ripper = {
            config: {
                url: new URL("https://www.lakehoustonbrew.com/events"),
                name: "lake-houston-brewery",
                calendars: [
                    {
                        name: "lake-houston-brewery",
                        friendlyname: "Lake Houston Brewery",
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

        // All events should have venue address
        events.forEach((event) => {
            expect(event.location).toContain("10614 FM 1960 W");
        });
    });

    it("should calculate event durations correctly (11:00 AM – 6:00 PM = 7 hours)", async () => {
        const mockRipper: Ripper = {
            config: {
                url: new URL("https://www.lakehoustonbrew.com/events"),
                name: "lake-houston-brewery",
                calendars: [
                    {
                        name: "lake-houston-brewery",
                        friendlyname: "Lake Houston Brewery",
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

        // All brunch events are 11:00 AM – 6:00 PM (7 hours)
        events.forEach((event) => {
            expect(event.duration.toHours()).toBe(7);
        });
    });

    it("should have all required event fields", async () => {
        const mockRipper: Ripper = {
            config: {
                url: new URL("https://www.lakehoustonbrew.com/events"),
                name: "lake-houston-brewery",
                calendars: [
                    {
                        name: "lake-houston-brewery",
                        friendlyname: "Lake Houston Brewery",
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

    it("should extract event URLs", async () => {
        const mockRipper: Ripper = {
            config: {
                url: new URL("https://www.lakehoustonbrew.com/events"),
                name: "lake-houston-brewery",
                calendars: [
                    {
                        name: "lake-houston-brewery",
                        friendlyname: "Lake Houston Brewery",
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

        // Events should have URLs
        events.forEach((event) => {
            expect(event.url).toBeDefined();
            expect(event.url).toContain("lakehoustonbrew.com");
        });
    });

    it("should handle HTTP errors gracefully", async () => {
        const mockRipper: Ripper = {
            config: {
                url: new URL("https://www.lakehoustonbrew.com/events"),
                name: "lake-houston-brewery",
                calendars: [
                    {
                        name: "lake-houston-brewery",
                        friendlyname: "Lake Houston Brewery",
                        timezone: ZoneId.of("America/Chicago"),
                    },
                ],
            } as any,
        };

        // Mock fetch to return HTTP 404
        global.fetch = async () => ({
            ok: false,
            status: 404,
            statusText: "Not Found",
        }) as any;

        try {
            await ripper.rip(mockRipper);
            expect.fail("Should have thrown an error");
        } catch (err) {
            expect(err).toBeInstanceOf(Error);
            expect((err as Error).message).toContain("HTTP 404");
        }
    });

    it("should report parsing errors in error array", async () => {
        const mockRipper: Ripper = {
            config: {
                url: new URL("https://www.lakehoustonbrew.com/events"),
                name: "lake-houston-brewery",
                calendars: [
                    {
                        name: "lake-houston-brewery",
                        friendlyname: "Lake Houston Brewery",
                        timezone: ZoneId.of("America/Chicago"),
                    },
                ],
            } as any,
        };

        // Mock fetch with malformed event data
        const malformedHtml = `
            <div data-hook="side-by-side-item">
                <a data-hook="title"></a>
                <div data-hook="date"></div>
            </div>
        `;

        global.fetch = async () => ({
            ok: true,
            text: async () => malformedHtml,
        }) as any;

        const calendars = await ripper.rip(mockRipper);
        const calendar = calendars[0]!;

        // Should have errors for missing title/date
        expect(calendar.errors.length).toBeGreaterThan(0);
    });
});
