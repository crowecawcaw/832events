/**
 * Ripper for Basket Books & Art (https://www.basket-books.com/)
 *
 * A Houston bookstore and art gallery specializing in art books, small press fiction,
 * and poetry. Hosts readings, workshops, and exhibitions.
 *
 * The site is React-based and requires JavaScript rendering (proxy mode).
 * Events are parsed from the rendered HTML, looking for event listings that may appear
 * in various sections of the page (events section, announcements, upcoming calendar).
 */

import {
    Duration,
    LocalDate,
    LocalDateTime,
    LocalTime,
    ZoneId,
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

const VENUE_ADDRESS = "115 Hyde Park Blvd, Houston, TX 77006";
const VENUE_NAME = "Basket Books & Art";

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
 * Parse dates in various formats:
 * - "June 11, 2026" or "June 11"
 * - "Thursday, June 11" or "Thursday, June 11, 2026"
 * - "6/11/2026" or "6/11"
 * - "Sat, June 15 at 7:00 PM"
 */
function parseEventDate(dateStr: string): { date: LocalDate; time?: LocalTime } | null {
    if (!dateStr || typeof dateStr !== "string") {
        return null;
    }

    const monthMap: Record<string, number> = {
        january: 1, february: 2, march: 3, april: 4, may: 5, june: 6,
        july: 7, august: 8, september: 9, october: 10, november: 11, december: 12,
        jan: 1, feb: 2, mar: 3, apr: 4, jun: 6, jul: 7, aug: 8,
        sep: 9, sept: 9, oct: 10, nov: 11, dec: 12,
    };

    // Try to extract time (HH:MM AM/PM)
    let time: LocalTime | undefined;
    const timeMatch = dateStr.match(/(\d{1,2}):(\d{2})\s*(AM|PM|am|pm)/i);
    if (timeMatch) {
        let hour = parseInt(timeMatch[1]!, 10);
        const minute = parseInt(timeMatch[2]!, 10);
        const ampm = timeMatch[3]!.toUpperCase();

        if (ampm === "PM" && hour !== 12) hour += 12;
        if (ampm === "AM" && hour === 12) hour = 0;

        time = LocalTime.of(hour, minute);
    }

    // Try "Month Day, Year" or "Month Day"
    const monthDayYearMatch = dateStr.match(
        /(?:Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)[,\s]*(\w+)\s+(\d{1,2})(?:,\s*(\d{4}))?/i
    );
    if (monthDayYearMatch) {
        const monthStr = monthDayYearMatch[1]!;
        const day = parseInt(monthDayYearMatch[2]!, 10);
        let year = monthDayYearMatch[3] ? parseInt(monthDayYearMatch[3]!, 10) : LocalDate.now().year();

        const month = monthMap[monthStr.toLowerCase()];
        if (!month) return null;

        try {
            let eventDate = LocalDate.of(year, month, day);
            // If date is in the past and we're using current year, try next year
            if (eventDate.isBefore(LocalDate.now()) && !monthDayYearMatch[3]) {
                eventDate = LocalDate.of(year + 1, month, day);
            }
            return { date: eventDate, time };
        } catch {
            return null;
        }
    }

    // Try "Month Day, Year" format without day name
    const simpleDateMatch = dateStr.match(/(\w+)\s+(\d{1,2})(?:,\s*(\d{4}))?/);
    if (simpleDateMatch) {
        const monthStr = simpleDateMatch[1]!;
        const day = parseInt(simpleDateMatch[2]!, 10);
        let year = simpleDateMatch[3] ? parseInt(simpleDateMatch[3]!, 10) : LocalDate.now().year();

        const month = monthMap[monthStr.toLowerCase()];
        if (!month) return null;

        try {
            let eventDate = LocalDate.of(year, month, day);
            // If date is in the past and we're using current year, try next year
            if (eventDate.isBefore(LocalDate.now()) && !simpleDateMatch[3]) {
                eventDate = LocalDate.of(year + 1, month, day);
            }
            return { date: eventDate, time };
        } catch {
            return null;
        }
    }

    // Try "M/D/YYYY" or "M/D" format
    const numericDateMatch = dateStr.match(/(\d{1,2})\/(\d{1,2})(?:\/(\d{4}))?/);
    if (numericDateMatch) {
        const month = parseInt(numericDateMatch[1]!, 10);
        const day = parseInt(numericDateMatch[2]!, 10);
        let year = numericDateMatch[3] ? parseInt(numericDateMatch[3]!, 10) : LocalDate.now().year();

        try {
            let eventDate = LocalDate.of(year, month, day);
            if (eventDate.isBefore(LocalDate.now()) && !numericDateMatch[3]) {
                eventDate = LocalDate.of(year + 1, month, day);
            }
            return { date: eventDate, time };
        } catch {
            return null;
        }
    }

    return null;
}

/**
 * Extract event information from the rendered HTML.
 * Looks for event containers, cards, or list items that may contain:
 * - Event titles
 * - Dates and times
 * - Descriptions
 */
function extractEvents(html: string): (RipperCalendarEvent | RipperError)[] {
    const root = parse(html);
    const events: (RipperCalendarEvent | RipperError)[] = [];
    const seenIds = new Set<string>();

    // Try to find event containers by common class/id patterns
    const eventSelectors = [
        ".event",
        ".event-item",
        ".events-item",
        "[data-event]",
        ".calendar-event",
        ".listing",
        ".event-listing",
        "article",
        ".card",
    ];

    const eventElements: HTMLElement[] = [];

    for (const selector of eventSelectors) {
        const matches = root.querySelectorAll(selector);
        if (matches.length > 0) {
            eventElements.push(...matches);
            // If we found events with one selector, prefer that one
            if (matches.length >= 1) break;
        }
    }

    // If no events found with standard selectors, try looking for text patterns
    if (eventElements.length === 0) {
        // Look for any content that contains date-like patterns
        const allText = root.text;
        const datePatterns = allText.match(/[A-Z][a-z]+\s+\d{1,2}(?:,\s*\d{4})?/g);

        if (datePatterns && datePatterns.length > 0) {
            // Found date patterns, try to extract event context
            // This is a fallback that returns generic parsing error
            return [{
                type: "ParseError",
                reason: "Found date patterns but could not identify event structure",
                context: `Patterns found: ${datePatterns.slice(0, 3).join(", ")}`,
            }];
        }

        return [{
            type: "ParseError",
            reason: "No event containers found on page",
            context: "Could not locate events using standard selectors or date patterns",
        }];
    }

    // Parse each event element
    for (const el of eventElements) {
        // Try to extract title (from h2, h3, strong, or first line of text)
        const titleEl = el.querySelector("h2, h3, h4, strong, .title, .event-title");
        const title = titleEl ? titleEl.text.trim() : el.text.trim().split("\n")[0];

        if (!title) continue;

        // Try to extract date (from data attributes, span, or text pattern)
        const dateEl = el.querySelector("[data-date], .date, .event-date, time");
        let dateStr = dateEl ? dateEl.text.trim() : "";

        // If no explicit date element, search in the text content
        if (!dateStr) {
            const allText = el.text;
            const dateMatch = allText.match(
                /(\w+\s+\d{1,2}(?:,?\s*\d{4})?|\d{1,2}\/\d{1,2}(?:\/\d{4})?)/
            );
            if (dateMatch) {
                dateStr = dateMatch[1]!;
            }
        }

        if (!dateStr) {
            // No date found for this event
            continue;
        }

        // Parse the date
        const parsedDate = parseEventDate(dateStr);
        if (!parsedDate) {
            events.push({
                type: "ParseError",
                reason: `Could not parse date: "${dateStr}"`,
                context: `Event: ${title}`,
            });
            continue;
        }

        // Create event ID
        const eventId = hashEventId(title, parsedDate.date.toString());
        if (seenIds.has(eventId)) continue; // Skip duplicates
        seenIds.add(eventId);

        // Extract description if available
        const descEl = el.querySelector(".description, .event-description, .details");
        const description = descEl ? descEl.text.trim() : "";

        // Build the full event datetime
        const eventTime = parsedDate.time || LocalTime.of(19, 0); // Default to 7 PM
        const dateTime = LocalDateTime.of(parsedDate.date, eventTime);
        const tz = ZoneId.of("America/Chicago");
        const zonedDateTime = dateTime.atZone(tz);

        const event: RipperCalendarEvent = {
            id: eventId,
            summary: title,
            date: zonedDateTime,
            ripped: new Date(),
            duration: Duration.ofHours(2),
            location: VENUE_ADDRESS,
            description: description || VENUE_NAME,
        };

        events.push(event);
    }

    return events;
}

export default class BasketBooksAndArtRipper implements IRipper {
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
                `Basket Books & Art fetch failed: HTTP ${res.status} ${res.statusText}`,
            );
        }

        const html = await res.text();
        const results = extractEvents(html);

        const events: RipperCalendarEvent[] = [];
        const errors: RipperError[] = [];

        // Separate results into events and errors
        results.forEach((item) => {
            if ("id" in item) {
                events.push(item as RipperCalendarEvent);
            } else {
                errors.push(item as RipperError);
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
