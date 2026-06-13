---
name: Buffalo Bayou Partnership
status: candidate
platform: Tribe Events (ICS)
url: https://buffalobayou.org/events/
tags: [Parks, Downtown]
firstSeen: 2026-06-13
lastChecked: 2026-06-13
pr:
---

Outdoor recreation and cultural programming along Buffalo Bayou.
Implemented as `sources/external/buffalo-bayou-partnership.yaml`.

- WordPress "The Events Calendar" (Tribe) ICS feed:
  `https://buffalobayou.org/events/?ical=1`.
- Verified live: **30 events**, with dated entries running into 2027.
  Programming includes guided Buffalo Bayou boat cruises (incl. bat cruises),
  wellness walks, and sound-healing meditation at Allen's Landing, the
  Buffalo Bayou Park Cistern, The Water Works, and the Waugh Drive bat bridge
  — all clustered in the downtown/Sabine St core.
- `geo: null` — events span several distinct bayou sites, so per-event
  `LOCATION` geocoding is preferable to one venue coordinate. Tagged
  `Downtown` since the sites cluster there.
