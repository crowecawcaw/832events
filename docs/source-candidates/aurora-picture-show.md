---
name: Aurora Picture Show
status: added
platform: Squarespace (HTML/per-event ICS)
url: https://www.aurorapictureshow.org/
tags: [Film, Arts, EaDo]
firstSeen: 2026-06-16
lastChecked: 2026-06-16
impl:
  type: custom
  observedEventCount: 30
  geo: { lat: 29.7195, lng: -95.3122, label: "Aurora Picture Show, 5601A Navigation Blvd, Houston, TX 77011" }
pr: 38
---

Independent cinema in East End showing art films, documentaries, and retrospectives. Squarespace-based with per-event calendar links.

**Verified details:**
- 25+ film screenings and special events visible on calendar
- Squarespace-based with event listings at https://www.aurorapictureshow.org/programs
- Events include feature films, film festivals, and director Q&As
- Dates, times, and ticket info available on program page

**Implementation path:**
Custom HTMLRipper scraper. Extract event title, date/time, description from the Squarespace event page structure. Moderate effort (~2 hours).
