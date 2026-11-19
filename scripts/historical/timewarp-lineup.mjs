// timewarp-lineup.mjs — Time Warp Germany's own LINEUP page for one edition
// (time-warp.de/<yy>/lineup), read from an archived capture. It prints no
// times and no stages: who plays on which night.
//
// The edition's own sub-site carries, in every page's head:
//
//   <div class="hgroup" …><h1>Germany 22</h1><h2>28. + 29. October 2022 |
//     Mannheim</h2></div>  — the edition (two digits of its year), its
//     nights (day of month, each followed by a full stop, joined with "+",
//     then the month and year) and its city.
//
// and the lineup itself, one list per night, in the order of those dates:
//
//   <h2 id="e13238"> Friday A-Z<br></h2><section class="index"><ul …
//     class="ix-lineup …"> with one <li> per act: <h3>Amelie Lens</h3>, or
//     <h3>Reinier Zonneveld<span class="artist-live">Live</span></h3> for a
//     live set, billed "Reinier Zonneveld (Live)" as the library writes it.
//
// Each night's date is the header's date in the same position; the night's
// heading must name that date's weekday. Throws on anything it cannot
// confirm: no edition header, a header whose year is not `year`, a header
// date that is not a real date, a different number of nights and lists, a
// list headed with the wrong weekday, an act with no name, or an act listed
// twice on one night.

const ENT = { "&amp;": "&", "&quot;": '"', "&#39;": "'", "&#039;": "'", "&lt;": "<", "&gt;": ">", "&nbsp;": " " };
const MARK = { uml: "̈", acute: "́", grave: "̀", circ: "̂", tilde: "̃", cedil: "̧", ring: "̊" };
const accent = e => { const m = /^&([A-Za-z])(uml|acute|grave|circ|tilde|cedil|ring);$/.exec(e); return m ? (m[1] + MARK[m[2]]).normalize("NFC") : undefined; };
const unent = s => String(s).replace(/&#?\w+;/g, e => ENT[e] ?? accent(e) ?? (/^&#(\d+);$/.test(e) ? String.fromCodePoint(+e.slice(2, -1)) : e));
export const plain = s => unent(String(s).replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim();
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const pad = n => String(n).padStart(2, "0");

// "28. + 29. October 2022" → ["2022-10-28", "2022-10-29"], or null.
export function headerDates(printed, year) {
  const m = /^((?:\d{1,2}\. \+ )*\d{1,2}\.) ([A-Z][a-z]+) (\d{4})$/.exec(String(printed || "").trim());
  if (!m || +m[3] !== +year || !MONTHS.includes(m[2])) return null;
  const dates = m[1].split(" + ").map(d => `${m[3]}-${pad(MONTHS.indexOf(m[2]) + 1)}-${pad(parseInt(d, 10))}`);
  const real = d => { const t = new Date(d + "T12:00:00Z"); return !isNaN(t) && t.toISOString().slice(0, 10) === d; };
  if (!dates.every(real)) return null;
  return dates;
}

export function parseTimeWarpLineup(html, { year } = {}) {
  const text = String(html);
  const title = plain(/<title>([\s\S]*?)<\/title>/i.exec(text)?.[1] || "");
  const head = /<div class="hgroup"[^>]*><h1>([^<]*)<\/h1><h2>([^<|]*)\|([^<]*)<\/h2><\/div>/.exec(text);
  if (!head) throw new Error("timewarp-lineup: no edition header");
  const edition = plain(head[1]), printed = plain(head[2]), city = plain(head[3]);
  if (!new RegExp(`^Germany ${String(year).slice(2)}$`).test(edition)) throw new Error(`timewarp-lineup: the header names "${edition}", not Germany ${String(year).slice(2)}`);
  const dates = headerDates(printed, year);
  if (!dates) throw new Error(`timewarp-lineup: the header's dates "${printed}" are not dates in ${year}`);
  const lists = [...text.matchAll(/<h2 id="e\d+">([^<]*)(?:<br>)?<\/h2>\s*<section class="index"><ul [^>]*class="ix-lineup[^"]*"[^>]*>([\s\S]*?)<\/ul>/g)];
  if (lists.length !== dates.length) throw new Error(`timewarp-lineup: the header prints ${dates.length} nights, the page ${lists.length} lists`);
  const days = lists.map(([, h, body], i) => {
    const heading = plain(h), wd = WEEKDAYS[new Date(dates[i] + "T12:00:00Z").getUTCDay()];
    if (heading !== `${wd} A-Z`) throw new Error(`timewarp-lineup: list ${i + 1} is headed "${heading}", not ${wd} (${dates[i]})`);
    const acts = [...body.matchAll(/<h3>([\s\S]*?)<\/h3>/g)].map(([, a]) => {
      const live = /<span class="artist-live">\s*Live\s*<\/span>/.test(a);
      const name = plain(a.replace(/<span class="artist-live">[\s\S]*?<\/span>/, ""));
      if (!name) throw new Error(`timewarp-lineup: an act on ${heading} has no name`);
      return live ? `${name} (Live)` : name;
    });
    if (!acts.length) throw new Error(`timewarp-lineup: ${heading} names no act`);
    const dup = acts.find((a, j) => acts.indexOf(a) !== j);
    if (dup) throw new Error(`timewarp-lineup: ${dup} is listed twice on ${heading}`);
    const [y, mo, dd] = dates[i].split("-");
    return { heading, label: `${wd} ${+dd} ${MONTHS[+mo - 1]} ${y}`, date: dates[i], acts };
  });
  return { title, edition, printed, city, days };
}
