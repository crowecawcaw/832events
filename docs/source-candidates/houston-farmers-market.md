---
name: Houston Farmers Market
status: candidate
platform: Tribe Events (ICS)
url: https://www.thehoustonfarmersmarket.com/events/
tags: [FarmersMarket, MakersMarket, The Heights]
firstSeen: 2026-06-14
lastChecked: 2026-06-14
pr:
---

Permanent open-air market at 2520 Airline Dr, Houston, TX 77009 (The Heights
area). Runs every Saturday and Sunday year-round with 100+ local vendors:
produce, meat, dairy, prepared foods, arts and crafts. Regular programming
includes monthly Mariachi events and special seasonal markets.

WordPress + The Events Calendar (Tribe Events) site.
Reported ICS feed: `https://www.thehoustonfarmersmarket.com/events/?ical=1`
(converted from `webcal://` scheme). Approximately 12 upcoming events confirmed
in the June–September window, including recurring weekly market dates and one-off
special events.

**Implementation note:** Could be implemented two ways:
1. External ICS (`sources/external/`) using the Tribe feed — catches all special
   events automatically.
2. `sources/recurring/` YAML with `every Saturday` + `every Sunday` schedules —
   simpler and more robust if the ICS feed is unreliable.

Prefer the ICS feed (option 1) since it captures special programming beyond
the base weekly schedule. Verify the feed returns future events before
implementing.
