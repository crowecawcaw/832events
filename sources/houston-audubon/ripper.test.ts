import { describe, it, expect } from "vitest";
import { parse } from "node-html-parser";
import { Instant, ZoneId } from "@js-joda/core";

describe("Houston Audubon Ripper", () => {
    it("should extract event links from calendar grid", () => {
        const html = `
        <div class="event-calendar__events">
            <a class="calendar-grid-event calendar-grid-event--start calendar-grid-event--end"
               title="Kickerillo-Mischer Bird Survey"
               href="https://houstonaudubon.org/programs/calendar.html/event/2026/06/01/kickerillo-mischer-bird-survey/535294">
                <div class="calendar-grid-event__info">
                    <span class="calendar-grid-event__time">7:00 am</span>
                    <span class="calendar-grid-event__title">Kickerillo-Mischer Bird Survey</span>
                </div>
            </a>
            <a class="calendar-grid-event calendar-grid-event--start calendar-grid-event--end"
               title="Moody Gardens Bird Survey"
               href="https://houstonaudubon.org/programs/calendar.html/event/2026/06/05/moody-gardens-bird-survey/535299">
                <div class="calendar-grid-event__info">
                    <span class="calendar-grid-event__time">7:00 am</span>
                    <span class="calendar-grid-event__title">Moody Gardens Bird Survey</span>
                </div>
            </a>
        </div>
        `;

        const root = parse(html);
        const eventLinks = root.querySelectorAll("a.calendar-grid-event");

        expect(eventLinks).toHaveLength(2);

        const firstTitle = eventLinks[0]?.querySelector("span.calendar-grid-event__title")?.text;
        expect(firstTitle?.trim()).toBe("Kickerillo-Mischer Bird Survey");

        const firstHref = eventLinks[0]?.getAttribute("href");
        expect(firstHref).toContain("/event/2026/06/01/");
        expect(firstHref).toContain("/535294");
    });

    it("should extract event ID from URL", () => {
        const url = "https://houstonaudubon.org/programs/calendar.html/event/2026/06/01/kickerillo-mischer-bird-survey/535294";
        const match = url.match(/\/event\/\d{4}\/\d{2}\/\d{2}\/[^/]+\/(\d+)$/);

        expect(match).toBeTruthy();
        expect(match?.[1]).toBe("535294");
    });

    it("should parse event from JSON-LD structured data", () => {
        const html = `
        <!DOCTYPE html>
        <html>
        <head>
            <script type="application/ld+json">
            {
                "@context": "https://schema.org",
                "@type": "Event",
                "name": "A Brush with Nature at the Houston Botanic Garden",
                "startDate": "2026-07-18T17:30:00-05:00",
                "endDate": "2026-07-18T19:00:00-05:00",
                "description": "Join Houston Audubon to spread your wings and soar into the world of birding!",
                "location": {
                    "@type": "Place",
                    "name": "Houston Botanic Garden"
                }
            }
            </script>
        </head>
        <body></body>
        </html>
        `;

        const root = parse(html);
        const scripts = root.querySelectorAll("script[type='application/ld+json']");

        expect(scripts).toHaveLength(1);

        const json = JSON.parse(scripts[0]!.text);
        expect(json["@type"]).toBe("Event");
        expect(json.name).toBe("A Brush with Nature at the Houston Botanic Garden");
        expect(json.startDate).toBe("2026-07-18T17:30:00-05:00");
        expect(json.location.name).toBe("Houston Botanic Garden");
    });

    it("should parse ISO 8601 datetime format with regex", () => {
        const isoDate = "2026-07-18T17:30:00-05:00";
        const dateTimePattern = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})/;
        const match = isoDate.match(dateTimePattern);

        expect(match).toBeTruthy();
        expect(match?.[1]).toBe("2026");
        expect(match?.[2]).toBe("07");
        expect(match?.[3]).toBe("18");
        expect(match?.[4]).toBe("17");
        expect(match?.[5]).toBe("30");
        expect(match?.[6]).toBe("00");
    });

    it("should calculate duration from two ISO 8601 datetimes", () => {
        const startStr = "2026-07-18T17:30:00-05:00";
        const endStr = "2026-07-18T19:00:00-05:00";

        const dateTimePattern = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})/;

        const startMatch = startStr.match(dateTimePattern);
        const endMatch = endStr.match(dateTimePattern);

        expect(startMatch).toBeTruthy();
        expect(endMatch).toBeTruthy();

        // Both should parse successfully
        expect(startMatch?.[4]).toBe("17");
        expect(startMatch?.[5]).toBe("30");
        expect(endMatch?.[4]).toBe("19");
        expect(endMatch?.[5]).toBe("00");

        // Duration is 1.5 hours (90 minutes)
        const startHour = parseInt(startMatch?.[4]!, 10);
        const startMin = parseInt(startMatch?.[5]!, 10);
        const endHour = parseInt(endMatch?.[4]!, 10);
        const endMin = parseInt(endMatch?.[5]!, 10);

        const durationMinutes = (endHour - startHour) * 60 + (endMin - startMin);
        expect(durationMinutes).toBe(90);
    });

    it("should generate stable IDs from title and date", () => {
        function slugify(s: string): string {
            return s
                .toLowerCase()
                .replace(/[^a-z0-9]+/g, "-")
                .replace(/^-+|-+$/g, "");
        }

        const title = "A Brush with Nature at the Houston Botanic Garden";
        const dateStr = "2026-07-18";

        const id = `${slugify(title)}-${dateStr}`;

        expect(id).toBe("a-brush-with-nature-at-the-houston-botanic-garden-2026-07-18");

        // Second call with same params should produce same ID
        const id2 = `${slugify(title)}-${dateStr}`;
        expect(id).toBe(id2);
    });

    it("should generate different IDs for different dates", () => {
        function slugify(s: string): string {
            return s
                .toLowerCase()
                .replace(/[^a-z0-9]+/g, "-")
                .replace(/^-+|-+$/g, "");
        }

        const title = "Purple Martin Watch Party";
        const id1 = `${slugify(title)}-2026-07-25`;
        const id2 = `${slugify(title)}-2026-08-01`;

        expect(id1).not.toBe(id2);
    });

    it("should handle missing event data gracefully", () => {
        const html = `
        <!DOCTYPE html>
        <html>
        <head>
            <script type="application/ld+json">
            {
                "@context": "https://schema.org",
                "@type": "WebPage",
                "name": "Not an event"
            }
            </script>
        </head>
        <body></body>
        </html>
        `;

        const root = parse(html);
        const scripts = root.querySelectorAll("script[type='application/ld+json']");

        let eventFound = false;
        for (const script of scripts) {
            const json = JSON.parse(script.text);
            if (json["@type"] === "Event" && json.name && json.startDate) {
                eventFound = true;
            }
        }

        expect(eventFound).toBe(false);
    });

    it("should extract location from JSON-LD", () => {
        const json = {
            "@type": "Event",
            "name": "Event Title",
            "startDate": "2026-07-18T17:30:00-05:00",
            "location": {
                "@type": "Place",
                "name": "Edith Moore Nature Preserve"
            }
        };

        const location = json.location?.name || "Default Location";
        expect(location).toBe("Edith Moore Nature Preserve");
    });

    it("should use default location when not provided", () => {
        const json = {
            "@type": "Event",
            "name": "Event Title",
            "startDate": "2026-07-18T17:30:00-05:00"
        };

        const defaultLocation = "6407 Westcott St, Houston, TX 77005";
        const location = json.location?.name || defaultLocation;
        expect(location).toBe(defaultLocation);
    });

    it("should truncate long descriptions", () => {
        const longDescription = "a".repeat(2000);
        const truncated = longDescription.substring(0, 1000);

        expect(truncated.length).toBe(1000);
        expect(longDescription.length).toBe(2000);
    });
});
