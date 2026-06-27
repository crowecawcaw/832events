/**
 * Tests for Space Center Houston ripper
 */

import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { ZoneId, LocalDateTime, ZonedDateTime, Duration } from "@js-joda/core";
import "@js-joda/timezone";
import SpaceCenterHoustonRipper from "./ripper.js";
import type { Ripper, RipperCalendarEvent, RipperError } from "../../lib/config/schema.js";

// Mock sample API response data
const MOCK_API_RESPONSE = {
	events: [
		{
			id: 10085204,
			title: "Rocket Park Tram Tour",
			description: "",
			slug: "rocket-park-tram-tour",
			url: "https://spacecenter.org/events-calendar-event/rocket-park-tram-tour/2026-06-26/",
			rest_url: "https://spacecenter.org/wp-json/tribe/events/v1/events/10085204",
			start_date: "2026-06-26 10:15:00",
			end_date: "2026-06-26 11:00:00",
			all_day: false,
			image: {
				url: "https://spacecenter.org/wp-content/uploads/2024/10/rocket-park.jpg",
			},
			categories: [
				{
					name: "Tram Tour",
					slug: "tram-tour",
				},
			],
			venue: {
				venue: "Tram Boarding Area",
			},
			cost: "",
			cost_details: {
				values: [],
			},
		},
		{
			id: 10083376,
			title: "Human Destiny Film",
			description: "",
			slug: "human-destiny-film",
			url: "https://spacecenter.org/events-calendar-event/human-destiny-film/2026-06-26/",
			rest_url: "https://spacecenter.org/wp-json/tribe/events/v1/events/10083376",
			start_date: "2026-06-26 09:30:00",
			end_date: "2026-06-26 10:15:00",
			all_day: false,
			image: {
				url: "https://spacecenter.org/wp-content/uploads/2022/10/Destiny-Theater.jpg",
			},
			categories: [
				{
					name: "Film",
					slug: "film",
				},
			],
			venue: {
				venue: "Destiny Theater",
			},
			cost: "",
			cost_details: {
				values: [],
			},
		},
		{
			id: 10085000,
			title: "Space History Tour",
			description: "",
			slug: "space-history-tour",
			url: "https://spacecenter.org/events-calendar-event/space-history-tour/2026-06-27/",
			rest_url: "https://spacecenter.org/wp-json/tribe/events/v1/events/10085000",
			start_date: "2026-06-27 14:00:00",
			end_date: "2026-06-27 15:30:00",
			all_day: false,
			image: {
				url: "https://spacecenter.org/wp-content/uploads/2023/04/event-schsupernova1.jpg",
			},
			categories: [
				{
					name: "Tour",
					slug: "tour",
				},
			],
			venue: {
				venue: "Mission Mars",
			},
			cost: "",
			cost_details: {
				values: [],
			},
		},
	],
};

describe("SpaceCenterHoustonRipper", () => {
	let ripper: SpaceCenterHoustonRipper;
	let mockConfig: Ripper;

	beforeEach(() => {
		ripper = new SpaceCenterHoustonRipper();
		mockConfig = {
			config: {
				name: "space-center-houston",
				friendlyname: "Space Center Houston",
				description: "Space Center Houston",
				url: new URL("https://spacecenter.org/events/"),
				friendlyLink: "spacecenter.org",
				proxy: false,
				disabled: false,
				calendars: [
					{
						name: "main",
						friendlyname: "Space Center Houston",
						timezone: ZoneId.of("America/Chicago"),
					},
				],
				geo: {
					lat: 29.7517,
					lng: -95.0905,
					label: "Space Center Houston, 1601 E NASA Parkway, Houston, TX 77058",
				},
				tags: ["Education", "Science", "Space", "Family"],
			},
		} as any;
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	it("should parse valid events from API response", async () => {
		// Mock the fetch function
		global.fetch = vi.fn(async () => ({
			ok: true,
			json: async () => MOCK_API_RESPONSE,
		}));

		const calendars = await ripper.rip(mockConfig);

		expect(calendars).toHaveLength(1);
		const cal = calendars[0]!;

		expect(cal.name).toBe("main");
		expect(cal.events).toHaveLength(3);
		expect(cal.errors).toHaveLength(0);

		// Check first event details
		const firstEvent = cal.events[0]! as RipperCalendarEvent;
		expect(firstEvent.summary).toBe("Rocket Park Tram Tour");
		expect(firstEvent.id).toContain("rocket-park-tram-tour");
		expect(firstEvent.location).toContain("Space Center Houston");
		expect(firstEvent.image).toContain("rocket-park");
		expect(firstEvent.url).toContain("rocket-park-tram-tour");
		expect(firstEvent.description).toBe("Tram Tour");
	});

	it("should extract start and end times correctly", async () => {
		global.fetch = vi.fn(async () => ({
			ok: true,
			json: async () => MOCK_API_RESPONSE,
		}));

		const calendars = await ripper.rip(mockConfig);
		const events = calendars[0]!.events;

		// Check Rocket Park Tram Tour: 10:15 - 11:00 (45 minutes)
		const tram = events[0]!;
		expect(tram.date.hour()).toBe(10);
		expect(tram.date.minute()).toBe(15);
		// Duration should be 45 minutes
		const expectedDuration = Duration.ofMinutes(45);
		expect(tram.duration.compareTo(expectedDuration)).toBe(0);
	});

	it("should generate stable event IDs", async () => {
		global.fetch = vi.fn(async () => ({
			ok: true,
			json: async () => MOCK_API_RESPONSE,
		}));

		const calendars = await ripper.rip(mockConfig);
		const events = calendars[0]!.events;

		// IDs should be deterministic and contain date
		const id1 = events[0]!.id;
		expect(id1).toContain("rocket-park-tram-tour");
		expect(id1).toContain("2026-06-26");

		// Run again and verify IDs don't change
		const calendars2 = await ripper.rip(mockConfig);
		const events2 = calendars2[0]!.events;
		expect(events2[0]!.id).toBe(id1);
	});

	it("should handle events without end times by using default duration", async () => {
		const responseWithoutEndTime = {
			events: [
				{
					id: 12345,
					title: "Event Without End",
					start_date: "2026-06-30 15:00:00",
					// no end_date
					url: "https://spacecenter.org/event/1",
					categories: [{ name: "Workshop" }],
				},
			],
		};

		global.fetch = vi.fn(async () => ({
			ok: true,
			json: async () => responseWithoutEndTime,
		}));

		const calendars = await ripper.rip(mockConfig);
		const events = calendars[0]!.events;

		expect(events).toHaveLength(1);
		const event = events[0]!;
		expect(event.summary).toBe("Event Without End");
		// Should have default 1-hour duration
		expect(event.duration.compareTo(Duration.ofHours(1))).toBe(0);
	});

	it("should handle API fetch failures gracefully", async () => {
		global.fetch = vi.fn(async () => ({
			ok: false,
			status: 503,
			statusText: "Service Unavailable",
		}));

		await expect(ripper.rip(mockConfig)).rejects.toThrow(
			/API fetch failed.*503/
		);
	});

	it("should skip events with missing required fields and report errors", async () => {
		const responseWithMissing = {
			events: [
				{
					// Missing title
					start_date: "2026-06-30 15:00:00",
					url: "https://spacecenter.org/event/1",
				},
				{
					title: "Valid Event",
					start_date: "2026-06-30 16:00:00",
					url: "https://spacecenter.org/event/2",
				},
			],
		};

		global.fetch = vi.fn(async () => ({
			ok: true,
			json: async () => responseWithMissing,
		}));

		const calendars = await ripper.rip(mockConfig);
		const cal = calendars[0]!;

		expect(cal.events).toHaveLength(1);
		expect(cal.errors).toHaveLength(1);

		const error = cal.errors[0]! as RipperError;
		expect(error.type).toBe("ParseError");
		expect(error.reason).toContain("Missing event title");
	});

	it("should include ripped timestamp", async () => {
		global.fetch = vi.fn(async () => ({
			ok: true,
			json: async () => MOCK_API_RESPONSE,
		}));

		const beforeRip = new Date();
		const calendars = await ripper.rip(mockConfig);
		const afterRip = new Date();

		const events = calendars[0]!.events;
		events.forEach((event) => {
			expect(event.ripped).toBeInstanceOf(Date);
			expect(event.ripped.getTime()).toBeGreaterThanOrEqual(beforeRip.getTime());
			expect(event.ripped.getTime()).toBeLessThanOrEqual(afterRip.getTime());
		});
	});

	it("should set location to Space Center Houston address", async () => {
		global.fetch = vi.fn(async () => ({
			ok: true,
			json: async () => MOCK_API_RESPONSE,
		}));

		const calendars = await ripper.rip(mockConfig);
		const events = calendars[0]!.events;

		events.forEach((event) => {
			expect(event.location).toBe(
				"Space Center Houston, 1601 E NASA Parkway, Houston, TX 77058"
			);
		});
	});
});
