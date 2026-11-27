#!/usr/bin/env node
// extract-bottlerock.mjs — a past BottleRock Napa Valley edition's own Artists
// page (bottlerock-artists.mjs), read from the Wayback Machine, as a LINEUP:
// who plays which day. No stages and no times: the page prints neither.
//
//   PLURSKY_WAYBACK_RELAY=1 node scripts/historical/extract-bottlerock.mjs bottlerock-2017 …
//
// Each year has its own address (BOTTLEROCK_PAGES). A capture proves the
// edition by its heading ("<year> Artists"), by its day filter printing
// exactly the edition's weekdays in order (and, where its classes are days of
// the month, as in 2015, each day's own), and by any run the page prints for
// that year ("May 29-31, 2015") being exactly the edition's dates. The dates
// are the run the census's dated post-event report gives for that year
// (data/historical/census/coverage-2010-2026.tsv), recorded in the ledger as
// `datesFrom` and checked against the census by the test, as for Creamfields.
//
// Every capture of the address in the year is listed. The FIRST valid capture
// taken after the last day is read: the lineup as the page left it once the
// festival was over, before later edits (the pages stay up for years, and a
// later footer prints the next edition's run). No capture after the festival
// may be skipped unread: a later one is read only when every earlier one after
// the last day was filed and failed to prove the edition. With no valid
// capture after the festival, the latest one before it is read, and the
// edition must carry a note saying so.
//
// Writes data/historical/sheets/<id>.lineup.tsv and data/historical/ledger/<id>.json.

import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { listCaptures, fetchCapture, RELAY } from "./wayback.mjs";
import { EDITIONS } from "./editions.mjs";
import { parseBottleRockArtists, bottlerockRows } from "./bottlerock-artists.mjs";
import { censusRow, runDates, CENSUS } from "./extract-creamfields.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");

// The Artists page of each year, as the CDX is asked for it. 2013 and 2014
// left only poster images (the /lineup-schedule/2013-artists/ and
// 2014-artists/ pages of 2015 hold one image each), and from 2024 the
// /<year>-lineup/ page is a poster too.
export const BOTTLEROCK_PAGES = {
  2015: "www.bottlerocknapavalley.com/lineup-schedule/artists/",
  2016: "www.bottlerocknapavalley.com/lineup-schedule/2016-artists/",
  2017: "www.bottlerocknapavalley.com/lineup-schedule/2017-artists/",
  2018: "www.bottlerocknapavalley.com/lineup-schedule/2018-artists/",
  2019: "www.bottlerocknapavalley.com/lineup-schedule/2019-artists/",
  2021: "www.bottlerocknapavalley.com/2021-artists/",
  2022: "www.bottlerocknapavalley.com/2022-artists/",
  2023: "www.bottlerocknapavalley.com/2023-artists/",
};
export const BOTTLEROCK_EDITIONS = Object.keys(EDITIONS).filter(id => EDITIONS[id].festivalId === "bottlerock" && BOTTLEROCK_PAGES[EDITIONS[id].year]);

const stamp = d => d.replace(/-/g, "");
const dom = date => +date.slice(8, 10);

// Whether a parsed page is this edition's: null if it is, else why not.
export function editionMismatch(page, id) {
  const ed = EDITIONS[id], weekdays = ed.dates.map(([, w]) => w);
  if (JSON.stringify(page.filter.map(f => f.weekday)) !== JSON.stringify(weekdays))
    return `the day filter prints ${page.filter.map(f => f.weekday).join(", ")}, not ${weekdays.join(", ")}`;
  const off = page.filter.find((f, i) => f.dayOfMonth !== null && f.dayOfMonth !== dom(ed.dates[i][0]));
  if (off) return `the filter's ${off.weekday} is the ${off.dayOfMonth}th, not ${ed.dates[weekdays.indexOf(off.weekday)][0]}`;
  const run = page.runs.find(r => r.year === ed.year && JSON.stringify(r.dates) !== JSON.stringify(ed.dates.map(([d]) => d)));
  if (run) return `the page prints the run "${run.printed}", not the edition's dates`;
  return null;
}

// One row per act and day: the day is the edition day of its weekday.
export const sheetRows = (rows, id) => rows.map(r => ({ artist: r.artist, day: EDITIONS[id].dates.findIndex(([, w]) => w === r.weekday) + 1, stage: "" }));

export async function extract(id) {
  const ed = EDITIONS[id];
  if (!ed || !BOTTLEROCK_EDITIONS.includes(id)) throw new Error(`unknown BottleRock edition ${id}`);
  const page = BOTTLEROCK_PAGES[ed.year], last = stamp(ed.dates.at(-1)[0]);
  const census = censusRow(ed.festivalId, ed.year);
  const datesFrom = census && { census: CENSUS, family: census.family, year: ed.year, lifecycle: census.lifecycle, dates: census.dates, evidence: census.evidence_url, published: census.published };
  const caps = await listCaptures(page, `${ed.year}0101`, `${ed.year}1231`);
  const considered = [];
  for (const c of caps) {
    let got;
    // The listing's own spelling of the address (scheme, port and all), so
    // the capture filed is the one the CDX named.
    try { got = await fetchCapture(c.timestamp, c.original); } catch (e) {
      if (!RELAY) throw e;
      considered.push({ captureTimestamp: c.timestamp, original: c.original, notFiled: e.message, valid: false, billings: 0 });
      continue;
    }
    let parsed, why;
    try { parsed = parseBottleRockArtists(got.text, { year: ed.year }); why = editionMismatch(parsed, id); } catch (e) { why = e.message; }
    const valid = !why, out = valid ? bottlerockRows(parsed) : null;
    considered.push({ captureTimestamp: got.captureTimestamp, original: c.original, archivedUrl: got.archivedUrl, sha256: got.sha256, bytes: got.bytes,
      ...(got.via ? { via: got.via } : {}), title: parsed?.title ?? null, heading: parsed?.heading ?? null,
      filter: parsed?.filter.map(f => f.dayOfMonth === null ? f.weekday : `${f.weekday} ${f.dayOfMonth}`) ?? [],
      runs: parsed?.runs.map(r => r.printed) ?? [], valid, ...(why && { unread: why }),
      billings: out ? new Set(out.rows.map(r => r.artist)).size : 0, out, parsed });
  }
  const ledger = { id, method: "official_lineup_html", official: `https://${page}`, format: "bottlerock-artists",
    window: { from: `${ed.year}0101`, to: `${ed.year}1231`, read: "the first valid capture taken after the last day; else the latest before it" } };
  const strip = ({ out, parsed, ...c }) => c;
  if (!census || census.lifecycle !== "occurred" || JSON.stringify(runDates(census.range)) !== JSON.stringify(ed.dates.map(([d]) => d)))
    return { ledger: { ...ledger, blocked: `the census's ${ed.year} run (${census?.dates}) is not the edition's dates`, considered: considered.map(strip) }, rows: [] };
  const after = considered.filter(c => c.captureTimestamp.slice(0, 8) > last);
  let chosen = after.find(c => c.valid && c.billings);
  const skipped = considered.filter(c => c.notFiled && (chosen ? c.captureTimestamp.slice(0, 8) > last && c.captureTimestamp < chosen.captureTimestamp : c.captureTimestamp.slice(0, 8) > last));
  if (!chosen) chosen = considered.filter(c => c.valid && c.billings && c.captureTimestamp.slice(0, 8) <= last).at(-1);
  if (!chosen) return { ledger: { ...ledger, blocked: `no ${ed.year} capture of ${page} proves the edition`, considered: considered.map(strip) }, rows: [] };
  if (skipped.length) return { ledger: { ...ledger, blocked: `relay did not file ${skipped.map(c => c.captureTimestamp).join(", ")}, taken after the festival before the capture read`, considered: considered.map(strip) }, rows: [] };
  const beforeFestival = chosen.captureTimestamp.slice(0, 8) <= last;
  if (beforeFestival && !(ed.notes || []).some(n => n.source?.includes(`/web/${chosen.captureTimestamp}/`)))
    return { ledger: { ...ledger, blocked: `the capture read (${chosen.captureTimestamp}) predates the festival and the edition has no note saying so`, considered: considered.map(strip) }, rows: [] };
  const names = c => new Set(c.out.rows.map(r => r.artist));
  const diff = c => { const a = names(chosen), b = names(c); return [...[...a].filter(x => !b.has(x)).map(x => `added by the chosen: ${x}`), ...[...b].filter(x => !a.has(x)).map(x => `removed by the chosen: ${x}`)]; };
  const rows = sheetRows(chosen.out.rows, id);
  const printedRun = chosen.parsed.runs.find(r => r.year === ed.year)?.printed ?? null;
  Object.assign(ledger, {
    chosen: chosen.captureTimestamp, archivedUrl: chosen.archivedUrl, sha256: chosen.sha256, title: chosen.title, heading: chosen.heading,
    ...(chosen.via ? { relayedVia: chosen.via } : {}),
    afterFestival: !beforeFestival,
    datesFrom,
    // The edition's run as the page itself printed it, where it did.
    printedRun,
    // Acts the page printed in two blocks on one day, billed once.
    printedTwice: chosen.out.printedTwice,
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
  if (!ids.length) { console.error("usage: extract-bottlerock.mjs <edition-id>…"); process.exit(2); }
  for (const id of ids) {
    const { ledger, rows } = await extract(id);
    if (ledger.blocked) { console.log(`✗ ${id}: ${ledger.blocked}`); for (const c of ledger.considered) console.log(`   ${c.captureTimestamp} valid=${c.valid} ${c.unread || c.notFiled || ""}`); continue; }
    const per = EDITIONS[id].dates.map((_, i) => rows.filter(r => r.day === i + 1).length);
    console.log(`▸ ${id} @${ledger.chosen}: ${new Set(rows.map(r => r.artist)).size} billings · ${rows.length} rows · per day ${per.join("/")} · printed run ${ledger.printedRun ?? "none"}`);
    for (const c of ledger.considered.filter(c => !c.notFiled)) console.log(`   ${c.captureTimestamp} valid=${c.valid} billings=${c.billings}${c.diffVsChosen ? ` diffs=${c.diffVsChosen.length}` : ""}`);
  }
}
