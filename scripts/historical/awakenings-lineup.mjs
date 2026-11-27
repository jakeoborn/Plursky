// awakenings-lineup.mjs — Awakenings Festival's own party page on the
// festival's old site (awakenings.nl/en/parties/<n>/<slug>/, 2009-2012),
// read from an archived capture, as a LINEUP: who played on which area. The
// page prints each set's range too, but a lineup edition keeps no times.
//
// The page carries, in its head block:
//
//   <div class="detailsbig2"><h1>Awakenings Festival</h1><br>
//     <h3>30 June 2012<br>Recreatiegebied, Halfweg<br>11:00 / 23:00</h3>
//   (2010: <h1>Awakenings</h1><br><h2>Festival 10 Year Anniversary</h2>) —
//     the event, its one date ("D Month YYYY"), its place and its hours;
//
// and its <title>, which prints the same date ("Awakenings Festival -
// 30 June 2012 - Awakenings Parties"). Then one tab block, the areas:
//
//   <div id="line-up-id1"><ul class="border-grey"><li><a href="…#line-up-id1-1">
//     <span>C</span></a></li> … — each tab is an area as the page labels it
//     ("C", "W (air)"); the page never prints the word "Area";
//   <div id="line-up-id1-1"><ul><li>… <p>12:00 - 14:00<br><span class="name">
//     <a …>Nicole Rosie</a></span></p></li> … </ul> — one entry per set.
//
// Throws on anything it cannot confirm: no event header, an event that is not
// the festival itself (the after-party has its own page), a header date that
// is not a real date in `year` or differs from the title's, a second tab
// block, tabs and panels that do not pair up in order, an area with no label
// or no act, an entry with no name or no printed range, or an act listed
// twice on one area.

const ENT = { "&amp;": "&", "&quot;": '"', "&#39;": "'", "&#039;": "'", "&lt;": "<", "&gt;": ">", "&nbsp;": " " };
const MARK = { uml: "̈", acute: "́", grave: "̀", circ: "̂", tilde: "̃", cedil: "̧", ring: "̊" };
const accent = e => { const m = /^&([A-Za-z])(uml|acute|grave|circ|tilde|cedil|ring);$/.exec(e); return m ? (m[1] + MARK[m[2]]).normalize("NFC") : undefined; };
const unent = s => String(s).replace(/&#?\w+;/g, e => ENT[e] ?? accent(e) ?? (/^&#(\d+);$/.test(e) ? String.fromCodePoint(+e.slice(2, -1)) : e));
export const plain = s => unent(String(s).replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim();
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const pad = n => String(n).padStart(2, "0");

// "30 June 2012" in `year` → "2012-06-30", or null.
export function printedDate(printed, year) {
  const m = /^(\d{1,2}) ([A-Z][a-z]+) (\d{4})$/.exec(String(printed || "").trim());
  if (!m || +m[3] !== +year || !MONTHS.includes(m[2])) return null;
  const iso = `${m[3]}-${pad(MONTHS.indexOf(m[2]) + 1)}-${pad(+m[1])}`;
  const t = new Date(iso + "T12:00:00Z");
  return !isNaN(t) && t.toISOString().slice(0, 10) === iso ? iso : null;
}

export function parseAwakeningsLineup(html, { year } = {}) {
  const text = String(html);
  const title = plain(/<title>([\s\S]*?)<\/title>/i.exec(text)?.[1] || "");
  const head = /<div class="detailsbig2?">\s*<h1>([^<]*)<\/h1>(?:<br>\s*<h2>([^<]*)<\/h2>)?<br>\s*<h3>([^<]*)<br>([^<]*)<br>([^<]*)<\/h3>/.exec(text);
  if (!head) throw new Error("awakenings-lineup: no event header");
  const event = plain(`${head[1]} ${head[2] || ""}`), printed = plain(head[3]), place = plain(head[4]), hours = plain(head[5]);
  // The festival itself, never its after-party or another party.
  if (!/^Awakenings Festival\b/.test(event) || /\bafter/i.test(event)) throw new Error(`awakenings-lineup: the page is "${event}", not the festival`);
  const date = printedDate(printed, year);
  if (!date) throw new Error(`awakenings-lineup: the header's date "${printed}" is not a date in ${year}`);
  if (!title.includes(` - ${printed}`) || !/\bAwakenings Festival\b/.test(title)) throw new Error(`awakenings-lineup: the title "${title}" does not name the festival on ${printed}`);
  if (/id="line-up-id2"/.test(text)) throw new Error("awakenings-lineup: the page prints a second line-up block");
  const block = /<div id="line-up-id1"[^>]*>\s*<ul class="border-grey">([\s\S]*?)<\/ul>/.exec(text);
  if (!block) throw new Error("awakenings-lineup: no line-up tabs");
  const tabs = [...block[1].matchAll(/<li><a href="[^"]*#line-up-id1-(\d+)"><span>([^<]*)<\/span><\/a><\/li>/g)].map(([, n, l]) => ({ n: +n, label: plain(l) }));
  const items = (block[1].match(/<li>/g) || []).length;
  if (!tabs.length || tabs.length !== items) throw new Error(`awakenings-lineup: ${items} tabs, ${tabs.length} read`);
  const panels = [...text.matchAll(/<div id="line-up-id1-(\d+)">/g)];
  if (panels.length !== tabs.length || tabs.some((t, i) => t.n !== i + 1 || +panels[i][1] !== i + 1))
    throw new Error(`awakenings-lineup: tabs ${tabs.map(t => t.n).join(",")} and panels ${panels.map(p => p[1]).join(",")} do not pair up`);
  const areas = tabs.map((t, i) => {
    if (!t.label) throw new Error(`awakenings-lineup: tab ${t.n} has no label`);
    const from = panels[i].index, to = i + 1 < panels.length ? panels[i + 1].index : text.indexOf("tab-gray-panel-bottom", from);
    const body = text.slice(from, to < 0 ? undefined : to).split('<div class="full">')[0];
    const lis = body.split(/<li>/).slice(1);
    const acts = lis.map(li => {
      const m = /<p>\s*([^<]*?)\s*<br>\s*<span class="name"><a [^>]*>([^<]*)<\/a><\/span><\/p>/.exec(li);
      const name = plain(m?.[2] || "");
      if (!name) throw new Error(`awakenings-lineup: an entry on ${t.label} has no name`);
      if (!/^\d{2}:\d{2} - \d{2}:\d{2}$/.test(m[1])) throw new Error(`awakenings-lineup: ${name} on ${t.label} prints "${m[1]}", not a range`);
      return { name, range: m[1] };
    });
    if (!acts.length) throw new Error(`awakenings-lineup: ${t.label} names no act`);
    const names = acts.map(a => a.name), dup = names.find((a, j) => names.indexOf(a) !== j);
    if (dup) throw new Error(`awakenings-lineup: ${dup} is listed twice on ${t.label}`);
    return { label: t.label, acts };
  });
  const [y, mo, dd] = date.split("-");
  const wd = WEEKDAYS[new Date(date + "T12:00:00Z").getUTCDay()];
  return { title, event, printed, place, hours, date, label: `${wd} ${+dd} ${MONTHS[+mo - 1]} ${y}`, areas };
}

// One row per act and area, in the page's own order (the day is the page's one date).
export const awakeningsRows = page => page.areas.flatMap(a => a.acts.map(x => ({ artist: x.name, stage: a.label })));
