---
name: Axelrad Beer Garden
status: candidate
platform: DICE
url: https://www.axelradhouston.com/calendar
tags: [Beer, Music, Comedy, Midtown]
firstSeen: 2026-06-13
lastChecked: 2026-06-13
pr:
---

Very active indoor/outdoor beer garden at 1517 Alabama St, Houston (Midtown).
15+ events per week including 7+ weekly recurring series: Punchline Sundays/
Mondays (free comedy), Mystery Movie Monday, Open Mic Tuesdays, Jazz Wednesdays,
Cumbia Libre (2nd Friday), Axelrad Drum Shed (1st Thursday), plus World Cup
viewing, food trucks, and live music.

Ticketing and event listings via **Dice.fm** (built-in `dice` ripper type):

- Dice.fm venue slug: `axelrad-w5wn`
- Venue page: https://dice.fm/venue/axelrad-w5wn

No Eventbrite. The venue website (Webflow) mentions a Google Calendar embed
but no ICS URL was extractable without browser interaction.

**Implementation:** `type: dice` with `venueName: "Axelrad"` (as shown on
DICE). Geo: 1517 Alabama St, Houston, TX 77004 (lat 29.7341, lng -95.3854).
Note: confirm `venueName` exactly as shown on DICE before implementing — the
built-in dice ripper matches by venue name.
