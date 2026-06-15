---
name: Pride Houston 365
status: proxy
platform: Eventbrite
url: https://www.eventbrite.com/o/pride-houston-19231282193
tags: [Community]
firstSeen: 2026-06-14
lastChecked: 2026-06-15
pr: pending
---

Pride Houston 365 organizes the official Houston LGBT Pride Celebration® and
hosts LGBTQIA+ events throughout the year in downtown Houston. They promote
equality and inclusion with events that uplift, unite, and support Houston's
LGBTQIA+ community.

Eventbrite organizer page confirmed (HTTP 200):
`https://www.eventbrite.com/o/pride-houston-19231282193`

## Implementation Status

- Eventbrite Organizer ID: `19231282193` (appears on page, not API-accessible)
- Built-in `eventbrite` ripper type with `organizerId: "19231282193"`
- **API Issue:** The organizer ID is not recognized by Eventbrite API (HTTP 404 from `/organizers/{id}/events`). The page returns HTTP 200, but the API doesn't expose this organizer.
- **Escalation Path:** Marked `proxy: "outofband"` to route to residential IP verification (rung 2 of the proxy ladder). Out-of-band runner will attempt to verify event volume from a non-CI IP; if it succeeds, events can be captured from the user's list. If it fails after 3 attempts, will escalate to Browserbase (rung 3).
- Events span the year, not just June Pride month — community fundraisers, social mixers, the annual Pride parade/festival, etc.
- Not a religious organization; clearly serves public Houston audiences
- Geo set to null (events vary by location citywide, not a fixed venue)
