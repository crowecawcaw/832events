---
name: Urban Harvest Saturday Farmers Market
status: candidate
platform: Recurring YAML
url: https://www.urbanharvest.org/urban-harvest-farmers-market/
tags: [FarmersMarket, River Oaks]
firstSeen: 2026-06-13
lastChecked: 2026-06-13
pr:
---

Year-round Saturday farmers market at St. John's School, 2752 Buffalo
Speedway, Houston, TX 77098. Runs every Saturday 8am–12pm.

No ICS feed or subscribable calendar found — their events calendar at
`give.urbanharvest.org/calendar` uses a donation-CRM system (Salsa). Their
education workshops and events page also lacks a machine-readable feed.

Best integration path is a `sources/recurring/` YAML entry for the weekly
market. Their Eventbrite organizer page (ID `91606547313`) is the same as
Houston Farmers Market and currently shows 0 upcoming events.

**Implementation:** Add `sources/recurring/urban-harvest-farmers-market.yaml`
with `schedule: every Saturday`, `start_time: "08:00"`, `duration: PT4H`.
Geo: lat 29.7253, lng -95.4322 (2752 Buffalo Speedway / St. John's School).
