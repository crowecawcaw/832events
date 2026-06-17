import { describe, it, expect } from "vitest";
import { LocalDate, LocalTime } from "@js-joda/core";

describe("Basket Books & Art Ripper", () => {
    it("should parse 'Month Day, Year' date format", () => {
        const dateStr = "June 11, 2026";
        const monthMap: Record<string, number> = {
            january: 1, february: 2, march: 3, april: 4, may: 5, june: 6,
            july: 7, august: 8, september: 9, october: 10, november: 11, december: 12,
            jan: 1, feb: 2, mar: 3, apr: 4, jun: 6, jul: 7, aug: 8,
            sep: 9, sept: 9, oct: 10, nov: 11, dec: 12,
        };

        const simpleDateMatch = dateStr.match(/(\w+)\s+(\d{1,2})(?:,\s*(\d{4}))?/);
        expect(simpleDateMatch).toBeTruthy();
        if (simpleDateMatch) {
            const monthStr = simpleDateMatch[1]!;
            const day = parseInt(simpleDateMatch[2]!, 10);
            const year = simpleDateMatch[3] ? parseInt(simpleDateMatch[3]!, 10) : LocalDate.now().year();

            const month = monthMap[monthStr.toLowerCase()];
            expect(month).toBe(6);
            expect(day).toBe(11);
            expect(year).toBe(2026);

            const eventDate = LocalDate.of(year, month, day);
            expect(eventDate.toString()).toBe("2026-06-11");
        }
    });

    it("should parse 'Month Day' date format without year", () => {
        const dateStr = "June 11";
        const monthMap: Record<string, number> = {
            january: 1, february: 2, march: 3, april: 4, may: 5, june: 6,
            july: 7, august: 8, september: 9, october: 10, november: 11, december: 12,
            jan: 1, feb: 2, mar: 3, apr: 4, jun: 6, jul: 7, aug: 8,
            sep: 9, sept: 9, oct: 10, nov: 11, dec: 12,
        };

        const simpleDateMatch = dateStr.match(/(\w+)\s+(\d{1,2})(?:,\s*(\d{4}))?/);
        expect(simpleDateMatch).toBeTruthy();
        if (simpleDateMatch) {
            const monthStr = simpleDateMatch[1]!;
            const day = parseInt(simpleDateMatch[2]!, 10);
            const month = monthMap[monthStr.toLowerCase()];

            expect(month).toBe(6);
            expect(day).toBe(11);
        }
    });

    it("should parse 'Thursday, Month Day' date format", () => {
        const dateStr = "Thursday, June 11";
        const monthMap: Record<string, number> = {
            january: 1, february: 2, march: 3, april: 4, may: 5, june: 6,
            july: 7, august: 8, september: 9, october: 10, november: 11, december: 12,
            jan: 1, feb: 2, mar: 3, apr: 4, jun: 6, jul: 7, aug: 8,
            sep: 9, sept: 9, oct: 10, nov: 11, dec: 12,
        };

        const monthDayYearMatch = dateStr.match(
            /(?:Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)[,\s]*(\w+)\s+(\d{1,2})(?:,\s*(\d{4}))?/i
        );
        expect(monthDayYearMatch).toBeTruthy();
        if (monthDayYearMatch) {
            const monthStr = monthDayYearMatch[1]!;
            const day = parseInt(monthDayYearMatch[2]!, 10);
            const month = monthMap[monthStr.toLowerCase()];

            expect(month).toBe(6);
            expect(day).toBe(11);
        }
    });

    it("should parse time in HH:MM AM/PM format", () => {
        const dateStr = "June 11, 2026 at 7:00 PM";
        const timeMatch = dateStr.match(/(\d{1,2}):(\d{2})\s*(AM|PM|am|pm)/i);

        expect(timeMatch).toBeTruthy();
        if (timeMatch) {
            let hour = parseInt(timeMatch[1]!, 10);
            const minute = parseInt(timeMatch[2]!, 10);
            const ampm = timeMatch[3]!.toUpperCase();

            if (ampm === "PM" && hour !== 12) hour += 12;
            if (ampm === "AM" && hour === 12) hour = 0;

            expect(hour).toBe(19);
            expect(minute).toBe(0);

            const time = LocalTime.of(hour, minute);
            expect(time.toString()).toBe("19:00");
        }
    });

    it("should handle PM time conversion", () => {
        const hour = "2";
        const ampm = "PM";

        let adjustedHour = parseInt(hour, 10);
        if (ampm === "PM" && adjustedHour !== 12) adjustedHour += 12;
        if (ampm === "AM" && adjustedHour === 12) adjustedHour = 0;

        expect(adjustedHour).toBe(14);
    });

    it("should handle AM time conversion", () => {
        const hour = "8";
        const ampm = "AM";

        let adjustedHour = parseInt(hour, 10);
        if (ampm === "PM" && adjustedHour !== 12) adjustedHour += 12;
        if (ampm === "AM" && adjustedHour === 12) adjustedHour = 0;

        expect(adjustedHour).toBe(8);
    });

    it("should handle 12:00 PM correctly", () => {
        const hour = "12";
        const ampm = "PM";

        let adjustedHour = parseInt(hour, 10);
        if (ampm === "PM" && adjustedHour !== 12) adjustedHour += 12;
        if (ampm === "AM" && adjustedHour === 12) adjustedHour = 0;

        expect(adjustedHour).toBe(12);
    });

    it("should handle 12:00 AM correctly", () => {
        const hour = "12";
        const ampm = "AM";

        let adjustedHour = parseInt(hour, 10);
        if (ampm === "PM" && adjustedHour !== 12) adjustedHour += 12;
        if (ampm === "AM" && adjustedHour === 12) adjustedHour = 0;

        expect(adjustedHour).toBe(0);
    });

    it("should generate stable event IDs", () => {
        const slugify = (s: string) =>
            s
                .toLowerCase()
                .replace(/[^a-z0-9]+/g, "-")
                .replace(/^-+|-+$/g, "");

        const hashEventId = (title: string, dateStr: string) => {
            const crypto = require("crypto");
            const key = `${slugify(title)}-${dateStr}`;
            const hash = crypto
                .createHash("sha256")
                .update(key)
                .digest("hex")
                .substring(0, 8);
            return `${key}-${hash}`;
        };

        const title = "Poetry Reading";
        const dateStr = "2026-06-11";

        const id1 = hashEventId(title, dateStr);
        const id2 = hashEventId(title, dateStr);

        expect(id1).toBe(id2);
        expect(id1).toContain("poetry-reading");
        expect(id1).toContain("2026-06-11");
    });

    it("should generate different IDs for different dates", () => {
        const slugify = (s: string) =>
            s
                .toLowerCase()
                .replace(/[^a-z0-9]+/g, "-")
                .replace(/^-+|-+$/g, "");

        const hashEventId = (title: string, dateStr: string) => {
            const crypto = require("crypto");
            const key = `${slugify(title)}-${dateStr}`;
            const hash = crypto
                .createHash("sha256")
                .update(key)
                .digest("hex")
                .substring(0, 8);
            return `${key}-${hash}`;
        };

        const title = "Poetry Reading";
        const id1 = hashEventId(title, "2026-06-11");
        const id2 = hashEventId(title, "2026-06-12");

        expect(id1).not.toBe(id2);
    });

    it("should parse numeric M/D/YYYY date format", () => {
        const dateStr = "6/11/2026";
        const numericDateMatch = dateStr.match(/(\d{1,2})\/(\d{1,2})(?:\/(\d{4}))?/);

        expect(numericDateMatch).toBeTruthy();
        if (numericDateMatch) {
            const month = parseInt(numericDateMatch[1]!, 10);
            const day = parseInt(numericDateMatch[2]!, 10);
            const year = numericDateMatch[3] ? parseInt(numericDateMatch[3]!, 10) : LocalDate.now().year();

            expect(month).toBe(6);
            expect(day).toBe(11);
            expect(year).toBe(2026);

            const eventDate = LocalDate.of(year, month, day);
            expect(eventDate.toString()).toBe("2026-06-11");
        }
    });
});
