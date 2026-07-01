/**
 * Ripper for Children's Museum Houston (https://www.cmhouston.org/events)
 *
 * The events page lists events as server-rendered HTML cards. Each event card contains:
 *   - Title: event name
 *   - Date range: "Jun 06 - Aug 09, 2026" or "Jul 02, 2026"
 *   - Description: brief event details
 *   - Event details link with href
 *   - Category tags (Member-only, event type, etc.)
 *
 * The ripper parses the date strings to extract start dates and durations.
 */

import {
	Duration,
	LocalDate,
	LocalTime,
	LocalDateTime,
	ZoneId,
	ZonedDateTime,
	ChronoUnit,
	Month,
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
import { createHash } from "crypto";

const VENUE_ADDRESS = "Children's Museum Houston, 1500 Binz Street, Houston, TX 77004";

/**
 * Convert a title string into a URL-slug-style id component.
 */
function slugify(s: string): string {
	return s
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-+|-+$/g, "");
}

/**
 * Generate stable event ID from title and date.
 */
function hashEventId(title: string, dateStr: string): string {
	const key = `${slugify(title)}-${dateStr}`;
	const hash = createHash("sha256")
		.update(key)
		.digest("hex")
		.substring(0, 8);
	return `${key}-${hash}`;
}

/**
 * Month abbreviation/name to number mapping.
 */
const monthMap: Record<string, number> = {
	january: 1,
	february: 2,
	march: 3,
	april: 4,
	may: 5,
	june: 6,
	july: 7,
	august: 8,
	september: 9,
	october: 10,
	november: 11,
	december: 12,
	jan: 1,
	feb: 2,
	mar: 3,
	apr: 4,
	jun: 6,
	jul: 7,
	aug: 8,
	sep: 9,
	sept: 9,
	oct: 10,
	nov: 11,
	dec: 12,
};

/**
 * Parse a month string (name or abbreviation) to number.
 */
function monthToNumber(monthStr: string): number | null {
	return monthMap[monthStr.toLowerCase()] || null;
}

/**
 * Parse a date string from the CMH event cards.
 * Formats:
 *   - "Jun 06 - Aug 09, 2026" (date range with year)
 *   - "Jul 02, 2026" (single date with year)
 *   - "Jul 02 - Jul 31, 2026" (date range same month with year)
 *
 * Returns: { startDate: LocalDate, endDate: LocalDate | null }
 */
function parseDateString(dateStr: string): {
	startDate: LocalDate | null;
	endDate: LocalDate | null;
} {
	if (!dateStr || !dateStr.trim()) {
		return { startDate: null, endDate: null };
	}

	// Trim and clean the date string
	const cleaned = dateStr.trim();

	// Extract year from the string (e.g., "2026" from "Jun 06 - Aug 09, 2026")
	const yearMatch = cleaned.match(/,?\s*(\d{4})\b/);
	const year = yearMatch ? parseInt(yearMatch[1]!, 10) : LocalDate.now().year();

	// Remove year from the string for further parsing
	const withoutYear = cleaned.replace(/,?\s*\d{4}\b/, "").trim();

	// Try to parse as a date range: "Jun 06 - Aug 09" or "Jul 02 - Jul 31"
	const rangeMatch = withoutYear.match(
		/([A-Z][a-z]{2})\s+(\d{1,2})\s*-\s*([A-Z][a-z]{2})\s+(\d{1,2})/i
	);
	if (rangeMatch) {
		const startMonthStr = rangeMatch[1]!;
		const startDay = parseInt(rangeMatch[2]!, 10);
		const endMonthStr = rangeMatch[3]!;
		const endDay = parseInt(rangeMatch[4]!, 10);

		const startMonth = monthToNumber(startMonthStr);
		const endMonth = monthToNumber(endMonthStr);

		if (startMonth && endMonth) {
			try {
				const startDate = LocalDate.of(year, startMonth, startDay);
				const endDate = LocalDate.of(year, endMonth, endDay);
				return { startDate, endDate };
			} catch {
				// Fall through to single date parsing
			}
		}
	}

	// Try to parse as a single date: "Jul 02" or "June 27"
	const singleMatch = withoutYear.match(/([A-Z][a-z]{2})\s+(\d{1,2})/i);
	if (singleMatch) {
		const monthStr = singleMatch[1]!;
		const day = parseInt(singleMatch[2]!, 10);
		const month = monthToNumber(monthStr);

		if (month) {
			try {
				let startDate = LocalDate.of(year, month, day);
				// If the date is in the past, try next year
				if (startDate.isBefore(LocalDate.now())) {
					startDate = LocalDate.of(year + 1, month, day);
				}
				return { startDate, endDate: null };
			} catch {
				// Invalid date
			}
		}
	}

	return { startDate: null, endDate: null };
}

export default class ChildrenMuseumHoustonRipper implements IRipper {
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
				`Children's Museum Houston calendar page failed: HTTP ${res.status} ${res.statusText}`
			);
		}

		const html = await res.text();
		const root = parse(html);

		const events: RipperCalendarEvent[] = [];
		const errors: RipperError[] = [];

		// CMH uses Webflow dynamic lists with these specific classes:
		// - .event-calendar-item for regular events
		// - .calendar-special-events-item for featured/special events
		const eventElements: HTMLElement[] = [];

		// Look for regular event calendar items
		const regularItems = root.querySelectorAll(".event-calendar-item.w-dyn-item");
		eventElements.push(...regularItems);

		// Also look for special/featured event items
		const specialItems = root.querySelectorAll(".calendar-special-events-item.w-dyn-item");
		eventElements.push(...specialItems);

		for (const element of eventElements) {
			try {
				const result = this.parseEventElement(element, tz);
				if (!result) {
					continue;
				}
				if ("type" in result && result.type) {
					errors.push(result);
				} else {
					events.push(result);
				}
			} catch (err) {
				errors.push({
					type: "ParseError",
					reason: `Exception processing event: ${err instanceof Error ? err.message : String(err)}`,
					context: `Element: ${element.toString().substring(0, 100)}`,
				});
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
	 * Parse a single event element from the HTML.
	 * Returns RipperCalendarEvent | RipperError | null
	 */
	private parseEventElement(
		element: HTMLElement,
		tz: ZoneId
	): RipperCalendarEvent | RipperError | null {
		// Try to extract date from the hidden div.secret-wrapper first
		// (more reliable than parsing text content)
		const secretWrapper = element.querySelector(".secret-wrapper, .secret-wrapper-events-header");
		let startDateStr = "";
		let endDateStr = "";

		if (secretWrapper) {
			const dateType = secretWrapper.querySelector(".dateType");
			const dateType2 = secretWrapper.querySelector(".dateType2");
			if (dateType) startDateStr = dateType.textContent?.trim() || "";
			if (dateType2) endDateStr = dateType2.textContent?.trim() || "";
		}

		// Extract title from the heading
		let title = "";
		const heading = element.querySelector("h1, h2, h3, h4, .h4-name, .event-title");
		if (heading) {
			title = heading.textContent?.trim() || "";
		}

		// Remove HTML entities if present (e.g., &#x27; for ')
		title = title.replace(/&#x27;/g, "'").replace(/&quot;/g, '"').replace(/&amp;/g, "&");

		if (!title) {
			// Try to get from the link text
			const link = element.querySelector("a[href*='/events/']");
			if (link) {
				title = link.textContent?.trim() || "";
			}
		}

		if (!title) {
			// Skip this element if we can't find a title
			return null;
		}

		// Parse the start date from the hidden div or from the visible date blocks
		let startDate: LocalDate | null = null;
		let endDate: LocalDate | null = null;

		if (startDateStr) {
			try {
				// Format is typically "Jul 02, 2026"
				startDate = LocalDate.parse(startDateStr);
				if (endDateStr && endDateStr !== startDateStr) {
					endDate = LocalDate.parse(endDateStr);
				}
			} catch {
				// Fall back to parsing from text content
			}
		}

		// If we couldn't parse from hidden divs, try extracting from text
		if (!startDate) {
			const textContent = element.textContent || "";
			const datePattern = /([A-Z][a-z]{2})\s+(\d{1,2})(?:\s*[—-]\s*([A-Z][a-z]{2})\s+(\d{1,2}))?,?\s*(\d{4})/;
			const dateMatch = textContent.match(datePattern);

			if (dateMatch) {
				const dateStr = dateMatch[0]!;
				const parsed = parseDateString(dateStr);
				startDate = parsed.startDate;
				endDate = parsed.endDate;
			}
		}

		if (!startDate) {
			return {
				type: "ParseError",
				reason: `Cannot find date for event "${title}"`,
				context: `startDateStr: ${startDateStr}, visible text length: ${element.textContent?.length}`,
			};
		}

		// Calculate duration
		let duration: Duration;
		if (endDate) {
			// Multi-day event - use end date to calculate duration
			const days = startDate.until(endDate, ChronoUnit.DAYS);
			duration = Duration.ofDays(days + 1); // Include both start and end days
		} else {
			// Single day event - default to 2 hours
			duration = Duration.ofHours(2);
		}

		// Create ZonedDateTime at 10:00 AM by default
		const time = LocalTime.of(10, 0);
		const localDT = LocalDateTime.of(startDate, time);
		const zonedDT = ZonedDateTime.of(localDT, tz);

		// Generate stable ID
		const eventId = hashEventId(title, startDate.toString());

		// Extract URL if available
		let url: string | undefined;
		const link = element.querySelector("a[href*='/events/']");
		if (link) {
			const href = link.getAttribute("href");
			if (href) {
				url = href.startsWith("http")
					? href
					: href.startsWith("/")
						? `https://www.cmhouston.org${href}`
						: `https://www.cmhouston.org/events/${href}`;
			}
		}

		const event: RipperCalendarEvent = {
			id: eventId,
			summary: title,
			date: zonedDT,
			duration,
			location: VENUE_ADDRESS,
			ripped: new Date(),
			url: url || undefined,
			description: "Children's Museum Houston",
		};

		return event;
	}
}
