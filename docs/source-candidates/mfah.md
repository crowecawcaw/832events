---
name: Museum of Fine Arts Houston
status: investigating
platform: Unknown (Cloudflare-blocked; per-event iCalendar export only)
url: https://www.mfah.org/events
tags: [Art, Museums, Museum District]
firstSeen: 2026-06-13
lastChecked: 2026-06-15
pr:
impl:
  note: "Cloudflare WAF blocks all bot requests. No subscribable ICS feed found via curl, JSON endpoint, or direct /events.ics probes. Site exports individual event .ics files only. Platform is custom CMS (not Tribe Events, Eventbrite, Squarespace, Ticketmaster, or Localist). Requires either: (1) outofband residential IP fetch to locate feed URL, or (2) custom ripper with JS execution (browserbase) to parse events. High-value source; defer pending proxy verification."
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

**Cloudflare WAF blocking (2026-06-15):** All curl requests to mfah.org hit Cloudflare
challenge pages. Tested:
- `https://www.mfah.org/?post_type=tribe_events&ical=1&eventDisplay=list` → HTTP 403
- `https://www.mfah.org/events/?ical=1` → HTTP 403
- `https://www.mfah.org/events?format=json` → HTTP 403
- `https://www.mfah.org/events.ics` → HTTP 403
- Other standard ICS endpoints → HTTP 403

No Tribe Events ICS endpoint pattern detected. Likely custom CMS (Kentico, Sitecore, or proprietary).

**Recommendation:** Mark as `status: proxy` with `proxy: "outofband"` or `"browserbase"`.
The out-of-band residential fetch may locate a feed URL, or JS execution may be needed.

**Geo:** lat 29.7259, lng -95.3905

**Confidence:** 🚫 Blocked by Cloudflare WAF. High-value source; proxy required to proceed.
