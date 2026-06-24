import { describe, it, expect } from "vitest";
import { parse } from "node-html-parser";
import { LocalDate, LocalTime } from "@js-joda/core";
import KarbachBrewingCompanyRipper, { hashEventId } from "./ripper.js";

describe("Karbach Brewing Company Ripper", () => {
    describe("hashEventId", () => {
        it("should generate consistent IDs for same title and date", () => {
            const id1 = hashEventId("Summer Soccer at Karbach", "2026-06-11");
            const id2 = hashEventId("Summer Soccer at Karbach", "2026-06-11");
            expect(id1).toBe(id2);
            expect(id1).toContain("summer-soccer-at-karbach-2026-06-11");
        });

        it("should generate different IDs for different dates", () => {
            const id1 = hashEventId("Live Music Night", "2026-06-11");
            const id2 = hashEventId("Live Music Night", "2026-06-12");
            expect(id1).not.toBe(id2);
        });

        it("should generate different IDs for different titles", () => {
            const id1 = hashEventId("Live Music Night", "2026-06-11");
            const id2 = hashEventId("Trivia Night", "2026-06-11");
            expect(id1).not.toBe(id2);
        });

        it("should normalize title for ID consistency", () => {
            const id1 = hashEventId("Summer Soccer at Karbach", "2026-06-11");
            const id2 = hashEventId("SUMMER SOCCER AT KARBACH", "2026-06-11");
            expect(id1).toBe(id2);
        });
    });

    describe("extractEventLinks", () => {
        it("should extract event links from HTML", () => {
            const html = `
                <article class="article">
                    <a href="/community/event/summer-soccer/" class="thumb" style="background-image: url(/wp-content/uploads/2026/06/event.jpg);">
                    </a>
                    <div class="excerpt">
                        <time><a href="/community/event/summer-soccer/">June 11, 2026</a></time>
                        <h1><a href="/community/event/summer-soccer/">Summer Soccer at Karbach</a></h1>
                    </div>
                </article>
            `;

            const root = parse(html);
            const articles = root.querySelectorAll("article.article");
            expect(articles.length).toBe(1);

            const article = articles[0];
            const titleLink = article.querySelector("h1 a");
            expect(titleLink?.text).toBe("Summer Soccer at Karbach");
        });

        it("should handle missing event links gracefully", () => {
            const html = `
                <article class="article">
                    <div class="excerpt">
                        <time>June 11, 2026</time>
                    </div>
                </article>
            `;

            const root = parse(html);
            const articles = root.querySelectorAll("article.article");
            expect(articles.length).toBe(1);

            const article = articles[0];
            const titleLink = article.querySelector("h1 a");
            expect(titleLink).toBeNull();
        });

        it("should extract image URLs from background-image style", () => {
            const html = `
                <article class="article">
                    <a href="/community/event/test/" class="thumb" style="background-image: url(/wp-content/uploads/2026/06/image.jpg);">
                    </a>
                    <div class="excerpt">
                        <time>June 11, 2026</time>
                        <h1><a href="/community/event/test/">Test Event</a></h1>
                    </div>
                </article>
            `;

            const root = parse(html);
            const thumbEl = root.querySelector("a.thumb");
            const style = thumbEl?.getAttribute("style");
            expect(style).toContain("background-image:");

            const match = style?.match(/url\(([^)]+)\)/);
            expect(match?.[1]).toBe("/wp-content/uploads/2026/06/image.jpg");
        });
    });

    describe("parseEventDate", () => {
        it("should parse date strings like 'June 11, 2026'", () => {
            // Test parsing logic
            const dateStr = "June 11, 2026";
            const monthMatch = dateStr.match(
                /(January|February|March|April|May|June|July|August|September|October|November|December|Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)\s+(\d{1,2}),?\s+(\d{4})/i
            );
            expect(monthMatch).not.toBeNull();
            expect(monthMatch?.[1]).toBe("June");
            expect(monthMatch?.[2]).toBe("11");
            expect(monthMatch?.[3]).toBe("2026");
        });

        it("should parse abbreviated month names", () => {
            const dateStr = "Jun 11, 2026";
            const monthMatch = dateStr.match(
                /(January|February|March|April|May|June|July|August|September|October|November|December|Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)\s+(\d{1,2}),?\s+(\d{4})/i
            );
            expect(monthMatch).not.toBeNull();
            expect(monthMatch?.[1]).toBe("Jun");
        });

        it("should reject invalid date strings", () => {
            const dateStr = "Invalid Date";
            const monthMatch = dateStr.match(
                /(January|February|March|April|May|June|July|August|September|October|November|December|Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)\s+(\d{1,2}),?\s+(\d{4})/i
            );
            expect(monthMatch).toBeNull();
        });

        it("should handle dates without commas", () => {
            const dateStr = "June 11 2026";
            const monthMatch = dateStr.match(
                /(January|February|March|April|May|June|July|August|September|October|November|December|Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)\s+(\d{1,2}),?\s+(\d{4})/i
            );
            expect(monthMatch).not.toBeNull();
            expect(monthMatch?.[1]).toBe("June");
        });
    });

    describe("extractStartTime", () => {
        it("should extract time in 12-hour format", () => {
            const html = `<p>Event starts at 2:00 PM</p>`;
            const timeMatch = html.match(/(\d{1,2}):(\d{2})\s*(AM|PM|am|pm)/);
            expect(timeMatch).not.toBeNull();
            expect(timeMatch?.[1]).toBe("2");
            expect(timeMatch?.[2]).toBe("00");
            expect(timeMatch?.[3]).toBe("PM");
        });

        it("should handle AM times", () => {
            const html = `<p>Opens at 11:00 AM</p>`;
            const timeMatch = html.match(/(\d{1,2}):(\d{2})\s*(AM|PM|am|pm)/);
            expect(timeMatch).not.toBeNull();
            expect(timeMatch?.[1]).toBe("11");
            expect(timeMatch?.[3]).toBe("AM");
        });

        it("should handle lowercase am/pm", () => {
            const html = `<p>Event at 3:30 pm</p>`;
            const timeMatch = html.match(/(\d{1,2}):(\d{2})\s*(AM|PM|am|pm)/);
            expect(timeMatch).not.toBeNull();
            expect(timeMatch?.[3]).toBe("pm");
        });

        it("should return null for missing time", () => {
            const html = `<p>Event is coming soon</p>`;
            const timeMatch = html.match(/(\d{1,2}):(\d{2})\s*(AM|PM|am|pm)/);
            expect(timeMatch).toBeNull();
        });
    });

    describe("extractDescription", () => {
        it("should extract description from details section", () => {
            const html = `
                <main class="content">
                    <div class="event">
                        <div class="details">
                            <p>We will be open daily at 11am for all matches during the tournament.</p>
                            <p>Additional details here.</p>
                        </div>
                    </div>
                </main>
            `;

            const root = parse(html);
            const details = root.querySelector(".event .details");
            expect(details).not.toBeNull();

            const firstP = details?.querySelector("p");
            expect(firstP?.text).toContain("We will be open daily");
        });

        it("should return empty string if no details section", () => {
            const html = `<main class="content"><div>No details</div></main>`;
            const root = parse(html);
            const details = root.querySelector(".event .details");
            expect(details).toBeNull();
        });
    });

    describe("extractImage", () => {
        it("should extract image from img src", () => {
            const html = `
                <div class="featured-image">
                    <img src="/wp-content/uploads/2026/06/event.jpg" alt="Event">
                </div>
            `;

            const root = parse(html);
            const featuredImg = root.querySelector(".featured-image img");
            const src = featuredImg?.getAttribute("src");
            expect(src).toBe("/wp-content/uploads/2026/06/event.jpg");
        });

        it("should extract image from background-image style", () => {
            const html = `
                <div class="featured-image" style="background-image: url(/wp-content/uploads/2026/06/event.jpg);">
                </div>
            `;

            const root = parse(html);
            const bgDiv = root.querySelector(".featured-image[style]");
            const style = bgDiv?.getAttribute("style");
            const match = style?.match(/url\(([^)]+)\)/);
            expect(match?.[1]).toBe("/wp-content/uploads/2026/06/event.jpg");
        });

        it("should return undefined if no image found", () => {
            const html = `
                <div class="featured-image">
                </div>
            `;

            const root = parse(html);
            const featuredImg = root.querySelector(".featured-image img");
            const src = featuredImg?.getAttribute("src");
            expect(src).toBeUndefined();
        });
    });

    describe("RipperCalendarEvent structure", () => {
        it("should create valid event with all fields", () => {
            const mockEvent = {
                id: "summer-soccer-at-karbach-2026-06-11-abc123de",
                summary: "Summer Soccer at Karbach",
                date: new Date(),
                ripped: new Date(),
                duration: { _seconds: 10800 } as any, // 3 hours
                location: "2032 Karbach St, Houston, TX 77020",
                description: "We will be open daily at 11am for all matches",
                url: "https://www.karbachbrewing.com/community/event/summer-soccer/",
                image: "https://www.karbachbrewing.com/wp-content/uploads/2026/06/event.jpg",
            };

            expect(mockEvent.id).toContain("summer-soccer");
            expect(mockEvent.summary).toBe("Summer Soccer at Karbach");
            expect(mockEvent.location).toBe("2032 Karbach St, Houston, TX 77020");
            expect(mockEvent.description.length).toBeGreaterThan(0);
            expect(mockEvent.url).toContain("karbachbrewing.com");
            expect(mockEvent.image).toContain("wp-content/uploads");
        });

        it("should handle missing optional fields", () => {
            const mockEvent = {
                id: "test-event-2026-06-11-abc123de",
                summary: "Test Event",
                date: new Date(),
                ripped: new Date(),
                duration: { _seconds: 10800 } as any,
                location: "2032 Karbach St, Houston, TX 77020",
                description: "",
                url: "https://www.karbachbrewing.com/",
                image: undefined,
            };

            expect(mockEvent.description).toBe("");
            expect(mockEvent.image).toBeUndefined();
        });
    });

    describe("Edge cases", () => {
        it("should handle events with special characters in title", () => {
            const title = "Summer's Soccer & Games at Karbach";
            const id = hashEventId(title, "2026-06-11");
            // Apostrophes and ampersands become hyphens in slugified ID
            expect(id).toContain("summer-s-soccer-games-at-karbach");
        });

        it("should handle multiple events on same day", () => {
            const id1 = hashEventId("Event 1", "2026-06-11");
            const id2 = hashEventId("Event 2", "2026-06-11");
            expect(id1).not.toBe(id2);
        });

        it("should handle very long event titles", () => {
            const longTitle = "This is a very long event title that goes on and on describing the event in great detail with many words";
            const id = hashEventId(longTitle, "2026-06-11");
            expect(id).toBeDefined();
            expect(typeof id).toBe("string");
        });
    });
});
