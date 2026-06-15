---
name: Holocaust Museum Houston
status: added
platform: Tribe Events (ICS)
url: https://hmh.org/events/
tags: [Museum District, Museums, Community]
firstSeen: 2026-06-14
lastChecked: 2026-06-14
pr: (pending)
---

Education and remembrance museum at 5401 Caroline St, Houston, TX 77004
(Museum District). Programming includes educator workshops, author talks,
film screenings, and community lectures — approximately 3–8 events/month.
Lower volume but culturally significant; events are free or low-cost and
open to the public.

WordPress + The Events Calendar (Tribe Events) site.
Reported ICS feed: `https://hmh.org/?post_type=tribe_events&ical=1&eventDisplay=list`
(converted from `webcal://` scheme). Implement as `sources/external/` ICS.

**Confidence: Medium** — Tribe Events ICS feeds are well-supported. Lower
volume but meaningful coverage. Verify feed returns future events before
implementing. The `expectEmpty` flag may be needed during slow periods.
