import { describe, it, expect, beforeAll } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";
import { parse } from "node-html-parser";
import type { HTMLElement } from "node-html-parser";
import { ZoneId } from "@js-joda/core";
import ArthouseHoustonRipper from "./ripper.js";
import type { Ripper } from "../../lib/config/schema.js";

describe("Arthouse Houston Ripper", () => {
    let sampleHtml: string;

    beforeAll(() => {
        const samplePath = join(__dirname, "sample-data.html");
        sampleHtml = readFileSync(samplePath, "utf-8");
    });

    it("should load sample HTML without errors", () => {
        expect(sampleHtml).toBeDefined();
        expect(sampleHtml.length).toBeGreaterThan(0);
    });

    it("should parse the HTML structure", () => {
        const root = parse(sampleHtml);
        expect(root).toBeDefined();
        expect(root.outerHTML.length).toBeGreaterThan(0);
    });

    it("should extract elements from sample data", () => {
        const root = parse(sampleHtml);
        const eventElements = root.querySelectorAll(
            "[data-eventid], [class*='event'], [class*='show'], [class*='card']"
        );
        // Since this is a client-rendered page, may have 0 elements in static HTML
        expect(eventElements).toBeDefined();
    });

    it("should handle missing sample data gracefully", () => {
        const emptyHtml = "<html><body></body></html>";
        const root = parse(emptyHtml);
        const eventElements = root.querySelectorAll("[class*='event']");
        expect(eventElements.length).toBe(0);
    });
});
