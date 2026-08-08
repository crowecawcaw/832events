import { describe, it, expect, beforeEach } from "vitest";
import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import "@js-joda/timezone";
import { ZoneId, LocalDate } from "@js-joda/core";
import { parse } from "node-html-parser";
import Concerts50HoustonRipper from "./ripper.js";
import type { Ripper, RipperCalendarEvent } from "../../lib/config/schema.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

const sampleHtml = readFileSync(join(__dirname, "sample-data.html"), "utf-8");

describe("Concerts50 Houston ripper - HTML structure validation", () => {
    it("sample data contains slide elements", () => {
        expect(sampleHtml).toContain('class="slide"');
    });

    it("sample data contains event info sections", () => {
        expect(sampleHtml).toContain('class="info"');
        expect(sampleHtml).toContain('class="bottom_place"');
        expect(sampleHtml).toContain('class="top_place"');
    });

    it("sample data has multiple artist events", () => {
        expect(sampleHtml).toContain("<b>Afroman</b>");
        expect(sampleHtml).toContain("<b>Novulent</b>");
        expect(sampleHtml).toContain("<b>Arcángel</b>");
        expect(sampleHtml).toContain("<b>Don Omar</b>");
    });

    it("sample data has date/time information", () => {
        expect(sampleHtml).toContain("Aug 9 · Sun, 7:00 PM");
        expect(sampleHtml).toContain("Aug 8 · Sat, 6:00 PM");
        expect(sampleHtml).toContain("Oct 23 · Fri, 8:00 PM");
        expect(sampleHtml).toContain("Nov 5 · Thu, 8:00 PM");
    });

    it("sample data has venue information", () => {
        expect(sampleHtml).toContain("House of Blues Restaurant &amp; Bar - Houston, TX");
        expect(sampleHtml).toContain("White Oak Music Hall - Houston, TX");
        expect(sampleHtml).toContain("Toyota Center - Houston, TX");
        expect(sampleHtml).toContain("Warehouse Live - Houston, TX");
    });

    it("sample data has event URLs", () => {
        expect(sampleHtml).toContain("https://concerts50.com/show/afroman-in-houston-tickets-aug-09-2026");
        expect(sampleHtml).toContain("https://concerts50.com/show/don-omar-in-houston-tickets-oct-23-2026");
    });

    it("sample data has artist images", () => {
        expect(sampleHtml).toContain("https://concerts50.com/uploads/artist/");
        expect(sampleHtml).toContain(".jpg");
    });

    it("sample data has event links structure", () => {
        expect(sampleHtml).toContain('href="https://concerts50.com/show/');
        expect(sampleHtml).toContain('<li class="slide">');
    });

    it("sample data has various time formats", () => {
        // Test different time formats present in the page
        expect(sampleHtml).toMatch(/\d{1,2}:\d{2}\s*(AM|PM|am|pm)/);
    });
});

describe("Concerts50 Houston ripper - parsing and event extraction", () => {
    let ripper: Concerts50HoustonRipper;

    beforeEach(() => {
        ripper = new Concerts50HoustonRipper();
    });

    it("successfully parses sample HTML and extracts events", async () => {
        // Create a mock ripper config that returns sample HTML
        const mockRipper: Ripper = {
            config: {
                url: new URL("https://concerts50.com/upcoming-concerts-in-texas/houston"),
                calendars: [
                    {
                        name: "concerts50-houston",
                        friendlyname: "Concerts 50 Houston",
                        timezone: ZoneId.of("America/Chicago"),
                    },
                ],
                tags: [],
                description: "Concerts 50 Houston",
            } as any,
        } as any;

        // Mock the fetch function to return our sample HTML
        const originalFetch = (global.fetch as any);
        try {
            global.fetch = async () => ({
                ok: true,
                text: async () => sampleHtml,
            } as any);

            const calendars = await ripper.rip(mockRipper);

            expect(calendars).toHaveLength(1);
            const calendar = calendars[0];
            expect(calendar.events.length).toBeGreaterThan(0);
            expect(calendar.errors).toBeDefined();
        } finally {
            global.fetch = originalFetch;
        }
    });

    it("extracts event properties correctly from valid slides", async () => {
        const mockRipper: Ripper = {
            config: {
                url: new URL("https://concerts50.com/upcoming-concerts-in-texas/houston"),
                calendars: [
                    {
                        name: "concerts50-houston",
                        friendlyname: "Concerts 50 Houston",
                        timezone: ZoneId.of("America/Chicago"),
                    },
                ],
                tags: ["LiveMusic"],
                description: "Concerts 50 Houston",
            } as any,
        } as any;

        const originalFetch = (global.fetch as any);
        try {
            global.fetch = async () => ({
                ok: true,
                text: async () => sampleHtml,
            } as any);

            const calendars = await ripper.rip(mockRipper);
            const events = calendars[0].events;

            // Verify that extracted events have required properties
            if (events.length > 0) {
                const event = events[0];
                expect(event).toHaveProperty("id");
                expect(event).toHaveProperty("summary");
                expect(event).toHaveProperty("date");
                expect(event).toHaveProperty("location");
                expect(event).toHaveProperty("duration");
                expect(event.summary).toBeTruthy();
                expect(event.location).toBeTruthy();
            }
        } finally {
            global.fetch = originalFetch;
        }
    });

    it("handles HTML entity decoding in venue names", async () => {
        // Sample HTML with encoded entity
        const htmlWithEntity = `
            <li class="slide">
                <a href="https://example.com/show/test"></a>
                <div class="image"><img src="test.jpg"/></div>
                <div class="info">
                    <span class="bottom_place">
                        <b>Test Artist</b>
                        <p>Aug 15 · Fri, 7:00 PM</p>
                    </span>
                    <span class="top_place">
                        <p>House of Blues &amp; Bar - Houston, TX</p>
                    </span>
                </div>
            </li>
        `;

        const mockRipper: Ripper = {
            config: {
                url: new URL("https://concerts50.com/test"),
                calendars: [
                    {
                        name: "concerts50-houston",
                        friendlyname: "Concerts 50 Houston",
                        timezone: ZoneId.of("America/Chicago"),
                    },
                ],
                tags: [],
                description: "Concerts 50 Houston",
            } as any,
        } as any;

        const originalFetch = (global.fetch as any);
        try {
            global.fetch = async () => ({
                ok: true,
                text: async () => htmlWithEntity,
            } as any);

            const calendars = await ripper.rip(mockRipper);
            const events = calendars[0].events;

            // The venue name should be decoded (& instead of &amp;)
            if (events.length > 0) {
                expect(events[0].location).toContain("House of Blues & Bar");
            }
        } finally {
            global.fetch = originalFetch;
        }
    });

    it("reports errors for malformed slides missing required elements", async () => {
        // HTML with missing artist name
        const malformedHtml = `
            <li class="slide">
                <a href="https://example.com/show/test"></a>
                <div class="image"><img src="test.jpg"/></div>
                <div class="info">
                    <span class="bottom_place">
                        <p>Aug 15 · Fri, 7:00 PM</p>
                    </span>
                    <span class="top_place">
                        <p>Venue - Houston, TX</p>
                    </span>
                </div>
            </li>
        `;

        const mockRipper: Ripper = {
            config: {
                url: new URL("https://concerts50.com/test"),
                calendars: [
                    {
                        name: "concerts50-houston",
                        friendlyname: "Concerts 50 Houston",
                        timezone: ZoneId.of("America/Chicago"),
                    },
                ],
                tags: [],
                description: "Concerts 50 Houston",
            } as any,
        } as any;

        const originalFetch = (global.fetch as any);
        try {
            global.fetch = async () => ({
                ok: true,
                text: async () => malformedHtml,
            } as any);

            const calendars = await ripper.rip(mockRipper);
            expect(calendars[0].errors.length).toBeGreaterThan(0);
            expect(calendars[0].errors[0].reason).toContain("artist");
        } finally {
            global.fetch = originalFetch;
        }
    });

    it("handles HTTP errors gracefully", async () => {
        const mockRipper: Ripper = {
            config: {
                url: new URL("https://concerts50.com/test"),
                calendars: [
                    {
                        name: "concerts50-houston",
                        friendlyname: "Concerts 50 Houston",
                        timezone: ZoneId.of("America/Chicago"),
                    },
                ],
                tags: [],
                description: "Concerts 50 Houston",
            } as any,
        } as any;

        const originalFetch = (global.fetch as any);
        try {
            global.fetch = async () => ({
                ok: false,
                status: 404,
                statusText: "Not Found",
            } as any);

            await expect(ripper.rip(mockRipper)).rejects.toThrow("HTTP 404");
        } finally {
            global.fetch = originalFetch;
        }
    });
});
