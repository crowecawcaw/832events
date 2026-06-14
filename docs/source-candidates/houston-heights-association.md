---
name: Houston Heights Association
status: added
platform: Tribe Events (ICS)
url: https://houstonheights.org/events/
tags: [The Heights, Community]
firstSeen: 2026-06-14
lastChecked: 2026-06-14
pr: (in progress)
---

The Houston Heights Association (HHA) is a civic organization serving The
Heights neighborhood (one of Houston's oldest historic districts). They
organize community events, historic preservation efforts, and neighborhood
activities.

ICS feed confirmed live (HTTP 200, `text/calendar`):
`https://houstonheights.org/?post_type=tribe_events&ical=1&eventDisplay=list`

- **30 events confirmed** from live fetch (2026-06-14)
- Caution: Research indicates event volume skews toward civic/administrative
  meetings (General Meeting 2nd Monday, Community Chat 3rd Wednesday) rather
  than large public events. Verify event mix before implementing.
- If mostly internal meetings, may be lower priority for an event aggregator
- Standard Tribe Events ICS, easy to add as `sources/external/houston-heights-association.yaml`

Geo: lat 29.7948, lng -95.3980 (The Heights, Houston, TX)
