/**
 * Ripper for Warehouse Live Midtown (https://warehouselivemidtown.com/calendar/)
 *
 * Warehouse Live uses a WordPress site with the SeeTickets plugin for event listings.
 * Events are rendered as server-side HTML with:
 *   - Container: div.seetickets-list-event-container
 *   - Image: img.seetickets-list-view-event-image
 *   - Title: p.event-title > a
 *   - Date: p.event-date (format: "Fri Jul 24")
 *   - Door time: span.see-doortime (format: "9:00PM")
 *   - Show time: span.see-showtime (format: "9:00PM")
 *   - Description: p.subtitle
 *   - Venue: p.venue
 *   - Price: span.price (not parsed into event.cost)
 *   - URL: href in p.event-title a
 *
 * Location is fixed at 813 St Emanuel, Houston, TX 77003 (set via geo in ripper.yaml).
 */

import {
    Duration,
    LocalDate,
    LocalTime,
    LocalDateTime,
    ZoneId,
    ZonedDateTime,
    ChronoUnit,
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

const BASE_URL = "https://warehouselivemidtown.com";

function slugify(s: string): string {
    return s
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "");
}

/**
 * Parse a 12-hour time string like "9:00PM" into LocalTime.
 * Returns null if unparseable.
 */
function parseTime12h(timeStr: string): LocalTime | null {
    if (!timeStr) return null;
    // Handle both "9:00PM" and "9:00 PM" formats
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
 * Parse a date string like "Fri Jul 24" into LocalDate.
 * The listing omits the year, so it is inferred relative to `referenceDate`:
 * a month/day already past rolls forward to the next year.
 * Returns null if unparseable.
 */
function parseDate(
    dateStr: string,
    referenceDate: LocalDate = LocalDate.now(),
): LocalDate | null {
    if (!dateStr) return null;
    // Format: "Fri Jul 24" (weekday Month Day)
    // We need to figure out the year. For now, assume it's the next occurrence of this date.
    const match = dateStr.trim().match(/\w+\s+(\w+)\s+(\d+)/);
    if (!match) {
        return null;
    }

    const monthStr = match[1]!;
    const dayStr = match[2]!;
    const day = parseInt(dayStr, 10);

    // Month name to number
    const months: { [key: string]: number } = {
        January: 1,
        February: 2,
        March: 3,
        April: 4,
        May: 5,
        June: 6,
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
        Jul: 7,
        Aug: 8,
        Sep: 9,
        Oct: 10,
        Nov: 11,
        Dec: 12,
    };

    const month = months[monthStr];
    if (!month) {
        return null;
    }

    // Determine the year - if month/day is in the past for current year, use next year
    const year = referenceDate.year();
    try {
        let date = LocalDate.of(year, month, day);
        if (date.isBefore(referenceDate)) {
            date = LocalDate.of(year + 1, month, day);
        }
        return date;
    } catch {
        return null;
    }
}

/**
 * Extract text content from an element.
 */
function getTextContent(el: HTMLElement | null): string {
    if (!el) return "";
    return el.text.trim();
}

/**
 * Parse a single event container div into a RipperCalendarEvent or RipperError.
 */
export function parseEventContainer(
    container: HTMLElement,
    tz: ZoneId,
    sourceName: string,
    referenceDate: LocalDate = LocalDate.now(),
): RipperCalendarEvent | RipperError {
    // Extract title
    const titleEl = container.querySelector("p.event-title a");
    const title = getTextContent(titleEl);

    if (!title) {
        return {
            type: "ParseError" as const,
            reason: "Missing event title",
            context: container.outerHTML.substring(0, 200),
        };
    }

    // Extract date
    const dateEl = container.querySelector("p.event-date");
    const dateStr = getTextContent(dateEl);

    const startDate = parseDate(dateStr, referenceDate);
    if (!startDate) {
        return {
            type: "ParseError" as const,
            reason: `Event "${title}" unparseable date: "${dateStr}"`,
            context: container.outerHTML.substring(0, 200),
        };
    }

    // Extract show time (defaults to 8pm if not found)
    let startTime = LocalTime.of(20, 0); // 8:00 PM
    const showTimeEl = container.querySelector("span.see-showtime");
    if (showTimeEl) {
        const showTimeStr = getTextContent(showTimeEl);
        const parsed = parseTime12h(showTimeStr);
        if (parsed) {
            startTime = parsed;
        }
    }

    // Default duration is 2 hours
    let duration = Duration.ofHours(2);

    // Extract description
    const descEl = container.querySelector("p.subtitle");
    const description = descEl ? getTextContent(descEl) : undefined;

    // Extract image
    const imgEl = container.querySelector("img.seetickets-list-view-event-image");
    let imageUrl: string | undefined;
    if (imgEl) {
        const src = imgEl.getAttribute("src");
        if (src) {
            imageUrl = src.startsWith("http") ? src : `${BASE_URL}${src}`;
        }
    }

    // Extract URL
    let url: string | undefined;
    const titleLink = container.querySelector("p.event-title a");
    if (titleLink) {
        const href = titleLink.getAttribute("href");
        if (href) {
            url = href.startsWith("http") ? href : `${BASE_URL}${href}`;
        }
    }

    // Build stable event ID
    const eventId = `${slugify(title)}-${startDate.toString()}`;

    // Build the event
    const localDT = LocalDateTime.of(startDate, startTime);
    const date = ZonedDateTime.of(localDT, tz);

    const event: RipperCalendarEvent = {
        id: eventId,
        ripped: new Date(),
        date,
        duration,
        summary: title,
        description,
        url,
        imageUrl,
    };

    return event;
}

/**
 * Parse all events from the full HTML page string.
 * Exported so tests can call it directly; they pin `referenceDate` so the
 * year inferred for the saved sample data does not drift over time.
 */
export function parseEvents(
    html: string,
    tz: ZoneId,
    sourceName: string,
    referenceDate: LocalDate = LocalDate.now(),
): Array<RipperCalendarEvent | RipperError> {
    const root = parse(html);
    const containers = root.querySelectorAll(
        "div.seetickets-list-event-container",
    );
    return containers.map((container) =>
        parseEventContainer(container, tz, sourceName, referenceDate),
    );
}

export default class WarehouseLiveRipper implements IRipper {
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
                `Warehouse Live fetch failed: HTTP ${res.status} ${res.statusText}`,
            );
        }

        const html = await res.text();
        const results = parseEvents(html, tz, ripper.config.name);

        // Filter to future events
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
