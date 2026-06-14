---
name: Discovery Green
status: investigating
platform: Tribe Events (ICS — unconfirmed)
url: https://www.discoverygreen.com/events
tags: [Downtown, Parks, Community]
firstSeen: 2026-06-14
lastChecked: 2026-06-14
pr:
---

12-acre public park and event venue in Downtown Houston (1500 McKinney St,
Houston, TX 77010). High-volume free programming: concerts, outdoor movies,
yoga, fitness classes, festivals, and community events. Approximately 50+
events/month.

Uses WordPress, and the site's Tribe Events ICS endpoint has been reported
as returning HTML instead of ICS calendar data — the standard
`?post_type=tribe_events&ical=1` URL may not be enabled or may be broken.

**Next step:** Verify whether a working ICS export exists at a different
URL path, or whether the site uses a different events plugin. Check the
events page source for `<link rel="alternate" type="text/calendar">` or
other calendar export hints. If no ICS exists, evaluate custom HTML scraping.
