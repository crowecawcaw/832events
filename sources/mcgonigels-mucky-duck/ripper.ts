import { ZonedDateTime, ZoneId, Duration, LocalDateTime, DateTimeFormatter } from '@js-joda/core';
import '@js-joda/timezone';
import { IRipper, Ripper, RipperCalendar, RipperCalendarEvent, RipperError, RipperEvent, ParseError } from '../../lib/config/schema.js';
import { getFetchForConfig } from '../../lib/config/proxy-fetch.js';

// Date format used by Tessera Events: "MM/DD/YYYY H:MM am/pm" (12-hour, no leading zero on hour)
// Examples: "06/15/2026 6:00 pm", "06/16/2026 7:00 pm", "06/17/2026 7:30 pm"

/**
 * Parse a Tessera "MM/DD/YYYY H:MM am/pm" date string into a ZonedDateTime.
 * Returns null if parsing fails.
 */
function parseTesseraDate(eventDate: string, tz: ZoneId): ZonedDateTime | null {
    const m = eventDate.trim().match(/^(\d{2})\/(\d{2})\/(\d{4})\s+(\d{1,2}):(\d{2})\s*(am|pm)$/i);
    if (!m) return null;

    const month = parseInt(m[1], 10);
    const day = parseInt(m[2], 10);
    const year = parseInt(m[3], 10);
    let hour = parseInt(m[4], 10);
    const minute = parseInt(m[5], 10);
    const ampm = m[6].toLowerCase();

    if (ampm === 'pm' && hour !== 12) hour += 12;
    if (ampm === 'am' && hour === 12) hour = 0;

    try {
        const ldt = LocalDateTime.of(year, month, day, hour, minute, 0);
        return ldt.atZone(tz);
    } catch {
        return null;
    }
}

/**
 * Slugify a string for use in stable event IDs.
 * Lowercases, replaces non-alphanumeric runs with hyphens, trims edge hyphens.
 */
function slugify(s: string): string {
    return s
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');
}

/**
 * Represents one parsed Tessera event object and the URL extracted from
 * its show card.
 */
interface TesseraEvent {
    id: number;
    eventDate: string;
    mainArtist: string[];
    image: string;
    showUrl: string | undefined;
}

/**
 * Extract visible Tessera event blocks from the HTML page.
 *
 * McGonigel's embeds each event as:
 *   <!-- Card Col -->
 *   <div class="col ">   ← visible (no "d-none")
 *     <div class="card ... tessera-show-card" id="NNNN" ...>
 *       <a href="https://www.mcgonigels.com/shows/slug/">...</a>
 *     </div>
 *   </div>
 *   <script>
 *     eventObjects.push({
 *       "id": NNNN,
 *       "eventDate": "MM/DD/YYYY H:MM am/pm",
 *       "mainArtist": ["Artist Name"],
 *       ...
 *     });
 *   </script>
 *
 * Hidden duplicates (recurring events shown under multiple dates) have
 * class="col d-none" and are excluded.
 */
function extractEvents(html: string): TesseraEvent[] {
    const events: TesseraEvent[] = [];

    // Match each visible card block (not d-none) through to its eventObjects.push
    // The block structure is: <!-- Card Col --> <div class="col "> ... eventObjects.push({...});
    const blockRe = /<!-- Card Col -->\s*<div class="col ">.*?eventObjects\.push\(\{([^}]+)\}\)/gs;

    let match: RegExpExecArray | null;
    while ((match = blockRe.exec(html)) !== null) {
        const fullBlock = match[0];
        const pushBody = match[1];

        // Extract fields from the JSON-ish push body
        const idMatch = pushBody.match(/"id":\s*(\d+)/);
        const dateMatch = pushBody.match(/"eventDate":\s*"([^"]+)"/);
        const artistMatch = pushBody.match(/"mainArtist":\s*\["((?:[^"\\]|\\.)*)"/);
        const imageMatch = pushBody.match(/"image":\s*"([^"]+)"/);

        if (!idMatch || !dateMatch || !artistMatch) continue;

        // Unescape any backslash-escaped single quotes in the artist name
        const artistName = artistMatch[1].replace(/\\'/g, "'");

        // Extract the show URL from the first <a href="..."> link inside the card
        const urlMatch = fullBlock.match(/href="(https:\/\/www\.mcgonigels\.com\/shows\/[^"]+)"/);

        events.push({
            id: parseInt(idMatch[1], 10),
            eventDate: dateMatch[1],
            mainArtist: [artistName],
            image: imageMatch ? imageMatch[1] : '',
            showUrl: urlMatch ? urlMatch[1] : undefined,
        });
    }

    return events;
}

/**
 * Parse a single Tessera event into a RipperCalendarEvent or ParseError.
 */
function parseSingleEvent(ev: TesseraEvent, tz: ZoneId): RipperCalendarEvent | ParseError {
    const artistName = ev.mainArtist[0] ?? '';
    if (!artistName) {
        return {
            type: 'ParseError',
            reason: `Event id=${ev.id} has no mainArtist`,
            context: ev.eventDate,
        };
    }

    const date = parseTesseraDate(ev.eventDate, tz);
    if (!date) {
        return {
            type: 'ParseError',
            reason: `Could not parse eventDate "${ev.eventDate}" for "${artistName}"`,
            context: String(ev.id),
        };
    }

    // Stable ID: use the upstream numeric id — it's the most reliable join key.
    // McGonigel's assigns a unique id per show even for recurring events.
    const id = `mcgonigels-${ev.id}`;

    const event: RipperCalendarEvent = {
        id,
        ripped: new Date(),
        date,
        duration: Duration.ofHours(3),
        summary: artistName,
    };

    if (ev.showUrl) {
        event.url = ev.showUrl;
    }

    if (ev.image) {
        event.imageUrl = ev.image;
    }

    return event;
}

/**
 * Parse all visible Tessera events from the HTML and return a mixed array
 * of RipperCalendarEvent and ParseError objects.
 */
export function parseEvents(html: string, tz: ZoneId, _source: string): RipperEvent[] {
    const rawEvents = extractEvents(html);
    return rawEvents.map(ev => parseSingleEvent(ev, tz));
}

export default class McGonigelsMuckyDuckRipper implements IRipper {
    public async rip(ripper: Ripper): Promise<RipperCalendar[]> {
        const fetchFn = getFetchForConfig(ripper.config);
        const cal = ripper.config.calendars[0];
        const tz = cal.timezone as unknown as ZoneId;

        const res = await fetchFn(ripper.config.url.toString(), {
            headers: {
                'User-Agent': 'Mozilla/5.0 (compatible; 832events/1.0)',
            },
        });
        if (!res.ok) {
            throw new Error(`${ripper.config.url} returned HTTP ${res.status} ${res.statusText}`);
        }

        const html = await res.text();
        const results = parseEvents(html, tz, ripper.config.name);

        const events = results.filter((e): e is RipperCalendarEvent => 'date' in e);
        const errors = results.filter((e): e is RipperError => 'type' in e);

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
