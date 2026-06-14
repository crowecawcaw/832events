---
name: Discovery Green
status: candidate
platform: Ticketmaster
url: https://www.discoverygreen.com/
tags: [Community, Music, Downtown]
firstSeen: 2026-06-13
lastChecked: 2026-06-13
pr:
---

12-acre urban park at 1500 McKinney St, Downtown Houston. ~50–100 events/year:
yoga, movie nights, outdoor concerts, seasonal festivals (Lighted Art Festival,
Winter Wonderland), and farmers market. Free admission for most events.

Ticketmaster venue ID: **475950**

Also listed on Localist (365thingsinhouston.com aggregator). No native ICS feed.

**Blocker:** Requires `TICKETMASTER_API_KEY` environment variable. Same
blocker as `white-oak-music-hall`.

**Implementation (when API key is available):** `type: ticketmaster` with
`venueId: "475950"`. Geo: 1500 McKinney St, Houston, TX 77010
(lat 29.7531, lng -95.3621).
