# AI Agent Guidelines

This is a data-driven scraper that turns Houston event calendars into `.ics`
feeds + a static web app. Goal: a **simple, strict, robust** static site of
calendar scrapes. Bias toward fewer moving parts.

Read `.kiro/steering.md` for the architecture overview (ripper-based scraping,
config schema, base classes, tag aggregation). Deep dives live in `docs/`.

## Skills (`skills/<name>/SKILL.md`)

Operational procedures. Invoke the matching skill rather than improvising:

- **build-report** — daily build health check; fix errors surfaced in `build-errors.json`.
- **source-discovery** — find, evaluate, and add new Houston event sources.
- **source-from-event** — handle an event poster/description: check coverage, then fix a parse gap or add a source.
- **event-lookup** — fuzzy-search the published `events-index.json` / `venues.json` to answer "is this already covered?".
- **geo-resolver** — resolve geocode misses; fill OSM ids on venues.
- **event-uncertainty-resolver** — resolve unknown event fields (start time, cost, image…) into `event-uncertainty-cache.json`.
- **photo-resolver** / **cost-resolver** — drain the non-fatal `photoGaps` / `costGaps` queues in `build-errors.json`.
- **calendar-verification** — verify recurring / `expectEmpty` sources against live URLs.
- **city-setup** — one-time setup of a fresh template copy (`npm run init-city`).
- **upstream-feature-sync** — (template copies) pull engine features from upstream `prestomation/206events`.

## Before opening a PR: validate fast, locally

Run these before a PR — they're seconds, no network, and catch most mistakes CI
would otherwise find late:

```sh
npm run validate     # parse every source YAML through the Zod schemas + tag-dup check (no fetches)
npm run typecheck
npm run test:all     # calendar tests + web tests (same as CI)
```

When adding/fixing ONE source, build only it (never a full build while iterating):

```sh
ONLY_SOURCE=<name> npm run generate-calendars
```

`ONLY_SOURCE` (comma-separated for several) restricts the build to those
sources, skipping every other fetch/parse plus the new-source gates. The fetch
cache (`docs/fetch-cache.md`) makes each source fetch live at most once.

**When you ADD a source, also run `npm run check-new-sources` before the PR.**
Because `ONLY_SOURCE` *skips the new-source gates*, an `ONLY_SOURCE` build never
fails on a zero-event source — and `validate`/`typecheck`/`test:all` can't know
event counts (they don't fetch). So a brand-new source that produces 0 events
passes every other local check and only fails in CI (which hard-fails: a new
source must produce ≥1 event before merge). `check-new-sources` closes that
gap — it finds the sources you added vs `origin/main`, builds just those, and
fails if any non-`proxy` one yields 0 events. Never open a PR with a new source
you've seen return 0 events; keep it as a candidate (`status: investigating`)
and don't commit the source until it produces events.

## Adding a calendar source

Always follow `skills/source-discovery/SKILL.md` (it has the mandatory
quality-gate checklist). Integration priority:

1. **ICS/iCal feed (best):** add `sources/external/<name>.yaml` with the `icsUrl`.
2. **Built-in platform ripper:** if the site uses a known platform, create only
   a `sources/<name>/ripper.yaml` with `type:` — no `.ts`, no sample data. The
   loader (`lib/config/loader.ts`) maps `type` to `lib/config/<type>.ts`; read
   the top of that file for its config fields.

   | Platform | `type` | Key config |
   |---|---|---|
   | DICE | `dice` | `venueName`, `defaultLocation` |
   | Eventbrite | `eventbrite` | `organizerId`, `defaultLocation` |
   | Squarespace | `squarespace` | see `lib/config/squarespace.ts` |
   | Ticketmaster | `ticketmaster` | see `lib/config/ticketmaster.ts` |
   | AXS | `axs` | `venueId`, `venueSlug`, `venueName`, `venueAddress` |

3. **Custom ripper (last resort):** subclass `HTMLRipper`/`JSONRipper` in
   `sources/<name>/ripper.ts` with a `ripper.test.ts` + `sample-data.*`. Always
   fetch live data first and test against a saved sample.

**Recurring events** (farmers markets, weekly trivia) live one-per-file in
`sources/recurring/<name>.yaml` with a `schedules:` list — see
`.kiro/steering.md` or an existing file for the shape. **Free First Thursday**
museums: see `sources/recurring/free-first-thursday.yaml` and synthesize dated
events in museum rippers that list it vaguely (e.g. `sources/sam/ripper.ts`).

## Hard rules for sources

- **`geo` is required** on every ripper, external calendar, and recurring event:
  either `{lat, lng, label?}` (a fixed venue → appears in `venues.json`) or
  `null` (community/multi-location). No default; the build fails if it's missing.
- **A fixed venue (`geo` set) must carry a neighborhood tag** — at least one tag
  from `city.config.ts` `neighborhoods` (the `Neighborhoods` category). Without
  it the homepage drops the venue into "Citywide". `npm run validate` enforces
  this statically (no build), so it fails before push — not just in CI's
  post-build `check-discovery-api`. If the venue's area isn't listed, add it to
  `city.config.ts`; if the source is genuinely distributed, use `geo: null`.
- **Stable event ids:** `RipperCalendarEvent.id` must derive deterministically
  from source content (e.g. `slug(title)-date`), never from timestamps, indices,
  or randomness — the id is the join key for the uncertainty cache and dedup.
- **Parse methods never return `null`:** return `RipperCalendarEvent | RipperError`
  so TypeScript forces every path to produce an event or a reported error. Do
  dedup/filtering in the caller, not the parse method.
- **Never rename the `name` field** of an existing source — it drives the output
  filename (`external-<name>.ics`); changing it silently drops the deployed URL.
- **`description`** is the website section heading: just the venue/org name for
  rippers (e.g. `"Saint Arnold Brewing"`); a sentence is fine for externals. No
  implementation details.

## Tags

Any string in a source's `tags:` is a valid tag (one `tag-<name>.ics` aggregate
per tag). No central registry — but the build **fails on near-duplicate
spellings** (`"Capitol Hill"` vs `"CapitolHill"`), so search existing tags
first. Neighborhood tags use natural casing (`"The Heights"`); activity tags use
PascalCase (`"FarmersMarket"`). Neighborhoods come from `city.config.ts`, not
`lib/config/tags.ts`. To intentionally remove a calendar URL (e.g. a renamed
tag), add an empty file under `allowed-removals/<filename>`.

## `expectEmpty`

Set `expectEmpty: true` (ripper- or calendar-level) for sources that legitimately
produce 0 events (intermittent venues, seasonal, individual branches). They land
in `expectedEmptyCalendars` instead of being flagged. Do **not** use it to mask a
broken source (404/403/format change) — fix or disable those. A brand-new source
must produce ≥1 event before merge regardless of `expectEmpty`.

## Blocked sources (proxy)

If a source returns HTTP 403 from CI (blocks GitHub Actions IPs), set
`proxy: true` in its YAML — it's then fetched live through Browserbase (executes
JS, bypasses bot detection; needs the `BROWSERBASE_API_KEY` secret). A new
`proxy: true` source that still produces 0 events is non-fatal (it can't be
proven from CI). If Browserbase also fails, set `disabled: true`.

## Caches

- **`geo-cache.json`** — resolved coordinates. Lives in the GitHub Actions Cache;
  the committed file is an empty cold-start baseline. Don't hand-edit it (a cache
  hit overwrites it). Fix geocoding in code: add to `KNOWN_VENUE_COORDS` in
  `lib/geocoder.ts`. See `docs/github-native-caches.md`.
- **`event-uncertainty-cache.json`** — committed file, the single source of truth
  for resolved unknown fields. Edited by the resolver skills via PR. See
  `docs/event-uncertainty.md`.
- **`fetch-cache.json`** — throttles every source to one live fetch per TTL (24h).
  See `docs/fetch-cache.md`.

## Event uncertainty (unparsable per-event fields)

When a field is often missing (start time, cost, image), don't guess a default,
drop the event, or leave it permanently unknown. Either emit an
`UncertaintyError` alongside the event (occasionally-missing, e.g. start time) or
use a gap queue + cache overlay (pervasively-missing, e.g. image/cost). Both
share `event-uncertainty-cache.json` keyed `source:eventId`. Outstanding
uncertainties count toward `totalErrors` but are non-fatal. Full design and the
"add a new resolvable field" checklist: `docs/event-uncertainty.md`.

## Reporting parity

`output/build-errors.json` is the single source of truth for build health; every
surface reads from it (PR comment, build step summary, Discord, web health
dashboard, build-report skill). **When you add an error category/counter, plumb
it through every surface in the same PR** — a missing reporter means it
accumulates silently.

## Discovery API

Every build publishes machine-readable JSON under `output/` (`index.json`,
`tags.json`, `venues.json`, `manifest.json`, `events-index.json`, `llms.txt`,
`sitemap.xml`). Built by `lib/discovery.ts`, validated by
`npm run check-discovery-api`. Source candidates are tracked in
`docs/source-candidates.json` (one array; status `candidate`/`investigating`/
`added`/`disabled`/`notviable`/`dead`); feature ideas in `ideas.md`.

## Development workflow

> Automated review: `.github/workflows/claude-code-review.yml` runs
> automatically on every PR push and posts review comments — there's no trigger
> to send. `claude.yml` answers `@claude` mentions. A template copy without these
> workflows/secret has no auto-reviewer; treat human review as the gate.

**Never push to `main`.** Branch → commit → PR. Before pushing, fetch and rebase
**only if behind**:

```sh
git fetch origin main
[ -n "$(git rev-list HEAD..origin/main)" ] && git rebase origin/main
```

Subscribe to PR activity (`mcp__github__subscribe_pr_activity`). When the review
is clean and CI green: resolve threads, mark ready (`draft: false`), and merge.

**Auto-merge** calendar content (sources, candidate/cache resolutions, ripper
bug fixes, broken-source repairs, docs maintenance). **Require manual merge** for
features, UI, schema/config-shape changes, new infrastructure, new workflows, and
design/plan docs. When unsure, leave it for manual merge.

## Conventions

- Feature designs and non-obvious architecture decisions go in `docs/<feature>.md`
  in the same PR. Once a feature ships, its design doc has done its job — git
  retains it; keep `docs/` to references for live systems.
- Unit tests live beside rippers (`sources/<name>/ripper.test.ts`); built-in
  ripper tests live in `lib/config/`. Vitest. Always test success + failure paths.
