#!/usr/bin/env node
// extract-creamfields.mjs — a past Creamfields edition's own Artists page
// (creamfields-artists.mjs), read from the Wayback Machine, as a LINEUP: who
// plays which day, and on which stage where the page pairs them. No times.
//
//   node scripts/historical/extract-creamfields.mjs creamfields-2017 …
//
// The page names each act's days as weekdays and prints no date. A capture
// proves the edition by its title ("[cinch presents] Creamfields <year> |
// Artists") and by its day filter printing exactly the edition's weekdays.
// The dates are the run the census's dated post-event report gives for that
// year (data/historical/census/coverage-2010-2026.tsv), recorded in the
// ledger as `datesFrom` and checked against the census by the test.
//
// Like extract-tml-lineup.mjs, every capture in the year is listed, the
// LATEST valid one is used, and the others are diffed against it. A week
// after the festival the site moves on to the next edition (Creamfields 2017's
// page was "Creamfields 2018 | Artists" by 4 September 2017), so captures
// taken more than WINDOW_DAYS after the last day are not considered.
//
// Writes data/historical/sheets/<id>.lineup.tsv and data/historical/ledger/<id>.json.

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { listCaptures, fetchCapture, RELAY } from "./wayback.mjs";
import { EDITIONS } from "./editions.mjs";
import { parseCreamfieldsArtists, creamfieldsRows } from "./creamfields-artists.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
export const CENSUS = "data/historical/census/coverage-2010-2026.tsv";
export const CREAMFIELDS_URL = "http://www.creamfields.com/artists";
export const CREAMFIELDS_EDITIONS = ["creamfields-2017", "creamfields-2018", "creamfields-2019", "creamfields-2021"];
export const WINDOW_DAYS = 7;

// The census row for a family and year: { lifecycle, dates: [first, last], evidence_url }.
export function censusRow(family, year, text = readFileSync(join(ROOT, CENSUS), "utf8")) {
  const [head, ...lines] = text.trim().split("\n").map(l => l.split("\t"));
  const row = lines.map(l => Object.fromEntries(head.map((h, i) => [h, l[i] ?? ""]))).find(r => r.family === family && r.year === String(year));
  return row ? { ...row, range: row.dates.split("..") } : null;
}

// Every date from first to last, inclusive.
export function runDates([first, last]) {
  const out = [];
  for (let t = new Date(first + "T12:00:00Z"); t <= new Date(last + "T12:00:00Z"); t.setUTCDate(t.getUTCDate() + 1)) out.push(t.toISOString().slice(0, 10));
  return out;
}

// One row per act, day and stage; the day is the edition day of its weekday.
export function sheetRows(rows, id) {
  const ed = EDITIONS[id];
  return rows.map(r => ({ artist: r.artist, day: ed.dates.findIndex(([, w]) => w === r.weekday) + 1, stage: r.stage }));
}

const stamp = d => d.replace(/-/g, "");
const addDays = (date, n) => { const t = new Date(date + "T12:00:00Z"); t.setUTCDate(t.getUTCDate() + n); return t.toISOString().slice(0, 10); };

export async function extract(id) {
  const ed = EDITIONS[id];
  if (!ed || !CREAMFIELDS_EDITIONS.includes(id)) throw new Error(`unknown Creamfields edition ${id}`);
  const census = censusRow(ed.festivalId, ed.year);
  const datesFrom = census && { census: CENSUS, family: census.family, year: ed.year, lifecycle: census.lifecycle, dates: census.dates, evidence: census.evidence_url, published: census.published };
  const weekdays = ed.dates.map(([, w]) => w);
  const until = addDays(ed.dates.at(-1)[0], WINDOW_DAYS);
  const caps = (await listCaptures(CREAMFIELDS_URL.replace(/^https?:\/\//, ""), `${ed.year}0101`, `${ed.year}1231`))
    .filter(c => c.timestamp.slice(0, 8) <= stamp(until));
  const considered = [];
  for (const c of caps) {
    let got;
    try { got = await fetchCapture(c.timestamp, CREAMFIELDS_URL); } catch (e) {
      if (!RELAY) throw e;
      considered.push({ captureTimestamp: c.timestamp, notFiled: e.message, valid: false, billings: 0 });
      continue;
    }
    let page, why;
    try { page = parseCreamfieldsArtists(got.text, { year: ed.year }); } catch (e) { why = e.message; }
    // The filter's weekdays, in the edition's order, must be exactly its days.
    const days = page ? weekdays.filter(w => page.filter.includes(w)) : [];
    const dated = !!page && page.filter.length === weekdays.length && days.length === weekdays.length;
    const valid = dated;
    const out = valid ? creamfieldsRows(page) : null;
    considered.push({ captureTimestamp: got.captureTimestamp, archivedUrl: got.archivedUrl, sha256: got.sha256, bytes: got.bytes,
      ...(got.via ? { via: got.via } : {}), title: page?.title ?? null, filter: page?.filter ?? [], dated, valid, days, ...(why && { unread: why }),
      billings: out ? new Set(out.rows.map(r => r.artist)).size : 0, out });
  }
  const ledger = { id, method: "official_lineup_html", official: CREAMFIELDS_URL, format: "creamfields-artists", window: { until, why: `captures more than ${WINDOW_DAYS} days after the last day show the next edition` } };
  const strip = ({ out, ...c }) => c;
  if (!census || census.lifecycle !== "occurred" || JSON.stringify(runDates(census.range)) !== JSON.stringify(ed.dates.map(([d]) => d)))
    return { ledger: { ...ledger, blocked: `the census's ${ed.year} run (${census?.dates}) is not the edition's dates`, considered: considered.map(strip) }, rows: [] };
  const valid = considered.filter(c => c.valid && c.billings);
  if (!valid.length) return { ledger: { ...ledger, blocked: `no ${ed.year} capture of ${CREAMFIELDS_URL} proves the edition`, considered: considered.map(strip) }, rows: [] };
  const chosen = valid.at(-1);
  const laterUnfiled = considered.filter(c => c.notFiled && c.captureTimestamp > chosen.captureTimestamp);
  if (laterUnfiled.length) return { ledger: { ...ledger, blocked: `relay did not file ${laterUnfiled.map(c => c.captureTimestamp).join(", ")}`, considered: considered.map(strip) }, rows: [] };
  const names = c => new Set(c.out.rows.map(r => r.artist));
  const diff = c => { const a = names(chosen), b = names(c); return [...[...a].filter(x => !b.has(x)).map(x => `added by the final: ${x}`), ...[...b].filter(x => !a.has(x)).map(x => `removed by the final: ${x}`)]; };
  const rows = sheetRows(chosen.out.rows, id);
  Object.assign(ledger, {
    chosen: chosen.captureTimestamp, archivedUrl: chosen.archivedUrl, sha256: chosen.sha256, title: chosen.title,
    ...(chosen.via ? { relayedVia: chosen.via } : {}),
    datesFrom,
    // Stages in the order the page first lists them.
    stageOrder: [...new Set(rows.map(r => r.stage).filter(Boolean))],
    // Acts on two or more days whose stages the page lists without saying
    // which day each is: billed on each day with no stage.
    unpaired: chosen.out.unpaired,
    // Stage spellings that differ only in case, billed as one stage.
    folded: chosen.out.folded,
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
  if (!ids.length) { console.error("usage: extract-creamfields.mjs <edition-id>…"); process.exit(2); }
  for (const id of ids) {
    const { ledger, rows } = await extract(id);
    if (ledger.blocked) { console.log(`✗ ${id}: ${ledger.blocked}`); for (const c of ledger.considered) console.log(`   ${c.captureTimestamp} dated=${c.dated} ${c.unread || c.notFiled || c.days?.join(" | ")}`); continue; }
    console.log(`▸ ${id} @${ledger.chosen}: ${new Set(rows.map(r => r.artist)).size} billings · ${rows.length} rows · ${ledger.stageOrder.length} stages · ${ledger.unpaired.length} unpaired`);
    for (const c of ledger.considered) console.log(`   ${c.captureTimestamp} valid=${c.valid} billings=${c.billings}${c.diffVsChosen ? ` diffs=${c.diffVsChosen.length}` : ""}`);
  }
}
