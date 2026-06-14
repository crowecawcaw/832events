---
name: Discovery Green
status: investigating
platform: WordPress (custom HTML)
url: https://www.discoverygreen.com/events
tags: [Parks, Downtown, Music]
firstSeen: 2026-06-14
lastChecked: 2026-06-14
pr:
---

12-acre urban park in Downtown Houston at 1500 McKinney St, Houston, TX 77010
(adjacent to George R. Brown Convention Center). Managed by Discovery Green
Conservancy. Hosts 600+ events per year — free outdoor concerts, fitness
classes, movie screenings, food festivals, art installations, boat rentals,
and seasonal programming.

**Platform:** WordPress site. No ICS/iCal feed (`?ical=1` returns HTML).
Some events appear on Eventbrite under third-party organizers, but no
consistent Discovery Green Eventbrite organizer account confirmed.

**Verification (2026-06-14):** Fetched `https://www.discoverygreen.com/events` —
HTML page returned with 6 signature-experience events visible (series running
through summer 2026). The high total event count (600+/year) is driven by
daily drop-in programming that may not appear as discrete events on the page.

**Next steps:** Investigate whether Discovery Green has an official Eventbrite
organizer account for their curated events, or whether a custom WordPress
scraper targeting individual event categories
(`/event-category/music/`, `/event-category/entertainment/`) would be viable.
Check the WordPress REST API (`/wp-json/tribe/events/v1/events`) — if the site
uses Tribe Events, this returns structured JSON.

**Geo:** lat 29.7523, lng -95.3674 (1500 McKinney St, Houston, TX 77010)

**Confidence:** 🔴 Low pending investigation — very high event volume makes
this a high-value target, but platform requires further investigation.
