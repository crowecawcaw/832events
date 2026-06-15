---
name: Warehouse Live
status: investigating
platform: WordPress + SeeTickets embed (custom HTML only)
url: https://warehouselivemidtown.com/calendar/
tags: [Music, "EaDo"]
firstSeen: 2026-06-14
lastChecked: 2026-06-15
pr:
---

Major Houston live music venue at 813 St Emanuel St, Houston TX 77003 (EaDo/warehouse district).
Two rooms: the main Warehouse stage and The Studio. Hosts rock, hip-hop, metal,
EDM, indie, and touring acts year-round.

**Platform Details:**
- WordPress with SeeTickets custom embed plugin (V35.3.1b)
- Events loaded via SeeTickets widget: `https://wl.seetickets.us/event/` (afflky=warehouselive parameter)
- No Tribe Events ICS: `/?post_type=tribe_events&ical=1` returns HTML, not calendar data
- SeeTickets does not provide public ICS feed/export (checked multiple endpoints)
- Events carry price, doors/showtime, artist names, genre in rendered HTML

**Ticketing ecosystem:**
- Primary: SeeTickets (embedded on website)
- Secondary: Ticketmaster venue IDs (475789 main, 476150 studio) exist but resale/secondary only — Ticketmaster main API returns 404 for studio
- Historical: Eventim, Disco Presents per show (non-standard, older data)

**Implementation path:** Custom HTMLRipper required — scrape `/calendar/` page SeeTickets widget output to extract event details. Estimated 10-20+ upcoming events visible. Volume: high year-round (this is a major venue).

**Complexity note:** SeeTickets embed is the only authoritative source; Ticketmaster secondary IDs are insufficient.

Geo: lat 29.7505, lng -95.3490, label "Warehouse Live, 813 St Emanuel St, Houston, TX 77003"
