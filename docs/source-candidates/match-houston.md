---
name: MATCH Houston
status: candidate
platform: Tribe Events (ICS, unverified)
url: https://matchouston.org/calendar
tags: [Theater, Art, Midtown]
firstSeen: 2026-06-16
lastChecked: 2026-06-16
pr:
---

Midtown Arts & Theater Center Houston — a $25 million multi-venue performing arts
complex at 3400 Main St, Houston TX 77002 (intersection of Main and Holman in
Midtown). Houses multiple resident companies under one roof including dance,
theater, and visual arts organizations. About 60,000 sq ft of performance and
rehearsal space. Programmed year-round.

**Calendar platform:** The URL structure strongly suggests The Events Calendar
(Tribe Events) WordPress plugin:
- `matchouston.org/calendar` — calendar landing
- `matchouston.org/calendar/list` — list view (matches Tribe's list view URL)
- `matchouston.org/calendar/day-list/YYYY-MM-DD` — day view (Tribe pattern)
- `matchouston.org/events/YYYY/slug` — event detail

Expected ICS feed URL (standard Tribe pattern, **not yet verified live**):
`https://matchouston.org/?post_type=tribe_events&ical=1&eventDisplay=list`

Ticketing via Salesforce (`matchouston.my.salesforce-sites.com/ticket/`) —
separate from the calendar platform, so not relevant to feed access.

**Event volume:** Active calendar with multiple events per month — theater
productions, dance performances, film screenings, visual art openings, and
annual festivals (Mix-MATCH festival, January 2026).

**Geo (not verified):** 3400 Main St, Houston TX 77002 (Midtown). Approximate
lat/lng: 29.7396, -95.3795.

**Next step:** Attempt live fetch of the Tribe Events ICS URL above to verify
the feed returns `BEGIN:VCALENDAR` with future events. If 200 OK → implement
as `sources/external/match-houston.yaml`. The existing Tribe Events pipeline
(houston-arboretum, hobby-center, diverseworks, etc.) handles this without a
custom ripper.
