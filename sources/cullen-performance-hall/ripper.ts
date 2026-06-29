/**
 * Ripper for Cullen Performance Hall (https://www.uh.edu/cullen-performance-hall/about-us/event-calendar/)
 *
 * The calendar page uses a simple HTML table structure:
 * - Table rows with <td> elements containing: event title, day of week, date, time
 * - Dates are formatted as month abbreviations (e.g., "July 6", "Aug. 5", "Sept. 26")
 * - Times are in format like "8 a.m.", "7 p.m.", "7:30 p.m.", "7:45 a.m."
 * - Some event titles may include ticket links
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
} from "../../lib/config/schema.js";
import { getFetchForConfig } from "../../lib/config/proxy-fetch.js";

const VENUE_ADDRESS = "Cullen Performance Hall, 4400 University Drive, Houston, TX 77004";
const VENUE_NAME = "Cullen Performance Hall";

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
 * Month abbreviation/name to number mapping.
 */
const monthMap: Record<string, number> = {
    january: 1,
    february: 2,
    march: 3,
    april: 4,
    may: 5,
    june: 6,
    july: 7,
    august: 8,
    september: 9,
    october: 10,
    november: 11,
    december: 12,
    jan: 1,
    feb: 2,
    mar: 3,
    apr: 4,
    jun: 6,
    jul: 7,
    aug: 8,
    sep: 9,
    sept: 9,
    oct: 10,
    nov: 11,
    dec: 12,
};

/**
 * Parse a month string (name or abbreviation) to number.
 */
function monthToNumber(monthStr: string): number | null {
    return monthMap[monthStr.toLowerCase()] || null;
}

/**
 * Parse time string like "8 a.m.", "7 p.m.", "7:30 p.m.", "7:45 a.m."
 * Returns [hour, minute] or null if unparseable.
 */
function parseTime(timeStr: string): [number, number] | null {
    const match = timeStr.match(/(\d{1,2})(?::(\d{2}))?\s*(a\.m\.|p\.m\.)/i);
    if (!match) {
        return null;
    }

    let hour = parseInt(match[1]!, 10);
    const minute = match[2] ? parseInt(match[2], 10) : 0;
    const period = match[3]!.toLowerCase();

    // Convert to 24-hour format
    if (period.startsWith("p") && hour !== 12) {
        hour += 12;
    } else if (period.startsWith("a") && hour === 12) {
        hour = 0;
    }

    return [hour, minute];
}

/**
 * Parse date string like "July 6", "July 12", "Sept. 26", "Aug. 5", "Nov. 21"
 * Returns [month, day] or null if unparseable.
 */
function parseDate(dateStr: string): [number, number] | null {
    // Match month (with optional period) and day number
    const match = dateStr.match(/([A-Z][a-z]+)\.?\s+(\d{1,2})/);
    if (!match) {
        return null;
    }

    const monthStr = match[1]!;
    const day = parseInt(match[2]!, 10);
    const month = monthToNumber(monthStr);

    if (!month || day < 1 || day > 31) {
        return null;
    }

    return [month, day];
}

/**
 * Infer the year from the month/day. If the date is in the past, assume next year.
 */
function inferYear(month: number, day: number, now: LocalDateTime): number {
    const today = now.toLocalDate();
    const thisYearDate = LocalDate.of(today.year(), month, day);

    // If the date is more than 7 days in the past, assume next year
    const daysDiff =
        (thisYearDate.toEpochDay() - today.toEpochDay()) / 1;
    if (daysDiff < -7) {
        return today.year() + 1;
    }

    return today.year();
}

/**
 * Extract title from cell text, removing ticket links if present.
 */
function extractTitle(cellHtml: string): string | null {
    // Remove any anchor tags and their content (e.g., <a href="...">Tickets</a>)
    let title = cellHtml.replace(/<a[^>]*>.*?<\/a>/gi, "").trim();

    // Remove any remaining HTML tags
    title = title.replace(/<[^>]*>/g, "").trim();

    // Remove empty parentheses or parentheses with just whitespace/ticket info
    title = title.replace(/\s*\(\s*[Tt]ickets?\s*\)\s*/g, " ").trim();
    title = title.replace(/\s*\(\s*\)\s*/g, " ").trim();

    // Clean up any trailing spaces and punctuation after link removal
    title = title.replace(/\s+/g, " ").trim();

    if (!title) {
        return null;
    }

    return title;
}

export default class CullenPerformanceHallRipper implements IRipper {
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
                `Cullen Performance Hall fetch failed: HTTP ${res.status} ${res.statusText}`
            );
        }

        const html = await res.text();
        const dom = parse(html);

        const events: RipperCalendarEvent[] = [];
        const errors: RipperError[] = [];

        const now = LocalDateTime.now();

        // Find the events table
        const table = dom.querySelector("table.table");
        if (!table) {
            errors.push({
                type: "ParseError",
                reason: "Could not find event table",
                context: undefined,
            });
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

        const rows = table.querySelectorAll("tbody tr");
        const seenIds = new Set<string>();

        for (const row of rows) {
            try {
                const cells = row.querySelectorAll("td");
                if (cells.length < 4) {
                    // Skip header rows or malformed rows
                    continue;
                }

                // Extract fields from the cells
                const titleCell = cells[0]?.text || "";
                const dayOfWeekCell = cells[1]?.text || "";
                const dateCell = cells[2]?.text || "";
                const timeCell = cells[3]?.text || "";

                // Skip section header rows (like "2026 Events")
                if (!titleCell || titleCell.includes("Events") || !dateCell) {
                    continue;
                }

                // Parse date
                const parsedDate = parseDate(dateCell.trim());
                if (!parsedDate) {
                    errors.push({
                        type: "ParseError",
                        reason: `Could not parse date: "${dateCell}"`,
                        context: titleCell,
                    });
                    continue;
                }

                const [month, day] = parsedDate;
                const year = inferYear(month, day, now);
                let eventDate: LocalDate;
                try {
                    eventDate = LocalDate.of(year, month, day);
                } catch (e) {
                    errors.push({
                        type: "ParseError",
                        reason: `Invalid date: ${year}-${month}-${day}`,
                        context: titleCell,
                    });
                    continue;
                }

                // Parse time
                const parsedTime = parseTime(timeCell.trim());
                if (!parsedTime) {
                    errors.push({
                        type: "ParseError",
                        reason: `Could not parse time: "${timeCell}"`,
                        context: titleCell,
                    });
                    continue;
                }

                const [hour, minute] = parsedTime;
                const eventTime = LocalTime.of(hour, minute);
                const eventDateTime = LocalDateTime.of(eventDate, eventTime);
                const zonedDateTime = ZonedDateTime.of(eventDateTime, tz);

                // Extract title (remove HTML tags and ticket links)
                const titleHtml = cells[0]!.innerHTML;
                const title = extractTitle(titleHtml);
                if (!title) {
                    errors.push({
                        type: "ParseError",
                        reason: "Could not extract event title",
                        context: titleHtml,
                    });
                    continue;
                }

                // Create stable ID from title and date
                const id = `${slugify(title)}-${eventDate.toString()}`;

                // Skip duplicates
                if (seenIds.has(id)) {
                    continue;
                }
                seenIds.add(id);

                // Default duration to 2 hours
                const duration = Duration.ofHours(2);

                const event: RipperCalendarEvent = {
                    id,
                    ripped: new Date(),
                    date: zonedDateTime,
                    duration,
                    summary: title,
                    location: VENUE_ADDRESS,
                };

                events.push(event);
            } catch (e) {
                errors.push({
                    type: "ParseError",
                    reason: `Failed to parse event row: ${
                        e instanceof Error ? e.message : String(e)
                    }`,
                    context: undefined,
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
