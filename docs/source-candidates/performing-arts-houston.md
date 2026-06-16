---
name: Performing Arts Houston
status: investigating
platform: Unknown (calendar subscription page exists)
url: https://performingartshouston.org/events/
tags: [Music, Theater, Art, Downtown]
firstSeen: 2026-06-16
lastChecked: 2026-06-16
pr:
---

Houston's major performing arts presenter, bringing international-caliber
concerts, dance, and theater to local stages. Presents at Jones Hall
(615 Louisiana St, Houston TX 77002) and Wortham Theater Center
(501 Texas Ave, Houston TX 77002), along with other Downtown venues.
Full 2025–26 season includes classical music, contemporary dance, and
world theater — dozens of performances per year.

**Calendar evidence:**
- Events page active at `performingartshouston.org/events/`
- A `/blocks/subscribe-single-events/` path was found, indicating a calendar
  subscription UI block is present on the site — strongly suggests per-event
  iCal add-to-calendar links (not necessarily a bulk subscribable feed)
- Season Guide at `performingartshouston.org/whats-on/season-guide/`
- 2026 events confirmed visible (Philip Glass Etudes, other performances)

**Platform unknown:** Could be WordPress with a custom events plugin, or a
ticketing platform with an embedded calendar. Ticket sales seem to go through
a "Select Seats" flow suggesting a proper ticketing backend. Need to inspect
the page source/network traffic to identify the platform and whether a bulk
ICS feed exists.

**Geo (not verified):** Primary presenting venue is Jones Hall, 615 Louisiana
St, Houston TX 77002. Approximate lat/lng: 29.7545, -95.3637. However, this
source presents at multiple venues — `geo: null` may be more appropriate if
events are distributed across Downtown venues.

**Next steps:**
1. Fetch `performingartshouston.org/events/` and inspect page source for
   calendar platform signals (WordPress admin, Tribe Events `post_type`,
   Squarespace `?format=json`, etc.)
2. Look for an ICS subscription or feed URL in the page HTML
3. Check network tab for API calls returning event data
4. If a bulk feed exists: implement; if only per-event links: evaluate
   whether HTML scraping is feasible (`🔴 Low` custom ripper)
