/**
 * Fast, no-network config validation. Catches the config mistakes that would
 * otherwise only surface in a full CI build: bad YAML, schema violations
 * (missing `geo`, bad `cost`, unknown ripper `type`), near-duplicate tags.
 *
 * Run before opening a PR:  npm run validate
 *
 * This loads every ripper.yaml, external/*.yaml, and recurring/*.yaml through
 * the same Zod schemas the real build uses, plus the tag near-duplicate check.
 * It performs NO fetches, so it runs in a couple of seconds. Exits non-zero
 * on any problem so it can gate CI cheaply.
 */
import { LocalDate } from "@js-joda/core";
import { RipperLoader } from "../lib/config/loader.js";
import { externalConfigSchema } from "../lib/config/schema.js";
import { loadYamlDir } from "../lib/config/dir-loader.js";
import { RecurringEventProcessor } from "../lib/config/recurring.js";
import { detectTagDuplicates, categoryFor } from "../lib/config/tags.js";

async function main(): Promise<void> {
  const problems: string[] = [];
  const allTags = new Set<string>();

  // 1. Rippers (sources/<name>/ripper.yaml) — schema parse + custom import.
  const loader = new RipperLoader("sources");
  const [rippers, ripperErrors] = await loader.loadConfigs();
  for (const err of ripperErrors) {
    problems.push(`[ripper] ${err.type}: ${err.reason}`);
  }
  for (const r of rippers) {
    r.config.tags?.forEach(t => allTags.add(t));
    r.config.calendars.forEach(c => c.tags?.forEach(t => allTags.add(t)));
  }

  // 2. External ICS feeds (sources/external/*.yaml).
  let externals: Array<{ name: string; geo: unknown; tags?: string[]; disabled?: boolean }> = [];
  try {
    const entries = await loadYamlDir("sources/external");
    const result = externalConfigSchema.safeParse(entries);
    if (!result.success) {
      problems.push(`[external] ${result.error.message}`);
    } else {
      externals = result.data;
      result.data.forEach(c => c.tags?.forEach(t => allTags.add(t)));
    }
  } catch (e: any) {
    problems.push(`[external] ${e?.message ?? e}`);
  }

  // 3. Recurring events (sources/recurring/*.yaml) — schema parse happens
  //    inside generateCalendars().
  try {
    const start = LocalDate.now();
    const recurring = new RecurringEventProcessor("sources/recurring")
      .generateCalendars(start, start.plusMonths(12));
    recurring.forEach(c => c.tags?.forEach(t => allTags.add(t)));
  } catch (e: any) {
    problems.push(`[recurring] ${e?.message ?? e}`);
  }

  // 4. Neighborhood-tag coverage for venues (single-location sources).
  //    Mirrors the post-build rule in scripts/check-discovery-api.ts: every
  //    source that resolves to a fixed venue (non-null `geo`) must carry at
  //    least one registered Neighborhoods tag, otherwise the homepage drops it
  //    into "Citywide" instead of its real area. That rule used to fire ONLY in
  //    CI (it reads output/venues.json, which needs a full build), so a missing
  //    neighborhood tag slipped past `npm run validate`/`typecheck`/`test:all`
  //    and only failed after the PR was open. We enforce it statically here —
  //    no build, no fetch — so the gap is caught before pushing.
  //
  //    Venue grouping below follows lib/discovery.ts buildVenuesJson():
  //    a ripper with ripper-level geo and no per-calendar geo is one venue
  //    (tags = ripper ∪ all calendars); otherwise each calendar that resolves
  //    to a non-null geo is its own venue (tags = ripper ∪ that calendar).
  const hasNeighborhood = (tags: Iterable<string>) =>
    [...tags].some(t => categoryFor(t) === "Neighborhoods");
  const noNeighborhoodMsg = (label: string, tags: string[]) =>
    `[neighborhood] ${label} resolves to a fixed venue (geo set) but has no ` +
    `registered neighborhood tag (tags: ${JSON.stringify(tags)}). Add a tag from ` +
    `TAG_CATEGORIES.Neighborhoods (lib/config/tags.ts) — register a new one if ` +
    `needed — or set geo: null if the source is distributed (not a single venue).`;

  for (const { config } of rippers) {
    const ripperTags = config.tags ?? [];
    const anyCalendarHasOwnGeo = config.calendars.some(
      c => c.geo !== undefined && c.geo !== null,
    );
    if (config.geo && !anyCalendarHasOwnGeo) {
      const tags = [...ripperTags, ...config.calendars.flatMap(c => c.tags ?? [])];
      if (!hasNeighborhood(tags)) problems.push(noNeighborhoodMsg(config.name, tags));
    } else {
      for (const calendar of config.calendars) {
        const resolvedGeo = calendar.geo !== undefined ? calendar.geo : config.geo;
        if (!resolvedGeo) continue;
        const tags = [...ripperTags, ...(calendar.tags ?? [])];
        if (!hasNeighborhood(tags)) {
          problems.push(noNeighborhoodMsg(`${config.name}-${calendar.name}`, tags));
        }
      }
    }
  }
  for (const ext of externals) {
    if (ext.disabled || !ext.geo) continue;
    const tags = ext.tags ?? [];
    if (!hasNeighborhood(tags)) problems.push(noNeighborhoodMsg(`external-${ext.name}`, tags));
  }

  // 5. Tag near-duplicates (divergent ICS URLs, almost always a typo).
  for (const dup of detectTagDuplicates(allTags)) {
    problems.push(`[tags] near-duplicate spellings: ${dup.spellings.join(" / ")}`);
  }

  if (problems.length > 0) {
    console.error(`\n✗ Config validation failed (${problems.length} problem(s)):\n`);
    problems.forEach(p => console.error(`  - ${p}`));
    process.exit(1);
  }
  console.log(`✓ Config valid: ${rippers.length} rippers, ${allTags.size} tags.`);
}

main().catch(err => {
  console.error("validate-config crashed:", err);
  process.exit(1);
});
