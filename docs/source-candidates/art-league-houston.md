---
name: Art League Houston
status: investigating
platform: Squarespace
url: https://www.artleaguehouston.org/calendar
tags: [Art, Montrose]
firstSeen: 2026-06-13
lastChecked: 2026-06-14
pr:
---

Houston's oldest visual-arts nonprofit (est. 1948), at 1953 Montrose Blvd,
Houston, TX 77006. Programs include gallery exhibitions, an art school,
artist talks, fundraiser events (Block Party), and the Texas Artist of the Year
program.

**Platform:** Squarespace — site confirmed Squarespace.

**Investigation result (2026-06-14):** Fetched `/calendar?format=json` — the
Squarespace JSON endpoint returns `"itemCount":0` with no events in any array.
The calendar Squarespace block exists on the page but is empty. The `/events`
path serves HTML (the Gala 2026 page), not a JSON collection. The site does
have events (e.g. 78th Anniversary Gala, October 9 2026), but they are not
surfaced through the standard Squarespace `?format=json` endpoint that the
built-in `squarespace` ripper type uses.

**Next steps:** Check whether events are listed on Eventbrite under an Art
League Houston organizer account, or whether the site uses a custom HTML event
listing that would require a low-confidence HTML scraper.

**Geo:** lat 29.7441, lng -95.3941

**Confidence:** 🔴 Low — Squarespace calendar feed confirmed empty; need
alternative approach.
