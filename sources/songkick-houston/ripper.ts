/**
 * Ripper for Songkick Houston Metro (https://www.songkick.com/metro-areas/15073-us-houston)
 *
 * Songkick aggregates concert and music events across the Houston metro area.
 * The page displays events as list items with artist name, venue, and date information.
 * Events are formatted as:
 * - Artist name in <strong> tags
 * - Venue as a link
 * - Date and location as text (e.g., "Sunday 05 July 2026")
 */

import {
    Duration,
    LocalDate,
    LocalDateTime,
    LocalTime,
    ZoneId,
    ZonedDateTime,
    nativeJs,
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

function slugify(s: string): string {
    return s
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "");
}

/**
 * Parse date strings like "Sunday 05 July 2026" or "Sunday 11 June 2026 – Sunday 19 July 2026"
 * Returns the start date as LocalDate or null if unparseable
 */
function parseEventDate(dateStr: string): LocalDate | null {
    if (!dateStr) return null;

    // Split on dash if it's a date range - take the first date
    const datePart = dateStr.split("–")[0]?.trim() || dateStr.trim();

    // Match patterns like "Sunday 05 July 2026", "Thu 12 Dec 2026", etc.
    // Day-of-week is optional
    const match = datePart.match(
        /(?:Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday|Mon|Tue|Wed|Thu|Fri|Sat)?\s*(\d{1,2})\s+(January|February|March|April|May|June|July|August|September|October|November|December|Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+(\d{4})/i
    );

    if (!match) return null;

    const monthMap: Record<string, number> = {
        january: 1, jan: 1,
        february: 2, feb: 2,
        march: 3, mar: 3,
        april: 4, apr: 4,
        may: 5,
        june: 6, jun: 6,
        july: 7, jul: 7,
        august: 8, aug: 8,
        september: 9, sep: 9,
        october: 10, oct: 10,
        november: 11, nov: 11,
        december: 12, dec: 12,
    };

    const day = parseInt(match[1]!, 10);
    const month = monthMap[match[2]!.toLowerCase()];
    const year = parseInt(match[3]!, 10);

    if (!month || !day || !year) {
        return null;
    }

    try {
        return LocalDate.of(year, month, day);
    } catch {
        return null;
    }
}

/**
 * Extract date from event title attribute or time element
 */
function extractDateFromEvent(li: HTMLElement): string | null {
    // Try title attribute first
    const title = li.getAttribute("title");
    if (title && /\d{1,2}\s+\w+\s+\d{4}/.test(title)) {
        return title;
    }

    // Try time element
    const timeEl = li.querySelector("time");
    if (timeEl) {
        const datetime = timeEl.getAttribute("datetime");
        if (datetime) {
            // Extract date from datetime (e.g., "2026-07-04T16:00:00-0500" -> "2026-07-04")
            const datePart = datetime.split("T")[0];
            if (datePart) {
                // Parse ISO date and convert to readable format
                try {
                    const [year, month, day] = datePart.split("-");
                    if (year && month && day) {
                        const date = LocalDate.parse(datePart);
                        const dayOfWeek = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"][date.dayOfWeek().value() % 7];
                        const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
                        return `${dayOfWeek} ${day} ${monthNames[parseInt(month) - 1]} ${year}`;
                    }
                } catch {
                    // Fall through
                }
            }
        }

        // Try text content
        const text = timeEl.text?.trim();
        if (text && /\d{1,2}\s+\w+\s+\d{4}/.test(text)) {
            return text;
        }
    }

    return null;
}

/**
 * Extract event details from JSON-LD structured data
 */
function extractEventFromJsonLd(li: HTMLElement): { artist?: string; venue?: string } {
    const scriptEl = li.querySelector("script[type='application/ld+json']");
    if (!scriptEl) {
        return {};
    }

    try {
        const jsonStr = scriptEl.text;
        const data = JSON.parse(jsonStr);

        // Handle array of events
        const event = Array.isArray(data) ? data[0] : data;
        if (!event) return {};

        const result: { artist?: string; venue?: string } = {};

        // Extract artist from name (e.g., "Pleasure P @ Port Arthur Pavilion" -> "Pleasure P")
        if (event.name) {
            const match = event.name.match(/^([^@]+)(?:\s*@|$)/);
            if (match) {
                result.artist = match[1]!.trim();
            }
        }

        // Extract venue
        if (event.location && event.location.name) {
            result.venue = event.location.name;
        }

        // Extract performer list as alternative
        if (!result.artist && event.performer) {
            const performers = Array.isArray(event.performer) ? event.performer : [event.performer];
            const names = performers.map((p: any) => p.name).filter(Boolean);
            if (names.length > 0) {
                result.artist = names.join(", ");
            }
        }

        return result;
    } catch {
        return {};
    }
}

/**
 * Get the preceding date heading for a given list item
 * Traverses backward in the HTML to find the nearest date-like heading
 */
function getDateForListItem(li: HTMLElement, root: HTMLElement): string | null {
    // Find all h3/h2/h4 headings and their positions
    // Then find which one appears before this list item
    const allHeadings = root.querySelectorAll("h2, h3, h4");
    const allItems = root.querySelectorAll("li");

    let currentItemIndex = -1;
    for (let i = 0; i < allItems.length; i++) {
        if (allItems[i] === li) {
            currentItemIndex = i;
            break;
        }
    }

    if (currentItemIndex === -1) {
        return null;
    }

    // Find the last heading that comes before this item index
    for (let i = allHeadings.length - 1; i >= 0; i--) {
        const heading = allHeadings[i]!;
        let headingItemCount = 0;

        // Count how many list items come after this heading
        for (let j = 0; j < allItems.length; j++) {
            if (allItems[j] === li) {
                // We've reached our target item
                if (j > i) {
                    // This heading comes before our item
                    const text = heading.text?.trim();
                    if (text && /\d{1,2}\s+\w+\s+\d{4}/.test(text)) {
                        return text;
                    }
                }
                break;
            }
        }
    }

    return null;
}

export default class SongkickHoustonRipper implements IRipper {
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
                `Songkick Houston fetch failed: HTTP ${res.status} ${res.statusText}`,
            );
        }

        const html = await res.text();
        const events: RipperCalendarEvent[] = [];
        const errors: RipperError[] = [];

        const root = parse(html);

        // Process event listing items. The HTML structure is:
        // <li class="date-element">
        //   <time datetime="...">Saturday 04 July 2026</time>
        // </li>
        // <li class="event-listings-element" title="Saturday 04 July 2026">
        //   <time datetime="2026-07-04T16:00:00-0500"></time>
        //   <script type="application/ld+json">[event data]</script>
        // </li>

        const eventItems = root.querySelectorAll("li.event-listings-element");

        for (const li of eventItems) {
            // Extract date from title attribute
            const dateStr = extractDateFromEvent(li);
            if (!dateStr) {
                errors.push({
                    type: "ParseError",
                    reason: "Missing date for event item",
                    context: "event-listings-element",
                });
                continue;
            }

            const eventDate = parseEventDate(dateStr);
            if (!eventDate) {
                errors.push({
                    type: "ParseError",
                    reason: `Cannot parse date "${dateStr}"`,
                    context: dateStr,
                });
                continue;
            }

            // Extract artist and venue from JSON-LD data
            const eventData = extractEventFromJsonLd(li);
            const artist = eventData.artist;
            const venue = eventData.venue;

            if (!artist) {
                errors.push({
                    type: "ParseError",
                    reason: "Could not extract artist name",
                    context: dateStr,
                });
                continue;
            }

            // Extract start time from time element if available
            let startTime = LocalTime.of(19, 0); // Default to 7 PM
            const timeEl = li.querySelector("time");
            if (timeEl) {
                const datetime = timeEl.getAttribute("datetime");
                if (datetime && datetime.includes("T")) {
                    const timePart = datetime.split("T")[1];
                    if (timePart) {
                        const [hours, minutes] = timePart.split(":").map(Number);
                        if (!isNaN(hours) && !isNaN(minutes)) {
                            try {
                                startTime = LocalTime.of(hours, minutes);
                            } catch {
                                // Use default time
                            }
                        }
                    }
                }
            }

            const localDT = LocalDateTime.of(eventDate, startTime);
            const duration = Duration.ofHours(3); // Default to 3 hours

            const id = `${slugify(artist)}-${eventDate.toString()}`;
            const event: RipperCalendarEvent = {
                id,
                ripped: new Date(),
                date: ZonedDateTime.of(localDT, tz),
                duration,
                summary: artist,
                location: venue || undefined,
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
