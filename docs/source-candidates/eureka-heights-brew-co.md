---
name: Eureka Heights Brew Co
status: added
platform: Tribe Events (ICS)
url: https://www.eurekaheights.com/eureka-events/
tags: [Beer, The Heights]
firstSeen: 2026-06-14
lastChecked: 2026-06-14
pr: (in progress)
---

Craft brewery and taproom at 2454 Sawyer St, Houston, TX 77007 (The Heights
area). High-volume event calendar: trivia nights, run clubs, pottery classes,
live music, themed markets — approximately 35 events/month.

WordPress + The Events Calendar (Tribe Events) site.
Reported ICS feed: `https://www.eurekaheights.com/?post_type=tribe_events&ical=1&eventDisplay=list`
(converted from `webcal://` scheme). Implement as `sources/external/` ICS.

**Confidence: High** — Tribe Events ICS feeds are well-supported by the
existing external calendar pipeline. Verify feed returns future events
(`?ical=1` or full Tribe endpoint) before implementing.
