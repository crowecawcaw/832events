---
name: Houston Arboretum & Nature Center
status: candidate
platform: Tribe Events (ICS)
url: https://houstonarboretum.org/events/
tags: [Parks, Community, Memorial]
firstSeen: 2026-06-14
lastChecked: 2026-06-14
pr:
---

Non-profit urban nature sanctuary at 4501 Woodway Dr, Houston, TX 77024
(Memorial Park area). Programming includes nature hikes, bird walks, children's
programs, yoga in the park, wildlife workshops, and volunteer events —
approximately 35 events/month.

WordPress + The Events Calendar (Tribe Events) site.
Reported ICS feed: `https://houstonarboretum.org/?post_type=tribe_events&ical=1&eventDisplay=list`
(converted from `webcal://` scheme). Implement as `sources/external/` ICS.

**Confidence: High** — Tribe Events ICS feeds are well-supported. High
programming volume and a good mix of free/low-cost community events. Verify
feed returns future events before implementing.

**Geo:** ~29.767, -95.457 (Memorial Park area — nearest neighborhood tag is
`Memorial`).
