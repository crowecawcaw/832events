---
name: Brazos Bookstore
status: candidate
platform: Custom HTML (IndieCommerce)
url: https://brazosbookstore.com/events
tags: [Books, Rice Village]
firstSeen: 2026-06-13
lastChecked: 2026-06-13
pr:
---

Houston's oldest independent bookstore at 2421 Bissonnet St (Rice Village).
~25 events/month: author readings, book clubs, story times, and poetry open
mics. 300+ events/year — one of the highest-volume literary sources in Houston.

Platform is IndieCommerce (ABA's Drupal-based platform for indie bookstores).
Events have predictable URL patterns (`/events/<year>/<month>`). No ICS feed.

A shared HTMLRipper base class could cover Brazos, Murder By The Book, and
Blue Willow Bookshop (all use IndieCommerce) with minimal duplication.

**Implementation:** Custom `HTMLRipper` in `sources/brazos-bookstore/`. Geo:
2421 Bissonnet St, Houston, TX 77005 (lat 29.7205, lng -95.4194). 🔴 Low
confidence tier (custom HTML), but high event volume makes it worthwhile.
