---
name: Houston Public Library
status: candidate
platform: LibCal (ICS)
url: https://calendar.houstonlibrary.org/calendar/events
tags: [Books, Education, Community]
firstSeen: 2026-06-13
lastChecked: 2026-06-13
pr:
---

Houston Public Library system-wide events feed via Springshare LibCal.
Implemented as `sources/external/houston-public-library.yaml`.

- ICS feed: `https://calendar.houstonlibrary.org/ical_subscribe.php?cid=15272`
  (the `cid` was read off the "subscribe via iCal" widget on the events page).
- Verified live: feed parses to **500 events** (the LibCal export cap) across
  30+ branches — Central (Jesse H. Jones), Julia Ideson, Heights, Moody,
  Freed-Montrose, Young, Vinson, Flores, TECHLink, etc. Programs are real
  public events: storytimes, digital-literacy/computer classes, ESL and
  citizenship workshops, author talks.
- `geo: null` — multi-branch system, so each event geocodes from its own
  `LOCATION` (branch name) rather than a single venue coordinate.

Note: the feed serves "upcoming from the server's today, capped at 500."
Because HPL runs ~50+ events/day, those 500 events only span about a week.
Verified the full pipeline yields 500 **future** events when the build clock
matches the feed's window (`faketime` run) — the dev sandbox clock was ~1
month ahead of the live world, which is why an unmodified local build saw
them as past. CI runs on real-world UTC (aligned with the feed), so it will
populate normally.
