---
name: Houston Botanic Garden
status: candidate
platform: WordPress (custom HTML)
url: https://hbg.org/events/
tags: [Nature, Gardens]
firstSeen: 2026-06-14
lastChecked: 2026-06-14
pr:
---

Public botanic garden at 1 Botanical Lane, Houston, TX 77017 (south Houston,
Sunnyside/Magnolia Park area). Opened 2020 on the site of the former Glenbrook
Golf Course. Programming includes summer camps (BotaniCamp), family Saturday
events, wellness classes, nature walks, seasonal festivals, and a concert series.

**Platform:** WordPress site at `hbg.org`. No ICS/iCal feed (`?ical=1`
returns HTML). No visible Eventbrite integration. Tickets sold via
`secure.hbg.org` (custom ticketing portal — likely a membership-management
system such as Altru or Blackbaud).

**Verification (2026-06-14):** Fetched `https://hbg.org/events/` — 13 upcoming
events visible through August 2026. Sample events:
- Garden Guardians BotaniCamp (June 15)
- Juneteenth Jamboree (June 20)
- LEGO Night (July 11)
- Salsa Night (August 29)

**Implementation path:** Custom HTML ripper scraping `hbg.org/events/` or
`hbg.org/event/` archive. Worth implementing given year-round programming
and unique nature/family programming niche.

**Geo:** lat 29.6719, lng -95.3350 (1 Botanical Lane, Houston, TX 77017)

**Confidence:** 🔴 Low — requires custom HTML scraper, but site is accessible,
event data is clearly structured, and the garden offers unique programming
not duplicated by other sources.
