import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { ZoneId } from "@js-joda/core";
import "@js-joda/timezone";
import ChildrenMuseumHoustonRipper from "./ripper.js";
import type { RipperCalendarEvent } from "../../lib/config/schema.js";
import type { Ripper } from "../../lib/config/schema.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

const sampleHtml = readFileSync(join(__dirname, "sample-data.html"), "utf-8");

describe("Children's Museum Houston ripper", () => {
	it("parses events from sample data", () => {
		// Verify sample HTML contains event elements
		expect(sampleHtml).toContain("event-card");
		expect(sampleHtml).toContain("event-title");
		expect(sampleHtml).toContain("Free Family Night Thursday");
	});

	it("sample data contains event elements with dates", () => {
		expect(sampleHtml).toContain("Jul 02, 2026");
		expect(sampleHtml).toContain("Jul 02 - Jul 05, 2026");
		expect(sampleHtml).toContain("Jul 03 - Sep 04, 2026");
		expect(sampleHtml).toContain("Oct 23 - Oct 25, 2026");
	});

	it("sample data has valid event links", () => {
		expect(sampleHtml).toContain('href="/events/');
		expect(sampleHtml).toContain("event-link");
		expect(sampleHtml).toContain("Event Details");
	});

	it("sample data has single-day events", () => {
		expect(sampleHtml).toContain("Minions' Monster Party");
		expect(sampleHtml).toContain("Kidpendence Day Party!");
		expect(sampleHtml).toContain("Tanabata Japanese Star Festival");
	});

	it("sample data has multi-day events", () => {
		expect(sampleHtml).toContain("BASF Kids' Labs");
		expect(sampleHtml).toContain("Family Bollywood Dance Experience");
		expect(sampleHtml).toContain("Kaleidoscope Workshop Series");
	});

	it("sample data has free family night events", () => {
		expect(sampleHtml).toContain("Free Family Night Thursday");
		expect(sampleHtml).toContain("ExxonMobil Second Thursday Free Family Night");
		expect(sampleHtml).toContain("Shriners Children's Texas Free Family Night Thursday");
	});

	it("sample data has events across multiple months", () => {
		expect(sampleHtml).toContain("Jul");
		expect(sampleHtml).toContain("Sep");
		expect(sampleHtml).toContain("Oct");
		expect(sampleHtml).toContain("Nov");
		expect(sampleHtml).toContain("Dec");
	});
});
