---
name: Miller Outdoor Theatre
status: investigating
platform: Custom HTML
url: https://www.milleroutdoortheatre.com/performances/
tags: [Theatre, Music, Museum District]
firstSeen: 2026-06-13
lastChecked: 2026-06-15
pr:
---

Free outdoor performing-arts venue in Hermann Park (Museum District) —
~125 free performances/year: classical/jazz/world music, dance, ballet,
Shakespeare, musical theatre, and classic films. High-value, all-free
programming that fits the calendar well.

Status: investigating. Site uses WCS (WebComplete Schedule) plugin for
events. Has an iCal export button (Vue.js button.method == 3) on the
performances page but the actual ICS feed URL is not publicly accessible
— requires JavaScript execution to generate the download link. Curl
requests return HTML rather than ICS. The endpoint pattern does not match
common ICS export patterns (tried /performances/?ical=1, /performances/feed.ics,
/wp-admin/admin-ajax.php?action=wcs_export_schedule, etc. — all return HTML).

Options:
1. Implement a custom HTML ripper to parse /performances/ page
2. Use Browserbase proxy to execute JS and download the iCal feed
3. Check if there's a Google Calendar link or alternative feed

Confidence: 🔴 Low. The iCal export exists but isn't accessible without
browser automation. Recommend either HTML scraper or proxy approach.
