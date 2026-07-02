/**
 * Ripper for The DeLUXE Theater Houston (https://thedeluxetheater.com/)
 *
 * The site uses WordPress with Modern Events Calendar plugin. Event data is
 * available via the WordPress REST API at:
 * https://thedeluxetheater.com/wp-json/wp/v2/mec-events
 *
 * Each event is a post of type "mec-events" with event timing and location
 * details embedded in the page content. The event date/time are extracted
 * from the rendered HTML of each event's single page.
 *
 * The venue is at 3303 Lyons Ave, Houston, TX 77020 (Fifth Ward).
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
import { getFetchForConfig, type FetchFn } from "../../lib/config/proxy-fetch.js";

const VENUE_ADDRESS = "3303 Lyons Ave Houston, TX 77020";
const REST_API_URL = "https://thedeluxetheater.com/wp-json/wp/v2/mec-events";
const PER_PAGE = 100;

function slugify(s: string): string {
    return s
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "");
}

/**
 * Parse a date string like "Jun 25 2026" into LocalDate.
 */
function parseEventDate(dateStr: string): LocalDate | null {
    // Format: "Jun 25 2026" or "June 25 2026"
    const match = dateStr.match(/([a-z]+)\s+(\d{1,2})\s+(\d{4})/i);
    if (!match) {
        return null;
    }

    const monthAbbr: Record<string, number> = {
        jan: 1, january: 1,
        feb: 2, february: 2,
        mar: 3, march: 3,
        apr: 4, april: 4,
        may: 5,
        jun: 6, june: 6,
        jul: 7, july: 7,
        aug: 8, august: 8,
        sep: 9, sept: 9, september: 9,
        oct: 10, october: 10,
        nov: 11, november: 11,
        dec: 12, december: 12,
    };

    const monthName = match[1]!.toLowerCase();
    const day = parseInt(match[2]!, 10);
    const year = parseInt(match[3]!, 10);

    const month = monthAbbr[monthName];
    if (!month) {
        return null;
    }

    try {
        return LocalDate.of(year, month, day);
    } catch {
        return null;
    }
}

/**
 * Parse a time string like "6:00 pm - 9:00 pm" or "2:30 pm" into LocalTime.
 * Returns the start time.
 */
function parseEventTime(timeStr: string): LocalTime | null {
    // Extract first time: "6:00 pm" or "2:30 pm"
    const match = timeStr.match(/(\d{1,2}):(\d{2})\s*(am|pm)/i);
    if (!match) {
        return null;
    }

    let hour = parseInt(match[1]!, 10);
    const minute = parseInt(match[2]!, 10);
    const meridiem = match[3]!.toLowerCase();

    // Convert to 24-hour format
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
 * Parse a time range like "6:00 pm - 9:00 pm" and extract duration.
 * Returns duration in hours, or null if cannot parse.
 */
function parseEventDuration(timeStr: string): Duration | null {
    // Extract both times: "6:00 pm - 9:00 pm"
    const match = timeStr.match(
        /(\d{1,2}):(\d{2})\s*(am|pm)\s*-\s*(\d{1,2}):(\d{2})\s*(am|pm)/i
    );
    if (!match) {
        // If we can't parse a range, default to 2 hours
        return Duration.ofHours(2);
    }

    let startHour = parseInt(match[1]!, 10);
    const startMinute = parseInt(match[2]!, 10);
    const startMeridiem = match[3]!.toLowerCase();

    let endHour = parseInt(match[4]!, 10);
    const endMinute = parseInt(match[5]!, 10);
    const endMeridiem = match[6]!.toLowerCase();

    // Convert to 24-hour format
    if (startMeridiem === "pm" && startHour !== 12) {
        startHour += 12;
    } else if (startMeridiem === "am" && startHour === 12) {
        startHour = 0;
    }

    if (endMeridiem === "pm" && endHour !== 12) {
        endHour += 12;
    } else if (endMeridiem === "am" && endHour === 12) {
        endHour = 0;
    }

    // Calculate minutes from start to end
    const startMinutes = startHour * 60 + startMinute;
    let endMinutes = endHour * 60 + endMinute;

    // If end time is earlier than start time, it's next day
    if (endMinutes <= startMinutes) {
        endMinutes += 24 * 60;
    }

    const durationMinutes = endMinutes - startMinutes;
    return Duration.ofMinutes(durationMinutes);
}

/**
 * Fetch a single event page and extract date/time details.
 */
async function fetchEventDetails(
    eventId: number,
    eventLink: string,
    eventTitle: string,
    fetchFn: FetchFn,
    tz: ZoneId
): Promise<RipperCalendarEvent | RipperError | null> {
    try {
        const res = await fetchFn(eventLink, {
            headers: {
                "User-Agent": "Mozilla/5.0 (compatible; 832events/1.0)",
            },
        });

        if (!res.ok) {
            return {
                type: "ParseError",
                reason: `Failed to fetch event ${eventId}: HTTP ${res.status}`,
                context: eventLink,
            };
        }

        const html = await res.text();
        const root = parse(html);

        // Find the date element: <span class="mec-start-date-label">
        const dateEl = root.querySelector(".mec-start-date-label");
        const dateStr = dateEl?.text.trim();

        if (!dateStr) {
            return {
                type: "ParseError",
                reason: `Could not find event date for event ${eventId}`,
                context: eventLink,
            };
        }

        const eventDate = parseEventDate(dateStr);
        if (!eventDate) {
            return {
                type: "ParseError",
                reason: `Could not parse event date: "${dateStr}"`,
                context: eventLink,
            };
        }

        // Find the time element: <abbr class="mec-events-abbr"> inside .mec-single-event-time
        let timeStr = "";
        const timeSection = root.querySelector(".mec-single-event-time");
        if (timeSection) {
            const abbr = timeSection.querySelector("abbr");
            if (abbr) {
                timeStr = abbr.text.trim();
            }
        }

        // Use the title from REST API
        const title = eventTitle;

        // If no time found, default to 7:00 PM
        let startTime = LocalTime.of(19, 0);
        if (timeStr) {
            const parsed = parseEventTime(timeStr);
            if (parsed) {
                startTime = parsed;
            }
        }

        const localDT = LocalDateTime.of(eventDate, startTime);
        const date = ZonedDateTime.of(localDT, tz);

        // Extract duration from time range
        let duration = Duration.ofHours(2); // Default
        if (timeStr) {
            const parsed = parseEventDuration(timeStr);
            if (parsed) {
                duration = parsed;
            }
        }

        // Extract description/excerpt
        let description = "";
        const contentEl = root.querySelector(".mec-single-event-description");
        if (contentEl) {
            const text = contentEl.text.substring(0, 300).trim();
            description = text;
        }

        // Extract image
        let imageUrl: string | undefined;
        const imgEl = root.querySelector(".mec-events-event-image img");
        if (imgEl) {
            imageUrl = imgEl.getAttribute("src") || undefined;
        }

        const id = `${slugify(title)}-${eventDate.toString()}`;

        const event: RipperCalendarEvent = {
            id,
            ripped: new Date(),
            date,
            duration,
            summary: title,
            location: VENUE_ADDRESS,
            description: description || undefined,
            imageUrl,
            url: eventLink,
        };

        return event;
    } catch (e) {
        return {
            type: "ParseError",
            reason: `Exception fetching event ${eventId}: ${e instanceof Error ? e.message : String(e)}`,
            context: eventLink,
        };
    }
}

export default class TheDeLuxeTheaterRipper implements IRipper {
    public async rip(ripper: Ripper): Promise<RipperCalendar[]> {
        const fetchFn = getFetchForConfig(ripper.config);
        const cal = ripper.config.calendars[0]!;
        const tz = ZoneId.of(cal.timezone.id());

        const events: RipperCalendarEvent[] = [];
        const errors: RipperError[] = [];

        // Fetch all events via REST API pagination
        let page = 1;
        let hasMore = true;

        while (hasMore) {
            const url = `${REST_API_URL}?page=${page}&per_page=${PER_PAGE}`;

            try {
                const res = await fetchFn(url, {
                    headers: {
                        "User-Agent": "Mozilla/5.0 (compatible; 832events/1.0)",
                    },
                });

                if (!res.ok) {
                    // HTTP 400 typically means we've requested beyond available pages
                    if (res.status === 400 && page > 1) {
                        hasMore = false;
                        break;
                    }
                    errors.push({
                        type: "ParseError",
                        reason: `Failed to fetch events page ${page}: HTTP ${res.status}`,
                        context: url,
                    });
                    break;
                }

                const eventPosts = await res.json();

                if (!Array.isArray(eventPosts)) {
                    errors.push({
                        type: "ParseError",
                        reason: "REST API did not return an array",
                        context: url,
                    });
                    break;
                }

                if (eventPosts.length === 0) {
                    hasMore = false;
                    break;
                }

                // Fetch details for each event post
                for (const post of eventPosts) {
                    const eventLink = post.link;
                    const eventTitle = post.title?.rendered || `Event ${post.id}`;

                    if (!eventLink) {
                        errors.push({
                            type: "ParseError",
                            reason: `Event post ${post.id} missing link field`,
                            context: JSON.stringify(post).slice(0, 100),
                        });
                        continue;
                    }

                    const result = await fetchEventDetails(
                        post.id,
                        eventLink,
                        eventTitle,
                        fetchFn,
                        tz
                    );

                    if (result === null) {
                        // Skip silently
                        continue;
                    } else if ("date" in result) {
                        events.push(result);
                    } else {
                        errors.push(result);
                    }
                }

                page++;
            } catch (e) {
                errors.push({
                    type: "ParseError",
                    reason: `Exception fetching page ${page}: ${e instanceof Error ? e.message : String(e)}`,
                    context: undefined,
                });
                break;
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
