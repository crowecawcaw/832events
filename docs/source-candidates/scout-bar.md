---
name: Scout Bar
status: candidate
platform: AXS
url: https://scoutbar.com/calendar/
tags: [Music]
firstSeen: 2026-06-14
lastChecked: 2026-06-14
pr:
impl:
  type: axs
  venueId: 130538
  venueSlug: scout-bar-houston   # slug in https://www.axs.com/venues/130538/scout-bar-houston
  observedEventCount: null   # AXS bot-blocks (HTTP 403) — NOT verifiable in CI or locally; see AGENTS.md AXS guidance
  geo: { lat: 29.5699, lng: -95.1248, label: "Scout Bar, 18307 Egret Bay Blvd, Houston, TX 77058" }
---

Scout Bar is a live music venue at 18307 Egret Bay Blvd, Houston, TX 77058
(Clear Lake / South Houston). Mid-size club hosting rock, country, metal,
and touring acts. AXS is their primary ticketing platform.

Calendar page confirmed (HTTP 200) — WordPress site:
`https://scoutbar.com/calendar/`

- No Tribe Events ICS — `?post_type=tribe_events` endpoint returns HTML
- **AXS venue ID: 130538**, slug: `scout-bar-houston`
- Can use the built-in `axs` ripper type
- Located in Clear Lake area (not central Houston — ~25 miles SE of Downtown)
- Worth adding for completeness of Houston metro music coverage
- Medium confidence — AXS integration is well-supported; just need to verify event volume

Geo: lat 29.5699, lng -95.1248 (18307 Egret Bay Blvd, Houston, TX 77058)
Note: Clear Lake is included in the Houston metro but far from the urban core.
