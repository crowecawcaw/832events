/**
 * Ripper for POST Houston (https://posthtx.com/event)
 *
 * The events page is a Webflow-based list with server-rendered event cards.
 * Each event item contains:
 * - Date range (fs-list-field="date" and fs-list-field="end-date")
 * - Event name (fs-list-field="name")
 * - Location details (fs-list-field="location detail")
 * - Event types (fs-list-field="type")
 * - Time (displayed in a <p class="small-text"> element)
 * - Image (thumbnail)
 * - Link to event detail page
 *
 * The ripper:
 * 1. Fetches the event listing page
 * 2. Parses each event card from the HTML
 * 3. Extracts dates, times, titles, locations, and images
 * 4. Returns events with stable IDs derived from title + date
 */

import {
	Duration,
	LocalDate,
	LocalDateTime,
	LocalTime,
	ZoneId,
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
import crypto from "crypto";

function slugify(s: string): string {
	return s
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-+|-+$/g, "");
}

export function hashEventId(title: string, dateStr: string): string {
	const key = `${slugify(title)}-${dateStr}`;
	const hash = crypto
		.createHash("sha256")
		.update(key)
		.digest("hex")
		.substring(0, 8);
	return `${key}-${hash}`;
}

interface ParsedEvent {
	title: string;
	date: LocalDate;
	time?: LocalTime;
	locations: string[];
	types: string[];
	imageUrl?: string;
	eventUrl: string;
}

/**
 * Parse a date string in the format "M/D/YY" or "MM/DD/YY"
 */
function parseDate(dateStr: string): LocalDate | null {
	try {
		const [month, day, year] = dateStr.split("/").map((s) => parseInt(s, 10));
		if (!month || !day || !year) return null;

		// Handle 2-digit years (00-99)
		const fullYear = year < 100 ? (year < 30 ? 2000 + year : 1900 + year) : year;

		const date = LocalDate.of(fullYear, month, day);
		return date;
	} catch (e) {
		return null;
	}
}

/**
 * Parse a time string in the format "H:MM AM" or "HH:MM PM", etc.
 */
function parseTime(timeStr: string): LocalTime | null {
	try {
		const match = timeStr.match(/(\d{1,2}):(\d{2})\s*(AM|PM)/i);
		if (!match) return null;

		const hour = parseInt(match[1], 10);
		const minute = parseInt(match[2], 10);
		const ampm = match[3].toUpperCase();

		const adjustedHour =
			ampm === "PM" && hour !== 12
				? hour + 12
				: ampm === "AM" && hour === 12
					? 0
					: hour;

		return LocalTime.of(adjustedHour, minute);
	} catch (e) {
		return null;
	}
}

/**
 * Extract event data from a single event card (w-dyn-item)
 */
function parseEventCard(card: HTMLElement): ParsedEvent | RipperError | null {
	try {
		// Extract title
		const titleEl = card.querySelector('[fs-list-field="name"]');
		if (!titleEl) {
			return {
				error: true,
				type: "ParseError",
				reason: "No title element found in event card",
				context: "Looking for [fs-list-field='name']",
			} as ParseError;
		}
		const title = titleEl.textContent?.trim();
		if (!title) {
			return {
				error: true,
				type: "ParseError",
				reason: "Title element is empty",
				context: "Event card found but title is blank",
			} as ParseError;
		}

		// Extract date
		const dateEl = card.querySelector('[fs-list-field="date"]');
		if (!dateEl) {
			return {
				error: true,
				type: "ParseError",
				reason: "No date element found in event card",
				context: `Title: ${title}`,
			} as ParseError;
		}
		const dateStr = dateEl.textContent?.trim();
		if (!dateStr) {
			return {
				error: true,
				type: "ParseError",
				reason: "Date element is empty",
				context: `Title: ${title}`,
			} as ParseError;
		}

		const date = parseDate(dateStr);
		if (!date) {
			return {
				error: true,
				type: "ParseError",
				reason: `Could not parse date: ${dateStr}`,
				context: `Title: ${title}`,
			} as ParseError;
		}

		// Extract time (optional) - look for p.small-text with time pattern
		let time: LocalTime | undefined;
		const timeElements = card.querySelectorAll("p.small-text");
		for (const el of timeElements) {
			const text = el.textContent?.trim() || "";
			// Skip the condition-invisible time
			if (el.classNames.includes("w-condition-invisible")) {
				continue;
			}
			const parsedTime = parseTime(text);
			if (parsedTime) {
				time = parsedTime;
				break;
			}
		}

		// Extract locations
		const locations: string[] = [];
		const locationEls = card.querySelectorAll('[fs-list-field="location detail"] .small-text.inline');
		locationEls.forEach((el) => {
			const loc = el.textContent?.trim();
			if (loc) {
				locations.push(loc);
			}
		});

		// Extract event types (tags)
		const types: string[] = [];
		const typeEls = card.querySelectorAll('[fs-list-field="type"]');
		typeEls.forEach((el) => {
			const type = el.textContent?.trim();
			if (type) {
				types.push(type);
			}
		});

		// Extract image URL
		let imageUrl: string | undefined;
		const imgEl = card.querySelector("img.event-thumbnail");
		if (imgEl) {
			imageUrl = imgEl.getAttribute("src") || undefined;
		}

		// Extract event URL (link overlay href)
		let eventUrl = "";
		const linkEl = card.querySelector("a.link-overlay");
		if (linkEl) {
			eventUrl = linkEl.getAttribute("href") || "";
		}
		// If no link-overlay, try to find any internal event link
		if (!eventUrl) {
			const allLinks = card.querySelectorAll("a.link-contain");
			for (const link of allLinks) {
				const href = link.getAttribute("href");
				if (href && href.startsWith("/event/")) {
					eventUrl = href;
					break;
				}
			}
		}

		return {
			title,
			date,
			time,
			locations,
			types,
			imageUrl,
			eventUrl: eventUrl ? `https://posthtx.com${eventUrl}` : "https://posthtx.com/event",
		};
	} catch (err) {
		return {
			error: true,
			type: "ParseError",
			reason: `Exception parsing event card: ${err instanceof Error ? err.message : String(err)}`,
			context: "Card parsing failed",
		} as ParseError;
	}
}

export default class PostHoustonRipper implements IRipper {
	public async rip(ripper: Ripper): Promise<RipperCalendar[]> {
		const fetchFn = getFetchForConfig(ripper.config);
		const cal = ripper.config.calendars[0]!;

		// Fetch the event listing page
		const res = await fetchFn(ripper.config.url.toString(), {
			headers: {
				"User-Agent": "Mozilla/5.0 (compatible; 832events/1.0)",
			},
		});

		if (!res.ok) {
			throw new Error(
				`POST Houston event page failed: HTTP ${res.status} ${res.statusText}`
			);
		}

		const html = await res.text();
		const root = parse(html);

		const events: RipperCalendarEvent[] = [];
		const errors: RipperError[] = [];

		// Find all event cards (w-dyn-item)
		const eventCards = root.querySelectorAll('div[role="listitem"].margin-bottom-sml.w-dyn-item');

		if (eventCards.length === 0) {
			errors.push({
				error: true,
				type: "ParseError",
				reason: "No event cards found on the page",
				context: "Expected to find div[role='listitem'].margin-bottom-sml.w-dyn-item elements",
			} as ParseError);
		}

		const seenEventIds = new Set<string>();

		for (const card of eventCards) {
			const parsed = parseEventCard(card);

			if (!parsed) {
				// Null result - skip silently
				continue;
			}

			if ("error" in parsed && parsed.error) {
				errors.push(parsed as RipperError);
				continue;
			}

			const eventData = parsed as ParsedEvent;

			try {
				// Build event datetime
				let dateTime: LocalDateTime;
				if (eventData.time) {
					dateTime = LocalDateTime.of(eventData.date, eventData.time);
				} else {
					// No time provided; use 12:00 PM as default
					dateTime = LocalDateTime.of(eventData.date, LocalTime.of(12, 0));
				}

				const zonedDateTime = dateTime.atZone(ZoneId.of("America/Chicago"));

				// Create stable event ID
				const eventIdKey = hashEventId(eventData.title, eventData.date.toString());

				// Avoid duplicates
				if (seenEventIds.has(eventIdKey)) {
					continue;
				}
				seenEventIds.add(eventIdKey);

				const event: RipperCalendarEvent = {
					id: eventIdKey,
					summary: eventData.title,
					date: zonedDateTime,
					ripped: new Date(),
					duration: Duration.ofHours(2),
					location: eventData.locations.join(", ") || "POST Houston",
					description: eventData.types.length > 0 ? `Type: ${eventData.types.join(", ")}` : "",
					url: eventData.eventUrl,
				};

				events.push(event);
			} catch (err) {
				errors.push({
					error: true,
					type: "ParseError",
					reason: `Failed to create event: ${err instanceof Error ? err.message : String(err)}`,
					context: `Title: ${eventData.title}, Date: ${eventData.date}`,
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
