---
name: Bayou Music Center
status: candidate
platform: Ticketmaster
url: https://www.bayoumusiccenter.com/shows
tags: [Music, Downtown]
firstSeen: 2026-06-13
lastChecked: 2026-06-13
pr:
---

3,464-capacity Live Nation indoor theater at 520 Texas Ave, Downtown Houston
(formerly Revention Music Center, formerly Verizon Wireless Theater). ~21
upcoming concerts in 2026–2027. Do not use the old "Revention" name in config.

Ticketmaster venue ID: **475415**
Live Nation venue ID: KovZpZAEkIIA

**Blocker:** Requires `TICKETMASTER_API_KEY` environment variable.

**Implementation (when API key is available):** `type: ticketmaster` with
`venueId: "475415"`. Geo: 520 Texas Ave, Houston, TX 77002
(lat 29.7545, lng -95.3630).
