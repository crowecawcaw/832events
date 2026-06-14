---
name: Montrose Center
status: added
platform: Tribe Events (ICS)
url: https://montrosecenter.org/events/
tags: [Montrose, Community]
firstSeen: 2026-06-14
lastChecked: 2026-06-14
pr:
---

LGBTQ+ community center at 401 Branard St, Houston, TX 77006 (Montrose).
High-volume programming: support groups, yoga, game nights, theater
performances, senior programs, and community events — approximately 35
events/month. Many events are free; some require registration.

WordPress + The Events Calendar (Tribe Events) site.
Reported ICS feed: `https://montrosecenter.org/?post_type=tribe_events&ical=1&eventDisplay=list`
(converted from `webcal://` scheme). Implement as `sources/external/` ICS.

**Confidence: High** — Tribe Events ICS feeds are well-supported. High
volume and strong community relevance. Verify feed returns future events
before implementing. Note: some events may be members-only or internal;
the ICS feed should only expose public-facing events.
