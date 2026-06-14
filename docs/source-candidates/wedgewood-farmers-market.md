---
name: Wedgewood Houston Farmers' Market
status: candidate
platform: Recurring YAML
url: https://www.wedgewoodhoustonfarmersmarket.com/schedule
tags: [FarmersMarket]
firstSeen: 2026-06-14
lastChecked: 2026-06-14
pr:
---

Seasonal mid-week farmers market in the Wedgewood area of Houston.
Runs every Wednesday May–October (5-month seasonal window). The website
is a static Squarespace page with a schedule listing, not an event
calendar — no ICS or API feed.

**Implementation:** Best implemented as a `sources/recurring/` YAML entry
with `every Wednesday` schedule and a `months` or `seasonal` restriction
(May–October). This avoids maintaining a scraper for a static page.

Need to verify the exact address and geo coordinates before implementing.
Also verify whether the market is still active in 2026 before implementing
(check the schedule page for current season dates).

**Confidence: Medium** — recurring YAML is easy to implement once the
address and active months are confirmed.
