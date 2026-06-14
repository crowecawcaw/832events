---
name: Punch Line Houston
status: candidate
platform: Ticketmaster
url: https://www.punchlinehtx.com/shows
tags: [Comedy, Downtown]
firstSeen: 2026-06-13
lastChecked: 2026-06-13
pr:
---

Dedicated comedy club with ~24 upcoming shows (June–July 2026 window visible).
All ticketing runs exclusively through Ticketmaster / Live Nation.

Ticketmaster venue ID: **KovZ917ARGO** (Live Nation venue ID format)
Live Nation page: https://www.livenation.com/venue/KovZ917ARGO/punch-line-houston-events

**Blocker:** Requires `TICKETMASTER_API_KEY` environment variable.

**Implementation (when API key is available):** `type: ticketmaster` with
`venueId: "KovZ917ARGO"`. Need to confirm address and geo for the config file.
