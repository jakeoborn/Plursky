#!/usr/bin/env node
// gather-lolla-cards.mjs — a gather folder (sheet.tsv + receipts.json) for a
// Lollapalooza edition read from its official lineup page's act cards
// (lollapalooza.com/lineup/, 2018 design, format "lolla-cards",
// lolla-lineup.mjs), from the research cache. import-gather.mjs then re-reads
// the page and must agree.
//
//   node scripts/historical/gather-lolla-cards.mjs <edition-id> <out-dir> <official-url> <ts> <url>
//
// Every set a card prints becomes a sheet row, as printed: its start, no end.
// The page prints no end times, so every day it is cited for must be one the
// edition lists as untimed; its rows keep their lineup and stage, and the
// times are dropped on import. A second set by the same act on the same stage
// and day is an excluded repeat (an untimed day lists an act once per stage).

import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { EDITIONS } from "./editions.mjs";
import { fetchCapture } from "./wayback.mjs";
import { parseLollaLineup } from "./lolla-lineup.mjs";

const [id, out, official, ts, url] = process.argv.slice(2);
const ed = EDITIONS[id];
if (!ed || !out || !official || !ts || !url) { console.error("usage: gather-lolla-cards.mjs <edition-id> <out-dir> <official-url> <ts> <url>"); process.exit(2); }
const cap = await fetchCapture(ts, url);
if (cap.captureTimestamp !== ts) throw new Error(`${url}: Wayback served ${cap.captureTimestamp}, not ${ts}`);
const page = parseLollaLineup(cap.text, { year: ed.year });
const ref = `page ${ts}`, rows = [], printed = {};
const repeatNote = "repeat set on an untimed day";
for (const d of page.days) {
  const day = ed.dates.findIndex(([x]) => x === d.date) + 1;
  if (!day) throw new Error(`${url} @${ts}: prints ${d.date}, not a day of ${id}`);
  if (!(ed.untimedDays || []).includes(day)) throw new Error(`${url} @${ts}: the page prints no end times, so day ${day} must be untimed`);
  printed[day] = d.label;
  const seen = new Set();
  for (const x of d.sets) {
    const k = `${x.stage}|${x.artist}`, repeat = seen.has(k);
    seen.add(k);
    rows.push({ day, date: d.date, stage: x.stage, start: x.start, end: "", artist: x.artist, note: repeat ? repeatNote : "" });
  }
}
const missing = ed.dates.filter((_, i) => !printed[i + 1]).map(([d]) => d);
if (missing.length) throw new Error(`${url} @${ts}: does not print ${missing.join(", ")}`);
const exclude = rows.some(r => r.note) ? [{ note: `^${repeatNote}$`, reason: "a second set by the same act on the same stage; the day is untimed, so the act is listed once", repeat: true }] : [];
mkdirSync(out, { recursive: true });
const cols = ["day", "date", "stage", "start", "end", "artist", "source_kind", "source_ref", "note"];
writeFileSync(join(out, "sheet.tsv"), [cols.join("\t"), ...rows.map(r => cols.map(c => c === "source_kind" ? "page" : c === "source_ref" ? ref : r[c] ?? "").join("\t"))].join("\n") + "\n");
const source = { kind: "page", match: ref, url, captureTimestamp: ts, format: "lolla-cards", printed };
writeFileSync(join(out, "receipts.json"), JSON.stringify({ id, official, sources: [source], ...(exclude.length && { exclude }), reviewedAt: new Date().toISOString().slice(0, 10) }, null, 1) + "\n");
console.log(`▸ ${id}: ${rows.length} rows (${rows.filter(r => r.note).length} excluded, ${page.hidden.length} day(s) behind a card's link) → ${out}`);
