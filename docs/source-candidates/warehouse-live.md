---
name: Warehouse Live
status: candidate
platform: AXS
url: https://warehouselivemidtown.com/calendar/
tags: [Music, Midtown]
firstSeen: 2026-06-13
lastChecked: 2026-06-13
pr:
---

Mid-size independent music venue with two rooms (Midtown + Ballroom) in
Midtown Houston. Active calendar with 45+ upcoming events; genres span
electronic, hip-hop, rock, and Latin. The venue website calendar returned 503
during research — likely JS-rendered — but AXS is the confirmed primary
ticketing platform.

AXS venue IDs: **101377** (main) and **101368** (Ballroom sub-room)
AXS slugs: `warehouse-live-houston-tickets` / `warehouse-live-ballroom-houston-tickets`
Also distributed on Ticketmaster (venue ID 475789) and Eventbrite.

The built-in `axs` ripper uses curl (no API key required).

**Implementation:** `type: axs` with both venue IDs as separate calendars in
one `ripper.yaml`. Primary venue geo: 813 St Emanuel St, Houston, TX 77003
(lat 29.7461, lng -95.3597).
