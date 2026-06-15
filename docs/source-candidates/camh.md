---
name: Contemporary Arts Museum Houston
status: blocked
platform: Tribe Events (ICS) / Eventbrite
url: https://camh.org/event-calendar/
tags: [Art, Museums, Museum District]
firstSeen: 2026-06-13
lastChecked: 2026-06-14
pr:
impl:
  type: eventbrite
  organizerId: "5365268811"   # https://www.eventbrite.com/o/contemporary-arts-museum-houston-5365268811
  observedEventCount: 6   # from the Eventbrite organizer page; the `eventbrite` ripper needs EVENTBRITE_TOKEN, a CI-only secret — NOT verifiable in a local build, only in CI
  geo: { lat: 29.7264, lng: -95.3915, label: "Contemporary Arts Museum Houston, 5216 Montrose Blvd, Houston, TX 77006" }
---

Free-admission contemporary art museum at 5216 Montrose Blvd, Houston, TX 77006
(Museum District). No permanent collection — all programming is rotating
exhibitions, artist talks, performances, and family events. Founded 1948.

**Platform:** The site uses Tribe Events — the event-calendar page shows ICS
subscription links (`webcal://camh.org/?post_type=tribe_events&ical=1&eventDisplay=list`)
and lists 10 upcoming events (June–September 2026). An Eventbrite organizer
page also exists: `https://www.eventbrite.com/o/contemporary-arts-museum-houston-5365268811`
(organizer ID `5365268811`, 6 confirmed upcoming events).

**Blocked:** Direct fetch of the Tribe Events ICS URL returns HTTP 403 Forbidden
from the agent execution environment (2026-06-14). The calendar page itself loads
(200), so the server is blocking non-browser user agents on the ical endpoint.

**Recommendation:** Try with `proxy: "outofband"` — this is a server-side UA
block, not a hard paywall. Alternatively, use the Eventbrite organizer ID
(`5365268811`) which does not require proxy. Prioritize the Eventbrite approach
as it avoids the proxy dependency.

**Geo:** lat 29.7368, lng -95.3937
