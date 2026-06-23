/**
 * Ripper for Good on Paper Books (https://www.goodonpaperbooks.com)
 *
 * The site's events page displays events in a calendar/list view format.
 * Events are structured as articles with:
 * - Title as a link or heading
 * - Date in "Mon, M/D/YYYY" format
 * - Time in "H:MMam - H:MMpm" or "H:MMpm - H:MMpm" format
 * - Optional description/summary
 * - Location (usually the bookshop address for in-person events, or virtual for some)
 *
 * The ripper:
 * 1. Fetches the events page
 * 2. Extracts event blocks with title, date, and time
 * 3. Parses dates and times into ISO 8601 datetime strings
 * 4. Returns events with stable IDs based on title + date
 */

import {
    Duration,
    LocalDate,
    LocalDateTime,
    LocalTime,
    ZoneId,
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
import crypto from "crypto";

const VENUE_ADDRESS = "250 W 19th St Suite D, Houston, TX 77008";
const TIMEZONE = "America/Chicago";

function slugify(s: string): string {
    return s
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "");
}

export function hashEventId(title: string, dateStr: string): string {
    const key = `${slugify(title)}-${dateStr}`;
    const hash = crypto
        .createHash("sha256")
        .update(key)
        .digest("hex")
        .substring(0, 8);
    return `${key}-${hash}`;
}

/**
 * Parse time strings like "1:00pm", "7:30pm", "10:30am - 12:00pm"
 * Returns { hour, minute } or null if unparseable
 */
function parseTime(timeStr: string): { hour: number; minute: number } | null {
    // Match patterns like "1:00pm", "7:30 PM", "10:30am"
    const match = timeStr.match(/(\d{1,2}):(\d{2})\s*(am|pm)/i);
    if (!match) return null;

    let hour = parseInt(match[1], 10);
    const minute = parseInt(match[2], 10);
    const ampm = match[3].toLowerCase();

    // Convert to 24-hour format
    if (ampm === "pm" && hour !== 12) {
        hour += 12;
    } else if (ampm === "am" && hour === 12) {
        hour = 0;
    }

    return { hour, minute };
}

/**
 * Extract the start time from a time range string
 * "1:00pm - 2:00pm" -> "1:00pm"
 * "1:00 PM - 2:00 PM" -> "1:00 PM"
 */
function extractStartTime(timeStr: string): string {
    const parts = timeStr.split("-");
    return parts[0].trim();
}

/**
 * Extract the end time from a time range string
 * "1:00pm - 2:00pm" -> "2:00pm"
 */
function extractEndTime(timeStr: string): string | null {
    const parts = timeStr.split("-");
    if (parts.length >= 2) {
        return parts[1].trim();
    }
    return null;
}

/**
 * Calculate duration between start and end times in hours
 */
function calculateDuration(startTime: { hour: number; minute: number }, endTime: { hour: number; minute: number }): Duration {
    const startMinutes = startTime.hour * 60 + startTime.minute;
    const endMinutes = endTime.hour * 60 + endTime.minute;

    // Handle day wrap (e.g., 11pm to 1am)
    let diffMinutes = endMinutes - startMinutes;
    if (diffMinutes < 0) {
        diffMinutes += 24 * 60;
    }

    // Default to 2 hours if zero duration
    if (diffMinutes === 0) {
        diffMinutes = 120;
    }

    return Duration.ofMinutes(diffMinutes);
}

/**
 * Parse date string like "Mon, 6/1/2026" or "Monday, 6/1/2026"
 * Returns LocalDate or null if unparseable
 */
function parseDate(dateStr: string): LocalDate | null {
    // Match patterns like "Mon, 6/1/2026" or "Monday, June 1, 2026" or "6/1/2026"

    // First try MM/DD/YYYY format (possibly with day name prefix)
    let match = dateStr.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
    if (match) {
        const month = parseInt(match[1], 10);
        const day = parseInt(match[2], 10);
        const year = parseInt(match[3], 10);

        try {
            return LocalDate.of(year, month, day);
        } catch (e) {
            return null;
        }
    }

    return null;
}

/**
 * Extract events from the page HTML
 * The page uses Drupal with article tags containing:
 * - event-list__title: the title in an <a> tag
 * - event-list__details--item: divs with Date: and Time: labels
 */
function extractEvents(html: string): Array<{ title: string; dateStr: string; timeStr: string; description?: string }> {
    const root = parse(html);
    const events: Array<{ title: string; dateStr: string; timeStr: string; description?: string }> = [];

    // Find all article elements with class event-list
    const articles = root.querySelectorAll("article.event-list");

    for (const article of articles) {
        try {
            // Extract title from event-list__title
            const titleElement = article.querySelector(".event-list__title a");
            if (!titleElement) continue;
            const title = titleElement.textContent?.trim();
            if (!title) continue;

            // Find all event-list__details--item divs
            const detailItems = article.querySelectorAll(".event-list__details--item");
            let dateStr = "";
            let timeStr = "";

            for (const item of detailItems) {
                const labelElement = item.querySelector(".event-list__details--label");
                const label = labelElement?.textContent?.trim().toLowerCase() || "";

                // Get the text content after the label
                const itemText = item.textContent?.trim() || "";
                const valueText = itemText.substring(itemText.indexOf(label) + label.length).trim();

                if (label.includes("date")) {
                    dateStr = valueText;
                } else if (label.includes("time")) {
                    timeStr = valueText;
                }
            }

            if (dateStr && timeStr) {
                events.push({
                    title,
                    dateStr,
                    timeStr,
                });
            }
        } catch (err) {
            // Skip articles that fail to parse
            continue;
        }
    }

    return events;
}

export default class GoodOnPaperBookshopRipper implements IRipper {
    public async rip(ripper: Ripper): Promise<RipperCalendar[]> {
        const fetchFn = getFetchForConfig(ripper.config);
        const cal = ripper.config.calendars[0]!;

        // Fetch the events page
        const res = await fetchFn(ripper.config.url.toString(), {
            headers: {
                "User-Agent": "Mozilla/5.0 (compatible; 832events/1.0)",
            },
        });

        if (!res.ok) {
            throw new Error(
                `Good on Paper Bookshop events page failed: HTTP ${res.status} ${res.statusText}`,
            );
        }

        const html = await res.text();
        const eventData = extractEvents(html);

        const events: RipperCalendarEvent[] = [];
        const errors: RipperError[] = [];
        const seenEventIds = new Set<string>();

        for (const event of eventData) {
            try {
                const eventDate = parseDate(event.dateStr);
                if (!eventDate) {
                    errors.push({
                        error: true,
                        type: "ParseError",
                        reason: `Could not parse date: "${event.dateStr}"`,
                        context: `Event: ${event.title}`,
                    } as ParseError);
                    continue;
                }

                // Parse start time
                const startTimeStr = extractStartTime(event.timeStr);
                const startTime = parseTime(startTimeStr);
                if (!startTime) {
                    errors.push({
                        error: true,
                        type: "ParseError",
                        reason: `Could not parse start time: "${startTimeStr}"`,
                        context: `Event: ${event.title}`,
                    } as ParseError);
                    continue;
                }

                // Parse end time if available
                const endTimeStr = extractEndTime(event.timeStr);
                const endTime = endTimeStr ? parseTime(endTimeStr) : startTime;
                if (!endTime) {
                    errors.push({
                        error: true,
                        type: "ParseError",
                        reason: `Could not parse end time: "${endTimeStr}"`,
                        context: `Event: ${event.title}`,
                    } as ParseError);
                    continue;
                }

                // Create datetime
                const eventDateTime = LocalDateTime.of(eventDate, LocalTime.of(startTime.hour, startTime.minute));
                const zonedDateTime = eventDateTime.atZone(ZoneId.of(TIMEZONE));

                // Create stable event ID
                const eventIdKey = hashEventId(event.title, eventDate.toString());

                // Avoid duplicates
                if (seenEventIds.has(eventIdKey)) {
                    continue;
                }
                seenEventIds.add(eventIdKey);

                // Calculate duration
                const duration = calculateDuration(startTime, endTime);

                const calendarEvent: RipperCalendarEvent = {
                    id: eventIdKey,
                    summary: event.title,
                    date: zonedDateTime,
                    ripped: new Date(),
                    duration,
                    location: VENUE_ADDRESS,
                    description: event.description || "",
                    url: ripper.config.url.toString(),
                };

                events.push(calendarEvent);
            } catch (err) {
                errors.push({
                    error: true,
                    type: "ParseError",
                    reason: `Exception parsing event: ${err instanceof Error ? err.message : String(err)}`,
                    context: `Event: ${event.title}, Date: ${event.dateStr}, Time: ${event.timeStr}`,
                } as ParseError);
            }
        }

        return [
            {
                name: cal.name,
                friendlyname: cal.friendlyname || "",
                events,
                errors,
                tags: ripper.config.tags ?? [],
                parent: ripper.config,
            },
        ];
    }
}
