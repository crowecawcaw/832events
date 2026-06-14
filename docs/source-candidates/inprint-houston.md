---
name: Inprint Houston
status: candidate
platform: WordPress Tribe Events (ICS)
url: https://inprinthouston.org/calendar/
tags: [Books, Literature]
firstSeen: 2026-06-14
lastChecked: 2026-06-14
pr:
---

Houston-based literary nonprofit running the Inprint Margarett Root Brown
Reading Series (nationally recognized author readings), book clubs, the
Houston Writers Guild, and community education programs. Events are a mix of
in-person and Zoom.

**Platform:** WordPress with "The Events Calendar" (Tribe Events) plugin.
Confirmed by `/wp-content/plugins/the-events-calendar/` path in page source.

**ICS feed:** `https://inprinthouston.org/calendar/?ical=1` (Tribe Events export)

**Verification (2026-06-14):** Fetched ICS feed — valid `BEGIN:VCALENDAR`,
**6 events** confirmed, all future dates (June 14 through September 2026).
Sample events:
- "INPRINT BOOK CLUB DISCUSSES NEW AND SELECTED POEMS" — June 14, 2026
- "Inprint BCM HEAL Book Club discusses Can't We Talk About Something More
  Pleasant?" — June 30, 2026
- "INPRINT BOOK CLUB DISCUSSES SON OF NOBODY" — July 19, 2026

**Geo:** null — events are held at various Houston locations or via Zoom;
no single fixed venue.

**Confidence:** 🟡 Medium — ICS feed confirmed working with 6 events. Low
volume but quality literary programming. Ready to implement as an external
ICS calendar in `sources/external/inprint-houston.yaml`.
