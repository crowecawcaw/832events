---
name: Houston Parks and Recreation Department (HPARD)
status: candidate
platform: CalendarWiz (ICS)
url: https://www.calendarwiz.com/eventboard/?crd=hpardevents
tags: [Parks, Community]
firstSeen: 2026-06-13
lastChecked: 2026-06-13
pr:
---

City of Houston's parks and recreation programs across 27+ community centers
and parks. 120+ events in the ICS feed including After-School Enrichment,
Senior Basketball, Zumba, Family Game Night, Line Dancing, Walk With A Doc,
Pickleball, and Summer Enrichment.

ICS feed confirmed live via CalendarWiz:

- `https://www.calendarwiz.com/CalendarWiz_iCal.php?crd=hpardevents`

No auth required. Feed is public.

**Caveats:** High volume with many granular recurring fitness/rec-class
entries (daily "Weight Room", "Fitness Center"). This could produce a lot of
low-interest entries. Consider filtering to non-recurring public events or
special programming only — may need a custom ripper that fetches the ICS
but filters by category rather than using the raw feed as an external ICS.
Locations span the entire city with addresses like "Emancipation Park",
"Tidwell Park", "Lincoln Park", "Fonde Recreation Center".

**Implementation options:**
1. External ICS (simplest, high volume) — add `sources/external/houston-parks-recreation.yaml`
2. Custom ripper with category filter (lower noise)

Geo: null (city-wide, 27+ locations).
