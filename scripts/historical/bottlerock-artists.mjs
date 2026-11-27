// bottlerock-artists.mjs — BottleRock Napa Valley's own Artists page
// (bottlerocknapavalley.com, 2015-2023 WordPress site), read from an archived
// capture, as a LINEUP: who plays which day. No stages and no times: the page
// prints neither.
//
// /lineup-schedule/artists/ (2015), /lineup-schedule/<year>-artists/
// (2016-2019) and /<year>-artists/ (2021-2023) are one template, an isotope
// grid under a day filter:
//
//   the heading "<year> Artists" (the page's <h1>, or its <title> in 2015,
//     which prints no <h1>);
//   a filter bar, one control per day: a weekday label and the class it
//     shows (`data-filter=".fri"` "Friday" from 2016, `data-filter=".29"`
//     "Friday" in 2015, the day of the month), plus "ALL" (`*`);
//   inside #block-grid, one `<div class="item <day…>">` per act, its days as
//     the filter's classes (plus the lazy-load plugin's "rocket-lazyload"
//     from 2021), its name in `<span class="artist-name">` (2016-2023) or a
//     bare `<span>` (2015). 2016-2019 also head each block with the name as a
//     linked `<h2>`, which must be the same name.
//
// The page names weekdays, and in 2015 days of the month; it prints no year
// with them. Their dates are proved by the extractor (extract-bottlerock.mjs).
// Every run the page prints elsewhere ("May 29-31, 2015" in its footer,
// "May 26-28, 2017" in its description) is returned in `runs`, so a run that
// names the edition's year can be checked against it; the footer of a capture
// taken after the festival often prints the NEXT edition's run.
//
// Throws on anything it cannot confirm: a heading that is not "<year>
// Artists", no day filter, a filter control it cannot read or printing a day
// twice, no act, an act with no name, an act on no day or on a day the filter
// does not offer, a class it does not know, or an <h2> naming another act.

const ENT = { "&amp;": "&", "&quot;": '"', "&#39;": "'", "&#039;": "'", "&lt;": "<", "&gt;": ">", "&nbsp;": " ", "&#8211;": "–", "&#8217;": "’", "&#8216;": "‘", "&#8220;": "“", "&#8221;": "”" };
const MARK = { uml: "̈", acute: "́", grave: "̀", circ: "̂", tilde: "̃", cedil: "̧", ring: "̊" };
const accent = e => { const m = /^&([A-Za-z])(uml|acute|grave|circ|tilde|cedil|ring);$/.exec(e); return m ? (m[1] + MARK[m[2]]).normalize("NFC") : undefined; };
const unent = s => String(s).replace(/&#?\w+;/g, e => ENT[e] ?? accent(e) ?? (/^&#(\d+);$/.test(e) ? String.fromCodePoint(+e.slice(2, -1)) : /^&#x([0-9a-f]+);$/i.test(e) ? String.fromCodePoint(parseInt(e.slice(3, -1), 16)) : e));
export const plain = s => unent(String(s).replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim();
export const WEEKDAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
// Classes the grid adds that say nothing about the act.
const NEUTRAL = new Set(["rocket-lazyload"]);

// Every run the page prints as "<Month> D-D, YYYY" (one month, as BottleRock
// prints it), each as its dates.
export function printedRuns(html) {
  const out = [];
  for (const m of String(html).matchAll(new RegExp(`\\b(${MONTHS.join("|")}) (\\d{1,2})\\s?[-–]\\s?(\\d{1,2}), (\\d{4})\\b`, "g"))) {
    const [printed, mon, a, b, y] = m, mo = MONTHS.indexOf(mon) + 1, dates = [];
    if (+b < +a) continue;
    for (let d = +a; d <= +b; d++) {
      const t = new Date(Date.UTC(+y, mo - 1, d));
      if (t.getUTCMonth() !== mo - 1) { dates.length = 0; break; }
      dates.push(t.toISOString().slice(0, 10));
    }
    if (dates.length && !out.some(r => r.printed === printed)) out.push({ printed, year: +y, dates });
  }
  return out;
}

export function parseBottleRockArtists(html, { year } = {}) {
  const text = String(html);
  const title = plain(/<title>([\s\S]*?)<\/title>/i.exec(text)?.[1] || "");
  const h1 = /<h1\b[^>]*>([\s\S]*?)<\/h1>/i.exec(text);
  const heading = h1 ? plain(h1[1]) : title;
  if (heading !== `${year} Artists`) throw new Error(`bottlerock-artists: the page's heading "${heading}" is not "${year} Artists"`);
  // The day filter, in the page's order; "*" is ALL.
  const filter = [];
  for (const m of text.matchAll(/<(a|button)\b[^>]*\bdata-filter="([^"]*)"[^>]*>([\s\S]*?)<\/\1>/g)) {
    const sel = m[2], label = plain(m[3]);
    if (sel === "*") continue;
    const cls = /^\.([a-z]{3}|\d{1,2})$/.exec(sel)?.[1];
    if (!cls || !WEEKDAYS.includes(label)) throw new Error(`bottlerock-artists: a filter control "${label}" (${sel}) is not a weekday and its class`);
    if (/^[a-z]/.test(cls) && cls !== label.slice(0, 3).toLowerCase()) throw new Error(`bottlerock-artists: the filter's "${label}" shows class "${cls}"`);
    filter.push({ weekday: label, cls, dayOfMonth: /^\d/.test(cls) ? +cls : null });
  }
  if (!filter.length) throw new Error("bottlerock-artists: no day filter");
  if (new Set(filter.map(f => f.weekday)).size !== filter.length || new Set(filter.map(f => f.cls)).size !== filter.length)
    throw new Error(`bottlerock-artists: the day filter prints a day twice (${filter.map(f => f.weekday).join(", ")})`);
  if (new Set(filter.map(f => f.dayOfMonth === null)).size > 1) throw new Error("bottlerock-artists: the day filter mixes weekday and date classes");
  const grid = text.split(/<div id="block-grid">/);
  if (grid.length !== 2) throw new Error(`bottlerock-artists: ${grid.length - 1} artist grids, not one`);
  // The grid ends where the page's footer (2015-2019: the dates bar) or the
  // article closes; nothing after it is an act.
  const end = grid[1].search(/<div class="dates">|<footer\b|<\/article>|<\/main>/);
  if (end < 0) throw new Error("bottlerock-artists: the artist grid never ends");
  const blocks = grid[1].slice(0, end).split(/<div\b(?=[^>]*\bclass="item )/).slice(1);
  if (!blocks.length) throw new Error("bottlerock-artists: no act");
  const byCls = new Map(filter.map(f => [f.cls, f.weekday]));
  const acts = [];
  for (const b of blocks) {
    const cls = /\bclass="item ([^"]*)"/.exec(b)[1].split(/\s+/).filter(Boolean);
    // The block ends before the next one; 2015's link wrapper closes after it.
    const span = /<span class="artist-name">([\s\S]*?)<\/span>/.exec(b) || /^[^>]*>\s*<span>([\s\S]*?)<\/span>/.exec(b);
    const name = plain(span?.[1] || "");
    if (!name) throw new Error(`bottlerock-artists: an act (${cls.join(" ")}) has no name`);
    const h2 = /<h2>([\s\S]*?)<\/h2>/.exec(b);
    if (h2 && plain(h2[1]) !== name) throw new Error(`bottlerock-artists: ${name}'s block is headed "${plain(h2[1])}"`);
    const days = [];
    for (const c of cls) {
      if (NEUTRAL.has(c)) continue;
      if (!byCls.has(c)) throw new Error(`bottlerock-artists: ${name} carries a class "${c}" the filter does not offer`);
      if (!days.includes(byCls.get(c))) days.push(byCls.get(c));
    }
    if (!days.length) throw new Error(`bottlerock-artists: ${name} plays no day`);
    acts.push({ artist: name, days });
  }
  return { title, heading, filter, acts, runs: printedRuns(text) };
}

// The page's acts as rows (artist, weekday), in the page's order. An act
// printed in two blocks on the same day is one row; `printedTwice` lists it.
export function bottlerockRows(page) {
  const rows = [], seen = new Set(), printedTwice = [];
  for (const a of page.acts) for (const d of a.days) {
    const k = `${a.artist}\t${d}`;
    if (seen.has(k)) { if (!printedTwice.some(x => x.artist === a.artist && x.weekday === d)) printedTwice.push({ artist: a.artist, weekday: d }); continue; }
    seen.add(k);
    rows.push({ artist: a.artist, weekday: d });
  }
  return { rows, printedTwice };
}
