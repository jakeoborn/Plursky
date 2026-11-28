// untold-artists.mjs — UNTOLD's own Artists page (untold.com/artists, the
// Next.js site from late 2023), read from an archived capture, as a LINEUP:
// who plays which day, and on which stage. No times are kept.
//
// The page is rendered by Next.js, which embeds the data it drew the page
// from in the page itself:
//
//   <script id="__NEXT_DATA__" type="application/json">{ "props": {
//     "pageProps": { "data": { "content": [ … ], "totalElements": 237,
//     "totalPages": 1, … } } } }</script>
//
// one entry per performance, in the page's order:
//
//   "name": "MARTIN GARRIX"                     — the billing, as drawn;
//   "dateLabel": "Ziua 1" (the Romanian page) or "Day 1" (the English one);
//   "performanceDate": 1723122000000           — the festival day it belongs
//     to, an instant at 16:00 Cluj-Napoca time on that day's date;
//   "performanceStage": { "name": "Main", "subheading": "Templul
//     Magicianului", … }                        — the stage.
//
// 2024's entries also carry performanceStartTimestamp and
// performanceEndTimestamp; a lineup keeps none, and they are only counted.
//
// The page is dated by its own entries: every performanceDate is a calendar
// date in Cluj-Napoca (Europe/Bucharest), and its day label's number must be
// that date's place in the edition's run. Nothing is read from the <title>
// ("Artists - Untold Festival", which names no year) beyond checking it.
//
// Throws on anything it cannot confirm: another title, no embedded data, a
// list that is only one page of several, an empty list, an entry with no
// name, no stage, no date or a day label it cannot read, a date outside
// `year`, or two entries with the same label on different dates.

import { slug } from "./lib.mjs";

export const ZONE = "Europe/Bucharest";
export const TITLE = "Artists - Untold Festival";
const LABEL = /^(?:Day|Ziua) ([1-9]\d?)$/;

// An instant (ms) → its calendar date in Cluj-Napoca, "YYYY-MM-DD".
export const zoneDate = ms => new Date(ms).toLocaleDateString("en-CA", { timeZone: ZONE });
const plain = s => String(s).replace(/\s+/g, " ").trim();

export function parseUntoldArtists(html, { year } = {}) {
  const text = String(html);
  const title = plain(/<title>([\s\S]*?)<\/title>/i.exec(text)?.[1] || "");
  if (title !== TITLE) throw new Error(`untold-artists: the title "${title}" is not "${TITLE}"`);
  const raw = /<script id="__NEXT_DATA__" type="application\/json">([\s\S]*?)<\/script>/.exec(text)?.[1];
  if (!raw) throw new Error("untold-artists: the page embeds no __NEXT_DATA__");
  let data;
  try { data = JSON.parse(raw)?.props?.pageProps?.data; } catch (e) { throw new Error(`untold-artists: the embedded data is not JSON (${e.message})`); }
  const list = data?.content;
  if (!Array.isArray(list) || !list.length) throw new Error("untold-artists: the embedded data lists no act");
  if (data.totalPages !== 1 || data.totalElements !== list.length)
    throw new Error(`untold-artists: the page holds ${list.length} of ${data.totalElements} entries (${data.totalPages} pages)`);
  const acts = [], labelDate = new Map();
  let timed = 0;
  for (const x of list) {
    const artist = plain(x?.name || "");
    if (!artist) throw new Error("untold-artists: an entry has no name");
    const stage = plain(x?.performanceStage?.name || "");
    if (!stage) throw new Error(`untold-artists: ${artist} has no stage`);
    const label = plain(x?.dateLabel || ""), m = LABEL.exec(label);
    if (!m) throw new Error(`untold-artists: ${artist}'s day label "${label}" is not "Day N" or "Ziua N"`);
    if (!Number.isFinite(x?.performanceDate)) throw new Error(`untold-artists: ${artist} has no date`);
    const date = zoneDate(x.performanceDate);
    if (!date.startsWith(`${year}-`)) throw new Error(`untold-artists: ${artist} is dated ${date}, not in ${year}`);
    const day = +m[1];
    if (labelDate.has(day) && labelDate.get(day) !== date) throw new Error(`untold-artists: "${label}" is dated both ${labelDate.get(day)} and ${date}`);
    labelDate.set(day, date);
    if (Number.isFinite(x.performanceStartTimestamp) || Number.isFinite(x.performanceEndTimestamp)) timed++;
    acts.push({ artist, printed: x.name, label, day, date, stage });
  }
  const days = [...labelDate.keys()].sort((a, b) => a - b);
  return { title, acts, labels: days.map(d => acts.find(a => a.day === d).label), printedDates: days.map(d => labelDate.get(d)), dayNumbers: days, timed };
}

// The page's entries as rows (artist, day, stage) for an edition whose run is
// `dates` (["YYYY-MM-DD", …]): each entry's day label must be its date's
// place in the run, and every day of the run must be printed. Returns null
// when the page does not prove the edition. An entry printed twice on the
// same day and stage is one row (`printedTwice`); a name printed with spaces
// around it is billed without them (`trimmed`). Two spellings of a name
// that make the same id (2025's "B MIKE" and "B.MIKE") are one act, billed
// under the spelling the page prints first; `sameActs` lists each other one.
export function untoldRows(page, dates) {
  if (JSON.stringify(page.printedDates) !== JSON.stringify(dates) || page.dayNumbers.some((d, i) => d !== i + 1)) return null;
  if (page.acts.some(a => dates[a.day - 1] !== a.date)) return null;
  const rows = [], seen = new Set(), printedTwice = [], trimmed = [], actName = new Map(), sameActs = [];
  for (const a of page.acts) {
    const k = slug(a.artist);
    if (!actName.has(k)) actName.set(k, a.artist);
    else if (actName.get(k) !== a.artist && !sameActs.some(x => x.printed === a.artist)) sameActs.push({ printed: a.artist, billedAs: actName.get(k) });
  }
  for (const a of page.acts) {
    if (a.printed !== a.artist && !trimmed.includes(a.printed)) trimmed.push(a.printed);
    const artist = actName.get(slug(a.artist)), k = `${artist}\t${a.day}\t${a.stage}`;
    if (seen.has(k)) { printedTwice.push({ artist, day: a.day, stage: a.stage }); continue; }
    seen.add(k);
    rows.push({ artist, day: a.day, stage: a.stage });
  }
  return { rows, printedTwice, trimmed: trimmed.map(p => ({ printed: p, billedAs: plain(p) })), sameActs };
}
