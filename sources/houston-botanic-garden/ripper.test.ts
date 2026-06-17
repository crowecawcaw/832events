import { describe, it, expect, beforeAll } from "vitest";
import {
    ZoneId,
} from "@js-joda/core";
import "@js-joda/timezone";
import HoustonBotanicGardenRipper from "./ripper.js";
import type { Ripper, RipperCalendarEvent } from "../../lib/config/schema.js";

describe("Houston Botanic Garden Ripper", () => {
    let ripper: HoustonBotanicGardenRipper;

    beforeAll(() => {
        ripper = new HoustonBotanicGardenRipper();
    });

    it("should handle API response with multiple events", async () => {
        const mockEvents = [
            {
                id: 5574,
                slug: "witness-series-radical-joy-5-years-counting",
                title: { rendered: "Witness Series &#8212; Radical Joy: 5 Years &amp; Counting" },
                excerpt: { rendered: "<p>Join artist Kristi Rangel and the Community Artists&#8217; Collective</p>" },
                link: "https://hbg.org/event/witness-series-radical-joy-5-years-counting/",
                date: "2026-06-15T10:57:42",
            },
            {
                id: 5436,
                slug: "lego-night-with-houston-toy-museum",
                title: { rendered: "LEGO® Night with Houston Toy Museum" },
                excerpt: { rendered: "<p>Build with LEGO bricks</p>" },
                link: "https://hbg.org/event/lego-night-with-houston-toy-museum/",
                date: "2026-05-21T10:31:54",
            },
        ];

        const mockRipper: Ripper = {
            config: {
                url: new URL("https://hbg.org/wp-json/wp/v2/event"),
                name: "houston-botanic-garden",
                calendars: [
                    {
                        name: "houston-botanic-garden",
                        friendlyname: "Houston Botanic Garden",
                        timezone: ZoneId.of("America/Chicago"),
                    },
                ],
                tags: ["Nature", "Parks", "Gardens", "Braeswood"],
            } as any,
        };

        // Mock fetch to return sample data
        let pageCount = 0;
        global.fetch = async (urlStr: string) => ({
            ok: true,
            json: async () => {
                pageCount++;
                // Return events only for first page, empty for others
                if (pageCount === 1) {
                    return mockEvents;
                }
                // Return empty array for subsequent pages to signal end of pagination
                return [];
            },
        }) as any;

        const calendars = await ripper.rip(mockRipper);
        expect(calendars).toHaveLength(1);

        const calendar = calendars[0]!;
        expect(calendar.name).toBe("houston-botanic-garden");
        expect(calendar.friendlyname).toBe("Houston Botanic Garden");

        // Should have 2 events from sample data
        const events = calendar.events as RipperCalendarEvent[];
        expect(events.length).toBe(2);
    });

    it("should extract event titles and decode HTML entities", async () => {
        const mockEvents = [
            {
                id: 5574,
                slug: "witness-series-radical-joy-5-years-counting",
                title: { rendered: "Witness Series &#8212; Radical Joy: 5 Years &amp; Counting" },
                excerpt: { rendered: "<p>Test description</p>" },
                link: "https://hbg.org/event/witness-series-radical-joy-5-years-counting/",
                date: "2026-06-15T10:57:42",
            },
        ];

        const mockRipper: Ripper = {
            config: {
                url: new URL("https://hbg.org/wp-json/wp/v2/event"),
                name: "houston-botanic-garden",
                calendars: [
                    {
                        name: "houston-botanic-garden",
                        friendlyname: "Houston Botanic Garden",
                        timezone: ZoneId.of("America/Chicago"),
                    },
                ],
                tags: ["Nature"],
            } as any,
        };

        global.fetch = async (url: string) => ({
            ok: true,
            json: async () => {
                if ((url as string).includes("page=1")) {
                    return mockEvents;
                }
                return [];
            },
        }) as any;

        const calendars = await ripper.rip(mockRipper);
        const events = calendars[0]!.events as RipperCalendarEvent[];

        // Title should be decoded
        expect(events[0]!.summary).toContain("Witness Series");
        expect(events[0]!.summary).toContain("Radical Joy");
    });

    it("should create stable IDs based on post slug", async () => {
        const mockEvents = [
            {
                id: 5574,
                slug: "test-event-slug",
                title: { rendered: "Test Event" },
                excerpt: { rendered: "<p>Description</p>" },
                link: "https://hbg.org/event/test-event-slug/",
                date: "2026-06-15T10:57:42",
            },
        ];

        const mockRipper: Ripper = {
            config: {
                url: new URL("https://hbg.org/wp-json/wp/v2/event"),
                name: "houston-botanic-garden",
                calendars: [
                    {
                        name: "houston-botanic-garden",
                        friendlyname: "Houston Botanic Garden",
                        timezone: ZoneId.of("America/Chicago"),
                    },
                ],
                tags: [],
            } as any,
        };

        global.fetch = async (url: string) => ({
            ok: true,
            json: async () => {
                if ((url as string).includes("page=1")) {
                    return mockEvents;
                }
                return [];
            },
        }) as any;

        const calendars = await ripper.rip(mockRipper);
        const events = calendars[0]!.events as RipperCalendarEvent[];

        // ID should match the slug
        expect(events[0]!.id).toBe("test-event-slug");
    });

    it("should set default venue address", async () => {
        const mockEvents = [
            {
                id: 5574,
                slug: "test-event",
                title: { rendered: "Test Event" },
                excerpt: { rendered: "<p>Description</p>" },
                link: "https://hbg.org/event/test-event/",
                date: "2026-06-15T10:57:42",
            },
        ];

        const mockRipper: Ripper = {
            config: {
                url: new URL("https://hbg.org/wp-json/wp/v2/event"),
                name: "houston-botanic-garden",
                calendars: [
                    {
                        name: "houston-botanic-garden",
                        friendlyname: "Houston Botanic Garden",
                        timezone: ZoneId.of("America/Chicago"),
                    },
                ],
                tags: [],
            } as any,
        };

        global.fetch = async (url: string) => ({
            ok: true,
            json: async () => {
                if ((url as string).includes("page=1")) {
                    return mockEvents;
                }
                return [];
            },
        }) as any;

        const calendars = await ripper.rip(mockRipper);
        const events = calendars[0]!.events as RipperCalendarEvent[];

        // Should have default venue
        expect(events[0]!.location).toContain("Houston Botanic Garden");
        expect(events[0]!.location).toContain("346 New York Ave");
    });

    it("should handle API errors gracefully", async () => {
        const mockRipper: Ripper = {
            config: {
                url: new URL("https://hbg.org/wp-json/wp/v2/event"),
                name: "houston-botanic-garden",
                calendars: [
                    {
                        name: "houston-botanic-garden",
                        friendlyname: "Houston Botanic Garden",
                        timezone: ZoneId.of("America/Chicago"),
                    },
                ],
                tags: [],
            } as any,
        };

        // Mock fetch to return error
        global.fetch = async () => ({
            ok: false,
            status: 500,
            statusText: "Internal Server Error",
        }) as any;

        const calendars = await ripper.rip(mockRipper);
        const calendar = calendars[0]!;

        // Should have no events but should have error
        expect(calendar.events.length).toBe(0);
        expect(calendar.errors.length).toBeGreaterThan(0);
    });

    it("should emit uncertainty errors for events", async () => {
        const mockEvents = [
            {
                id: 5574,
                slug: "test-event",
                title: { rendered: "Test Event" },
                excerpt: { rendered: "<p>Description</p>" },
                link: "https://hbg.org/event/test-event/",
                date: "2026-06-15T10:57:42",
            },
        ];

        const mockRipper: Ripper = {
            config: {
                url: new URL("https://hbg.org/wp-json/wp/v2/event"),
                name: "houston-botanic-garden",
                calendars: [
                    {
                        name: "houston-botanic-garden",
                        friendlyname: "Houston Botanic Garden",
                        timezone: ZoneId.of("America/Chicago"),
                    },
                ],
                tags: [],
            } as any,
        };

        let pageCount = 0;
        global.fetch = async (url: string) => ({
            ok: true,
            json: async () => {
                pageCount++;
                if (pageCount === 1) {
                    return mockEvents;
                }
                return [];
            },
        }) as any;

        const calendars = await ripper.rip(mockRipper);
        const calendar = calendars[0]!;

        // Should have uncertainty errors for date/duration
        const uncertaintyErrors = calendar.errors.filter(e => e.type === "UncertaintyError");
        expect(uncertaintyErrors.length).toBe(1);
    });
});
