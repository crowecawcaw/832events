---
name: Rice Village Farmers Market
status: added
platform: Recurring
url: https://ricefarmersmarket.org/
tags: [FarmersMarket, Community, The Heights]
firstSeen: 2026-06-15
lastChecked: 2026-06-16
pr: 38
---

Rice Village Farmers Market is a community farmers market held in The Heights area on a recurring schedule.

## Details

- **Schedule**: 1st & 3rd Sunday 9:00 AM - 1:00 PM
- **Location**: Rice Village area / The Heights, Houston
- **Event Type**: Farmers market, local produce, artisan goods
- **Platform**: Recurring events (fixed schedule, no dynamic calendar)
- **Confidence Tier**: 🔴 Low — no online calendar, fixed recurring schedule

## Investigation Notes

Fixed recurring schedule: 1st and 3rd Sunday mornings. No dynamic online calendar or feed found. Suitable for `sources/recurring/` static schedule configuration.

## Implementation Notes

Implement as `sources/recurring/rice-village-farmers-market.yaml` with schedule defined as:
- `schedule: "1st and 3rd Sunday"`
- `start_time: "09:00"`
- `duration: "PT4H"` (4-hour market window)

Verify actual duration and confirm venue location/geo coordinates.
