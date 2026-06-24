/**
 * Ripper for Karbach Brewing Company (https://www.karbachbrewing.com/community/events/)
 *
 * The site's events page lists events in a carousel/grid format with event cards.
 * Each event card contains:
 *   - Link to event detail page (/community/event/<slug>/)
 *   - Event title in h1
 *   - Event date in time element
 *   - Featured image (background-image or img src)
 *
 * The ripper:
 * 1. Fetches the main events page
 * 2. Extracts event links and basic info
 * 3. Fetches each event detail page to parse full date/time and description
 * 4. Returns stable event IDs based on title + date
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
import crypto from "crypto";

const VENUE_ADDRESS = "2032 Karbach St, Houston, TX 77020";

function slugify(s: string): string {
    return s
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "");
}

export function hashEventId(title: string, dateStr: string): string {
    const key = `${slugify(title)}-${dateStr}`;
    const hash = crypto
        .createHash("sha256")
        .update(key)
        .digest("hex")
        .substring(0, 8);
    return `${key}-${hash}`;
}

/**
 * Extract event links from the main events listing page
 * Returns a Map of event title -> event URL
 */
function extractEventLinks(html: string): Map<string, { url: string; dateStr: string; image?: string }> {
    const root = parse(html);
    const links = new Map<string, { url: string; dateStr: string; image?: string }>();

    // Look for article elements with event info
    const articles = root.querySelectorAll("article.article");

    articles.forEach((article) => {
        // Get the event link and title
        const titleLink = article.querySelector("h1 a");
        if (!titleLink) return;

        const href = titleLink.getAttribute("href");
        const title = titleLink.text.trim();

        if (!href || !title) return;

        // Get the event date
        const timeEl = article.querySelector("time");
        const dateText = timeEl ? timeEl.text.trim() : "";

        // Try to get the image from background-image style or img src
        let image: string | undefined;
        const thumbEl = article.querySelector("a.thumb");
        if (thumbEl) {
            const style = thumbEl.getAttribute("style");
            if (style) {
                const match = style.match(/url\(([^)]+)\)/);
                if (match) {
                    image = match[1];
                }
            }
        }

        links.set(title, {
            url: href.startsWith("http") ? href : `https://www.karbachbrewing.com${href}`,
            dateStr: dateText,
            image,
        });
    });

    return links;
}

/**
 * Parse date string like "June 11, 2026" into LocalDate
 */
function parseEventDate(dateStr: string): LocalDate | null {
    // Match patterns like "June 11, 2026" or "Jun 11, 2026"
    const monthMatch = dateStr.match(
        /(January|February|March|April|May|June|July|August|September|October|November|December|Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)\s+(\d{1,2}),?\s+(\d{4})/i
    );

    if (!monthMatch) {
        return null;
    }

    const monthStr = monthMatch[1];
    const day = parseInt(monthMatch[2], 10);
    const year = parseInt(monthMatch[3], 10);

    const monthMap: Record<string, number> = {
        january: 1, february: 2, march: 3, april: 4, may: 5, june: 6,
        july: 7, august: 8, september: 9, october: 10, november: 11, december: 12,
        jan: 1, feb: 2, mar: 3, apr: 4, jun: 6, jul: 7, aug: 8,
        sep: 9, sept: 9, oct: 10, nov: 11, dec: 12,
    };

    const month = monthMap[monthStr.toLowerCase()];
    if (!month || day < 1 || day > 31 || year < 2000 || year > 2100) {
        return null;
    }

    try {
        return LocalDate.of(year, month, day);
    } catch {
        return null;
    }
}

/**
 * Extract start time from event detail page content
 * Looks for patterns like "11:00 AM", "2:00 PM", etc.
 */
function extractStartTime(html: string): LocalTime | null {
    // Look for time patterns in the content
    const timeMatch = html.match(/(\d{1,2}):(\d{2})\s*(AM|PM|am|pm)/);
    if (!timeMatch) {
        return null;
    }

    let hour = parseInt(timeMatch[1], 10);
    const minute = parseInt(timeMatch[2], 10);
    const meridiem = timeMatch[3].toLowerCase();

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
 * Extract event description from detail page
 */
function extractDescription(html: string): string {
    const root = parse(html);

    // Try to find the description paragraph(s) in the details section
    const details = root.querySelector(".event .details");
    if (!details) return "";

    // Get the first paragraph(s) as description
    const firstP = details.querySelector("p");
    if (firstP) {
        return firstP.text.trim().substring(0, 500); // Limit to 500 chars
    }

    return "";
}

/**
 * Extract featured image URL from event detail page
 */
function extractImage(html: string): string | undefined {
    const root = parse(html);

    // Look for featured image
    const featuredImg = root.querySelector(".featured-image img");
    if (featuredImg) {
        const src = featuredImg.getAttribute("src");
        if (src) {
            return src.startsWith("http") ? src : `https://www.karbachbrewing.com${src}`;
        }
    }

    // Try background image
    const bgDiv = root.querySelector(".featured-image[style]");
    if (bgDiv) {
        const style = bgDiv.getAttribute("style");
        if (style) {
            const match = style.match(/url\(([^)]+)\)/);
            if (match) {
                const url = match[1].replace(/^\//, "https://www.karbachbrewing.com/");
                return url;
            }
        }
    }

    return undefined;
}

export default class KarbachBrewingCompanyRipper implements IRipper {
    public async rip(ripper: Ripper): Promise<RipperCalendar[]> {
        const fetchFn = getFetchForConfig(ripper.config);
        const cal = ripper.config.calendars[0]!;

        // Fetch the main events page
        const res = await fetchFn(ripper.config.url.toString(), {
            headers: {
                "User-Agent": "Mozilla/5.0 (compatible; 832events/1.0)",
            },
        });

        if (!res.ok) {
            throw new Error(
                `Karbach Brewing Company events page failed: HTTP ${res.status} ${res.statusText}`,
            );
        }

        const html = await res.text();
        const eventLinks = extractEventLinks(html);

        const events: RipperCalendarEvent[] = [];
        const errors: RipperError[] = [];

        // Fetch each event detail page
        for (const [title, linkInfo] of eventLinks) {
            try {
                // Try to parse the event date from the listing page first
                const eventDate = parseEventDate(linkInfo.dateStr);
                if (!eventDate) {
                    // This event doesn't have a parseable date (e.g., "Every Thursday", "Bi-weekly")
                    // Skip it silently — these are recurring events managed elsewhere
                    continue;
                }

                const eventRes = await fetchFn(linkInfo.url, {
                    headers: {
                        "User-Agent": "Mozilla/5.0 (compatible; 832events/1.0)",
                    },
                });

                if (!eventRes.ok) {
                    errors.push({
                        error: true,
                        type: "ParseError",
                        reason: `Failed to fetch event page: HTTP ${eventRes.status}`,
                        context: `Event: ${title}, URL: ${linkInfo.url}`,
                    } as ParseError);
                    continue;
                }

                const eventHtml = await eventRes.text();

                // Extract start time (default to 11:00 AM if not found)
                const startTime = extractStartTime(eventHtml) || LocalTime.of(11, 0);

                // Create the event
                const dateTime = LocalDateTime.of(eventDate, startTime);
                const zonedDateTime = dateTime.atZone(ZoneId.of("America/Chicago"));

                const eventIdKey = hashEventId(title, eventDate.toString());

                const event: RipperCalendarEvent = {
                    id: eventIdKey,
                    summary: title,
                    date: zonedDateTime,
                    ripped: new Date(),
                    duration: Duration.ofHours(3),
                    location: VENUE_ADDRESS,
                    description: extractDescription(eventHtml),
                    url: linkInfo.url,
                    imageUrl: linkInfo.image || extractImage(eventHtml),
                };

                events.push(event);
            } catch (err) {
                errors.push({
                    error: true,
                    type: "ParseError",
                    reason: `Exception fetching/parsing event: ${err instanceof Error ? err.message : String(err)}`,
                    context: `Event: ${title}, URL: ${linkInfo.url}`,
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
