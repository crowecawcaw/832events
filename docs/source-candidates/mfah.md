---
name: Museum of Fine Arts Houston
status: investigating
platform: Unknown (possibly ICS / custom)
url: https://www.mfah.org/events
tags: [Art, Museums, Museum District]
firstSeen: 2026-06-13
lastChecked: 2026-06-13
pr:
---

One of the largest art museums in the US, at 1001 Bissonnet St, Houston, TX 77005
(Museum District). Comprehensive public programming: gallery talks, lectures,
film screenings, concerts, family workshops, member events. 100+ public events/year.
Extremely high value — this should eventually be in the calendar.

**Platform:** Unknown. Events at mfah.org/events support calendar export
("Add to calendar" buttons mention Google Calendar, iCalendar, Outlook 365,
Outlook Live on per-event pages), but no standalone ICS feed URL has been
confirmed. The site may generate per-event .ics downloads rather than a
subscribable feed.

**Investigation needed:**
1. Fetch `https://www.mfah.org/events?format=json` — check if Squarespace
2. Look for `<link rel="alternate" type="text/calendar">` in page source
3. Check `https://www.mfah.org/events.ics` or similar
4. Check for `/api/events` or `/events.json` in the Network tab
5. Check if Ticketmaster/Eventbrite/Localist is the backend
   (the mfah.org domain suggests custom CMS, possibly Kentico or Sitecore)

**Geo:** lat 29.7260, lng -95.3910

**Confidence:** 🔍 Investigating — high value source, platform unknown. Do not
implement until a feed URL is confirmed to return future events.
