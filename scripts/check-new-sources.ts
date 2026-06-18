/**
 * Pre-PR gate for newly-added sources.
 *
 * CI fails the build when a brand-new source produces 0 events — an unproven
 * data pipeline (see the "new source ... has 0 events" gate in
 * lib/calendar_ripper.ts). But that gate only runs in the FULL CI build: the
 * `ONLY_SOURCE` iteration loop the source-discovery skill tells you to use
 * *skips* it ("New-source gates and the deployed-site probe are skipped"), and
 * none of the fast local checks (validate/typecheck/test:all) know event counts
 * — they require a live fetch. So a new zero-event source sails through every
 * local check and only fails after the PR is open (e.g. PR #56: three new
 * sources committed at 0 events each).
 *
 * This script closes that loop locally. It:
 *   1. Finds source config files ADDED on this branch vs origin/main.
 *   2. Builds exactly those sources (ONLY_SOURCE) so each is fetched live once.
 *   3. Fails if any added, non-proxy source produced 0 events — the same rule
 *      CI enforces, but before you push.
 *
 * `proxy: true` sources are exempt (their live Browserbase fetch can't be
 * proven from every environment, mirroring the CI gate). Run before opening a
 * PR that adds a source:  npm run check-new-sources
 */
import { execFileSync, spawnSync } from "child_process";
import { readFileSync } from "fs";
import { RipperLoader } from "../lib/config/loader.js";
import { externalConfigSchema } from "../lib/config/schema.js";
import { loadYamlDir } from "../lib/config/dir-loader.js";

type Kind = "ripper" | "external" | "recurring";

/** First of these refs that exists — origin/main is the real base in CI/sessions. */
function resolveBaseRef(): string | null {
  for (const ref of ["origin/main", "main"]) {
    try {
      execFileSync("git", ["rev-parse", "--verify", "--quiet", ref], { stdio: "pipe" });
      return ref;
    } catch {
      // ref doesn't exist; try the next
    }
  }
  return null;
}

function gitLines(args: string[]): string[] {
  try {
    return execFileSync("git", args, { encoding: "utf8" }).split("\n").map(s => s.trim()).filter(Boolean);
  } catch {
    return [];
  }
}

/** Map an added `sources/...` path to its source name + kind, or null. */
function classify(path: string): { name: string; kind: Kind } | null {
  let m: RegExpMatchArray | null;
  if ((m = path.match(/^sources\/external\/(.+?)\.ya?ml$/))) return { name: m[1], kind: "external" };
  if ((m = path.match(/^sources\/recurring\/(.+?)\.ya?ml$/))) return { name: m[1], kind: "recurring" };
  if ((m = path.match(/^sources\/([^/]+)\//))) {
    if (m[1] !== "external" && m[1] !== "recurring") return { name: m[1], kind: "ripper" };
  }
  return null;
}

/** Event-count calendar entries belonging to a given source, per build naming. */
function calendarsFor(
  src: { name: string; kind: Kind },
  counts: Array<{ name: string; events: number }>,
): Array<{ name: string; events: number }> {
  if (src.kind === "external") return counts.filter(c => c.name === `external-${src.name}`);
  if (src.kind === "recurring") {
    return counts.filter(c => c.name === `recurring-${src.name}` || c.name.startsWith(`recurring-${src.name}-`));
  }
  // Ripper calendars are named `${source}-${calendar}`.
  return counts.filter(c => c.name === src.name || c.name.startsWith(`${src.name}-`));
}

async function main(): Promise<void> {
  const base = resolveBaseRef();
  if (!base) {
    console.log("ℹ check-new-sources: no origin/main or main ref found — skipping (nothing to diff against).");
    return;
  }

  // Added source configs: committed on this branch since the merge-base, plus
  // any not-yet-committed new files (so the check works pre-commit too).
  const added = new Set<string>([
    ...gitLines(["diff", "--diff-filter=A", "--name-only", `${base}...HEAD`, "--", "sources"]),
    ...gitLines(["ls-files", "--others", "--exclude-standard", "--", "sources"]),
  ]);

  const newSources = new Map<string, Kind>();
  for (const path of added) {
    const c = classify(path);
    if (c) newSources.set(c.name, c.kind);
  }

  if (newSources.size === 0) {
    console.log("ℹ check-new-sources: no newly-added sources on this branch — nothing to verify.");
    return;
  }

  // Resolve proxy/disabled flags from the authoritative configs (same loaders
  // validate-config uses). proxy:true sources are exempt from the zero-event
  // gate; disabled sources aren't built, so they're skipped.
  const proxy = new Set<string>();
  const disabled = new Set<string>();
  const [rippers] = await new RipperLoader("sources").loadConfigs();
  for (const r of rippers) {
    if (r.config.proxy) proxy.add(r.config.name);
    if (r.config.disabled) disabled.add(r.config.name);
  }
  try {
    const ext = externalConfigSchema.safeParse(await loadYamlDir("sources/external"));
    if (ext.success) {
      for (const c of ext.data) {
        if (c.proxy) proxy.add(c.name);
        if (c.disabled) disabled.add(c.name);
      }
    }
  } catch {
    // external dir may be unparsable; validate-config reports that separately.
  }

  const names = [...newSources.keys()];
  console.log(`check-new-sources: building ${names.length} newly-added source(s): ${names.join(", ")}\n`);

  // Build exactly the new sources (ONLY_SOURCE). Fetch-cache means each is
  // fetched live at most once; re-runs re-parse the cached body for free.
  const build = spawnSync("npm", ["run", "generate-calendars"], {
    env: { ...process.env, ONLY_SOURCE: names.join(",") },
    stdio: "inherit",
  });
  if (build.status !== 0) {
    console.error("\n❌ check-new-sources: the scoped build failed before event counts could be read. Fix the build errors above.");
    process.exit(1);
  }

  let counts: Array<{ name: string; events: number }>;
  try {
    const be = JSON.parse(readFileSync("output/build-errors.json", "utf8")) as {
      eventCounts?: Array<{ name: string; type: string; events: number }>;
    };
    counts = be.eventCounts ?? [];
  } catch (e) {
    console.error(`\n❌ check-new-sources: could not read output/build-errors.json (${(e as Error).message}).`);
    process.exit(1);
  }

  const failures: string[] = [];
  const warnings: string[] = [];
  for (const [name, kind] of newSources) {
    if (disabled.has(name)) {
      warnings.push(`${name} is disabled — skipped (won't merge until re-enabled and proven).`);
      continue;
    }
    const cals = calendarsFor({ name, kind }, counts);
    const total = cals.reduce((sum, c) => sum + c.events, 0);
    if (total > 0) {
      console.log(`✓ ${name}: ${total} event(s)`);
      continue;
    }
    // 0 events. Two shapes, both unmergeable for a new non-proxy source:
    //   - a calendar was emitted at 0 events (feed returned 200 but nothing), or
    //   - no calendar at all (the live fetch failed / 404 / 403, or the source
    //     'name' doesn't match its config). Either way it's not proven.
    if (proxy.has(name)) {
      warnings.push(`${name} produced 0 events but is proxy:true — exempt (can't be proven outside CI's Browserbase fetch).`);
      continue;
    }
    const detail = cals.length === 0
      ? "no calendar was emitted — the live fetch likely failed (404/403/network), or the source 'name' doesn't match its config"
      : "the feed returned no events";
    failures.push(
      `${name} (${kind}) produced 0 events (${detail}). A brand-new source must produce ≥1 event before ` +
      `merge — CI fails the build on this. Fix the URL/format until it yields events (set proxy:true if it's ` +
      `blocked from this environment), or keep it as a candidate (status "investigating") and don't commit ` +
      `the source. Do NOT use expectEmpty to mask it.`,
    );
  }

  for (const w of warnings) console.log(`⚠ ${w}`);

  if (failures.length > 0) {
    console.error(`\n❌ check-new-sources failed — ${failures.length} new source(s) with 0 events would fail CI:`);
    for (const f of failures) console.error(`   - ${f}`);
    process.exit(1);
  }

  console.log("\n✓ check-new-sources passed — every newly-added source produces events.");
}

main().catch(err => {
  console.error("check-new-sources crashed:", err);
  process.exit(1);
});
