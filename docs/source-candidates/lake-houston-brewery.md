---
name: Lake Houston Brewery
status: proxy
platform: Wix (HTML scraper)
url: https://www.lakehoustonbrew.com/
tags: [Beer, Music, Northside]
firstSeen: 2026-06-16
lastChecked: 2026-06-16
impl:
  type: custom
  observedEventCount: 25
  geo: { lat: 30.0654, lng: -95.1242, label: "Lake Houston Brewery, 10614 FM 1960 W, Humble, TX 77338" }
proxy: browserbase
notes: Wix JavaScript-rendered event listings require browserbase. Implemented 2026-06-16 but deferred from PR due to unavailable BROWSERBASE_API_KEY in build environment. Will be verified via out-of-band runner.
---

Brewery in North Houston (Huffman area) with regular weekend programming. Recurring Sunday brunches and live music events hosted on Wix.

**Verified details:**
- 25+ events visible (mostly recurring Sunday brunches with periodic live music)
- Events listed at https://www.lakehoustonbrew.com/events
- Wix-based event listings with dates and descriptions
- Family-friendly daytime and evening events

**Implementation path:**
Custom HTMLRipper scraper for Wix event cards. Extract event name, date/time, description. Consider implementing as recurring calendar if Sunday Brunch is truly recurring; otherwise standard scraper. Moderate effort (~2 hours).
