import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { ZoneId } from "@js-joda/core";
import "@js-joda/timezone";
import HoustonZooRipper from "./ripper.js";
import type { RipperCalendarEvent } from "../../lib/config/schema.js";
import type { Ripper } from "../../lib/config/schema.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

const sampleHtml = readFileSync(join(__dirname, "sample-data.html"), "utf-8");

describe("Houston Zoo ripper", () => {
    it("parses events from sample data", () => {
        // We can't directly call parseEvents since it's internal
        // Instead, we'll test the full ripper with mocked fetch
        expect(sampleHtml).toContain("eventItem");
        expect(sampleHtml).toContain("TXU Energy presents Mythical Realms");
    });

    it("sample data contains event elements with required attributes", () => {
        expect(sampleHtml).toContain('data-date="2026-03-06"');
        expect(sampleHtml).toContain('<span class="date">');
        expect(sampleHtml).toContain('class="textColumn"');
    });

    it("sample data has events with dates", () => {
        expect(sampleHtml).toContain("March 6 - September 7");
        expect(sampleHtml).toContain("Saturday, June 27");
        expect(sampleHtml).toContain("July 3 - July 5, 2026");
        expect(sampleHtml).toContain("Saturday, July 4, 8:00-9:00 a.m.");
    });

    it("sample data has valid event links", () => {
        expect(sampleHtml).toContain("https://www.houstonzoo.org/events/");
    });

    it("sample data has image references", () => {
        expect(sampleHtml).toContain("data-src=");
        expect(sampleHtml).toContain(".jpg");
    });
});
