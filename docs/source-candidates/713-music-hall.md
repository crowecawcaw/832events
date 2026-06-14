---
name: 713 Music Hall
status: candidate
platform: Ticketmaster
url: https://www.713musichall.com/shows
tags: [Music, Downtown]
firstSeen: 2026-06-13
lastChecked: 2026-06-13
pr:
---

5,000-capacity Live Nation venue in the former USPS headquarters building at
401 Franklin St, Downtown Houston. Active 2026 calendar (Jack Harlow, Charlie
Puth, Blue October). The event list renders client-side (JavaScript), so the
Ticketmaster API is the reliable integration path.

Ticketmaster venue ID: **476244**
Live Nation venue ID: KovZ917APwH

**Blocker:** Requires `TICKETMASTER_API_KEY` environment variable.

**Implementation (when API key is available):** `type: ticketmaster` with
`venueId: "476244"`. Geo: 401 Franklin St, Houston, TX 77201
(lat 29.7537, lng -95.3653).
