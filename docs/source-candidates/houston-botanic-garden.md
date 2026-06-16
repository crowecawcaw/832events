---
name: Houston Botanic Garden
status: candidate
platform: Tribe Events (ICS, unverified)
url: https://hbg.org/events/
tags: [Nature, Parks, Gardens, Braeswood]
firstSeen: 2026-06-16
lastChecked: 2026-06-16
pr:
---

132-acre public garden on Brays Bayou Greenway in southeast Houston. Opened
2020. One of Houston's newest major cultural institutions. Admission-required
garden with strong events programming including outdoor concerts, family
festivals (Radiant Nature light festival), educational workshops, guided
nature tours, and seasonal special events. Located at 1 Botanic Garden Dr,
Houston TX 77017.

**Calendar platform:** URL structure at hbg.org suggests The Events Calendar
(Tribe Events) WordPress plugin:
- `hbg.org/events/` — upcoming events list view
- `hbg.org/event/` — event archive (no trailing 's' — matches Tribe's CPT slug)
- `hbg.org/event-categories/festival/` — category archive (Tribe pattern)

These URL patterns are consistent with Tribe Events; the same plugin powers
houston-arboretum, hobby-center, diverseworks, and others in this repo.

Ticketing for admission/events goes through `secure.hbg.org` (Blackbaud/BBMS
nonprofit ticketing) — separate from the calendar plugin, so ICS feed should
be accessible independently.

Expected ICS feed URL (standard Tribe pattern, **not yet verified live**):
`https://hbg.org/?post_type=tribe_events&ical=1&eventDisplay=list`

**Event volume:** Multiple recurring event types suggest moderate-to-high
volume: seasonal festivals (Radiant Nature runs months), monthly guided tours,
family weekend programming, outdoor concerts. Estimated 20–40 events/year.

**Geo (not verified):** 1 Botanic Garden Dr, Houston TX 77017. Approximate
lat/lng: 29.7067, -95.3324.

**Next step:** Attempt live fetch of the Tribe Events ICS URL above to verify
it returns `BEGIN:VCALENDAR` with future events. If 200 OK → implement as
`sources/external/houston-botanic-garden.yaml`.
