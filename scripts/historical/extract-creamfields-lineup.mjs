#!/usr/bin/env node
// extract-creamfields-lineup.mjs — a past Creamfields edition's own Lineup page
// (creamfields-lineup.mjs, 2022 onwards), read from the Wayback Machine, as a
// LINEUP: who plays which stage on which day. No times.
//
//   node scripts/historical/extract-creamfields-lineup.mjs creamfields-2022 …
//
// A capture proves the edition by its days: exactly the edition's weekdays, in
// order, and where the page prints dates (2024 on: "22nd August 2024"),
// exactly the edition's dates. 2022 prints weekdays and "AUGUST 2022" only;
// its title names the year. Every year's dates must also be the run the
// census's dated post-event report gives (data/historical/census/
// coverage-2010-2026.tsv), recorded in the ledger as `datesFrom` and checked
// against the census by the test.
//
// As in extract-creamfields.mjs, the LATEST valid capture up to WINDOW_DAYS
// after the last day is used, and the others are diffed against it.
//
// Writes data/historical/sheets/<id>.lineup.tsv and data/historical/ledger/<id>.json.

import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { listCaptures, fetchCapture, RELAY } from "./wayback.mjs";
import { EDITIONS } from "./editions.mjs";
import { parseCreamfieldsLineup, creamfieldsLineupRows } from "./creamfields-lineup.mjs";
import { CENSUS, WINDOW_DAYS, censusRow, runDates, sheetRows } from "./extract-creamfields.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
export const CREAMFIELDS_LINEUP_URL = "https://creamfields.com/lineup/";
export const CREAMFIELDS_LINEUP_EDITIONS = ["creamfields-2022", "creamfields-2024", "creamfields-2025"];

// A letter from another script the page typed in place of the artist's own
// Latin letter: 2025's "Obskϋr" has Greek ϋ (U+03CB) where the artist's name,
// and Creamfields 2022's own page, has Latin ü. It renders alike but would
// split the artist across editions, so it is billed in Latin and recorded in
// the ledger as `respelled`.
export const RESPELLED = { "creamfields-2025": { "Obsk\u03cbr": "Obsk\u00fcr" } };

const stamp = d => d.replace(/-/g, "");
const addDays = (date, n) => { const t = new Date(date + "T12:00:00Z"); t.setUTCDate(t.getUTCDate() + n); return t.toISOString().slice(0, 10); };

export async function extract(id) {
  const ed = EDITIONS[id];
  if (!ed || !CREAMFIELDS_LINEUP_EDITIONS.includes(id)) throw new Error(`unknown Creamfields lineup edition ${id}`);
  const census = censusRow(ed.festivalId, ed.year);
  const datesFrom = census && { census: CENSUS, family: census.family, year: ed.year, lifecycle: census.lifecycle, dates: census.dates, evidence: census.evidence_url, published: census.published };
  const weekdays = ed.dates.map(([, w]) => w), dates = ed.dates.map(([d]) => d);
  const until = addDays(dates.at(-1), WINDOW_DAYS);
  const caps = (await listCaptures(CREAMFIELDS_LINEUP_URL.replace(/^https?:\/\//, ""), `${ed.year}0101`, `${ed.year}1231`))
    .filter(c => c.timestamp.slice(0, 8) <= stamp(until));
  const considered = [];
  for (const c of caps) {
    let got;
    try { got = await fetchCapture(c.timestamp, CREAMFIELDS_LINEUP_URL); } catch (e) {
      if (!RELAY) throw e;
      considered.push({ captureTimestamp: c.timestamp, notFiled: e.message, valid: false, billings: 0 });
      continue;
    }
    let page, why;
    try { page = parseCreamfieldsLineup(got.text, { year: ed.year }); } catch (e) { why = e.message; }
    const days = page ? page.days.map(d => d.weekday) : [];
    const printedDates = page && page.days.some(d => d.date) ? page.days.map(d => d.date) : null;
    const dated = !!page && JSON.stringify(days) === JSON.stringify(weekdays) && (!printedDates || JSON.stringify(printedDates) === JSON.stringify(dates));
    const out = dated ? creamfieldsLineupRows(page) : null;
    considered.push({ captureTimestamp: got.captureTimestamp, archivedUrl: got.archivedUrl, sha256: got.sha256, bytes: got.bytes,
      ...(got.via ? { via: got.via } : {}), title: page?.title ?? null, days, printedDates, dated, valid: dated, ...(why && { unread: why }),
      billings: out ? new Set(out.rows.map(r => r.artist)).size : 0, out });
  }
  const ledger = { id, method: "official_lineup_html", official: CREAMFIELDS_LINEUP_URL, format: "creamfields-lineup", window: { until, why: `captures more than ${WINDOW_DAYS} days after the last day show the next edition` } };
  const strip = ({ out, ...c }) => c;
  if (!census || census.lifecycle !== "occurred" || JSON.stringify(runDates(census.range)) !== JSON.stringify(dates))
    return { ledger: { ...ledger, blocked: `the census's ${ed.year} run (${census?.dates}) is not the edition's dates`, considered: considered.map(strip) }, rows: [] };
  const valid = considered.filter(c => c.valid && c.billings);
  if (!valid.length) return { ledger: { ...ledger, blocked: `no ${ed.year} capture of ${CREAMFIELDS_LINEUP_URL} proves the edition`, considered: considered.map(strip) }, rows: [] };
  const chosen = valid.at(-1);
  const laterUnfiled = considered.filter(c => c.notFiled && c.captureTimestamp > chosen.captureTimestamp);
  if (laterUnfiled.length) return { ledger: { ...ledger, blocked: `relay did not file ${laterUnfiled.map(c => c.captureTimestamp).join(", ")}`, considered: considered.map(strip) }, rows: [] };
  const names = c => new Set(c.out.rows.map(r => r.artist));
  const diff = c => { const a = names(chosen), b = names(c); return [...[...a].filter(x => !b.has(x)).map(x => `added by the final: ${x}`), ...[...b].filter(x => !a.has(x)).map(x => `removed by the final: ${x}`)]; };
  const fixes = RESPELLED[id] || {}, respelled = [];
  for (const [printed, billedAs] of Object.entries(fixes)) {
    if (!chosen.out.rows.some(r => r.artist === printed)) throw new Error(`${id}: "${printed}" is not on the chosen page`);
    respelled.push({ printed, billedAs, why: "a letter from another script typed in place of the artist's own Latin letter" });
  }
  const rows = sheetRows(chosen.out.rows.map(r => ({ ...r, artist: fixes[r.artist] ?? r.artist })), id);
  const o = chosen.out;
  Object.assign(ledger, {
    chosen: chosen.captureTimestamp, archivedUrl: chosen.archivedUrl, sha256: chosen.sha256, title: chosen.title,
    ...(chosen.via ? { relayedVia: chosen.via } : {}),
    datesFrom,
    // Stages in the order the page first lists them.
    stageOrder: [...new Set(rows.map(r => r.stage).filter(Boolean))],
    // Stage spellings that differ only in case, billed as one stage.
    folded: o.folded,
    // Acts printed twice in spellings that differ only in case, billed once.
    sameActs: o.sameActs,
    // Look-alike letters from another script, billed in Latin.
    respelled,
    // Names the page's style shows in lower case, billed as shown.
    lowered: o.lowered,
    // "X B2B" then "Y" in one stage's list, billed as one act "X B2B Y".
    joined: o.joined,
    // Lines printed with an act ("SPECIAL GUEST", "LIVE", "Just Added"), not
    // part of its name.
    actLines: o.notes,
    // A stage's subtitle (a host, a sponsor), and silent-disco stages.
    stageNotes: o.stageNotes,
    // Stages whose list ends "+ more": the page never printed the rest.
    unfinished: o.more,
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
  if (!ids.length) { console.error("usage: extract-creamfields-lineup.mjs <edition-id>…"); process.exit(2); }
  for (const id of ids) {
    const { ledger, rows } = await extract(id);
    if (ledger.blocked) { console.log(`✗ ${id}: ${ledger.blocked}`); for (const c of ledger.considered) console.log(`   ${c.captureTimestamp} dated=${c.dated} ${c.unread || c.notFiled || c.days?.join(" | ")}`); continue; }
    console.log(`▸ ${id} @${ledger.chosen}: ${new Set(rows.map(r => r.artist)).size} billings · ${rows.length} rows · ${ledger.stageOrder.length} stages · ${ledger.unfinished.length} unfinished`);
    for (const c of ledger.considered) console.log(`   ${c.captureTimestamp} valid=${c.valid} billings=${c.billings}${c.unread ? ` (${c.unread})` : ""}${c.diffVsChosen ? ` diffs=${c.diffVsChosen.length}` : ""}`);
  }
}
