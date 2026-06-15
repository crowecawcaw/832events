---
name: The Heights Theater
status: proxy
platform: AXS
url: https://theheightstheater.com/
tags: [Music, The Heights]
firstSeen: 2026-06-14
lastChecked: 2026-06-15
ticketmasterId: "476164"
axsVenueId: "126116"
pr:
---

> **2026-06-15 — switched Ticketmaster → AXS.** The `type: ticketmaster`
> implementation (venue `476164`) returned 0 events: that numeric id is a
> ticketmaster.com website id, not a Discovery API id, and the venue's primary
> ticketing is PreKindle (so Ticketmaster coverage is at best secondary). The
> venue's events are listed on AXS (`axs.com/venues/126116/the-heights-theater-houston-tickets`),
> so it's now `type: axs` with `proxy: "outofband"` (AXS bot-blocks CI). Event
> volume is **unverified, pending proxy** — the out-of-band runner will confirm
> it and it sits in the non-fatal `pendingProxyVerification` queue meanwhile.


Historic 1926 theater restored as a concert venue at 339 W 19th St, The Heights.
Hosts concerts, comedy, and special events. Capacity ~900. Primarily indie/alternative/
folk/country acts. Strong Houston arts community presence.

**Platform:** Official website uses PreKindle for ticketing. However, Ticketmaster
venue ID 476164 resolves to "The Heights Theatre - Houston, TX" and has an active
listing. Some events may be syndicated to Ticketmaster.

**Status:** Ticketmaster ID 476164 confirmed valid (resolves to correct venue name/city).
Implemented as `type: ticketmaster` ripper with venueId 476164. Event volume unverified
(requires CI's TICKETMASTER_API_KEY). Note: primary ticketing is PreKindle, so Ticketmaster
may have limited/secondary event coverage.

Geo: 339 W 19th St, Houston, TX 77008 (The Heights)
