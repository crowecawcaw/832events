---
name: Museum of Fine Arts Houston (MFAH)
status: blocked
platform: Custom (403 blocking)
url: https://www.mfah.org/events
tags: [Arts, Museum District]
firstSeen: 2026-06-13
lastChecked: 2026-06-13
pr:
---

Major art museum with two main buildings (Glassell School and Law Building)
plus the Bayou Bend Collection. High event volume but site returns HTTP 403
to all automated fetches.

- Main calendar URL: `https://www.mfah.org/events` → 403
- Ticketing system: `https://my.mfah.org/events` (custom platform, dynamically loaded)
- Eventbrite: No dedicated organizer page found; only sporadically used

No ICS feed identified. The City of Houston has a mirror page at
`https://www.houstontx.gov/events/mfa.html` but this is static.

**Status:** Blocked by HTTP 403 on all automated fetch attempts. Would need
`proxy: "outofband"` or `proxy: "browserbase"`. Mark as blocked until proxy
path is confirmed to work, per the one-rung-at-a-time escalation rule.
