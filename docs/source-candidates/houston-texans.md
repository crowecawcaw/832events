---
name: Houston Texans
status: added
platform: NFL / Ticketmaster
url: https://www.houstontexans.com/schedule/
tags: [Sports, Football, NFL]
firstSeen: 2026-06-15
lastChecked: 2026-06-15
pr: implementation-cycle-2026-06-15
impl:
  type: external
  icsUrl: https://ics.calendarlabs.com/1984/1984/Houston_Texans_Schedule.ics
  observedEventCount: 4
  geo: null
---

Houston Texans National Football League team schedule and events. Games are played at NRG Stadium.

## Details

- **Official Website**: https://www.houstontexans.com
- **Schedule Page**: https://www.houstontexans.com/schedule/
- **Ticketing**: Ticketmaster integration (presented by Ticketmaster)
- **Event Type**: Sports - football games (NFL)
- **2026 Season**: Upcoming (NFL season Sept-Jan in NFL calendar)
- **Confidence Tier**: 🟡 Medium — Ticketmaster integration confirmed, but ICS feed not yet verified

## Investigation Needed

1. Check if CalendarLabs provides Houston Texans ICS feed (like Rockets/Astros)
2. Check if Ticketmaster integration provides ICS export
3. Check if NFL.com provides direct ICS feed for Houston Texans games

## Implementation Options

1. **Via CalendarLabs**: If available, use CalendarLabs ICS URL like other Houston sports teams
2. **Via Ticketmaster**: Potentially build a Ticketmaster-based ripper if no ICS feed exists
3. **Via Built-in Ripper**: Use existing Ticketmaster ripper if available in codebase

## Notes

Currently in off-season (June 2026). Season games would be Sept-Jan. Preseason likely in August.
