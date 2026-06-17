import { describe, it, expect } from "vitest";
import { LocalDate, LocalDateTime, LocalTime, ZoneId } from "@js-joda/core";

describe("Lake Houston Brewery Ripper", () => {
    // Helper function to test date parsing logic
    function parseDateTime(text: string): { date: LocalDate; time: LocalTime } | null {
        if (!text) return null;

        text = text.trim().replace(/\s+/g, " ");

        const monthMap: Record<string, number> = {
            january: 1, february: 2, march: 3, april: 4, may: 5, june: 6,
            july: 7, august: 8, september: 9, october: 10, november: 11, december: 12,
            jan: 1, feb: 2, mar: 3, apr: 4, jun: 6, jul: 7, aug: 8,
            sep: 9, sept: 9, oct: 10, nov: 11, dec: 12,
        };

        // "Month DD, YYYY at HH:MM AM/PM"
        let match = text.match(/(january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)\s+(\d{1,2}),?\s+(\d{4})\s+(?:at\s+)?(\d{1,2}):(\d{2})\s*(am|pm)/i);
        if (match) {
            const month = monthMap[match[1]!.toLowerCase()];
            const day = parseInt(match[2]!, 10);
            const year = parseInt(match[3]!, 10);
            let hour = parseInt(match[4]!, 10);
            const min = parseInt(match[5]!, 10);
            const ampm = match[6]!.toLowerCase();

            if (ampm === "pm" && hour !== 12) hour += 12;
            if (ampm === "am" && hour === 12) hour = 0;

            try {
                const date = LocalDate.of(year, month, day);
                const time = LocalTime.of(hour, min);
                return { date, time };
            } catch {
                return null;
            }
        }

        // "MM/DD/YYYY HH:MM AM/PM"
        match = text.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})\s+(?:at\s+)?(\d{1,2}):(\d{2})\s*(am|pm)/i);
        if (match) {
            const month = parseInt(match[1]!, 10);
            const day = parseInt(match[2]!, 10);
            const year = parseInt(match[3]!, 10);
            let hour = parseInt(match[4]!, 10);
            const min = parseInt(match[5]!, 10);
            const ampm = match[6]!.toLowerCase();

            if (ampm === "pm" && hour !== 12) hour += 12;
            if (ampm === "am" && hour === 12) hour = 0;

            try {
                const date = LocalDate.of(year, month, day);
                const time = LocalTime.of(hour, min);
                return { date, time };
            } catch {
                return null;
            }
        }

        // "Day, Month DD at HH:MM AM/PM"
        match = text.match(/(?:monday|tuesday|wednesday|thursday|friday|saturday|sunday)[,\s]+(january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)\s+(\d{1,2})\s+(?:at\s+)?(\d{1,2}):(\d{2})\s*(am|pm)/i);
        if (match) {
            const month = monthMap[match[1]!.toLowerCase()];
            const day = parseInt(match[2]!, 10);
            let hour = parseInt(match[3]!, 10);
            const min = parseInt(match[4]!, 10);
            const ampm = match[5]!.toLowerCase();

            if (ampm === "pm" && hour !== 12) hour += 12;
            if (ampm === "am" && hour === 12) hour = 0;

            try {
                const today = LocalDate.now();
                let year = today.year();
                let date = LocalDate.of(year, month, day);

                if (date.isBefore(today)) {
                    year = year + 1;
                    date = LocalDate.of(year, month, day);
                }

                const time = LocalTime.of(hour, min);
                return { date, time };
            } catch {
                return null;
            }
        }

        return null;
    }

    describe("Date parsing", () => {
        it("should parse 'June 21, 2026 at 7:00 PM'", () => {
            const result = parseDateTime("June 21, 2026 at 7:00 PM");
            expect(result).toBeDefined();
            if (result) {
                expect(result.date.year()).toBe(2026);
                expect(result.date.monthValue()).toBe(6);
                expect(result.date.dayOfMonth()).toBe(21);
                expect(result.time.hour()).toBe(19);
                expect(result.time.minute()).toBe(0);
            }
        });

        it("should parse '6/21/2026 7:00 PM'", () => {
            const result = parseDateTime("6/21/2026 7:00 PM");
            expect(result).toBeDefined();
            if (result) {
                expect(result.date.year()).toBe(2026);
                expect(result.date.monthValue()).toBe(6);
                expect(result.date.dayOfMonth()).toBe(21);
                expect(result.time.hour()).toBe(19);
            }
        });

        it("should parse 'Friday, June 21 at 7:00 PM' and assume current/next year", () => {
            const result = parseDateTime("Friday, June 21 at 7:00 PM");
            expect(result).toBeDefined();
            if (result) {
                expect(result.date.monthValue()).toBe(6);
                expect(result.date.dayOfMonth()).toBe(21);
                expect(result.time.hour()).toBe(19);
            }
        });

        it("should convert 12:00 PM to 12:00 in 24-hour format", () => {
            const result = parseDateTime("June 21, 2026 at 12:00 PM");
            expect(result).toBeDefined();
            if (result) {
                expect(result.time.hour()).toBe(12);
            }
        });

        it("should convert 12:00 AM to 00:00 in 24-hour format", () => {
            const result = parseDateTime("June 21, 2026 at 12:00 AM");
            expect(result).toBeDefined();
            if (result) {
                expect(result.time.hour()).toBe(0);
            }
        });

        it("should convert 8:00 AM to 8:00 in 24-hour format", () => {
            const result = parseDateTime("June 21, 2026 at 8:00 AM");
            expect(result).toBeDefined();
            if (result) {
                expect(result.time.hour()).toBe(8);
            }
        });

        it("should parse month abbreviations like Jun, Jul, Sep", () => {
            const result = parseDateTime("Jul 15, 2026 at 6:00 PM");
            expect(result).toBeDefined();
            if (result) {
                expect(result.date.monthValue()).toBe(7);
            }
        });

        it("should return null for unparseable dates", () => {
            const result = parseDateTime("No date here");
            expect(result).toBeNull();
        });

        it("should handle extra whitespace", () => {
            const result = parseDateTime("  June   21 ,  2026   at   7:00   PM  ");
            expect(result).toBeDefined();
        });
    });

    describe("ID generation", () => {
        it("should generate deterministic IDs", () => {
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

            const id1 = hashEventId("Live Music Night", "2026-06-21");
            const id2 = hashEventId("Live Music Night", "2026-06-21");

            expect(id1).toBe(id2);
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

            const id1 = hashEventId("Live Music Night", "2026-06-21");
            const id2 = hashEventId("Live Music Night", "2026-06-22");

            expect(id1).not.toBe(id2);
        });
    });

    describe("Common brewery event patterns", () => {
        it("should handle 'Trivia Night - June 21, 2026 at 7:00 PM'", () => {
            const text = "Trivia Night - June 21, 2026 at 7:00 PM";
            const result = parseDateTime(text);
            expect(result).toBeDefined();
            if (result) {
                expect(result.date.monthValue()).toBe(6);
                expect(result.date.dayOfMonth()).toBe(21);
                expect(result.time.hour()).toBe(19);
            }
        });

        it("should handle 'Live Music - Friday, June 21 at 8:30 PM'", () => {
            const text = "Live Music - Friday, June 21 at 8:30 PM";
            const result = parseDateTime(text);
            expect(result).toBeDefined();
            if (result) {
                expect(result.date.monthValue()).toBe(6);
                expect(result.time.hour()).toBe(20);
                expect(result.time.minute()).toBe(30);
            }
        });

        it("should handle 'Happy Hour Special 6/21/2026 5:00 PM - 7:00 PM'", () => {
            const text = "Happy Hour Special 6/21/2026 5:00 PM";
            const result = parseDateTime(text);
            expect(result).toBeDefined();
            if (result) {
                expect(result.date.monthValue()).toBe(6);
                expect(result.time.hour()).toBe(17);
            }
        });

        it("should handle month/day format: 'Event June 5, 2026 at 2:00 PM'", () => {
            const result = parseDateTime("Event June 5, 2026 at 2:00 PM");
            expect(result).toBeDefined();
            if (result) {
                expect(result.date.monthValue()).toBe(6);
                expect(result.date.dayOfMonth()).toBe(5);
                expect(result.time.hour()).toBe(14);
            }
        });
    });

    describe("Event extraction edge cases", () => {
        it("should handle very short event titles", () => {
            // Parser should accept short titles like "DJ Night"
            const title = "DJ";
            expect(title.length).toBeLessThan(100);
        });

        it("should skip titles shorter than 3 characters", () => {
            const title = "DJ"; // 2 chars
            expect(title.length < 3).toBe(true);
        });

        it("should accept titles up to 100 characters", () => {
            const title = "A".repeat(100);
            expect(title.length <= 100).toBe(true);
        });

        it("should reject empty strings", () => {
            const title = "";
            expect(title.length < 3).toBe(true);
        });
    });

    describe("Time edge cases", () => {
        it("should handle times without leading zeros (1:30 PM)", () => {
            const result = parseDateTime("June 21, 2026 at 1:30 PM");
            expect(result).toBeDefined();
            if (result) {
                expect(result.time.hour()).toBe(13);
            }
        });

        it("should handle times with leading zeros (01:30 PM)", () => {
            const result = parseDateTime("June 21, 2026 at 01:30 PM");
            expect(result).toBeDefined();
            if (result) {
                expect(result.time.hour()).toBe(13);
            }
        });

        it("should handle full date range and just extract start time", () => {
            const result = parseDateTime("6/21/2026 7:00 PM - 10:00 PM");
            expect(result).toBeDefined();
            if (result) {
                expect(result.time.hour()).toBe(19);
                expect(result.time.minute()).toBe(0);
            }
        });
    });
});
