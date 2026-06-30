/**
 * Ripper for Downtown Houston Events Calendar (https://downtownhouston.org/calendar)
 *
 * The Downtown Houston website publishes a calendar of community events, arts, culture,
 * and activities in the downtown area. Events are displayed as cards on the calendar page
 * with titles, times, and locations.
 *
 * The page structure uses `.post-card` elements with date information in `.post-date-box`.
 * Each event card contains:
 * - Title in `.post-card-content-headline`
 * - Time and location in `.post-card-content-body`
 * - Date info in `.post-date-box` with day-of-week, day, and month
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

function slugify(s: string): string {
    return s
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "");
}

/**
 * Parse time string like "10 a.m. - 5 p.m." or "10:30a.m. - 11 a.m." or "6:30p.m. - 7:30p.m."
 * Returns the start time as LocalTime or null if unparseable
 */
function parseStartTime(timeStr: string): LocalTime | null {
    if (!timeStr) return null;

    // Extract the first time (before the dash)
    const timePart = timeStr.split("-")[0]?.trim();
    if (!timePart) return null;

    // Match patterns like "10 a.m.", "10:30a.m.", "6:30p.m.", "10:30 a.m."
    const match = timePart.match(/^(\d{1,2}):?(\d{2})?\s*(a|p)\.?m\.?$/i);
    if (!match) return null;

    let hour = parseInt(match[1]!, 10);
    const minute = match[2] ? parseInt(match[2]!, 10) : 0;
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
 * Parse date from the post-date-box elements (day-of-week, day, month)
 * Returns the date for the current or next occurrence given only day and month
 */
function parseEventDate(dayStr: string, monthStr: string, yearStr: string): LocalDate | null {
    const monthMap: Record<string, number> = {
        jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6,
        jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12,
    };

    const day = parseInt(dayStr, 10);
    const month = monthMap[monthStr.toLowerCase()];
    const year = parseInt(yearStr, 10);

    if (!month || !day || !year) {
        return null;
    }

    try {
        return LocalDate.of(year, month, day);
    } catch {
        return null;
    }
}

/**
 * Parse duration from time range string like "10 a.m. - 5 p.m."
 * Returns duration in minutes
 */
function parseEventDuration(timeStr: string): Duration | null {
    if (!timeStr) return null;

    const parts = timeStr.split("-");
    if (parts.length !== 2) return null;

    const startTime = parseStartTime(parts[0]!.trim());
    if (!startTime) return null;

    // Parse end time
    const endPart = parts[1]!.trim();
    const endMatch = endPart.match(/^(\d{1,2}):?(\d{2})?\s*(a|p)\.?m\.?$/i);
    if (!endMatch) return null;

    let hour = parseInt(endMatch[1]!, 10);
    const minute = endMatch[2] ? parseInt(endMatch[2]!, 10) : 0;
    const meridiem = endMatch[3]!.toLowerCase();

    if (meridiem === "p" && hour !== 12) {
        hour += 12;
    } else if (meridiem === "a" && hour === 12) {
        hour = 0;
    }

    try {
        const endTime = LocalTime.of(hour, minute);
        const startMinutes = startTime.hour() * 60 + startTime.minute();
        const endMinutes = endTime.hour() * 60 + endTime.minute();
        const diffMinutes = endMinutes - startMinutes;

        if (diffMinutes > 0) {
            return Duration.ofMinutes(diffMinutes);
        }
        // If end time is earlier, assume it wraps to next day
        return Duration.ofMinutes(diffMinutes + 24 * 60);
    } catch {
        return null;
    }
}

/**
 * Extract location from the body text (after the " / " separator if present)
 */
function extractLocation(bodyText: string): string | null {
    const parts = bodyText.split("/");
    if (parts.length > 1) {
        return parts[1]!.trim();
    }
    return null;
}

export default class DowntownHoustonEventsRipper implements IRipper {
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
                `Downtown Houston Events fetch failed: HTTP ${res.status} ${res.statusText}`,
            );
        }

        const html = await res.text();
        const events: RipperCalendarEvent[] = [];
        const errors: RipperError[] = [];

        const root = parse(html);

        // Find all event cards. The structure is:
        // <a class="post-card" href="/do/event-slug">
        //   <div class="post-card-content">
        //     <div class="post-card-content-headline">Event Title</div>
        //     <div class="post-card-content-body">Time / Location</div>
        //   </div>
        //   <div class="post-date-box">
        //     <div class="post-date-dow">Day</div>
        //     <div class="post-date-day">29</div>
        //     <div class="post-date-month">Jun</div>
        //   </div>
        // </a>

        const eventCards = root.querySelectorAll("a.post-card");

        for (const card of eventCards) {
            // Extract title
            const titleEl = card.querySelector(".post-card-content-headline");
            if (!titleEl) {
                errors.push({
                    type: "ParseError",
                    reason: "Missing title in post-card",
                    context: "post-card",
                });
                continue;
            }
            const title = titleEl.text.trim();
            if (!title) {
                errors.push({
                    type: "ParseError",
                    reason: "Empty title in post-card",
                    context: "post-card",
                });
                continue;
            }

            // Extract time and location
            const bodyEl = card.querySelector(".post-card-content-body");
            let timeStr = "";
            let location: string | null = null;

            if (bodyEl) {
                // Get text content without child HTML
                const bodyText = bodyEl.text.trim();
                // Remove extra whitespace
                timeStr = bodyText.split("/")[0]?.trim() || "";
                location = extractLocation(bodyText);
            }

            // Extract date
            const dateBox = card.querySelector(".post-date-box");
            if (!dateBox) {
                errors.push({
                    type: "ParseError",
                    reason: `Missing date for event: ${title}`,
                    context: title,
                });
                continue;
            }

            const dayOfWeekEl = dateBox.querySelector(".post-date-dow");
            const dayEl = dateBox.querySelector(".post-date-day");
            const monthEl = dateBox.querySelector(".post-date-month");

            if (!dayEl || !monthEl) {
                errors.push({
                    type: "ParseError",
                    reason: `Missing day or month for event: ${title}`,
                    context: title,
                });
                continue;
            }

            const day = dayEl.text.trim();
            const month = monthEl.text.trim();

            // Parse date - need to determine the year. Assume current year or next year
            // if month is earlier than current month
            const today = LocalDate.now();
            let year = today.year();

            const eventDate = parseEventDate(day, month, year.toString());
            if (!eventDate) {
                // Try next year if parsing failed
                const eventDateNextYear = parseEventDate(day, month, (year + 1).toString());
                if (!eventDateNextYear) {
                    errors.push({
                        type: "ParseError",
                        reason: `Cannot parse date "${day} ${month}" for event: ${title}`,
                        context: `${title}: ${day} ${month}`,
                    });
                    continue;
                }
                const startTime = parseStartTime(timeStr) || LocalTime.of(10, 0);
                const localDT = LocalDateTime.of(eventDateNextYear, startTime);
                const duration = parseEventDuration(timeStr) || Duration.ofHours(2);

                const id = `${slugify(title)}-${eventDateNextYear.toString()}`;
                const event: RipperCalendarEvent = {
                    id,
                    ripped: new Date(),
                    date: ZonedDateTime.of(localDT, tz),
                    duration,
                    summary: title,
                    location: location || undefined,
                };

                events.push(event);
            } else {
                const startTime = parseStartTime(timeStr) || LocalTime.of(10, 0);
                const localDT = LocalDateTime.of(eventDate, startTime);
                const duration = parseEventDuration(timeStr) || Duration.ofHours(2);

                const id = `${slugify(title)}-${eventDate.toString()}`;
                const event: RipperCalendarEvent = {
                    id,
                    ripped: new Date(),
                    date: ZonedDateTime.of(localDT, tz),
                    duration,
                    summary: title,
                    location: location || undefined,
                };

                events.push(event);
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
