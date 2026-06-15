---
name: Urban Harvest
status: added
platform: Recurring YAML (Saturday market)
url: https://www.urbanharvest.org/events/
tags: [FarmersMarket, Upper Kirby]
firstSeen: 2026-06-14
lastChecked: 2026-06-15
pr:
---

Houston farmers market operator running the Saturday market at 2752 Buffalo Speedway (year-round, 8am–12pm, 100+ local vendors) plus seasonal events and garden workshops.

**Implementation:** Recurring YAML (`sources/recurring/urban-harvest.yaml`) for the weekly Saturday market.

**ICS feed testing (2026-06-15):**
- `https://www.urbanharvest.org/?post_type=tribe_events&ical=1&eventDisplay=list` → returns HTML, not ICS
- `https://www.urbanharvest.org/events/?ical=1` → returns HTML, not ICS
- No calendar subscription links found in page source

**Decision:** The Tribe Events ICS endpoints are not functional (returning HTML instead of ICS). Implemented as a recurring calendar for the known, reliable Saturday market schedule instead. Market runs year-round every Saturday, 8:00 AM–12:00 PM.
