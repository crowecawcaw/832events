---
name: Contemporary Arts Museum Houston
status: candidate
platform: Eventbrite
url: https://camh.org/event-calendar/
tags: [Art, Museums, Museum District]
firstSeen: 2026-06-13
lastChecked: 2026-06-15
pr:
impl:
  type: eventbrite
  organizerId: "5365268811"   # https://www.eventbrite.com/o/contemporary-arts-museum-houston-5365268811
  observedEventCount: 6   # from the Eventbrite organizer page; the `eventbrite` ripper needs EVENTBRITE_TOKEN, a CI-only secret — NOT verifiable in a local build, only in CI
  geo: { lat: 29.7261, lng: -95.3905, label: "Contemporary Arts Museum Houston, 5216 Montrose Blvd, Houston, TX 77006" }
---

Free-admission contemporary art museum at 5216 Montrose Blvd, Houston, TX 77006
(Museum District). No permanent collection — all programming is rotating
exhibitions, artist talks, performances, and family events. Founded 1948.

**Implementation:** Switched from Tribe Events ICS (which returns HTTP 403 from CI)
to Eventbrite organizer ID `5365268811`. Organizer page verified (HTTP 200,
2026-06-15) with title "Contemporary Arts Museum Houston" and 6 confirmed upcoming
events. Ripper config written to `sources/camh/ripper.yaml` with `type: eventbrite`.

**Note:** The `eventbrite` built-in ripper requires `EVENTBRITE_TOKEN` secret in CI
(provided by GitHub Actions) — NOT verifiable in local builds. Verification
and event count confirmation will occur in the PR/CI build once merged.
