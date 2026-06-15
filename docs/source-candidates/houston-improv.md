---
name: Houston Improv
status: proxy
platform: AXS
url: https://improvtx.com/houston/
tags: [Comedy]
firstSeen: 2026-06-13
lastChecked: 2026-06-15
pr: implementation-cycle-2026-06-15
impl:
  type: axs
  venueId: 130678
  venueSlug: houston-improv-houston-tickets   # the slug in https://www.axs.com/venues/130678/houston-improv-houston-tickets
  observedEventCount: 109   # AXS bot-blocks data-center + most residential IPs (HTTP 403); count is from a browser, NOT verifiable in CI
  geo: { lat: 29.7695, lng: -95.4975, label: "Houston Improv, 7620 Katy Freeway, Houston, TX 77024" }
---

Comedy club at 7620 Katy Freeway, Houston, TX 77024. Seats ~300; dinner-theater
style. Hosts national touring headliners, local showcases, and weekly open-mic
nights.

**Platform:** AXS — venue ID `130678`, slug `houston-improv-houston-tickets`  
AXS venue page: `https://www.axs.com/venues/130678/houston-improv-houston-tickets`

**Confirmed:** 109 upcoming events on AXS (June 2026 confirmation).

Also appears on Ticketmaster (venue `343234`) and Live Nation
(`KovZpZA67IeA`). Their FAQ says to buy from improvtx.com or ticketweb.com
(a Ticketmaster company), but AXS has the largest confirmed event count.
Implement via the built-in `axs` type first; switch to `ticketmaster` if
AXS event counts drop or double-count with Ticketmaster.

**Geo:** lat 29.7695, lng -95.4975 (Spring Branch / Katy Freeway corridor)

**ripper.yaml sketch:**
```yaml
name: houston-improv
type: axs
description: "Houston Improv"
url: https://improvtx.com/houston/
geo:
  lat: 29.7695
  lng: -95.4975
  label: "Houston Improv, 7620 Katy Freeway, Houston, TX 77024"
tags: [Comedy]
calendars:
  - name: houston-improv
    friendlyname: "Houston Improv"
    timezone: America/Chicago
    config:
      venueId: 130678
      venueSlug: "houston-improv-houston-tickets"
      venueName: "Houston Improv"
      venueAddress: "7620 Katy Freeway, Houston, TX 77024"
```
