---
name: Saint Arnold Brewing Company
status: added
platform: Custom HTML
url: https://www.saintarnold.com/
tags: [Beer, Food, EastEnd]
firstSeen: 2026-06-16
lastChecked: 2026-06-16
impl:
  type: custom
  observedEventCount: 16
  geo: { lat: 29.7809, lng: -95.3200, label: "Saint Arnold Brewing Company, 2000 Lyons Ave, Houston, TX 77020" }
pr: 38
---

Houston's oldest brewery in East End. Free brewery tours, seasonal beer releases, and community events. Events listed as static HTML cards on their "Happenings" page.

**Verified details:**
- 6+ upcoming events (mostly recurring brewery tours and seasonal releases)
- Events at https://www.saintarnold.com/happenings/
- Static HTML event cards with dates and descriptions
- Mix of free tours, paid events, and seasonal specials

**Implementation path:**
Custom HTMLRipper scraper for event cards. Extract event name, date/time, description. Simple HTML structure makes this a good practice scraper. Moderate effort (~2 hours).
