/**
 * Ripper for Texas Parks and Wildlife Houston Events
 * (https://tpwd.texas.gov/calendar/near-city/houston-events)
 *
 * The TPWD website publishes a calendar of outdoor recreation, nature, and
 * educational events at parks and wildlife areas across the Houston region.
 *
 * The page uses hCalendar microformat with event details in:
 * - Title in `a.summary.event_title`
 * - Date in `abbr.dtstart` (whitespace-separated month/day text nodes)
 * - Time in `div.event_details > div:nth-child(2)` (format: "8:30a", "1:30p")
 * - Location in `div.location`
 * - Description in `div.description`
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
} from "../../lib/config/schema.js";
import { getFetchForConfig } from "../../lib/config/proxy-fetch.js";

function slugify(s: string): string {
    return s
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "");
}

/**
 * Parse time string like "8:30a", "1:30p", "10:00a"
 * Returns the start time as LocalTime or null if unparseable
 */
function parseStartTime(timeStr: string): LocalTime | null {
    if (!timeStr) return null;

    const trimmed = timeStr.trim();
    // Match patterns like "8:30a", "1:30p", "10:00a" (no space before meridiem)
    const match = trimmed.match(/^(\d{1,2}):(\d{2})([ap])$/i);
    if (!match) return null;

    let hour = parseInt(match[1]!, 10);
    const minute = parseInt(match[2]!, 10);
    const meridiem = match[3]!.toLowerCase();

    // Convert to 24-hour format
    if (meridiem === "p" && hour !== 12) {
        hour += 12;
    } else if (meridiem === "a" && hour === 12) {
        hour = 0;
    }

    try {
        return LocalTime.of(hour, minute);
    } catch {
        return null;
    }
}

/**
 * Parse date from whitespace-separated month/day text in dtstart abbr
 * Examples: "Jun 29", "Dec 25"
 * Returns the date for the current or next occurrence
 */
function parseEventDate(dateStr: string): LocalDate | null {
    const monthMap: Record<string, number> = {
        jan: 1,
        feb: 2,
        mar: 3,
        apr: 4,
        may: 5,
        jun: 6,
        jul: 7,
        aug: 8,
        sep: 9,
        oct: 10,
        nov: 11,
        dec: 12,
    };

    // Split on whitespace to get month and day
    const parts = dateStr.trim().split(/\s+/);
    if (parts.length < 2) return null;

    const monthStr = parts[0]!.toLowerCase();
    const dayStr = parts[1]!;

    const month = monthMap[monthStr];
    const day = parseInt(dayStr, 10);

    if (!month || !day || day < 1 || day > 31) {
        return null;
    }

    // Determine the year: use current year, or next year if month is earlier than now
    const today = LocalDate.now();
    let year = today.year();

    try {
        let eventDate = LocalDate.of(year, month, day);
        // If the date is in the past, use next year
        if (eventDate.isBefore(today)) {
            eventDate = LocalDate.of(year + 1, month, day);
        }
        return eventDate;
    } catch {
        return null;
    }
}

/**
 * Extract text nodes from an element, preserving whitespace structure
 * Used for parsing dtstart which has month/day as separate text nodes
 */
function extractTextNodeContent(el: HTMLElement): string {
    let text = "";
    for (const child of el.childNodes) {
        if (child.nodeType === 3) {
            // Text node
            text += (child as any).text || "";
        }
    }
    return text;
}

/**
 * Get the second child div of event_details which contains the time
 */
function extractTimeFromDetails(detailsEl: HTMLElement): string | null {
    const children = detailsEl.childNodes.filter((n) => (n as any).tagName);
    if (children.length >= 2) {
        const timeDiv = children[1] as HTMLElement;
        return timeDiv?.text?.trim() || null;
    }
    return null;
}

export default class TexasParksWildlifeHoustonRipper implements IRipper {
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
                `Texas Parks and Wildlife Houston Events fetch failed: HTTP ${res.status} ${res.statusText}`,
            );
        }

        const html = await res.text();
        const events: RipperCalendarEvent[] = [];
        const errors: RipperError[] = [];

        const root = parse(html);

        // Find all event elements using hCalendar microformat classes
        const eventElements = root.querySelectorAll("div.vevent.event");

        for (const eventEl of eventElements) {
            try {
                // Extract title from a.summary.event_title
                const titleEl = eventEl.querySelector("a.summary.event_title");
                if (!titleEl) {
                    errors.push({
                        type: "ParseError",
                        reason: "Missing title (a.summary.event_title)",
                        context: "vevent",
                    });
                    continue;
                }

                const title = titleEl.text?.trim();
                if (!title) {
                    errors.push({
                        type: "ParseError",
                        reason: "Empty title in event",
                        context: "vevent",
                    });
                    continue;
                }

                // Extract date from abbr.dtstart (whitespace-separated text nodes)
                const detailsEl = eventEl.querySelector("div.event_details");
                if (!detailsEl) {
                    errors.push({
                        type: "ParseError",
                        reason: `Missing event_details for event: ${title}`,
                        context: title,
                    });
                    continue;
                }

                const dtstartEl = detailsEl.querySelector("abbr.dtstart");
                if (!dtstartEl) {
                    errors.push({
                        type: "ParseError",
                        reason: `Missing dtstart for event: ${title}`,
                        context: title,
                    });
                    continue;
                }

                const dateText = extractTextNodeContent(dtstartEl);
                const eventDate = parseEventDate(dateText);

                if (!eventDate) {
                    errors.push({
                        type: "ParseError",
                        reason: `Cannot parse date "${dateText}" for event: ${title}`,
                        context: `${title}: ${dateText}`,
                    });
                    continue;
                }

                // Extract time from event_details second child div
                const timeStr = extractTimeFromDetails(detailsEl);
                const startTime = parseStartTime(timeStr || "") || LocalTime.of(10, 0);

                // Extract location from div.location
                const locationEl = eventEl.querySelector("div.location");
                const location = locationEl?.text?.trim() || undefined;

                // Extract description from div.description (optional)
                const descEl = eventEl.querySelector("div.description");
                const description = descEl?.text?.trim() || undefined;

                // Build the event
                const localDT = LocalDateTime.of(eventDate, startTime);
                // Default to 2-hour duration
                const duration = Duration.ofHours(2);

                const id = `${slugify(title)}-${eventDate.toString()}`;
                const event: RipperCalendarEvent = {
                    id,
                    ripped: new Date(),
                    date: ZonedDateTime.of(localDT, tz),
                    duration,
                    summary: title,
                    location,
                    description,
                };

                events.push(event);
            } catch (err) {
                errors.push({
                    type: "ParseError",
                    reason: `Unexpected error parsing event: ${err instanceof Error ? err.message : String(err)}`,
                    context: "vevent",
                });
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
