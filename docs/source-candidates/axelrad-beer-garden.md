---
name: Axelrad Beer Garden
status: added
platform: Google Calendar (ICS export)
url: https://www.axelradhouston.com/
tags: [Music, Montrose]
firstSeen: 2026-06-16
lastChecked: 2026-06-16
pr: (pending)
impl:
  type: external
  icsUrl: https://calendar.google.com/calendar/ical/r90785d3i81770k8r28jov6b9g%40group.calendar.google.com/public/basic.ics
  infoUrl: https://www.axelradhouston.com/calendar
  observedEventCount: 306
  builtEventCount: 306
  note: "Correct calendar ID found in website embedded viewer; 306 upcoming events in lookahead window"
  geo: { lat: 29.7272, lng: -95.3447, label: "Axelrad Beer Garden, 1517 Alabama St, Houston, TX 77010" }
---

Jazz and cocktail bar in EaDo with live music programming. Google Calendar export available.

**Verified details:**
- Google Calendar ICS feed returns VEVENT entries
- ~10 upcoming events: weekly jazz nights, cumbia, comedy shows, food truck events
- Events are dated and recurring (e.g., "Jazz Nights" on Friday evenings)
- Stable feed accessible without authentication

**Implementation path:** 
Add to `sources/external/axelrad-beer-garden.yaml` with the ICS feed URL. Quick win (~5 minutes).
