---
name: McGonigel's Mucky Duck
status: investigating
platform: WordPress (Tessera Events) - custom HTML
url: https://www.mcgonigels.com/
tags: [Music, Upper Kirby]
firstSeen: 2026-06-14
lastChecked: 2026-06-15
pr:
---

Beloved Houston folk/Americana/Irish music pub with live music nearly every night,
located at 2425 Norfolk St, Houston, TX 77098 (Upper Kirby). In operation since 1990.
Extensive calendar through December 2026 visible on the website.

**Platform:** WordPress with Tessera Events custom show management system. **No ICS feed
exists** — trialed `/?post_type=tribe_events&ical=1` (404), `/calendar/?ical=1` (404),
`/feed` (only blog RSS, no events). **Not DICE, Eventbrite, Ticketmaster, or other known
platform.**

**HTML Structure:** Shows are server-rendered on homepage (`/`) as `.tessera-show-card`
divs with class `card h-100`. Each card contains:
- Card header with `.tessera-show-image` + linked `<img>` (poster art)
- Card body with `.tessera-date` span + artist title + link to `/shows/[slug]/`
- Card footer with time/cover info

**Embedded Event Data:** Homepage inlines JavaScript `eventObjects` array immediately
after each card with structure:
```javascript
eventObjects.push({
  "id": 31876,
  "eventDate": "06/15/2026 6:00 pm",
  "mainArtist": ["Open Mic"],
  "additionalArtists": [],
  "image": "https://...",
  "doors": "",
  "isTesseraProduct": true
});
```

All fields present except `doors` (usually empty). Date/time are already parsed in string
format `MM/DD/YYYY H:MM am/pm`. Artist names are in `mainArtist` array (not null).

**Scrapability:** HTML is server-rendered (no JS required to fetch events). Consistent
markup across all show cards observed. Sample from 2026-06-15 shows high volume nightly:
- Jun 15: Open Mic (6–9:30pm)
- Jun 16: Opie Hendrix & John Evans (7pm)
- Jun 17: Irish Session / Game Night (7:30pm, multiple instances)
- Jun 18: Matt Kirk Solo (6pm), Sheila Marshall Late Show (8:30pm)

**Implementation path:** Custom HTMLRipper parsing `.tessera-show-card` divs + extracting
event data from embedded `eventObjects` JavaScript. Duration defaultable or extracted from
time range in title (e.g., "6-9:30" = 3.5 hours). No API, no ticketing platform integration.

**Ready for custom ripper once higher-priority ICS/API sources exhausted.**

Geo: 2425 Norfolk St, Houston, TX 77098 (Upper Kirby)  
Coords: 29.7326, -95.4171
