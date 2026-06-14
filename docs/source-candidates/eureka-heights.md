---
name: Eureka Heights Brew Co
status: candidate
platform: Tribe Events (ICS)
url: https://www.eurekaheights.com/events/
tags: [Beer, The Heights]
firstSeen: 2026-06-13
lastChecked: 2026-06-13
pr:
---

Craft brewery and taproom at 941 W 18th St, Houston (The Heights). 35+
upcoming events including recurring weekly programming (Trivia Wednesdays 7pm,
Laces Out Run Club Thursdays 5:30pm, Bingo Thursdays 7pm) plus special events
(Heavy Metal Market, Lego events, Steak Night, Pinball tournaments, Plant Swap,
Dog Show, etc.).

ICS feed confirmed live:

- `webcal://www.eurekaheights.com/?post_type=tribe_events&ical=1&eventDisplay=list`
- `https://www.eurekaheights.com/?post_type=tribe_events&ical=1&eventDisplay=list`
- Month export: `https://www.eurekaheights.com/eureka-events/month/?ical=1`

Eventbrite organizer page exists (`11350876811`) but shows no upcoming events —
their own site is the active calendar.

**Implementation:** Add `sources/external/eureka-heights.yaml` pointing at the
tribe_events ICS. Geo: 941 W 18th St, Houston, TX 77008 (lat 29.8001,
lng -95.3978).
