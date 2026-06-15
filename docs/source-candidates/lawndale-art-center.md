---
name: Lawndale Art Center
status: candidate
platform: WordPress + custom HTML (no ICS/API available)
url: https://lawndaleartcenter.org/events/
tags: [Art, "Museum District"]
firstSeen: 2026-06-14
lastChecked: 2026-06-15
pr:
---

Contemporary art center in Midtown Houston presenting exhibitions, performances,
readings, and community programs. Founded 1979, located at 4912 Main St, Houston TX 77002.

**Platform Details:**
- WordPress with custom theme (not standard Tribe Events)
- No public ICS feed: `/feed/ical/`, `/?ical=1`, `/events.ics` all return HTML
- Tribe Events REST API blocked (`/wp-json/tribe/events/v1/events` returns 404; general `/wp-json/wp/v2/posts` restricted by Solid Security)
- The `/events/` listing page renders events as server-side HTML, no `<time datetime="...">` attribute

**HTML Structure (confirmed from live fetch 2026-06-15):**
- Events: `article.listing-item.event-item`
- Title + URL: `h2.event-title > a`
- Date: `span.event-day` contains "MonthName Day" (non-breaking space)
- Time: `.event-time` contains "H:MM am/pm" (12-hour)
- Image: `img.event-image-img[data-src]` (lazy-loaded)
- Year: inferred from calendar navigation links `/events/YYYY/MM/` in page

**Implementation:** Custom `IRipper` in `sources/lawndale-art-center/ripper.ts`.
Unit tests: **8 passed** from 2 events in sample (The Big Slide Show July 18, August 1, 2026).
Event volume low in summer; site runs ~6+ exhibitions/year with openings, talks, performances.

Note: event count in live build may be low (2 visible as of 2026-06-15). Consider adding
`expectEmpty: true` if the calendar regularly runs dry between exhibition cycles.

Geo: lat 29.7185, lng -95.3895, label "Lawndale Art Center, 4912 Main St, Houston, TX 77002"
