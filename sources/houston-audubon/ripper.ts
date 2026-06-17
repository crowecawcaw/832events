/**
 * Ripper for Houston Audubon Society (https://houstonaudubon.org)
 *
 * Houston Audubon uses Firespring CMS for event management. Events are displayed
 * in an event calendar grid with individual event pages at URLs like:
 * https://houstonaudubon.org/programs/calendar.html/event/2026/07/18/event-slug/eventId
 *
 * Events contain structured data in JSON-LD format with:
 *   - Event name and description
 *   - startDate and endDate in ISO format
 *   - Location information
 *   - Event URL with stable ID at the end
 *
 * The ripper:
 * 1. Fetches the event calendar page
 * 2. Extracts event URLs from the calendar grid
 * 3. Fetches each event page and parses JSON-LD structured data
 * 4. Returns stable event IDs derived from URL path components
 */

import {
    Duration,
    LocalDateTime,
    LocalDate,
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

const DEFAULT_VENUE_ADDRESS = "6407 Westcott St, Houston, TX 77005";

interface EventLinkInfo {
    title: string;
    url: string;
    eventId: string;
}

function slugify(s: string): string {
    return s
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "");
}

/**
 * Extract event links from the calendar grid
 */
function extractEventLinks(html: string): EventLinkInfo[] {
    const root = parse(html);
    const events: EventLinkInfo[] = [];

    // Find all calendar event links: <a class="calendar-grid-event" ...>
    const eventLinks = root.querySelectorAll("a.calendar-grid-event");

    for (const link of eventLinks) {
        const href = link.getAttribute("href");
        if (!href) continue;

        // Extract title from the link
        const titleSpan = link.querySelector("span.calendar-grid-event__title");
        const title = titleSpan?.text.trim() || "";

        if (!title) continue;

        // Extract event ID from URL: /event/2026/07/18/slug/eventId
        // Format: https://houstonaudubon.org/programs/calendar.html/event/2026/07/18/slug/12345
        const eventIdMatch = href.match(/\/event\/\d{4}\/\d{2}\/\d{2}\/[^/]+\/(\d+)$/);
        const eventId = eventIdMatch ? eventIdMatch[1]! : "";

        if (!eventId) continue;

        // Make URL absolute if needed
        const absoluteUrl = href.startsWith("http")
            ? href
            : `https://houstonaudubon.org${href}`;

        events.push({
            title,
            url: absoluteUrl,
            eventId,
        });
    }

    return events;
}

/**
 * Parse event details from individual event page
 * Looks for JSON-LD structured data
 */
function parseEventFromPage(
    html: string,
    title: string,
    eventId: string,
): RipperCalendarEvent | RipperError {
    const root = parse(html);

    // Look for JSON-LD script tag with Event schema
    const scripts = root.querySelectorAll("script[type='application/ld+json']");
    let eventData: any = null;

    for (const script of scripts) {
        try {
            const json = JSON.parse(script.text);
            // Check if this is an Event schema
            if (json["@type"] === "Event" && json.name && json.startDate) {
                eventData = json;
                break;
            }
        } catch {
            // Continue to next script
        }
    }

    if (!eventData) {
        return {
            error: true,
            type: "ParseError",
            reason: "No Event JSON-LD found",
            context: title,
        } as ParseError;
    }

    try {
        // Parse start date
        const startDateStr = eventData.startDate;
        if (!startDateStr) {
            return {
                error: true,
                type: "ParseError",
                reason: "Missing startDate in JSON-LD",
                context: title,
            } as ParseError;
        }

        // startDate can be ISO 8601 format like "2026-07-18T17:30:00-05:00"
        // Parse the date/time manually to handle the timezone offset
        const dateTimePattern = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})/;
        const match = startDateStr.match(dateTimePattern);
        if (!match) {
            return {
                error: true,
                type: "ParseError",
                reason: `Invalid datetime format: "${startDateStr}"`,
                context: title,
            } as ParseError;
        }

        const year = parseInt(match[1]!, 10);
        const month = parseInt(match[2]!, 10);
        const day = parseInt(match[3]!, 10);
        const hour = parseInt(match[4]!, 10);
        const minute = parseInt(match[5]!, 10);
        const second = parseInt(match[6]!, 10);

        const tz = ZoneId.of("America/Chicago");
        const localDT = LocalDateTime.of(
            LocalDate.of(year, month, day),
            LocalTime.of(hour, minute, second),
        );
        const zonedStart = localDT.atZone(tz);

        // Calculate duration
        let duration = Duration.ofHours(2); // Default 2 hours
        if (eventData.endDate) {
            try {
                const endMatch = eventData.endDate.match(dateTimePattern);
                if (endMatch) {
                    const endYear = parseInt(endMatch[1]!, 10);
                    const endMonth = parseInt(endMatch[2]!, 10);
                    const endDay = parseInt(endMatch[3]!, 10);
                    const endHour = parseInt(endMatch[4]!, 10);
                    const endMinute = parseInt(endMatch[5]!, 10);
                    const endSecond = parseInt(endMatch[6]!, 10);

                    const endDT = LocalDateTime.of(
                        LocalDate.of(endYear, endMonth, endDay),
                        LocalTime.of(endHour, endMinute, endSecond),
                    );
                    const zonedEnd = endDT.atZone(tz);
                    const durationMs = zonedEnd.toInstant().toEpochMilli() -
                        zonedStart.toInstant().toEpochMilli();
                    if (durationMs > 0) {
                        duration = Duration.ofMillis(durationMs);
                    }
                }
            } catch {
                // Use default duration
            }
        }

        // Extract location
        let location = DEFAULT_VENUE_ADDRESS;
        if (eventData.location && eventData.location.name) {
            location = eventData.location.name;
        }

        // Extract description
        let description: string | undefined;
        if (eventData.description) {
            description = eventData.description.substring(0, 1000);
        }

        // Create stable ID from title and date
        const dateStr = zonedStart.toLocalDate().toString();
        const id = `${slugify(title)}-${dateStr}`;

        const event: RipperCalendarEvent = {
            id,
            ripped: new Date(),
            date: zonedStart,
            duration,
            summary: title,
            location,
            description,
            url: eventData.url || undefined,
        };

        return event;
    } catch (err) {
        return {
            error: true,
            type: "ParseError",
            reason: `Failed to parse event JSON-LD: ${err instanceof Error ? err.message : String(err)}`,
            context: title,
        } as ParseError;
    }
}

export default class HoustonAudubonRipper implements IRipper {
    public async rip(ripper: Ripper): Promise<RipperCalendar[]> {
        const fetchFn = getFetchForConfig(ripper.config);
        const cal = ripper.config.calendars[0]!;

        const res = await fetchFn(ripper.config.url.toString(), {
            headers: {
                "User-Agent": "Mozilla/5.0 (compatible; 832events/1.0)",
            },
        });

        if (!res.ok) {
            throw new Error(
                `Houston Audubon calendar fetch failed: HTTP ${res.status} ${res.statusText}`,
            );
        }

        const html = await res.text();
        const eventLinks = extractEventLinks(html);

        const events: RipperCalendarEvent[] = [];
        const errors: RipperError[] = [];
        const seenIds = new Set<string>();

        // Fetch and parse each event
        for (const linkInfo of eventLinks) {
            try {
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
                        context: `Event: ${linkInfo.title}, URL: ${linkInfo.url}`,
                    } as ParseError);
                    continue;
                }

                const eventHtml = await eventRes.text();
                const parsed = parseEventFromPage(eventHtml, linkInfo.title, linkInfo.eventId);

                if ("error" in parsed && parsed.error) {
                    errors.push(parsed as RipperError);
                } else {
                    const event = parsed as RipperCalendarEvent;
                    // Avoid duplicates
                    if (event.id && !seenIds.has(event.id)) {
                        seenIds.add(event.id);
                        event.url = linkInfo.url;
                        events.push(event);
                    }
                }
            } catch (err) {
                errors.push({
                    error: true,
                    type: "ParseError",
                    reason: `Exception fetching/parsing event: ${err instanceof Error ? err.message : String(err)}`,
                    context: `Event: ${linkInfo.title}, URL: ${linkInfo.url}`,
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
