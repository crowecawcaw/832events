import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import "@js-joda/timezone";
import { ZoneId, LocalDate } from "@js-joda/core";

const __dirname = dirname(fileURLToPath(import.meta.url));

const sampleHtml = readFileSync(join(__dirname, "sample-data.html"), "utf-8");

describe("Concerts50 Houston ripper", () => {
    it("sample data contains slide elements", () => {
        expect(sampleHtml).toContain('class="slide"');
    });

    it("sample data contains event info sections", () => {
        expect(sampleHtml).toContain('class="info"');
        expect(sampleHtml).toContain('class="bottom_place"');
        expect(sampleHtml).toContain('class="top_place"');
    });

    it("sample data has multiple artist events", () => {
        expect(sampleHtml).toContain("<b>Afroman</b>");
        expect(sampleHtml).toContain("<b>Novulent</b>");
        expect(sampleHtml).toContain("<b>Arcángel</b>");
        expect(sampleHtml).toContain("<b>Don Omar</b>");
    });

    it("sample data has date/time information", () => {
        expect(sampleHtml).toContain("Aug 9 · Sun, 7:00 PM");
        expect(sampleHtml).toContain("Aug 8 · Sat, 6:00 PM");
        expect(sampleHtml).toContain("Oct 23 · Fri, 8:00 PM");
        expect(sampleHtml).toContain("Nov 5 · Thu, 8:00 PM");
    });

    it("sample data has venue information", () => {
        expect(sampleHtml).toContain("House of Blues Restaurant &amp; Bar - Houston, TX");
        expect(sampleHtml).toContain("White Oak Music Hall - Houston, TX");
        expect(sampleHtml).toContain("Toyota Center - Houston, TX");
        expect(sampleHtml).toContain("Warehouse Live - Houston, TX");
    });

    it("sample data has event URLs", () => {
        expect(sampleHtml).toContain("https://concerts50.com/show/afroman-in-houston-tickets-aug-09-2026");
        expect(sampleHtml).toContain("https://concerts50.com/show/don-omar-in-houston-tickets-oct-23-2026");
    });

    it("sample data has artist images", () => {
        expect(sampleHtml).toContain("https://concerts50.com/uploads/artist/");
        expect(sampleHtml).toContain(".jpg");
    });

    it("sample data has event links structure", () => {
        expect(sampleHtml).toContain('href="https://concerts50.com/show/');
        expect(sampleHtml).toContain('<li class="slide">');
    });

    it("sample data has various time formats", () => {
        // Test different time formats present in the page
        expect(sampleHtml).toMatch(/\d{1,2}:\d{2}\s*(AM|PM|am|pm)/);
    });
});
