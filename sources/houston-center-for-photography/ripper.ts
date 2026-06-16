/**
 * Ripper for Houston Center for Photography (https://www.edu.hcponline.org/events)
 *
 * Events are displayed using Squarespace's eventlist framework with
 * server-rendered HTML. Each event is an <article class="eventlist-event">
 * with structured metadata in <time> elements with datetime attributes.
 *
 * Key elements:
 *   article.eventlist-event — event container
 *   h1.eventlist-title a — event title and link
 *   time.event-date[datetime] — full date (e.g., "2026-06-18")
 *   time.event-time-localized-start — start time (e.g., "6:00 PM")
 *   time.event-time-localized-end — end time (e.g., "8:00 PM")
 *   li.eventlist-meta-address — location text
 *   div.eventlist-excerpt — event description
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

const DEFAULT_VENUE_ADDRESS = "1441 W Alabama St, Houston, TX 77006";

function slugify(s: string): string {
    return s
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "");
}

/**
 * Parse time string like "6:00 PM" into LocalTime.
 * Returns null if unparseable.
 */
function parseTime12h(timeStr: string): LocalTime | null {
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
 * Extract text content from an element, handling whitespace.
 */
function getTextContent(el: HTMLElement | null): string {
    if (!el) return "";
    return el.text.trim();
}

export default class HoustonCenterForPhotographyRipper implements IRipper {
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
                `Houston Center for Photography fetch failed: HTTP ${res.status} ${res.statusText}`,
            );
        }

        const html = await res.text();
        const events: RipperCalendarEvent[] = [];
        const errors: RipperError[] = [];

        const root = parse(html);

        // Find all event articles: <article class="eventlist-event">
        const eventArticles = root.querySelectorAll("article.eventlist-event");

        for (const article of eventArticles) {
            // --- Title ---
            const titleLink = article.querySelector("h1.eventlist-title a");
            const title = getTextContent(titleLink);
            if (!title) {
                errors.push({
                    type: "ParseError",
                    reason: "Missing event title",
                    context: "eventlist article",
                });
                continue;
            }

            // --- Date from time.event-date[datetime] ---
            const dateEl = article.querySelector("time.event-date");
            const dateStr = dateEl?.getAttribute("datetime");
            let eventDate: LocalDate | null = null;

            if (dateStr) {
                // datetime format is ISO: "2026-06-18"
                try {
                    const [year, month, day] = dateStr.split("-").map((s) => parseInt(s, 10));
                    eventDate = LocalDate.of(year, month, day);
                } catch {
                    // Fall through to error
                }
            }

            if (!eventDate) {
                errors.push({
                    type: "ParseError",
                    reason: `Unparseable date: "${dateStr}"`,
                    context: title,
                });
                continue;
            }

            // --- Start time ---
            let startTime = LocalTime.of(18, 0); // Default 6 PM
            const startTimeEl = article.querySelector("time.event-time-localized-start");
            if (startTimeEl) {
                const parsed = parseTime12h(getTextContent(startTimeEl));
                if (parsed) {
                    startTime = parsed;
                }
            }

            // --- End time (to calculate duration) ---
            let duration = Duration.ofHours(2); // Default 2 hours
            const endTimeEl = article.querySelector("time.event-time-localized-end");
            if (endTimeEl) {
                const endTime = parseTime12h(getTextContent(endTimeEl));
                if (endTime) {
                    const startMins = startTime.hour() * 60 + startTime.minute();
                    const endMins = endTime.hour() * 60 + endTime.minute();
                    const durationMins = (endMins >= startMins)
                        ? (endMins - startMins)
                        : (endMins + 24 * 60 - startMins);
                    if (durationMins > 0) {
                        duration = Duration.ofMinutes(durationMins);
                    }
                }
            }

            const localDT = LocalDateTime.of(eventDate, startTime);
            const date = ZonedDateTime.of(localDT, tz);

            // --- Location ---
            let location = DEFAULT_VENUE_ADDRESS;
            const addressLi = article.querySelector("li.eventlist-meta-address");
            if (addressLi) {
                // Extract text before the map link
                const textNodes = addressLi.text.trim();
                // Remove the "(map)" part
                const cleanLocation = textNodes.replace(/\s*\(map\)$/, "").trim();
                if (cleanLocation && cleanLocation !== "Houston Center for Photography") {
                    location = cleanLocation;
                }
            }

            // --- Description ---
            let description: string | undefined;
            const excerptDiv = article.querySelector("div.eventlist-excerpt");
            if (excerptDiv) {
                const desc = getTextContent(excerptDiv);
                if (desc) {
                    description = desc.substring(0, 500); // Truncate to reasonable length
                }
            }

            // --- Event link ---
            let url: string | undefined;
            if (titleLink) {
                const href = titleLink.getAttribute("href");
                if (href) {
                    url = href.startsWith("http")
                        ? href
                        : `https://www.edu.hcponline.org${href}`;
                }
            }

            // --- Stable ID ---
            const id = `${slugify(title)}-${eventDate.toString()}`;

            const event: RipperCalendarEvent = {
                id,
                ripped: new Date(),
                date,
                duration,
                summary: title,
                location,
                description,
                url,
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
