/**
 * Ripper for HTXoutdoors (https://htxoutdoors.com/)
 *
 * HTXoutdoors uses Event Espresso 4 for event management. The site features
 * outdoor recreation activities across the Houston area including:
 * - Hiking
 * - Kayaking
 * - Trail running
 * - Cycling
 * - Climbing
 * - Water sports
 * - Team sports
 * - DIY activities
 * - Overnight/travel events
 * - Training activities
 *
 * The events are fetched via the Event Espresso 4 AJAX API endpoint which
 * returns JSON with rich event data including title, dates, descriptions,
 * activity types, and event images.
 *
 * Note: This is a multi-location, community-driven calendar (geo: null).
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
 * Parse ISO 8601 datetime string with timezone (e.g., "2026-05-30T19:50:00-05:00")
 * into a ZonedDateTime.
 */
function parseISO8601(dateTimeStr: string, tz: ZoneId): ZonedDateTime | null {
    try {
        // Match ISO 8601 format with optional timezone offset
        const match = dateTimeStr.match(
            /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})([+-]\d{2}:\d{2})?$/
        );
        if (!match) {
            return null;
        }

        const year = parseInt(match[1]!, 10);
        const month = parseInt(match[2]!, 10);
        const day = parseInt(match[3]!, 10);
        const hour = parseInt(match[4]!, 10);
        const minute = parseInt(match[5]!, 10);
        const second = parseInt(match[6]!, 10);

        const localDateTime = LocalDateTime.of(year, month, day, hour, minute, second);
        return ZonedDateTime.of(localDateTime, tz);
    } catch {
        return null;
    }
}

/**
 * Decode HTML entities (e.g., &amp; → &, &nbsp; → space)
 */
function decodeHtmlEntities(text: string): string {
    const entities: Record<string, string> = {
        "&amp;": "&",
        "&lt;": "<",
        "&gt;": ">",
        "&quot;": '"',
        "&#39;": "'",
        "&nbsp;": " ",
        "&copy;": "©",
        "&reg;": "®",
    };

    return text.replace(/&[a-zA-Z]+;|&#\d+;/g, (match) => {
        if (match === "&#39;" || match === "&#x27;") return "'";
        if (match.startsWith("&#")) {
            const code = parseInt(match.slice(2, -1), 10);
            return String.fromCharCode(code);
        }
        return entities[match] || match;
    });
}

/**
 * Strip HTML tags from a string.
 */
function stripHtml(html: string): string {
    return html.replace(/<[^>]*>/g, "").trim();
}

interface EventEspresso4Event {
    id?: number | string;
    title: string;
    start: string; // ISO 8601 format
    end?: string; // ISO 8601 format
    target_date?: string; // YYYY-MM-DD format
    event_time_no_tags?: string; // Human-readable time (e.g., "7:50 pm - 9:30 pm")
    eventType?: string; // Activity type (hiking, cycling, etc.)
    description?: string; // HTML-encoded description
    url?: string; // Event details page URL
    className?: string; // Space-separated CSS classes
    event_img_thumb?: string; // HTML thumbnail markup or empty string
    event_days?: number; // Duration (1 for single day, 2+ for multi-day)
}

/**
 * Extract events from Event Espresso 4 AJAX API response.
 * Exported for testing.
 */
export function parseEvents(
    jsonStr: string,
    tz: ZoneId,
    sourceName: string
): (RipperCalendarEvent | RipperError)[] {
    const events: RipperCalendarEvent[] = [];
    const errors: RipperError[] = [];

    try {
        // Parse the JSON response - should be an array of events
        let data: EventEspresso4Event[] = [];

        try {
            const parsed = JSON.parse(jsonStr);
            // API response can be an array or an object with events array
            data = Array.isArray(parsed) ? parsed : parsed.events || [];
        } catch (e) {
            errors.push({
                type: "ParseError",
                reason: `Failed to parse JSON response: ${e instanceof Error ? e.message : String(e)}`,
                context: undefined,
            });
            return errors;
        }

        if (!Array.isArray(data) || data.length === 0) {
            errors.push({
                type: "ParseError",
                reason: "API response is empty or not an array of events",
                context: undefined,
            });
            return errors;
        }

        const seenIds = new Set<string>();

        for (const eventData of data) {
            try {
                // Extract title (required)
                const title = eventData.title?.trim();
                if (!title) {
                    errors.push({
                        type: "ParseError",
                        reason: "Event missing title",
                        context: JSON.stringify(eventData).slice(0, 100),
                    });
                    continue;
                }

                // Extract start datetime (required)
                const startStr = eventData.start;
                if (!startStr) {
                    errors.push({
                        type: "ParseError",
                        reason: `Event "${title}" missing start datetime`,
                        context: JSON.stringify(eventData).slice(0, 100),
                    });
                    continue;
                }

                const startDateTime = parseISO8601(startStr, tz);
                if (!startDateTime) {
                    errors.push({
                        type: "ParseError",
                        reason: `Could not parse start datetime "${startStr}" for "${title}"`,
                        context: startStr,
                    });
                    continue;
                }

                // Parse end datetime if present
                let endDateTime: ZonedDateTime | null = null;
                let duration: Duration | null = null;

                if (eventData.end) {
                    endDateTime = parseISO8601(eventData.end, tz);
                    if (endDateTime) {
                        // Calculate duration between start and end
                        const startMs = startDateTime.toInstant().toEpochMilli();
                        const endMs = endDateTime.toInstant().toEpochMilli();
                        const durationMs = Math.max(0, endMs - startMs);
                        duration = Duration.ofMillis(durationMs);
                    }
                }

                // Default to 2-hour duration if not calculable
                if (!duration) {
                    duration = Duration.ofHours(2);
                }

                // Create stable ID from title and date (not timestamp)
                const dateStr = startDateTime.toLocalDate().toString();
                const id = `${slugify(title)}-${dateStr}`;

                // Skip duplicates
                if (seenIds.has(id)) {
                    continue;
                }
                seenIds.add(id);

                // Extract description
                let description = eventData.description ? stripHtml(decodeHtmlEntities(eventData.description)) : undefined;

                // Add activity type to description if available
                if (eventData.eventType) {
                    const typeStr = eventData.eventType;
                    if (description) {
                        description = `[${typeStr}]\n${description}`;
                    } else {
                        description = typeStr;
                    }
                }

                // Extract location from description or use undefined for multi-location
                // The API doesn't provide explicit location field, so it would need to be
                // extracted from description or individual event pages
                let location: string | undefined = undefined;

                // Try to extract location hints from the event data or description
                // For now, leave undefined since events are multi-location

                // Extract image URL from thumbnail HTML if present
                let imageUrl: string | undefined;
                if (eventData.event_img_thumb && eventData.event_img_thumb.trim()) {
                    // Extract src from img tag within the thumbnail HTML
                    const imgMatch = eventData.event_img_thumb.match(/src=["']([^"']+)["']/);
                    if (imgMatch) {
                        imageUrl = imgMatch[1];
                    }
                }

                // Extract event URL if available
                let url: string | undefined = eventData.url;

                const event: RipperCalendarEvent = {
                    id,
                    ripped: new Date(),
                    date: startDateTime,
                    duration,
                    summary: title,
                    location,
                    description,
                    imageUrl,
                    url,
                };

                events.push(event);
            } catch (e) {
                errors.push({
                    type: "ParseError",
                    reason: `Failed to parse event: ${e instanceof Error ? e.message : String(e)}`,
                    context: JSON.stringify(eventData).slice(0, 100),
                });
            }
        }

        return [...events, ...errors];
    } catch (e) {
        errors.push({
            type: "ParseError",
            reason: `Unexpected error parsing events: ${e instanceof Error ? e.message : String(e)}`,
            context: undefined,
        });
        return errors;
    }
}

export default class HTXoutdoorsRipper implements IRipper {
    public async rip(ripper: Ripper): Promise<RipperCalendar[]> {
        const fetchFn = getFetchForConfig(ripper.config);
        const cal = ripper.config.calendars[0]!;
        const tz = ZoneId.of(cal.timezone.id());

        // Calculate date range for API request (3 months in future)
        const now = new Date();
        const startDate = Math.floor(now.getTime() / 1000); // Unix timestamp in seconds
        const endDate = Math.floor(now.getTime() / 1000) + 90 * 24 * 60 * 60; // 90 days ahead

        // Build API URL
        const apiUrl = new URL(
            "https://htxoutdoors.com/wp-admin/admin-ajax.php"
        );
        apiUrl.searchParams.set("action", "get_calendar_events");
        apiUrl.searchParams.set("start_date", startDate.toString());
        apiUrl.searchParams.set("end_date", endDate.toString());
        apiUrl.searchParams.set("show_expired", "true");
        apiUrl.searchParams.set("noheader", "true");

        const res = await fetchFn(apiUrl.toString(), {
            headers: {
                "User-Agent": "Mozilla/5.0 (compatible; 832events/1.0)",
                Referer: "https://htxoutdoors.com/",
            },
        });

        if (!res.ok) {
            throw new Error(
                `HTXoutdoors API fetch failed: HTTP ${res.status} ${res.statusText}`
            );
        }

        const jsonText = await res.text();
        const results = parseEvents(jsonText, tz, ripper.config.name);

        const events = results.filter((r) => "date" in r) as RipperCalendarEvent[];
        const errors = results.filter((r) => "type" in r) as RipperError[];

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
