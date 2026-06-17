/**
 * Ripper for Aurora Picture Show (https://www.aurorapictureshow.org/programs)
 *
 * Aurora uses Squarespace's eventlist framework with server-rendered HTML.
 * Each event is an <article class="eventlist-event"> with:
 *   - h1.eventlist-title > a — event title and link
 *   - time.event-date[datetime] — event start date (YYYY-MM-DD)
 *   - time.event-time-localized — event start time (e.g., "8:00 PM")
 *   - div.eventlist-excerpt — event description
 *
 * Multi-day events have an additional second date and time separated by
 * event-datetime-divider.
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

const DEFAULT_VENUE_ADDRESS = "5601A Navigation Blvd, Houston, TX 77011";

function slugify(s: string): string {
    return s
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "");
}

/**
 * Parse time string like "8:00 PM" into LocalTime.
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

/**
 * Parse a date string like "2026-05-29" into LocalDate.
 */
function parseDateISO(dateStr: string): LocalDate | null {
    try {
        return LocalDate.parse(dateStr);
    } catch {
        return null;
    }
}

export default class AuroraPictureShowRipper implements IRipper {
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
                `Aurora Picture Show fetch failed: HTTP ${res.status} ${res.statusText}`,
            );
        }

        const html = await res.text();
        const doc = parse(html);

        const events: RipperCalendarEvent[] = [];
        const errors: RipperError[] = [];

        // Find all event articles
        const eventArticles = doc.querySelectorAll("article.eventlist-event");

        for (const article of eventArticles) {
            const result = this.parseEvent(article, tz, ripper.config.url.toString());
            if ("type" in result) {
                errors.push(result);
            } else {
                events.push(result);
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
     * Parse a single event article.
     * Returns RipperCalendarEvent | RipperError
     */
    private parseEvent(
        article: HTMLElement,
        tz: ZoneId,
        sourceUrl: string,
    ): RipperCalendarEvent | RipperError {
        // Extract title
        const titleEl = article.querySelector(".eventlist-title a");
        const title = getTextContent(titleEl);

        if (!title) {
            return {
                type: "ParseError" as const,
                reason: "Missing event title",
                context: article.outerHTML.substring(0, 200),
            };
        }

        // Extract all date/time elements
        const dateElements = article.querySelectorAll("time.event-date");
        const timeElements = article.querySelectorAll("time.event-time-localized");

        if (dateElements.length === 0) {
            return {
                type: "ParseError" as const,
                reason: `Event "${title}" has no date elements`,
                context: article.outerHTML.substring(0, 200),
            };
        }

        // Get first date (required)
        const startDateStr = dateElements[0]?.getAttribute("datetime");
        if (!startDateStr) {
            return {
                type: "ParseError" as const,
                reason: `Event "${title}" missing start date`,
                context: article.outerHTML.substring(0, 200),
            };
        }

        const startDate = parseDateISO(startDateStr);
        if (!startDate) {
            return {
                type: "ParseError" as const,
                reason: `Event "${title}" unparseable start date: ${startDateStr}`,
                context: article.outerHTML.substring(0, 200),
            };
        }

        // Get start time (optional, defaults to noon if missing)
        let startTime = LocalTime.of(12, 0);
        const startTimeEl = timeElements[0];
        if (startTimeEl) {
            const startTimeStr = getTextContent(startTimeEl);
            const parsed = parseTime12h(startTimeStr);
            if (parsed) {
                startTime = parsed;
            }
        }

        // Default duration is 2 hours
        let duration = Duration.ofHours(2);

        // Check for multiday event (second date exists)
        let endDate = startDate;
        let endTime = startTime.plusHours(2);

        if (dateElements.length > 1) {
            const endDateStr = dateElements[1]?.getAttribute("datetime");
            if (endDateStr) {
                const parsed = parseDateISO(endDateStr);
                if (parsed) {
                    endDate = parsed;
                }
            }

            // Get end time if available
            if (timeElements.length > 1) {
                const endTimeStr = getTextContent(timeElements[1]);
                const parsed = parseTime12h(endTimeStr);
                if (parsed) {
                    endTime = parsed;
                }
            }

            // Calculate duration across days
            const startDt = ZonedDateTime.of(startDate, startTime, tz);
            const endDt = ZonedDateTime.of(endDate, endTime, tz);
            duration = Duration.between(
                startDt.toInstant(),
                endDt.toInstant(),
            );

            // If duration is negative or zero, default to 2 hours
            if (duration.isNegative() || duration.isZero()) {
                duration = Duration.ofHours(2);
            }
        }

        // Extract description
        const descriptionEl = article.querySelector(".eventlist-excerpt");
        let description = "";
        if (descriptionEl) {
            // Extract text from paragraphs, preserving some structure
            const paragraphs = descriptionEl.querySelectorAll("p");
            const texts = paragraphs.map((p) => getTextContent(p));
            description = texts.join("\n\n");
        }

        // Extract location (optional, defaults to venue)
        let location = DEFAULT_VENUE_ADDRESS;
        const locationEl = article.querySelector(
            ".eventlist-meta-location-text",
        );
        if (locationEl) {
            const locText = getTextContent(locationEl);
            if (locText && locText !== "Aurora Picture Show") {
                location = locText;
            }
        }

        // Build stable event ID from title + start date
        const eventId = `${slugify(title)}-${startDate.toString()}`;

        // Build the event
        const localDT = LocalDateTime.of(startDate, startTime);
        const date = ZonedDateTime.of(localDT, tz);

        // Extract event link if available
        let url: string | undefined;
        const titleLink = article.querySelector(".eventlist-title a");
        if (titleLink) {
            const href = titleLink.getAttribute("href");
            if (href) {
                url = href.startsWith("http")
                    ? href
                    : `https://www.aurorapictureshow.org${href}`;
            }
        }

        const event: RipperCalendarEvent = {
            id: eventId,
            ripped: new Date(),
            date,
            duration,
            summary: title,
            description,
            location,
            url,
        };

        return event;
    }
}
