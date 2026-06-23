/**
 * Ripper for Doc's Jazz Club (https://tickets.docshouston.com/)
 *
 * The site uses TurnTable Tickets, a proprietary ticketing platform.
 * Event listings are server-rendered HTML without a public API or ICS feed.
 * Each event has a URL pattern: /shows/{show-id}/?date={YYYY-MM-DD}
 *
 * Events include title, date, time, and description. Pricing is behind
 * a button/modal and not readily accessible via simple HTML parsing.
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

const VENUE_ADDRESS = "1201 Westheimer Rd, Houston, TX 77006";
const VENUE_NAME = "Doc's Jazz Club";

function slugify(s: string): string {
    return s
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "");
}

/**
 * Parse a date string like "Tue, Jun 23" into a LocalDate.
 * Assumes the current year or next year if month is before today.
 */
function parseDate(dateStr: string, referenceDate: LocalDate = LocalDate.now()): LocalDate | null {
    // Format: "Tue, Jun 23" or "Tue, Jun 23, 2026"
    const match = dateStr.match(/([A-Za-z]+),?\s+([A-Za-z]+)\s+(\d{1,2})(?:,?\s+(\d{4}))?/);
    if (!match) {
        return null;
    }

    const monthName = match[2]!.toLowerCase();
    const day = parseInt(match[3]!, 10);
    const yearStr = match[4];

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

    const month = monthAbbr[monthName];
    if (!month) {
        return null;
    }

    const year = yearStr ? parseInt(yearStr, 10) : referenceDate.year();

    try {
        const date = LocalDate.of(year, month, day);
        // If the parsed date is in the past relative to reference, try next year
        if (date.isBefore(referenceDate) && !yearStr) {
            try {
                return LocalDate.of(year + 1, month, day);
            } catch {
                return date;
            }
        }
        return date;
    } catch {
        return null;
    }
}

/**
 * Parse a time string like "07:30 PM" or "7:30 PM" into LocalTime.
 */
function parseTime(timeStr: string): LocalTime | null {
    const match = timeStr.match(/(\d{1,2}):(\d{2})\s*(AM|PM)/i);
    if (!match) {
        return null;
    }

    let hour = parseInt(match[1]!, 10);
    const minute = parseInt(match[2]!, 10);
    const period = match[3]!.toUpperCase();

    if (period === "PM" && hour !== 12) {
        hour += 12;
    } else if (period === "AM" && hour === 12) {
        hour = 0;
    }

    try {
        return LocalTime.of(hour, minute);
    } catch {
        return null;
    }
}

/**
 * Parse events from HTML. Exported for testing.
 */
export function parseEvents(
    html: string,
    tz: ZoneId,
    sourceName: string
): (RipperCalendarEvent | RipperError)[] {
    const root = parse(html);
    const events: RipperCalendarEvent[] = [];
    const errors: RipperError[] = [];

    // Find all event links. TurnTable uses URLs like /shows/{id}/?date={YYYY-MM-DD}
    const eventLinks = root.querySelectorAll("a[href*='/shows/']");

    const seenIds = new Set<string>();

    for (const link of eventLinks) {
        const href = link.getAttribute("href");
        if (!href) {
            continue;
        }

        // Extract show ID and date from href
        // Pattern: /shows/{id}/?date={YYYY-MM-DD}
        const match = href.match(/\/shows\/(\d+)\/?\?date=(\d{4})-(\d{2})-(\d{2})/);
        if (!match) {
            continue;
        }

        const showId = match[1]!;
        const year = parseInt(match[2]!, 10);
        const month = parseInt(match[3]!, 10);
        const day = parseInt(match[4]!, 10);

        try {
            const eventDate = LocalDate.of(year, month, day);

            // Try to get event title from various sources
            let title = "";

            // Strategy 1: Look for h2 element that contains this link
            let current = link.parentNode;
            while (current) {
                if (current.tagName === "H2") {
                    title = current.text.trim();
                    // Remove nested h3 date info from the title
                    const h3 = current.querySelector("h3");
                    if (h3) {
                        title = title.replace(h3.text.trim(), "").trim();
                    }
                    break;
                }
                if (current.tagName === "ARTICLE" || current.tagName === "SECTION" || current.tagName === "DIV") {
                    // We've gone too far up, stop
                    break;
                }
                current = current.parentNode;
            }

            // Strategy 2: Look for h2 among siblings
            if (!title && link.parentNode) {
                const h2Sibling = link.parentNode.parentNode?.querySelector("h2");
                if (h2Sibling) {
                    title = h2Sibling.text.trim();
                    const h3 = h2Sibling.querySelector("h3");
                    if (h3) {
                        title = title.replace(h3.text.trim(), "").trim();
                    }
                }
            }

            // Strategy 3: Use link text
            if (!title) {
                title = link.text.trim();
            }

            // Fallback: use show ID
            if (!title) {
                title = `Show ${showId}`;
            }

            // Find time from the link's parent context - look for nearby span with time
            let time = LocalTime.of(19, 0); // Default to 7 PM

            // The time is typically in a span within the same event container
            // Navigate up to the common parent (article/section/div)
            let container = link.parentNode;
            while (container && container.tagName !== "article" && container.tagName !== "section" && container.parentNode) {
                container = container.parentNode;
            }

            if (container) {
                const timeSpans = container.querySelectorAll("span");
                for (const span of timeSpans) {
                    const spanText = span.text.trim();
                    if (spanText.match(/\d{1,2}:\d{2}\s*(?:AM|PM)/i)) {
                        const timeMatch = spanText.match(/(\d{1,2}):(\d{2})\s*(AM|PM)/i);
                        if (timeMatch) {
                            const parsedTime = parseTime(`${timeMatch[1]!}:${timeMatch[2]!} ${timeMatch[3]!}`);
                            if (parsedTime) {
                                time = parsedTime;
                                break;
                            }
                        }
                    }
                }

                // Fallback: search entire container text for time pattern
                if (time.hour() === 19 && time.minute() === 0) {
                    const containerText = container.text;
                    const timeMatch = containerText.match(/(\d{1,2}):(\d{2})\s*(AM|PM)/i);
                    if (timeMatch) {
                        const parsedTime = parseTime(`${timeMatch[1]!}:${timeMatch[2]!} ${timeMatch[3]!}`);
                        if (parsedTime) {
                            time = parsedTime;
                        }
                    }
                }
            }

            const localDT = LocalDateTime.of(eventDate, time);
            const zonedDT = ZonedDateTime.of(localDT, tz);

            // Create stable ID from title and date
            const id = `${slugify(title)}-${eventDate.toString()}`;

            // Skip duplicates
            if (seenIds.has(id)) {
                continue;
            }
            seenIds.add(id);

            const event: RipperCalendarEvent = {
                id,
                ripped: new Date(),
                date: zonedDT,
                duration: Duration.ofHours(3), // Typical performance duration
                summary: title,
                location: VENUE_ADDRESS,
            };

            events.push(event);
        } catch (e) {
            errors.push({
                type: "ParseError",
                reason: `Failed to parse event: ${e instanceof Error ? e.message : String(e)}`,
                context: href,
            });
        }
    }

    return [...events, ...errors];
}

export default class DocsHoustonRipper implements IRipper {
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
                `Doc's Houston fetch failed: HTTP ${res.status} ${res.statusText}`,
            );
        }

        const html = await res.text();
        const results = parseEvents(html, tz, ripper.config.name);

        const events = results.filter((r) => "date" in r) as RipperCalendarEvent[];
        const errors = results.filter((r) => "type" in r) as RipperError[];

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
