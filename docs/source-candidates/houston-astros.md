---
name: Houston Astros
status: added
platform: MLB.com / CalendarLabs
url: https://www.mlb.com/astros/schedule
tags: [Sports, Baseball, MLB]
firstSeen: 2026-06-15
lastChecked: 2026-06-15
pr: implementation-cycle-2026-06-15
impl:
  type: external
  icsUrl: https://ics.calendarlabs.com/31/b23ce88a/Houston_Astros_-_MLB.ics
  observedEventCount: 185
  geo: null
---

Houston Astros Major League Baseball team schedule and events. Games are played at Minute Maid Park.

## Details

- **Official Website**: https://www.mlb.com/astros
- **Schedule Page**: https://www.mlb.com/astros/schedule
- **ICS Availability**: https://www.calendarlabs.com/ical-calendar/sports-baseball/houston-astros-mlb-31/ (CalendarLabs provides subscription)
- **Event Type**: Sports - baseball games
- **2026 Season**: Active (currently mid-season in June 2026)
- **Confidence Tier**: 🔥 High — verified ICS feed available via CalendarLabs

## CalendarLabs

CalendarLabs provides ICS calendar subscriptions for Houston Astros that work with Outlook, Google Calendar, iOS, Android, and Mac iCal.

## Implementation Options

1. **Via CalendarLabs**: Use the CalendarLabs ICS URL as an external calendar source
2. **Via MLB.com**: Check if MLB.com offers direct ICS subscription
3. **Via Built-in Ripper**: If CalendarLabs URL is stable, add as `sources/external/houston-astros.yaml` with the ICS feed URL

## Notes

Consider grouping with other Houston sports teams (Texans, Rockets) if they all use same ICS approach.
