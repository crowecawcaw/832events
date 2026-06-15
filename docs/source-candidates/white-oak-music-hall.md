---
name: White Oak Music Hall
status: added
platform: Ticketmaster
url: https://whiteoakmusichall.com/
tags: [Music, The Heights]
firstSeen: 2026-06-13
lastChecked: 2026-06-15
pr:
---

> **2026-06-15 — implemented (venue ids corrected).** The numeric
> ticketmaster.com **website** ids below (`476183`, …) are not Discovery API v2
> venue ids and returned 0 events. WOMH spreads shows across three Discovery
> venues; the build now queries their **alphanumeric Discovery ids**
> comma-separated in one calendar (the API ORs multiple venueIds):
> `KovZ917AiGZ` (Downstairs), `KovZ917Ai5U` (Upstairs), `KovZ917Ata1` (Lawn) —
> sourced from the Live Nation venue URLs. The Lawn is seasonal, so a single
> combined calendar avoids an empty per-room calendar tripping the zero-event
> gate.


Multi-room live-music complex two miles north of downtown (2915 N. Main St,
Houston, TX 77009), ~400 shows/year across Downstairs, Upstairs, and the
outdoor Lawn. Ticketing is **Ticketmaster** — a good fit for the built-in
`ticketmaster` ripper type.

Ticketmaster venue IDs (from ticketmaster.com):
- `476183` — White Oak Music Hall (parent)
- `476304` — White Oak Music Hall — Lawn
- `476313` — White Oak Music Hall — Upstairs
- `476314` — White Oak Music Hall — Downstairs

**Investigation summary (2026-06-15):**
- No public ICS feed found via common Ticketmaster feed URLs (`.ics` endpoints return 400)
- No alternative calendar APIs exposed by their website (event-discovery plugin)
- Ticketmaster website uses JavaScript rendering — events not in initial HTML fetch
- RSS feed exists (`/feed/`) but is stale (last update 2023-03-20)

**Blocked on `TICKETMASTER_API_KEY`**, which is not yet set in the repo (see the
city-setup key list). Once the key is configured, implement as `type: ticketmaster` 
ripper with the four venue IDs above and verify event counts in CI before merging.
Cannot be implemented in CI today without the API key.
