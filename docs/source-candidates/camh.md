---
name: Contemporary Arts Museum Houston (CAMH)
status: candidate
platform: Tribe Events (ICS)
url: https://camh.org/event-calendar/
tags: [Arts, Museum District]
firstSeen: 2026-06-13
lastChecked: 2026-06-13
pr:
---

Free admission contemporary art museum in the Museum District. ~10 events per
quarter: film screenings, artist talks, public openings, and open calls.

ICS feed confirmed live:

- `webcal://camh.org/?post_type=tribe_events&ical=1&eventDisplay=list`
- `https://camh.org/event-calendar/list/?hide_subsequent_recurrences=1&ical=1`

Also on Eventbrite (organizer `5365268811` / API ID `33366841279`) with ~4
upcoming free events, but the tribe_events ICS feed has more events and is
the preferred integration path.

**Implementation:** Add `sources/external/camh.yaml` pointing at the
webcal:// feed (convert to https://). Geo: 5216 Montrose Blvd, Houston, TX
77006 (lat 29.7327, lng -95.4054).
