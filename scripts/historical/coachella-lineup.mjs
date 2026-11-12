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
