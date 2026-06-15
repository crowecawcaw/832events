---
name: Discovery Green
status: investigating
platform: Tribe Events (ICS broken — returns HTML)
url: https://www.discoverygreen.com/events
tags: [Downtown, Parks, Community]
firstSeen: 2026-06-14
lastChecked: 2026-06-15
pr:
---

12-acre public park and event venue in Downtown Houston (1500 McKinney St,
Houston, TX 77010). High-volume free programming: concerts, outdoor movies,
yoga, fitness classes, festivals, and community events. Approximately 50+
events/month.

Uses WordPress with Tribe Events plugin. **Tribe ICS endpoints all broken:**
- `/?post_type=tribe_events&ical=1&eventDisplay=list` → HTTP 200, returns HTML page (not ICS)
- `/events/?ical=1` → HTTP 200, returns HTML page
- `/?ical=1` → HTTP 200, returns HTML page
- `/calendar/?ical=1` → HTTP 200, returns HTML page

WordPress REST API available (`/wp-json/`), but no Tribe Events REST route.
Site has Elementor/theplus frontend (custom JS rendering, not JSON data in page).
No Eventbrite integration detected on site.

**Next step:** Either (a) find an undocumented ICS or API endpoint, (b) detect
if they offer a hidden Eventbrite organizer ID, or (c) implement HTML scraping
if event markup is reliably parseable from the Elementor frontend.
