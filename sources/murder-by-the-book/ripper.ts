/**
 * Ripper for Murder By The Book (https://www.murderbooks.com/events)
 *
 * The site runs Drupal 11 + IndieCommerce and serves events as server-rendered
 * HTML. Each event is an <article id="event-XXXX" class="event-list"> with:
 *   - Title:       h3.event-list__title a
 *   - Date string: text node in .event-list__details--item after "Date: " label
 *                  format: "Wed, 6/3/2026"
 *   - Time string: text node in .event-list__details--item after "Time: " label
 *                  format: "6:30pm" or "6:30pm - 8:00pm"
 *   - Description: .event-list__body text (truncated)
 *   - Image:       .event-list__second--top .event-list__image img[src]
 *   - URL:         href on the title link (relative)
 *
 * Location is fixed at 2342 Bissonnet St, Houston, TX 77005 (set via geo in
 * ripper.yaml; no per-event lat/lng is emitted here).
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

const BASE_URL = "https://www.murderbooks.com";

/**
 * Convert a title string into a URL-slug-style id component.
 * Lowercases, replaces non-alphanumeric runs with hyphens, trims edges.
 */
function slugify(s: string): string {
    return s
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "");
}

/**
 * Parse a 12-hour time string like "6:30pm" or "6:30pm - 8:00pm".
 * Returns [startTime, duration]. If unparseable, returns [18:30, 1h].
 */
function parseTime(raw: string): [LocalTime, Duration] {
    const DEFAULT_TIME = LocalTime.of(18, 30);
    const DEFAULT_DURATION = Duration.ofHours(1);

    // Match optional end time: "6:30pm" or "6:30pm - 8:00pm"
    const match = raw
        .trim()
        .match(/^(\d{1,2}):(\d{2})(am|pm)(?:\s*-\s*(\d{1,2}):(\d{2})(am|pm))?/i);
    if (!match) {
        return [DEFAULT_TIME, DEFAULT_DURATION];
    }

    function to24(h: number, m: number, meridiem: string): LocalTime {
        let hour = h;
        if (meridiem.toLowerCase() === "pm" && hour !== 12) hour += 12;
        if (meridiem.toLowerCase() === "am" && hour === 12) hour = 0;
        return LocalTime.of(hour, m);
    }

    const startTime = to24(
        parseInt(match[1]!, 10),
        parseInt(match[2]!, 10),
        match[3]!,
    );

    if (match[4] !== undefined && match[5] !== undefined && match[6] !== undefined) {
        const endTime = to24(
            parseInt(match[4], 10),
            parseInt(match[5], 10),
            match[6],
        );
        // Compute duration in minutes (handle overnight, though unlikely)
        let startMins = startTime.hour() * 60 + startTime.minute();
        let endMins = endTime.hour() * 60 + endTime.minute();
        if (endMins < startMins) endMins += 24 * 60;
        const durationMins = endMins - startMins;
        return [startTime, Duration.ofMinutes(durationMins > 0 ? durationMins : 60)];
    }

    return [startTime, DEFAULT_DURATION];
}

/**
 * Parse a date string like "Wed, 6/3/2026" into a LocalDate.
 * Returns null if unparseable.
 */
function parseDate(raw: string): LocalDate | null {
    // Format: "Weekday, M/D/YYYY"
    const match = raw.trim().match(/\d+\/(\d+)\/(\d+)\/(\d+)/);
    // Try more specific: "Wed, 6/3/2026"
    const m2 = raw.trim().match(/\d*\/(\d+)\/(\d+)\s*$/) ??
        raw.trim().match(/(\d+)\/(\d+)\/(\d+)/);
    if (!m2) return null;
    // m2[0] is full match, groups are month/day/year or just day/year — re-match more carefully
    const m3 = raw.trim().match(/(\d+)\/(\d+)\/(\d+)/);
    if (!m3) return null;
    const month = parseInt(m3[1]!, 10);
    const day = parseInt(m3[2]!, 10);
    const year = parseInt(m3[3]!, 10);
    if (isNaN(month) || isNaN(day) || isNaN(year)) return null;
    try {
        return LocalDate.of(year, month, day);
    } catch {
        return null;
    }
}

/**
 * Extract the text content directly in a .event-list__details--item element,
 * AFTER removing the label span text.
 */
function extractDetailText(item: HTMLElement): string {
    // Clone the inner text, stripping the label span
    const labelText = item.querySelector(".event-list__details--label")?.text ?? "";
    const rawText = item.text;
    return rawText.replace(labelText, "").trim();
}

/**
 * Parse a single <article class="event-list"> element into a
 * RipperCalendarEvent or ParseError.
 */
export function parseEventArticle(
    article: HTMLElement,
    tz: ZoneId,
    sourceName: string,
): RipperCalendarEvent | ParseError {
    // --- Title ---
    const titleEl = article.querySelector("h3.event-list__title a");
    const title = titleEl?.text?.trim() ?? "";
    if (!title) {
        const articleId = article.getAttribute("id") ?? "unknown";
        return {
            type: "ParseError",
            reason: "Missing event title",
            context: articleId,
        };
    }

    // --- URL ---
    const href = titleEl?.getAttribute("href") ?? "";
    const url = href
        ? (href.startsWith("http") ? href : `${BASE_URL}${href}`)
        : undefined;

    // --- Date and Time from detail items ---
    let dateRaw = "";
    let timeRaw = "";

    const detailItems = article.querySelectorAll(".event-list__details--item");
    for (const item of detailItems) {
        const label = item.querySelector(".event-list__details--label")?.text ?? "";
        if (label.includes("Date:")) {
            dateRaw = extractDetailText(item);
        } else if (label.includes("Time:")) {
            timeRaw = extractDetailText(item);
        }
    }

    const localDate = parseDate(dateRaw);
    if (!localDate) {
        return {
            type: "ParseError",
            reason: `Unparseable date: "${dateRaw}"`,
            context: title,
        };
    }

    const [startTime, duration] = parseTime(timeRaw);
    const localDT = LocalDateTime.of(localDate, startTime);
    const date = ZonedDateTime.of(localDT, tz);

    // --- Description ---
    const description = article.querySelector(".event-list__body")?.text?.trim() || undefined;

    // --- Image ---
    // Prefer the first img inside the top section (before the links section)
    const topSection = article.querySelector(".event-list__second--top");
    const imgEl = topSection?.querySelector(".event-list__image img");
    let imageUrl: string | undefined;
    if (imgEl) {
        const src = imgEl.getAttribute("src") ?? "";
        if (src) {
            imageUrl = src.startsWith("http") ? src : `${BASE_URL}${src}`;
        }
    }

    // --- Stable ID ---
    const id = `${slugify(title)}-${localDate.toString()}`;

    const event: RipperCalendarEvent = {
        id,
        ripped: new Date(),
        date,
        duration,
        summary: title,
        location: "Murder By The Book, 2342 Bissonnet St, Houston, TX 77005",
        url,
        description,
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
    const articles = root.querySelectorAll("article.event-list");
    return articles.map((article) => parseEventArticle(article, tz, sourceName));
}

export default class MurderByTheBookRipper implements IRipper {
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
                `Murder By The Book fetch failed: HTTP ${res.status} ${res.statusText}`,
            );
        }

        const html = await res.text();
        const results = parseEvents(html, tz, ripper.config.name);

        // The store's events listing includes recently-passed events; drop
        // anything before today (intentional content filter, kept in the
        // caller rather than the per-card parser).
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
