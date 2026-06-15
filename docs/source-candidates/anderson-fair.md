---
name: Anderson Fair
status: candidate
platform: Squarespace + Bandsintown
url: https://www.andersonfair.net/
tags: [Music, Folk, Community, Montrose]
firstSeen: 2026-06-15
lastChecked: 2026-06-15
---

Anderson Fair is a historic folk music venue in Montrose. Operates year-round except for summer closure (July–mid-September).

## Details

- **Website**: https://www.andersonfair.net/
- **Location**: Montrose, Houston
- **Event Type**: Folk music performances, live music, open mic nights
- **Platform**: Squarespace website with Bandsintown integration
- **Confidence Tier**: 🔴 Low — Squarespace + Bandsintown combination, seasonal closure
- **Seasonal Note**: Closed July–mid-September

## Investigation Notes

Historic folk music venue with Bandsintown integration for artist/tour tracking. Squarespace events feature may provide ICS export. Seasonal programming with summer closure.

## Implementation Notes

Verify Squarespace ICS export availability or Bandsintown API integration. Add `expectEmpty: true` for July–mid-September period due to seasonal closure. Implement as external ICS if feed available, otherwise investigate Bandsintown API.
