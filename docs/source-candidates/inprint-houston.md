---
name: inprint-houston
status: candidate
platform: The Events Calendar (Tribe Events plugin)
url: https://inprinthouston.org/calendar/
tags:
  - Books
  - Museum District
firstSeen: 2026-06-15
lastChecked: 2026-06-15
impl:
  type: external
  icsUrl: https://inprinthouston.org/?post_type=tribe_events&ical=1&eventDisplay=list
  infoUrl: https://inprinthouston.org/calendar/
  observedEventCount: 6
  geo: { lat: 29.7280, lng: -95.3960, label: "Inprint Houston, 1520 W Main St, Houston, TX 77006" }
---

## Implementation

Implemented as `sources/external/inprint-houston.yaml`. Verified locally
(`ONLY_SOURCE=inprint-houston` build → 6 future events, 0 errors).

Inprint Houston is a literary nonprofit that produces the Margarett Root Brown
Reading Series and hosts book clubs and writing workshops, in the Museum
District. The site runs The Events Calendar (Tribe Events) plugin.

**Feed used:** `https://inprinthouston.org/?post_type=tribe_events&ical=1&eventDisplay=list`
— HTTP 200, valid `BEGIN:VCALENDAR`, 6 VEVENTs all dated after 2026-06-15.

**To reconcile:** the daily-cron discovery reported an alternate feed
`https://inprinthouston.org/calendar/?ical=1` with a higher count (15+). If that
endpoint returns a fuller set, switch `icsUrl` to it. Compare the two feeds on a
future pass before flipping to `added`.
