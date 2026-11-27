#!/usr/bin/env node
// extract-awakenings-lineup.mjs — a past Awakenings Festival's own party page
// on the festival's old site (awakenings-lineup.mjs), read from the Wayback
// Machine, as a LINEUP: who played on which area. No times are kept.
//
//   node scripts/historical/extract-awakenings-lineup.mjs awakenings-2012 …
//
// A capture proves the edition by its own header and title: the festival
// itself (not its after-party) on one printed date, which must be the
// edition's one day. Captures are listed from the festival's day to
// WINDOW_DAYS after it (later captures carry the videos and sets added to the
// page afterwards, never a new lineup); the LATEST valid one is used and the
// others are diffed against it. Each act is billed once per area it is
// listed on, the area as the page's tab labels it.
//
// Writes data/historical/sheets/<id>.lineup.tsv and data/historical/ledger/<id>.json.

import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { listCaptures, fetchCapture, RELAY } from "./wayback.mjs";
import { EDITIONS } from "./editions.mjs";
import { parseAwakeningsLineup, awakeningsRows } from "./awakenings-lineup.mjs";
import { censusRow, runDates, CENSUS } from "./extract-creamfields.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
export const WINDOW_DAYS = 120;

// Each edition's own party page on awakenings.nl's 2009-2012 site.
export const AWAKENINGS_EDITIONS = {
  "awakenings-2010": { url: "http://www.awakenings.nl/en/parties/137/awakenings-festival-10-year-anniversary/" },
  "awakenings-2011": { url: "http://www.awakenings.nl/en/parties/147/awakenings-festival/" },
  "awakenings-2012": { url: "http://www.awakenings.nl/en/parties/154/awakenings-festival/" },
};

const stamp = d => d.replace(/-/g, "");
const addDays = (date, n) => { const t = new Date(date + "T12:00:00Z"); t.setUTCDate(t.getUTCDate() + n); return t.toISOString().slice(0, 10); };

export async function extract(id) {
  const want = AWAKENINGS_EDITIONS[id], ed = EDITIONS[id];
  if (!want || !ed) throw new Error(`unknown Awakenings lineup edition ${id}`);
  const last = ed.dates.at(-1)[0], until = addDays(last, WINDOW_DAYS);
  const caps = await listCaptures(want.url.replace(/^https?:\/\//, ""), stamp(ed.dates[0][0]), stamp(until));
  const considered = [];
  for (const c of caps) {
    let got;
    try { got = await fetchCapture(c.timestamp, want.url); } catch (e) {
      if (!RELAY) throw e;
      considered.push({ captureTimestamp: c.timestamp, notFiled: e.message, valid: false, billings: 0 });
      continue;
    }
    let page, why;
    try { page = parseAwakeningsLineup(got.text, { year: ed.year }); } catch (e) { why = e.message; }
    // The page prints one date; it must be the edition's one day.
    const dated = !!page && ed.dates.length === 1 && page.date === ed.dates[0][0];
    const valid = dated;
    const rows = valid ? awakeningsRows(page).map(r => ({ ...r, day: 1 })) : null;
    considered.push({ captureTimestamp: got.captureTimestamp, archivedUrl: got.archivedUrl, sha256: got.sha256, bytes: got.bytes,
      ...(got.via ? { via: got.via } : {}), title: page?.title ?? null, dated, valid, days: page ? [page.label] : [],
      ...(page && { printed: { event: page.event, date: page.printed, place: page.place, hours: page.hours, areas: page.areas.map(a => a.label) } }),
      ...(why && { unread: why }), billings: rows ? new Set(rows.map(r => r.artist)).size : 0, page, rows });
  }
  const ledger = { id, method: "official_lineup_html", official: want.url, format: "awakenings-parties",
    window: { until, why: `the page is read from the festival's day to ${WINDOW_DAYS} days after it` } };
  const strip = ({ page, rows, ...c }) => c;
  // The census's dated post-event report for the year must give the same run.
  const census = censusRow(ed.festivalId, ed.year);
  if (!census || census.lifecycle !== "occurred" || JSON.stringify(runDates(census.range)) !== JSON.stringify(ed.dates.map(([d]) => d)))
    return { ledger: { ...ledger, blocked: `the census's ${ed.year} run (${census?.dates}) is not the edition's dates`, considered: considered.map(strip) }, rows: [] };
  ledger.census = { census: CENSUS, family: census.family, year: ed.year, lifecycle: census.lifecycle, dates: census.dates, evidence: census.evidence_url, published: census.published };
  const valid = considered.filter(c => c.valid && c.billings);
  if (!valid.length) return { ledger: { ...ledger, blocked: `no capture of ${want.url} proves the edition`, considered: considered.map(strip) }, rows: [] };
  const chosen = valid.at(-1);
  const laterUnfiled = considered.filter(c => c.notFiled && c.captureTimestamp > chosen.captureTimestamp);
  if (laterUnfiled.length) return { ledger: { ...ledger, blocked: `relay did not file ${laterUnfiled.map(c => c.captureTimestamp).join(", ")}`, considered: considered.map(strip) }, rows: [] };
  const key = r => `${r.artist}@${r.stage}`;
  const diff = c => { const a = new Set(chosen.rows.map(key)), b = new Set(c.rows.map(key)); return [...[...a].filter(x => !b.has(x)).map(x => `added by the final: ${x}`), ...[...b].filter(x => !a.has(x)).map(x => `removed by the final: ${x}`)]; };
  Object.assign(ledger, {
    chosen: chosen.captureTimestamp, archivedUrl: chosen.archivedUrl, sha256: chosen.sha256, title: chosen.title,
    ...(chosen.via ? { relayedVia: chosen.via } : {}),
    // Areas in the order the page's tabs print them.
    stageOrder: chosen.page.areas.map(a => a.label),
    // The page prints a range for every set; a lineup edition keeps none.
    printedRanges: chosen.page.areas.reduce((n, a) => n + a.acts.length, 0),
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
  if (!ids.length) { console.error("usage: extract-awakenings-lineup.mjs <edition-id>…"); process.exit(2); }
  for (const id of ids) {
    const { ledger, rows } = await extract(id);
    if (ledger.blocked) { console.log(`✗ ${id}: ${ledger.blocked}`); for (const c of ledger.considered) console.log(`   ${c.captureTimestamp} dated=${c.dated} ${c.unread || c.notFiled || c.days?.join(" | ")}`); continue; }
    console.log(`▸ ${id} @${ledger.chosen}: ${new Set(rows.map(r => r.artist)).size} billings · ${rows.length} rows · ${ledger.stageOrder.length} areas`);
    for (const c of ledger.considered) console.log(`   ${c.captureTimestamp} valid=${c.valid} billings=${c.billings}${c.diffVsChosen ? ` diffs=${c.diffVsChosen.length}` : ""}`);
  }
}
