#!/usr/bin/env node
// extract-timewarp-lineup.mjs — a past Time Warp Germany edition's official
// LINEUP page (timewarp-lineup.mjs), read from the Wayback Machine, for
// editions whose timetables were never archived as text. No times exist, so
// none are produced, and the page prints no stage per act, so none is kept.
//
//   node scripts/historical/extract-timewarp-lineup.mjs time-warp-2022
//
// A capture proves the edition by its own header (Germany <yy>, the nights'
// dates in its year) and title ("Lineup <year>"): its nights must be exactly
// the edition's days. Like extract-tml-lineup.mjs, every capture is listed
// (through the year after the edition, because the edition's sub-site stayed
// up after the festival), the LATEST valid one is used, and the others are
// diffed against it. Each act is billed once per night it is listed on.
//
// Writes data/historical/sheets/<id>.lineup.tsv and data/historical/ledger/<id>.json.

import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { listCaptures, fetchCapture, RELAY } from "./wayback.mjs";
import { EDITIONS } from "./editions.mjs";
import { parseTimeWarpLineup } from "./timewarp-lineup.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");

export const TW_LINEUP_EDITIONS = {
  "time-warp-2022": { url: "https://www.time-warp.de/22/lineup", title: "Lineup 2022" },
};

// One row per act and night, in the page's own order.
export function twRows(page, id) {
  const ed = EDITIONS[id], rows = [];
  for (const d of page.days) {
    const day = ed.dates.findIndex(([x]) => x === d.date) + 1;
    for (const a of d.acts) rows.push({ artist: a, day, stage: "" });
  }
  return rows;
}

export async function extract(id) {
  const want = TW_LINEUP_EDITIONS[id], ed = EDITIONS[id];
  if (!want || !ed) throw new Error(`unknown Time Warp lineup edition ${id}`);
  const caps = await listCaptures(want.url.replace(/^https?:\/\//, ""), `${ed.year}0101`, `${ed.year + 1}1231`);
  const considered = [];
  for (const c of caps) {
    let got;
    try { got = await fetchCapture(c.timestamp, want.url); } catch (e) {
      if (!RELAY) throw e;
      considered.push({ captureTimestamp: c.timestamp, notFiled: e.message, valid: false, billings: 0 });
      continue;
    }
    let page, why;
    try { page = parseTimeWarpLineup(got.text, { year: ed.year }); } catch (e) { why = e.message; }
    const days = page ? page.days.map(d => d.label) : [];
    const dated = !!page && JSON.stringify(page.days.map(d => d.date)) === JSON.stringify(ed.dates.map(([d]) => d));
    const titled = !!page && page.title === want.title;
    const valid = dated && titled;
    const rows = valid ? twRows(page, id) : null;
    considered.push({ captureTimestamp: got.captureTimestamp, archivedUrl: got.archivedUrl, sha256: got.sha256, bytes: got.bytes,
      ...(got.via ? { via: got.via } : {}), title: page?.title ?? null, titled, dated, valid, days,
      ...(page && { printed: { edition: page.edition, dates: page.printed, city: page.city, lists: page.days.map(d => d.heading) } }),
      ...(why && { unread: why }), billings: rows ? new Set(rows.map(r => r.artist)).size : 0, page, rows });
  }
  const ledger = { id, method: "official_lineup_html", official: want.url };
  const strip = ({ page, rows, ...c }) => c;
  const valid = considered.filter(c => c.valid && c.billings);
  if (!valid.length) return { ledger: { ...ledger, blocked: `no capture of ${want.url} proves the edition`, considered: considered.map(strip) }, rows: [] };
  const chosen = valid.at(-1);
  const laterUnfiled = considered.filter(c => c.notFiled && c.captureTimestamp > chosen.captureTimestamp);
  if (laterUnfiled.length) return { ledger: { ...ledger, blocked: `relay did not file ${laterUnfiled.map(c => c.captureTimestamp).join(", ")}`, considered: considered.map(strip) }, rows: [] };
  const names = c => new Set(c.rows.map(r => r.artist));
  const diff = c => { const a = names(chosen), b = names(c); return [...[...a].filter(x => !b.has(x)).map(x => `added by the final: ${x}`), ...[...b].filter(x => !a.has(x)).map(x => `removed by the final: ${x}`)]; };
  Object.assign(ledger, {
    chosen: chosen.captureTimestamp, archivedUrl: chosen.archivedUrl, sha256: chosen.sha256, title: chosen.title,
    ...(chosen.via ? { relayedVia: chosen.via } : {}),
    // The page prints no stage for any act.
    stageOrder: [],
    considered: considered.map(c => ({ ...strip(c), diffVsChosen: c === chosen || !c.valid ? undefined : diff(c) })),
  });
  const rows = chosen.rows, cols = ["artist", "day", "stage"];
  mkdirSync(join(ROOT, "data/historical/sheets"), { recursive: true });
  mkdirSync(join(ROOT, "data/historical/ledger"), { recursive: true });
  writeFileSync(join(ROOT, `data/historical/sheets/${id}.lineup.tsv`), [cols.join("\t"), ...rows.map(r => cols.map(k => r[k]).join("\t"))].join("\n") + "\n");
  writeFileSync(join(ROOT, `data/historical/ledger/${id}.json`), JSON.stringify(ledger, null, 2) + "\n");
  return { ledger, rows };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const ids = process.argv.slice(2);
  if (!ids.length) { console.error("usage: extract-timewarp-lineup.mjs <edition-id>…"); process.exit(2); }
  for (const id of ids) {
    const { ledger, rows } = await extract(id);
    if (ledger.blocked) { console.log(`✗ ${id}: ${ledger.blocked}`); for (const c of ledger.considered) console.log(`   ${c.captureTimestamp} titled=${c.titled} dated=${c.dated} ${c.unread || c.days?.join(" | ")}`); continue; }
    console.log(`▸ ${id} @${ledger.chosen}: ${new Set(rows.map(r => r.artist)).size} billings · ${rows.length} rows`);
    for (const c of ledger.considered) console.log(`   ${c.captureTimestamp} valid=${c.valid} billings=${c.billings}${c.diffVsChosen ? ` diffs=${c.diffVsChosen.length}` : ""}`);
  }
}
