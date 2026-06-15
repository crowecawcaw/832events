---
status: added
platform: Eventbrite
firstSeen: 2026-06-15
lastChecked: 2026-06-15
implementationPR: null
---

> **2026-06-15 — organizer id corrected.** The first implementation used
> `556771203279`, which is **not** the Eventbrite organizer id — the API 404'd
> it (0 events + 1 parse error). The real organizer is
> `eventbrite.com/o/kindred-stories-34094451143` → organizer id `34094451143`
> (3 upcoming events confirmed: A Pair of Aces 6/30, The Missed Connection 7/2,
> Daggermouth 7/31). Note events are hosted at partner venues (Eldorado
> Ballroom, Holy Family HTX), not the bookstore, so per-event locations vary.

# Kindred Stories

Independent bookstore in Third Ward specializing in Black and Brown authors, literature, and creative works.

**Address:** 2304 Stuart St, Houston, TX 77004

**Website:** https://kindredstorieshtx.com/

**Events:** Author talks, book clubs, literary events

## Implementation Notes

- **Eventbrite Organizer ID:** 34094451143 (corrected 2026-06-15; the earlier `556771203279` was wrong and 404'd)
- **Events URL:** https://kindredstorieshtx.com/pages/events (links to 8 Eventbrite events)
- **Verified Events:** Upcoming live events confirmed on Eventbrite:
  - "A Pair of Aces with Victoria Christopher Murray and Marie Benedict" (1984645765911) - July 1, 2026 - Status: live
  - "The Company We Keep with Alexandra Elle" (1986358003259) - June 3, 2026 - Status: completed (past)
  - Additional events listed on their events page (8 total)

**Source:** Eventbrite-hosted calendar; organizer has active event listings. The source provides a clean, maintained feed via the standard Eventbrite integration (type: eventbrite).
