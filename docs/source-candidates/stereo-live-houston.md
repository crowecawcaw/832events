---
name: Stereo Live Houston
status: candidate
platform: Eventbrite
url: https://www.stereolivehouston.com/
tags: [Music, Nightlife, Downtown]
firstSeen: 2026-06-15
lastChecked: 2026-06-15
impl:
  type: eventbrite
  organizerId: "3006970476"
  observedEventCount: "unknown"
---

Stereo Live Houston is a music and nightlife venue in downtown Houston.

## Details

- **Website**: https://www.stereolivehouston.com/
- **Platform**: Eventbrite (organizer ID: 3006970476)
- **Event Type**: Live music, DJ events, club events
- **Location**: Downtown Houston
- **Confidence Tier**: 🟡 Medium — Eventbrite organizer identified but event volume unverified

## Investigation Notes

Organizer ID `3006970476` identified from web search. Requires live verification of event count and upcoming schedule.

## Implementation Notes

If event volume is confirmed (>0 upcoming events), implement as `sources/external/stereo-live-houston.yaml` using built-in `eventbrite` type with the provided organizer ID.
