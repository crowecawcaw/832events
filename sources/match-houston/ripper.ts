/**
 * Ripper for MATCH Houston (https://matchouston.org)
 *
 * MATCH Houston is an arts center in Midtown that hosts theater, dance, music, and visual art.
 * The calendar is built using Drupal calendar module and displays events in a month view.
 * Each event instance has a date/time, presenter/company, venue, and event title.
 *
 * We scrape the month view to extract event details including:
 * - ISO8601 datetime from the dc:date content attribute
 * - Event title and URL
 * - Presenter/company name
 * - Venue name within MATCH (e.g., Matchbox 1, Matchbox 3)
 *
 * We iterate through several months to collect upcoming events.
 */

import {
    Duration,
    LocalDateTime,
    ZoneId,
    ZonedDateTime,
} from "@js-joda/core";
import "@js-joda/timezone";
import { parse as parseHTML } from "node-html-parser";
import type { HTMLElement } from "node-html-parser";
import {
    IRipper,
    Ripper,
    RipperCalendar,
    RipperCalendarEvent,
    RipperError,
} from "../../lib/config/schema.js";
import { getFetchForConfig } from "../../lib/config/proxy-fetch.js";

const VENUE_ADDRESS = "3400 Main St, Houston, TX 77002";
const BASE_URL = "https://matchouston.org";

function slugify(s: string): string {
    return s
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "");
}

/**
 * Extract the ISO8601 datetime string from an event element.
 * Format: 2026-07-02T19:30:00-05:00
 */
function extractDateTime(eventEl: HTMLElement): string | null {
    // Look for span with dc:date content attribute
    const dateSpans = eventEl.querySelectorAll("span[property='dc:date']");
    if (dateSpans.length === 0) {
        return null;
    }
    const content = dateSpans[0]?.getAttribute("content");
    return content || null;
}

/**
 * Extract event title from the event element.
 */
function extractEventTitle(eventEl: HTMLElement): string | null {
    // Look for h1 with field-content class containing the event title link
    const titleEls = eventEl.querySelectorAll("h1.field-content a");
    if (titleEls.length === 0) {
        return null;
    }
    return titleEls[0]?.text.trim() || null;
}

/**
 * Extract event URL path from the event element.
 */
function extractEventUrl(eventEl: HTMLElement): string | null {
    // Look for h1 with field-content class containing the event title link
    const titleEls = eventEl.querySelectorAll("h1.field-content a");
    if (titleEls.length === 0) {
        return null;
    }
    return titleEls[0]?.getAttribute("href") || null;
}

/**
 * Parse a date string and create an event ID.
 * Format expected: 2026-07-02T19:30:00-05:00
 */
function createEventId(title: string, dateTimeStr: string): string {
    // Extract just the date part (YYYY-MM-DD) from ISO8601
    const datePart = dateTimeStr.split("T")[0] || dateTimeStr;
    return `${slugify(title)}-${datePart}`;
}

/**
 * Parse ISO8601 datetime string and return as ZonedDateTime.
 * Assumes America/Chicago timezone.
 */
function parseDateTime(isoStr: string, tz: ZoneId): ZonedDateTime | null {
    try {
        // Parse ISO8601 string: 2026-07-02T19:30:00-05:00
        // Use the built-in Date parsing and convert to ZonedDateTime
        const dateObj = new Date(isoStr);
        const offset = dateObj.getTimezoneOffset();

        // Extract time components from ISO string
        const match = isoStr.match(/(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})/);
        if (!match) {
            return null;
        }

        const year = parseInt(match[1]!, 10);
        const month = parseInt(match[2]!, 10);
        const day = parseInt(match[3]!, 10);
        const hour = parseInt(match[4]!, 10);
        const minute = parseInt(match[5]!, 10);
        const second = parseInt(match[6]!, 10);

        const localDT = LocalDateTime.of(year, month, day, hour, minute, second);
        return ZonedDateTime.of(localDT, tz);
    } catch {
        return null;
    }
}

export default class MatchHoustonRipper implements IRipper {
    public async rip(ripper: Ripper): Promise<RipperCalendar[]> {
        const fetchFn = getFetchForConfig(ripper.config);
        const cal = ripper.config.calendars[0]!;
        const tz = ZoneId.of(cal.timezone.id());

        const events: RipperCalendarEvent[] = [];
        const errors: RipperError[] = [];
        const seenEventIds = new Set<string>();

        // Fetch multiple months to get a reasonable event sample
        // Start from June 2026 and fetch next 6 months
        const startDate = new Date(2026, 5, 1); // June 2026
        const months = [];
        for (let i = 0; i < 6; i++) {
            const d = new Date(startDate);
            d.setMonth(d.getMonth() + i);
            const year = d.getFullYear();
            const month = String(d.getMonth() + 1).padStart(2, "0");
            months.push(`${year}-${month}`);
        }

        // Fetch each month
        for (const monthStr of months) {
            const url = `${BASE_URL}/calendar/month/${monthStr}`;

            try {
                const res = await fetchFn(url, {
                    headers: {
                        "User-Agent": "Mozilla/5.0 (compatible; 832events/1.0)",
                    },
                });

                if (!res.ok) {
                    errors.push({
                        type: "ParseError",
                        reason: `Failed to fetch month ${monthStr}: HTTP ${res.status}`,
                        context: monthStr,
                    });
                    continue;
                }

                const html = await res.text();
                const root = parseHTML(html);

                // Find all calendar event divs
                // Structure: <div class="calendar monthview"> contains event data
                const eventContainers = root.querySelectorAll(
                    "div.calendar.monthview",
                );

                for (const container of eventContainers) {
                    const dateEl = container.querySelector(
                        "span[property='dc:date']",
                    );
                    if (!dateEl) {
                        continue;
                    }

                    const dateTimeStr = dateEl.getAttribute("content");
                    if (!dateTimeStr) {
                        continue;
                    }

                    // Extract title from h1.field-content a within this container
                    const titleEl = container.querySelector(
                        "h1.field-content a",
                    );
                    const title = titleEl?.text.trim();

                    if (!title) {
                        errors.push({
                            type: "ParseError",
                            reason: "Missing event title",
                            context: dateTimeStr,
                        });
                        continue;
                    }

                    const eventId = createEventId(title, dateTimeStr);

                    // Skip duplicates (same event on multiple dates in month view)
                    if (seenEventIds.has(eventId)) {
                        continue;
                    }
                    seenEventIds.add(eventId);

                    // Parse datetime
                    const date = parseDateTime(dateTimeStr, tz);
                    if (!date) {
                        errors.push({
                            type: "ParseError",
                            reason: `Cannot parse datetime: ${dateTimeStr}`,
                            context: title,
                        });
                        continue;
                    }

                    // Default duration: assume most events are 2 hours
                    const duration = Duration.ofHours(2);

                    const event: RipperCalendarEvent = {
                        id: eventId,
                        ripped: new Date(),
                        date,
                        duration,
                        summary: title,
                        location: VENUE_ADDRESS,
                    };

                    events.push(event);
                }
            } catch (err) {
                errors.push({
                    type: "ParseError",
                    reason: `Exception fetching ${monthStr}: ${err instanceof Error ? err.message : String(err)}`,
                    context: monthStr,
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
