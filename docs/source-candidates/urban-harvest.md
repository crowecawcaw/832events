---
name: Urban Harvest
status: candidate
platform: Tribe Events (ICS)
url: https://www.urbanharvest.org/events/
tags: [FarmersMarket, Community, Midtown]
firstSeen: 2026-06-14
lastChecked: 2026-06-14
pr:
---

Houston's largest farmers market operator, running two weekly markets:
- **Eastside Farmers Market** at 3000 Richmond Ave, Houston, TX 77098
  (every Saturday, year-round, 100+ local vendors)
- **Urban Harvest Farmers Market** at a second location (Eastside Saturdays
  are the primary draw)

Also runs seasonal events, garden workshops, and community programming.
WordPress + The Events Calendar (Tribe Events) site.
Reported ICS feed: `https://www.urbanharvest.org/?post_type=tribe_events&ical=1&eventDisplay=list`
(standard Tribe endpoint — verify before implementing).

**Implementation note:** The weekly Saturday market could be implemented as
a `sources/recurring/` YAML for reliability. The full events page (workshops,
special markets) is better served by the ICS feed. Prefer the ICS approach
to capture all programming automatically.

Verify the Tribe ICS endpoint returns future events; fall back to recurring
YAML for the market schedule if the feed is unreliable.
