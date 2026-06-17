/**
 * Ripper for Saint Arnold Brewing Company (https://www.saintarnold.com)
 *
 * The site's Happenings page lists event/happening posts as a WordPress post grid.
 * Each post item contains a link to the individual post page, which may contain
 * structured event information including dates and times embedded in the HTML content.
 *
 * The ripper:
 * 1. Fetches the main happenings page and extracts event links from the post grid
 * 2. Fetches each individual event post page
 * 3. Parses event dates and times from the post content
 * 4. Returns stable event IDs based on title + date
 */

import {
    Duration,
    LocalDate,
    LocalDateTime,
    LocalTime,
    ZoneId,
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
import crypto from "crypto";

const VENUE_ADDRESS = "2000 Lyons Ave, Houston, TX 77020";

function slugify(s: string): string {
    return s
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "");
}

function hashEventId(title: string, dateStr: string): string {
    const key = `${slugify(title)}-${dateStr}`;
    const hash = crypto
        .createHash("sha256")
        .update(key)
        .digest("hex")
        .substring(0, 8);
    return `${key}-${hash}`;
}

/**
 * Extract links to individual event posts from the post grid
 */
function extractEventLinks(html: string): Map<string, string> {
    const root = parse(html);
    const links = new Map<string, string>();

    // Find all post grid items and extract their title and link
    const postItems = root.querySelectorAll(".nectar-post-grid-item");

    postItems.forEach((item) => {
        const titleLink = item.querySelector("h3.post-heading a");
        if (titleLink) {
            const href = titleLink.getAttribute("href");
            const text = titleLink.textContent || "";
            if (href && text) {
                links.set(text.trim(), href);
            }
        }
    });

    return links;
}

/**
 * Parse event dates and times from post content
 * Looks for patterns like:
 *   <strong>June 11</strong> ... 2:00 PM
 *   <strong>Friday, June 12</strong> ... 8:00 PM
 *   Date range format like "Thursday, June 11" with time following
 *   Plain text patterns without strong tags
 */
function parseEventDatesFromContent(html: string, title: string): (RipperCalendarEvent | RipperError)[] {
    const root = parse(html);
    const article = root.querySelector("article");
    if (!article) {
        return [{
            error: true,
            type: "ParseError",
            reason: "No article element found",
            context: `Looking for article in: ${title}`,
        } as ParseError];
    }

    const contentInner = article.querySelector(".content-inner");
    if (!contentInner) {
        return [{
            error: true,
            type: "ParseError",
            reason: "No content-inner element found",
            context: `Looking for content-inner in: ${title}`,
        } as ParseError];
    }

    const events: RipperCalendarEvent[] = [];
    const content = contentInner.textContent || "";
    const html_content = contentInner.outerHTML;

    // Match patterns in HTML like:
    // <strong>Thursday, June 11</strong> ... 2:00 PM
    // or: <strong>June 11</strong> ... text ... 2:00 PM
    // Also match plain text: Thursday, June 11 | 2:00 PM
    const strongDateTimePattern = /(<strong>[^<]*?(\d{1,2})[^<]*?<\/strong>[\s\S]{0,300}?(\d{1,2}):(\d{2})\s*(AM|PM))/gi;

    // Match plain text dates with times (month day | time or day month | time format)
    const plainTextPattern = /(?:(?:Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)[,\s]*)?(?:January|February|March|April|May|June|July|August|September|October|November|December|Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)\s+(\d{1,2})[\s\w,|]*?(\d{1,2}):(\d{2})\s*(AM|PM)/gi;

    let match;
    const seenDates = new Set<string>();

    // Try strong tag patterns first
    while ((match = strongDateTimePattern.exec(html_content)) !== null) {
        const fullMatch = match[0];
        const dayNum = match[2];
        const hour = match[3];
        const min = match[4];
        const ampm = match[5];

        // Parse the date from the strong tag
        const dateTagMatch = fullMatch.match(/<strong>([^<]+)<\/strong>/);
        if (!dateTagMatch) continue;

        const dateStr = dateTagMatch[1];

        // Extract date components
        // Try patterns like "Thursday, June 11" or "June 11" or "Friday, June 12"
        const monthDayMatch = dateStr.match(/(January|February|March|April|May|June|July|August|September|October|November|December|Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)\s+(\d{1,2})/i);

        if (!monthDayMatch) continue;

        const monthStr = monthDayMatch[1];
        const day = parseInt(dayNum, 10);

        if (tryCreateEvent(title, monthStr, day, hour, min, ampm, seenDates, events)) {
            // Event created successfully
        }
    }

    // Try plain text patterns if no events found yet
    if (events.length === 0) {
        while ((match = plainTextPattern.exec(content)) !== null) {
            const fullMatch = match[0];
            const day = match[1];
            const hour = match[2];
            const min = match[3];
            const ampm = match[4];

            // Extract the month name from the full match
            const monthMatch = fullMatch.match(/(January|February|March|April|May|June|July|August|September|October|November|December|Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)/i);
            if (!monthMatch) continue;

            const monthStr = monthMatch[1];

            if (tryCreateEvent(title, monthStr, parseInt(day, 10), hour, min, ampm, seenDates, events)) {
                // Event created successfully
            }
        }
    }

    // If no events found with structured dates, return a ParseError
    if (events.length === 0) {
        return [{
            error: true,
            type: "ParseError",
            reason: "No dated events found in content",
            context: `Title: ${title}, Content preview: ${content.substring(0, 200)}`,
        } as ParseError];
    }

    return events;
}

/**
 * Helper function to try creating an event from parsed date/time components
 */
function tryCreateEvent(
    title: string,
    monthStr: string,
    day: number,
    hour: string,
    min: string,
    ampm: string,
    seenDates: Set<string>,
    events: RipperCalendarEvent[]
): boolean {
    // Parse month
    const monthMap: Record<string, number> = {
        january: 1, february: 2, march: 3, april: 4, may: 5, june: 6,
        july: 7, august: 8, september: 9, october: 10, november: 11, december: 12,
        jan: 1, feb: 2, mar: 3, apr: 4, jun: 6, jul: 7, aug: 8,
        sep: 9, sept: 9, oct: 10, nov: 11, dec: 12,
    };

    const month = monthMap[monthStr.toLowerCase()];
    if (!month) return false;

    // Determine year (current or next year if date is in the past)
    const today = LocalDate.now();
    let year = today.year();
    const testDate = LocalDate.of(year, month, day);

    if (testDate.isBefore(today)) {
        year = year + 1;
    }

    try {
        const eventDate = LocalDate.of(year, month, day);
        const hourNum = parseInt(hour, 10);
        const adjustedHour =
            ampm.toUpperCase() === "PM" && hourNum !== 12
                ? hourNum + 12
                : ampm.toUpperCase() === "AM" && hourNum === 12
                  ? 0
                  : hourNum;
        const minNum = parseInt(min, 10);

        const eventTime = LocalTime.of(adjustedHour, minNum);
        const dateTime = LocalDateTime.of(eventDate, eventTime);
        const zonedDateTime = dateTime.atZone(ZoneId.of("America/Chicago"));

        const dateKey = eventDate.toString();

        // Avoid duplicates for the same title/date combo
        const eventIdKey = hashEventId(title, dateKey);
        if (seenDates.has(eventIdKey)) return false;
        seenDates.add(eventIdKey);

        const event: RipperCalendarEvent = {
            id: eventIdKey,
            summary: title,
            date: zonedDateTime,
            ripped: new Date(),
            duration: Duration.ofHours(2),
            location: VENUE_ADDRESS,
            description: "",
            url: "", // Will be set in the caller if available
        };

        events.push(event);
        return true;
    } catch (err) {
        console.error(`Failed to parse date: month=${month} day=${day} year=${year}`, err);
        return false;
    }
}

export default class SaintArnoldBrewingCompanyRipper implements IRipper {
    public async rip(ripper: Ripper): Promise<RipperCalendar[]> {
        const fetchFn = getFetchForConfig(ripper.config);
        const cal = ripper.config.calendars[0]!;

        // Fetch the main happenings page
        const res = await fetchFn(ripper.config.url.toString(), {
            headers: {
                "User-Agent": "Mozilla/5.0 (compatible; 832events/1.0)",
            },
        });

        if (!res.ok) {
            throw new Error(
                `Saint Arnold Brewing Company happenings page failed: HTTP ${res.status} ${res.statusText}`,
            );
        }

        const html = await res.text();
        const eventLinks = extractEventLinks(html);

        const events: RipperCalendarEvent[] = [];
        const errors: RipperError[] = [];

        // Fetch each event post page
        for (const [title, url] of eventLinks) {
            try {
                const eventRes = await fetchFn(url, {
                    headers: {
                        "User-Agent": "Mozilla/5.0 (compatible; 832events/1.0)",
                    },
                });

                if (!eventRes.ok) {
                    errors.push({
                        error: true,
                        type: "ParseError",
                        reason: `Failed to fetch event page: HTTP ${eventRes.status}`,
                        context: `Event: ${title}, URL: ${url}`,
                    } as ParseError);
                    continue;
                }

                const eventHtml = await eventRes.text();
                const parsedEvents = parseEventDatesFromContent(eventHtml, title);

                // Separate events from errors
                parsedEvents.forEach((item) => {
                    if ("error" in item && item.error) {
                        errors.push(item as RipperError);
                    } else {
                        const event = item as RipperCalendarEvent;
                        event.url = url; // Add the source URL to the event
                        events.push(event);
                    }
                });
            } catch (err) {
                errors.push({
                    error: true,
                    type: "ParseError",
                    reason: `Exception fetching/parsing event: ${err instanceof Error ? err.message : String(err)}`,
                    context: `Event: ${title}, URL: ${url}`,
                } as ParseError);
            }
        }

        return [
            {
                name: cal.name,
                friendlyname: cal.friendlyname || "",
                events,
                errors,
                tags: ripper.config.tags ?? [],
                parent: ripper.config,
            },
        ];
    }
}
