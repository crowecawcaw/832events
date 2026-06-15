---
name: MATCH Houston
status: candidate
platform: Drupal (custom calendar — no ICS)
url: https://matchouston.org/calendar
tags: [Arts, Theatre, Dance, Music, Midtown]
firstSeen: 2026-06-15
lastChecked: 2026-06-15
pr:
---

Midtown Arts & Theater Center Houston — a shared multi-venue arts complex at
3400 Main St, Houston, TX 77002 (Midtown). Hosts performances from dozens of
resident and visiting organizations across theater, dance, music, comedy, and
film.

June 2026 calendar shows 31+ distinct events: TEDx Third Ward, Fade to Black
Play Festival (African American playwrights), Swan Lake recital, Houston
Contemporary Dance Company concerts, world-premiere musicals, opera
staged readings, and more.

**Calendar platform**: Drupal CMS with a custom calendar view. URL pattern:
- List: `/calendar/list` and `/calendar/list/2026-06`
- Events: `/events/2026/[event-slug]`

No ICS feed, no JSON API endpoint. Server-rendered HTML.

**Implementation path**: Custom HTMLRipper. The calendar list view at
`https://matchouston.org/calendar/list/2026-06` is server-rendered with
clean HTML and consistent event structure (title, date range, venue,
presenter). Pagination by month via URL parameter. Feasible but requires
an HTMLRipper to parse event cards and follow individual event pages for
full detail (start time, description).

**Confidence: Low** — needs custom scraper. High event volume (30+/month)
justifies the effort. No ICS or API alternative found.

**geo**: 3400 Main St, Houston, TX 77002 — Midtown neighborhood.
Approximate coordinates: 29.7386, -95.3732 (verify at implementation time
via Nominatim or known venue coords).
