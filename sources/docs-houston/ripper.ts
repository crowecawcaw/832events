import { HTMLElement } from 'node-html-parser';
import { ZonedDateTime, ZoneId, Duration, LocalDateTime, LocalTime } from '@js-joda/core';
import '@js-joda/timezone';
import { HTMLRipper } from '../../lib/config/htmlscrapper.js';
import { RipperEvent, RipperCalendarEvent, ParseError } from '../../lib/config/schema.js';

interface TurntableShow {
    id: number;
    name: string;
    image?: string;
    description?: string;
    price_per_person?: string[];
    date: string; // YYYY-MM-DD
    time: string; // HH:MM
}

interface TurntablePerformance {
    id: number;
    datetime: string; // ISO 8601
    show_id: number;
    show: TurntableShow;
}

/**
 * Extract performances array from Pinia state.
 */
function extractPerformances(piniaState: Record<string, any>): TurntablePerformance[] {
    try {
        // Navigate the Pinia state structure to find performances
        if (piniaState.performancePaginate && piniaState.performancePaginate.performances) {
            return piniaState.performancePaginate.performances;
        }
        if (Array.isArray(piniaState.performances)) {
            return piniaState.performances;
        }
        // Try other common structures
        for (const key of Object.keys(piniaState)) {
            const val = (piniaState as Record<string, any>)[key];
            if (
                typeof val === 'object' &&
                val !== null &&
                Array.isArray(val.performances)
            ) {
                return val.performances;
            }
        }
    } catch (e) {
        // Extraction failed
    }
    return [];
}

/**
 * Parse a date string "YYYY-MM-DD" and time string "HH:MM" into ZonedDateTime.
 */
function parseShowDateTime(dateStr: string, timeStr: string, tz: ZoneId): ZonedDateTime | null {
    try {
        const [year, month, day] = dateStr.split('-').map(Number);
        const [hour, minute] = timeStr.split(':').map(Number);
        const ldt = LocalDateTime.of(year, month, day, hour, minute, 0);
        return ldt.atZone(tz);
    } catch {
        return null;
    }
}

/**
 * Parse a single Turntable performance into a RipperCalendarEvent or ParseError.
 *
 * Note: The performance object contains a `datetime` (ISO 8601) and a `show` object with name/image/description.
 * The show object does NOT include date/time; those come from the performance's datetime field.
 */
function parseSinglePerformance(perf: TurntablePerformance, tz: ZoneId): RipperCalendarEvent | ParseError {
    const show = perf.show;

    // Validate show exists and has required name
    if (!show || !show.name) {
        return {
            type: 'ParseError',
            reason: 'Missing required show fields (name)',
            context: `performance_id=${perf.id}`,
        };
    }

    // Parse the datetime from the performance (ISO 8601 string like "2026-06-19T00:00:00Z")
    let dateTime: ZonedDateTime | null = null;
    try {
        // Parse ISO 8601 datetime
        const isoString = perf.datetime;
        // Format: "2026-06-19T00:00:00Z" or "2026-06-20T02:30:00Z"
        const match = isoString.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})/);
        if (match) {
            const year = parseInt(match[1], 10);
            const month = parseInt(match[2], 10);
            const day = parseInt(match[3], 10);
            const hour = parseInt(match[4], 10);
            const minute = parseInt(match[5], 10);

            const ldt = LocalDateTime.of(year, month, day, hour, minute, 0);
            dateTime = ldt.atZone(tz);
        }
    } catch (e) {
        // Fallback: try to parse from show.date and show.time if available
        if (show.date && show.time) {
            dateTime = parseShowDateTime(show.date, show.time, tz);
        }
    }

    if (!dateTime) {
        return {
            type: 'ParseError',
            reason: `Could not parse datetime: ${perf.datetime}`,
            context: show.name,
        };
    }

    // Create stable ID from show_id and date
    const dateStr = `${dateTime.year()}-${String(dateTime.monthValue()).padStart(2, '0')}-${String(dateTime.dayOfMonth()).padStart(2, '0')}`;
    const id = `docs-houston-${perf.show_id}-${dateStr}-${perf.id}`;

    const event: RipperCalendarEvent = {
        id,
        ripped: new Date(),
        date: dateTime,
        duration: Duration.ofHours(2), // Typical show duration
        summary: show.name,
    };

    if (show.description) {
        event.description = show.description;
    }

    if (show.image) {
        event.imageUrl = show.image;
    }

    return event;
}

/**
 * Doc's Houston custom ripper for Turntable Tickets platform.
 *
 * Since Turntable Tickets embeds event data as JSON in a script tag,
 * we need to extract the raw HTML string to access this data properly.
 */
export default class DocsHoustonRipper extends HTMLRipper {
    private rawHtmlString: string = '';

    protected preprocessHtml(html: string): string {
        // Store the raw HTML for use in parseEvents
        this.rawHtmlString = html;
        return html;
    }

    protected async parseEvents(html: HTMLElement, date: ZonedDateTime, config: any): Promise<RipperEvent[]> {
        // Doc's Houston is in America/Chicago timezone
        const tz: ZoneId = ZoneId.of('America/Chicago');

        // Extract Pinia state from the raw HTML string
        const piniaState = extractPiniaStateFromRaw(this.rawHtmlString);
        const performances = extractPerformances(piniaState);

        if (performances.length === 0) {
            return [];
        }

        // Parse each performance
        return performances.map(perf => parseSinglePerformance(perf, tz));
    }
}

/**
 * Extract the Pinia state JSON from raw HTML string.
 */
function extractPiniaStateFromRaw(htmlString: string): Record<string, any> {
    try {
        // Extract just the JSON object from window.__pinia = {...};
        const match = htmlString.match(/window\.__pinia\s*=\s*(\{[\s\S]*?\});/);
        if (match && match[1]) {
            return JSON.parse(match[1]);
        }
    } catch (e) {
        // JSON parse failed, return empty
    }
    return {};
}
