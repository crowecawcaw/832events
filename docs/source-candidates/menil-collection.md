---
name: The Menil Collection
status: candidate
platform: Custom HTML
url: https://www.menil.org/events
tags: [Arts, Museum District]
firstSeen: 2026-06-13
lastChecked: 2026-06-13
pr:
---

World-renowned free art museum in the Montrose/Museum District area. ~18
upcoming events (June–August 2026): curator talks, film screenings, and public
programs. Admission is always free.

No ICS feed available. Eventbrite organizer page (ID `103448972041`) currently
shows 0 upcoming events — Eventbrite is not their active channel. Their custom
CMS has no calendar export option.

Would require a custom HTML ripper scraping `menil.org/events`. The event
listing uses standard pagination and filter parameters.

**Implementation:** Custom `HTMLRipper` in `sources/menil-collection/`. Geo:
1515 Sul Ross St, Houston, TX 77006 (lat 29.7371, lng -95.4001). 🔴 Low
confidence tier.
