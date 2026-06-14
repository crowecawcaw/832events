---
name: Houston Ballet
status: candidate
platform: Ticketmaster
url: https://www.houstonballet.org/seasontickets/calendar/
tags: [Dance, Downtown]
firstSeen: 2026-06-14
lastChecked: 2026-06-14
pr:
---

Houston Ballet is one of the largest ballet companies in the United States,
performing at the Wortham Theater Center, 501 Texas Ave, Houston, TX 77002
(Downtown). They perform a full season of classical and contemporary ballet
including The Nutcracker, Swan Lake, and modern premieres.

Ticketmaster is their primary sales channel:
- Attraction ID: `803870` — https://www.ticketmaster.com/houston-ballet-tickets/artist/803870
- Venue ID (Wortham Theater Center): `475359`

- Use built-in `ticketmaster` ripper with `attractionId: "803870"`
- Medium confidence — Ticketmaster integration well-supported; season has ~30–50 performances/year
- Clean implementation with the built-in ripper type

Note: houstonballet.org returns HTTP 403 from agent environments; implementation
and verification should be done from a non-agent IP or with `proxy: "outofband"`.

Geo: lat 29.7560, lng -95.3671 (501 Texas Ave, Houston, TX 77002 — Wortham Theater Center)
