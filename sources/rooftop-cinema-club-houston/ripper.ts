/**
 * Ripper for Rooftop Cinema Club Houston
 * (https://rooftopcinemaclub.com/us/houston/uptown)
 *
 * Rooftop Cinema Club Uptown uses a modern React/Statamic site with:
 * - Screening detail pages at /us/houston/uptown/screenings/<slug>
 * - JSON-LD ScreeningEvent structured data embedded in each screening page
 * - Each screening has full event details: title, datetime, location, description
 *
 * Implementation strategy:
 * 1. Fetch the venue page to extract individual screening URLs
 * 2. For each screening, fetch the detail page and extract JSON-LD ScreeningEvent
 * 3. Parse dates/times from ISO 8601 format (e.g., "2026-07-01T19:00:00+00:00")
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

function slugify(s: string): string {
    return s
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "");
}

/**
 * Parse ISO 8601 datetime strings like "2026-07-01T19:00:00+00:00"
 * Returns ZonedDateTime in the venue timezone.
 */
function parseISO8601(dateStr: string, tz: ZoneId): ZonedDateTime | null {
    try {
        // ZonedDateTime.parse handles ISO 8601 with timezone
        const zdt = ZonedDateTime.parse(dateStr);
        // Convert to venue timezone
        return zdt.withZoneSameInstant(tz);
    } catch (e) {
        return null;
    }
}

/**
 * Extract JSON-LD ScreeningEvent from HTML
 */
function extractScreeningEventJSON(html: string): any {
    const matches = html.matchAll(/"@type":\s*"ScreeningEvent"/g);
    for (const match of matches) {
        // Find the start of this JSON block by searching backward for opening brace
        const startIdx = html.lastIndexOf("{", match.index);
        if (startIdx === -1) continue;

        // Find the matching closing brace
        let braceCount = 0;
        let endIdx = -1;
        for (let i = startIdx; i < html.length; i++) {
            if (html[i] === "{") braceCount++;
            if (html[i] === "}") braceCount--;
            if (braceCount === 0) {
                endIdx = i;
                break;
            }
        }

        if (endIdx === -1) continue;

        const jsonStr = html.substring(startIdx, endIdx + 1);
        try {
            return JSON.parse(jsonStr);
        } catch (e) {
            continue;
        }
    }
    return null;
}

export default class RooftopCinemaClubHoustonRipper implements IRipper {
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
                `Rooftop Cinema Club fetch failed: HTTP ${res.status} ${res.statusText}`,
            );
        }

        const html = await res.text();
        const doc = parse(html);

        const events: RipperCalendarEvent[] = [];
        const errors: RipperError[] = [];

        // Extract screening URLs from the venue page
        // Screenings appear as links like /us/houston/uptown/screenings/<slug>
        const screeningLinks = new Set<string>();
        const links = doc.querySelectorAll('a[href*="/screenings/"]');

        for (const link of links) {
            const href = link.getAttribute("href");
            if (href) {
                screeningLinks.add(href);
            }
        }

        // Fetch each screening page and extract event data
        for (const screeningUrl of screeningLinks) {
            const result = await this.fetchAndParseScreening(
                screeningUrl,
                fetchFn,
                tz,
                ripper.config.url.toString(),
            );

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
     * Fetch a screening page and extract event data from JSON-LD
     */
    private async fetchAndParseScreening(
        screeningUrl: string,
        fetchFn: (url: string, opts?: any) => Promise<Response>,
        tz: ZoneId,
        baseUrl: string,
    ): Promise<RipperCalendarEvent | RipperError> {
        const fullUrl = new URL(screeningUrl, baseUrl).toString();

        try {
            const res = await fetchFn(fullUrl, {
                headers: {
                    "User-Agent": "Mozilla/5.0 (compatible; 832events/1.0)",
                },
            });

            if (!res.ok) {
                return {
                    type: "ParseError" as const,
                    reason: `HTTP ${res.status} fetching ${screeningUrl}`,
                    context: screeningUrl,
                };
            }

            const html = await res.text();
            return this.parseScreening(html, tz, fullUrl);
        } catch (e) {
            return {
                type: "ParseError" as const,
                reason: `Error fetching ${screeningUrl}: ${String(e)}`,
                context: screeningUrl,
            };
        }
    }

    /**
     * Parse a screening page's JSON-LD ScreeningEvent data
     */
    private parseScreening(
        html: string,
        tz: ZoneId,
        sourceUrl: string,
    ): RipperCalendarEvent | RipperError {
        const eventData = extractScreeningEventJSON(html);

        if (!eventData) {
            return {
                type: "ParseError" as const,
                reason: "No ScreeningEvent JSON-LD found in page",
                context: sourceUrl,
            };
        }

        // Extract required fields
        const title = eventData.name;
        if (!title) {
            return {
                type: "ParseError" as const,
                reason: "ScreeningEvent has no name",
                context: sourceUrl,
            };
        }

        // Parse start date/time
        const startDateStr = eventData.startDate;
        if (!startDateStr) {
            return {
                type: "ParseError" as const,
                reason: `Event "${title}" has no startDate`,
                context: sourceUrl,
            };
        }

        const startDateTime = parseISO8601(startDateStr, tz);
        if (!startDateTime) {
            return {
                type: "ParseError" as const,
                reason: `Event "${title}" unparseable startDate: ${startDateStr}`,
                context: sourceUrl,
            };
        }

        // Parse end date/time
        let endDateTime = startDateTime.plusHours(2); // Default 2 hour duration
        if (eventData.endDate) {
            const parsed = parseISO8601(eventData.endDate, tz);
            if (parsed) {
                endDateTime = parsed;
            }
        }

        // Calculate duration
        const duration = Duration.between(
            startDateTime.toInstant(),
            endDateTime.toInstant(),
        );

        // Extract description
        let description = eventData.description || "";
        if (description) {
            // Clean up HTML entities if present
            description = description
                .replace(/&rsquo;/g, "'")
                .replace(/&ldquo;/g, '"')
                .replace(/&rdquo;/g, '"')
                .replace(/&nbsp;/g, " ")
                .trim();
        }

        // Create event ID from title and date for stability
        const eventId = `${slugify(title)}-${startDateTime.toLocalDate()}`;

        const event: RipperCalendarEvent = {
            id: eventId,
            ripped: new Date(),
            date: startDateTime,
            duration,
            summary: title,
            description,
            url: sourceUrl,
        };

        return event;
    }
}
