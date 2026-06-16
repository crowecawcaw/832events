---
name: inprint-houston
status: proxy
platform: The Events Calendar (Tribe Events plugin)
url: https://inprinthouston.org/calendar/
tags:
  - Books
  - Museum District
firstSeen: 2026-06-15
lastChecked: 2026-06-16
impl:
  type: external
  icsUrl: https://inprinthouston.org/?post_type=tribe_events&ical=1&eventDisplay=list
  infoUrl: https://inprinthouston.org/calendar/
  observedEventCount: 6
  geo: { lat: 29.7280, lng: -95.3960, label: "Inprint Houston, 1520 W Main St, Houston, TX 77006" }
  proxy: outofband
---

## Implementation

Implemented as `sources/external/inprint-houston.yaml` with `proxy: outofband`.

Inprint Houston is a literary nonprofit that produces the Margarett Root Brown
Reading Series and hosts book clubs and writing workshops, in the Museum
District. The site runs The Events Calendar (Tribe Events) plugin.

**Status:** Originally observed 6 events locally, but the inprinthouston.org
server returns HTTP 415 (Unsupported Media Type) from GitHub Actions CI
infrastructure, indicating either nginx misconfiguration or bot-blocking. Marked
`proxy: outofband` for verification via residential IP. The out-of-band runner
will fetch the feed and confirm the event count. Both primary feed
(`/?post_type=tribe_events&ical=1&eventDisplay=list`) and alternate feed
(`/calendar/?ical=1`) return 415, so the primary (more explicit) URL is configured.
