/**
 * Ripper for Karbach Brewing Company (https://karbachbrewing.com)
 *
 * The site's community/events page lists events as article cards with:
 * - Date in a <time> element
 * - Title in an <h1> element
 * - Link to individual event page
 *
 * Each event detail page contains:
 * - Date (already extracted from listing)
 * - Full description and time details in the main content
 *
 * The ripper:
 * 1. Fetches the events listing page
 * 2. Extracts event links, titles, and dates from article cards
 * 3. Fetches each event detail page to extract time and description
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

const VENUE_ADDRESS = "2032 Karbach St, Houston, TX 77092";

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
 * Parse date string like "June 11, 2026"
 */
function parseDateString(dateStr: string): LocalDate | null {
    const monthMap: Record<string, number> = {
        january: 1, february: 2, march: 3, april: 4, may: 5, june: 6,
        july: 7, august: 8, september: 9, october: 10, november: 11, december: 12,
        jan: 1, feb: 2, mar: 3, apr: 4, jun: 6, jul: 7, aug: 8,
        sep: 9, sept: 9, oct: 10, nov: 11, dec: 12,
    };

    // Match patterns like "June 11, 2026" or "June 11"
    const match = dateStr.match(/(January|February|March|April|May|June|July|August|September|October|November|December|Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)\s+(\d{1,2})(?:\s*,\s*(\d{4}))?/i);

    if (!match) {
        return null;
    }

    const month = monthMap[match[1].toLowerCase()];
    const day = parseInt(match[2], 10);
    let year = match[3] ? parseInt(match[3], 10) : LocalDate.now().year();

    // If no year was in the string and the parsed date is in the past, assume next year
    if (!match[3]) {
        const testDate = LocalDate.of(year, month, day);
        if (testDate.isBefore(LocalDate.now())) {
            year = year + 1;
        }
    }

    try {
        return LocalDate.of(year, month, day);
    } catch (err) {
        return null;
    }
}

/**
 * Extract time from event details HTML
 * Looks for patterns like "11am" or "11:00 AM" or "opens at 11am"
 */
function extractTimeFromContent(html: string): LocalTime | null {
    // Look for opening time first (e.g., "open daily at 11am")
    const openTimeMatch = html.match(/open[^<]*?(?:at|@)\s*(\d{1,2})(?::(\d{2}))?\s*(am|pm)/i);
    if (openTimeMatch) {
        const hour = parseInt(openTimeMatch[1], 10);
        const minutes = openTimeMatch[2] ? parseInt(openTimeMatch[2], 10) : 0;
        const ampm = openTimeMatch[3].toLowerCase();

        const adjustedHour = ampm === "pm" && hour !== 12 ? hour + 12 : ampm === "am" && hour === 12 ? 0 : hour;
        try {
            return LocalTime.of(adjustedHour, minutes);
        } catch (err) {
            return null;
        }
    }

    // Fallback to 11:00 AM for brewery opening
    return LocalTime.of(11, 0);
}

/**
 * Extract event links and basic info from the events listing page
 * Only extracts events with explicit dates (e.g., "June 11, 2026"), not recurring patterns
 */
function extractEventInfo(html: string): Array<{ title: string; url: string; dateStr: string }> {
    const root = parse(html);
    const events: Array<{ title: string; url: string; dateStr: string }> = [];

    // Find all article cards with class "article"
    const articles = root.querySelectorAll("article.article");

    articles.forEach((article) => {
        // Extract link from the article
        const titleLink = article.querySelector("h1 a");
        const timeElement = article.querySelector("time a");

        if (titleLink && timeElement) {
            const title = titleLink.textContent?.trim() || "";
            const url = titleLink.getAttribute("href") || "";
            const dateStr = timeElement.textContent?.trim() || "";

            if (title && url && dateStr) {
                // Only process events with explicit date patterns like "June 11, 2026"
                // Skip recurring patterns like "Every Thursday", "Bi-weekly on Tuesdays", etc.
                const hasExplicitDate = /\b(January|February|March|April|May|June|July|August|September|October|November|December|Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)\s+(\d{1,2})(?:\s*,\s*(\d{4}))?\b/i.test(dateStr);

                if (hasExplicitDate) {
                    events.push({
                        title,
                        url: url.startsWith("http") ? url : "https://karbachbrewing.com" + url,
                        dateStr,
                    });
                }
            }
        }
    });

    return events;
}

export default class KarbachBrewingRipper implements IRipper {
    public async rip(ripper: Ripper): Promise<RipperCalendar[]> {
        const fetchFn = getFetchForConfig(ripper.config);
        const cal = ripper.config.calendars[0]!;

        // Fetch the events listing page
        const res = await fetchFn(ripper.config.url.toString(), {
            headers: {
                "User-Agent": "Mozilla/5.0 (compatible; 832events/1.0)",
            },
        });

        if (!res.ok) {
            throw new Error(
                `Karbach Brewing events page failed: HTTP ${res.status} ${res.statusText}`,
            );
        }

        const html = await res.text();
        const eventInfo = extractEventInfo(html);

        const events: RipperCalendarEvent[] = [];
        const errors: RipperError[] = [];
        const seenEventIds = new Set<string>();

        // Fetch each event detail page
        for (const { title, url, dateStr } of eventInfo) {
            try {
                // Parse the date
                const eventDate = parseDateString(dateStr);
                if (!eventDate) {
                    errors.push({
                        error: true,
                        type: "ParseError",
                        reason: `Failed to parse date: "${dateStr}"`,
                        context: `Event: ${title}, URL: ${url}`,
                    } as ParseError);
                    continue;
                }

                // Fetch the detail page to get time and full description
                const eventRes = await fetchFn(url, {
                    headers: {
                        "User-Agent": "Mozilla/5.0 (compatible; 832events/1.0)",
                    },
                });

                let eventTime = LocalTime.of(11, 0); // Default to 11 AM
                let description = "";

                if (eventRes.ok) {
                    const eventHtml = await eventRes.text();
                    const eventRoot = parse(eventHtml);

                    // Extract time from content
                    const contentDiv = eventRoot.querySelector("main.content");
                    if (contentDiv) {
                        const contentText = contentDiv.outerHTML;
                        const extractedTime = extractTimeFromContent(contentText);
                        if (extractedTime) {
                            eventTime = extractedTime;
                        }

                        // Extract description from the main paragraph
                        const paragraphs = contentDiv.querySelectorAll("p");
                        if (paragraphs.length > 0) {
                            const firstP = paragraphs[0];
                            description = firstP.textContent?.trim() || "";
                        }
                    }
                } else {
                    errors.push({
                        error: true,
                        type: "ParseError",
                        reason: `Failed to fetch event detail page: HTTP ${eventRes.status}`,
                        context: `Event: ${title}, URL: ${url}`,
                    } as ParseError);
                }

                // Create the event
                const dateTime = LocalDateTime.of(eventDate, eventTime);
                const zonedDateTime = dateTime.atZone(ZoneId.of("America/Chicago"));

                const eventIdKey = hashEventId(title, eventDate.toString());

                // Avoid duplicates
                if (seenEventIds.has(eventIdKey)) {
                    continue;
                }
                seenEventIds.add(eventIdKey);

                const event: RipperCalendarEvent = {
                    id: eventIdKey,
                    summary: title,
                    date: zonedDateTime,
                    ripped: new Date(),
                    duration: Duration.ofHours(3),
                    location: VENUE_ADDRESS,
                    description: description,
                    url: url,
                };

                events.push(event);
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
