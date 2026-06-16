/**
 * Ripper for Ensemble Theatre Houston (https://www.ensemblehouston.com)
 *
 * The site lists a season of theatrical productions, each with a run date range.
 * The season page (2025-26-season) shows production titles and date ranges in
 * server-rendered HTML. Each production opens on the first day of its run.
 *
 * The site does not publish per-performance times; productions run for their
 * entire duration. We create a calendar event on the opening night, using a
 * reasonable default duration (3 hours for a theater production).
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

const VENUE_ADDRESS = "3535 Main St, Houston, TX 77002";

function slugify(s: string): string {
    return s
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "");
}

/**
 * Parse a date string like "SEPT 19 - OCT 12. 2025" or "JAN 23 - FEB 22, 2026" or "MAY 8 - 31. 2026"
 * Returns the opening date (first date in the range).
 */
function parseOpeningDate(dateStr: string): LocalDate | null {
    // Format can be:
    // - "SEPT 19 - OCT 12. 2025" (both dates have month names)
    // - "JAN 23 - FEB 22, 2026" (both dates have month names)
    // - "MAY 8 - 31. 2026" (only first date has month name)
    // Extract the first date (start of run)

    const monthAbbr: Record<string, number> = {
        jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6,
        jul: 7, aug: 8, sep: 9, sept: 9, oct: 10, nov: 11, dec: 12,
    };

    // Try matching with both formats: "MONTH DD - MONTH DD, YEAR" or "MONTH DD - DD. YEAR"
    const match = dateStr.match(/^([a-z]+)\s+(\d{1,2})\s*-\s*(?:[a-z]+\s+)?\d{1,2}[.,]\s*(\d{4})/i);
    if (!match) {
        return null;
    }

    const monthName = match[1]!.toLowerCase();
    const day = parseInt(match[2]!, 10);
    const year = parseInt(match[3]!, 10);

    const month = monthAbbr[monthName];
    if (!month) {
        return null;
    }

    try {
        return LocalDate.of(year, month, day);
    } catch {
        return null;
    }
}

export default class EnsembleTheatreHoustonRipper implements IRipper {
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
                `Ensemble Theatre Houston fetch failed: HTTP ${res.status} ${res.statusText}`,
            );
        }

        const html = await res.text();
        const events: RipperCalendarEvent[] = [];
        const errors: RipperError[] = [];

        const root = parse(html);

        // Find all production links. The structure is:
        // <a class="performance-thumbnail" href="/2025-26-season/show-name">
        //   <img src="..."/>
        // </a>
        // <h2 class="thumbnail-date ...">DATE RANGE</h2>
        const productionLinks = root.querySelectorAll("a.performance-thumbnail");

        for (const link of productionLinks) {
            const href = link.getAttribute("href");
            if (!href) {
                errors.push({
                    type: "ParseError",
                    reason: "Missing href in performance-thumbnail",
                    context: "production link",
                });
                continue;
            }

            // Extract the show name from the href (e.g., "/2025-26-season/show-name" → "show-name")
            const slugMatch = href.match(/\/([^/]+)$/);
            if (!slugMatch) {
                errors.push({
                    type: "ParseError",
                    reason: `Cannot extract show slug from href: ${href}`,
                    context: href,
                });
                continue;
            }

            const showSlug = slugMatch[1]!;
            // Convert slug to title case for display (e.g., "the-bluest-eye" → "The Bluest Eye")
            const title = showSlug
                .split("-")
                .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
                .join(" ");

            // The next sibling should be the date range in an h2 with class thumbnail-date
            let dateEl = link.nextElementSibling;
            let dateStr = "";

            // Sometimes there's a <br/> in between
            while (dateEl && dateEl.tagName === "BR") {
                dateEl = dateEl.nextElementSibling;
            }

            if (dateEl && dateEl.tagName === "H2") {
                dateStr = dateEl.text.trim();
            }

            if (!dateStr) {
                errors.push({
                    type: "ParseError",
                    reason: `Missing or unparseable date for production: ${showSlug}`,
                    context: showSlug,
                });
                continue;
            }

            const openingDate = parseOpeningDate(dateStr);
            if (!openingDate) {
                errors.push({
                    type: "ParseError",
                    reason: `Cannot parse date range: "${dateStr}"`,
                    context: `${showSlug}: ${dateStr}`,
                });
                continue;
            }

            // Create an event for the opening night. Use 7 PM (standard theater curtain time).
            const openingTime = LocalTime.of(19, 0);
            const localDT = LocalDateTime.of(openingDate, openingTime);
            const date = ZonedDateTime.of(localDT, tz);
            const duration = Duration.ofHours(3); // Standard theatrical run duration

            const id = `${slugify(title)}-${openingDate.toString()}`;

            const event: RipperCalendarEvent = {
                id,
                ripped: new Date(),
                date,
                duration,
                summary: title,
                location: VENUE_ADDRESS,
            };

            events.push(event);
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
