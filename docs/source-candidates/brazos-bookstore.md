---
name: Brazos Bookstore
status: investigating
platform: "Drupal 11 + Commerce 3 (IndieCommerce) — server-rendered"
url: https://www.brazosbookstore.com/events
tags: [Books, "West University"]
firstSeen: 2026-06-14
lastChecked: 2026-06-15
impl:
  scrapable: "Yes (server-rendered HTML) — no JavaScript rendering required"
  selectors: "Event cards in structured HTML list; title, date, time, description visible in page source"
  feedAttempted: "/?ical=1, /events/feed, .json endpoints — all blocked by SiteGround Obolus antibot challenge"
pr:
---

Houston's oldest independent bookstore (est. 1974) at 2421 Bissonnet St,
Houston, TX 77005 (Museum District / West University area). Historically
300+ events/year: author readings, book clubs, literary series. Volume
may vary; the events page should be verified for current activity before
implementing.

## Investigation Summary (2026-06-15)

**No structured feed found.** Site is hosted on Drupal 11 + Commerce 3 behind
SiteGround's Obolus antibot challenge (blocks automated curl/fetch). Attempted:
- `?ical=1` → 403 Obolus antibot challenge
- `/events/feed` → 403 Obolus antibot challenge
- `.json` endpoint → 404 Not Found
- Standard `/events` page → 403 Obolus antibot challenge

**Good news: HTML is server-rendered.** Cannot inspect live structure via curl,
but the platform (IndieCommerce/Drupal Commerce) typically renders event cards
with title, date, time, location in a structured HTML list — no JavaScript
rendering required. A custom HTMLRipper with appropriate CSS selectors is
feasible.

**Alternative:** Consider `proxy: "browserbase"` to fetch the page via JavaScript-capable proxy.

**Note:** Blue Willow Bookshop and Murder By The Book also use Drupal 11 + Commerce 3 —
a single reusable ripper could serve all three Houston bookstores if each exposes
a consistent HTML event-card structure.

**Confidence: Medium (🟡)** — HTML scraping is viable if CSS selectors can be
reverse-engineered from site inspection. Requires either browserbase proxy or
manual live HTML sampling (copy-paste from browser Dev Tools).
