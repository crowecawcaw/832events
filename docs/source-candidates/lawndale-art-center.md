---
name: Lawndale Art Center
status: investigating
platform: WordPress + Tribe Events (custom HTML only)
url: https://lawndaleartcenter.org/events/
tags: [Art, "Museum District"]
firstSeen: 2026-06-14
lastChecked: 2026-06-15
pr:
---

Contemporary art center in Midtown Houston presenting exhibitions, performances,
readings, and community programs. Founded 1979, located at 4912 Main St, Houston TX 77002.

**Platform Details:**
- WordPress with Tribe Events plugin
- No public ICS feed: `/feed/ical/`, `/?ical=1`, `/events.ics` all return HTML
- Tribe Events REST API blocked (`/wp-json/tribe/events/v1/events` returns 404; general `/wp-json/wp/v2/posts` restricted by Solid Security)
- Individual event pages DO have structured iCal data in DTSTART/DTEND format (visible in "Add to Calendar" data: URI links)

**Event URLs:** `/events/` lists upcoming. Individual event pages at `https://lawndaleartcenter.org/event/<slug>/` carry date/time in structured form.

**Implementation path:** Custom HTMLRipper required — scrape `/events/` listing page + individual event pages to extract structured date data. Event volume: 2 visible as of 2026-06-15 (The Big Slide Show on July 18 and August 1). Capacity appears low in summer; the site runs ~6+ exhibitions/year with openings, artist talks, performances.

**Next steps:** Either accept HTML-scraping complexity, or check with venue whether they can expose Tribe Events ICS feed (may require plugin reconfiguration on their end).

Geo: lat 29.7185, lng -95.3895, label "Lawndale Art Center, 4912 Main St, Houston, TX 77002"
