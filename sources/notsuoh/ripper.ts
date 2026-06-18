/**
 * Ripper for Notsuoh (https://notsuoh.com/events)
 *
 * Notsuoh is a nightlife venue in downtown Houston with a custom Squarespace-based
 * event listing. Events are displayed as cards with:
 *   - h2 > a — event title and link
 *   - div.event-date — contains month and day spans
 *   - ul with li elements containing:
 *     - Date/time range (e.g., "Fri, Jun 14, 2026 8:00 PM – Sun, Jun 21, 2026 2:00 AM")
 *     - Calendar links (Google Calendar, iCal)
 *     - Location with map link
 *   - p — event description
 *   - a with "View Event →" — link to full event page
 *
 * The date/time information is embedded in a single line of text that needs parsing.
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

const DEFAULT_VENUE_ADDRESS = "314 Main St, Houston, TX 77002";

function slugify(s: string): string {
    return s
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "");
}

/**
 * Parse time string like "8:00 PM" into LocalTime.
 * Returns null if unparseable.
 */
function parseTime12h(timeStr: string): LocalTime | null {
    const match = timeStr.trim().match(/^(\d{1,2}):(\d{2})\s*(am|pm)$/i);
    if (!match) {
        return null;
    }

    let hour = parseInt(match[1]!, 10);
    const minute = parseInt(match[2]!, 10);
    const meridiem = match[3]!.toLowerCase();

    if (meridiem === "pm" && hour !== 12) {
        hour += 12;
    } else if (meridiem === "am" && hour === 12) {
        hour = 0;
    }

    try {
        return LocalTime.of(hour, minute);
    } catch {
        return null;
    }
}

/**
 * Parse a date string like "Fri, Jun 14, 2026" into LocalDate.
 * Returns null if unparseable.
 */
function parseEventDate(dateStr: string): LocalDate | null {
    // Format: "Fri, Jun 14, 2026" or "Mon, Jul 05, 2026"
    const match = dateStr.trim().match(/\w+,\s+(\w+)\s+(\d{1,2}),\s+(\d{4})/);
    if (!match) {
        return null;
    }

    const monthStr = match[1]!;
    const dayStr = match[2]!;
    const yearStr = match[3]!;

    const monthMap: { [key: string]: number } = {
        January: 1,
        February: 2,
        March: 3,
        April: 4,
        May: 5,
        June: 6,
        Jul: 7,
        July: 7,
        August: 8,
        September: 9,
        October: 10,
        November: 11,
        December: 12,
        Jan: 1,
        Feb: 2,
        Mar: 3,
        Apr: 4,
        Jun: 6,
        Aug: 8,
        Sep: 9,
        Oct: 10,
        Nov: 11,
        Dec: 12,
    };

    const month = monthMap[monthStr];
    if (!month) {
        return null;
    }

    const day = parseInt(dayStr, 10);
    const year = parseInt(yearStr, 10);

    try {
        return LocalDate.of(year, month, day);
    } catch {
        return null;
    }
}

/**
 * Extract text content from an element, handling whitespace.
 */
function getTextContent(el: HTMLElement | null): string {
    if (!el) return "";
    return el.text.trim();
}

/**
 * Parse date/time range string like "Fri, Jun 14, 2026 8:00 PM – Sun, Jun 21, 2026 2:00 AM"
 * Returns { startDate, startTime, endDate, endTime } or null if unparseable.
 */
function parseDateTimeRange(rangeStr: string): {
    startDate: LocalDate;
    startTime: LocalTime;
    endDate: LocalDate;
    endTime: LocalTime;
} | null {
    // Split on the en-dash or em-dash
    const parts = rangeStr.split(/\s+[–—]\s+/);
    if (parts.length !== 2) {
        return null;
    }

    const startPart = parts[0]!.trim();
    const endPart = parts[1]!.trim();

    // Parse start: "Fri, Jun 14, 2026 8:00 PM"
    const startMatch = startPart.match(/^(.+?)\s+(\d{1,2}:\d{2}\s+[AP]M)$/i);
    if (!startMatch) {
        return null;
    }

    const startDateStr = startMatch[1]!;
    const startTimeStr = startMatch[2]!;
    const startDate = parseEventDate(startDateStr);
    const startTime = parseTime12h(startTimeStr);

    if (!startDate || !startTime) {
        return null;
    }

    // Parse end: "Sun, Jun 21, 2026 2:00 AM"
    const endMatch = endPart.match(/^(.+?)\s+(\d{1,2}:\d{2}\s+[AP]M)$/i);
    if (!endMatch) {
        return null;
    }

    const endDateStr = endMatch[1]!;
    const endTimeStr = endMatch[2]!;
    const endDate = parseEventDate(endDateStr);
    const endTime = parseTime12h(endTimeStr);

    if (!endDate || !endTime) {
        return null;
    }

    return { startDate, startTime, endDate, endTime };
}

export default class NotsuohRipper implements IRipper {
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
                `Notsuoh fetch failed: HTTP ${res.status} ${res.statusText}`,
            );
        }

        const html = await res.text();
        const doc = parse(html);

        const events: RipperCalendarEvent[] = [];
        const errors: RipperError[] = [];

        // Find all event cards
        const eventCards = doc.querySelectorAll(".event-card");

        for (const card of eventCards) {
            const result = this.parseEvent(card, tz, ripper.config.url.toString());
            if ("type" in result) {
                errors.push(result);
            } else {
                events.push(result);
            }
        }

        return [
            {
                name: cal.name,
                friendlyname: cal.friendlyname,
                events,
                errors,
                tags: ripper.config.tags ?? [],
                parent: ripper.config,
            },
        ];
    }

    /**
     * Parse a single event card.
     * Returns RipperCalendarEvent | RipperError
     */
    private parseEvent(
        card: HTMLElement,
        tz: ZoneId,
        sourceUrl: string,
    ): RipperCalendarEvent | RipperError {
        // Extract title
        const titleLink = card.querySelector("h2 a");
        const title = getTextContent(titleLink);

        if (!title) {
            return {
                type: "ParseError" as const,
                reason: "Missing event title",
                context: card.outerHTML.substring(0, 200),
            };
        }

        // Extract date/time range from the first <li> in the <ul>
        const listItems = card.querySelectorAll("ul li");
        if (listItems.length === 0) {
            return {
                type: "ParseError" as const,
                reason: `Event "${title}" has no list items`,
                context: card.outerHTML.substring(0, 200),
            };
        }

        const dateTimeText = getTextContent(listItems[0]);
        if (!dateTimeText) {
            return {
                type: "ParseError" as const,
                reason: `Event "${title}" has empty date/time text`,
                context: card.outerHTML.substring(0, 200),
            };
        }

        const parsed = parseDateTimeRange(dateTimeText);
        if (!parsed) {
            return {
                type: "ParseError" as const,
                reason: `Event "${title}" unparseable date/time: ${dateTimeText}`,
                context: card.outerHTML.substring(0, 200),
            };
        }

        const { startDate, startTime, endDate, endTime } = parsed;

        // Calculate duration
        const startDt = ZonedDateTime.of(startDate, startTime, tz);
        const endDt = ZonedDateTime.of(endDate, endTime, tz);
        let duration = Duration.between(startDt.toInstant(), endDt.toInstant());

        // If duration is negative or zero (shouldn't happen with valid input), default to 2 hours
        if (duration.isNegative() || duration.isZero()) {
            duration = Duration.ofHours(2);
        }

        // Extract description from the <p> tag
        const descriptionEl = card.querySelector("p");
        const description = getTextContent(descriptionEl);

        // Extract location (optional, from the third <li> which contains location)
        let location = DEFAULT_VENUE_ADDRESS;
        if (listItems.length > 2) {
            const locationLi = listItems[2];
            if (locationLi) {
                const locText = getTextContent(locationLi);
                // Try to extract just the address part (before any map link)
                if (locText) {
                    const parts = locText.split(/\s*\(map\)\s*/i);
                    if (parts[0]) {
                        // Remove "Location: " prefix if present
                        let cleanLoc = parts[0]!.replace(/^Location:\s*/i, "").trim();
                        if (cleanLoc && !cleanLoc.toLowerCase().includes("notsuoh")) {
                            location = cleanLoc;
                        }
                    }
                }
            }
        }

        // Build stable event ID from title + start date
        const eventId = `${slugify(title)}-${startDate.toString()}`;

        // Build the event
        const localDT = LocalDateTime.of(startDate, startTime);
        const date = ZonedDateTime.of(localDT, tz);

        // Extract event link if available
        let url: string | undefined;
        if (titleLink) {
            const href = titleLink.getAttribute("href");
            if (href) {
                url = href.startsWith("http")
                    ? href
                    : `https://notsuoh.com${href}`;
            }
        }

        const event: RipperCalendarEvent = {
            id: eventId,
            ripped: new Date(),
            date,
            duration,
            summary: title,
            description: description || undefined,
            location,
            url,
        };

        return event;
    }
}
