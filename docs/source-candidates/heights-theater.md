---
name: The Heights Theater
status: candidate
platform: AXS
url: https://theheightstheater.com/
tags: [Music, The Heights]
firstSeen: 2026-06-13
lastChecked: 2026-06-13
pr:
---

Historic 1920s theater renovated in 2016 at 339 W 19th St, The Heights.
~700-seat boutique venue; ~17 upcoming shows in 2026–2027. Independent venue
(not Live Nation). AXS is the primary ticketing platform.

AXS venue ID: **126116**
AXS venue slug (for ripper.yaml): `the-heights-theater-houston-tickets`
Also distributed on Ticketmaster (venue ID 476164) but AXS is primary.

The built-in `axs` ripper uses curl (no API key required) — this is
implementable without waiting for a Ticketmaster key.

**Implementation:** `type: axs` with `venueId: 126116`,
`venueSlug: "the-heights-theater-houston-tickets"`,
`venueName: "The Heights Theater"`,
`venueAddress: "339 W 19th St, Houston, TX 77008"`.
Geo: lat 29.8002, lng -95.4103.
