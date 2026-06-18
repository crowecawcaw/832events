/**
 * Ripper for Lake Houston Brewery (https://www.lakehoustonbrew.com/events)
 *
 * Lake Houston Brewery uses Wix's event management system. The events page displays
 * Sunday Brunch events using Wix's standard event list framework.
 *
 * Event structure:
 *   - a[data-hook="title"] — event title and link
 *   - div[data-hook="date"] — event date/time (e.g., "Jun 21, 2026, 11:00 AM – 6:00 PM")
 *   - div.PLst2a — event description
 *   - img — event image
 *
 * Note: Wix generates random class names, so we rely on stable data-hook attributes.
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

const VENUE_ADDRESS = "10614 FM 1960 W, Humble, TX 77338";

function slugify(s: string): string {
    return s
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "");
}

/**
 * Parse a time string like "11:00 AM" into LocalTime.
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
 * Extract text content from an element, handling whitespace.
 */
function getTextContent(el: HTMLElement | null): string {
    if (!el) return "";
    return el.text.trim();
}

/**
 * Parse a date string like "Jun 21, 2026" into LocalDate.
 * Expected format: "Mon DD, YYYY" or similar month abbreviation.
 */
function parseEventDate(dateStr: string): LocalDate | null {
    // Match patterns like "Jun 21, 2026" or "June 21, 2026"
    const match = dateStr.match(
        /(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+(\d{1,2}),\s+(\d{4})/i
    );
    if (!match) {
        return null;
    }

    const day = parseInt(match[1]!, 10);
    const year = parseInt(match[2]!, 10);

    // Extract month name and convert to month number
    const monthMatch = dateStr.match(
        /(\w{3})[a-z]*/i
    );
    if (!monthMatch) {
        return null;
    }

    const monthStr = monthMatch[1]!.toLowerCase();
    const monthMap: Record<string, number> = {
        jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6,
        jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12,
    };

    const month = monthMap[monthStr];
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
 * Parse a Wix date/time string like "Jun 21, 2026, 11:00 AM – 6:00 PM"
 * Returns { startDate, startTime, endTime } or null if unparseable.
 */
function parseDateTimeRange(dateTimeStr: string): { startDate: LocalDate; startTime: LocalTime; endTime: LocalTime } | null {
    // Pattern: "Mon DD, YYYY, HH:MM AM/PM – HH:MM AM/PM"
    const fullMatch = dateTimeStr.match(
        /(.+?),\s+(\d{1,2}):(\d{2})\s+(am|pm)\s*–\s*(\d{1,2}):(\d{2})\s+(am|pm)/i
    );

    if (!fullMatch) {
        return null;
    }

    const dateStr = fullMatch[1]!.trim();
    const startHourStr = fullMatch[2]!;
    const startMinStr = fullMatch[3]!;
    const startMeridiem = fullMatch[4]!.toLowerCase();
    const endHourStr = fullMatch[5]!;
    const endMinStr = fullMatch[6]!;
    const endMeridiem = fullMatch[7]!.toLowerCase();

    const startDate = parseEventDate(dateStr);
    if (!startDate) {
        return null;
    }

    // Parse start time
    let startHour = parseInt(startHourStr, 10);
    const startMin = parseInt(startMinStr, 10);
    if (startMeridiem === "pm" && startHour !== 12) {
        startHour += 12;
    } else if (startMeridiem === "am" && startHour === 12) {
        startHour = 0;
    }

    // Parse end time
    let endHour = parseInt(endHourStr, 10);
    const endMin = parseInt(endMinStr, 10);
    if (endMeridiem === "pm" && endHour !== 12) {
        endHour += 12;
    } else if (endMeridiem === "am" && endHour === 12) {
        endHour = 0;
    }

    try {
        const startTime = LocalTime.of(startHour, startMin);
        const endTime = LocalTime.of(endHour, endMin);
        return { startDate, startTime, endTime };
    } catch {
        return null;
    }
}

export default class LakeHoustonBreweryRipper implements IRipper {
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
                `Lake Houston Brewery fetch failed: HTTP ${res.status} ${res.statusText}`,
            );
        }

        const html = await res.text();
        const doc = parse(html);

        const events: RipperCalendarEvent[] = [];
        const errors: RipperError[] = [];

        // Find all event items using Wix's data-hook attribute
        // Note: Wix uses data-hook="side-by-side-item" for event containers
        const eventItems = doc.querySelectorAll('[data-hook="side-by-side-item"]');

        for (const item of eventItems) {
            const result = this.parseEvent(item, tz, ripper.config.url.toString());
            if ("type" in result && result.type) {
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
     * Parse a single event item from the Wix event list.
     * Returns RipperCalendarEvent | RipperError
     */
    private parseEvent(
        item: HTMLElement,
        tz: ZoneId,
        sourceUrl: string,
    ): RipperCalendarEvent | RipperError {
        // Extract title using data-hook
        const titleEl = item.querySelector('a[data-hook="title"]');
        const title = getTextContent(titleEl);

        if (!title) {
            return {
                type: "ParseError" as const,
                reason: "Missing event title",
                context: item.outerHTML.substring(0, 200),
            };
        }

        // Extract date/time range using data-hook
        const dateEl = item.querySelector('div[data-hook="date"]');
        const dateTimeStr = getTextContent(dateEl);

        if (!dateTimeStr) {
            return {
                type: "ParseError" as const,
                reason: `Event "${title}" has no date/time`,
                context: item.outerHTML.substring(0, 200),
            };
        }

        // Parse the date/time range
        const parsed = parseDateTimeRange(dateTimeStr);
        if (!parsed) {
            return {
                type: "ParseError" as const,
                reason: `Event "${title}" unparseable date/time: ${dateTimeStr}`,
                context: item.outerHTML.substring(0, 200),
            };
        }

        const { startDate, startTime, endTime } = parsed;

        // Calculate duration
        const startDt = ZonedDateTime.of(
            LocalDateTime.of(startDate, startTime),
            tz
        );
        const endDt = ZonedDateTime.of(
            LocalDateTime.of(startDate, endTime),
            tz
        );
        const duration = Duration.between(startDt.toInstant(), endDt.toInstant());

        // Extract description
        const descEl = item.querySelector("div.PLst2a");
        const description = getTextContent(descEl);

        // Extract event URL
        let url: string | undefined;
        if (titleEl) {
            const href = titleEl.getAttribute("href");
            if (href) {
                url = href.startsWith("http")
                    ? href
                    : `https://www.lakehoustonbrew.com${href}`;
            }
        }

        // Build stable event ID from title + start date
        const eventId = `${slugify(title)}-${startDate.toString()}`;

        const date = startDt;

        const event: RipperCalendarEvent = {
            id: eventId,
            ripped: new Date(),
            date,
            duration,
            summary: title,
            description,
            location: VENUE_ADDRESS,
            url,
        };

        return event;
    }
}
