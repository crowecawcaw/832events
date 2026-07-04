import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { ZoneId } from "@js-joda/core";
import "@js-joda/timezone";
import SongkickHoustonRipper from "./ripper.js";
import type { Ripper } from "../../lib/config/schema.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

const sampleHtml = readFileSync(join(__dirname, "sample-data.html"), "utf-8");

describe("Songkick Houston ripper", () => {
    it("parses events from sample data", () => {
        expect(sampleHtml).toContain("concerts");
        expect(sampleHtml).toContain("Sheryl Crow");
        expect(sampleHtml).toContain("Young the Giant");
    });

    it("sample data contains concert list items", () => {
        expect(sampleHtml).toContain('<a href="/concerts/');
        expect(sampleHtml).toContain("<strong>");
        expect(sampleHtml).toContain("Houston, TX, US");
    });

    it("sample data has dates in proper format", () => {
        expect(sampleHtml).toContain("Saturday 04 July 2026");
        expect(sampleHtml).toContain("Sunday 05 July 2026");
        expect(sampleHtml).toContain("Wednesday 09 July 2026");
        expect(sampleHtml).toContain("Thursday 10 July 2026");
        expect(sampleHtml).toContain("Saturday 12 September 2026");
    });

    it("sample data has venue links", () => {
        expect(sampleHtml).toContain('href="/venues/');
        expect(sampleHtml).toContain("713 Music Hall");
        expect(sampleHtml).toContain("House of Blues - Houston");
    });

    it("sample data has diverse artists", () => {
        expect(sampleHtml).toContain("Pleasure P");
        expect(sampleHtml).toContain("Valentino Khan");
        expect(sampleHtml).toContain("Hatebreed");
        expect(sampleHtml).toContain("Have A Nice Life");
        expect(sampleHtml).toContain("Danzig");
    });
});
