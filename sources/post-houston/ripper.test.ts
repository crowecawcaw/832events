import { describe, it, expect } from "vitest";
import { parse } from "node-html-parser";
import { LocalDate, LocalTime, LocalDateTime, ZoneId } from "@js-joda/core";

describe("POST Houston Ripper", () => {
	it("should parse event cards from HTML", () => {
		const html = `
		<div role="listitem" class="margin-bottom-sml w-dyn-item">
			<div class="link-card-wrapper hover-blue">
				<div class="w-layout-grid grid-4col link-overlay-event">
					<div class="event-time-location">
						<div class="small-text"><p fs-list-field="day" class="small-text inline">Fri</p></div>
						<div><h3 fs-list-field="date">6/26/26</h3></div>
						<div fs-list-field="location detail" class="w-dyn-list">
							<div role="list" class="comma-text-list w-dyn-items">
								<div role="listitem" class="comma-text-item w-dyn-item">
									<div class="small-text inline">Art Club</div>
								</div>
							</div>
						</div>
						<p class="small-text">10:00 pm</p>
					</div>
					<div class="event-flexbox">
						<div class="event-thumbnail-_info">
							<img src="https://cdn.example.com/image.jpg" alt="DJ Night" class="event-thumbnail"/>
							<div class="padding-left-30">
								<p fs-list-field="name">DJ Night — Sistek</p>
								<div class="event-item-card-tags">
									<div class="event-highlight__wrapper w-dyn-list">
										<div role="list" class="small-tag__list w-dyn-items">
											<div role="listitem" class="small-tag__item w-dyn-item">
												<div fs-list-field="type" class="xs-text inline">Music/Concert</div>
											</div>
										</div>
									</div>
								</div>
							</div>
						</div>
					</div>
				</div>
				<a href="/event/dj-night-sistek" class="link-overlay w-inline-block"></a>
			</div>
		</div>
		`;

		const root = parse(html);
		const eventCards = root.querySelectorAll(
			'div[role="listitem"].margin-bottom-sml.w-dyn-item'
		);

		expect(eventCards).toHaveLength(1);

		const card = eventCards[0];
		expect(card).toBeDefined();

		// Test extracting fields
		const titleEl = card.querySelector('[fs-list-field="name"]');
		expect(titleEl?.textContent?.trim()).toBe("DJ Night — Sistek");

		const dateEl = card.querySelector('[fs-list-field="date"]');
		expect(dateEl?.textContent?.trim()).toBe("6/26/26");

		const locationEls = card.querySelectorAll(
			'[fs-list-field="location detail"] .small-text.inline'
		);
		const locations = locationEls.map((el) => el.textContent?.trim()).filter(Boolean);
		expect(locations).toContain("Art Club");

		const typeEls = card.querySelectorAll('[fs-list-field="type"]');
		const types = typeEls.map((el) => el.textContent?.trim()).filter(Boolean);
		expect(types).toContain("Music/Concert");

		const imgEl = card.querySelector("img.event-thumbnail");
		expect(imgEl?.getAttribute("src")).toBe("https://cdn.example.com/image.jpg");

		const linkEl = card.querySelector("a.link-overlay");
		expect(linkEl?.getAttribute("href")).toBe("/event/dj-night-sistek");
	});

	it("should parse multiple events from HTML", () => {
		const html = `
		<div role="listitem" class="margin-bottom-sml w-dyn-item">
			<div class="link-card-wrapper hover-blue">
				<div class="w-layout-grid grid-4col link-overlay-event">
					<div class="event-time-location">
						<div><h3 fs-list-field="date">6/26/26</h3></div>
						<div fs-list-field="location detail" class="w-dyn-list">
							<div role="list" class="comma-text-list w-dyn-items">
								<div role="listitem" class="comma-text-item w-dyn-item">
									<div class="small-text inline">Art Club</div>
								</div>
							</div>
						</div>
						<p class="small-text">10:00 pm</p>
					</div>
					<div class="event-flexbox">
						<div class="event-thumbnail-_info">
							<div class="padding-left-30">
								<p fs-list-field="name">Event 1</p>
							</div>
						</div>
					</div>
				</div>
				<a href="/event/event-1" class="link-overlay w-inline-block"></a>
			</div>
		</div>
		<div role="listitem" class="margin-bottom-sml w-dyn-item">
			<div class="link-card-wrapper hover-blue">
				<div class="w-layout-grid grid-4col link-overlay-event">
					<div class="event-time-location">
						<div><h3 fs-list-field="date">6/27/26</h3></div>
						<div fs-list-field="location detail" class="w-dyn-list">
							<div role="list" class="comma-text-list w-dyn-items">
								<div role="listitem" class="comma-text-item w-dyn-item">
									<div class="small-text inline">Rooftop</div>
								</div>
							</div>
						</div>
						<p class="small-text">7:00 pm</p>
					</div>
					<div class="event-flexbox">
						<div class="event-thumbnail-_info">
							<div class="padding-left-30">
								<p fs-list-field="name">Event 2</p>
							</div>
						</div>
					</div>
				</div>
				<a href="/event/event-2" class="link-overlay w-inline-block"></a>
			</div>
		</div>
		`;

		const root = parse(html);
		const eventCards = root.querySelectorAll(
			'div[role="listitem"].margin-bottom-sml.w-dyn-item'
		);

		expect(eventCards).toHaveLength(2);
	});

	it("should parse date in MM/DD/YY format", () => {
		// Test date parsing function
		const dateStr = "6/26/26";
		const [month, day, year] = dateStr.split("/").map((s) => parseInt(s, 10));

		expect(month).toBe(6);
		expect(day).toBe(26);
		expect(year).toBe(26);

		// Convert 2-digit year
		const fullYear = year < 30 ? 2000 + year : 1900 + year;
		expect(fullYear).toBe(2026);

		const date = LocalDate.of(fullYear, month, day);
		expect(date.year()).toBe(2026);
		expect(date.monthValue()).toBe(6);
		expect(date.dayOfMonth()).toBe(26);
	});

	it("should parse time in H:MM AM/PM format", () => {
		const timeFormats = [
			"10:00 pm",
			"10:00 PM",
			"7:00 pm",
			"7:00 PM",
			"9:30 am",
			"9:30 AM",
			"12:00 am",
			"12:00 AM",
		];

		timeFormats.forEach((timeStr) => {
			const match = timeStr.match(/(\d{1,2}):(\d{2})\s*(AM|PM)/i);
			expect(match).toBeTruthy();
			if (match) {
				const hour = parseInt(match[1], 10);
				const minute = parseInt(match[2], 10);
				const ampm = match[3].toUpperCase();

				expect(hour).toBeGreaterThanOrEqual(1);
				expect(hour).toBeLessThanOrEqual(12);
				expect(minute).toBeGreaterThanOrEqual(0);
				expect(minute).toBeLessThan(60);
				expect(["AM", "PM"]).toContain(ampm);

				// Test hour adjustment
				const adjustedHour =
					ampm === "PM" && hour !== 12
						? hour + 12
						: ampm === "AM" && hour === 12
							? 0
							: hour;

				const time = LocalTime.of(adjustedHour, minute);
				expect(time).toBeDefined();
			}
		});
	});

	it("should handle events with multiple locations", () => {
		const html = `
		<div role="listitem" class="margin-bottom-sml w-dyn-item">
			<div class="link-card-wrapper hover-blue">
				<div class="w-layout-grid grid-4col link-overlay-event">
					<div class="event-time-location">
						<div><h3 fs-list-field="date">6/28/26</h3></div>
						<div fs-list-field="location detail" class="w-dyn-list">
							<div role="list" class="comma-text-list w-dyn-items">
								<div role="listitem" class="comma-text-item w-dyn-item">
									<div class="small-text inline">Z Atrium</div>
								</div>
								<div role="listitem" class="comma-text-item w-dyn-item">
									<div class="small-text inline">X Atrium</div>
								</div>
							</div>
						</div>
						<p class="small-text">11:00 am</p>
					</div>
					<div class="event-flexbox">
						<div class="event-thumbnail-_info">
							<div class="padding-left-30">
								<p fs-list-field="name">Multi-Location Event</p>
							</div>
						</div>
					</div>
				</div>
				<a href="/event/multi-location" class="link-overlay w-inline-block"></a>
			</div>
		</div>
		`;

		const root = parse(html);
		const card = root.querySelector(
			'div[role="listitem"].margin-bottom-sml.w-dyn-item'
		);
		expect(card).toBeDefined();

		const locationEls = card?.querySelectorAll(
			'[fs-list-field="location detail"] .small-text.inline'
		);
		const locations = locationEls
			?.map((el) => el.textContent?.trim())
			.filter(Boolean) || [];

		expect(locations).toHaveLength(2);
		expect(locations).toContain("Z Atrium");
		expect(locations).toContain("X Atrium");
	});

	it("should handle events with multiple types/tags", () => {
		const html = `
		<div role="listitem" class="margin-bottom-sml w-dyn-item">
			<div class="link-card-wrapper hover-blue">
				<div class="w-layout-grid grid-4col link-overlay-event">
					<div class="event-time-location">
						<div><h3 fs-list-field="date">6/27/26</h3></div>
						<div fs-list-field="location detail" class="w-dyn-list">
							<div role="list" class="comma-text-list w-dyn-items">
								<div role="listitem" class="comma-text-item w-dyn-item">
									<div class="small-text inline">Rooftop</div>
								</div>
							</div>
						</div>
						<p class="small-text">8:00 pm</p>
					</div>
					<div class="event-flexbox">
						<div class="event-thumbnail-_info">
							<div class="padding-left-30">
								<p fs-list-field="name">Music/Concert</p>
								<div class="event-item-card-tags">
									<div class="event-highlight__wrapper w-dyn-list">
										<div role="list" class="small-tag__list w-dyn-items">
											<div role="listitem" class="small-tag__item w-dyn-item">
												<div fs-list-field="type" class="xs-text inline">Music/Concert</div>
											</div>
											<div role="listitem" class="small-tag__item w-dyn-item">
												<div fs-list-field="type" class="xs-text inline">Party</div>
											</div>
											<div role="listitem" class="small-tag__item w-dyn-item">
												<div fs-list-field="type" class="xs-text inline">Performance</div>
											</div>
										</div>
									</div>
								</div>
							</div>
						</div>
					</div>
				</div>
				<a href="/event/concert" class="link-overlay w-inline-block"></a>
			</div>
		</div>
		`;

		const root = parse(html);
		const card = root.querySelector(
			'div[role="listitem"].margin-bottom-sml.w-dyn-item'
		);
		expect(card).toBeDefined();

		const typeEls = card?.querySelectorAll('[fs-list-field="type"]');
		const types = typeEls
			?.map((el) => el.textContent?.trim())
			.filter(Boolean) || [];

		expect(types).toHaveLength(3);
		expect(types).toContain("Music/Concert");
		expect(types).toContain("Party");
		expect(types).toContain("Performance");
	});

	it("should handle events without explicit time", () => {
		const html = `
		<div role="listitem" class="margin-bottom-sml w-dyn-item">
			<div class="link-card-wrapper hover-blue">
				<div class="w-layout-grid grid-4col link-overlay-event">
					<div class="event-time-location">
						<div><h3 fs-list-field="date">7/4/26</h3></div>
						<div fs-list-field="location detail" class="w-dyn-list">
							<div role="list" class="comma-text-list w-dyn-items">
								<div role="listitem" class="comma-text-item w-dyn-item">
									<div class="small-text inline">POST Market</div>
								</div>
							</div>
						</div>
						<p class="small-text w-condition-invisible">12:00 am</p>
					</div>
					<div class="event-flexbox">
						<div class="event-thumbnail-_info">
							<div class="padding-left-30">
								<p fs-list-field="name">All-Day Event</p>
							</div>
						</div>
					</div>
				</div>
				<a href="/event/all-day" class="link-overlay w-inline-block"></a>
			</div>
		</div>
		`;

		const root = parse(html);
		const card = root.querySelector(
			'div[role="listitem"].margin-bottom-sml.w-dyn-item'
		);
		expect(card).toBeDefined();

		const titleEl = card?.querySelector('[fs-list-field="name"]');
		expect(titleEl?.textContent?.trim()).toBe("All-Day Event");

		const dateEl = card?.querySelector('[fs-list-field="date"]');
		expect(dateEl?.textContent?.trim()).toBe("7/4/26");
	});
});
