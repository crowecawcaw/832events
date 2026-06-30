/**
 * Ripper for Sawyer Yards (https://www.sawyeryards.com/)
 *
 * The Sawyer Yards website lists events in an HTML grid of event cards.
 * Each event card has a title, date/time range, and link to the full event page.
 * We parse the date strings like "Saturday, July 11\n12pm - 5pm" to extract
 * the event timing information.
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

const VENUE_ADDRESS = "2101 Winter Street, Houston, TX 77007";

function slugify(s: string): string {
    return s
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "");
}

/**
 * Parse a date string like "Saturday, July 11" and convert to LocalDate.
 * The year will be inferred based on current date context.
 */
function parseEventDate(dateStr: string, referenceDate: Date): LocalDate | null {
    // Date format: "Day, Month DD"
    // e.g., "Saturday, July 11"
    const match = dateStr.match(
        /^[A-Za-z]+,\s+([A-Za-z]+)\s+(\d{1,2})$/
    );
    if (!match) {
        return null;
    }

    const monthName = match[1]!.toLowerCase();
    const day = parseInt(match[2]!, 10);

    const monthMap: Record<string, number> = {
        january: 1, february: 2, march: 3, april: 4, may: 5, june: 6,
        july: 7, august: 8, september: 9, october: 10, november: 11, december: 12,
    };

    const month = monthMap[monthName];
    if (!month) {
        return null;
    }

    // Infer year: if the date is more than 7 days in the past, assume next year
    let year = referenceDate.getFullYear();
    const possibleDate = new Date(year, month - 1, day);
    const daysDiff = (possibleDate.getTime() - referenceDate.getTime()) / (1000 * 60 * 60 * 24);

    if (daysDiff < -7) {
        year = referenceDate.getFullYear() + 1;
    }

    try {
        return LocalDate.of(year, month, day);
    } catch {
        return null;
    }
}

/**
 * Parse a time string like "12pm - 5pm" and return start time and duration.
 * Returns [LocalTime, Duration] or null if parse fails.
 */
function parseTimeRange(timeStr: string): [LocalTime, Duration] | null {
    const match = timeStr.match(/(\d{1,2})(?::(\d{2}))?\s*(am|pm)\s*-\s*(\d{1,2})(?::(\d{2}))?\s*(am|pm)/i);
    if (!match) {
        return null;
    }

    const startHour = parseInt(match[1]!, 10);
    const startMin = match[2] ? parseInt(match[2]!, 10) : 0;
    const startPeriod = match[3]!.toLowerCase();
    const endHour = parseInt(match[4]!, 10);
    const endMin = match[5] ? parseInt(match[5]!, 10) : 0;
    const endPeriod = match[6]!.toLowerCase();

    // Convert to 24-hour time
    let startH24 = startHour;
    let endH24 = endHour;

    if (startPeriod === "pm" && startHour !== 12) {
        startH24 = startHour + 12;
    }
    if (startPeriod === "am" && startHour === 12) {
        startH24 = 0;
    }

    if (endPeriod === "pm" && endHour !== 12) {
        endH24 = endHour + 12;
    }
    if (endPeriod === "am" && endHour === 12) {
        endH24 = 0;
    }

    try {
        const startTime = LocalTime.of(startH24, startMin);
        const endTime = LocalTime.of(endH24, endMin);

        // Calculate duration
        const startMinutes = startH24 * 60 + startMin;
        let endMinutes = endH24 * 60 + endMin;

        // Handle case where end time is on next day (e.g., 6pm - 2am)
        if (endMinutes < startMinutes) {
            endMinutes += 24 * 60;
        }

        const durationMinutes = endMinutes - startMinutes;
        const duration = Duration.ofMinutes(durationMinutes);

        return [startTime, duration];
    } catch {
        return null;
    }
}

export default class SawyerYardsRipper implements IRipper {
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
                `Sawyer Yards fetch failed: HTTP ${res.status} ${res.statusText}`,
            );
        }

        const html = await res.text();
        const events: RipperCalendarEvent[] = [];
        const errors: RipperError[] = [];
        const referenceDate = new Date();

        const root = parse(html);

        // Find all event cards. The structure is:
        // <div class="col-12 col-md-6 col-lg-4 event-card">
        //   <a href="/do/event-slug">
        //     <div class="event-card-image">...</div>
        //   </a>
        //   <div class="event-card-label">Event Title</div>
        //   <div class="event-card-dateline">Saturday, July 11<br />12pm - 5pm</div>
        //   <p>...</p>
        // </div>
        const eventCards = root.querySelectorAll("div.event-card");

        for (const card of eventCards) {
            const titleEl = card.querySelector("div.event-card-label");
            const dateEl = card.querySelector("div.event-card-dateline");
            const linkEl = card.querySelector("a");

            if (!titleEl) {
                errors.push({
                    type: "ParseError",
                    reason: "Missing event title element",
                    context: "event-card-label",
                });
                continue;
            }

            const title = titleEl.text.trim();
            if (!title) {
                errors.push({
                    type: "ParseError",
                    reason: "Event title is empty",
                    context: "event-card-label",
                });
                continue;
            }

            if (!dateEl) {
                errors.push({
                    type: "ParseError",
                    reason: `Missing date for event: ${title}`,
                    context: title,
                });
                continue;
            }

            // The dateline contains both date and time, separated by <br />
            // Extract text content and normalize whitespace
            let dateText = "";
            for (const node of dateEl.childNodes) {
                if (typeof (node as any).text === "string") {
                    const text = ((node as any).text || "").trim();
                    if (text) {
                        dateText += text + " ";
                    }
                }
            }
            dateText = dateText.trim();

            if (!dateText) {
                errors.push({
                    type: "ParseError",
                    reason: `Empty dateline for event: ${title}`,
                    context: title,
                });
                continue;
            }

            // Parse format: "Day, Month DD HH:MMam/pm - HH:MMam/pm"
            // The date part is "Day, Month DD", rest is time
            // Match: "Day, Month DD" at the start
            const dateMatch = dateText.match(/^([A-Za-z]+,\s+[A-Za-z]+\s+\d{1,2})/);
            if (!dateMatch) {
                errors.push({
                    type: "ParseError",
                    reason: `Cannot parse dateline: "${dateText}"`,
                    context: `${title}: ${dateText}`,
                });
                continue;
            }

            const dateStr = dateMatch[1]!.trim();
            const timeStr = dateText.substring(dateMatch[0]!.length).trim();

            const eventDate = parseEventDate(dateStr, referenceDate);
            if (!eventDate) {
                errors.push({
                    type: "ParseError",
                    reason: `Cannot parse date: "${dateStr}"`,
                    context: `${title}: ${dateStr}`,
                });
                continue;
            }

            const timeInfo = parseTimeRange(timeStr);
            if (!timeInfo) {
                errors.push({
                    type: "ParseError",
                    reason: `Cannot parse time: "${timeStr}"`,
                    context: `${title}: ${timeStr}`,
                });
                continue;
            }

            const [startTime, duration] = timeInfo;
            const localDT = LocalDateTime.of(eventDate, startTime);
            const date = ZonedDateTime.of(localDT, tz);

            const eventUrl = linkEl?.getAttribute("href")
                ? `https://www.sawyeryards.com${linkEl.getAttribute("href")}`
                : undefined;

            const id = `${slugify(title)}-${eventDate.toString()}`;

            const event: RipperCalendarEvent = {
                id,
                ripped: new Date(),
                date,
                duration,
                summary: title,
                location: VENUE_ADDRESS,
                url: eventUrl,
            };

            events.push(event);
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
