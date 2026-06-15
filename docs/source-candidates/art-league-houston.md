---
name: Art League Houston
status: investigating
platform: Squarespace (endpoint disabled) — custom HTMLRipper
url: https://www.artleaguehouston.org/events
tags: [Art, Montrose]
firstSeen: 2026-06-13
lastChecked: 2026-06-15
pr:
---

> **2026-06-15 — custom ripper prototyped but NOT merged (no current upcoming events).**
> A custom HTMLRipper was written against the Squarespace event-list markup
> (`article.eventlist-event`; title `h1.eventlist-title a.eventlist-title-link`;
> date `time.event-date[datetime]` ISO `YYYY-MM-DD`; time `.event-time-24hr`;
> image `img.eventlist-thumbnail[data-src]`). It parses the sample correctly, but
> the live `/events`, `/upcomingcalendar`, and `/calendar` pages currently return
> only **past / early-2026** events (0 future as of 2026-06-15 — summer lull).
> Adding it now would trip the new-source 0-event gate. Revisit when upcoming
> events are published; reuse the selectors above. Apply a future-event filter in
> `rip()` like `sources/murder-by-the-book/ripper.ts` since the listing includes
> past events.


Houston's oldest visual-arts nonprofit (est. 1948), at 1953 Montrose Blvd,
Houston, TX 77006. Programs include gallery exhibitions, an art school,
artist talks, fundraiser events (Block Party), and the Texas Artist of the Year
program.

**Platform:** Squarespace (confirmed via HTML meta tags and asset domains).
Events page: https://artleaguehouston.org/events/

**Status:** Squarespace `?format=json` endpoint **does not return JSON**
- Tested endpoints:
  - `https://artleaguehouston.org/events?format=json` → HTTP 200, returns HTML (not JSON)
  - `https://artleaguehouston.org/calendar?format=json` → HTTP 200, returns JSON wrapper around HTML
- This Squarespace instance has the JSON endpoint disabled or misconfigured.
- HTML page lists events but requires custom scraping:
  - Events visible: "2026 Gala: Re/Mix", "2026 AHL Awards", "2026 Marty"
  - No ICS feed present
  - No standard calendar export available

**Next steps:**
- Custom HTMLRipper required to parse event cards from /events page
- Would need CSS selectors for title, date, description
- Requires sample-data.html for testing

**Geo:** lat 29.7405, lng -95.3905

**Implementation:** Custom HTMLRipper at `sources/art-league-houston/ripper.ts`.
- Selectors: `article.eventlist-event` → `h1.eventlist-title a.eventlist-title-link` (title), `time.event-date[datetime]` (ISO date), `.eventlist-meta-time .event-time-24hr` (24h time), `img.eventlist-thumbnail[data-src]` (image)
- Date format: ISO `YYYY-MM-DD` from `datetime` attribute — no year inference needed
- Unit test: 10/10 passing; sample contains 1 upcoming event (Block Party | Summer 2026, 2026-08-29 18:00) + ~10 past events — all parsed correctly
- `expectEmpty: true` set in ripper.yaml since near-term the calendar may be sparse

**Confidence:** 🟡 Medium — Custom ripper implemented and tested; live event count depends on programming schedule
