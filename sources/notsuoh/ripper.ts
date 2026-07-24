/**
 * Ripper for Notsuoh (https://www.notsuoh.com/events)
 *
 * Notsuoh is a nightclub built on Squarespace and uses the eventlist
 * framework for its events page. Each event is an <article class="eventlist-event">
 * with:
 *   - Title:       h1.eventlist-title a
 *   - Start date:  time.event-date[datetime] (YYYY-MM-DD)
 *   - Start time:  time.event-time-localized (e.g., "8:00 PM")
 *   - End date/time: optional second time block (for multi-day events)
 *   - Image:       img in .eventlist-column-thumbnail
 *   - Description: .eventlist-excerpt text (optional)
 *   - URL:         href on the title link (relative)
 *
 * Location is fixed at 314 Main St, Houston, TX 77002 (set via geo in ripper.yaml).
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
    ParseError,
} from "../../lib/config/schema.js";
import { getFetchForConfig } from "../../lib/config/proxy-fetch.js";

const BASE_URL = "https://www.notsuoh.com";

function slugify(s: string): string {
    return s
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "");
}

/**
 * Parse a 12-hour time string like "8:00 PM" into LocalTime.
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
 * Parse an ISO date string like "2026-06-14" into LocalDate.
 * Returns null if unparseable.
 */
function parseDateISO(dateStr: string): LocalDate | null {
    try {
        return LocalDate.parse(dateStr);
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
 * Parse a single <article class="eventlist-event"> element into a
 * RipperCalendarEvent or ParseError.
 */
export function parseEventArticle(
    article: HTMLElement,
    tz: ZoneId,
    sourceName: string,
): RipperCalendarEvent | RipperError {
    // Extract title
    const titleEl = article.querySelector("h1.eventlist-title a");
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
    const description = descriptionEl ? getTextContent(descriptionEl) : undefined;

    // Extract image
    const imgEl = article.querySelector(".eventlist-column-thumbnail img");
    let imageUrl: string | undefined;
    if (imgEl) {
        const src = imgEl.getAttribute("src");
        if (src) {
            imageUrl = src.startsWith("http") ? src : `${BASE_URL}${src}`;
        }
    }

    // Extract event link
    let url: string | undefined;
    const titleLink = article.querySelector("h1.eventlist-title a");
    if (titleLink) {
        const href = titleLink.getAttribute("href");
        if (href) {
            url = href.startsWith("http")
                ? href
                : `${BASE_URL}${href}`;
        }
    }

    // Build stable event ID from title + start date
    const eventId = `${slugify(title)}-${startDate.toString()}`;

    // Build the event
    const localDT = LocalDateTime.of(startDate, startTime);
    const date = ZonedDateTime.of(localDT, tz);

    const event: RipperCalendarEvent = {
        id: eventId,
        ripped: new Date(),
        date,
        duration,
        summary: title,
        description,
        url,
        imageUrl,
    };

    return event;
}

/**
 * Parse all events from the full HTML page string.
 * Exported so tests can call it directly.
 */
export function parseEvents(
    html: string,
    tz: ZoneId,
    sourceName: string,
): Array<RipperCalendarEvent | RipperError> {
    const root = parse(html);
    const articles = root.querySelectorAll("article.eventlist-event");
    return articles.map((article) => parseEventArticle(article, tz, sourceName));
}

export default class NotsuohRipper implements IRipper {
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
                `Notsuoh fetch failed: HTTP ${res.status} ${res.statusText}`,
            );
        }

        const html = await res.text();
        const results = parseEvents(html, tz, ripper.config.name);

        // Filter to future events
        const today = LocalDate.now(tz);
        const events: RipperCalendarEvent[] = [];
        const errors: RipperError[] = [];
        for (const r of results) {
            if ("date" in r) {
                if (!r.date.toLocalDate().isBefore(today)) {
                    events.push(r);
                }
            } else {
                errors.push(r);
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
