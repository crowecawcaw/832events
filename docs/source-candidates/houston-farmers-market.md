---
name: Houston Farmers Market
status: candidate
platform: Tribe Events (ICS)
url: https://thehoustonfarmersmarket.com/events/
tags: [FarmersMarket, The Heights]
firstSeen: 2026-06-13
lastChecked: 2026-06-13
pr:
---

Indoor/outdoor weekend market at 2520 Airline Dr (north of Downtown, Heights
area). Saturdays and Sundays 10am–5pm with special events (Mariachi at the
Market, seasonal themed markets).

ICS feed confirmed live — both subscribe links and Google Calendar import URL
present on the page:

- `webcal://thehoustonfarmersmarket.com/?post_type=tribe_events&ical=1&eventDisplay=list`

Their Eventbrite organizer page (`91606547313`) currently shows 0 upcoming
events — the tribe_events feed on their own site is the right integration path.

**Implementation:** Add `sources/external/houston-farmers-market.yaml`. Geo:
2520 Airline Dr, Houston, TX 77009 (lat 29.8082, lng -95.3661).
