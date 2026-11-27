#!/usr/bin/env node
// extract-lollabr-lineup.mjs — a past Lollapalooza Brasil edition's official
// lineup page (lollabr-lineup.mjs), read from the Wayback Machine. The edition
// is lineup_only: who played each day, and on which stage where the page
// prints one. The 2017 and 2019 grids print set times too; they are not kept.
//
//   node scripts/historical/extract-lollabr-lineup.mjs lollapalooza-brasil-2019
//
// Every capture of the edition's page from 1 January of its year to its last
// day is listed, so the lineup is the one the site printed closest before
// (or during) the festival; the LATEST capture that proves the edition is
// used and the others are diffed against it. A capture proves the edition
// when the page's own dates (the site header's run, the grid's dated tabs,
// or the cards' day titles) are exactly the edition's days.
//
// Writes data/historical/sheets/<id>.lineup.tsv and data/historical/ledger/<id>.json.

import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { listCaptures, fetchCapture, RELAY } from "./wayback.mjs";
import { EDITIONS } from "./editions.mjs";
import { READERS } from "./lollabr-lineup.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");

export const LOLLABR_LINEUP_EDITIONS = {
  "lollapalooza-brasil-2014": { url: "http://www.lollapaloozabr.com/2014-line-up-por-dia", format: "por-dia" },
  "lollapalooza-brasil-2015": { url: "http://www.lollapaloozabr.com/line-up-por-dia-2015", format: "por-dia" },
  "lollapalooza-brasil-2016": { url: "http://www.lollapaloozabr.com/lineup-por-dia/", format: "por-dia" },
  "lollapalooza-brasil-2017": { url: "https://www.lollapaloozabr.com/lineup-horarios/", format: "grid" },
  "lollapalooza-brasil-2018": { url: "https://www.lollapaloozabr.com/lineup/2018-interativo/", format: "cards" },
  "lollapalooza-brasil-2019": { url: "https://www.lollapaloozabr.com/lineup-2019/", format: "grid" },
};

// The capture window: 1 January of the edition's year to its last day.
export const windowOf = ed => [`${ed.year}0101`, ed.dates.at(-1)[0].replace(/-/g, "")];

// One row per act, day and stage, in the page's own order.
export function lollabrRows(page, id) {
  const ed = EDITIONS[id], rows = [];
  for (const d of page.days) {
    const day = ed.dates.findIndex(([x]) => x === d.date) + 1;
    if (!day) throw new Error(`${id}: the page prints ${d.date}, not a day of the edition`);
    for (const a of d.acts) rows.push({ artist: a.artist, day, stage: a.stage });
  }
  return rows;
}

export async function extract(id) {
  const want = LOLLABR_LINEUP_EDITIONS[id], ed = EDITIONS[id];
  if (!want || !ed) throw new Error(`unknown Lollapalooza Brasil lineup edition ${id}`);
  const read = READERS[want.format];
  const caps = await listCaptures(want.url.replace(/^https?:\/\//, ""), ...windowOf(ed));
  const considered = [];
  for (const c of caps) {
    let got;
    try { got = await fetchCapture(c.timestamp, want.url); } catch (e) {
      if (!RELAY) throw e;
      considered.push({ captureTimestamp: c.timestamp, notFiled: e.message, valid: false, billings: 0 });
      continue;
    }
    let page, why;
    try { page = read(got.text, { year: ed.year }); } catch (e) { why = e.message; }
    const days = page ? page.days.map(d => d.label) : [];
    const valid = !!page && JSON.stringify(page.days.map(d => d.date)) === JSON.stringify(ed.dates.map(([d]) => d));
    const rows = valid ? lollabrRows(page, id) : null;
    considered.push({ captureTimestamp: got.captureTimestamp, archivedUrl: got.archivedUrl, sha256: got.sha256, bytes: got.bytes,
      ...(got.via ? { via: got.via } : {}), title: page?.title ?? null, valid, days,
      ...(page && { printed: { dates: page.printed, lists: page.days.map(d => d.heading) } }),
      ...(why && { unread: why }), billings: rows ? new Set(rows.map(r => r.artist)).size : 0, page, rows });
  }
  const ledger = { id, method: "official_lineup_html", format: `lollabr-${want.format}`, official: want.url, window: windowOf(ed) };
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
    // Stages in the order the grid prints its columns; the other formats
    // print no stage.
    stageOrder: chosen.page.stageOrder,
    ...(want.format === "grid" && { timesNotKept: "the grid prints each block's range; a lineup edition keeps no times" }),
    ...(chosen.page.dropped.length && { notRead: chosen.page.dropped }),
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
  if (!ids.length) { console.error("usage: extract-lollabr-lineup.mjs <edition-id>…"); process.exit(2); }
  for (const id of ids) {
    const { ledger, rows } = await extract(id);
    if (ledger.blocked) { console.log(`✗ ${id}: ${ledger.blocked}`); for (const c of ledger.considered) console.log(`   ${c.captureTimestamp} valid=${c.valid} ${c.notFiled || c.unread || c.days?.join(" | ")}`); continue; }
    console.log(`▸ ${id} @${ledger.chosen}: ${new Set(rows.map(r => r.artist)).size} billings · ${rows.length} rows · stages ${ledger.stageOrder.length}`);
    for (const c of ledger.considered) console.log(`   ${c.captureTimestamp} valid=${c.valid} billings=${c.billings}${c.notFiled ? " (not filed)" : ""}${c.diffVsChosen ? ` diffs=${c.diffVsChosen.length}` : ""}`);
  }
}
