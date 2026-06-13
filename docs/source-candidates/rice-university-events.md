---
name: Rice University Events
status: investigating
platform: LiveWhale (ICS)
url: https://events.rice.edu/
tags: [Education, Museum District]
firstSeen: 2026-06-13
lastChecked: 2026-06-13
pr:
---

Rice University runs LiveWhale Calendar. The all-events ICS feed works:
`https://events.rice.edu/live/ical/events` → **702 events**.

Not implemented as-is: the all-events feed is noisy for a public city
calendar. It mixes genuinely public programming (Shepherd School concerts,
Moody Center for the Arts exhibitions, public lectures) with internal
administrative entries ("LAST DAY OF CLASSES", "Last day to register for
Summer Session") and even out-of-town items ("Los Angeles | Rice Alumni
Beach Day").

Next step before implementing: find a filtered LiveWhale group/tag feed
(e.g. Shepherd School of Music or Moody Center for the Arts only) using the
`live/ical/events/group_id/<ID>` pattern, or a "public events" tag feed, so
the source surfaces public-facing events without the campus-ops noise.
Geo would be Rice campus (Museum District / near the Medical Center).
