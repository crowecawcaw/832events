---
name: Houston Ballet
status: investigating
platform: Ticketmaster (attraction-only)
url: https://www.houstonballet.org/seasontickets/calendar/
tags: [Dance, Downtown]
firstSeen: 2026-06-14
lastChecked: 2026-06-15
pr:
---

Houston Ballet is one of the largest ballet companies in the United States,
performing at the Wortham Theater Center, 501 Texas Ave, Houston, TX 77002
(Downtown). They perform a full season of classical and contemporary ballet
including The Nutcracker, Swan Lake, and modern premieres.

## Platform Analysis

**Ticketmaster**: Houston Ballet is on Ticketmaster as an attraction (ID 803870).
- Attraction page loads: https://www.ticketmaster.com/houston-ballet-tickets/artist/803870
- Venue ID (Wortham Theater Center): 475359
- **Blocker**: The built-in `ticketmaster` ripper in `lib/config/ticketmaster.ts` requires a `venueId` (Discovery API v2), not an `attractionId`. A venue-based config would capture all Wortham events (many organizations), not just Houston Ballet.
- No custom attractionId ripper implemented.

**Own site (houstonballet.org)**: Returns Cloudflare bot challenge, not 403. ICS feed
endpoint (`?post_type=tribe_events&ical=1`) also blocked.

## Decision

Status: **investigating** (Ticketmaster attraction-only, no venue-specific API).
The only viable Ticketmaster path uses a venue ID that over-matches all Wortham Theater programming,
which violates source specificity. No alternative platform or ICS feed confirmed viable.

Geo: lat 29.7560, lng -95.3671 (501 Texas Ave, Houston, TX 77002 — Wortham Theater Center)
