/**
 * Ripper for Houston Zoo (https://www.houstonzoo.org/plan-your-visit/calendar/)
 *
 * The calendar page lists events as server-rendered HTML. Each event is an
 * <li class="eventItem"> with:
 *   - data-date attribute: ISO date (YYYY-MM-DD) — the start date
 *   - Title: h2 > a inside .textColumn
 *   - Date string: span.date inside .textColumn (e.g., "March 6 - September 7" or "Saturday, July 4, 8:00-9:00 a.m.")
 *   - Image: figure.lazythumb > img[data-src] inside .imgColumn
 *   - URL: href on the title link
 *
 * The ripper parses the date string to extract start date, end date, and time.
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
    ParseError,
} from "../../lib/config/schema.js";
import { getFetchForConfig } from "../../lib/config/proxy-fetch.js";
import { createHash } from "crypto";

const VENUE_ADDRESS = "6200 Hermann Park Drive, Houston, TX 77030";

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
 * Generate stable event ID from title and date.
 */
function hashEventId(title: string, dateStr: string): string {
    const key = `${slugify(title)}-${dateStr}`;
    const hash = createHash("sha256")
        .update(key)
        .digest("hex")
        .substring(0, 8);
    return `${key}-${hash}`;
}

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
 * Parse a single date in the format "Month DD" or "Day, Month DD".
 * Returns [month, day] or null if unparseable.
 */
function parseSingleDate(dateStr: string): [number, number] | null {
    // Try patterns like "March 6", "Mar 6", "Saturday, June 27", "Friday, July 4"
    const match = dateStr.match(/(?:Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)?,?\s*([A-Z][a-z]+)\s+(\d{1,2})/i);
    if (!match) {
        return null;
    }
    const monthStr = match[1]!;
    const day = parseInt(match[2]!, 10);
    const month = monthToNumber(monthStr);
    if (!month) {
        return null;
    }
    return [month, day];
}

/**
 * Parse a date range string from the calendar.
 * Formats:
 *   - "March 6 - September 7" (single year span)
 *   - "Saturday, June 27" (single day)
 *   - "July 3 - July 5, 2026" (with year)
 *   - "Saturday, July 4, 8:00-9:00 a.m." (with time)
 *
 * Returns: { startDate: LocalDate, endDate: LocalDate | null, timeStr: string | null }
 */
function parseDateRange(dateStr: string, dataDateAttr: string): {
    startDate: LocalDate | null;
    endDate: LocalDate | null;
    timeStr: string | null;
} {
    // Extract year from the string if present (e.g., "2026" from "July 3 - July 5, 2026")
    const yearMatch = dateStr.match(/,?\s*(\d{4})\b/);
    const year = yearMatch ? parseInt(yearMatch[1]!, 10) : LocalDate.now().year();

    // Extract time if present (e.g., "8:00-9:00 a.m." or "8:00 a.m.")
    const timeMatch = dateStr.match(/(\d{1,2}:\d{2}(?:\s*-\s*\d{1,2}:\d{2})?\s*(?:a\.?m\.?|p\.?m\.?))/i);
    const timeStr = timeMatch ? timeMatch[1]! : null;

    // Remove time and year from the string for date parsing
    let cleanedStr = dateStr.replace(/,?\s*\d{4}\b/, "").replace(/\d{1,2}:\d{2}(?:\s*-\s*\d{1,2}:\d{2})?\s*(?:a\.?m\.?|p\.?m\.?)/i, "").trim();

    // Try to parse as a range: "March 6 - September 7" or "July 3 - July 5"
    const rangeMatch = cleanedStr.match(/([A-Z][a-z]+)\s+(\d{1,2})\s*-\s*([A-Z][a-z]+)\s+(\d{1,2})/i);
    if (rangeMatch) {
        const startMonthStr = rangeMatch[1]!;
        const startDay = parseInt(rangeMatch[2]!, 10);
        const endMonthStr = rangeMatch[3]!;
        const endDay = parseInt(rangeMatch[4]!, 10);

        const startMonth = monthToNumber(startMonthStr);
        const endMonth = monthToNumber(endMonthStr);

        if (startMonth && endMonth) {
            try {
                const startDate = LocalDate.of(year, startMonth, startDay);
                const endDate = LocalDate.of(year, endMonth, endDay);
                return { startDate, endDate, timeStr };
            } catch {
                // Fall through to single date or data-date fallback
            }
        }
    }

    // Try to parse as a single date: "Saturday, June 27" or "June 27"
    const singleMatch = parseSingleDate(cleanedStr);
    if (singleMatch) {
        const [month, day] = singleMatch;
        try {
            let startDate = LocalDate.of(year, month, day);
            // If the date is in the past, try next year
            if (startDate.isBefore(LocalDate.now())) {
                startDate = LocalDate.of(year + 1, month, day);
            }
            return { startDate, endDate: null, timeStr };
        } catch {
            // Fall through to data-date fallback
        }
    }

    // If parsing fails, fall back to the data-date attribute
    if (dataDateAttr) {
        try {
            const startDate = LocalDate.parse(dataDateAttr);
            return { startDate, endDate: null, timeStr };
        } catch {
            // data-date is invalid too
        }
    }

    return { startDate: null, endDate: null, timeStr };
}

/**
 * Parse a time string like "8:00-9:00 a.m." or "6:30 p.m." or "8:00 a.m."
 * Returns [startTime, duration] or null if unparseable.
 */
function parseTime(timeStr: string | null): [LocalTime, Duration] | null {
    if (!timeStr) {
        return null;
    }

    const normalized = timeStr.replace(/\./g, "").toLowerCase();

    // Match "H:MM AM/PM" or "H:MM - H:MM AM/PM" or "H:MM AM/PM - H:MM PM"
    const match = normalized.match(/(\d{1,2}):(\d{2})\s*(am|pm)?(?:\s*-\s*(\d{1,2}):(\d{2})\s*(am|pm)?)?/);
    if (!match) {
        return null;
    }

    const startHour = parseInt(match[1]!, 10);
    const startMin = parseInt(match[2]!, 10);
    let startMeridiem = match[3] || "am";

    const endHourStr = match[4];
    let endTime: LocalTime | null = null;

    if (endHourStr) {
        const endHour = parseInt(endHourStr, 10);
        const endMin = parseInt(match[5]!, 10);
        const endMeridiem = match[6] || startMeridiem;

        endTime = convertTo24Hour(endHour, endMin, endMeridiem);
    }

    const startTime = convertTo24Hour(startHour, startMin, startMeridiem);

    if (endTime) {
        // Calculate duration between start and end time
        const minutes = startTime.until(endTime, ChronoUnit.MINUTES);
        return [startTime, Duration.ofMinutes(minutes)];
    } else {
        // Default 1-hour duration
        return [startTime, Duration.ofHours(1)];
    }
}

/**
 * Convert 12-hour time to 24-hour LocalTime.
 */
function convertTo24Hour(hour: number, minute: number, meridiem: string): LocalTime {
    let h = hour;
    if (meridiem.toLowerCase() === "pm" && hour !== 12) {
        h += 12;
    } else if (meridiem.toLowerCase() === "am" && hour === 12) {
        h = 0;
    }
    return LocalTime.of(h, minute);
}

export default class HoustonZooRipper implements IRipper {
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
                `Houston Zoo calendar page failed: HTTP ${res.status} ${res.statusText}`,
            );
        }

        const html = await res.text();
        const root = parse(html);

        const events: RipperCalendarEvent[] = [];
        const errors: RipperError[] = [];

        // Find all event items: <li class="eventItem">
        const eventItems = root.querySelectorAll("li.eventItem");

        for (const item of eventItems) {
            try {
                // Extract data-date attribute (the start date in ISO format)
                const dataDate = item.getAttribute("data-date") || "";

                // Extract title from .textColumn > a
                const textColumn = item.querySelector(".textColumn");
                if (!textColumn) {
                    errors.push({
                        type: "ParseError",
                        reason: "Missing .textColumn in event item",
                        context: `data-date: ${dataDate}`,
                    });
                    continue;
                }

                const titleLink = textColumn.querySelector("a");
                if (!titleLink) {
                    errors.push({
                        type: "ParseError",
                        reason: "Missing title link in .textColumn",
                        context: `data-date: ${dataDate}`,
                    });
                    continue;
                }

                const title = titleLink.textContent?.trim();
                if (!title) {
                    errors.push({
                        type: "ParseError",
                        reason: "Empty title in event",
                        context: `data-date: ${dataDate}`,
                    });
                    continue;
                }

                // Extract URL
                const url = titleLink.getAttribute("href") || "";
                if (!url.startsWith("http")) {
                    // Make absolute URL if relative
                    // The URL should already be absolute based on the fetch we saw
                }

                // Extract date string from span.date
                const dateSpan = textColumn.querySelector("span.date");
                const dateStr = dateSpan?.textContent?.trim() || "";

                if (!dateStr) {
                    errors.push({
                        type: "ParseError",
                        reason: "Missing date string for event",
                        context: `Title: ${title}`,
                    });
                    continue;
                }

                // Parse the date range
                const { startDate, endDate, timeStr } = parseDateRange(dateStr, dataDate);

                if (!startDate) {
                    errors.push({
                        type: "ParseError",
                        reason: `Cannot parse date string: "${dateStr}"`,
                        context: `Title: ${title}`,
                    });
                    continue;
                }

                // Parse time if present, otherwise use default
                const timeInfo = parseTime(timeStr);
                const time = timeInfo ? timeInfo[0] : LocalTime.of(10, 0); // Default 10 AM
                const duration = timeInfo ? timeInfo[1] : Duration.ofHours(2); // Default 2 hours

                // Create ZonedDateTime
                const localDT = LocalDateTime.of(startDate, time);
                const zonedDT = ZonedDateTime.of(localDT, tz);

                // Generate stable ID
                const eventId = hashEventId(title, startDate.toString());

                // Extract image URL
                let imageUrl: string | undefined;
                const imgColumn = item.querySelector(".imgColumn");
                if (imgColumn) {
                    const img = imgColumn.querySelector("img");
                    if (img) {
                        imageUrl = img.getAttribute("data-src") || img.getAttribute("src");
                    }
                }

                const event: RipperCalendarEvent = {
                    id: eventId,
                    summary: title,
                    date: zonedDT,
                    duration,
                    location: VENUE_ADDRESS,
                    ripped: new Date(),
                    url: url || undefined,
                    imageUrl: imageUrl || undefined,
                };

                events.push(event);
            } catch (err) {
                errors.push({
                    type: "ParseError",
                    reason: `Exception processing event: ${err instanceof Error ? err.message : String(err)}`,
                    context: `Item: ${item.toString().substring(0, 100)}`,
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
