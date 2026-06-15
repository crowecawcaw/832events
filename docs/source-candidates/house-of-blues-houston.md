---
name: House of Blues Houston
status: added
platform: Ticketmaster
url: https://houston.houseofblues.com/
tags: [Music, Downtown]
firstSeen: 2026-06-13
lastChecked: 2026-06-15
pr: 28
---

> **2026-06-15 — venue id corrected.** The first implementation used the numeric
> ticketmaster.com **website** id `475902`, which is not a Discovery API v2 venue
> id, so the build returned 0 events. Replaced with the Discovery API venue id
> `KovZpZAE6k1A` (from the Live Nation venue URL
> `livenation.com/venue/KovZpZAE6k1A/house-of-blues-houston-events`).


Major live-music venue at 1204 Caroline St, Downtown Houston, TX 77002
(GreenStreet complex). Capacity ~2,500. Hosts rock, metal, R&B, hip-hop,
country, and touring acts year-round. Restaurant and Foundation Room open
nightly.

**Platform:** Ticketmaster — venue ID `475902`
`https://www.ticketmaster.com/house-of-blues-houston-tickets-houston/venue/475902`

2026 confirmed upcoming events include JINJER (6/23), Hatebreed (7/10),
Poppy (8/13), W.A.S.P. (9/20), Rocky Horror (10/23).

**ripper.yaml sketch (Ticketmaster venue type — verify exact config schema):**
```yaml
name: house-of-blues-houston
type: ticketmaster
description: "House of Blues Houston"
url: https://houston.houseofblues.com/
geo:
  lat: 29.7527
  lng: -95.3678
  label: "House of Blues Houston, 1204 Caroline St, Houston, TX 77002"
tags: [Music, Downtown]
calendars:
  - name: house-of-blues-houston
    friendlyname: "House of Blues Houston"
    timezone: America/Chicago
    config:
      venueId: "475902"
```

Check `lib/config/ticketmaster.ts` for the exact field name (`venueId` vs
`organizerId` vs something else) before implementing.
