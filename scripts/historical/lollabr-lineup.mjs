// lollabr-lineup.mjs — Lollapalooza Brasil's own lineup pages
// (lollapaloozabr.com), read from archived captures, as a LINEUP: who played
// which day, and on which stage where the page prints one. No times are kept.
//
// The site printed its lineup three ways over the years; each reader below
// proves the edition from the page itself and throws on anything it cannot
// confirm. All three return the same shape:
//
//   { title, printed, days: [{ heading, label, date, acts: [{ artist, stage }] }],
//     stageOrder, dropped: [...] }
//
// 1. "por-dia" (2014-2016: /2014-line-up-por-dia, /line-up-por-dia-2015,
//    /lineup-por-dia/). The site's header prints the festival's run with its
//    year, <p class="site-dates">5-6 de abril de 2014 - Autódromo de
//    Interlagos, São Paulo</p> ("28 e 29 de março de 2015, no …", "12 e 13 de
//    março de 2016 - …"). The page then prints one <h1> per day ("Sábado, 5
//    de abril", "Sábado 28 de março") followed by an <ol class="lineup-list">
//    with one <li> per act: <a …>Muse</a> (2014), or <a …> [play button]
//    Jack White <span class="artist__subtitle"></span> [favourite button]
//    </a> (2015-2016). Each heading's date must be one of the run's, in order,
//    and its weekday the date's own. No stage is printed.
//
// 2. "grid" (2017 /lineup-horarios/, 2019 /lineup-2019/): the C3 schedule
//    grid that ACL's and Lollapalooza's sites use (acl-schedule.mjs reads
//    it). Its day tabs carry the date with its year (data-value="saturday-
//    2017-03-25") and print it in Portuguese ("sábado mar 25th"); each
//    column is a stage, each block an act with its printed range. The tabs
//    must be exactly the run's dates, each label naming its own weekday,
//    month and day. The ranges are printed but not kept: the edition is a
//    lineup. A block the grid marks cancelled, or draws twice, is not read
//    as an act (returned in `dropped`), and an act drawn twice on one stage
//    on one day is one row.
//
// 3. "cards" (2018 /lineup/2018-interativo/): the C3 interactive lineup, one
//    card per act, <div class="c-lineup__artist " … data-day-titles=
//    "[&quot;24\/3\/2018&quot;]"> whose caption (<p class="c-lineup__caption-
//    text …">) is the act as billed. The page's description names the edition
//    and its run ("O Lollapalooza Brasil 2018 será dias 23, 24 e 25 de
//    março!"); every card's days must be among that run's dates. No stage.

import { parseAclSchedule } from "./acl-schedule.mjs";

const ENT = { "&amp;": "&", "&quot;": '"', "&#39;": "'", "&#039;": "'", "&lt;": "<", "&gt;": ">", "&nbsp;": " ",
  "&#8211;": "–", "&#8217;": "’", "&#8216;": "‘", "&#8220;": "“", "&#8221;": "”", "&rsquo;": "’", "&ndash;": "–" };
export const plain = s => String(s).replace(/<br\s*\/?>/gi, " ").replace(/<[^>]+>/g, " ")
  .replace(/&#?\w+;/g, e => ENT[e] ?? (/^&#(\d+);$/.test(e) ? String.fromCodePoint(+e.slice(2, -1)) : e))
  .replace(/\s+/g, " ").trim();

export const MESES = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
const DIAS = ["domingo", "segunda-feira", "terça-feira", "quarta-feira", "quinta-feira", "sexta-feira", "sábado"];
const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const pad = n => String(n).padStart(2, "0");
const real = d => { const t = new Date(d + "T12:00:00Z"); return !isNaN(t) && t.toISOString().slice(0, 10) === d; };
const dow = d => new Date(d + "T12:00:00Z").getUTCDay();
// The label the ledger keeps for a day, in the order datedLabel reads
// ("Saturday 5 April 2014").
export const dayLabel = d => { const [y, m, dd] = d.split("-"); return `${WEEKDAYS[dow(d)]} ${+dd} ${MONTHS[+m - 1]} ${y}`; };

// A printed run in Portuguese → its dates, or null. "5-6 de abril de 2014",
// "28 e 29 de março de 2015", "dias 23, 24 e 25 de março" (no year: `year`).
// A year it prints must be `year`; the days must run one after another.
export function printedRun(text, year) {
  const m = /(\d{1,2}(?:\s*(?:-|,|\be\b)\s*\d{1,2})+)\s+de\s+([a-zç]+)(?:\s+de\s+(\d{4}))?/i.exec(String(text || ""));
  if (!m) return null;
  if (m[3] && +m[3] !== +year) return null;
  const mi = MESES.indexOf(m[2].toLowerCase());
  if (mi < 0) return null;
  const dates = m[1].split(/\s*(?:-|,|\be\b)\s*/).map(d => `${year}-${pad(mi + 1)}-${pad(+d)}`);
  if (!dates.every(real)) return null;
  for (let i = 1; i < dates.length; i++) if (Date.parse(dates[i]) - Date.parse(dates[i - 1]) !== 864e5) return null;
  return dates;
}

// "Sábado, 5 de abril" or "Sábado 28 de março" in `year` → the date, or null
// when the weekday is not that date's own.
export function dayHeading(text, year) {
  const m = /^([a-zçá-]+),?\s+(\d{1,2})\s+de\s+([a-zç]+)$/i.exec(String(text).trim());
  if (!m) return null;
  const mi = MESES.indexOf(m[3].toLowerCase());
  const d = `${year}-${pad(mi + 1)}-${pad(+m[2])}`;
  if (mi < 0 || !real(d) || DIAS[dow(d)] !== m[1].toLowerCase()) return null;
  return d;
}

// A grid tab ("sábado mar 25th", "sexta-feira abr 5th") prints its date's
// own weekday, month and day of month, with the right ordinal.
const ordinal = n => n % 100 >= 11 && n % 100 <= 13 ? "th" : ["th", "st", "nd", "rd"][n % 10] || "th";
export function tabPrints(label, date) {
  const m = /^([a-zçá-]+)\s+([a-zç]{3})\s+(\d{1,2})(st|nd|rd|th)$/i.exec(String(label).trim());
  if (!m || !real(date)) return false;
  const [, mo, dd] = date.split("-").map(Number);
  return DIAS[dow(date)] === m[1].toLowerCase() && MESES[mo - 1].slice(0, 3) === m[2].toLowerCase() && +m[3] === dd && m[4] === ordinal(dd);
}

const titleOf = html => plain(/<title>([\s\S]*?)<\/title>/i.exec(html)?.[1] || "");
const noDup = (acts, heading) => {
  const seen = new Set();
  for (const a of acts) {
    const k = `${a.artist}\t${a.stage}`;
    if (seen.has(k)) throw new Error(`lollabr-lineup: ${a.artist} is listed twice on ${heading}`);
    seen.add(k);
  }
};

export function parsePorDia(html, { year } = {}) {
  const text = String(html), title = titleOf(text);
  if (!/Lollapalooza Brasil/.test(title)) throw new Error(`lollabr-lineup: the title "${title}" does not name Lollapalooza Brasil`);
  const printed = plain(/<p class="site-dates">([\s\S]*?)<\/p>/.exec(text)?.[1] || "");
  if (!printed) throw new Error("lollabr-lineup: the page prints no festival dates");
  if (!new RegExp(`\\b${year}\\b`).test(printed)) throw new Error(`lollabr-lineup: the header "${printed}" does not print ${year}`);
  const run = printedRun(printed, year);
  if (!run) throw new Error(`lollabr-lineup: the header "${printed}" is not a run of dates in ${year}`);
  const days = [];
  for (const [, h, seg] of text.matchAll(/<h1[^>]*>([\s\S]*?)<\/h1>([\s\S]*?)(?=<h1[\s>]|$)/g)) {
    const list = /<ol class="lineup-list">([\s\S]*?)<\/ol>/.exec(seg);
    if (!list) continue;
    const heading = plain(h), date = dayHeading(heading, year);
    if (!date) throw new Error(`lollabr-lineup: the list headed "${heading}" is not dated in ${year}`);
    const acts = [...list[1].matchAll(/<li class="(?:lineup__artist|headliner__artist)[^"]*"[^>]*>\s*<a [^>]*>([\s\S]*?)<\/a>/g)].map(([, a]) => {
      const sub = plain(/<span class="artist__subtitle">([\s\S]*?)<\/span>/.exec(a)?.[1] || "");
      if (sub) throw new Error(`lollabr-lineup: an act on ${heading} prints a subtitle "${sub}" the reader does not place`);
      const artist = plain(a.replace(/<button[\s\S]*?<\/button>/g, " ").replace(/<span class="artist__subtitle">[\s\S]*?<\/span>/g, " "));
      if (!artist) throw new Error(`lollabr-lineup: an act on ${heading} has no name`);
      return { artist, stage: "" };
    });
    const items = (list[1].match(/<li[\s>]/g) || []).length;
    if (items !== acts.length) throw new Error(`lollabr-lineup: ${heading} prints ${items} items, ${acts.length} read as acts`);
    if (!acts.length) throw new Error(`lollabr-lineup: ${heading} names no act`);
    noDup(acts, heading);
    days.push({ heading, label: dayLabel(date), date, acts });
  }
  if (JSON.stringify(days.map(d => d.date)) !== JSON.stringify(run))
    throw new Error(`lollabr-lineup: the page lists ${days.map(d => d.heading).join(", ") || "no day"}, not the run "${printed}"`);
  return { title, printed, days, stageOrder: [], dropped: [] };
}

export function parseGrid(html, { year } = {}) {
  const text = String(html), title = titleOf(text);
  if (!/Lollapalooza Brasil/.test(title)) throw new Error(`lollabr-lineup: the title "${title}" does not name Lollapalooza Brasil`);
  const page = parseAclSchedule(text);
  if (!page.tabs.length) throw new Error("lollabr-lineup: the grid prints no day tabs");
  for (const t of page.tabs) {
    if (!t.date.startsWith(`${year}-`)) throw new Error(`lollabr-lineup: a day tab is dated ${t.date}, not in ${year}`);
    if (!tabPrints(t.label, t.date)) throw new Error(`lollabr-lineup: the day tab "${t.label}" does not print ${t.date}`);
  }
  if (JSON.stringify(page.days.map(d => d.date)) !== JSON.stringify(page.tabs.map(t => t.date)))
    throw new Error(`lollabr-lineup: the grid's days (${page.days.map(d => d.date).join(", ")}) are not its tabs (${page.tabs.map(t => t.date).join(", ")})`);
  const stageOrder = [], dropped = [];
  const days = page.days.map(d => {
    const heading = page.tabs.find(t => t.date === d.date).label, acts = [], seen = new Set();
    for (const x of d.duplicates) dropped.push({ date: d.date, stage: x.stage, artist: x.artist, printed: x.printed, why: "the grid draws this block twice" });
    for (const s of d.sets) {
      if (!s.stage) throw new Error(`lollabr-lineup: ${s.artist} on ${heading} sits in a column with no stage`);
      if (!s.artist) throw new Error(`lollabr-lineup: a block on ${heading} (${s.stage}) has no name`);
      if (s.canceled) { dropped.push({ date: d.date, stage: s.stage, artist: s.artist, printed: s.printed, why: "the grid marks this block cancelled" }); continue; }
      const k = `${s.artist}\t${s.stage}`;
      if (seen.has(k)) { dropped.push({ date: d.date, stage: s.stage, artist: s.artist, printed: s.printed, why: "a second block by the same act on the same stage that day: one row" }); continue; }
      seen.add(k);
      if (!stageOrder.includes(s.stage)) stageOrder.push(s.stage);
      acts.push({ artist: s.artist, stage: s.stage });
    }
    if (!acts.length) throw new Error(`lollabr-lineup: ${heading} names no act`);
    return { heading, label: dayLabel(d.date), date: d.date, acts };
  });
  return { title, printed: page.tabs.map(t => t.label).join(" | "), days, stageOrder, dropped };
}

export function parseCards(html, { year } = {}) {
  const text = String(html), title = titleOf(text);
  if (!/Lollapalooza Brasil/.test(title)) throw new Error(`lollabr-lineup: the title "${title}" does not name Lollapalooza Brasil`);
  const desc = plain(/<meta name="description" content="([^"]*)"/.exec(text)?.[1] || "");
  if (!new RegExp(`Lollapalooza Brasil ${year}\\b`).test(desc)) throw new Error(`lollabr-lineup: the description "${desc}" does not name Lollapalooza Brasil ${year}`);
  const run = printedRun(desc, year);
  if (!run) throw new Error(`lollabr-lineup: the description "${desc}" prints no run of dates`);
  const cards = text.split(/<div class="c-lineup__artist /).slice(1);
  if (!cards.length) throw new Error("lollabr-lineup: no act card");
  const byDay = new Map(run.map(d => [d, []]));
  for (const c of cards) {
    const artist = plain(/<p class="c-lineup__caption-text[^"]*">([\s\S]*?)<\/p>/.exec(c)?.[1] || "");
    if (!artist) throw new Error("lollabr-lineup: an act card has no name");
    const raw = /data-day-titles="([^"]*)"/.exec(c.slice(0, c.indexOf(">")))?.[1];
    let titles;
    try { titles = JSON.parse(plain(raw ?? "")); } catch { throw new Error(`lollabr-lineup: ${artist}'s card prints no day titles`); }
    if (!Array.isArray(titles) || !titles.length) throw new Error(`lollabr-lineup: ${artist} plays no day`);
    for (const t of titles) {
      const m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(String(t));
      const date = m && `${m[3]}-${pad(+m[2])}-${pad(+m[1])}`;
      if (!date || !byDay.has(date)) throw new Error(`lollabr-lineup: ${artist} plays "${t}", not a day of the run "${desc}"`);
      byDay.get(date).push({ artist, stage: "" });
    }
  }
  const days = run.map(date => {
    const acts = byDay.get(date), label = dayLabel(date);
    if (!acts.length) throw new Error(`lollabr-lineup: no card plays ${date}`);
    noDup(acts, label);
    return { heading: date.split("-").reverse().map(Number).join("/"), label, date, acts };
  });
  return { title, printed: desc, days, stageOrder: [], dropped: [] };
}

export const READERS = { "por-dia": parsePorDia, grid: parseGrid, cards: parseCards };
