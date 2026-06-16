---
name: South Beach Houston
status: candidate
platform: Eventbrite
url: https://www.southbeachhouston.com/
tags: [Nightlife, LGBTQ, Midtown]
firstSeen: 2026-06-16
lastChecked: 2026-06-16
pr:
---

Houston's largest LGBTQ dance club, located at 810 Pacific St, Houston TX 77006
(Midtown/4th Ward, near the Montrose LGBTQ corridor). Open Thursday–Sunday
with themed nights, DJ sets, and special events. A Houston LGBTQ anchor venue
since the 1990s.

**Eventbrite organizer ID confirmed:** `77045639483`
Organizer page: https://www.eventbrite.com/o/south-beach-houston-77045639483

Confirmed upcoming event (as of 2026-06-16): South Beach Houston Pride Party
June 6, 2026. The Eventbrite org page is active.

**Volume note:** LGBTQ dance clubs often post Eventbrite tickets only for
special/premium events (large parties, themed nights, Pride) rather than every
weekly night. Estimated volume: 10–20 Eventbrite events/year for major events,
with free nights not listed. Verify event count before implementing to
confirm the pipeline would produce enough events to be useful (threshold: at
least a few events visible on the Eventbrite org page at any given time).

**Geo (not verified):** 810 Pacific St, Houston TX 77006. Approximate lat/lng:
29.7453, -95.3806.

**Next step:** Verify Eventbrite org page event count (fetch the org page and
count upcoming events). If ≥ 3 upcoming, implement as Eventbrite type using
`organizerId: "77045639483"`. Requires `EVENTBRITE_TOKEN` secret in CI.
