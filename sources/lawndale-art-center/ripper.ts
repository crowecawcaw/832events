/**
 * Lawndale Art Center — custom HTML ripper.
 *
 * The site (lawndaleartcenter.org) is a WordPress + custom theme. The events
 * listing at /events/ renders server-side HTML with no <time datetime="...">
 * attribute. Dates appear as human-readable text in two elements per event:
 *
 *   <span class="event-day">July&nbsp;18</span>   (month + non-breaking space + day)
 *   <div class="event-time">2:00 pm</div>         (12-hour time)
 *
 * The year is inferred from the calendar widget: it shows the current displayed
 * month (e.g., "June&nbsp;2026") and navigation links like
 * /events/2026/07/ that encode the year. We build a month-name → year map from
 * those links so events in any listed month resolve to the correct year.
 *
 * Selectors used:
 *   article.event-item          — one per event
 *   span.event-day              — "MonthName Day"
 *   .event-time                 — "H:MM am/pm"  (may be absent → default 18:00)
 *   h2.event-title > a          — title text + href
 *   img.event-image-img[data-src] — event image (lazy-loaded)
 */

import { Duration, LocalDate, LocalDateTime, LocalTime, Month, ZoneId, ZonedDateTime } from '@js-joda/core';
import '@js-joda/timezone';
import { parse } from 'node-html-parser';
import { getFetchForConfig } from '../../lib/config/proxy-fetch.js';
import { IRipper, ParseError, Ripper, RipperCalendar, RipperCalendarEvent, RipperError } from '../../lib/config/schema.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function slugify(text: string): string {
    return text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

const MONTH_NAMES: Record<string, number> = {
    january: 1, february: 2, march: 3, april: 4,
    may: 5, june: 6, july: 7, august: 8,
    september: 9, october: 10, november: 11, december: 12,
};

/**
 * Parse a 12-hour time string like "2:00 pm" or "10:30 am" into {hour, minute}.
 * Returns null if unparseable.
 */
function parseTime12h(raw: string): { hour: number; minute: number } | null {
    const m = raw.trim().match(/^(\d{1,2}):(\d{2})\s*(am|pm)$/i);
    if (!m) return null;
    let hour = parseInt(m[1]!, 10);
    const minute = parseInt(m[2]!, 10);
    const period = m[3]!.toLowerCase();
    if (period === 'am') {
        if (hour === 12) hour = 0;
    } else {
        if (hour !== 12) hour += 12;
    }
    return { hour, minute };
}

/**
 * Build a map from lowercase month name → year by scanning navigation links
 * in the calendar widget (e.g. href="/events/2026/07/").
 *
 * If no links are found, falls back to a current-year heuristic.
 */
function buildMonthYearMap(htmlStr: string): Map<number, number> {
    const result = new Map<number, number>();
    // Scan all href="/events/YYYY/MM/" patterns in the page
    const re = /\/events\/(\d{4})\/(\d{2})\//g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(htmlStr)) !== null) {
        const year = parseInt(m[1]!, 10);
        const month = parseInt(m[2]!, 10);
        if (!result.has(month)) {
            result.set(month, year);
        }
    }
    return result;
}

/**
 * Given a month number and a map of known month→year mappings, return the best
 * guess year for that month. Falls back to current year + forward-looking logic
 * when the month is not in the map.
 */
function resolveYear(monthNum: number, monthYearMap: Map<number, number>): number {
    const mapped = monthYearMap.get(monthNum);
    if (mapped !== undefined) return mapped;

    // Fallback: if the month hasn't passed this year, use this year; else next year.
    const now = LocalDate.now();
    const currentYear = now.year();
    const currentMonth = now.monthValue();
    return monthNum >= currentMonth ? currentYear : currentYear + 1;
}

// ---------------------------------------------------------------------------
// Core parse function (pure — no network calls)
// ---------------------------------------------------------------------------

export function parseEvents(
    html: string,
    timezone: ZoneId,
    source: string,
): Array<RipperCalendarEvent | RipperError> {
    const root = parse(html);
    const monthYearMap = buildMonthYearMap(html);

    const results: Array<RipperCalendarEvent | RipperError> = [];

    const articles = root.querySelectorAll('article.event-item');
    for (const article of articles) {
        // --- Title ---
        const titleAnchor = article.querySelector('h2.event-title a');
        const title = titleAnchor?.text.trim().replace(/ /g, ' ') ?? '';
        const eventUrl = titleAnchor?.getAttribute('href') ?? undefined;

        if (!title) {
            results.push({
                type: 'ParseError',
                reason: 'Event has no title',
                context: article.toString().slice(0, 200),
            } satisfies ParseError);
            continue;
        }

        // --- Date: "July 18" or "August 1" ---
        const eventDayEl = article.querySelector('.event-day');
        const dayRaw = eventDayEl?.text.trim().replace(/ /g, ' ') ?? '';
        // dayRaw example: "July 18"
        const dayMatch = dayRaw.match(/^(\w+)\s+(\d{1,2})$/);
        if (!dayMatch) {
            results.push({
                type: 'ParseError',
                reason: `Cannot parse event date: "${dayRaw}"`,
                context: title,
            } satisfies ParseError);
            continue;
        }
        const monthName = dayMatch[1]!.toLowerCase();
        const dayOfMonth = parseInt(dayMatch[2]!, 10);
        const monthNum = MONTH_NAMES[monthName];
        if (!monthNum) {
            results.push({
                type: 'ParseError',
                reason: `Unknown month name: "${dayMatch[1]}"`,
                context: title,
            } satisfies ParseError);
            continue;
        }
        const year = resolveYear(monthNum, monthYearMap);

        // --- Time: "2:00 pm" ---
        const timeEl = article.querySelector('.event-time');
        const timeRaw = timeEl?.text.trim() ?? '';
        const parsedTime = parseTime12h(timeRaw);
        const { hour, minute } = parsedTime ?? { hour: 18, minute: 0 };

        // --- Build ZonedDateTime ---
        let date: ZonedDateTime;
        try {
            date = ZonedDateTime.of(
                LocalDateTime.of(year, monthNum, dayOfMonth, hour, minute),
                timezone,
            );
        } catch (e) {
            results.push({
                type: 'ParseError',
                reason: `Invalid date: ${year}-${monthNum}-${dayOfMonth} ${hour}:${minute} — ${e}`,
                context: title,
            } satisfies ParseError);
            continue;
        }

        // --- Image (lazy-loaded, data-src) ---
        const imgEl = article.querySelector('img.event-image-img');
        const imageUrl = imgEl?.getAttribute('data-src') ?? undefined;

        // --- Stable ID ---
        const id = `${slugify(title)}-${date.toLocalDate().toString()}`;

        const event: RipperCalendarEvent = {
            id,
            ripped: new Date(),
            date,
            duration: Duration.ofHours(2),
            summary: title,
            url: eventUrl,
            imageUrl,
        };
        results.push(event);
    }

    return results;
}

// ---------------------------------------------------------------------------
// IRipper implementation
// ---------------------------------------------------------------------------

export default class LawndaleArtCenterRipper implements IRipper {
    public async rip(ripper: Ripper): Promise<RipperCalendar[]> {
        const fetchFn = getFetchForConfig(ripper.config);
        const cal = ripper.config.calendars[0]!;
        const timezone = ZoneId.of(cal.timezone.id());

        const res = await fetchFn(ripper.config.url.toString(), {
            headers: {
                'User-Agent': 'Mozilla/5.0 (compatible; 832events/1.0)',
            },
        });
        if (!res.ok) {
            throw new Error(`${ripper.config.url} returned HTTP ${res.status}`);
        }

        const html = await res.text();
        const all = parseEvents(html, timezone, ripper.config.name);

        const events: RipperCalendarEvent[] = [];
        const errors: RipperError[] = [];
        for (const item of all) {
            if ('date' in item) {
                events.push(item);
            } else {
                errors.push(item);
            }
        }

        return [{
            name: cal.name,
            friendlyname: cal.friendlyname,
            events,
            errors,
            tags: ripper.config.tags ?? [],
            parent: ripper.config,
        }];
    }
}
