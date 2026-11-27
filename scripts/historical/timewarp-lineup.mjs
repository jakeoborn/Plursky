// timewarp-lineup.mjs — Time Warp Germany's own LINEUP page for one Mannheim
// edition, read from an archived capture. It prints no times and no stages:
// who plays on which night. The site changed template twice, so there are
// three readers, each throwing on anything it cannot confirm.
//
// parseTimeWarpLineup — the one-page site, 2019 to 2025 (format
// "timewarp-subsite"). The edition's own header:
//
//   <div class="hgroup" …><h1>Germany 22</h1><h2>28. + 29. October 2022 |
//     Mannheim</h2></div>  — the edition ("Germany", with the two digits of
//     its year in 2021 and 2022), its nights (day of month, each with an
//     optional full stop, joined with "+" or "&", then the month and year:
//     "06 April 2019", "1 April 2023", "5 &amp; 6 April 2024") and its city.
//   2025 writes <h1>Time Warp Germany</h1> and puts the night in
//     <span class="ix-date">05. April 2025</span> and the place in
//     <span class="ix-location">Maimarkthalle | Mannheim</span>.
//
// and the lineup itself, one <ul class="… ix-lineup …"> per night, in the
// order of those dates, each under its own heading: "Friday A-Z" (2022),
// "Friday (A-Z)" (2021), or "Fr 05.04.24" (2024, 2025: the German weekday and
// the date, which must be that night's). A one-night edition may print a
// single list with no heading (2019) or "IN ALPHABETICAL ORDER" (2023). One
// <li> per act: <h3>Amelie Lens</h3> (2019-2023) or <span … data-type="act">
// names joined by <small>b2b</small> (2024, 2025); a live set is marked
// <span class="artist-live">Live</span> or <sup>Live</sup>, billed
// "Reinier Zonneveld (Live)" as the library writes it.
//
// parseTimeWarpClassic — the 2014-2018 site (format "timewarp-classic"). Its
// event menu prints the Germany edition's night (<strong>DE</strong> …
// <span class="eDate"> 07 Apr 2018 </span> … <span class="mLocation">Germany
// </span>) until the festival has happened ("THANK YOU" after), and the page
// lists every act once under "In alphabetical order" (the German page: "In
// alphabetischer Reihenfolge") as <span class="ixTitle">. One night.
//
// parseTimeWarpMannheim — the 2012-2013 site (format "timewarp-mannheim").
// The page is "Time Warp Mannheim"'s and names its year in a heading ("Time
// Warp 2012", "Mannheim Line Up 2013"); 2012's description also prints the
// night ("Time Warp Mannheim - 31.03.2012"). Acts are listed by section, each
// <h3> then <ul class="lineup"> of <span class="luTitle">: DJs, live acts
// (billed "(Live)") and VJs, who are visual artists, not music acts, and are
// returned apart as `leftOut`. One night.

const ENT = { "&amp;": "&", "&quot;": '"', "&#39;": "'", "&#039;": "'", "&lt;": "<", "&gt;": ">", "&nbsp;": " " };
const MARK = { uml: "̈", acute: "́", grave: "̀", circ: "̂", tilde: "̃", cedil: "̧", ring: "̊" };
const accent = e => { const m = /^&([A-Za-z])(uml|acute|grave|circ|tilde|cedil|ring);$/.exec(e); return m ? (m[1] + MARK[m[2]]).normalize("NFC") : undefined; };
const unent = s => String(s).replace(/&#?\w+;/g, e => ENT[e] ?? accent(e) ?? (/^&#(\d+);$/.test(e) ? String.fromCodePoint(+e.slice(2, -1)) : e));
export const plain = s => unent(String(s).replace(/<[^>]+>/g, " ")).replace(/[\s ]+/g, " ").trim();
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
// The classic menu's short months, English and German.
const SHORT = { Jan: 1, Feb: 2, Mar: 3, "Mär": 3, Apr: 4, May: 5, Mai: 5, Jun: 6, Jul: 7, Aug: 8, Sep: 9, Oct: 10, Okt: 10, Nov: 11, Dec: 12, Dez: 12 };
const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const WD_DE = ["So", "Mo", "Di", "Mi", "Do", "Fr", "Sa"];
const pad = n => String(n).padStart(2, "0");
const real = d => { const t = new Date(d + "T12:00:00Z"); return !isNaN(t) && t.toISOString().slice(0, 10) === d; };
const weekday = d => new Date(d + "T12:00:00Z").getUTCDay();
export const dayLabel = date => { const [y, mo, dd] = date.split("-"); return `${WEEKDAYS[weekday(date)]} ${+dd} ${MONTHS[+mo - 1]} ${y}`; };

// "28. + 29. October 2022", "5 & 6 April 2024", "06 April 2019" →
// ["2022-10-28", "2022-10-29"], …, or null.
export function headerDates(printed, year) {
  const m = /^(\d{1,2}\.?(?: [+&] \d{1,2}\.?)*) ([A-Z][a-z]+) (\d{4})$/.exec(String(printed || "").trim());
  if (!m || +m[3] !== +year || !MONTHS.includes(m[2])) return null;
  const dates = m[1].split(/ [+&] /).map(d => `${m[3]}-${pad(MONTHS.indexOf(m[2]) + 1)}-${pad(parseInt(d, 10))}`);
  return dates.every(real) ? dates : null;
}

// The classic menu's "07 Apr 2018" → "2018-04-07", or null.
export function menuDate(printed, year) {
  const m = /^(\d{1,2})\.? ([A-ZÄÖÜ][a-zäöü]{2}) (\d{4})$/.exec(String(printed || "").trim());
  if (!m || +m[3] !== +year || !SHORT[m[2]]) return null;
  const d = `${m[3]}-${pad(SHORT[m[2]])}-${pad(m[1])}`;
  return real(d) ? d : null;
}

const dupCheck = (acts, where, who) => { const dup = acts.find((a, j) => acts.indexOf(a) !== j); if (dup) throw new Error(`${who}: ${dup} is listed twice on ${where}`); };
const titleOf = text => plain(/<title>([\s\S]*?)<\/title>/i.exec(text)?.[1] || "");
const LIVE = /<span class="artist-live">\s*Live\s*<\/span>|<sup>\s*Live\s*<\/sup>/i;

// One-page site (2019-2025).
export function parseTimeWarpLineup(html, { year } = {}) {
  const text = String(html);
  const title = titleOf(text);
  const yy = String(year).slice(2);
  const heads = [
    ...[...text.matchAll(/<div class="hgroup"[^>]*><h1>([^<]*)<\/h1><h2>([^<|]*)\|([^<]*)<\/h2><\/div>/g)]
      .map(m => ({ edition: plain(m[1]), printed: plain(m[2]), city: plain(m[3]) })),
    ...[...text.matchAll(/<div class="hgroup"[^>]*><h1>([^<]*)<\/h1><h2>[^<]*<\/h2><span class="ix-date">([^<]*)<\/span><span class="ix-location">([^<]*)<\/span><\/div>/g)]
      .map(m => ({ edition: plain(m[1]), printed: plain(m[2]), city: plain(m[3]).split("|").pop().trim() })),
  ].filter(h => /^(?:Time Warp )?Germany\b/.test(h.edition));
  if (!heads.length) throw new Error("timewarp-lineup: no edition header");
  if (heads.length > 1) throw new Error(`timewarp-lineup: ${heads.length} edition headers`);
  const { edition, printed, city } = heads[0];
  if (!new RegExp(`^(?:Time Warp )?Germany(?: ${yy})?$`).test(edition)) throw new Error(`timewarp-lineup: the header names "${edition}", not Germany ${yy}`);
  if (city !== "Mannheim") throw new Error(`timewarp-lineup: the header's city is "${city}", not Mannheim`);
  const dates = headerDates(printed, year);
  if (!dates) throw new Error(`timewarp-lineup: the header's dates "${printed}" are not dates in ${year}`);
  // A list's heading is the last heading printed between the end of the
  // previous list (or the start of the Lineup section) and the list itself.
  const start = Math.max(0, text.search(/data-page-title="Lineup/));
  const lists = [];
  const re = /<ul [^>]*class="[^"]*\bix-lineup\b[^"]*"[^>]*>([\s\S]*?)<\/ul>/g;
  re.lastIndex = start;
  for (let m, from = start; (m = re.exec(text)); from = re.lastIndex) {
    const hs = [...text.slice(from, m.index).matchAll(/<(h2|h3|p)\b[^>]*>([^<]*)(?:<br>)?<\/\1>/g)].map(h => plain(h[2])).filter(Boolean);
    lists.push({ heading: hs.at(-1) ?? null, body: m[1] });
  }
  if (lists.length !== dates.length) throw new Error(`timewarp-lineup: the header prints ${dates.length} nights, the page ${lists.length} lists`);
  const days = lists.map(({ heading, body }, i) => {
    const date = dates[i], wd = WEEKDAYS[weekday(date)], where = heading || date;
    const named = /^([A-Z][a-z]+day) \(?A-Z\)?$/.exec(heading || "");
    const dated = /^([A-Z][a-z]) (\d\d)\.(\d\d)\.(\d\d)$/.exec(heading || "");
    if (named) {
      if (named[1] !== wd) throw new Error(`timewarp-lineup: list ${i + 1} is headed "${heading}", not ${wd} (${date})`);
    } else if (dated) {
      if (`20${dated[4]}-${dated[3]}-${dated[2]}` !== date || dated[1] !== WD_DE[weekday(date)])
        throw new Error(`timewarp-lineup: list ${i + 1} is headed "${heading}", not ${WD_DE[weekday(date)]} ${date}`);
    } else if (!(heading === null || /^in alphabetical order$/i.test(heading)) || lists.length !== 1)
      throw new Error(`timewarp-lineup: list ${i + 1} is headed "${heading}", which names no night`);
    const acts = [...body.matchAll(/<li\b[^>]*>([\s\S]*?)<\/li>/g)].map(([, li]) => {
      const live = LIVE.test(li), name = plain(li.replace(LIVE, ""));
      if (!name) throw new Error(`timewarp-lineup: an act on ${where} has no name`);
      return live ? `${name} (Live)` : name;
    });
    if (!acts.length) throw new Error(`timewarp-lineup: ${where} names no act`);
    dupCheck(acts, where, "timewarp-lineup");
    return { heading: heading ?? "", label: dayLabel(date), date, acts };
  });
  return { title, edition, printed, city, days };
}

// 2014-2018 site.
export function parseTimeWarpClassic(html, { year } = {}) {
  const text = String(html);
  const title = titleOf(text);
  const menu = [...text.matchAll(/<strong>DE<\/strong><\/span><span class="mText"><span class="eDate">([^<]*)<\/span><span class="split">\|<\/span><span class="mLocation">([^<]*)<\/span>/g)]
    .map(m => ({ printed: plain(m[1]), city: plain(m[2]) }));
  if (!menu.length) throw new Error("timewarp-classic: the event menu names no Germany edition");
  if (menu.some(m => m.printed !== menu[0].printed || m.city !== "Germany")) throw new Error("timewarp-classic: the event menu's Germany entries disagree");
  const printed = menu[0].printed, date = menuDate(printed, year);
  if (!date) throw new Error(`timewarp-classic: the menu prints "${printed}" for Germany, not a night in ${year}`);
  const lists = [...text.matchAll(/<h3>(In alphabetical order|In alphabetischer Reihenfolge)<\/h3><\/(?:div|hgroup)><ul class="indexG">([\s\S]*?)<\/ul>/g)];
  if (lists.length !== 1) throw new Error(`timewarp-classic: ${lists.length} alphabetical lists`);
  const [, heading, body] = lists[0];
  const acts = [...body.matchAll(/<li\b[^>]*>([\s\S]*?)<\/li>/g)].map(([, li]) => {
    const m = /<span class="ixTitle">([\s\S]*?)<\/span>/.exec(li), name = m && plain(m[1]);
    if (!name) throw new Error("timewarp-classic: an act has no name");
    return name;
  });
  if (!acts.length) throw new Error("timewarp-classic: the list names no act");
  dupCheck(acts, date, "timewarp-classic");
  return { title, edition: "Germany", printed, city: "Germany", days: [{ heading, label: dayLabel(date), date, acts }] };
}

// 2012-2013 site. Returns the year it names and, where its description prints
// one, the night; the caller dates the edition.
export function parseTimeWarpMannheim(html, { year } = {}) {
  const text = String(html);
  const title = titleOf(text);
  if (!/Time Warp Mannheim/.test(title)) throw new Error(`timewarp-mannheim: the title "${title}" is not Time Warp Mannheim's`);
  const years = [...text.matchAll(/<h1>([\s\S]*?)<\/h1>/g)].map(m => /^(?:Time Warp|Mannheim Line Up) (\d{4})$/.exec(plain(m[1]))?.[1]).filter(Boolean);
  if (!years.length) throw new Error("timewarp-mannheim: no heading names the year");
  if (years.some(y => +y !== +year)) throw new Error(`timewarp-mannheim: the page names ${[...new Set(years)].join(", ")}, not ${year}`);
  const desc = /<meta name="description" content="Time Warp Mannheim - (\d\d)\.(\d\d)\.(\d{4})"/.exec(text);
  let printedDate = null;
  if (desc) {
    printedDate = `${desc[3]}-${desc[2]}-${desc[1]}`;
    if (+desc[3] !== +year || !real(printedDate)) throw new Error(`timewarp-mannheim: the description's date ${desc[1]}.${desc[2]}.${desc[3]} is not a night in ${year}`);
  }
  const sections = [...text.matchAll(/<h3>([^<]*)<\/h3>(?:\s*<\/hgroup>)?\s*<ul class="lineup">([\s\S]*?)<\/ul>/g)];
  if (!sections.length) throw new Error("timewarp-mannheim: no lineup section");
  const acts = [], leftOut = [];
  for (const [, h, body] of sections) {
    const kind = plain(h).toLowerCase();
    if (!["djs", "live", "vjs"].includes(kind)) throw new Error(`timewarp-mannheim: unknown section "${plain(h)}"`);
    const names = [...body.matchAll(/<span class="luTitle">([\s\S]*?)<\/span>/g)].map(([, n]) => plain(n));
    if (!names.length || names.some(n => !n)) throw new Error(`timewarp-mannheim: section "${plain(h)}" names no act, or an act with no name`);
    if (kind === "vjs") leftOut.push({ section: plain(h), acts: names, reason: "VJs: visual artists, not music acts" });
    else acts.push(...names.map(n => kind === "live" ? `${n} (Live)` : n));
  }
  if (!acts.length) throw new Error("timewarp-mannheim: the page names no act");
  dupCheck(acts, String(year), "timewarp-mannheim");
  return { title, edition: "Mannheim", year: +year, printedDate, sections: sections.map(s => plain(s[1])), acts, leftOut };
}
