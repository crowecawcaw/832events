---
name: Houston Symphony
status: candidate
platform: Ticketmaster
url: https://houstonsymphony.org/performance-calendar/
tags: [Music, Downtown]
firstSeen: 2026-06-13
lastChecked: 2026-06-13
pr:
---

One of the top US symphony orchestras, performing ~100 concerts/season at
Jones Hall (615 Louisiana St, Downtown Houston, TX 77002). Founded 1913.
Programs include classics, pops, family, and outdoor concerts at Hermann Park
(Miller Outdoor Theatre crossover events possible).

**Platform:** Ticketmaster — artist ID `803873`
`https://www.ticketmaster.com/houston-symphony-tickets/artist/803873`

Note: Ticketmaster `artist` IDs may not map directly to the built-in
`ticketmaster` ripper's `organizerId` field — verify which config key
accepts an artist ID vs organizer/venue ID. Jones Hall itself is a shared
venue (also hosts other Houston First events). Using the Symphony's artist
ID is likely cleaner than the venue ID.

Also check whether houstonsymphony.org exposes a Tribe Events ICS or any
`/events?ical=1` endpoint — the site's own calendar may be the cleanest feed
if available, avoiding Ticketmaster's data lag.

**Geo:** Jones Hall — lat 29.7537, lng -95.3677

**Confidence:** 🔥 High if Ticketmaster artist ID works; 🟡 Medium if artist
ID doesn't map cleanly to the ripper's config schema.
