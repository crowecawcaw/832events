import { describe, it, expect } from "vitest";
import { ZoneId } from "@js-joda/core";
import { parseEvents, parseWBSEvent, extractWBSEventsFromHtml } from "./ripper.js";

const HOUSTON_TZ = ZoneId.of("America/Chicago");

/**
 * Sample WBS Pro event objects as they appear in the JSON
 */
const SAMPLE_WBS_EVENT_1 = {
    id: 7,
    title: "Author Signings",
    description:
        "<p>Meet author Johnny Garza Villa at 2:00pm</p><p>Help us celebrate Pride Month!</p>",
    start_date: "2026-06-20",
    start_time: "14:00",
    end_date: "",
    end_time: "16:00",
    all_day: false,
    recurring: false,
    frequency: "weekly",
    repeat_until_date: "",
    event_color: "#e39ac3",
    event_border_color: "#47266b",
    event_text_color: "#eae8e6",
};

const SAMPLE_WBS_EVENT_2 = {
    id: 1,
    title: "Mossrose Book Club",
    description: "<p>Join us in store for our first book club! This month we will be reading You Had Me at Hola by Alexis Daria.</p>",
    start_date: "2026-06-25",
    start_time: "19:00",
    end_date: "",
    end_time: "21:00",
    all_day: false,
    recurring: false,
    frequency: "weekly",
    repeat_until_date: "",
    event_color: "#cccccc",
    event_border_color: "#de31ff",
    event_text_color: "#121212",
};

const SAMPLE_ALL_DAY_EVENT = {
    id: 3,
    title: "All Day Event",
    description: "<p>This is an all-day event</p>",
    start_date: "2026-07-04",
    start_time: "",
    end_date: "",
    end_time: "",
    all_day: true,
    recurring: false,
    frequency: "weekly",
    repeat_until_date: "",
    event_color: "#cccccc",
    event_border_color: "#000000",
    event_text_color: "#121212",
};

/**
 * Sample HTML page with embedded WBS Pro calendar data
 */
function generateSampleHtml(events: any[]): string {
    return `
    <!DOCTYPE html>
    <html>
    <head><title>Mossrose Events</title></head>
    <body>
        <section id="DP--template--26665317663010__event_calendar_zqizeP"
                 class="DP--template--26665317673010__event_calendar_zqizeP">
            <div class="wbs-pro__background">
                <div class="wbs-pro__calendar-grid"></div>
                <script type="application/json" data-wbs-pro="events">
                ${JSON.stringify(events)}
                </script>
            </div>
        </section>
    </body>
    </html>
    `;
}

describe("MossroseBookshopRipper", () => {
    it("should parse a complete WBS event with end time", () => {
        const result = parseWBSEvent(SAMPLE_WBS_EVENT_1, HOUSTON_TZ);

        expect("date" in result).toBe(true);
        if ("date" in result) {
            expect(result.summary).toBe("Author Signings");
            expect(result.location).toBe("Mossrose Bookshop, 5441 Almeda Rd, Houston, TX 77004");
            expect(result.date.toLocalDate().toString()).toBe("2026-06-20");
            expect(result.date.toLocalTime().hour()).toBe(14);
            expect(result.date.toLocalTime().minute()).toBe(0);
            expect(result.description).toContain("Pride Month");
            // Duration should be 2 hours (14:00 to 16:00)
            expect(result.duration.toMinutes()).toBe(120);
        }
    });

    it("should parse event and strip HTML from description", () => {
        const result = parseWBSEvent(SAMPLE_WBS_EVENT_2, HOUSTON_TZ);

        expect("date" in result).toBe(true);
        if ("date" in result) {
            expect(result.summary).toBe("Mossrose Book Club");
            expect(result.date.toLocalDate().toString()).toBe("2026-06-25");
            expect(result.date.toLocalTime().hour()).toBe(19);
            // Description should have HTML stripped
            expect(result.description).toContain("Join us in store");
            expect(result.description).not.toContain("<p>");
        }
    });

    it("should handle all-day events", () => {
        const result = parseWBSEvent(SAMPLE_ALL_DAY_EVENT, HOUSTON_TZ);

        expect("date" in result).toBe(true);
        if ("date" in result) {
            expect(result.summary).toBe("All Day Event");
            expect(result.date.toLocalDate().toString()).toBe("2026-07-04");
            expect(result.date.toLocalTime().hour()).toBe(0);
            expect(result.date.toLocalTime().minute()).toBe(0);
            // All-day events get 24-hour duration
            expect(result.duration.toHours()).toBe(24);
        }
    });

    it("should extract WBS Pro events from HTML", () => {
        const html = generateSampleHtml([SAMPLE_WBS_EVENT_1, SAMPLE_WBS_EVENT_2]);
        const events = extractWBSEventsFromHtml(html);

        expect(events).toHaveLength(2);
        expect(events[0].title).toBe("Author Signings");
        expect(events[1].title).toBe("Mossrose Book Club");
    });

    it("should parse multiple events from HTML", () => {
        const html = generateSampleHtml([SAMPLE_WBS_EVENT_1, SAMPLE_WBS_EVENT_2]);
        const results = parseEvents(html, HOUSTON_TZ);

        expect(results.length).toBeGreaterThanOrEqual(2);
        const validEvents = results.filter(r => "date" in r);
        expect(validEvents[0]).toHaveProperty("summary", "Author Signings");
        expect(validEvents[1]).toHaveProperty("summary", "Mossrose Book Club");
    });

    it("should return a stable event ID based on title and date", () => {
        const result = parseWBSEvent(SAMPLE_WBS_EVENT_1, HOUSTON_TZ);

        expect("id" in result).toBe(true);
        if ("id" in result) {
            expect(result.id).toBe("author-signings-2026-06-20");
        }
    });

    it("should return ParseError for events with missing title", () => {
        const badEvent = { ...SAMPLE_WBS_EVENT_1, title: "" };
        const result = parseWBSEvent(badEvent, HOUSTON_TZ);

        expect("type" in result).toBe(true);
        if ("type" in result) {
            expect(result.type).toBe("ParseError");
            expect(result.reason).toContain("Missing required event fields");
        }
    });

    it("should return ParseError for events with invalid date format", () => {
        const badEvent = { ...SAMPLE_WBS_EVENT_1, start_date: "invalid-date" };
        const result = parseWBSEvent(badEvent, HOUSTON_TZ);

        expect("type" in result).toBe(true);
        if ("type" in result) {
            expect(result.type).toBe("ParseError");
            expect(result.reason).toContain("Invalid date format");
        }
    });

    it("should return ParseError for events with invalid time format", () => {
        const badEvent = { ...SAMPLE_WBS_EVENT_1, start_time: "25:99" };
        const result = parseWBSEvent(badEvent, HOUSTON_TZ);

        expect("type" in result).toBe(true);
        if ("type" in result) {
            expect(result.type).toBe("ParseError");
            expect(result.reason).toContain("Invalid time format");
        }
    });

    it("should use default duration if no end time specified", () => {
        const eventNoEnd = { ...SAMPLE_WBS_EVENT_1, end_time: "" };
        const result = parseWBSEvent(eventNoEnd, HOUSTON_TZ);

        expect("date" in result).toBe(true);
        if ("date" in result) {
            // Should default to 2 hours
            expect(result.duration.toHours()).toBe(2);
        }
    });
});
