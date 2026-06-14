---
name: Houston Heights Association
status: candidate
platform: Tribe Events (ICS)
url: https://houstonheights.org/events/
tags: [Community, The Heights]
firstSeen: 2026-06-13
lastChecked: 2026-06-13
pr:
---

Neighborhood association for one of Houston's oldest historic districts.
~35 events/month including community meetings, festivals, blood drives, and
neighborhood programming. Note: feed also includes city utility reminders
(recycling pickup dates) that inflate the count.

ICS feed confirmed live (subscribe links present on page):

- `webcal://houstonheights.org/?post_type=tribe_events&ical=1&eventDisplay=list`
- `https://houstonheights.org/events/month/?ical=1`

**Implementation:** Add `sources/external/houston-heights-association.yaml`.
Geo: null (neighborhood-wide calendar). Consider filtering utility-notice
events if they surface as noise. Tags: `Community`, `The Heights`.
