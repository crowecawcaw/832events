/**
 * Ripper for Lake Houston Brewery (https://www.lakehoustonbrew.com)
 *
 * This is a Wix-based site that requires Browserbase (proxy: true) for JavaScript rendering.
 * The events page lists upcoming events with dates and times.
 *
 * The ripper parses the rendered HTML to extract:
 * - Event title/summary
 * - Date and time (various Wix formats)
 * - Duration (estimated or parsed)
 * - Location (brewery address)
 *
 * Generates stable event IDs based on title + date.
 */

import {
    Duration,
    LocalDate,
    LocalDateTime,
    LocalTime,
    ZoneId,
    ZonedDateTime,
} from "@js-joda/core";
import "@js-joda/timezone";
import { parse } from "node-html-parser";
import type { HTMLElement } from "node-html-parser";
import {
    IRipper,
    Ripper,
    RipperCalendar,
    RipperCalendarEvent,
    RipperError,
    ParseError,
} from "../../lib/config/schema.js";
import { getFetchForConfig } from "../../lib/config/proxy-fetch.js";
import crypto from "crypto";

const VENUE_ADDRESS = "10614 FM 1960 W, Humble, TX 77338";

function slugify(s: string): string {
    return s
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "");
}

function hashEventId(title: string, dateStr: string): string {
    const key = `${slugify(title)}-${dateStr}`;
    const hash = crypto
        .createHash("sha256")
        .update(key)
        .digest("hex")
        .substring(0, 8);
    return `${key}-${hash}`;
}

/**
 * Parse common date/time formats found in Wix event listings:
 * - "June 21, 2026 at 7:00 PM"
 * - "Friday, June 21 at 7:00 PM"
 * - "6/21/2026 7:00 PM"
 * - etc.
 *
 * Returns { date: LocalDate, time: LocalTime } or null if unparseable
 */
function parseDateTime(text: string): { date: LocalDate; time: LocalTime } | null {
    if (!text) return null;

    // Normalize whitespace
    text = text.trim().replace(/\s+/g, " ");

    const monthMap: Record<string, number> = {
        january: 1, february: 2, march: 3, april: 4, may: 5, june: 6,
        july: 7, august: 8, september: 9, october: 10, november: 11, december: 12,
        jan: 1, feb: 2, mar: 3, apr: 4, jun: 6, jul: 7, aug: 8,
        sep: 9, sept: 9, oct: 10, nov: 11, dec: 12,
    };

    // Try "Month DD, YYYY at HH:MM AM/PM" format
    let match = text.match(/(january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)\s+(\d{1,2}),?\s+(\d{4})\s+(?:at\s+)?(\d{1,2}):(\d{2})\s*(am|pm)/i);
    if (match) {
        const month = monthMap[match[1]!.toLowerCase()];
        const day = parseInt(match[2]!, 10);
        const year = parseInt(match[3]!, 10);
        let hour = parseInt(match[4]!, 10);
        const min = parseInt(match[5]!, 10);
        const ampm = match[6]!.toLowerCase();

        if (ampm === "pm" && hour !== 12) hour += 12;
        if (ampm === "am" && hour === 12) hour = 0;

        try {
            const date = LocalDate.of(year, month, day);
            const time = LocalTime.of(hour, min);
            return { date, time };
        } catch {
            return null;
        }
    }

    // Try "MM/DD/YYYY HH:MM AM/PM" or "M/D/YYYY H:MM AM/PM" format
    match = text.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})\s+(?:at\s+)?(\d{1,2}):(\d{2})\s*(am|pm)/i);
    if (match) {
        const month = parseInt(match[1]!, 10);
        const day = parseInt(match[2]!, 10);
        const year = parseInt(match[3]!, 10);
        let hour = parseInt(match[4]!, 10);
        const min = parseInt(match[5]!, 10);
        const ampm = match[6]!.toLowerCase();

        if (ampm === "pm" && hour !== 12) hour += 12;
        if (ampm === "am" && hour === 12) hour = 0;

        try {
            const date = LocalDate.of(year, month, day);
            const time = LocalTime.of(hour, min);
            return { date, time };
        } catch {
            return null;
        }
    }

    // Try "Day, Month DD at HH:MM AM/PM" format
    match = text.match(/(?:monday|tuesday|wednesday|thursday|friday|saturday|sunday)[,\s]+(january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)\s+(\d{1,2})\s+(?:at\s+)?(\d{1,2}):(\d{2})\s*(am|pm)/i);
    if (match) {
        const month = monthMap[match[1]!.toLowerCase()];
        const day = parseInt(match[2]!, 10);
        let hour = parseInt(match[3]!, 10);
        const min = parseInt(match[4]!, 10);
        const ampm = match[5]!.toLowerCase();

        if (ampm === "pm" && hour !== 12) hour += 12;
        if (ampm === "am" && hour === 12) hour = 0;

        try {
            // Assume current or next year
            const today = LocalDate.now();
            let year = today.year();
            let date = LocalDate.of(year, month, day);

            if (date.isBefore(today)) {
                year = year + 1;
                date = LocalDate.of(year, month, day);
            }

            const time = LocalTime.of(hour, min);
            return { date, time };
        } catch {
            return null;
        }
    }

    return null;
}

/**
 * Extract event listings from Wix-rendered HTML.
 * Looks for common Wix event container patterns.
 */
function extractEvents(html: string): (RipperCalendarEvent | RipperError)[] {
    const root = parse(html);
    const events: RipperCalendarEvent[] = [];
    const errors: RipperError[] = [];

    const tz = ZoneId.of("America/Chicago");

    // Wix typically renders events in various container structures.
    // Look for common selectors like data-component, event-item, etc.
    // Also search for text nodes that look like event patterns.

    // Common Wix event structures:
    // 1. <div> elements with data-component attributes
    // 2. <section> elements with event content
    // 3. Event cards with title + date/time info

    // Strategy: Find all elements that might be event containers
    // and look for title + date patterns within them

    const allElements = root.querySelectorAll("*");
    const seenIds = new Set<string>();

    for (const el of allElements) {
        const text = el.textContent || "";

        // Look for event-like text patterns (contains date/time)
        // Skip if too long (likely not a single event) or too short
        if (text.length < 20 || text.length > 2000) continue;

        // Check if this element contains a date/time pattern
        const dateTimeMatch = parseDateTime(text);
        if (!dateTimeMatch) continue;

        // Extract title: look for heading or first line of text
        let title = "";

        // Try to find a title in a heading child
        const heading = el.querySelector("h1, h2, h3, h4, h5, h6");
        if (heading) {
            title = heading.textContent?.trim() || "";
        }

        // Fallback: use first line of element text
        if (!title) {
            const lines = text.split("\n").filter((l) => l.trim());
            if (lines.length > 0) {
                title = lines[0]!.trim();
                // Avoid titles that are too long or contain too much info
                if (title.length > 100) {
                    title = title.substring(0, 100);
                }
            }
        }

        // Skip if no title found
        if (!title || title.length < 3) continue;

        // Create event
        const { date, time } = dateTimeMatch;
        const dateTime = LocalDateTime.of(date, time);
        const zonedDateTime = ZonedDateTime.of(dateTime, tz);
        const dateKey = date.toString();

        // Generate stable ID
        const eventId = hashEventId(title, dateKey);

        // Skip duplicates
        if (seenIds.has(eventId)) continue;
        seenIds.add(eventId);

        const event: RipperCalendarEvent = {
            id: eventId,
            summary: title,
            date: zonedDateTime,
            ripped: new Date(),
            duration: Duration.ofHours(2), // Estimated duration for brewery events
            location: VENUE_ADDRESS,
        };

        events.push(event);
    }

    // If we found no events, return an error
    if (events.length === 0) {
        errors.push({
            error: true,
            type: "ParseError",
            reason: "No events found in rendered HTML",
            context: "Expected to find dated events on the events page",
        } as ParseError);
    }

    return events.length > 0 ? events : errors;
}

export default class LakeHoustonBreweryRipper implements IRipper {
    public async rip(ripper: Ripper): Promise<RipperCalendar[]> {
        const fetchFn = getFetchForConfig(ripper.config);
        const cal = ripper.config.calendars[0]!;

        const res = await fetchFn(ripper.config.url.toString(), {
            headers: {
                "User-Agent": "Mozilla/5.0 (compatible; 832events/1.0)",
            },
        });

        if (!res.ok) {
            throw new Error(
                `Lake Houston Brewery fetch failed: HTTP ${res.status} ${res.statusText}`,
            );
        }

        const html = await res.text();
        const results = extractEvents(html);

        // Separate events from errors
        const events: RipperCalendarEvent[] = [];
        const errors: RipperError[] = [];

        results.forEach((item) => {
            if ("error" in item && item.error) {
                errors.push(item as RipperError);
            } else {
                events.push(item as RipperCalendarEvent);
            }
        });

        return [
            {
                name: cal.name,
                friendlyname: cal.friendlyname || "",
                events,
                errors,
                tags: ripper.config.tags ?? [],
                parent: ripper.config,
            },
        ];
    }
}
