---
name: McGonigel's Mucky Duck
status: investigating
platform: WordPress (custom HTML)
url: https://www.mcgonigels.com/
tags: [Music, Montrose]
firstSeen: 2026-06-14
lastChecked: 2026-06-14
pr:
---

Beloved Houston folk/Americana/Irish music pub with live music nearly every night,
located at 2425 Norfolk St (Montrose). In operation since 1990. Extensive calendar
through December 2026 visible on the website.

**Platform:** WordPress with a custom show management system. No ICS feed, no
Eventbrite, no Ticketmaster. Shows are listed at `/#shows` on the homepage with
artist, date, and time fields. Individual event pages exist at
`/shows/[event-name]/`.

Sample upcoming shows (from 2026-06-14 fetch):
- Jun 15: Open Mic (6–9:30pm)
- Jun 16: Opie Hendrix & John Evans (7pm)
- Jun 17: Irish Session / Game Night (7:30pm)
- Jun 18: Matt Kirk Solo (6pm)

High volume — music nearly every night of the week. Worth implementing as
a custom HTMLRipper once higher-priority ICS/API sources are exhausted.

**Implementation path:** Custom HTMLRipper scraping the homepage show listing.
Need to inspect the HTML structure of the show cards and verify consistent
markup before implementing.

Geo: 2425 Norfolk St, Houston, TX 77098 (Montrose)
