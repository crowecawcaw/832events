---
name: Rice University Events
status: proxy
platform: LiveWhale (ICS)
url: https://events.rice.edu/
tags: [Education, Art, Museum District]
firstSeen: 2026-06-13
lastChecked: 2026-06-16
pr: claude/832events-sources-fixes-4nd5e8
---

Rice University runs LiveWhale Calendar.

**Implemented** via the category-filtered feed
`https://events.rice.edu/live/ical/events/category/Open%20to%20the%20Public`
→ ~183 events, all dated after today, with **zero** campus-ops noise. This
is the filtered feed the earlier investigation called for: it surfaces
Moody Center for the Arts exhibitions, public lectures, and concerts
without the internal admin entries.

Do **not** use the raw all-events feed
(`https://events.rice.edu/live/ical/events`, ~702 events) — it mixes
public programming with internal entries ("LAST DAY OF CLASSES", "Last day
to register for Summer Session") and out-of-town items ("Los Angeles |
Rice Alumni Beach Day").

Source file: `sources/external/rice-public-events.yaml`. Declared with a
single-venue `geo` (Rice campus, 6100 Main St). Event LOCATION strings in
the feed are building names / "Online" / occasional out-of-town strings;
with a feed-level `geo` set, those are not per-event geocoded (the feed
inherits the campus venue coords), so the source contributes no geocode
errors. See the external-calendar `geo` precedence fix in
`lib/calendar_ripper.ts`.

**Proxy (2026-06-16):** the LiveWhale feed intermittently blocks GitHub
Actions runner IPs. CI run 27636803391 hit a non-200 on a cold fetch-cache,
so the ripper threw (0 events + 1 parse error) and tripped the fatal
new-source zero-event/parse gate. The same feed returns HTTP 200 with ~177
VEVENTs from a residential IP, so the source was escalated to
`proxy: "outofband"` (rung 2) — it now fetches via the out-of-band runner
and lands in the non-fatal `pendingProxyVerification` queue.
