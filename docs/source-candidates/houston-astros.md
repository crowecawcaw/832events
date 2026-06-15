---
name: Houston Astros
status: investigating
platform: MLB.com / CalendarLabs
url: https://www.mlb.com/astros/schedule
tags: [Sports, Baseball, MLB]
firstSeen: 2026-06-15
lastChecked: 2026-06-15
---

Houston Astros Major League Baseball team schedule and events. Games are played at Daikin Park (formerly Minute Maid Park).

## Investigation Summary (2026-06-15)

**Status**: No working public ICS feed found. Attempted multiple URLs without success.

### URLs Tested

| URL | HTTP Status | Notes |
|-----|-------------|-------|
| `https://www.calendarlabs.com/ical-calendar/sports-baseball/houston-astros-mlb-31/` | 200 | Returns HTML landing page, not ICS feed |
| `https://www.calendarlabs.com/ical/houston-astros-mlb-31.ics` | 404 | File not found |
| `https://www.calendarlabs.com/ical-calendar/ics/76/Houston_Astros.ics` | 200 | Returns US Holidays calendar, not Astros |
| `https://www.calendarlabs.com/ical-calendar/ics/houston-astros.ics` | 404 | Not found |
| `https://www.mlb.com/astros/schedule/ics` | 200 | Returns HTML page, not ICS |
| `https://www.astros.com/schedule.ics` | 200 | Returns HTML page, not ICS |
| `https://sports.yahoo.com/mlb/teams/houston-astros/schedule.ics` | 200 | Returns gzipped HTML, not ICS |
| `https://www.espn.com/mlb/team/schedule/_/name/hou.ics` | 200 | Returns HTML page, not ICS |
| Various other services (Stanza, iCalShare, icalendar.net, etc.) | 404/empty | No valid ICS feed found |

### Findings

- CalendarLabs HTML page mentions ICS subscriptions but the actual `.ics` feed URLs are not accessible or return wrong content
- Major sports sites (MLB.com, Astros.com, Yahoo Sports, ESPN) do not expose direct ICS feeds via simple URL patterns
- No public baseball ICS aggregator found with accessible Astros schedule feed
- MLB API may require authentication for schedule data export

## Next Steps

- Investigate MLB API documentation for official schedule exports
- Consider whether a custom ripper using MLB.com's API would be feasible
- Check if Ticketmaster or other ticketing platforms provide ICS exports for Astros games
- Alternatively, mark as `blocked` if no viable public feed exists without authentication

## Details

- **Official Website**: https://www.mlb.com/astros
- **Schedule Page**: https://www.mlb.com/astros/schedule
- **Event Type**: Sports - baseball games (home and away)
- **2026 Season**: Active (mid-season)
- **Venue**: Daikin Park (formerly Minute Maid Park), 501 Crawford St, Houston, TX 77002
