---
name: Station Theater
status: investigating
platform: Squarespace + CrowdWork
url: https://stationtheater.com/
tags: [Comedy, Midtown]
firstSeen: 2026-06-14
lastChecked: 2026-06-14
pr:
---

Houston's longest-running improv comedy theater, located in Midtown. Presents
improv shows, workshops, and special events year-round. Regular shows include
Friday Improv Implosion and Saturday Singularity Improv.

**Platform:** Squarespace website. Event ticketing is managed through CrowdWork
at `https://www.crowdwork.com/v/stationtheater/shows`.

CrowdWork is a niche ticketing platform — the API/ICS availability is unclear.
The CrowdWork page returned "No shows found" in fetch (may be JS-rendered).

**Investigation needed:** Check whether CrowdWork exposes a JSON or ICS endpoint
for show listings. If not, the Squarespace site itself may be scrapable, or
their own site `/shows` page may have structured data.

No ICS feed confirmed working as of 2026-06-14. Needs further investigation to
determine if CrowdWork has a public API before implementing.

Geo: 3400 Main St #215, Houston, TX 77002 (Midtown)
