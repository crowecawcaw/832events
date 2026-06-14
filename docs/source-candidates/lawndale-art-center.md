---
name: Lawndale Art Center
status: investigating
platform: WordPress (custom HTML)
url: https://lawndaleartcenter.org/events/
tags: [Art, Midtown]
firstSeen: 2026-06-14
lastChecked: 2026-06-14
pr:
---

Contemporary art center in Midtown Houston presenting exhibitions, performances,
readings, and community programs. Founded 1979, located at 4912 Main St, Houston TX 77002.

**Platform:** WordPress with a custom calendar implementation. No Tribe Events
ICS feed detected — the `/?ical=1` endpoint returns HTML, not iCal data. No
Eventbrite embed found.

Events are displayed on the site at /events/ with WordPress-style URL slugs
(e.g., `https://lawndaleartcenter.org/event/the-big-slide-show-12/`).

2 upcoming events visible as of 2026-06-14 (The Big Slide Show — July 18 and
August 1). Volume may be low in summer. The site runs 6+ exhibitions per year
with associated events (openings, artist talks, performances).

**Implementation path:** Custom HTMLRipper parsing the /events/ listing page.
Low priority compared to ICS/API sources. Consider investigating whether their
WordPress REST API (`/wp-json/tribe/events/v1/events`) is available.

Geo: 4912 Main St, Houston, TX 77002 (Midtown)
