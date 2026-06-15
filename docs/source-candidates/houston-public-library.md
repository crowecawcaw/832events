---
name: Houston Public Library
status: investigating
platform: LibCal (RSS only, no usable ICS)
url: https://calendar.houstonlibrary.org/calendar/events
tags: [Books, Education, Community]
firstSeen: 2026-06-13
lastChecked: 2026-06-15
pr:
---

Houston Public Library system-wide events via Springshare LibCal. High value
(300+ monthly events across 30+ branches: storytimes, digital-literacy/ESL/
citizenship workshops, author talks), but no usable public ICS feed with
future events.

**ICS Feed Status (as of 2026-06-15):**
- Endpoint: `https://calendar.houstonlibrary.org/ical_subscribe.php?cid=15272`
- HTTP Status: 200 OK
- Issue: Returns stale events only (May 13-26, 2026; all in the past)
- Future VEVENTs: **0**
- Root cause: `cid=15272` is a featured/saved calendar slice, not the live
  aggregate. The page source shows only one calendar ID in use (`calendarIds = [15272]`),
  and the LibCal REST API requires OAuth credentials (not public).

**RSS Feed (as a workaround):**
- Endpoint: `https://calendar.houstonlibrary.org/rss.php?iid=3866&m=month&cid=15272`
- Status: Returns ~300 current/future items (tested 2026-06-15: includes
  June 15-18+ events)
- Note: Not an ICS feed, so not suitable for direct use in 832.events

**Next steps:**
- Contact HPL to request a live public ICS export or system-wide calendar ID
- Check if LibCal admin portal exposes a different cid for the full calendar
- Consider whether RSS-to-ICS conversion is feasible (would require additional
  infrastructure)
- Currently blocked on finding a working ICS feed with future events
