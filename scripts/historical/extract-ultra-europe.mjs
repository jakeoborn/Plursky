#!/usr/bin/env node
// extract-ultra-europe.mjs — a past Ultra Europe edition's own Artists page
// (ultra-europe-artists.mjs), read from the Wayback Machine, as a LINEUP: who
// plays which day, and on which stage. No times.
//
//   node scripts/historical/extract-ultra-europe.mjs ultra-europe-2013
//
// The page numbers its days ("Day 1") and its countdown names the opening
// date. A capture proves the edition by its title (the Artists page), by its
// countdown opening on the edition's first day, and by every appearance on a
// day the edition has, or on a day named in OFF_DAYS with the stage that day
// printed. The dates are the run the census's dated post-event report gives
// for that year (data/historical/census/coverage-2010-2026.tsv), recorded in
// the ledger as `datesFrom` and checked against the census by the test.
//
// Every capture in the year up to WINDOW_DAYS after the last day is listed,
// the LATEST valid one is used, and the others are diffed against it.
//
// Only the 2013 site printed a lineup as text. 2014 and 2015 were a script
// app whose archived pages hold no lineup, and from 2016 the lineup and
// set-times pages are poster images (2019 and 2023-2025 are queued for the
// image path in ocr-queue.mjs).
//
// Writes data/historical/sheets/<id>.lineup.tsv and data/historical/ledger/<id>.json.

import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { listCaptures, fetchCapture, RELAY } from "./wayback.mjs";
import { EDITIONS } from "./editions.mjs";
import { parseUltraEuropeArtists } from "./ultra-europe-artists.mjs";
import { censusRow, runDates, CENSUS } from "./extract-creamfields.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
export const WINDOW_DAYS = 7;

export const ULTRA_EUROPE_EDITIONS = {
  // The listing's own spelling of the address (port and all), so the capture
  // filed is the one the CDX named.
  "ultra-europe-2013": { cdx: "ultraeurope.com/artists/", url: "http://ultraeurope.com:80/artists/",
    // The page's Day 3 is Ultra Beach on Hvar, printed as the day after
    // the two Poljud days: a separate event, not a day of this edition.
    offDays: { 3: { stage: "Ultra Beach Main Stage", why: "Ultra Beach on Hvar, a separate event on the page's third day, after the festival's two days at Poljud Stadium" } } },
};

// One row per act, day and stage on the edition's days; the others, on an
// off day, apart. Anything else is null (the capture does not prove the edition).
export function ultraEuropeRows(page, id) {
  const ed = EDITIONS[id], want = ULTRA_EUROPE_EDITIONS[id], rows = [], offDay = [];
  for (const a of page.acts) for (const ap of a.appearances) {
    if (ap.day <= ed.dates.length) { rows.push({ artist: a.artist, day: ap.day, stage: ap.stage }); continue; }
    const off = want.offDays?.[ap.day];
    if (!off || off.stage !== ap.stage) return null;
    offDay.push({ artist: a.artist, day: ap.day, stage: ap.stage });
  }
  return { rows, offDay };
}

const stamp = d => d.replace(/-/g, "");
const addDays = (date, n) => { const t = new Date(date + "T12:00:00Z"); t.setUTCDate(t.getUTCDate() + n); return t.toISOString().slice(0, 10); };

export async function extract(id) {
  const ed = EDITIONS[id], want = ULTRA_EUROPE_EDITIONS[id];
  if (!ed || !want) throw new Error(`unknown Ultra Europe edition ${id}`);
  const census = censusRow(ed.festivalId, ed.year);
  const datesFrom = census && { census: CENSUS, family: census.family, year: ed.year, lifecycle: census.lifecycle, dates: census.dates, evidence: census.evidence_url, published: census.published };
  const until = addDays(ed.dates.at(-1)[0], WINDOW_DAYS);
  const caps = (await listCaptures(want.cdx, `${ed.year}0101`, `${ed.year}1231`)).filter(c => c.timestamp.slice(0, 8) <= stamp(until));
  const considered = [];
  for (const c of caps) {
    if (c.original !== want.url) { considered.push({ captureTimestamp: c.timestamp, original: c.original, valid: false, billings: 0, unread: "another spelling of the address" }); continue; }
    let got;
    try { got = await fetchCapture(c.timestamp, want.url); } catch (e) {
      if (!RELAY) throw e;
      considered.push({ captureTimestamp: c.timestamp, notFiled: e.message, valid: false, billings: 0 });
      continue;
    }
    let page, why;
    try { page = parseUltraEuropeArtists(got.text, { year: ed.year }); } catch (e) { why = e.message; }
    const opens = page?.opens === ed.dates[0][0];
    const out = page && opens ? ultraEuropeRows(page, id) : null;
    const valid = !!out;
    considered.push({ captureTimestamp: got.captureTimestamp, archivedUrl: got.archivedUrl, sha256: got.sha256, bytes: got.bytes,
      ...(got.via ? { via: got.via } : {}), title: page?.title ?? null, countdown: page?.countdown ?? null, opens: page?.opens ?? null,
      days: page ? [...new Set(page.acts.flatMap(a => a.appearances.map(x => x.day)))].sort((a, b) => a - b) : [], valid,
      ...(why && { unread: why }), ...(page && !opens && { unread: `the countdown opens ${page.opens}, not ${ed.dates[0][0]}` }),
      ...(page && opens && !out && { unread: "an appearance on a day the edition does not have" }),
      billings: out ? new Set(out.rows.map(r => r.artist)).size : 0, out });
  }
  const ledger = { id, method: "official_lineup_html", official: want.url, format: "ultra-europe-artists",
    window: { until, why: `the captures closest after the festival; later ones are not considered` } };
  const strip = ({ out, ...c }) => c;
  if (!census || census.lifecycle !== "occurred" || JSON.stringify(runDates(census.range)) !== JSON.stringify(ed.dates.map(([d]) => d)))
    return { ledger: { ...ledger, blocked: `the census's ${ed.year} run (${census?.dates}) is not the edition's dates`, considered: considered.map(strip) }, rows: [] };
  const valid = considered.filter(c => c.valid && c.billings);
  if (!valid.length) return { ledger: { ...ledger, blocked: `no ${ed.year} capture of ${want.url} proves the edition`, considered: considered.map(strip) }, rows: [] };
  const chosen = valid.at(-1);
  const laterUnfiled = considered.filter(c => c.notFiled && c.captureTimestamp > chosen.captureTimestamp);
  if (laterUnfiled.length) return { ledger: { ...ledger, blocked: `relay did not file ${laterUnfiled.map(c => c.captureTimestamp).join(", ")}`, considered: considered.map(strip) }, rows: [] };
  const names = c => new Set(c.out.rows.map(r => r.artist));
  const diff = c => { const a = names(chosen), b = names(c); return [...[...a].filter(x => !b.has(x)).map(x => `added by the final: ${x}`), ...[...b].filter(x => !a.has(x)).map(x => `removed by the final: ${x}`)]; };
  const rows = chosen.out.rows;
  Object.assign(ledger, {
    chosen: chosen.captureTimestamp, archivedUrl: chosen.archivedUrl, sha256: chosen.sha256, title: chosen.title,
    ...(chosen.via ? { relayedVia: chosen.via } : {}),
    datesFrom,
    // Stages in the order the page first lists them.
    stageOrder: [...new Set(rows.map(r => r.stage).filter(Boolean))],
    // Appearances the page printed on a day that is not this edition's.
    offDays: Object.entries(want.offDays || {}).map(([day, o]) => ({ day: +day, stage: o.stage, why: o.why })),
    offDay: chosen.out.offDay,
    considered: considered.map(c => ({ ...strip(c), diffVsChosen: c === chosen || !c.valid ? undefined : diff(c) })),
  });
  const cols = ["artist", "day", "stage"];
  mkdirSync(join(ROOT, "data/historical/sheets"), { recursive: true });
  mkdirSync(join(ROOT, "data/historical/ledger"), { recursive: true });
  writeFileSync(join(ROOT, `data/historical/sheets/${id}.lineup.tsv`), [cols.join("\t"), ...rows.map(r => cols.map(k => r[k]).join("\t"))].join("\n") + "\n");
  writeFileSync(join(ROOT, `data/historical/ledger/${id}.json`), JSON.stringify(ledger, null, 2) + "\n");
  return { ledger, rows };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const ids = process.argv.slice(2);
  if (!ids.length) { console.error("usage: extract-ultra-europe.mjs <edition-id>…"); process.exit(2); }
  for (const id of ids) {
    const { ledger, rows } = await extract(id);
    if (ledger.blocked) { console.log(`✗ ${id}: ${ledger.blocked}`); for (const c of ledger.considered) console.log(`   ${c.captureTimestamp} valid=${c.valid} ${c.unread || c.notFiled || ""}`); continue; }
    console.log(`▸ ${id} @${ledger.chosen}: ${new Set(rows.map(r => r.artist)).size} billings · ${rows.length} rows · ${ledger.stageOrder.length} stages · ${ledger.offDay.length} off-day appearances`);
    for (const c of ledger.considered) console.log(`   ${c.captureTimestamp} valid=${c.valid} billings=${c.billings}${c.diffVsChosen ? ` diffs=${c.diffVsChosen.length}` : ""}${c.notFiled ? " (not filed)" : ""}`);
  }
}
