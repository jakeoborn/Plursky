// coachella-lineup.mjs — Coachella's official lineup page, coachella.com/lineup/
// (2014 to 2017 design), read from an archived capture taken after the
// festival.
//
// The page prints one card per act: <div class="artist" data-artistid="N">
// (2014, 2015: data-artist-id),
// whose .artist-info <h1> is the act as billed, then <ul class="event-list">
// with one <li data-eventid> per set: <div class="perf-date">"Friday, April
// 15, 2016"</div> and <div class="perf-time-loc">"06:10PM | Sahara"</div>
// (2014, 2015: <li data-event-id> holding one <span class="add-text">
// "Saturday, April 19, 2014 | 09:50PM | Sahara").
// A set is the act, its date, its start and its stage. The page prints no
// end times, so every set is open-ended. The li's data-weekend is not read:
// the 2016 page marks both weekends "1"; the printed date is what counts.
//
// An act whose card lists no set (a host, a DJ between bands) is returned in
// `unscheduled`, never as a set. A set printed twice on the same card (same
// date, stage and start) is one set; each day counts its second copies in
// `duplicates`. A set printed without its time ("Saturday, April 19, 2014 |
// Gobi") or its stage ("Friday, April 18, 2014 | 11:30PM |") is returned in
// the day's `incomplete`, with what it prints, never as a set. A li missing its date, time or stage stops
// the read: nothing on the page is guessed.

import { to24, datedLabel } from "./lib.mjs";
import { plain } from "./ef-schedule.mjs";

export function parseCoachella(html, { year }) {
  const cards = String(html).split(/<div class="artist" data-artist-?id="/).slice(1);
  if (!cards.length) throw new Error("no artist cards on the page");
  const byDate = new Map(), unscheduled = [], seen = new Map();
  for (const card of cards) {
    const id = /^(\d+)"/.exec(card)?.[1];
    const h1 = /<div class="artist-info">\s*<h1>([\s\S]*?)<\/h1>/.exec(card);
    if (!id || !h1) throw new Error(`artist card ${id || "?"}: no name`);
    const artist = plain(h1[1]);
    if (!artist) throw new Error(`artist card ${id}: blank name`);
    const list = /<ul class="event-list">([\s\S]*?)<\/ul>/.exec(card);
    const items = list ? list[1].split(/<li data-event-?id="/).slice(1) : [];
    if (!items.length) { unscheduled.push(artist); continue; }
    for (const li of items) {
      // 2016 prints the date and "time | stage" in two divs; 2014 and 2015
      // print "date | time | stage" in one span.
      let label, parts;
      const date = /<div class="perf-date">([\s\S]*?)<\/div>/.exec(li), tl = /<div class="perf-time-loc">([\s\S]*?)<\/div>/.exec(li);
      const one = /<span class="add-text">([\s\S]*?)<\/span>\s*<\/li>/.exec(li);
      if (date && tl) { label = plain(date[1]); parts = tl[1].split(/<span class="sep">\|<\/span>/); }
      else if (one) { const p = one[1].split(/<span class="sep">\|<\/span>/); label = plain(p[0]); parts = p.slice(1); }
      else throw new Error(`${artist}: a set without its date or time`);
      const iso = datedLabel(label, year);
      if (!iso) throw new Error(`${artist}: date "${label}" is not a ${year} date`);
      if (!byDate.has(iso)) byDate.set(iso, { date: iso, label, sets: [], incomplete: [], duplicates: 0 });
      // 2014 prints a few sets with no time ("date | Gobi") or no stage
      // ("date | 11:30PM |").
      if (one && (parts.length === 1 || (parts.length === 2 && !plain(parts[1])))) {
        const t = parts.length === 2 ? to24(plain(parts[0])) : null;
        if (parts.length === 2 && !t) throw new Error(`${artist} ${label}: time "${plain(parts[0])}"`);
        byDate.get(iso).incomplete.push({ stage: parts.length === 1 ? plain(parts[0]) : "", start: t || "", artist,
          printed: [label, ...parts.map(plain)].join(" | ") });
        continue;
      }
      if (parts.length !== 2) throw new Error(`${artist} ${label}: time and stage not printed as "time | stage"`);
      const printedTime = plain(parts[0]), stage = plain(parts[1]), start = to24(printedTime);
      if (!/^\d{2}:\d{2}[AP]M$/.test(printedTime) || !start) throw new Error(`${artist} ${label}: time "${printedTime}"`);
      if (!stage) throw new Error(`${artist} ${label}: no stage`);
      const k = [iso, stage, start, artist].join("|");
      if (seen.has(k)) { byDate.get(iso).duplicates++; continue; }
      seen.set(k, 1);
      byDate.get(iso).sets.push({ stage, start, end: "", artist, openEnd: true, printed: printedTime });
    }
  }
  const days = [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date));
  for (const d of days) d.stages = [...new Set(d.sets.map(s => s.stage))];
  return { cards: cards.length, days, unscheduled };
}

// The 2017 design: the page holds its whole lineup as one data attribute,
// <lineup-listing v-bind:artists="[…]">, which the page's script draws as
// the act cards. Each act is { name, events: { weekend1, weekend2 } }, a
// weekend being false or one set: event_date, start_time, end_time ("HH:MM:SS"
// or null), location (the stage, "TBD" when not yet placed) and date_time,
// the date as the card prints it ("Sunday, April 23, 2017").
//
// A set with a start and an end is a set. A set with a start and no end is
// open-ended. A set with no start, a "TBD" stage, or a 00:00:00 start and no
// end (the same "12:00 AM" the page shows for a set it has no time for) is
// returned in the day's `incomplete`, with what the data holds, never as a
// set. An event whose date is not its date_time's, or not the year's, stops
// the read.
export function parseCoachellaData(html, { year }) {
  const m = /<lineup-listing\b[^>]*\bv-bind:artists="([^"]*)"/.exec(String(html));
  if (!m) throw new Error("no lineup-listing data on the page");
  const acts = JSON.parse(decode(m[1]));
  if (!Array.isArray(acts) || !acts.length) throw new Error("the lineup data lists no acts");
  const byDate = new Map(), unscheduled = [], seen = new Map();
  const hm = t => (t == null ? null : /^(\d{2}):(\d{2}):00$/.exec(t) ? t.slice(0, 5) : undefined);
  for (const a of acts) {
    // Names keep their own HTML entities inside the data ("R&oacute;is&iacute;n
    // Murphy"): each is read as its letter, and an unknown one stops the read.
    const artist = accents(plain(String(a.name ?? "")));
    if (!artist) throw new Error(`act ${a.id ?? "?"}: blank name`);
    if (/&#?\w+;/.test(artist)) throw new Error(`${artist}: an entity the reader does not know`);
    if (String(a.festival_year) !== String(year)) throw new Error(`${artist}: festival_year ${a.festival_year}, not ${year}`);
    const events = ["weekend1", "weekend2"].map(w => a.events?.[w]).filter(Boolean);
    if (!events.length) { unscheduled.push(artist); continue; }
    for (const e of events) {
      const label = plain(String(e.date_time ?? "")), iso = datedLabel(label, year);
      if (!iso || iso !== e.event_date) throw new Error(`${artist}: date "${label}" does not print event_date ${e.event_date}`);
      if (!byDate.has(iso)) byDate.set(iso, { date: iso, label, sets: [], incomplete: [], duplicates: 0 });
      const day = byDate.get(iso);
      if (day.label !== label) throw new Error(`${artist}: ${iso} printed as "${label}" and "${day.label}"`);
      const start = hm(e.start_time), end = hm(e.end_time), stage = plain(String(e.location ?? ""));
      if (start === undefined || end === undefined) throw new Error(`${artist} ${label}: time "${e.start_time}"-"${e.end_time}"`);
      const printed = [label, e.start_time ?? "no start", e.end_time ?? "no end", stage || "no stage"].join(" | ");
      if (!start || !stage || /^TBD$/i.test(stage) || (start === "00:00" && !end)) {
        day.incomplete.push({ stage, start: start || "", artist, printed });
        continue;
      }
      // The data lists a few acts twice under two spellings ("Shannon & the
      // Clams" and "Shannon and the Clams", same set): one set, the first
      // spelling kept, the other named in the day's `respelled`.
      const k = [iso, stage, start, fold(artist)].join("|");
      if (seen.has(k)) {
        day.duplicates++;
        if (seen.get(k) !== artist) (day.respelled ||= []).push(`${artist} = ${seen.get(k)}`);
        continue;
      }
      seen.set(k, artist);
      day.sets.push({ stage, start, end: end || "", artist, ...(!end && { openEnd: true }), printed: e.start_time_display });
    }
  }
  const days = [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date));
  for (const d of days) d.stages = [...new Set(d.sets.map(s => s.stage))];
  return { cards: acts.length, days, unscheduled };
}

const ACCENTS = { oacute: "ó", iacute: "í", ouml: "ö", eacute: "é", aacute: "á", uacute: "ú", uuml: "ü", auml: "ä", ntilde: "ñ", egrave: "è", oslash: "ø", aring: "å" };
const fold = s => s.toLowerCase().replace(/&/g, " and ").replace(/[^a-z0-9]+/g, " ").trim();
const accents = s => s.replace(/&(\w+);/g, (all, n) => ACCENTS[n] ?? all);

// The attribute's own entity encoding (&quot; &amp; &#039; and numeric).
function decode(s) {
  return s.replace(/&(quot|amp|lt|gt|apos|#0*39|#x27|#(\d+)|#x([0-9a-f]+));/gi, (all, n, d, x) =>
    n === "quot" ? '"' : n === "amp" ? "&" : n === "lt" ? "<" : n === "gt" ? ">" : d ? String.fromCodePoint(+d) : x ? String.fromCodePoint(parseInt(x, 16)) : "'");
}

// The 2012 design (coachella.com/lineup/list/date/all): every act has a
// hidden overlay, <div class="artist-overlay" id="artist-N">, with its name
// in <h1> and, under <p class="artist-text-currentyear">"2012 Appearance",
// one line per set: "Friday April 20th | 4:30pm | Gobi", lines split by <br>.
// A line printed "Friday April 13th | TBD" has no time or stage and is
// returned in the day's `incomplete`. The page prints no end times, so every
// set is open-ended. Any other line shape stops the read.
export function parseCoachella2012(html, { year }) {
  const overlays = String(html).split(/<div class="artist-overlay" id="artist-/).slice(1);
  if (!overlays.length) throw new Error("no artist overlays on the page");
  const byDate = new Map(), unscheduled = [], seen = new Map();
  for (const o of overlays) {
    const id = /^(\d+)"/.exec(o)?.[1], h1 = /<h1[^>]*>([\s\S]*?)<\/h1>/.exec(o);
    if (!id || !h1) throw new Error(`artist overlay ${id || "?"}: no name`);
    const artist = plain(h1[1]);
    if (!artist) throw new Error(`artist overlay ${id}: blank name`);
    const app = /<p class="artist-text-currentyear">\s*(\d{4}) Appearance\s*<\/p>\s*<p class="artist-text">([\s\S]*?)<\/p>/.exec(o);
    if (!app) { unscheduled.push(artist); continue; }
    if (+app[1] !== +year) throw new Error(`${artist}: "${app[1]} Appearance", not ${year}`);
    for (const line of app[2].split(/<br\s*\/?>/i).map(plain).filter(Boolean)) {
      const parts = line.split("|").map(x => x.trim()), label = parts[0], iso = datedLabel(label, year);
      if (!iso) throw new Error(`${artist}: date "${label}" is not a ${year} date`);
      if (!byDate.has(iso)) byDate.set(iso, { date: iso, label, sets: [], incomplete: [], duplicates: 0 });
      const day = byDate.get(iso);
      if (day.label !== label) throw new Error(`${artist}: ${iso} printed as "${label}" and "${day.label}"`);
      if (parts.length === 2 && /^TBD$/i.test(parts[1])) { day.incomplete.push({ stage: "", start: "", artist, printed: line }); continue; }
      if (parts.length !== 3) throw new Error(`${artist}: "${line}" is not "date | time | stage"`);
      const start = to24(parts[1]), stage = parts[2];
      if (!/^\d{1,2}:\d{2}[ap]m$/i.test(parts[1]) || !start) throw new Error(`${artist} ${label}: time "${parts[1]}"`);
      if (!stage) throw new Error(`${artist} ${label}: no stage`);
      const k = [iso, stage, start, artist].join("|");
      if (seen.has(k)) { day.duplicates++; continue; }
      seen.set(k, 1);
      day.sets.push({ stage, start, end: "", artist, openEnd: true, printed: parts[1] });
    }
  }
  const days = [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date));
  for (const d of days) d.stages = [...new Set(d.sets.map(s => s.stage))];
  return { cards: overlays.length, days, unscheduled };
}
