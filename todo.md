# 832.events — Outstanding Work

Operational follow-ups that don't fit `ideas.md` (which is for new content/features).
Move items to `ideas.md` if they grow into proper feature designs.

## OSM Integration Follow-ups

### Backfill the hardcoded fallback tables in `lib/geocoder.ts`
`KNOWN_VENUE_COORDS`, `LIBRARY_BRANCH_COORDS`, and `UNIVERSITY_BUILDING_COORDS` are
hand-curated lat/lng tables — none of them carry OSM ids today, so any
event resolved through these tables ships without `osmType`/`osmId`. Either
promote these entries into proper ripper/external/recurring `geo` blocks and
run the backfill script, or extend the lookup tables to carry optional
`osmId`/`osmType` and enrich them over time. These are some of the most stable
venues in the corpus (libraries, universities, well-known music venues), so
they're high-value targets for OSM enrichment.

### Stale-ID detection
OSM features can be split, merged, or deleted upstream. Today we never
re-verify a stored `osmId`/`osmType` — a 404 will silently sit in our
data until someone notices. Add a low-priority periodic check (monthly?)
that hits Nominatim's `/lookup` with the stored id and drops + re-resolves
on miss. Keep it off the critical path; a stale id is degraded UX, not a
broken build.
