---
name: Pearl Bar Houston
status: candidate
platform: Squarespace
url: https://www.pearlhouston.com/calendar
tags: [Nightlife, LGBTQ, Washington Avenue]
firstSeen: 2026-06-16
lastChecked: 2026-06-16
pr:
---

Pearl Bar is a nationally recognized lesbian-focused LGBTQ+ bar at 4216
Washington Ave, Houston TX 77007, between the Heights and Montrose
neighborhoods. One of the few thriving lesbian bars in the US. Known for
high-energy drag shows, trivia nights, themed dance parties (hip hop,
reggaeton, cumbia), and sports watch parties (WNBA, NWSL, NCAA softball).
Opened 2013. Active nightly programming.

**Calendar platform:** Squarespace confirmed — the site at pearlhouston.com
uses Squarespace, with the events calendar at `/calendar`. Squarespace's
built-in events feature exposes a `?format=json` endpoint that returns
structured event data including `startDate` epoch timestamps; this is what
the 832.events `squarespace` ripper type reads.

**Calendar evidence (as of 2026-06-16):**
- `pearlhouston.com/calendar` confirmed active with upcoming June 2026 events:
  Grand Opening Pride celebration (June 6), Pop the Balloon dating series,
  Sweet Sapphic Dreams Queer Prom (June 20), Beso Latin DJ nights
- 7 events listed for June alone — strong volume

**Next step:** Verify the Squarespace JSON endpoint:
```
curl -s "https://www.pearlhouston.com/events?format=json" | jq '.upcoming[].startDate'
```
The endpoint should return future events with `startDate` values in
milliseconds (epoch). If `data.upcoming` or `data.items` contains events with
`startDate > Date.now()`, implement as `type: squarespace` in `ripper.yaml`.

**Geo (not verified):** 4216 Washington Ave, Houston TX 77007. Approximate
lat/lng: 29.7622, -95.3905.
