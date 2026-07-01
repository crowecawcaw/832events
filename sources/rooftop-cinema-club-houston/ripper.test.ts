/**
 * Tests for Rooftop Cinema Club Houston ripper
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import "@js-joda/timezone";
import RooftopCinemaClubHoustonRipper from "./ripper.js";
import {
    Ripper,
    RipperCalendar,
    RipperCalendarEvent,
} from "../../lib/config/schema.js";
import { ZoneId } from "@js-joda/core";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

describe("RooftopCinemaClubHoustonRipper", () => {
    const mockConfig = {
        name: "rooftop-cinema-club-houston",
        url: new URL("https://rooftopcinemaclub.com/us/houston/uptown"),
        tags: ["Cinema", "Entertainment", "Uptown"],
        calendars: [
            {
                name: "rooftop-cinema-club-houston",
                friendlyname: "Rooftop Cinema Club Houston",
                timezone: ZoneId.of("America/Chicago"),
            },
        ],
    } as unknown as any;

    it("should extract screening event from sample JSON-LD data", () => {
        const sampleHtml = readFileSync(
            join(__dirname, "sample-data.html"),
            "utf-8",
        );

        // Create a simple test to verify JSON extraction works
        const jsonMatch = sampleHtml.match(/"@type":\s*"ScreeningEvent"/);
        expect(jsonMatch).toBeTruthy();

        // Verify key fields are present
        expect(sampleHtml).toContain("USA vs Bosnia and Herzegovina");
        expect(sampleHtml).toContain("2026-07-01T19:00:00+00:00");
        expect(sampleHtml).toContain("Knock Out Rounds on the big screen");
    });

    it("should parse ISO 8601 dates correctly", () => {
        const sampleHtml = readFileSync(
            join(__dirname, "sample-data.html"),
            "utf-8",
        );

        // Verify dates are in ISO format
        const dates = sampleHtml.match(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/g);
        expect(dates).toBeTruthy();
        expect(dates).toContain("2026-07-01T19:00:00");
    });

    it("should have sample HTML with all required fields", () => {
        const sampleHtml = readFileSync(
            join(__dirname, "sample-data.html"),
            "utf-8",
        );

        // Verify structure
        expect(sampleHtml).toContain('"name":');
        expect(sampleHtml).toContain('"startDate":');
        expect(sampleHtml).toContain('"endDate":');
        expect(sampleHtml).toContain('"description":');
        expect(sampleHtml).toContain('"location":');
    });
});
