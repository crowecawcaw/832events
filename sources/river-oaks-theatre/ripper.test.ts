import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));

const sampleHtml = readFileSync(join(__dirname, "sample-data.html"), "utf-8");

describe("River Oaks Theatre ripper", () => {
    it("loads sample data successfully", () => {
        expect(sampleHtml).toBeDefined();
        expect(sampleHtml.length).toBeGreaterThan(100);
    });

    it("sample data contains event-like elements", () => {
        // The sample should contain event information that can be parsed
        // Structure will depend on what the actual Eventive integration looks like
        expect(sampleHtml).toContain("theriveroakstheatre.com");
    });
});
