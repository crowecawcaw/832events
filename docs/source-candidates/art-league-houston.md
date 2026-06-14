---
name: Art League Houston
status: candidate
platform: Squarespace
url: https://www.artleaguehouston.org/calendar
tags: [Art, Montrose]
firstSeen: 2026-06-13
lastChecked: 2026-06-13
pr:
---

Houston's oldest visual-arts nonprofit (est. 1948), at 1953 Montrose Blvd,
Houston, TX 77006. Programs include gallery exhibitions, an art school,
artist talks, fundraiser events (Block Party), and the Texas Artist of the Year
program.

**Platform:** Squarespace — site confirmed Squarespace (squarespace.com domain
appeared in search cache for the organization). Calendar at `/calendar` and
`/upcomingcalendar`.

**Verification needed:** Fetch `https://www.artleaguehouston.org/events?format=json`
to confirm the Squarespace `?format=json` endpoint returns future events.
Check that at least one item in `data.upcoming` or `data.items` has
`startDate > Date.now()` (milliseconds epoch). If confirmed, proceed with
the built-in `squarespace` type.

**Geo:** lat 29.7441, lng -95.3941

**Confidence:** 🟡 Medium — Squarespace is highly probable but `?format=json`
endpoint not yet verified.
