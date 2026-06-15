---
name: Station Theater
status: investigating
platform: Squarespace + CrowdWork
url: https://stationtheater.com/
tags: [Comedy, First Ward]
firstSeen: 2026-06-14
lastChecked: 2026-06-15
pr:
---

Houston's longest-running improv comedy theater. Presents improv shows,
workshops, and special events year-round. Regular shows include Friday Improv
Implosion and Saturday Singularity Improv.

**Platform:** Squarespace website + CrowdWork ticketing

**Investigation findings (2026-06-15):**
- Tested Squarespace `?format=json` on `/shows`, `/events`, `/calendar` — all
  returned page metadata with **no event data** (collection.type=10, itemCount=0)
- Squarespace's native `?format=json` events endpoint is not applicable; shows
  are not stored in a Squarespace event collection
- Events are managed via CrowdWork ticketing: https://www.crowdwork.com/v/stationtheater/shows
- CrowdWork is a proprietary platform without confirmed public JSON/ICS API

**Blocker:** No publicly available calendar data (ICS feed or JSON API) found.
Events are behind CrowdWork's JS-rendered ticketing interface. Would require
either: (1) CrowdWork API access, (2) browser automation (JS rendering), or
(3) HTML scraping CrowdWork's JS-rendered page.

**Geo:** 1230 Houston Ave, Houston, TX 77007 (First Ward)
