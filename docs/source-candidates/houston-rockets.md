---
name: Houston Rockets
status: added
platform: NBA.com / CalendarLabs
url: https://www.nba.com/rockets/schedule
tags: [Sports, Basketball, NBA]
firstSeen: 2026-06-15
lastChecked: 2026-06-15
pr: implementation-cycle-2026-06-15
impl:
  type: external
  icsUrl: https://ics.calendarlabs.com/1898/b41aa298/Houston_Rockets_Schedule.ics
  observedEventCount: 43
  geo: null
---

Houston Rockets National Basketball Association team schedule and events. Games are played at Toyota Center.

## Details

- **Official Website**: https://www.nba.com/rockets
- **Schedule Page**: https://www.nba.com/rockets/schedule
- **ICS Availability**: https://www.calendarlabs.com/ical-calendar/sports-basketball/houston-rockets-schedule-1898/ (CalendarLabs provides subscription)
- **Event Type**: Sports - basketball games
- **2026 Season**: Active (currently mid-season in June 2026)
- **Confidence Tier**: 🔥 High — verified ICS feed available via CalendarLabs

## CalendarLabs

CalendarLabs provides ICS calendar subscriptions for Houston Rockets that work with Outlook, Google Calendar, iOS, Android, and Mac iCal.

## Implementation Options

1. **Via CalendarLabs**: Use the CalendarLabs ICS URL as external calendar source
2. **Via NBA.com**: Check if NBA.com offers direct ICS subscription
3. **Via Built-in Ripper**: If CalendarLabs URL is stable, add as `sources/external/houston-rockets.yaml` with the ICS feed URL

## Notes

Consider grouping with other Houston sports teams (Astros, Texans) if they all use same ICS approach.
