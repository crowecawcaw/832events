# Discovery crawler

A deterministic pre-step of the source pipeline. It runs a fixed set of Brave
web searches, filters out everything we already know about, probes each new
domain for a real calendar feed, and hands the daily source-discovery agent a
small **verified shortlist** — so the agent starts from candidates that are
already checked instead of burning tokens on its own `WebSearch`.

It lives in `scripts/discovery-crawl.ts` and runs as the `crawl` job in
`.github/workflows/source-pipeline.yml`, before the Claude `sources` job.

## The funnel

```
Brave search (discovery/queries.txt, rotated by day)
   │  every result URL
   ▼
dedup by registrable domain
   │  drop if domain ∈ built-in skip list
   │        ∪ sources/**   (already integrated)
   │        ∪ docs/source-candidates/*  (already evaluated)
   ▼
probe each NEW domain (≤3 GETs/domain, up to --probe-cap domains)
   │  fetch page → fingerprint platform → find feed marker
   │  VERIFY: GET the .ics, sniff for BEGIN:VCALENDAR + upcoming DTSTARTs
   │  no marker? try well-known endpoints (/events/?ical=1, tribe, /events.ics)
   ▼
tier + rank → output/discovery-shortlist.json  (artifact, cap 15)
   ▼
Claude `sources` agent works it top-down (STEP 0 in the prompt)
```

## Tiers

The shortlist contains only tier 1 and tier 2. Each item is
`{url, domain, tier, platformGuess, icsUrl, verified, eventCount, upcomingCount, queryHits, title}`.

- **Tier 1 — verified feed.** An `.ics` was found (in the page HTML or at a
  well-known endpoint), fetched, and confirmed to be a real `VCALENDAR` with
  **≥1 upcoming event**. Cheapest, near-certain: usually a one-line
  `sources/external/<name>.yaml` with the `icsUrl`.
- **Tier 2 — config-only platform.** The page fingerprints as a built-in
  platform (Squarespace / Eventbrite / Ticketmaster / DICE / AXS / Shopify) that
  needs only a `ripper.yaml`, no custom code.
- **Tier 3 — reachable but unidentified.** Fetched fine but no feed/platform
  match. *Not* shortlisted (left for a human/agent to investigate), but the
  domain still won't recur once the agent files a `notviable` candidate.
- **Dropped — dead/unreachable**, or a feed link whose `.ics` now returns HTML
  (feed rot): `verified:false` demotes it out of tier 1.

Ranking: tier ascending, then `upcomingCount` descending, then `queryHits`
(distinct queries that surfaced the domain) descending; one entry per domain.

## The verified probe

The key upgrade over the old detect-only crawler is that a claimed feed is
actually fetched and sniffed before it reaches the shortlist:

- `BEGIN:VCALENDAR` must be present, else the item is demoted (catches an "ICS
  endpoint now returns an HTML listing page" regression).
- `BEGIN:VEVENT` occurrences give `eventCount`; `DTSTART` values on or after
  today give `upcomingCount`. Only feeds with upcoming events reach tier 1.
- If the page HTML exposes no feed marker, the probe tries a few **well-known
  endpoints** in order and stops at the first real VCALENDAR:
  `/events/?ical=1`, `/?post_type=tribe_events&ical=1`, `/events.ics`. Total
  network is bounded to **≤3 requests per domain**.

## No state on main (why there's no ledger)

The old crawler committed a ~1 MB ledger + metrics + shortlist to `main` every
day. That is now impossible — `main`'s branch ruleset requires the `build /
build` check on every push, so a bot blob push fails with **GH013** — and it was
redundant. The rebuilt crawler keeps **no state file at all**. Its only memory
is what is already in git:

- **`sources/**` YAML** — every referenced domain = "already integrated".
- **`docs/source-candidates/*.yaml`** — every record's `url` (any status) =
  "already evaluated". When the agent rejects a shortlist item, it writes a
  `status: notviable` candidate; that record is what keeps the next crawl from
  re-surfacing the domain. **This is the entire dedup loop** — one file per
  candidate, so two PRs never conflict on rebase.
- A built-in **skip list** constant in the script (aggregators, ticketing
  platforms, socials, news/TV, tourism listicles) — grown in code, not a data
  file.

The shortlist itself is an **artifact** (`output/` is gitignored), retained 3
days and downloaded by the `sources` job. Nothing is committed.

## Running locally

```sh
BRAVE_API_KEY=... npm run discovery-crawl -- --max-queries 2 --pages 1
```

Flags: `--max-queries N` (0 = all, default 5), `--pages N` (default 3),
`--rotate` (rotate the query window by UTC day — used in CI), `--probe-cap N`
(max domains probed, default 25), `--out PATH` (default
`output/discovery-shortlist.json`).

Without `BRAVE_API_KEY` the script prints a notice, writes an empty shortlist,
and exits 0 — so the pipeline never fails on a missing key and the agent simply
falls back to its own discovery.
