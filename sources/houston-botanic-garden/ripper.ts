/**
 * Ripper for Houston Botanic Garden (https://hbg.org/events/)
 *
 * Houston Botanic Garden uses WordPress with a REST API for event listings.
 * Events are available at https://hbg.org/wp-json/wp/v2/event
 *
 * Challenge: The REST API only provides post publication date, not event dates.
 * Individual event pages exist at /event/{slug}/ but do not contain visible
 * event date/time information in the HTML or structured data.
 *
 * This ripper:
 * 1. Fetches all events from the REST API (paginated)
 * 2. Uses post dates as fallback (imperfect but prevents gaps)
 * 3. Emits UncertaintyErrors for missing event dates so the resolver can fill them
 * 4. Returns stable event IDs based on post slug
 */

import {
    Duration,
    LocalDateTime,
    ZoneId,
    ZonedDateTime,
} from "@js-joda/core";
import "@js-joda/timezone";
import { parse as parseHtml } from "node-html-parser";
import {
    IRipper,
    Ripper,
    RipperCalendar,
    RipperCalendarEvent,
    RipperError,
    RipperEvent,
} from "../../lib/config/schema.js";
import { getFetchForConfig } from "../../lib/config/proxy-fetch.js";

const DEFAULT_VENUE_ADDRESS = "Houston Botanic Garden, 346 New York Ave, Houston, TX 77003";
const DEFAULT_TIMEZONE = "America/Chicago";

interface WordPressEvent {
    id: number;
    slug: string;
    title: { rendered: string };
    excerpt: { rendered: string };
    link: string;
    date: string; // ISO 8601, but this is post date not event date
    featured_media?: number;
}

function htmlToPlainText(html: string): string {
    // Remove HTML tags and decode entities
    return html
        .replace(/<[^>]*>/g, "")
        .replace(/&nbsp;/g, " ")
        .replace(/&amp;/g, "&")
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/&quot;/g, '"')
        .replace(/&#[0-9]+;/g, "")
        .trim();
}

/**
 * Attempt to extract event date from the event page HTML.
 * Returns null if no date can be found.
 */
async function extractEventDateFromPage(
    eventUrl: string,
    fetchFn: (url: string, opts?: any) => Promise<Response>,
): Promise<string | null> {
    try {
        const res = await fetchFn(eventUrl, {
            headers: { "User-Agent": "Mozilla/5.0 (compatible; 832events/1.0)" },
        });
        if (!res.ok) return null;

        const html = await res.text();
        const root = parseHtml(html);

        // Look for common date patterns in the page
        // Check for meta tags with event date
        const dateMetaTags = root.querySelectorAll("meta[property*='date'], meta[name*='date']");
        for (const tag of dateMetaTags) {
            const content = tag.getAttribute("content");
            if (content && /\d{4}-\d{2}-\d{2}/.test(content)) {
                return content;
            }
        }

        // Look for JSON-LD structured data
        const scripts = root.querySelectorAll("script[type='application/ld+json']");
        for (const script of scripts) {
            try {
                const data = JSON.parse(script.text);
                if (data.startDate && /\d{4}-\d{2}-\d{2}/.test(data.startDate)) {
                    return data.startDate;
                }
                // Handle @graph format
                if (Array.isArray(data["@graph"])) {
                    for (const item of data["@graph"]) {
                        if (item.startDate && /\d{4}-\d{2}-\d{2}/.test(item.startDate)) {
                            return item.startDate;
                        }
                    }
                }
            } catch {
                // Continue to next script
            }
        }

        return null;
    } catch {
        return null;
    }
}

export default class HoustonBotanicGardenRipper implements IRipper {
    public async rip(ripper: Ripper): Promise<RipperCalendar[]> {
        const fetchFn = getFetchForConfig(ripper.config);
        const cal = ripper.config.calendars[0]!;
        const tz = ZoneId.of(DEFAULT_TIMEZONE);

        const events: RipperCalendarEvent[] = [];
        const errors: RipperError[] = [];

        // Fetch all events from the REST API (paginated)
        let page = 1;
        let hasMore = true;
        const pageSize = 100;
        let totalFetched = 0;

        while (hasMore) {
            const url = `${ripper.config.url.toString()}?per_page=${pageSize}&page=${page}&orderby=date&order=desc`;

            const res = await fetchFn(url, {
                headers: { "User-Agent": "Mozilla/5.0 (compatible; 832events/1.0)" },
            });

            if (!res.ok) {
                errors.push({
                    type: "ParseError",
                    reason: `API request failed: HTTP ${res.status}`,
                    context: "Houston Botanic Garden REST API",
                });
                break;
            }

            const wpEvents: WordPressEvent[] = await res.json();
            if (!Array.isArray(wpEvents) || wpEvents.length === 0) {
                hasMore = false;
                break;
            }

            // Safety check: stop if we've reached a reasonable limit
            if (totalFetched + wpEvents.length > 500) {
                // Process remaining events up to the limit
                const remaining = 500 - totalFetched;
                wpEvents.splice(remaining);
                if (remaining <= 0) {
                    hasMore = false;
                }
            }

            for (const wpEvent of wpEvents) {
                try {
                    const title = htmlToPlainText(wpEvent.title.rendered);
                    if (!title) continue;

                    // Use post date as fallback; emit UncertaintyError for actual event date
                    const postDate = wpEvent.date;
                    let eventDate: ZonedDateTime;

                    try {
                        // Parse ISO 8601 date: "2026-06-15T10:57:42"
                        const dt = LocalDateTime.parse(postDate.split("T")[0] + "T12:00:00");
                        eventDate = ZonedDateTime.of(dt, tz);
                    } catch {
                        // Skip events with unparseable dates
                        errors.push({
                            type: "ParseError",
                            reason: `Unparseable post date: ${postDate}`,
                            context: title,
                        });
                        continue;
                    }

                    // Extract description from excerpt
                    const description = htmlToPlainText(wpEvent.excerpt.rendered).substring(0, 500) || undefined;

                    // Create stable ID based on post slug
                    const id = wpEvent.slug;

                    const event: RipperCalendarEvent = {
                        id,
                        ripped: new Date(),
                        date: eventDate,
                        duration: Duration.ofHours(2), // Default 2-hour duration
                        summary: title,
                        location: DEFAULT_VENUE_ADDRESS,
                        description,
                        url: wpEvent.link,
                    };

                    events.push(event);

                    // Emit uncertainty error for event date since we couldn't extract it
                    const uncertaintyError = {
                        type: "UncertaintyError",
                        reason: "Event date not available from API; using post date as placeholder",
                        context: title,
                        field: "startDate",
                        event: event,
                        unknownFields: ["startDate", "duration"],
                    };
                    errors.push(uncertaintyError as any);
                } catch (e) {
                    errors.push({
                        type: "ParseError",
                        reason: `Exception processing event: ${String(e)}`,
                        context: wpEvent.title.rendered,
                    });
                }
            }

            totalFetched += wpEvents.length;
            page++;
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
