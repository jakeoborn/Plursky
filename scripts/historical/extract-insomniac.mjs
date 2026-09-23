#!/usr/bin/env node
// extract-insomniac.mjs — a past edition's official Insomniac-platform
// set-times pages (HARD Summer, EDC Las Vegas), read from the Wayback Machine,
// into an auditable source sheet plus a capture ledger.
//
//   node scripts/historical/extract-insomniac.mjs hard-summer-2025 [edc-las-vegas-2025 …]
//
// For every official day page it lists ALL captures in the edition's window,
// keeps only those whose own day tabs are true of the edition's year (weekday
// + date), and extracts from the LATEST valid capture — the published final.
// Every other valid capture is parsed too and diffed against it, so a set-time
// change between captures is a ledger finding instead of a silent choice.
//
// Writes data/historical/sheets/<id>.tsv and data/historical/ledger/<id>.json.
// Raw HTML stays in the private research cache (see wayback.mjs).

import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { parseDay } from "../fetch-insomniac-settimes.mjs";
import { listCaptures, fetchCapture } from "./wayback.mjs";
import { to24, datedLabel } from "./lib.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");

export const INSOMNIAC_EDITIONS = {
  "hard-summer-2025": { year: 2025, base: "https://www.hardsummer.com/lineup/set-times", days: 2, window: ["20250802", "20251231"] },
  "edc-las-vegas-2025": { year: 2025, base: "https://lasvegas.electricdaisycarnival.com/lineup/set-times", days: 3, window: ["20250516", "20251231"] },
};

// The page's own day tabs: [{ day, label, date|null }].
export function dayTabs(html, year) {
  return [...html.matchAll(/<a href="[^"]*\/set-times\/day-(\d+)\/?"[^>]*>([^<]+)<\/a>/g)]
    .map(m => ({ day: +m[1], label: m[2].trim(), date: datedLabel(m[2].trim(), year) }))
    .filter((t, i, a) => a.findIndex(x => x.day === t.day) === i);
}

// One parsed row → sheet row, printed range preferred over epochs.
export function sheetRow(day, s) {
  let start = s.start, end = s.end, timeSource = "epoch";
  if (s.printed) {
    const [a, b] = s.printed.split(/\s*-\s*/);
    start = to24(a); end = to24(b); timeSource = "printed";
  }
  return { day, stage: s.stage, start: start || "", end: end || "", artist: s.artist, settimeId: s.id, timeSource };
}

const key = r => `${r.settimeId}`;
function diff(a, b) {
  const A = new Map(a.map(r => [key(r), r])), B = new Map(b.map(r => [key(r), r]));
  const out = [];
  for (const [k, r] of A) if (!B.has(k)) out.push(`only in chosen: ${r.artist} ${r.stage} ${r.start}-${r.end}`);
  for (const [k, r] of B) {
    const x = A.get(k);
    if (!x) { out.push(`only in other: ${r.artist} ${r.stage} ${r.start}-${r.end}`); continue; }
    for (const f of ["artist", "stage", "start", "end"]) if (x[f] !== r[f]) out.push(`${x.artist}: ${f} ${r[f]} → ${x[f]}`);
  }
  return out;
}

export async function extract(id) {
  const ed = INSOMNIAC_EDITIONS[id];
  if (!ed) throw new Error(`unknown edition ${id}`);
  const ledger = { id, method: "structured_html", official: ed.base, window: ed.window, days: [] };
  const rows = [];
  for (let d = 1; d <= ed.days; d++) {
    const url = `${ed.base}/day-${d}/`;
    const caps = await listCaptures(url.replace(/^https?:\/\//, ""), ...ed.window);
    const considered = [];
    for (const c of caps) {
      const got = await fetchCapture(c.timestamp, url);
      const tabs = dayTabs(got.text, ed.year);
      const me = tabs.find(t => t.day === d);
      const valid = tabs.length === ed.days && tabs.every(t => t.date);
      const sets = parseDay(got.text).map(s => sheetRow(d, s));
      considered.push({ captureTimestamp: got.captureTimestamp, archivedUrl: got.archivedUrl, sha256: got.sha256,
        bytes: got.bytes, tabs: tabs.map(t => `${t.label}${t.date ? "" : " ✗"}`), date: me?.date || null, valid, rows: sets.length, sets });
    }
    const valid = considered.filter(c => c.valid && c.rows);
    if (!valid.length) {
      ledger.days.push({ day: d, url, blocked: `no capture in ${ed.window.join("–")} proves the ${ed.year} edition`,
        considered: considered.map(({ sets, ...c }) => c) });
      continue;
    }
    const chosen = valid[valid.length - 1];
    const byStage = {};
    for (const s of chosen.sets) byStage[s.stage] = (byStage[s.stage] || 0) + 1;
    ledger.days.push({ day: d, url, date: chosen.date, chosen: chosen.captureTimestamp, archivedUrl: chosen.archivedUrl,
      sha256: chosen.sha256, rows: chosen.rows, stages: byStage,
      considered: considered.map(({ sets, ...c }) => ({ ...c,
        diffVsChosen: c === chosen || !c.valid ? undefined : diff(chosen.sets, sets) })) });
    rows.push(...chosen.sets.map(s => ({ ...s, captureTimestamp: chosen.captureTimestamp })));
  }
  mkdirSync(join(ROOT, "data/historical/sheets"), { recursive: true });
  mkdirSync(join(ROOT, "data/historical/ledger"), { recursive: true });
  const cols = ["day", "stage", "start", "end", "artist", "settimeId", "timeSource", "captureTimestamp"];
  writeFileSync(join(ROOT, `data/historical/sheets/${id}.tsv`),
    [cols.join("\t"), ...rows.map(r => cols.map(c => r[c]).join("\t"))].join("\n") + "\n");
  writeFileSync(join(ROOT, `data/historical/ledger/${id}.json`), JSON.stringify(ledger, null, 2) + "\n");
  return { ledger, rows };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const ids = process.argv.slice(2);
  if (!ids.length) { console.error("usage: extract-insomniac.mjs <edition-id>…"); process.exit(2); }
  for (const id of ids) {
    const { ledger, rows } = await extract(id);
    console.log(`▸ ${id}: ${rows.length} rows`);
    for (const d of ledger.days) {
      if (d.blocked) { console.log(`  ✗ day ${d.day}: ${d.blocked}`); continue; }
      console.log(`  day ${d.day} ${d.date} @${d.chosen}: ${d.rows} rows · ${Object.keys(d.stages).length} stages`);
      for (const c of d.considered) console.log(`     ${c.captureTimestamp} valid=${c.valid} rows=${c.rows} ${c.tabs.join(" | ")}${c.diffVsChosen ? ` diffs=${c.diffVsChosen.length}` : ""}`);
    }
  }
}
