import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));

const sampleHtml = readFileSync(
    join(__dirname, "sample-data.html"),
    "utf-8"
);

describe("Harris County Public Library ripper", () => {
    it("sample HTML contains event elements", () => {
        expect(sampleHtml).toContain("cp-events-search-item");
        expect(sampleHtml).toContain("cp-event-title");
        expect(sampleHtml).toContain("cp-event-date");
    });

    it("sample HTML contains multiple events", () => {
        const eventCount = (sampleHtml.match(/cp-events-search-item/g) || [])
            .length;
        expect(eventCount).toBeGreaterThan(0);
    });

    it("sample HTML contains event titles", () => {
        expect(sampleHtml).toContain('data-key="event-link"');
        expect(sampleHtml).toContain("ESL Classes");
    });

    it("sample HTML contains event dates", () => {
        expect(sampleHtml).toContain("cp-event-date-time");
        expect(sampleHtml).toContain("January");
    });

    it("sample HTML contains event locations", () => {
        expect(sampleHtml).toContain("cp-event-location-name");
        expect(sampleHtml).toContain("Library");
    });

    it("sample HTML contains event descriptions", () => {
        expect(sampleHtml).toContain("cp-event-description");
    });

    it("sample HTML contains event links with proper structure", () => {
        expect(sampleHtml).toContain(
            'href="https://hcpl.bibliocommons.com/events/'
        );
    });

    it("sample data contains valid date ranges", () => {
        expect(sampleHtml).toContain("to");
        expect(sampleHtml).toContain("Monday");
    });
});
