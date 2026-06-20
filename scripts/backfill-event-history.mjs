// One-time seeder for event-history.json: walks the gh-pages deploy history
// (each "Deploy site from <sha>" commit has a manifest.json + events-index.json)
// and records one point per UTC day — the most recent deploy of that day.
//
// Going back further than gh-pages retains isn't possible, so this goes "as far
// back as is convenient". Existing days in event-history.json are preserved
// (live data wins); only missing days are filled. Re-runnable.
//
// Usage: git fetch origin gh-pages, then `node scripts/backfill-event-history.mjs`.

import { readFileSync, writeFileSync, existsSync } from "fs";
import { execFileSync } from "child_process";
import {
  calendarCount,
  eventCount,
  upsertPoint,
  renderSvg,
} from "./event-history-lib.mjs";

const HISTORY = "event-history.json";
const SVG = "docs/event-history.svg";

const REF = process.argv[2] || "origin/gh-pages";

function git(args) {
  return execFileSync("git", args, { encoding: "utf-8", maxBuffer: 256 * 1024 * 1024 });
}

// Deploy commits, newest first: "<hash> <committerDateISO>".
const log = git(["log", "--format=%H%x09%cI", REF]).trim().split("\n");

// Map of UTC day -> first (newest) deploy commit hash we see for that day.
const dayToCommit = new Map();
for (const line of log) {
  const [hash, iso] = line.split("\t");
  if (!hash) continue;
  // Only real site deploys carry both data files; PR-preview commits don't
  // touch the root manifest. We detect by trying to read the files below.
  const day = new Date(iso).toISOString().slice(0, 10);
  if (!dayToCommit.has(day)) dayToCommit.set(day, hash);
}

let history = existsSync(HISTORY)
  ? JSON.parse(readFileSync(HISTORY, "utf-8"))
  : [];
const existingDays = new Set(history.map((p) => p.date));

let added = 0;
for (const [day, hash] of dayToCommit) {
  if (existingDays.has(day)) continue; // live data wins
  let manifest, eventsIndex;
  try {
    manifest = JSON.parse(git(["show", `${hash}:manifest.json`]));
    eventsIndex = JSON.parse(git(["show", `${hash}:events-index.json`]));
  } catch {
    continue; // not a full site deploy (e.g. preview-only commit)
  }
  history = upsertPoint(history, {
    date: day,
    events: eventCount(eventsIndex),
    calendars: calendarCount(manifest),
  });
  added++;
  console.log(`backfilled ${day} from ${hash.slice(0, 8)}`);
}

writeFileSync(HISTORY, JSON.stringify(history, null, 2) + "\n");
writeFileSync(SVG, renderSvg(history) + "\n");
console.log(
  `backfill-event-history: added ${added} day(s); ${history.length} day(s) total.`,
);
