---
name: White Oak Music Hall
status: candidate
platform: Ticketmaster
url: https://whiteoakmusichall.com/
tags: [Music, The Heights]
firstSeen: 2026-06-13
lastChecked: 2026-06-13
pr:
---

Multi-room live-music complex two miles north of downtown (2915 N. Main St,
Houston, TX 77009), ~400 shows/year across Downstairs, Upstairs, and the
outdoor Lawn. Ticketing is **Ticketmaster** — a good fit for the built-in
`ticketmaster` ripper type.

Ticketmaster venue IDs (from ticketmaster.com):
- `476183` — White Oak Music Hall (parent)
- `476304` — White Oak Music Hall — Lawn
- `476313` — White Oak Music Hall — Upstairs
- `476314` — White Oak Music Hall — Downstairs

Blocked on `TICKETMASTER_API_KEY`, which is not yet set in the repo (see the
city-setup key list). Once the key lands, add a `type: ticketmaster` ripper
and verify event counts in CI before merging. Not implemented yet because
the Discovery API can't be queried locally without the key, and the skill
forbids implementing an unverifiable source.
