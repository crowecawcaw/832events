---
name: Houston Public Library
status: investigating
platform: LibCal (ICS)
url: https://calendar.houstonlibrary.org/calendar/events
tags: [Books, Education, Community]
firstSeen: 2026-06-13
lastChecked: 2026-06-13
pr:
---

Houston Public Library system-wide events via Springshare LibCal. High value
(500-event export across 30+ branches: storytimes, digital-literacy/ESL/
citizenship workshops, author talks), but the public iCal feed is **not
usable as-is** and is held for investigation.

Problem: the only public feed found,
`https://calendar.houstonlibrary.org/ical_subscribe.php?cid=15272` (cid read
off the events page's "subscribe via iCal" widget), returns a **fixed,
stale window** — exactly 500 events all dated 2026-05-13 .. 2026-05-21 —
regardless of `date`/`days`/`src` parameters. As of the real current date
(2026-06-13, confirmed via server `Date:` headers from Google, Cloudflare,
and the library host itself), that feed yields **0 future events**, so it
would trip the new-source "0 events" gate and fail CI. `cid=15272` appears
to be a featured/saved calendar slice, not the live "all upcoming events"
aggregate.

(Earlier note in this file claimed a dev-sandbox clock skew — that was
wrong. The sandbox clock matches real-world UTC; the feed itself is stale.)

Next steps before implementing:
- Find the live aggregate feed. LibCal's authenticated REST API
  (`/1.1/events`) returns upcoming events but needs OAuth client
  credentials the library would have to issue — not public.
- Look for an alternate public export: a different `cid` for the true
  system-wide calendar, a per-branch `cid` that serves upcoming events, or
  a LibCal RSS/JSON widget endpoint the events page calls client-side.
- Only implement once a feed is confirmed to return events dated after the
  current date.
