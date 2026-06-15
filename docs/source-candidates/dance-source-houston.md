---
name: Dance Source Houston
status: candidate
platform: Tribe Events (ICS)
url: https://dancesourcehouston.org/the-dance-card/
tags: [Dance, Community, Arts]
firstSeen: 2026-06-15
lastChecked: 2026-06-15
pr:
impl:
  type: external
  icsUrl: https://dancesourcehouston.org/?post_type=tribe_events&ical=1&eventDisplay=list
  infoUrl: https://dancesourcehouston.org/the-dance-card/
  observedEventCount: 33
  geo: null
---

Houston's comprehensive dance events aggregator — "The Dance Card" publishes
listings for performances, auditions, workshops, and community events from
dance organizations across the city. Not a venue; covers all of Houston.

Covers companies like Frame Dance Ensemble, Houston Contemporary Dance Company,
Houston Dance Consortium, Houston Ballet, University of Houston Dance, and
others. Programming spans contemporary, ballet, folklórico, hip-hop, and more.

**Feed verified 2026-06-15**: `https://dancesourcehouston.org/?post_type=tribe_events&ical=1&eventDisplay=list`
returns a valid VCALENDAR with 33 VEVENTs. First event: "Hold the Door! A
premiere by the Frame Dance Ensemble" – June 15, 2026, 7:30 PM.

**Platform**: The Events Calendar WordPress plugin — same pipeline as
`eureka-heights-brew-co`, `inprint-houston`, and other already-added sources.

**Confidence: High** — ICS feed confirmed working, 33 events, established
aggregator organization. Implement as `sources/external/dance-source-houston.yaml`.

**geo: null** — multi-venue aggregator covering all of Houston, not a single
fixed location.
