/**
 * Ripper for Concerts50 Houston (https://concerts50.com/upcoming-concerts-in-texas/houston)
 *
 * The page lists events as server-rendered carousel/list items. Each event is an
 * <li class="slide"> containing:
 *   - <a href="/show/artist-date"> with the event URL
 *   - <div class="image"> with <img src> pointing to the artist image
 *   - <div class="info"> containing:
 *     - <span class="bottom_place"> with:
 *       - <b>Artist Name</b>
 *       - <p>Month Day · Day, Time</p> (e.g., "Aug 9 · Sun, 7:00 PM")
 *     - <span class="top_place"> with:
 *       - <p>Venue - City, State</p> (e.g., "Toyota Center - Houston, TX")
 *
 * The ripper parses the date/time string to extract start date and time.
 * Since this is a multi-venue aggregator (no fixed geo), geo is null.
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
import { decodeEntities } from "../../lib/text-normalize.js";
import { createHash } from "crypto";

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
 * Generate stable event ID from artist name, venue, and date.
 */
function hashEventId(artist: string, venue: string, dateStr: string): string {
    const key = `${slugify(artist)}-${slugify(venue)}-${dateStr}`;
    const hash = createHash("sha256")
        .update(key)
        .digest("hex")
        .substring(0, 8);
    return `${key}-${hash}`;
}

/**
 * Pre-compiled regex for parsing time strings like "7:00 PM" or "8:30 AM".
 */
const TIME_REGEX = /(\d{1,2}):(\d{2})\s*(AM|PM|am|pm)/i;

/**
 * Pre-compiled regex for parsing date/time strings like "Aug 9 · Sun, 7:00 PM".
 */
const DATE_REGEX = /([A-Z][a-z]{2,})\s+(\d{1,2})\s*(?:·\s*(?:[A-Z][a-z]+,)?\s*)?(\d{1,2}:\d{2})\s*(AM|PM|am|pm)/i;

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
 * Parse time string like "7:00 PM" or "8:30 AM"
 * Returns [hour, minute] in 24-hour format or null if unparseable.
 */
function parseTime(timeStr: string): [number, number] | null {
    const match = timeStr.match(TIME_REGEX);
    if (!match) {
        return null;
    }

    let hour = parseInt(match[1]!, 10);
    const minute = parseInt(match[2]!, 10);
    const meridiem = match[3]!.toUpperCase();

    if (meridiem === "PM" && hour !== 12) {
        hour += 12;
    } else if (meridiem === "AM" && hour === 12) {
        hour = 0;
    }

    return [hour, minute];
}

/**
 * Parse a date/time string in the format "Month Day · Day, Time"
 * Examples:
 *   "Aug 9 · Sun, 7:00 PM"
 *   "Oct 23 · Fri, 8:00 PM"
 *   "Aug 8 · Sat, 6:30 PM"
 *
 * Returns { date: LocalDate, time: LocalTime } or null if unparseable.
 */
function parseDateTimeString(dateTimeStr: string): { date: LocalDate; time: LocalTime } | null {
    // Match pattern: "Month Day · Day, Time"
    // Group 1: Month (3+ letters)
    // Group 2: Day (1-2 digits)
    // Group 3: Time (H:MM or HH:MM)
    // Group 4: AM/PM
    const match = dateTimeStr.match(DATE_REGEX);

    if (!match) {
        return null;
    }

    const monthStr = match[1]!;
    const day = parseInt(match[2]!, 10);
    const timeStr = `${match[3]!} ${match[4]!}`;

    const month = monthToNumber(monthStr);
    if (!month) {
        return null;
    }

    const timeComponents = parseTime(timeStr);
    if (!timeComponents) {
        return null;
    }

    const [hour, minute] = timeComponents;

    // Determine year: use current year if date is in the future, otherwise next year
    // Handle leap year edge case: Feb 29 in leap years must be adjusted when rolling to non-leap years
    const today = LocalDate.now();
    let year = today.year();
    let date: LocalDate;

    try {
        // Try current year first
        date = LocalDate.of(year, month, day);
    } catch (err) {
        // If date is invalid in current year (e.g., Feb 29 in non-leap year), adjust day
        const adjustedDay = day > 28 ? 28 : day;
        try {
            date = LocalDate.of(year, month, adjustedDay);
        } catch (err2) {
            return null;
        }
    }

    // Check if we need to roll to next year
    if (date.isBefore(today)) {
        year = year + 1;
        try {
            date = LocalDate.of(year, month, day);
        } catch (err) {
            // If date is invalid in next year too (e.g., Feb 29 in non-leap year), adjust day
            const adjustedDay = day > 28 ? 28 : day;
            try {
                date = LocalDate.of(year, month, adjustedDay);
            } catch (err2) {
                return null;
            }
        }
    }

    try {
        const time = LocalTime.of(hour, minute);
        return { date, time };
    } catch (err) {
        return null;
    }
}

/**
 * Sanitize venue name by removing HTML entities and extra whitespace.
 */
function sanitizeVenue(venueText: string): string {
    return decodeEntities(venueText).trim();
}

export default class Concerts50HoustonRipper implements IRipper {
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
                `Concerts50 Houston page failed: HTTP ${res.status} ${res.statusText}`,
            );
        }

        const html = await res.text();
        const root = parse(html);

        const events: RipperCalendarEvent[] = [];
        const errors: RipperError[] = [];

        // Find all event slides: <li class="slide">
        const slides = root.querySelectorAll("li.slide");

        for (const slide of slides) {
            try {
                // Extract the link
                const link = slide.querySelector("a");
                if (!link) {
                    errors.push({
                        type: "ParseError",
                        reason: "Missing link in slide",
                        context: `Slide: ${slide.toString().substring(0, 100)}`,
                    });
                    continue;
                }

                const eventUrl = link.getAttribute("href") || "";

                // Extract info section
                const info = slide.querySelector(".info");
                if (!info) {
                    errors.push({
                        type: "ParseError",
                        reason: "Missing .info section in slide",
                        context: `URL: ${eventUrl}`,
                    });
                    continue;
                }

                // Extract artist name from bottom_place > b
                const bottomPlace = info.querySelector(".bottom_place");
                if (!bottomPlace) {
                    errors.push({
                        type: "ParseError",
                        reason: "Missing .bottom_place in .info",
                        context: `URL: ${eventUrl}`,
                    });
                    continue;
                }

                const artistB = bottomPlace.querySelector("b");
                const artist = artistB?.textContent?.trim();
                if (!artist) {
                    errors.push({
                        type: "ParseError",
                        reason: "Missing or empty artist name in <b> tag",
                        context: `URL: ${eventUrl}`,
                    });
                    continue;
                }

                // Extract date/time from bottom_place > p
                const dateP = bottomPlace.querySelector("p");
                const dateTimeStr = dateP?.textContent?.trim();
                if (!dateTimeStr) {
                    errors.push({
                        type: "ParseError",
                        reason: "Missing date/time in bottom_place paragraph",
                        context: `Artist: ${artist}`,
                    });
                    continue;
                }

                // Parse date/time
                const dateTimeResult = parseDateTimeString(dateTimeStr);
                if (!dateTimeResult) {
                    errors.push({
                        type: "ParseError",
                        reason: `Cannot parse date/time string: "${dateTimeStr}"`,
                        context: `Artist: ${artist}`,
                    });
                    continue;
                }

                const { date, time } = dateTimeResult;

                // Extract venue from top_place > p
                const topPlace = info.querySelector(".top_place");
                if (!topPlace) {
                    errors.push({
                        type: "ParseError",
                        reason: "Missing .top_place in .info",
                        context: `Artist: ${artist}, Date: ${dateTimeStr}`,
                    });
                    continue;
                }

                const venueP = topPlace.querySelector("p");
                const venueText = venueP?.textContent?.trim();
                if (!venueText) {
                    errors.push({
                        type: "ParseError",
                        reason: "Missing venue in top_place paragraph",
                        context: `Artist: ${artist}`,
                    });
                    continue;
                }

                const venue = sanitizeVenue(venueText);

                // Create ZonedDateTime
                const localDT = LocalDateTime.of(date, time);
                const zonedDT = ZonedDateTime.of(localDT, tz);

                // Generate stable ID
                const eventId = hashEventId(artist, venue, date.toString());

                // Extract image URL
                let imageUrl: string | undefined;
                const img = slide.querySelector("img");
                if (img) {
                    imageUrl = img.getAttribute("src") || img.getAttribute("data-src");
                }

                const event: RipperCalendarEvent = {
                    id: eventId,
                    summary: artist,
                    date: zonedDT,
                    duration: Duration.ofHours(2), // Default 2-hour duration
                    location: venue,
                    ripped: new Date(),
                    url: eventUrl || undefined,
                    imageUrl: imageUrl || undefined,
                };

                events.push(event);
            } catch (err) {
                errors.push({
                    type: "ParseError",
                    reason: `Exception processing slide: ${err instanceof Error ? err.message : String(err)}`,
                    context: `Slide: ${slide.toString().substring(0, 100)}`,
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
