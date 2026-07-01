/**
 * Ripper for River Oaks Theatre (https://www.theriveroakstheatre.com/)
 *
 * River Oaks Theatre is an historic dine-in cinema that reopened in October 2024.
 * The website uses Eventive ticketing platform for event listings.
 *
 * The site requires proxy access due to bot detection (HTTP 403 from CI).
 * Event listings are displayed in Eventive widgets/iframes embedded in the website.
 *
 * This ripper parses event listings from the HTML, extracting:
 *   - Event title
 *   - Date and time information
 *   - Event URL for tickets/info
 *   - Event type/category
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
import { createHash } from "crypto";

const VENUE_ADDRESS = "River Oaks Shopping Center, Houston, TX 77019";
const VENUE_NAME = "River Oaks Theatre";

/**
 * Convert a title string into a URL-slug-style id component.
 */
function slugify(s: string): string {
    return s
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "");
}

/**
 * Generate stable event ID from title and date.
 */
function hashEventId(title: string, dateStr: string): string {
    const key = `${slugify(title)}-${dateStr}`;
    const hash = createHash("sha256")
        .update(key)
        .digest("hex")
        .substring(0, 8);
    return `${key}-${hash}`;
}

/**
 * Month abbreviation/name to number mapping.
 */
const monthMap: Record<string, number> = {
    january: 1, february: 2, march: 3, april: 4, may: 5, june: 6,
    july: 7, august: 8, september: 9, october: 10, november: 11, december: 12,
    jan: 1, feb: 2, mar: 3, apr: 4, jun: 6, jul: 7, aug: 8,
    sep: 9, sept: 9, oct: 10, nov: 11, dec: 12,
};

/**
 * Parse a month string (name or abbreviation) to number.
 */
function monthToNumber(monthStr: string): number | null {
    return monthMap[monthStr.toLowerCase()] || null;
}

/**
 * Parse time string like "7:00 PM" or "10:00 AM"
 * Returns LocalTime or null if unparseable.
 */
function parseTime(timeStr: string): LocalTime | null {
    const match = timeStr.trim().match(/(\d{1,2}):(\d{2})\s*(am|pm)/i);
    if (!match) {
        return null;
    }
    let hour = parseInt(match[1]!, 10);
    const minute = parseInt(match[2]!, 10);
    const period = match[3]!.toLowerCase();

    if (period === "pm" && hour !== 12) {
        hour += 12;
    } else if (period === "am" && hour === 12) {
        hour = 0;
    }

    try {
        return LocalTime.of(hour, minute);
    } catch {
        return null;
    }
}

/**
 * Parse a date string in formats like:
 *   - "Friday, December 6"
 *   - "Dec 6"
 *   - "December 6, 2026"
 * Returns LocalDate or null.
 */
function parseEventDate(dateStr: string, currentYear: number): LocalDate | null {
    // Try to extract year if present
    const yearMatch = dateStr.match(/(\d{4})/);
    const year = yearMatch ? parseInt(yearMatch[1]!, 10) : currentYear;

    // Remove day name if present (e.g., "Friday, December 6" → "December 6")
    const cleanedStr = dateStr.replace(/^(?:Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday),?\s*/i, "");

    // Try to parse "Month DD" or "Month DD, YYYY" pattern
    const match = cleanedStr.match(/([A-Z][a-z]+)\s+(\d{1,2})/i);
    if (!match) {
        return null;
    }

    const monthStr = match[1]!;
    const day = parseInt(match[2]!, 10);
    const month = monthToNumber(monthStr);

    if (!month) {
        return null;
    }

    try {
        return LocalDate.of(year, month, day);
    } catch {
        return null;
    }
}

/**
 * Extract event listings from the page HTML.
 * Looks for common Eventive patterns and generic event containers.
 */
function extractEventElements(html: string): HTMLElement[] {
    const root = parse(html);
    const events: HTMLElement[] = [];

    // Try multiple selectors for event containers
    // Pattern 1: Eventive event-item or event containers
    let items = root.querySelectorAll("[data-eventid], [class*='event-item'], [class*='event-card'], [class*='eventive']");
    if (items.length > 0) {
        events.push(...items);
    }

    // Pattern 2: Generic article/div containers with event-like structure
    if (events.length === 0) {
        items = root.querySelectorAll("article, [class*='event']");
        events.push(...items);
    }

    return events;
}

/**
 * Parse a single event element into a RipperCalendarEvent or error.
 */
function parseEventElement(
    element: HTMLElement,
    tz: ZoneId,
    sourceUrl: URL,
): RipperCalendarEvent | RipperError {
    try {
        // Extract title
        let title: string | null = null;
        const titleEl = element.querySelector("h2, h3, .title, [class*='title']") || element.querySelector("a");
        if (titleEl) {
            title = titleEl.textContent?.trim() || null;
        }

        if (!title || title.length === 0) {
            return {
                type: "ParseError" as const,
                reason: "Could not extract event title",
                context: element.outerHTML.substring(0, 200),
            };
        }

        // Extract date
        let dateStr: string | null = null;
        let dateEl = element.querySelector(".date, [class*='date'], time");
        if (dateEl) {
            dateStr = dateEl.textContent?.trim() || dateEl.getAttribute("datetime") || null;
        }

        // If no date found, try to find any text that looks like a date
        if (!dateStr) {
            const text = element.textContent || "";
            const dateMatch = text.match(/(?:Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)?,?\s*[A-Z][a-z]+\s+\d{1,2}/);
            dateStr = dateMatch ? dateMatch[0] : null;
        }

        if (!dateStr) {
            return {
                type: "ParseError" as const,
                reason: "Could not extract event date",
                context: `Title: ${title}`,
            };
        }

        // Parse the date
        const currentYear = LocalDate.now().year();
        const eventDate = parseEventDate(dateStr, currentYear);
        if (!eventDate) {
            return {
                type: "ParseError" as const,
                reason: `Could not parse date: ${dateStr}`,
                context: `Title: ${title}`,
            };
        }

        // Extract time if present
        let timeStr: string | null = null;
        const timeEl = element.querySelector(".time, [class*='time']");
        if (timeEl) {
            timeStr = timeEl.textContent?.trim() || null;
        }

        // Try to find time in the text
        if (!timeStr) {
            const text = element.textContent || "";
            const timeMatch = text.match(/(\d{1,2}:\d{2}\s*(?:am|pm))/i);
            timeStr = timeMatch ? timeMatch[1] : null;
        }

        // Create event with default 2-hour duration
        let startTime = LocalTime.of(19, 0); // 7 PM default
        if (timeStr) {
            const parsed = parseTime(timeStr);
            if (parsed) {
                startTime = parsed;
            }
        }

        const eventDateTime = ZonedDateTime.of(eventDate, startTime, tz);
        const duration = Duration.ofHours(2);

        // Extract event URL
        let eventUrl: string | null = null;
        const linkEl = element.querySelector("a[href]");
        if (linkEl) {
            eventUrl = linkEl.getAttribute("href") || null;
            // Resolve relative URLs
            if (eventUrl && !eventUrl.startsWith("http")) {
                eventUrl = new URL(eventUrl, sourceUrl).toString();
            }
        }

        // Generate stable ID
        const eventId = hashEventId(title, eventDate.toString());

        return {
            id: eventId,
            ripped: new Date(),
            date: eventDateTime,
            duration,
            summary: title,
            description: VENUE_NAME,
            location: VENUE_ADDRESS,
            url: eventUrl || sourceUrl.toString(),
        } as RipperCalendarEvent;
    } catch (error) {
        return {
            type: "ParseError" as const,
            reason: `Error parsing event element: ${error}`,
            context: element.outerHTML.substring(0, 200),
        };
    }
}

export default class RiverOaksTheatreRipper implements IRipper {
    public async rip(ripper: Ripper): Promise<RipperCalendar[]> {
        const fetchFn = getFetchForConfig(ripper.config);
        const cal = ripper.config.calendars[0]!;
        const tz = ZoneId.of(cal.timezone.id());

        const res = await fetchFn(ripper.config.url.toString(), {
            headers: {
                "User-Agent": "Mozilla/5.0 (compatible; 832events/1.0)",
            },
        });

        if (!res.ok) {
            throw new Error(
                `River Oaks Theatre fetch failed: HTTP ${res.status} ${res.statusText}`,
            );
        }

        const html = await res.text();
        const events: RipperCalendarEvent[] = [];
        const errors: RipperError[] = [];

        // Extract event elements
        const eventElements = extractEventElements(html);

        if (eventElements.length === 0) {
            // If no events found, record an informational error
            errors.push({
                type: "ParseError" as const,
                reason: "No event elements found in HTML",
                context: "Check if Eventive widget is embedded in the page",
            });
        }

        // Parse each event element
        for (const element of eventElements) {
            const result = parseEventElement(element, tz, ripper.config.url);
            if ("date" in result && result.date !== undefined) {
                events.push(result as RipperCalendarEvent);
            } else {
                errors.push(result as RipperError);
            }
        }

        return [
            {
                name: cal.name,
                friendlyname: cal.friendlyname,
                events,
                errors,
                parent: ripper.config,
                tags: cal.tags || [],
            },
        ];
    }
}
