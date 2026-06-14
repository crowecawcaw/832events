---
name: Theatre Under The Stars (TUTS)
status: added
platform: Tribe Events (ICS)
url: https://www.tuts.org/shows/
tags: [Theatre, Music, Downtown]
firstSeen: 2026-06-14
lastChecked: 2026-06-14
pr: (in progress)
---

Theatre Under The Stars (TUTS) is a Houston nonprofit musical theater company
performing at the Hobby Center (Sarofim Hall), 800 Bagby St, Houston, TX 77002.
They produce Broadway-style musicals including The Music Man, Mrs. Doubtfire,
Disney's The Little Mermaid, Kinky Boots, and Oh Mary! — typically 5–7
productions per season.

ICS feed confirmed live (HTTP 200, `text/calendar`, 70,402 bytes):
`https://www.tuts.org/?post_type=tribe_events&ical=1&eventDisplay=list`

- **7 events confirmed** from live fetch (2026-06-14) — season-level entries
- **Caution:** Start times are placeholder 8:00 AM in the ICS, not actual curtain times. Actual curtain times (typically 7:30 PM or 2:00 PM matinee) would need to be resolved via the uncertainty system.
- Future events extend into 2027 (2026-27 season)
- Same Tribe Events platform as Houston Arboretum, Montrose Center, Hobby Center
- Lower priority than Hobby Center (fewer events, start time uncertainty)
- Implement as `sources/external/tuts.yaml` — flag uncertainty on start times

Geo: lat 29.7526, lng -95.3675 (800 Bagby St, Houston, TX 77002 — shares Hobby Center)
