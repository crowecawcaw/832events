// Shared helpers for the event/calendar history graph shown in the README.
//
// Zero dependencies (plain Node ESM) so the workflow job that commits the
// graph to main needs no `npm ci` — it just runs `node scripts/...`.
//
// The history is a committed JSON array of one point per UTC day:
//   [{ date: "YYYY-MM-DD", events: <int>, calendars: <int> }, ...]
// `update-event-history.mjs` upserts today's point from a fresh build's
// output/; `backfill-event-history.mjs` seeds older days from gh-pages history.

export const EVENTS_COLOR = "#2563eb"; // blue  — left axis
export const CALENDARS_COLOR = "#ea580c"; // orange — right axis

/**
 * Count the calendars a manifest publishes: every per-calendar ICS across
 * rippers, recurring, and external sources (matches what the site lists).
 */
export function calendarCount(manifest) {
  const ripperCals = (manifest.rippers ?? []).reduce(
    (sum, r) => sum + (r.calendars?.length ?? 0),
    0,
  );
  return (
    ripperCals +
    (manifest.recurringCalendars?.length ?? 0) +
    (manifest.externalCalendars?.length ?? 0)
  );
}

/** Event count is simply the length of the events search index. */
export function eventCount(eventsIndex) {
  return Array.isArray(eventsIndex) ? eventsIndex.length : 0;
}

/**
 * Insert or replace the point for `point.date`, keeping the array sorted by
 * date ascending. Same-day rebuilds collapse to one point (last write wins).
 */
export function upsertPoint(history, point) {
  const next = history.filter((p) => p.date !== point.date);
  next.push(point);
  next.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  return next;
}

// --- SVG rendering ----------------------------------------------------------

function niceCeil(v) {
  if (!isFinite(v) || v <= 0) return 1;
  const exp = Math.floor(Math.log10(v));
  const base = Math.pow(10, exp);
  const f = v / base;
  let nf;
  if (f <= 1) nf = 1;
  else if (f <= 2) nf = 2;
  else if (f <= 2.5) nf = 2.5;
  else if (f <= 5) nf = 5;
  else nf = 10;
  return nf * base;
}

const MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

function fmtDate(dateStr) {
  // dateStr is "YYYY-MM-DD"; render "Mon D" in UTC (no Date tz surprises).
  const [, m, d] = dateStr.split("-");
  return `${MONTHS[Number(m) - 1]} ${Number(d)}`;
}

function dayMs(dateStr) {
  return Date.parse(`${dateStr}T00:00:00Z`);
}

function esc(s) {
  return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/**
 * Render a dual-y-axis line chart (events left, calendars right) over a
 * time x-axis as a static, script-free SVG string suitable for embedding in
 * the README. `history` must be the sorted point array.
 */
export function renderSvg(history) {
  const W = 760;
  const H = 340;
  const m = { top: 34, right: 60, bottom: 50, left: 56 };
  const plotW = W - m.left - m.right;
  const plotH = H - m.top - m.bottom;

  const points = history.filter(
    (p) => typeof p.events === "number" && typeof p.calendars === "number",
  );

  if (points.length === 0) {
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" font-family="-apple-system,Segoe UI,Helvetica,Arial,sans-serif"><rect width="${W}" height="${H}" fill="#ffffff"/><text x="${W / 2}" y="${H / 2}" text-anchor="middle" fill="#6b7280" font-size="14">No history yet</text></svg>`;
  }

  const times = points.map((p) => dayMs(p.date));
  const minT = Math.min(...times);
  const maxT = Math.max(...times);
  const spanT = maxT - minT;

  const maxEvents = niceCeil(Math.max(...points.map((p) => p.events)));
  const maxCals = niceCeil(Math.max(...points.map((p) => p.calendars)));

  const x = (t) =>
    spanT === 0 ? m.left + plotW / 2 : m.left + ((t - minT) / spanT) * plotW;
  const yL = (v) => m.top + plotH - (v / maxEvents) * plotH;
  const yR = (v) => m.top + plotH - (v / maxCals) * plotH;

  const lineFor = (yScale, key) =>
    points.map((p) => `${x(dayMs(p.date)).toFixed(1)},${yScale(p[key]).toFixed(1)}`).join(" ");

  const eventsLine = lineFor(yL, "events");
  const calsLine = lineFor(yR, "calendars");

  const parts = [];
  parts.push(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" font-family="-apple-system,Segoe UI,Helvetica,Arial,sans-serif">`,
  );
  parts.push(`<rect width="${W}" height="${H}" fill="#ffffff"/>`);
  parts.push(
    `<text x="${m.left}" y="20" font-size="15" font-weight="600" fill="#111827">Houston event &amp; calendar coverage over time</text>`,
  );

  // Horizontal gridlines + left (events) axis labels.
  const ticks = 4;
  for (let i = 0; i <= ticks; i++) {
    const y = m.top + (plotH * i) / ticks;
    parts.push(
      `<line x1="${m.left}" y1="${y.toFixed(1)}" x2="${m.left + plotW}" y2="${y.toFixed(1)}" stroke="#e5e7eb" stroke-width="1"/>`,
    );
    const evVal = Math.round((maxEvents * (ticks - i)) / ticks);
    const calVal = Math.round((maxCals * (ticks - i)) / ticks);
    parts.push(
      `<text x="${m.left - 8}" y="${(y + 4).toFixed(1)}" font-size="11" text-anchor="end" fill="${EVENTS_COLOR}">${evVal}</text>`,
    );
    parts.push(
      `<text x="${m.left + plotW + 8}" y="${(y + 4).toFixed(1)}" font-size="11" text-anchor="start" fill="${CALENDARS_COLOR}">${calVal}</text>`,
    );
  }

  // X-axis date ticks: up to 6 evenly spaced by time.
  const xtCount = Math.min(6, points.length);
  const seen = new Set();
  for (let i = 0; i < xtCount; i++) {
    const idx =
      xtCount === 1 ? 0 : Math.round((i * (points.length - 1)) / (xtCount - 1));
    if (seen.has(idx)) continue;
    seen.add(idx);
    const p = points[idx];
    const px = x(dayMs(p.date));
    parts.push(
      `<line x1="${px.toFixed(1)}" y1="${m.top + plotH}" x2="${px.toFixed(1)}" y2="${m.top + plotH + 5}" stroke="#9ca3af" stroke-width="1"/>`,
    );
    parts.push(
      `<text x="${px.toFixed(1)}" y="${m.top + plotH + 19}" font-size="11" text-anchor="middle" fill="#6b7280">${esc(fmtDate(p.date))}</text>`,
    );
  }

  // Axis titles.
  parts.push(
    `<text x="14" y="${m.top + plotH / 2}" font-size="11" fill="${EVENTS_COLOR}" text-anchor="middle" transform="rotate(-90 14 ${m.top + plotH / 2})">Events</text>`,
  );
  parts.push(
    `<text x="${W - 12}" y="${m.top + plotH / 2}" font-size="11" fill="${CALENDARS_COLOR}" text-anchor="middle" transform="rotate(90 ${W - 12} ${m.top + plotH / 2})">Calendars</text>`,
  );

  // Series lines.
  parts.push(
    `<polyline fill="none" stroke="${EVENTS_COLOR}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round" points="${eventsLine}"/>`,
  );
  parts.push(
    `<polyline fill="none" stroke="${CALENDARS_COLOR}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round" points="${calsLine}"/>`,
  );

  // Data point dots (only when few points, to avoid clutter).
  if (points.length <= 60) {
    for (const p of points) {
      parts.push(
        `<circle cx="${x(dayMs(p.date)).toFixed(1)}" cy="${yL(p.events).toFixed(1)}" r="2.5" fill="${EVENTS_COLOR}"/>`,
      );
      parts.push(
        `<circle cx="${x(dayMs(p.date)).toFixed(1)}" cy="${yR(p.calendars).toFixed(1)}" r="2.5" fill="${CALENDARS_COLOR}"/>`,
      );
    }
  }

  // Legend (top-right inside plot).
  const lx = m.left + plotW - 150;
  const ly = m.top + 4;
  parts.push(
    `<rect x="${lx - 8}" y="${ly - 12}" width="158" height="40" fill="#ffffff" fill-opacity="0.85" stroke="#e5e7eb" rx="4"/>`,
  );
  parts.push(`<line x1="${lx}" y1="${ly}" x2="${lx + 18}" y2="${ly}" stroke="${EVENTS_COLOR}" stroke-width="2"/>`);
  parts.push(`<text x="${lx + 24}" y="${ly + 4}" font-size="11" fill="#374151">Events</text>`);
  parts.push(`<line x1="${lx}" y1="${ly + 16}" x2="${lx + 18}" y2="${ly + 16}" stroke="${CALENDARS_COLOR}" stroke-width="2"/>`);
  parts.push(`<text x="${lx + 24}" y="${ly + 20}" font-size="11" fill="#374151">Calendars</text>`);

  parts.push("</svg>");
  return parts.join("\n");
}
