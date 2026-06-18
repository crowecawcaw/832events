/**
 * Ripper for Mossrose Bookshop (https://www.mossrosebooks.com/pages/upcoming-events)
 *
 * The site uses the WBS Pro Calendar plugin (Shopify app) which embeds events as JSON
 * in a <script type="application/json"> tag. The JSON objects contain:
 *   - title: event name
 *   - start_date: YYYY-MM-DD format
 *   - start_time: HH:MM (24-hour format)
 *   - end_time: HH:MM (24-hour format)
 *   - description: HTML-formatted text
 *   - all_day: boolean
 *   - recurring: boolean
 */

import {
    Duration,
    LocalDate,
    LocalTime,
    LocalDateTime,
    ZoneId,
    ZonedDateTime,
} from "@js-joda/core";
import "@js-joda/timezone";
import { parse } from "node-html-parser";
import {
    IRipper,
    Ripper,
    RipperCalendar,
    RipperCalendarEvent,
    RipperError,
    ParseError,
} from "../../lib/config/schema.js";
import { getFetchForConfig } from "../../lib/config/proxy-fetch.js";

const BOOKSHOP_LOCATION = "Mossrose Bookshop, 5441 Almeda Rd, Houston, TX 77004";

/**
 * Interface for event objects embedded in the JSON data
 */
interface WBSProEvent {
    id: number;
    title: string;
    description: string;
    start_date: string; // YYYY-MM-DD
    start_time: string; // HH:MM (24-hour)
    end_date?: string;
    end_time?: string;
    all_day: boolean;
    recurring: boolean;
}

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
 * Strip HTML tags from description, keeping plain text.
 */
function stripHtml(html: string): string {
    return html
        .replace(/<[^>]*>/g, " ")
        .replace(/\s+/g, " ")
        .trim();
}

/**
 * Parse a single WBS Pro event into a RipperCalendarEvent or ParseError.
 */
export function parseWBSEvent(
    event: WBSProEvent,
    tz: ZoneId,
): RipperCalendarEvent | ParseError {
    const { title, start_date, start_time, end_time, description, all_day } =
        event;

    if (!title || !start_date) {
        return {
            type: "ParseError",
            reason: "Missing required event fields (title or start_date)",
            context: JSON.stringify(event),
        };
    }

    // Parse start date (YYYY-MM-DD)
    const dateMatch = start_date.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!dateMatch) {
        return {
            type: "ParseError",
            reason: `Invalid date format: "${start_date}"`,
            context: title,
        };
    }

    const year = parseInt(dateMatch[1]!, 10);
    const month = parseInt(dateMatch[2]!, 10);
    const day = parseInt(dateMatch[3]!, 10);

    let localDate: LocalDate;
    try {
        localDate = LocalDate.of(year, month, day);
    } catch {
        return {
            type: "ParseError",
            reason: `Invalid date values: ${year}-${month}-${day}`,
            context: title,
        };
    }

    // Parse start time (HH:MM, 24-hour format)
    let startTime = LocalTime.of(0, 0); // Default to midnight for all-day events
    let duration = Duration.ofHours(1); // Default 1-hour duration

    if (!all_day && start_time) {
        const timeMatch = start_time.match(/^(\d{1,2}):(\d{2})$/);
        if (timeMatch) {
            const hours = parseInt(timeMatch[1]!, 10);
            const minutes = parseInt(timeMatch[2]!, 10);
            try {
                startTime = LocalTime.of(hours, minutes);
            } catch {
                return {
                    type: "ParseError",
                    reason: `Invalid time format: "${start_time}"`,
                    context: title,
                };
            }
        }

        // Calculate duration from end_time if available
        if (end_time) {
            const endTimeMatch = end_time.match(/^(\d{1,2}):(\d{2})$/);
            if (endTimeMatch) {
                const endHours = parseInt(endTimeMatch[1]!, 10);
                const endMinutes = parseInt(endTimeMatch[2]!, 10);
                const startTotalMins = startTime.hour() * 60 + startTime.minute();
                let endTotalMins = endHours * 60 + endMinutes;
                // Handle overnight events
                if (endTotalMins < startTotalMins) {
                    endTotalMins += 24 * 60;
                }
                const durationMins = Math.max(0, endTotalMins - startTotalMins);
                duration = Duration.ofMinutes(durationMins || 60);
            }
        } else {
            // Default to 2-hour duration if no end time
            duration = Duration.ofHours(2);
        }
    } else if (all_day) {
        // All-day events are typically 24 hours
        duration = Duration.ofHours(24);
    }

    const localDT = LocalDateTime.of(localDate, startTime);
    const date = ZonedDateTime.of(localDT, tz);

    // Strip HTML from description
    const plainDescription = description ? stripHtml(description) : undefined;

    // Create stable ID from title and date
    const id = `${slugify(title)}-${localDate.toString()}`;

    const result: RipperCalendarEvent = {
        id,
        ripped: new Date(),
        date,
        duration,
        summary: title,
        location: BOOKSHOP_LOCATION,
        description: plainDescription,
    };

    return result;
}

/**
 * Extract JSON data from WBS Pro Calendar script tag.
 * The events are embedded in a <script type="application/json" data-wbs-pro="...">
 */
export function extractWBSEventsFromHtml(html: string): WBSProEvent[] {
    try {
        const root = parse(html);
        // Find script tags with type="application/json"
        const scripts = root.querySelectorAll('script[type="application/json"]');

        for (const script of scripts) {
            // Check if this is a WBS Pro calendar script
            const dataAttr = script.getAttribute("data-wbs-pro");
            if (dataAttr) {
                try {
                    const jsonStr = script.innerText.trim();
                    const data = JSON.parse(jsonStr);

                    // The data structure could be { events: [...] } or directly an array
                    const events = Array.isArray(data)
                        ? data
                        : data.events || data.items || [];

                    if (Array.isArray(events) && events.length > 0) {
                        return events as WBSProEvent[];
                    }
                } catch {
                    // Skip if JSON parsing fails, try next script
                    continue;
                }
            }
        }

        // If we couldn't find WBS Pro data, return empty array
        return [];
    } catch {
        return [];
    }
}

/**
 * Parse all events from the HTML page.
 */
export function parseEvents(
    html: string,
    tz: ZoneId,
): Array<RipperCalendarEvent | RipperError> {
    const wbsEvents = extractWBSEventsFromHtml(html);

    if (wbsEvents.length === 0) {
        return [
            {
                type: "ParseError",
                reason: "No WBS Pro Calendar events found in page",
                context: "Check if page structure has changed",
            },
        ];
    }

    return wbsEvents.map((event) => parseWBSEvent(event, tz));
}

export default class MossroseBookshopRipper implements IRipper {
    public async rip(ripper: Ripper): Promise<RipperCalendar[]> {
        const fetchFn = getFetchForConfig(ripper.config);
        const cal = ripper.config.calendars[0]!;
        const tz = ZoneId.of(cal.timezone.id());

        const res = await fetchFn(ripper.config.url.toString(), {
            headers: {
                "User-Agent":
                    "Mozilla/5.0 (compatible; 832events/1.0)",
            },
        });

        if (!res.ok) {
            throw new Error(
                `Mossrose Bookshop fetch failed: HTTP ${res.status} ${res.statusText}`,
            );
        }

        const html = await res.text();
        const results = parseEvents(html, tz);

        // Filter out past events and errors
        const today = LocalDate.now(tz);
        const events: RipperCalendarEvent[] = [];
        const errors: RipperError[] = [];

        for (const r of results) {
            if ("date" in r) {
                if (!r.date.toLocalDate().isBefore(today)) {
                    events.push(r);
                }
            } else {
                errors.push(r);
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
}
