---
name: Houston Texans
status: investigating
platform: Ticketmaster (only known source)
url: https://www.houstontexans.com/schedule/
tags: [Sports, Football, NFL]
firstSeen: 2026-06-15
lastChecked: 2026-06-15
---

Houston Texans National Football League team schedule and events. Games are played at NRG Stadium.

## Details

- **Official Website**: https://www.houstontexans.com
- **Schedule Page**: https://www.houstontexans.com/schedule/
- **Ticketing**: Ticketmaster integration (presented by Ticketmaster)
- **Event Type**: Sports - football games (NFL)
- **2026 Season**: Upcoming (NFL season Sept-Jan in NFL calendar)
- **Confidence Tier**: 🟡 Medium — requires Ticketmaster API integration

## Investigation Results (2026-06-15)

### ICS Feed Search (UNSUCCESSFUL)

Tested the following ICS feed URL patterns — none returned valid Texans schedule data:

1. **CalendarLabs URLs** (tested pattern used for other Houston teams):
   - `https://ics.calendarlabs.com/145/Houston_Texans/Houston_Texans_schedule.ics` → 403 / File not found
   - `https://ics.calendarlabs.com/76/Houston_Texans/Houston_Texans.ics` → returned US Holidays (wrong calendar)

2. **NFL Official**:
   - `https://www.nfl.com/feeds/site/teamsites/houston-texans/schedule.ics` → 404 HTML page
   - `https://feeds.nfl.com/teams/hou/schedule` → deprecated (API-only, requires credentials)

3. **ESPN**:
   - `https://www.espn.com/nfl/team/schedule/_/name/hou/ical` → 200 HTML (not ICS)

4. **Yahoo Sports, Google Calendar, iCalShare, other aggregators**: No working endpoints found

### Conclusion

No direct ICS feed exists for Houston Texans. Implementation requires Ticketmaster API.

## Next Steps

1. **Find NRG Stadium Ticketmaster venue ID** — needed for `type: ticketmaster` config
2. **Verify future games exist** via Ticketmaster API search (Sep-Jan 2026 season)
3. Create `sources/houston-texans/ripper.yaml` with Ticketmaster config

Currently in off-season (June 2026). Season games would be Sep-Jan. Preseason likely in August.
