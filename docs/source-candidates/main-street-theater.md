---
name: Main Street Theater
status: investigating
platform: Easy-Ware Ticketing (custom)
url: https://mainstreettheater.com/
tags: [Theatre, Midtown]
firstSeen: 2026-06-14
lastChecked: 2026-06-14
pr:
---

Professional theater company with two Houston stages: Village (2540 Times Blvd,
Rice Village) and Chelsea Market (4617 Montrose Blvd, Montrose). Produces
MainStage productions and Theater for Youth programming year-round.

**Platform:** WordPress website with ticketing through Easy-Ware Ticketing at
`msthouston.easy-ware-ticketing.com/events`.

Easy-Ware is a niche theater ticketing platform. ICS feed or API availability
is unknown. The WordPress site uses `/mainstage/` and `/theater-for-youth/`
sections for performance listings.

**Investigation needed:** Check if Easy-Ware exposes a public ICS or JSON API.
If not, evaluate HTMLRipper against the Easy-Ware events listing page or the
WordPress production pages.

Current production: "The True Story of the 3 Little Pigs!" confirmed in feed.

Geo: Multiple locations — use geo: null (multi-venue)
