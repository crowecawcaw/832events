# Tab-switch responsiveness (web)

**Status: implemented** (this doc describes what actually shipped in this repo).

Reported symptom: once the page has loaded, tapping the **You** or **Map**
bottom-nav tab is noticeably slow. The app is idle, the corpus is settled, and a
single tap still takes long enough to feel broken.

This is a rework of an upstream (`prestomation/206events`) change, scoped down to
the parts that apply to this codebase. See "Not ported" at the bottom for what
was deliberately left out and why.

## Why the taps were slow

All of it lives in the redesigned shell (`web/src/redesign/`):

1. **Every tab switch remounts the entire view.** `.a-content` in `App832.jsx`
   is keyed by the active section (`key={contentKey}`), so switching tabs
   unmounts the previous view's whole subtree and mounts the new one in a single
   synchronous commit. Leaving Discover tears down up to `EVENTS_MODE_CAP` event
   rows plus every channel card; the browser can't paint *anything* — including
   the tapped nav button's active state — until that commit finishes. (The keying
   exists for scroll-position bookkeeping, not by accident; see the
   scroll-restore comment in `App832.jsx`.)
2. **Navigation was an urgent, blocking update.** `go()` called a plain
   `setSection`, so React rendered the whole transition at urgent priority: the
   input handler hogged the main thread and first paint of *any* feedback waited
   for the full render.
3. **The Map tab paid a full Leaflet boot on every visit.** Because the content
   area is keyed, leaving the Map tab unmounted Leaflet entirely. Every re-entry
   re-ran: `MapContainer` init, `isMappable` over the whole events index,
   `groupEvents` over thousands of instances, one `Marker` per group (viewport
   culling was inert on the first render — `bounds` is null until
   `ViewportTracker` reports, so *all* groups rendered), MarkerClusterGroup
   clustering, and tile refetches. Every `useMemo` inside `EventsMap` died with
   the unmount.
4. **One mega-context re-rendered the whole shell.** `App832` rebuilt the `model`
   object literal on every render and passed it through a single context, so any
   parent re-render invalidated every consumer — `TopBar`, `RailNav`,
   `BottomNav`, `FilterPopover` and the persistent desktop `MapPanel`, whose
   `shownCount` memo is a full-index pass that rebuilds `eventKey(e)` (a string
   build) per event whenever its deps shift.

## What shipped

### Interruptible navigation (`startTransition`)

`go()` / `openChannel()` / `openEvent()` / `back()` in `App832.jsx` now wrap
their state changes in `startTransition`, so React renders the heavy view swap at
interruptible transition priority instead of blocking the tap handler until the
commit lands.

Because `section` then only lands once the swap commits, the nav highlight can no
longer read it — it would show no feedback at all until the swap finished, which
is the exact symptom. So `App832` keeps a tiny **urgent mirror**, `navSection`,
set synchronously in `go()`, and `TopBar` / `RailNav` / `BottomNav` highlight off
that. The pressed tab lights up on the next frame; the view swap follows.

Inbound URL navigation (`useUrlState` popstate/hashchange) routes through the
same `go()`, so `navSection` stays in sync with back/forward too.

`startTransition` doesn't shrink the work — it unblocks the feedback. The next
two changes shrink the work.

### Keep the mobile Map tab mounted after its first open

The Map tab's `<MapPanel mobile />` no longer renders inside the keyed
`.a-content`; it renders in a **sibling** `.a-maptab` that shares the same grid
cell. Once first opened it stays mounted for the rest of the session, and leaving
the tab only flips CSS (`.a-maptab--hidden` / `.a-content--maphidden`, both
`display:none`). A return visit becomes a style flip plus the `MapBridge`
ResizeObserver's `invalidateSize()`, not a Leaflet re-boot.

Properties worth knowing:

- **Still lazy.** Nothing mounts for the Map tab until the first visit.
- **The latch is written in an effect, not during render.** A render-phase write
  would survive a *discarded* transition render (tap Map, tap away before it
  commits) and leave a hidden map mounted for a tab that was never shown.
- **Scroll restore is untouched.** The list views keep their keyed `.a-content`
  behaviour; only the map moved out of it.
- **Cost:** the hidden map keeps consuming memory and its markers keep updating
  on corpus/filter changes. Accepted — the desktop layout already keeps a
  persistent always-mounted map. If hidden updates ever show up as jank, gate the
  marker recompute on visibility.

Covered by `web/src/App.test.jsx` → "keeps the mobile Map tab mounted (hidden)
after navigating away", which asserts the lazy-before-first-open state and that
the *same* DOM node is re-shown on return.

### Cheap first marker render

Two independent pieces in `EventsMap.jsx`:

- **Cull before the first `bounds`.** `visibleGroups` used to return *all* groups
  until `ViewportTracker` reported. It now seeds the cull from `INITIAL_BOUNDS`
  (the map always opens framed at the metro clamp box), so far-flung groups never
  enter the first marker build. They appear as soon as the real viewport includes
  them.
- **Defer markers behind the map shell.** The container + tiles commit and paint
  first; the `MarkerClusterGroup` and its markers are gated on a `markersReady`
  flag set in a `startTransition` effect. What a user perceives as "the map
  opened" is tiles first, pins a beat later, and the tap that opened it stays
  responsive.

### Cheaper hot paths, narrower re-render breadth

- `model` is built in `useMemo` with an explicit dep array, so a parent
  (`App.jsx`) re-render with unchanged props no longer invalidates every context
  consumer. The dep array mechanically mirrors the object; stable setters are
  listed anyway so the two stay comparable by eye.
- `eventKey` (`web/src/lib/eventKey.js`) memoizes per event object via a
  `WeakMap`. Index entries are immutable after load and the key is rebuilt
  constantly in whole-index scans (`isMappable`, the map count badge, attribution
  lookups, `matchEvents`), so it is now computed once per object. A `WeakMap`
  keeps GC unaffected when a corpus swap replaces the entries wholesale.

## Deliberately not done here

- **Full shell-context slice split.** Splitting `model` into independent slices
  (nav/UI state vs. derived data vs. handlers) plus memoized chrome components
  touches every consumer. With the changes above in, the remaining breadth of a
  section change may not be worth the churn. Revisit only with a measurement in
  hand.
- **Virtualizing the Discover list.** Separate effort; `EVENTS_MODE_CAP` already
  bounds it.
- **Desktop map-column behaviour.** Already persistent; different cost model.

## Not ported from upstream

The upstream change arrived as a wholesale feature-sync branch that also carried
unrelated Seattle-side work. Left out:

- **`App206.jsx`.** Upstream's app shell has genuinely diverged from this repo's
  `App832.jsx` (lazy `HealthDashboard`, a search-service client, saved searches,
  multiple favorites lists, auth, debug/UAT modes). It is not a rename of
  `App832.jsx`; adding it would leave two competing shells. The perf changes were
  applied to `App832.jsx` instead.
- **The boot-profiling CI harness** (`web/scripts/boot-profile.mjs`,
  `scripts/boot-profile-report.mjs`, `web/scripts/fetch-map-tiles.mjs`, pinned
  map-tile PNGs, `docs/web-boot-profiling-ci.md`). Upstream's plan is written
  around `mapOpen` / `mapReopen` / `youOpen` metrics reported per PR. That harness
  is a *separate* upstream feature with no foundation in this repo (no
  `web/scripts/`, no profiling doc, no workflow step), and importing it means new
  CI infrastructure. Consequence to be honest about: **the changes above are not
  measured here.** They are the same structural fixes, but the "what fixed looks
  like" numbers in upstream's doc do not apply to this deployment.
- **The rest of upstream's `index.css` rewrite** (+889/−421). Only the three
  rules the keep-alive needs were taken (`.a-maptab`, `.a-maptab--hidden`,
  `.a-content--maphidden`); the remainder is unrelated redesign.
- **~160 upstream e2e specs and their screenshot baselines.** They reference UI
  this repo doesn't have (saved searches, lists, weather attribution, a
  `screenshot.js` helper) and Playwright browsers can't be installed in the
  environment this rework was done in, so they could not be run.
  `web/e2e/map-mount.spec.js` in particular asserts `.a-map` has count 0 below
  1024px — an upstream-only change that mounts the persistent desktop column
  only where it's visible, which this repo does not do. Coverage for the
  keep-alive lives in the jsdom test named above instead.
- **Unrelated `EventsMap.jsx` changes** that rode along in the same diff:
  cross-source duplicate suppression (`event.duplicateOf`) and dropping the
  `eventsWithDates` decoration pass. Both are separate upstream features with
  their own semantics and their own required changes in `EventGroupPanel`.
