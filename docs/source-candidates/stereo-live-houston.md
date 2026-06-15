---
name: Stereo Live Houston
status: proxy
platform: AXS
url: https://www.stereolivehouston.com/
tags: [Music, Nightlife]
firstSeen: 2026-06-15
lastChecked: 2026-06-15
pr: 28
impl:
  type: axs
  axsVenueId: "126004"
  axsVenueSlug: "stereo-live-houston-houston-tickets"
---

> **2026-06-15 — switched Eventbrite → AXS.** The `type: eventbrite`
> implementation (organizer `3006970476`) returned 0 events: that organizer is
> real but its Eventbrite page shows "Nothing planned right now." The venue's
> events are listed on AXS (`axs.com/venues/126004/stereo-live-houston-houston-tickets`),
> so it's now `type: axs` with `proxy: "outofband"` (AXS bot-blocks CI). Event
> volume is **unverified, pending proxy**. Also corrected the location: this is
> 6400 Richmond Ave (Westchase), not Downtown — dropped the `Downtown` tag and
> set a real `geo`.


Stereo Live Houston is a music and nightlife venue in downtown Houston.

## Details

- **Website**: https://www.stereolivehouston.com/
- **Platform**: Eventbrite (organizer ID: 3006970476)
- **Event Type**: Live music, DJ events, club events
- **Location**: Downtown Houston
- **Confidence Tier**: 🟡 Medium — Eventbrite organizer identified but event volume unverified

## Investigation Notes

Organizer ID `3006970476` identified from web search. Requires live verification of event count and upcoming schedule.

## Implementation Notes

If event volume is confirmed (>0 upcoming events), implement as `sources/external/stereo-live-houston.yaml` using built-in `eventbrite` type with the provided organizer ID.
