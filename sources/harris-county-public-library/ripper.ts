/**
 * Ripper for Harris County Public Library Events (BiblioCommons platform)
 * https://hcpl.bibliocommons.com/v2/events
 *
 * This calendar aggregates events from 26+ Houston-area library branches.
 * The page uses a React frontend with server-rendered event items. Events
 * are displayed as list items with classes:
 *   - `.cp-events-search-item` - event container
 *   - `.cp-event-title` - event title (inside an <a> link)
 *   - `.cp-event-date` - date/time information
 *   - `.cp-event-location-name` - branch/location name
 *   - `.cp-event-description` - event description
 *
 * The page supports pagination via query parameters (?page=N).
 * 20 events per page, 200+ pages total (4000+ events).
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
 * Generate stable event ID from source event ID and title.
 * BiblioCommons provides event IDs in the URLs; we use those as primary.
 */
function generateEventId(bibliocommonsId: string, title: string): string {
    // Use the BiblioCommons event ID as primary, with title as fallback
    // for deduplication
    const key = `${slugify(title)}-${bibliocommonsId}`;
    const hash = createHash("sha256")
        .update(key)
        .digest("hex")
        .substring(0, 8);
    return `hcpl-${hash}`;
}

/**
 * Parse a date range string like "from January 5, 2026 to December 31, 2026"
 * or "Tuesday, August 11"
 * Returns a tuple of [startDate, endDate] or [startDate, null] for single dates.
 */
function parseDateRange(dateStr: string): [LocalDate, LocalDate | null] | null {
    if (!dateStr || dateStr.trim() === "") {
        return null;
    }

    // Normalize the string
    dateStr = dateStr.trim().replace(/\s+/g, " ");

    // Handle "from Month DD, YYYY to Month DD, YYYY" format
    const fullRangeMatch = dateStr.match(
        /from\s+([A-Z][a-z]+)\s+(\d{1,2}),\s+(\d{4})\s+to\s+([A-Z][a-z]+)\s+(\d{1,2})/i
    );
    if (fullRangeMatch) {
        const startMonth = monthNameToNumber(fullRangeMatch[1]!);
        const startDay = parseInt(fullRangeMatch[2]!, 10);
        const startYear = parseInt(fullRangeMatch[3]!, 10);
        const endMonth = monthNameToNumber(fullRangeMatch[4]!);
        const endDay = parseInt(fullRangeMatch[5]!, 10);

        if (startMonth && endMonth) {
            try {
                const startDate = LocalDate.of(startYear, startMonth, startDay);
                const endDate = LocalDate.of(startYear, endMonth, endDay);
                return [startDate, endDate];
            } catch {
                // Fall through
            }
        }
    }

    // Handle single date like "Tuesday, August 11" (current year)
    const singleDateMatch = dateStr.match(
        /(?:Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)?,?\s*([A-Z][a-z]+)\s+(\d{1,2})/i
    );
    if (singleDateMatch) {
        const monthStr = singleDateMatch[1]!;
        const day = parseInt(singleDateMatch[2]!, 10);
        const month = monthNameToNumber(monthStr);

        if (month) {
            try {
                // Assume current or next year
                let year = LocalDate.now().year();
                let startDate = LocalDate.of(year, month, day);

                // If the date is in the past, try next year
                if (startDate.isBefore(LocalDate.now())) {
                    startDate = LocalDate.of(year + 1, month, day);
                }

                return [startDate, null];
            } catch {
                // Fall through
            }
        }
    }

    // Fallback: try to parse any "Month DD" format
    const monthDayMatch = dateStr.match(/([A-Z][a-z]+)\s+(\d{1,2})/i);
    if (monthDayMatch) {
        const monthStr = monthDayMatch[1]!;
        const day = parseInt(monthDayMatch[2]!, 10);
        const month = monthNameToNumber(monthStr);

        if (month) {
            try {
                const year = LocalDate.now().year();
                const startDate = LocalDate.of(year, month, day);
                return [startDate, null];
            } catch {
                // Fall through
            }
        }
    }

    return null;
}

/**
 * Convert month name to number (1-12).
 */
function monthNameToNumber(monthStr: string): number | null {
    const monthMap: Record<string, number> = {
        january: 1, february: 2, march: 3, april: 4, may: 5, june: 6,
        july: 7, august: 8, september: 9, october: 10, november: 11, december: 12,
        jan: 1, feb: 2, mar: 3, apr: 4, jun: 6, jul: 7, aug: 8,
        sep: 9, sept: 9, oct: 10, nov: 11, dec: 12,
    };
    return monthMap[monthStr.toLowerCase()] || null;
}

/**
 * Extract time from time string like "8:00 PM" or "8:00-9:00 AM"
 * Returns [startTime, duration] or null if not parseable.
 */
function parseTime(timeStr: string | null): [LocalTime, Duration] | null {
    if (!timeStr) {
        return null;
    }

    timeStr = timeStr.trim().toLowerCase().replace(/\./g, "");

    // Try "H:MM AM/PM" or "H:MM - H:MM AM/PM"
    const match = timeStr.match(
        /(\d{1,2}):(\d{2})\s*(am|pm)?(?:\s*-\s*(\d{1,2}):(\d{2})\s*(am|pm)?)?/
    );
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
        const minutes = startTime.until(endTime, require("@js-joda/core").ChronoUnit.MINUTES);
        return [startTime, Duration.ofMinutes(minutes)];
    }

    return [startTime, Duration.ofHours(1)]; // Default 1 hour
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

/**
 * Extract text content from HTML element, handling nested tags.
 */
function getTextContent(element: HTMLElement | null): string {
    if (!element) return "";
    return element.textContent?.trim() || "";
}

/**
 * Clean HTML entities and extra whitespace from text.
 */
function cleanText(text: string): string {
    return text
        .replace(/&[a-z]+;/gi, " ") // Remove HTML entities
        .replace(/\s+/g, " ") // Collapse whitespace
        .trim();
}

export default class HarrisCountyPublicLibraryRipper implements IRipper {
    public async rip(ripper: Ripper): Promise<RipperCalendar[]> {
        const fetchFn = getFetchForConfig(ripper.config);
        const cal = ripper.config.calendars[0]!;
        const tz = ZoneId.of(cal.timezone.id());

        const baseUrl = ripper.config.url.toString();
        const events: RipperCalendarEvent[] = [];
        const errors: RipperError[] = [];

        // Fetch multiple pages (up to 10 pages to get a good sample)
        const maxPages = 10;
        for (let page = 1; page <= maxPages; page++) {
            try {
                const url = `${baseUrl}?page=${page}`;
                const res = await fetchFn(url, {
                    headers: {
                        "User-Agent": "Mozilla/5.0 (compatible; 832events/1.0)",
                    },
                });

                if (!res.ok) {
                    if (res.status === 404) {
                        // End of pagination
                        break;
                    }
                    throw new Error(
                        `Harris County Library events page ${page} failed: HTTP ${res.status} ${res.statusText}`
                    );
                }

                const html = await res.text();
                const root = parse(html);

                // Find all event items: <div class="cp-events-search-item">
                const eventItems = root.querySelectorAll(".cp-events-search-item");

                if (eventItems.length === 0) {
                    // No events on this page, stop pagination
                    break;
                }

                for (const item of eventItems) {
                    const result = this.parseEvent(item, tz);
                    if (result.error) {
                        errors.push(result.error);
                    } else if (result.event) {
                        events.push(result.event);
                    }
                }

                // If we got fewer than 20 events, this might be the last page
                if (eventItems.length < 20) {
                    break;
                }
            } catch (err) {
                errors.push({
                    type: "ParseError",
                    reason: `Error fetching page ${page}: ${err instanceof Error ? err.message : String(err)}`,
                    context: `URL: ${baseUrl}?page=${page}`,
                });
                break; // Stop pagination on error
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

    /**
     * Parse a single event element.
     */
    private parseEvent(
        item: HTMLElement,
        tz: ZoneId
    ): { event?: RipperCalendarEvent; error?: RipperError } {
        try {
            // Extract title from the event link
            const titleLink = item.querySelector(
                ".cp-event-title a[data-key='event-link']"
            );
            if (!titleLink) {
                return {
                    error: {
                        type: "ParseError",
                        reason: "Missing event title link",
                        context: "Expected .cp-event-title a[data-key='event-link']",
                    },
                };
            }

            const title = cleanText(titleLink.textContent || "");
            if (!title) {
                return {
                    error: {
                        type: "ParseError",
                        reason: "Empty event title",
                        context: "Element found but no text content",
                    },
                };
            }

            // Extract BiblioCommons event ID from URL
            const href = titleLink.getAttribute("href") || "";
            const biblioIdMatch = href.match(/\/events\/([a-f0-9]+)/);
            const biblioId = biblioIdMatch ? biblioIdMatch[1]! : "";

            if (!biblioId) {
                return {
                    error: {
                        type: "ParseError",
                        reason: "Missing BiblioCommons event ID from URL",
                        context: `URL: ${href}`,
                    },
                };
            }

            // Extract date/time information
            const dateElement = item.querySelector(".cp-event-date");
            let dateStr = "";
            let timeStr = "";

            if (dateElement) {
                const dateTimeSpan = dateElement.querySelector(".cp-event-date-time");
                if (dateTimeSpan) {
                    const fullText = cleanText(dateTimeSpan.textContent || "");
                    // Split "All day, Monday, January 05 to Thursday, December 31" into time and date parts
                    if (fullText.includes("All day")) {
                        timeStr = "all-day";
                        dateStr = fullText.replace(/All day,?\s*/, "").trim();
                    } else {
                        // For specific times like "8:00 PM, Tuesday, August 11"
                        const timeMatch = fullText.match(
                            /(\d{1,2}:\d{2}\s*(?:am|pm|AM|PM)(?:\s*-\s*\d{1,2}:\d{2}\s*(?:am|pm|AM|PM))?)/
                        );
                        if (timeMatch) {
                            timeStr = timeMatch[1]!;
                            dateStr = fullText.replace(timeStr, "").replace(/[,\s]+/g, " ").trim();
                        } else {
                            dateStr = fullText;
                        }
                    }
                }
            }

            if (!dateStr) {
                return {
                    error: {
                        type: "ParseError",
                        reason: "Could not extract date information",
                        context: `Title: ${title}`,
                    },
                };
            }

            // Parse the date
            const dateRange = parseDateRange(dateStr);
            if (!dateRange) {
                return {
                    error: {
                        type: "ParseError",
                        reason: `Cannot parse date string: "${dateStr}"`,
                        context: `Title: ${title}`,
                    },
                };
            }

            const [startDate, _endDate] = dateRange;

            // Parse time if present
            let startTime = LocalTime.of(10, 0); // Default 10 AM
            let duration = Duration.ofHours(2); // Default 2 hours

            if (timeStr && timeStr !== "all-day") {
                const timeInfo = parseTime(timeStr);
                if (timeInfo) {
                    [startTime, duration] = timeInfo;
                }
            } else if (timeStr === "all-day") {
                duration = Duration.ofHours(24); // All-day events
            }

            // Create ZonedDateTime
            const localDT = LocalDateTime.of(startDate, startTime);
            const zonedDT = ZonedDateTime.of(localDT, tz);

            // Extract location from the aria-hidden span (not the screen-reader message)
            const locationElement = item.querySelector(".cp-event-location-name");
            let location = "";
            if (locationElement) {
                const locationSpan = locationElement.querySelector("span[aria-hidden='true']");
                if (locationSpan) {
                    location = cleanText(locationSpan.textContent || "");
                }
            }

            // Extract description
            const descElement = item.querySelector(".cp-event-description");
            let description = "";
            if (descElement) {
                description = cleanText(descElement.textContent || "");
            }

            // Generate stable event ID
            const eventId = generateEventId(biblioId, title);

            // Create event object
            const event: RipperCalendarEvent = {
                id: eventId,
                summary: title,
                date: zonedDT,
                duration,
                location: location || undefined,
                description: description || undefined,
                url: href || undefined,
                ripped: new Date(),
            };

            return { event };
        } catch (err) {
            return {
                error: {
                    type: "ParseError",
                    reason: `Exception processing event: ${
                        err instanceof Error ? err.message : String(err)
                    }`,
                    context: `Item: ${item.toString().substring(0, 100)}`,
                },
            };
        }
    }
}
