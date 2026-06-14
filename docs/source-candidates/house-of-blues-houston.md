---
name: House of Blues Houston
status: candidate
platform: Ticketmaster
url: https://houston.houseofblues.com/
tags: [Music, Downtown]
firstSeen: 2026-06-13
lastChecked: 2026-06-13
pr:
---

Live Nation–owned multi-room music venue at 1204 Caroline St, Downtown.
67+ upcoming concerts in 2026–2027 across the Music Hall, Bronze Peacock Room,
and Foundation Room.

Ticketmaster venue ID: **475902**
Live Nation venue ID: KovZpZAE6k1A

The venue website itself blocks automated requests (bot protection), but all
ticketing flows through Ticketmaster. No ICS feed.

**Blocker:** Requires `TICKETMASTER_API_KEY` environment variable. Same
blocker as `white-oak-music-hall`.

**Implementation (when API key is available):** `type: ticketmaster` with
`venueId: "475902"`. Geo: 1204 Caroline St, Houston, TX 77002
(lat 29.7509, lng -95.3680).
