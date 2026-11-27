#!/usr/bin/env node
// extract-ef-lineup.mjs — a past Electric Forest edition's own lineup page
// (ef-lineup.mjs), read from the Wayback Machine, for editions whose
// schedules survive only as graphics. The page prints the billed acts and
// nothing else: no day, no stage, no time. The edition is `undated` in
// editions.mjs: no artist carries a day, and a note says so.
//
//   node scripts/historical/extract-ef-lineup.mjs electric-forest-2011 …
//
// A capture proves the edition by its title (and the 2016 template by its
// heading), each naming the year. Its dates are the run the page itself
// prints where it prints one (2011's title, "June 30 - July 3, 2011"), and
// otherwise the run the census's dated post-event report gives for that year
// (data/historical/census/coverage-2010-2026.tsv), recorded in the ledger as
// `datesFrom` and checked against the census by the test.
//
// Every capture of the year is listed, up to and including the first one
// taken after the last day; later ones are not considered. The LATEST valid
// one, which must be that first capture after the festival, is used: the
// lineup as it stood once the festival was over. The others are diffed
// against it.
//
// Writes data/historical/sheets/<id>.lineup.tsv and data/historical/ledger/<id>.json.

import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { listCaptures, fetchCapture, RELAY } from "./wayback.mjs";
import { EDITIONS } from "./editions.mjs";
import { parseEfLineup } from "./ef-lineup.mjs";
import { censusRow, runDates, CENSUS } from "./extract-creamfields.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");

export const EF_LINEUP_EDITIONS = {
  "electric-forest-2011": { url: "http://electricforestfestival.com/lineup/artists" },
  "electric-forest-2016": { url: "http://www.electricforestfestival.com/experience/lineup/" },
};

const stamp = d => d.replace(/-/g, "");

// One row per act, in the page's own order, with no day and no stage.
export const efRows = page => page.acts.map(artist => ({ artist, day: "", stage: "" }));

export async function extract(id) {
  const want = EF_LINEUP_EDITIONS[id], ed = EDITIONS[id];
  if (!want || !ed) throw new Error(`unknown Electric Forest lineup edition ${id}`);
  if (!ed.undated) throw new Error(`${id}: the lineup page prints no days, so the edition must be undated`);
  const dates = ed.dates.map(([d]) => d), last = stamp(dates.at(-1));
  const all = await listCaptures(want.url.replace(/^https?:\/\//, ""), `${ed.year}0101`, `${ed.year}1231`);
  const firstAfter = all.findIndex(c => c.timestamp.slice(0, 8) > last);
  const caps = firstAfter < 0 ? all : all.slice(0, firstAfter + 1);
  const considered = [];
  for (const c of caps) {
    let got;
    try { got = await fetchCapture(c.timestamp, want.url); } catch (e) {
      if (!RELAY) throw e;
      considered.push({ captureTimestamp: c.timestamp, notFiled: e.message, valid: false, billings: 0 });
      continue;
    }
    let page, why;
    try { page = parseEfLineup(got.text, { year: ed.year }); } catch (e) { why = e.message; }
    // A page that prints its run must print exactly the edition's dates.
    const dated = !!page && (page.run === null || JSON.stringify(page.run) === JSON.stringify(dates));
    const valid = dated;
    considered.push({ captureTimestamp: got.captureTimestamp, archivedUrl: got.archivedUrl, sha256: got.sha256, bytes: got.bytes,
      ...(got.via ? { via: got.via } : {}), title: page?.title ?? null, template: page?.template ?? null,
      ...(page?.heading && { heading: page.heading }), printedRun: page?.printed ?? null, dated, valid,
      ...(why && { unread: why }), billings: valid ? page.acts.length : 0, page });
  }
  const ledger = { id, method: "official_lineup_html", official: want.url, format: "ef-lineup",
    window: { until: dates.at(-1), why: "captures after the first one taken after the last day are not considered" } };
  const strip = ({ page, ...c }) => c;
  const valid = considered.filter(c => c.valid && c.billings);
  if (!valid.length) return { ledger: { ...ledger, blocked: `no ${ed.year} capture of ${want.url} proves the edition`, considered: considered.map(strip) }, rows: [] };
  const chosen = valid.at(-1);
  if (chosen.captureTimestamp.slice(0, 8) <= last) {
    const unfiled = considered.find(c => c.notFiled && c.captureTimestamp.slice(0, 8) > last);
    return { ledger: { ...ledger, blocked: unfiled ? `relay did not file ${unfiled.captureTimestamp}` : `no capture taken after ${dates.at(-1)} proves the edition`, considered: considered.map(strip) }, rows: [] };
  }
  // The dates: the page's own run, or else the census's dated run.
  let datesFrom;
  if (chosen.page.run) datesFrom = { page: "title", printed: chosen.page.printed, dates: `${chosen.page.run[0]}..${chosen.page.run.at(-1)}` };
  else {
    const census = censusRow(ed.festivalId, ed.year);
    if (!census || census.lifecycle !== "occurred" || JSON.stringify(runDates(census.range)) !== JSON.stringify(dates))
      return { ledger: { ...ledger, blocked: `the page prints no run and the census's ${ed.year} run (${census?.dates}) is not the edition's dates`, considered: considered.map(strip) }, rows: [] };
    datesFrom = { census: CENSUS, family: census.family, year: ed.year, lifecycle: census.lifecycle, dates: census.dates, evidence: census.evidence_url, published: census.published };
  }
  const names = c => new Set(c.page.acts);
  const diff = c => { const a = names(chosen), b = names(c); return [...[...a].filter(x => !b.has(x)).map(x => `added by the final: ${x}`), ...[...b].filter(x => !a.has(x)).map(x => `removed by the final: ${x}`)]; };
  Object.assign(ledger, {
    chosen: chosen.captureTimestamp, archivedUrl: chosen.archivedUrl, sha256: chosen.sha256, title: chosen.title,
    ...(chosen.via ? { relayedVia: chosen.via } : {}),
    datesFrom,
    // The page prints no stage for any act.
    stageOrder: [],
    considered: considered.map(c => ({ ...strip(c), diffVsChosen: c === chosen || !c.valid ? undefined : diff(c) })),
  });
  const rows = efRows(chosen.page), cols = ["artist", "day", "stage"];
  mkdirSync(join(ROOT, "data/historical/sheets"), { recursive: true });
  mkdirSync(join(ROOT, "data/historical/ledger"), { recursive: true });
  writeFileSync(join(ROOT, `data/historical/sheets/${id}.lineup.tsv`), [cols.join("\t"), ...rows.map(r => cols.map(k => r[k]).join("\t"))].join("\n") + "\n");
  writeFileSync(join(ROOT, `data/historical/ledger/${id}.json`), JSON.stringify(ledger, null, 2) + "\n");
  return { ledger, rows };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const ids = process.argv.slice(2);
  if (!ids.length) { console.error("usage: extract-ef-lineup.mjs <edition-id>…"); process.exit(2); }
  for (const id of ids) {
    const { ledger, rows } = await extract(id);
    if (ledger.blocked) { console.log(`✗ ${id}: ${ledger.blocked}`); for (const c of ledger.considered) console.log(`   ${c.captureTimestamp} dated=${c.dated} ${c.unread || c.notFiled || ""}`); continue; }
    console.log(`▸ ${id} @${ledger.chosen}: ${rows.length} billings · dates from ${ledger.datesFrom.page ? "the page" : "the census"} (${ledger.datesFrom.dates})`);
    for (const c of ledger.considered) console.log(`   ${c.captureTimestamp} valid=${c.valid} billings=${c.billings}${c.diffVsChosen ? ` diffs=${c.diffVsChosen.length}` : ""}${c.notFiled ? " not filed" : ""}`);
  }
}
