---
name: Art League Houston
status: investigating
platform: Squarespace (endpoint disabled)
url: https://www.artleaguehouston.org/events
tags: [Art, Montrose]
firstSeen: 2026-06-13
lastChecked: 2026-06-15
pr:
---

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

**Confidence:** 🔴 Low — Custom ripper needed; requires development effort
