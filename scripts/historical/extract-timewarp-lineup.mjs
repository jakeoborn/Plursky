#!/usr/bin/env node
// extract-timewarp-lineup.mjs — a past Time Warp Germany (Mannheim) edition's
// official LINEUP page (timewarp-lineup.mjs), read from the Wayback Machine,
// for editions whose timetables were never archived as text. No times exist,
// so none are produced, and the page prints no stage per act, so none is kept.
//
//   node scripts/historical/extract-timewarp-lineup.mjs time-warp-2022 …
//
// Each edition names its page, the template it was printed with (`format`)
// and the title it must carry. A capture proves the edition by what it
// prints: the one-page site (2019-2025) by its header (Germany [<yy>], the
// nights' dates in its year, Mannheim); the 2014-2018 site by its event
// menu's Germany night, which it prints only until the festival has happened,
// so those captures are the latest before the night. The 2012-2013 site names
// its year in a heading; 2012's also prints its night, and 2013's is the
// night the census's dated post-event report gives for that year
// (data/historical/census/coverage-2010-2026.tsv: the first day of its
// overnight run), recorded in the ledger as `datesFrom` and checked against
// the census by the test. Its VJs are listed in the ledger (`leftOut`), not
// billed.
//
// One address served several years (germany/line-up served 2014 to 2018), so
// each edition lists captures only in its own `window`: the month before the
// night for a page that stops printing it afterwards, or the weeks after it
// for a page that keeps its header. 2022 keeps the wider default (the
// edition's year and the next), because its /22/ address served only that
// edition. Like extract-tml-lineup.mjs, the LATEST valid capture in the
// window is used, and the others are diffed against it. Each act is billed
// once per night it is listed on.
//
// Writes data/historical/sheets/<id>.lineup.tsv and data/historical/ledger/<id>.json.

import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { listCaptures, fetchCapture, RELAY } from "./wayback.mjs";
import { EDITIONS } from "./editions.mjs";
import { parseTimeWarpLineup, parseTimeWarpClassic, parseTimeWarpMannheim, dayLabel } from "./timewarp-lineup.mjs";
import { censusRow, CENSUS } from "./extract-creamfields.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");

const BEFORE = "the page prints the edition's night only until it has happened: the month before it";
const AFTER = "the page keeps its header after the festival: the weeks after it";
export const TW_LINEUP_EDITIONS = {
  "time-warp-2012": { url: "http://www.time-warp.de/mannheim/line-up/index_eng.html", format: "timewarp-mannheim", title: "Line-Up » Time Warp Mannheim » Time Warp",
    window: { from: "20120401", to: "20120705", why: "the page's earliest capture, three months after the festival; it later moved on to the next edition" } },
  "time-warp-2013": { url: "http://www.time-warp.de/mannheim/line-up/index_eng.html", format: "timewarp-mannheim", title: "Line-Up » Time Warp Mannheim » Time Warp",
    window: { from: "20130307", to: "20130406", why: "the month before the festival, at the address that held 2012's lineup" } },
  "time-warp-2014": { url: "http://www.time-warp.de/germany/line-up/index_ger.html", format: "timewarp-classic", title: "Line-Up", window: { from: "20140306", to: "20140405", why: BEFORE } },
  "time-warp-2015": { url: "http://www.time-warp.de/germany/line-up/index_eng.html", format: "timewarp-classic", title: "Line-Up", window: { from: "20150306", to: "20150405", why: BEFORE } },
  "time-warp-2016": { url: "http://www.time-warp.de/germany/line-up/index_eng.html", format: "timewarp-classic", title: "Line-Up", window: { from: "20160303", to: "20160402", why: BEFORE } },
  // 2017's only capture of the lineup in the month before the festival is
  // the one a newsletter link brought in, with its tracking query.
  "time-warp-2017": { url: "http://www.time-warp.de/germany/line-up?utm_source=e_mail&utm_medium=newsletter&utm_campaign=lineup1", format: "timewarp-classic", title: "Line-Up",
    window: { from: "20170301", to: "20170401", why: BEFORE } },
  "time-warp-2018": { url: "http://www.time-warp.de/germany/line-up/index_eng.html", format: "timewarp-classic", title: "Line-Up", window: { from: "20180308", to: "20180407", why: BEFORE } },
  "time-warp-2019": { url: "https://www.time-warp.de/germany/lineup/index_eng.html", format: "timewarp-subsite", title: "Lineup",
    window: { from: "20190307", to: "20190406", why: "the month before the festival: the address's next capture is from 2021" } },
  "time-warp-2021": { url: "https://www.time-warp.de/21/lineup", format: "timewarp-subsite", title: "Lineup",
    window: { from: "20211001", to: "20211029", why: "the month before the festival: the page was not captured after it" } },
  "time-warp-2022": { url: "https://www.time-warp.de/22/lineup", format: "timewarp-subsite", title: "Lineup 2022" },
  "time-warp-2023": { url: "https://www.time-warp.de/germany/lineup/index_eng.html", format: "timewarp-subsite", title: "Lineup", window: { from: "20230402", to: "20230831", why: AFTER } },
  "time-warp-2024": { url: "https://www.time-warp.de/germany/lineup/index_eng.html", format: "timewarp-subsite", title: "Lineup", window: { from: "20240408", to: "20240630", why: AFTER } },
  "time-warp-2025": { url: "https://www.time-warp.de/germany/mannheim/2025/", format: "timewarp-subsite", title: "Time Warp Germany | Time Warp", window: { from: "20250406", to: "20250430", why: AFTER } },
};

// A page read in its format, as nights with their acts; the 2012-2013 site is
// dated by its own description or, failing that, the census.
export function readPage(text, want, ed, census) {
  if (want.format === "timewarp-subsite") return parseTimeWarpLineup(text, { year: ed.year });
  if (want.format === "timewarp-classic") return parseTimeWarpClassic(text, { year: ed.year });
  if (want.format !== "timewarp-mannheim") throw new Error(`unknown Time Warp format ${want.format}`);
  const p = parseTimeWarpMannheim(text, { year: ed.year });
  const date = p.printedDate || (census?.lifecycle === "occurred" ? census.range[0] : null);
  if (!date) throw new Error(`timewarp-mannheim: the page prints no night and the census has no ${ed.year} run`);
  return { ...p, days: [{ heading: p.sections.join(" + "), label: dayLabel(date), date, acts: p.acts }] };
}

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
  const census = want.format === "timewarp-mannheim" ? censusRow(ed.festivalId, ed.year) : null;
  const { from, to } = want.window || { from: `${ed.year}0101`, to: `${ed.year + 1}1231` };
  const caps = await listCaptures(want.url.replace(/^https?:\/\//, ""), from, to);
  const considered = [];
  for (const c of caps) {
    let got;
    try { got = await fetchCapture(c.timestamp, want.url); } catch (e) {
      if (!RELAY) throw e;
      considered.push({ captureTimestamp: c.timestamp, notFiled: e.message, valid: false, billings: 0 });
      continue;
    }
    let page, why;
    try { page = readPage(got.text, want, ed, census); } catch (e) { why = e.message; }
    const days = page ? page.days.map(d => d.label) : [];
    const dated = !!page && JSON.stringify(page.days.map(d => d.date)) === JSON.stringify(ed.dates.map(([d]) => d));
    const titled = !!page && page.title === want.title;
    const valid = dated && titled;
    const rows = valid ? twRows(page, id) : null;
    considered.push({ captureTimestamp: got.captureTimestamp, archivedUrl: got.archivedUrl, sha256: got.sha256, bytes: got.bytes,
      ...(got.via ? { via: got.via } : {}), title: page?.title ?? null, titled, dated, valid, days,
      ...(page && { printed: want.format === "timewarp-mannheim"
        ? { edition: page.edition, year: page.year, date: page.printedDate, sections: page.sections }
        : { edition: page.edition, dates: page.printed, city: page.city, lists: page.days.map(d => d.heading) } }),
      ...(page?.leftOut?.length && { leftOut: page.leftOut }),
      ...(why && { unread: why }), billings: rows ? new Set(rows.map(r => r.artist)).size : 0, page, rows });
  }
  const ledger = { id, method: "official_lineup_html", official: want.url, format: want.format, ...(want.window && { window: want.window }) };
  const strip = ({ page, rows, ...c }) => c;
  const valid = considered.filter(c => c.valid && c.billings);
  if (!valid.length) return { ledger: { ...ledger, blocked: `no capture of ${want.url} proves the edition`, considered: considered.map(strip) }, rows: [] };
  const chosen = valid.at(-1);
  const laterUnfiled = considered.filter(c => c.notFiled && c.captureTimestamp > chosen.captureTimestamp);
  if (laterUnfiled.length) return { ledger: { ...ledger, blocked: `relay did not file ${laterUnfiled.map(c => c.captureTimestamp).join(", ")}`, considered: considered.map(strip) }, rows: [] };
  const names = c => new Set(c.rows.map(r => r.artist));
  const diff = c => { const a = names(chosen), b = names(c); return [...[...a].filter(x => !b.has(x)).map(x => `added by the final: ${x}`), ...[...b].filter(x => !a.has(x)).map(x => `removed by the final: ${x}`)]; };
  // A 2012-2013 page that prints no night is dated by the census.
  const datesFrom = want.format === "timewarp-mannheim" && !chosen.printed.date
    ? { census: CENSUS, family: census.family, year: ed.year, lifecycle: census.lifecycle, dates: census.dates, evidence: census.evidence_url, published: census.published }
    : null;
  Object.assign(ledger, {
    chosen: chosen.captureTimestamp, archivedUrl: chosen.archivedUrl, sha256: chosen.sha256, title: chosen.title,
    ...(chosen.via ? { relayedVia: chosen.via } : {}),
    ...(datesFrom && { datesFrom }),
    ...(chosen.leftOut && { leftOut: chosen.leftOut }),
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
    if (ledger.blocked) { console.log(`✗ ${id}: ${ledger.blocked}`); for (const c of ledger.considered) console.log(`   ${c.captureTimestamp} titled=${c.titled} dated=${c.dated} ${c.unread || c.notFiled || c.days?.join(" | ")}`); continue; }
    console.log(`▸ ${id} @${ledger.chosen}: ${new Set(rows.map(r => r.artist)).size} billings · ${rows.length} rows`);
    for (const c of ledger.considered) console.log(`   ${c.captureTimestamp} valid=${c.valid} billings=${c.billings}${c.diffVsChosen ? ` diffs=${c.diffVsChosen.length}` : ""}${c.notFiled ? " (not filed)" : ""}`);
  }
}
