#!/usr/bin/env node
// extract-tml-lineup.mjs — a past Tomorrowland edition's official LINEUP page
// (tomorrowland-lineup.mjs), read from the Wayback Machine, for editions whose
// day timetables were never archived. No times exist, so none are produced.
//
//   node scripts/historical/extract-tml-lineup.mjs tomorrowland-2024
//
// The page's <title> does not name a year ("Line-up - Festival - Tomorrowland"),
// so a capture proves the edition only by its own day headers: the Stages
// tab must print exactly the edition's days, each a weekday and date in its
// year. Like extract-insomniac-lineup.mjs, every capture in the year is
// listed and the LATEST valid one is used; the others are diffed against it.
// Each act is billed once per day and stage the Stages tab prints it on.
//
// Writes data/historical/sheets/<id>.lineup.tsv and data/historical/ledger/<id>.json.

import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { listCaptures, fetchCapture, RELAY } from "./wayback.mjs";
import { EDITIONS } from "./editions.mjs";
import { parseTomorrowlandLineup } from "./tomorrowland-lineup.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");

export const TML_LINEUP_EDITIONS = {
  "tomorrowland-2024": { url: "https://www.tomorrowland.com/en/festival/line-up/stages/friday-19-july-2024", title: "Line-up - Festival - Tomorrowland" },
};

// One row per act, day and stage, in the page's own order.
export function tmlRows(page, id) {
  const ed = EDITIONS[id], rows = [], seen = new Set();
  for (const d of page.days) {
    const day = ed.dates.findIndex(([x]) => x === d.date) + 1;
    for (const s of d.stages) for (const a of s.acts) {
      const k = `${a.name}\t${day}\t${s.stage}`;
      if (!seen.has(k)) { seen.add(k); rows.push({ artist: a.name, day, stage: s.stage }); }
    }
  }
  return rows;
}

export async function extract(id) {
  const want = TML_LINEUP_EDITIONS[id], ed = EDITIONS[id];
  if (!want || !ed) throw new Error(`unknown Tomorrowland lineup edition ${id}`);
  const caps = await listCaptures(want.url.replace(/^https?:\/\//, ""), `${ed.year}0101`, `${ed.year}1231`);
  const considered = [];
  for (const c of caps) {
    let got;
    try { got = await fetchCapture(c.timestamp, want.url); } catch (e) {
      if (!RELAY) throw e;
      considered.push({ captureTimestamp: c.timestamp, notFiled: e.message, valid: false, billings: 0 });
      continue;
    }
    let page, why;
    try { page = parseTomorrowlandLineup(got.text, { year: ed.year }); } catch (e) { why = e.message; }
    const days = page ? page.days.map(d => d.label) : [];
    const dated = !!page && JSON.stringify(page.days.map(d => d.date)) === JSON.stringify(ed.dates.map(([d]) => d));
    const titled = !!page && page.title === want.title;
    const valid = dated && titled;
    const rows = valid ? tmlRows(page, id) : null;
    considered.push({ captureTimestamp: got.captureTimestamp, archivedUrl: got.archivedUrl, sha256: got.sha256, bytes: got.bytes,
      ...(got.via ? { via: got.via } : {}), title: page?.title ?? null, titled, dated, valid, days, ...(why && { unread: why }),
      billings: rows ? new Set(rows.map(r => r.artist)).size : 0, page, rows });
  }
  const ledger = { id, method: "official_lineup_html", official: want.url };
  const strip = ({ page, rows, ...c }) => c;
  const valid = considered.filter(c => c.valid && c.billings);
  if (!valid.length) return { ledger: { ...ledger, blocked: `no ${ed.year} capture of ${want.url} proves the edition`, considered: considered.map(strip) }, rows: [] };
  const chosen = valid.at(-1);
  const laterUnfiled = considered.filter(c => c.notFiled && c.captureTimestamp > chosen.captureTimestamp);
  if (laterUnfiled.length) return { ledger: { ...ledger, blocked: `relay did not file ${laterUnfiled.map(c => c.captureTimestamp).join(", ")}`, considered: considered.map(strip) }, rows: [] };
  const names = c => new Set(c.rows.map(r => r.artist));
  const diff = c => { const a = names(chosen), b = names(c); return [...[...a].filter(x => !b.has(x)).map(x => `added by the final: ${x}`), ...[...b].filter(x => !a.has(x)).map(x => `removed by the final: ${x}`)]; };
  const stageOrder = [...new Set(chosen.page.days.flatMap(d => d.stages.map(s => s.stage)))];
  Object.assign(ledger, {
    chosen: chosen.captureTimestamp, archivedUrl: chosen.archivedUrl, sha256: chosen.sha256, title: chosen.title,
    ...(chosen.via ? { relayedVia: chosen.via } : {}),
    tabs: [`Stages ${chosen.page.days.reduce((n, d) => n + d.stages.reduce((m, s) => m + s.acts.length, 0), 0)}`, `Artists ${chosen.page.artists.length}`],
    stageOrder,
    // The label or act the page names as curating a stage that day: printed,
    // kept here, never a stage or a billing.
    hosts: chosen.page.days.flatMap((d, i) => d.stages.filter(s => s.host).map(s => ({ day: i + 1, stage: s.stage, host: s.host }))),
    crossTab: chosen.page.findings,
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
  if (!ids.length) { console.error("usage: extract-tml-lineup.mjs <edition-id>…"); process.exit(2); }
  for (const id of ids) {
    const { ledger, rows } = await extract(id);
    if (ledger.blocked) { console.log(`✗ ${id}: ${ledger.blocked}`); for (const c of ledger.considered) console.log(`   ${c.captureTimestamp} titled=${c.titled} dated=${c.dated} ${c.unread || c.days?.join(" | ")}`); continue; }
    console.log(`▸ ${id} @${ledger.chosen}: ${new Set(rows.map(r => r.artist)).size} billings · ${rows.length} rows · tabs ${ledger.tabs.join(", ")} · ${ledger.stageOrder.length} stages`);
    for (const c of ledger.considered) console.log(`   ${c.captureTimestamp} valid=${c.valid} billings=${c.billings}${c.diffVsChosen ? ` diffs=${c.diffVsChosen.length}` : ""}`);
    for (const f of ledger.crossTab) console.log(`   ⚑ ${f}`);
  }
}
