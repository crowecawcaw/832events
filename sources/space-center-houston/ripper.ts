/**
 * Ripper for Space Center Houston (https://spacecenter.org/events/)
 *
 * Space Center Houston uses The Events Calendar WordPress plugin with a public
 * REST API endpoint (wp-json/tribe/events/v1/events) that returns structured
 * event data including:
 *   - title
 *   - start_date / end_date (with timezone)
 *   - image
 *   - categories
 *   - venue information
 *   - url (direct link to event)
 *
 * The ripper fetches events from the REST API and parses them into calendar events.
 * All events occur at Space Center Houston's main venue.
 */

import {
	Duration,
	LocalDate,
	LocalDateTime,
	LocalTime,
	ZoneId,
	ZonedDateTime,
	convert,
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

const API_URL = "https://spacecenter.org/wp-json/tribe/events/v1/events";
const VENUE_ADDRESS = "Space Center Houston, 1601 E NASA Parkway, Houston, TX 77058";

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
 * Parse ISO 8601 datetime string into ZonedDateTime.
 * The API returns times like "2026-06-26 10:15:00" with timezone info.
 */
function parseISODateTime(dateStr: string, tzString: string): ZonedDateTime | null {
	try {
		// Parse format like "2026-06-26 10:15:00"
		const match = dateStr.match(
			/^(\d{4})-(\d{2})-(\d{2})\s+(\d{2}):(\d{2}):(\d{2})$/
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

		const localDt = LocalDateTime.of(year, month, day, hour, minute, second);
		const tz = ZoneId.of(tzString);
		return ZonedDateTime.of(localDt, tz);
	} catch {
		return null;
	}
}

/**
 * Extract image URL from the event object.
 */
function getImageUrl(event: any): string | undefined {
	if (event.image?.url) {
		return event.image.url;
	}
	return undefined;
}

/**
 * Extract category name from the event.
 */
function getCategory(event: any): string {
	if (event.categories && event.categories.length > 0) {
		return event.categories[0]!.name;
	}
	return "Event";
}

export default class SpaceCenterHoustonRipper implements IRipper {
	public async rip(ripper: Ripper): Promise<RipperCalendar[]> {
		const fetchFn = getFetchForConfig(ripper.config);
		const cal = ripper.config.calendars[0]!;
		const tz = cal.timezone.id();

		const events: RipperCalendarEvent[] = [];
		const errors: RipperError[] = [];

		try {
			// Fetch events from the REST API
			// The API defaults to today + 2 years, which is sufficient for our lookahead
			const res = await fetchFn(API_URL, {
				headers: {
					"User-Agent": "Mozilla/5.0 (compatible; 832events/1.0)",
				},
			});

			if (!res.ok) {
				throw new Error(
					`Space Center Houston API fetch failed: HTTP ${res.status} ${res.statusText}`,
				);
			}

			const data = await res.json();

			if (!data.events || !Array.isArray(data.events)) {
				throw new Error("API response missing 'events' array");
			}

			// Parse each event
			for (const event of data.events) {
				const result = this.parseEvent(event, tz, ripper.config.url.toString());
				if ("type" in result && result.type) {
					errors.push(result);
				} else {
					events.push(result);
				}
			}
		} catch (err) {
			const errorMsg = err instanceof Error ? err.message : String(err);
			throw new Error(`Space Center Houston ripper failed: ${errorMsg}`);
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
	 * Parse a single event from the WordPress REST API response.
	 * Returns RipperCalendarEvent | RipperError
	 */
	private parseEvent(
		event: any,
		tzString: string,
		sourceUrl: string,
	): RipperCalendarEvent | RipperError {
		// Extract required fields
		const title = event.title?.trim();
		if (!title) {
			return {
				type: "ParseError" as const,
				reason: "Missing event title",
				context: JSON.stringify(event).substring(0, 200),
			};
		}

		// Parse start date/time
		const startDateStr = event.start_date;
		if (!startDateStr) {
			return {
				type: "ParseError" as const,
				reason: `Event "${title}" is missing start_date`,
				context: JSON.stringify(event).substring(0, 200),
			};
		}

		const startDt = parseISODateTime(startDateStr, tzString);
		if (!startDt) {
			return {
				type: "ParseError" as const,
				reason: `Event "${title}" has unparseable start_date: ${startDateStr}`,
				context: JSON.stringify(event).substring(0, 200),
			};
		}

		// Parse end date/time
		const endDateStr = event.end_date;
		let duration: Duration | null = null;

		if (endDateStr) {
			const endDt = parseISODateTime(endDateStr, tzString);
			if (endDt) {
				duration = Duration.between(startDt.toInstant(), endDt.toInstant());
			}
		}

		// If no end time was provided, use a default duration
		if (!duration) {
			duration = Duration.ofHours(1);
		}

		// Build stable event ID from title + start date
		const dateStr = startDt.toLocalDate().toString();
		const eventId = `${slugify(title)}-${dateStr}`;

		// Extract optional fields
		const description = getCategory(event);
		const imageUrl = getImageUrl(event);
		const url = event.url || event.rest_url;

		const parsedEvent: RipperCalendarEvent = {
			id: eventId,
			ripped: new Date(),
			date: startDt,
			duration,
			summary: title,
			description,
			location: VENUE_ADDRESS,
			url,
			imageUrl,
		};

		return parsedEvent;
	}
}
