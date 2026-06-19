# Deterministic source-discovery crawler

A normal crawler that replaces the LLM "discovery" phase of the daily source
pipeline. It runs a **fixed** list of web searches, dedups results against what
we already pull from, remembers what it has seen (with backoff), and only wakes
the LLM when it finds genuinely **new** domains.

This lives alongside — and does **not** replace — `claude-sources.yml`. That
workflow is untouched; this is an additional, cheaper path.

## Why

The old discovery agent re-ran the same searches and re-evaluated the same URLs
every morning, spending tokens to rediscover yesterday's findings. Searching,
deduping, and platform-sniffing are mechanical. The only parts that need an LLM
are the human-judgment quality gates (Houston-focused? religious / support-group
/ enrollment-course?) and writing the ripper. So we split them.

## Pieces

| File | Role |
|---|---|
| `discovery/queries.txt` | Fixed query list (was baked into the skill prompt). Rotated by day. |
| `discovery/ignore-domains.txt` | Tunable editorial/aggregator domain blocklist (unioned with a hardcoded core set). Grown by the implement job + humans. |
| `scripts/discovery-crawl.ts` | The crawler. No LLM. Search → dedup → fingerprint → ledger + metrics. |
| `docs/discovery-ledger.json` | Persistent memory of every URL seen, keyed by canonical URL, with a backoff `nextCheckAfter`. |
| `docs/discovery-shortlist.json` | Deterministic, capped, cheapest-first ranking of tier 1-2 candidates — the ONLY thing the implement job reads. |
| `docs/discovery-metrics.jsonl` | Append-only per-run metrics for tuning (hits/query, hits/page, new vs old). |
| `.github/workflows/discovery-crawler.yml` | Job 1 crawls (no LLM); job 2 implements, gated on new items + `run_llm`. |

## Flow

1. **Search.** Brave Web Search API (`BRAVE_API_KEY`, free tier = 1000/month),
   paginated `--pages` deep (`count=20`, `offset` 0–9 → up to 200 results/query),
   throttled to ~1 req/s. Query selection rotates by UTC day so the whole list
   is covered over several days within budget.
2. **Dedup against what we already pull from.** A known-domain index is built by
   scanning every URL in `sources/**.yaml` + `docs/source-candidates.json`. A hit
   whose registrable domain is already known is recorded as `promoted` (parked
   ~10y) and never re-probed. Generic platform hosts (eventbrite.com,
   ticketmaster.com, dice.fm, squarespace.com, google.com, …) are **excluded**
   from that blocklist — many distinct sources share them — and deduped by full
   URL via the ledger instead.
3. **Ignore junk.** Social/review/aggregator hosts (facebook, instagram, yelp,
   …) are recorded `ignored` and never surfaced as candidates.
4. **Ledger + backoff.** New domains land in the ledger as `new`. Optional
   `--probe` does one cheap GET to guess the platform (`squarespace`,
   `eventbrite`, `ics`, `tribe-events-ics`, …) and find an ICS link, moving the
   entry to `probed` or `dead`. Recheck cadence backs off by status: `new` next
   day; `probed` fortnightly; `dead` exponentially (1,2,4…60d); `ignored`
   quarterly; `promoted` ~never.
5. **Metrics.** Each run appends one JSON line with per-query and per-page
   counts, new/old/ignored totals, ledger size, and the list of new domains.
   Tune `queries.txt` and `--pages` from this.
6. **Triage shortlist (anti-poison-pill).** The crawler ranks live candidates
   into a capped, cheapest-first `discovery-shortlist.json` so the implement job
   never wades through the whole ledger or sinks the run on one hard source.
   Tiers: **1** a real feed found (`icsUrl` / `ics` / `tribe-events-ics`),
   **2** config-only built-in platform (squarespace/eventbrite/ticketmaster/
   dice/axs/shopify), **3** reachable-but-unknown, **4** dead/custom/proxy. Only
   tiers 1-2 make the shortlist (3-4 are deferred to humans). Within a tier:
   relevance (`queryHits` = distinct queries that surfaced the domain) then
   recency. The implement job walks it top-to-bottom, gives each candidate ONE
   bounded attempt, stops after `max_sources` successes, and marks tried-and-
   failed entries `rejected` so they never return to a future shortlist.
7. **LLM only on ready stuff.** The crawl job outputs `shortlist_size`; the
   implement job runs only when `shortlist_size > 0` **and** either it's the
   daily schedule (auto-implement) or a manual dispatch opted in via `run_llm`.
   Gating on the shortlist (not raw `new_items`) means the LLM never wakes just
   to triage editorial/junk domains. It reads the shortlist, applies the
   `source-discovery` skill's quality gates, implements the best, and opens one
   human-review PR. The
   crawler never edits `source-candidates.json` itself — it only fills the
   ledger; the LLM promotes ledger entries into real candidates/sources.

## Running locally

```sh
# Dry logic test, no API, no writes:
npm run discovery-crawl -- --mock fixture.json --max-queries 2 --pages 1 --no-write

# Real run (needs BRAVE_API_KEY):
BRAVE_API_KEY=... npm run discovery-crawl -- --max-queries 5 --pages 3 --rotate --probe
```

Flags: `--max-queries N` (0 = all), `--pages N` (1–10), `--rotate` (rotate the
window by day), `--probe` / `--probe-cap N` (fingerprint new domains),
`--no-write` (don't touch ledger/metrics), `--mock <file>` (offline fixture).

## Budget

Default schedule: 5 queries × 3 pages = ~15 searches/day ≈ 450/month, well under
the 1000 free-tier cap, covering all ~23 queries every ~5 days. Raise `pages`
or `max_queries` once metrics show headroom.
