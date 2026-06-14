---
name: The Heights Theater
status: investigating
platform: WordPress + PreKindle
url: https://theheightstheater.com/
tags: [Music, The Heights]
firstSeen: 2026-06-14
lastChecked: 2026-06-14
pr:
---

Historic 1926 theater restored as a concert venue at 339 W 19th St, The Heights.
Hosts concerts, comedy, and special events. Capacity ~900. Primarily indie/alternative/
folk/country acts. Strong Houston arts community presence.

**Platform:** WordPress website with PreKindle ticketing. All ticket links direct
to `prekindle.com` — a Texas-focused live event ticketing platform.

No ICS feed found on the website. PreKindle may have a public events API or
structured data endpoint — needs investigation.

**Investigation needed:** Check if PreKindle exposes a JSON or ICS endpoint
for venue listings. If so, this would be a medium-effort scraper. PreKindle
is used by many Texas venues so a reusable integration could cover multiple
sources.

Events URL: theheightstheater.com/events (returns 404 — events are on homepage)

Geo: 339 W 19th St, Houston, TX 77008 (The Heights)
