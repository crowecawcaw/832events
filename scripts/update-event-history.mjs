// Append today's event/calendar counts to event-history.json and regenerate
// docs/event-history.svg (the graph embedded in the README).
//
// Run after a build, against its output/ directory. Used by the
// `update-history` job in .github/workflows/publish_calendars.yml, which then
// commits any change to main. Tolerant by design: if the build produced no
// output (e.g. it failed before writing manifest.json), it logs and exits 0 so
// it never turns a publish run red.

import { readFileSync, writeFileSync, existsSync } from "fs";
import {
  calendarCount,
  eventCount,
  upsertPoint,
  renderSvg,
} from "./event-history-lib.mjs";

const MANIFEST = "output/manifest.json";
const EVENTS_INDEX = "output/events-index.json";
const HISTORY = "event-history.json";
const SVG = "docs/event-history.svg";

if (!existsSync(MANIFEST) || !existsSync(EVENTS_INDEX)) {
  console.log(
    `update-event-history: ${MANIFEST} or ${EVENTS_INDEX} missing — nothing to record. Skipping.`,
  );
  process.exit(0);
}

const manifest = JSON.parse(readFileSync(MANIFEST, "utf-8"));
const eventsIndex = JSON.parse(readFileSync(EVENTS_INDEX, "utf-8"));

const point = {
  date: new Date().toISOString().slice(0, 10), // UTC day
  events: eventCount(eventsIndex),
  calendars: calendarCount(manifest),
};

const history = existsSync(HISTORY)
  ? JSON.parse(readFileSync(HISTORY, "utf-8"))
  : [];

const updated = upsertPoint(history, point);

writeFileSync(HISTORY, JSON.stringify(updated, null, 2) + "\n");
writeFileSync(SVG, renderSvg(updated) + "\n");

console.log(
  `update-event-history: recorded ${point.date} → ${point.events} events, ${point.calendars} calendars (${updated.length} day(s) total).`,
);
