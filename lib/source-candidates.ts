/**
 * Source-candidate triage records.
 *
 * Each candidate is one YAML file under `docs/source-candidates/` (filename =
 * `candidateSlug(name).yaml`). This one-file-per-record layout replaces the old
 * single `docs/source-candidates.json` array: two PRs adding different
 * candidates now touch different files, so they never conflict on rebase.
 *
 * Records are hand-/agent-edited via PR. The only code that consumes them is
 * the discovery crawler (URL dedup) and `npm run validate` (schema gate).
 */
import { readdir, readFile } from "fs/promises";
import path from "path";
import YAML from "yaml";
import { z } from "zod";

export const CANDIDATES_DIR = path.join("docs", "source-candidates");

const geoSchema = z
  .object({
    lat: z.number(),
    lng: z.number(),
    label: z.string().optional(),
  })
  .passthrough();

/**
 * Deliberately permissive: `impl` is a heterogeneous, platform-specific bag,
 * `pr` is historically either a PR number or a branch/marker string, and most
 * fields are optional. `.passthrough()` keeps any extra keys a record carries.
 */
export const sourceCandidateSchema = z
  .object({
    name: z.string().min(1),
    status: z.string().min(1),
    url: z.string().optional(),
    platform: z.string().optional(),
    tags: z.array(z.string()).optional(),
    firstSeen: z.string().optional(),
    lastChecked: z.string().optional(),
    pr: z.union([z.string(), z.number()]).optional(),
    notes: z.string().optional(),
    impl: z
      .object({ geo: geoSchema.nullable().optional() })
      .passthrough()
      .optional(),
  })
  .passthrough();

export type SourceCandidate = z.infer<typeof sourceCandidateSchema>;

/**
 * Deterministic filename stem for a candidate, derived from its name. Must be
 * stable so a candidate maps to the same file across edits (the join key for
 * "have we already triaged this?").
 */
export function candidateSlug(name: string): string {
  return (
    name
      .toLowerCase()
      .replace(/['’]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "candidate"
  );
}

/**
 * Load every candidate from `docs/source-candidates/*.yaml`. A missing
 * directory yields an empty list (cold start / template copy). Bad YAML or a
 * schema violation is collected in `problems` (filename-tagged) rather than
 * thrown, so `npm run validate` can report every offender at once and the
 * crawler can keep going on the records that do parse.
 */
export async function loadSourceCandidates(
  dir: string = CANDIDATES_DIR,
): Promise<{ candidates: SourceCandidate[]; problems: string[] }> {
  const problems: string[] = [];
  let files: string[];
  try {
    files = (await readdir(dir)).filter(
      f => f.endsWith(".yaml") || f.endsWith(".yml"),
    );
  } catch (err: any) {
    if (err?.code === "ENOENT") return { candidates: [], problems };
    throw err;
  }
  files.sort();

  const candidates: SourceCandidate[] = [];
  for (const file of files) {
    let parsed: unknown;
    try {
      parsed = YAML.parse(await readFile(path.join(dir, file), "utf8"));
    } catch (e: any) {
      problems.push(`[candidate ${file}] invalid YAML: ${e?.message ?? e}`);
      continue;
    }
    const result = sourceCandidateSchema.safeParse(parsed);
    if (!result.success) {
      const detail = result.error.issues
        .map(i => `${i.path.join(".") || "(root)"}: ${i.message}`)
        .join("; ");
      problems.push(`[candidate ${file}] ${detail}`);
      continue;
    }
    candidates.push(result.data);
  }
  return { candidates, problems };
}
