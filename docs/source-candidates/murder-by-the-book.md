---
name: Murder by the Book
status: candidate
platform: IndieCommerce (custom HTML)
url: https://murderbooks.com/events
tags: [Books, Museum District]
firstSeen: 2026-06-14
lastChecked: 2026-06-14
pr:
---

One of the nation's oldest and largest mystery and crime fiction specialty
bookstores (est. 1980) at 2342 Bissonnet St, Houston, TX 77005 (near Museum
District / Rice Village). Hosts 200+ author signing and conversation events
per year — nearly 10 events per month.

**Platform:** IndieCommerce (powered by American Booksellers Association).
No ICS/iCal feed. No Eventbrite integration. Events are listed in a custom
calendar on the website.

**Verification (2026-06-14):** Fetched `https://murderbooks.com/events` —
HTML page returned successfully. 10 upcoming events visible in June 2026
alone, all at 2342 Bissonnet St. Sample events:
- Jun 17: Hilary Davidson in conversation with Nishita Parekh (6:30pm)
- Jun 18: Martin Walker (6:30pm)
- Jun 20: Gabbie Hanks in conversation with Stephanie Graves (3:00pm)
- Jun 23: Kimberly McCreight in conversation with Abby Dunn (6:30pm)

**Implementation path:** Custom HTML ripper (`sources/murder_by_the_book/ripper.ts`)
scraping the IndieCommerce event listing page. High value given volume and
uniqueness of programming, but requires custom scraper.

**Geo:** lat 29.7271, lng -95.4199 (2342 Bissonnet St, Houston, TX 77005)

**Confidence:** 🔴 Low — requires custom HTML scraper, but site is accessible
(200 OK), event data is structured HTML, and volume (200+/year) justifies the
maintenance cost.
