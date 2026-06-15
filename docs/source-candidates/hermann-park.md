---
name: Hermann Park Conservancy
status: candidate
platform: ICS/iCal Feed
url: https://www.hermannpark.org/events/
tags: [Parks, Outdoor Recreation, Museums, Hermann Park]
firstSeen: 2026-06-15
lastChecked: 2026-06-15
---

Hermann Park is a major 445-acre urban park in Houston with extensive programming including concerts, cultural events, educational programming, and community activities.

## Details

- **Events Page**: https://www.hermannpark.org/events/
- **Calendar Support**: Offers calendar subscription options including Google Calendar, iCalendar (.ics), Outlook 365, and Outlook Live
- **Estimated Volume**: 30+ events across multiple categories (concerts, family programs, fitness classes, movie nights)
- **Confidence Tier**: 🔥 High — ICS feed explicitly supported on website

## Next Steps

Verify the ICS feed URL is accessible and returns valid calendar data. Check if `hermannpark.org/?post_type=tribe_events&ical=1` works or find the correct feed endpoint from their website.

## Implementation Notes

Similar to other Tribe Events sources (Houston Arboretum, Montrose Center). If using Tribe Events ICS, add `sources/external/hermann-park.yaml`.
