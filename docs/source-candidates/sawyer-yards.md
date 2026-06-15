---
name: Sawyer Yards / Silver Street Studios
status: investigating
platform: ctycms (custom CMS)
url: https://www.sawyeryards.com/events/upcoming-events
tags: ["Art", "First Ward"]
firstSeen: 2026-06-15
lastChecked: 2026-06-15
---

## Findings

Sawyer Yards is an arts campus and creative community in Houston's First Ward with regular programming (exhibitions, open studios, markets).

### ICS Feed Status

Tested multiple ICS feed URLs against the website:
- `https://www.sawyeryards.com/?post_type=tribe_events&ical=1&eventDisplay=list` → HTTP 200, returns HTML (not ICS)
- `https://www.sawyeryards.com/events/?ical=1` → HTTP 200, returns HTML (not ICS)
- `https://www.sawyeryards.com/events/upcoming-events/?ical=1` → HTTP 200, returns HTML (not ICS)
- `https://www.sawyeryards.com/?ical=1` → HTTP 200, returns HTML (not ICS)
- `https://www.sawyeryards.com/calendar.ics` → HTTP 404
- `https://www.sawyeryards.com/index.ics` → HTTP 404
- `https://www.sawyeryards.com/feed.ics` → HTTP 404

Page uses a custom CMS (`ctycms.com`), not Tribe Events, Eventbrite, or Localist. No "Export Calendar" or "Subscribe" buttons visible on the events page. JavaScript is minified and no exposed API endpoints detected. Content-type negotiation (Accept: text/calendar) does not produce ICS output.

### Recommendation

**No working ICS feed available.** The custom CMS does not expose calendar data in standard formats. Would require HTML scraping (ripper.ts implementation) to extract event data from the events page—a fragile, maintenance-heavy option for this source.

**Status: investigating** → Consider escalating to HTML scraping if Sawyer Yards becomes a priority, but for now, document as a known limitation of their CMS.
