import { describe, it, expect } from "vitest";
import { parse } from "node-html-parser";

describe("SawyerYardsRipper", () => {
    // Sample HTML from Sawyer Yards events page
    const sampleHtml = `
    <div class="event-list-results">
      <div class="row">
        <div class="col-12 col-md-6 col-lg-4 event-card">
          <a href="/do/event-1">
            <div class="event-card-image lazyload" data-src="https://img.ctykit.com/example.jpg"></div>
          </a>
          <div class="event-card-label">Event One</div>
          <div class="event-card-dateline">Saturday, July 11
    12pm - 5pm</div>
          <p><a href="/do/event-1" class="btn btn-outline-brand">Read More</a></p>
        </div>
        <div class="col-12 col-md-6 col-lg-4 event-card">
          <a href="/do/event-2">
            <div class="event-card-image lazyload" data-src="https://img.ctykit.com/example2.jpg"></div>
          </a>
          <div class="event-card-label">Event Two</div>
          <div class="event-card-dateline">Wednesday, July 1
    6pm - 11pm</div>
          <p><a href="/do/event-2" class="btn btn-outline-brand">Read More</a></p>
        </div>
        <div class="col-12 col-md-6 col-lg-4 event-card">
          <a href="/do/event-3">
            <div class="event-card-image lazyload" data-src="https://img.ctykit.com/example3.jpg"></div>
          </a>
          <div class="event-card-label">Event Three with Colons: Subtitled</div>
          <div class="event-card-dateline">Thursday, July 2
    6:30pm - 8:30pm</div>
          <p><a href="/do/event-3" class="btn btn-outline-brand">Read More</a></p>
        </div>
      </div>
    </div>
    `;

    it("should parse HTML structure for event cards", () => {
        const root = parse(sampleHtml);
        const eventCards = root.querySelectorAll("div.event-card");

        expect(eventCards).toHaveLength(3);
        expect(eventCards[0].querySelector("div.event-card-label")?.text).toBe("Event One");
    });

    it("should extract event labels and dates from cards", () => {
        const root = parse(sampleHtml);
        const eventCards = root.querySelectorAll("div.event-card");

        const firstCard = eventCards[0];
        const label = firstCard.querySelector("div.event-card-label")?.text;
        const dateEl = firstCard.querySelector("div.event-card-dateline");

        expect(label).toBe("Event One");
        expect(dateEl?.childNodes.length).toBeGreaterThan(0);
    });

    it("should extract event links from cards", () => {
        const root = parse(sampleHtml);
        const eventCards = root.querySelectorAll("div.event-card");

        const firstCard = eventCards[0];
        const link = firstCard.querySelector("a");

        expect(link?.getAttribute("href")).toBe("/do/event-1");
    });

    it("should handle missing event labels with errors", () => {
        const htmlWithMissingLabel = `
            <div class="event-list-results">
                <div class="row">
                    <div class="col-12 col-md-6 col-lg-4 event-card">
                        <a href="/do/event"><div class="event-card-image"></div></a>
                        <div class="event-card-dateline">Saturday, July 11
        12pm - 5pm</div>
                    </div>
                </div>
            </div>
        `;
        const root = parse(htmlWithMissingLabel);
        const eventCards = root.querySelectorAll("div.event-card");

        expect(eventCards).toHaveLength(1);
        const label = eventCards[0].querySelector("div.event-card-label");
        expect(label).toBeNull();
    });
});
