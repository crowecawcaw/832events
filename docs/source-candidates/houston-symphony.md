---
name: Houston Symphony
status: investigating
platform: Ticketmaster
url: https://houstonsymphony.org/performance-calendar/
tags: [Music, Downtown]
firstSeen: 2026-06-13
lastChecked: 2026-06-15
pr:
---

One of the top US symphony orchestras, performing ~100 concerts/season at
Jones Hall (615 Louisiana St, Downtown Houston, TX 77002). Founded 1913.
Programs include classics, pops, family, and outdoor concerts at Hermann Park
(Miller Outdoor Theatre crossover events possible).

**Platform:** Ticketmaster — artist ID `803873`
`https://www.ticketmaster.com/houston-symphony-tickets/artist/803873`

**Investigation findings (2026-06-15):**
- ICS feed URLs: Both `/events?ical=1` endpoints return 404 — no public ICS
- Ticketmaster ripper supports only `venueId` (via Discovery API v2 `/events?venueId=...`), not artist IDs
- Jones Hall's venueId not readily available via standard Ticketmaster URL patterns or public search
- Website calendar is heavily JavaScript-rendered (Ticketmaster-hosted)
- Jones Hall is a shared venue (also hosts other Houston First programming)

**Status**: **Blocked** — Unable to implement without the Ticketmaster venue ID for Jones Hall
(artist ID 803873 is not sufficient; the built-in ripper requires venueId for API access).

**Path forward:**
1. Contact Ticketmaster support or manually search Ticketmaster API for Jones Hall venueId
2. Or source Houston Symphony via a different integration if Ticketmaster provides one (e.g., calendar platform)
3. Or implement a custom HTMLRipper against the JavaScript-rendered site (less preferred, fragile)

**Geo:** Jones Hall — lat 29.7537, lng -95.3677
