/**
 * Ripper for Houston Grand Opera (https://www.houstongrandopera.org/on-stage)
 *
 * The site uses Next.js with DatoCMS backend. Event data is embedded in the
 * page's __NEXT_DATA__ JSON payload (inside <script id="__NEXT_DATA__">).
 * The /on-stage page contains production listings with:
 * - Production title, composer, librettist
 * - Start/end dates (YYYY-MM-DD format)
 * - Description (via DAST/structured text, often empty for listings)
 * - Cover image URL
 * - Link to preview/details
 *
 * All performances are at the Wortham Theater Center (fixed venue).
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

const VENUE_ADDRESS = "Wortham Theater Center, 500 Main St, Houston, TX 77002";
const VENUE_NAME = "Wortham Theater Center";

function slugify(s: string): string {
    return s
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "");
}

/**
 * Parse YYYY-MM-DD date string into LocalDate.
 */
function parseISODate(dateStr: string): LocalDate | null {
    const match = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!match) {
        return null;
    }

    try {
        const year = parseInt(match[1]!, 10);
        const month = parseInt(match[2]!, 10);
        const day = parseInt(match[3]!, 10);
        return LocalDate.of(year, month, day);
    } catch {
        return null;
    }
}

/**
 * Extract production events from the __NEXT_DATA__ JSON.
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
        const data = JSON.parse(jsonStr);

        // Navigate to the page props containing the on-stage content
        const pageProps = data?.props?.pageProps;
        if (!pageProps) {
            errors.push({
                type: "ParseError",
                reason: "Could not find pageProps in __NEXT_DATA__",
                context: undefined,
            });
            return errors;
        }

        const onStageContent = pageProps.onStagePageContent;
        if (!onStageContent) {
            errors.push({
                type: "ParseError",
                reason: "Could not find onStagePageContent in pageProps",
                context: undefined,
            });
            return errors;
        }

        // Collect events from both the main season and additional productions
        const productionSources = [
            onStageContent.largeImageCalloutsSeason,
            onStageContent.largeImageCalloutsMoreOpera,
        ].filter(Boolean);

        const seenIds = new Set<string>();

        for (const productionSource of productionSources) {
            if (!productionSource?.eventBox || !Array.isArray(productionSource.eventBox)) {
                continue;
            }

            for (const production of productionSource.eventBox) {
                try {
                    // Extract core fields
                    const title = production.title?.trim();
                    if (!title) {
                        errors.push({
                            type: "ParseError",
                            reason: "Production missing title",
                            context: JSON.stringify(production).slice(0, 100),
                        });
                        continue;
                    }

                    const startDateStr = production.startDate;
                    if (!startDateStr) {
                        errors.push({
                            type: "ParseError",
                            reason: `Production "${title}" missing startDate`,
                            context: JSON.stringify(production).slice(0, 100),
                        });
                        continue;
                    }

                    const startDate = parseISODate(startDateStr);
                    if (!startDate) {
                        errors.push({
                            type: "ParseError",
                            reason: `Could not parse startDate "${startDateStr}" for "${title}"`,
                            context: startDateStr,
                        });
                        continue;
                    }

                    // Parse end date if present (for multi-day productions)
                    let endDate: LocalDate | null = null;
                    if (production.endDate) {
                        endDate = parseISODate(production.endDate);
                    }

                    // Create stable ID from title and start date
                    const id = `${slugify(title)}-${startDate.toString()}`;

                    // Skip duplicates
                    if (seenIds.has(id)) {
                        continue;
                    }
                    seenIds.add(id);

                    // Build description from composer/librettist info if available
                    let description = "";
                    if (production.composer) {
                        description += `Composer: ${production.composer}`;
                    }
                    if (production.librettist) {
                        description += description ? "\n" : "";
                        description += `Librettist: ${production.librettist}`;
                    }

                    // Default start time to 7:00 PM (typical for opera performances)
                    const startTime = LocalTime.of(19, 0);
                    const startDateTime = LocalDateTime.of(startDate, startTime);
                    const zonedDateTime = ZonedDateTime.of(startDateTime, tz);

                    // Default duration to 3 hours (typical for full opera production)
                    const duration = Duration.ofHours(3);

                    // Extract image URL if available
                    let imageUrl: string | undefined;
                    if (production.coverImage?.url) {
                        imageUrl = production.coverImage.url;
                    }

                    // Extract preview/details URL
                    let previewUrl: string | undefined;
                    if (production.previewButtonCta) {
                        // Ensure it's a full URL
                        const url = production.previewButtonCta;
                        if (url.startsWith("http")) {
                            previewUrl = url;
                        } else if (url.startsWith("/")) {
                            previewUrl = `https://www.houstongrandopera.org${url}`;
                        }
                    }

                    const event: RipperCalendarEvent = {
                        id,
                        ripped: new Date(),
                        date: zonedDateTime,
                        duration,
                        summary: title,
                        location: VENUE_ADDRESS,
                        description: description || undefined,
                        imageUrl,
                        url: previewUrl,
                    };

                    events.push(event);
                } catch (e) {
                    errors.push({
                        type: "ParseError",
                        reason: `Failed to parse production: ${e instanceof Error ? e.message : String(e)}`,
                        context: JSON.stringify(production).slice(0, 100),
                    });
                }
            }
        }

        return [...events, ...errors];
    } catch (e) {
        errors.push({
            type: "ParseError",
            reason: `Failed to parse JSON: ${e instanceof Error ? e.message : String(e)}`,
            context: undefined,
        });
        return errors;
    }
}

export default class HoustonGrandOperaRipper implements IRipper {
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
                `Houston Grand Opera fetch failed: HTTP ${res.status} ${res.statusText}`
            );
        }

        const html = await res.text();

        // Extract __NEXT_DATA__ JSON from the page
        const scriptMatch = html.match(/<script id="__NEXT_DATA__"[^>]*>([^<]+)<\/script>/);
        if (!scriptMatch) {
            throw new Error("Could not find __NEXT_DATA__ script in page");
        }

        const nextDataJson = scriptMatch[1]!;
        const results = parseEvents(nextDataJson, tz, ripper.config.name);

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
