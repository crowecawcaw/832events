---
name: Warehouse Live
status: candidate
platform: Custom HTML / Ticketmaster
url: https://warehouselivemidtown.com/calendar/
tags: [Music, Midtown]
firstSeen: 2026-06-14
lastChecked: 2026-06-14
pr:
---

Major Houston live music venue at 2600 Travis St, Houston TX 77006 (Midtown).
Two rooms: the main Warehouse stage and The Studio. Hosts rock, hip-hop, metal,
EDM, indie, and touring acts year-round. Capacity varies by room.

Calendar page confirmed (HTTP 200) — WordPress site:
`https://warehouselivemidtown.com/calendar/`

- **No Tribe Events ICS** — the `?post_type=tribe_events&ical=1` endpoint returns HTML, not calendar data
- Multi-platform ticketing: uses SeeTickets, Eventim, and Disco Presents per show (not consistently Ticketmaster)
- Ticketmaster venue IDs exist (475789 main, 476150 studio) but secondary/resale only
- Would require a custom HTML scraper of their calendar page or multi-platform aggregation
- Lower priority — complex integration, non-standard multi-platform setup
- Revisit if a simpler integration method is found (e.g., Ticketmaster venue scrape)

Geo: lat 29.7449, lng -95.3757 (2600 Travis St, Houston, TX 77006)
