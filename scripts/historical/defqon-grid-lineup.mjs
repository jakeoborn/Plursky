// defqon-grid-lineup.mjs — Defqon.1's own 2013 timetable page
// (defqon1.nl/timetable/), read from an archived capture, as a LINEUP: who
// played which area on which day. Format "defqon-grid".
//
// The page draws each day as a grid, with no time printed on any act:
//
//   <section class="day saturday" id="saturday"> headed <h2 class="day-title">
//     <span>Festival Day 2 - Saturday June 22</span> (no year), then an hour
//     axis, then one <div class="day-lineup sat red"> per area: a
//     <li class="area"> naming it ("RED") and one <li> per block, its width
//     a class ("one", "onehalf", "quarter double", …).
//   A block is an act ("Ran-D"); an act with a live set ("Outbreak <br>/
//     Live" or "N-Vitral / Live", billed "Outbreak (Live)"); an empty gap (class "off"); a segment
//     of the show ("End<br>show", never an act); or a named part of the
//     programme (<h3>The Closing</h3>Coone<br>…<br>Hosted By Villain): its
//     acts, one per line, and its hosts (the MCs, never acts).
//
// The page places each act by the WIDTH of its block on the axis and prints
// no act's time, so none is read here: an act carries its day and area only.
// A named part's acts carry their day, and the area of the row they are drawn
// in, except The Closing, which is drawn in one area's row but classed as
// another's ("four red ending" in the Black row): its acts carry no area.
//
// Throws on anything it cannot confirm: a day heading that is not a weekday
// and date in `year`, a day printed twice, an area row with no name, a block
// it does not know, a gap that prints a name, or a day with no act.

const ENT = { "&amp;": "&", "&quot;": '"', "&#39;": "'", "&#039;": "'", "&lt;": "<", "&gt;": ">", "&nbsp;": " " };
const unent = s => String(s).replace(/&#?\w+;/g, e => ENT[e] ?? (/^&#(\d+);$/.test(e) ? String.fromCodePoint(+e.slice(2, -1)) : e));
// A superscript two (Alpha<span class="up">2</span>) is the act's own "²".
export const plain = s => unent(String(s).replace(/<span class="up">2<\/span>/g, "²").replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").replace(/\( /g, "(").replace(/ \)/g, ")").trim();
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const pad = n => String(n).padStart(2, "0");
const WIDTH = /^(quarter|half|threequarter|one|onequarter|onehalf|onethreequarter|two|twohalf|three|four|ten)$/;
// Segments of the show that the grid draws as blocks but are no act.
export const SEGMENTS = ["End show"];
const area = s => s === "UV" ? "UV" : s[0] + s.slice(1).toLowerCase();

// "Festival Day 2 - Saturday June 22" → { n: 2, date: "2013-06-22", label }, or null.
export function dayHeading(printed, year) {
  const m = /^Festival Day (\d) - ([A-Z][a-z]+) ([A-Z][a-z]+) (\d{1,2})$/.exec(String(printed || "").trim());
  if (!m || !MONTHS.includes(m[3])) return null;
  const date = `${year}-${pad(MONTHS.indexOf(m[3]) + 1)}-${pad(+m[4])}`;
  const t = new Date(date + "T12:00:00Z");
  if (isNaN(t) || t.toISOString().slice(0, 10) !== date || WEEKDAYS[t.getUTCDay()] !== m[2]) return null;
  return { n: +m[1], date, label: `${m[2]} ${+m[4]} ${m[3]} ${year}` };
}

export function parseDefqonGrid(html, { year } = {}) {
  const text = String(html);
  const title = plain(/<title>([\s\S]*?)<\/title>/i.exec(text)?.[1] || "");
  const sections = [...text.matchAll(/<section class="day (\w+)" id="\w+">([\s\S]*?)<\/section>/g)];
  if (!sections.length) throw new Error("defqon-grid: no day section");
  const days = [], segments = [], parts = [];
  for (const [, , sec] of sections) {
    const head = plain(/<h2 class="day-title"><span>([^<]*)<\/span>/.exec(sec)?.[1] || "");
    const d = dayHeading(head, year);
    if (!d) throw new Error(`defqon-grid: the day "${head}" is not a weekday and date in ${year}`);
    if (d.n !== days.length + 1 || days.some(x => x.date === d.date)) throw new Error(`defqon-grid: "${head}" is out of order or printed twice`);
    const acts = [];
    for (const [, cls, body] of sec.matchAll(/<div class="day-lineup ([^"]+)">\s*<ul class="lineup-bar[^"]*">([\s\S]*?)<\/ul>/g)) {
      const cells = [...body.matchAll(/<li class="([^"]+)"><div class="inner">([\s\S]*?)<\/div><\/li>/g)].map(m => [m[1].split(/\s+/), m[2]]);
      const named = cells.find(([c]) => c[0] === "area");
      const row = named ? area(plain(named[1])) : null;
      if (named && !/^[A-Z][a-zA-Z]*$/.test(row || "")) throw new Error(`defqon-grid: the area row "${cls}" on ${d.label} has no name`);
      for (const [c, inner] of cells) {
        if (c[0] === "area") continue;
        if (!named && !/<h3>/.test(inner)) throw new Error(`defqon-grid: the row "${cls}" on ${d.label} names no area`);
        if (!WIDTH.test(c[0])) throw new Error(`defqon-grid: a block "${c.join(" ")}" in ${row || cls} on ${d.label} is not one the grid draws`);
        const extra = c.slice(1).filter(x => !["double", "last", "off", "nightparty", "ending", "red"].includes(x));
        if (extra.length) throw new Error(`defqon-grid: a block "${c.join(" ")}" in ${row || cls} on ${d.label} is not one the grid draws`);
        if (c.includes("off")) { if (plain(inner)) throw new Error(`defqon-grid: a gap in ${row} on ${d.label} prints "${plain(inner)}"`); continue; }
        const h3 = /<h3>([\s\S]*?)<\/h3>([\s\S]*)$/.exec(inner.replace(/<\/div>\s*<\/div>\s*$/, ""));
        if (h3) {
          const heading = plain(h3[1]), lines = h3[2].split(/<br\s*\/?>/i).map(plain).filter(Boolean);
          const hosts = lines.filter(l => /^Hosted By \S/i.test(l)), names = lines.filter(l => !/^Hosted By \S/i.test(l));
          if (!names.length) throw new Error(`defqon-grid: "${heading}" on ${d.label} names no act`);
          // The part's own area: "The Gathering @ The Blue" names it; The
          // Closing is classed as another row's ("red ending"), so it has none.
          const at = /@ The ([A-Z][a-z]+)$/.exec(heading)?.[1];
          // A row that holds only that part prints no area cell: the heading's
          // "@ The Blue" names it.
          if (at && row && at !== row) throw new Error(`defqon-grid: "${heading}" is drawn in ${row}`);
          if (!row && !at) throw new Error(`defqon-grid: "${heading}" on ${d.label} is in no area row`);
          const stage = c.includes("ending") ? "" : (row ?? at);
          parts.push({ day: d.n, heading, row: row ?? at, stage, acts: names, hosts });
          for (const a of names) acts.push({ artist: a, stage, part: heading });
          continue;
        }
        const lines = inner.split(/<br\s*\/?>/i).map(plain).filter(Boolean);
        const name = lines.join(" ");
        if (!name) throw new Error(`defqon-grid: a block in ${row} on ${d.label} names no act`);
        if (SEGMENTS.includes(name)) { segments.push({ day: d.n, stage: row, segment: name }); continue; }
        // "Outbreak <br>/ Live", or on one line "N-Vitral / Live".
        const live = /^(\S.*?) \/ Live$/.exec(name);
        if (live && lines.length <= 2) { acts.push({ artist: `${live[1]} (Live)`, stage: row }); continue; }
        if (!c.includes("double") && lines.length !== 1) throw new Error(`defqon-grid: "${name}" in ${row} on ${d.label} is printed over ${lines.length} lines`);
        acts.push({ artist: name, stage: row });
      }
    }
    if (!acts.length) throw new Error(`defqon-grid: ${d.label} names no act`);
    days.push({ ...d, acts });
  }
  return { title, days, segments, parts };
}
