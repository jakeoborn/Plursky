// lollabr-lineup.mjs — the lineup pages of the Lollapalooza sites in Latin
// America that share one set of templates: Lollapalooza Brasil
// (lollapaloozabr.com), Lollapalooza Chile (lollapaloozacl.com) and
// Lollapalooza Argentina (lollapaloozaar.com), read from archived captures,
// as a LINEUP: who played which day, and on which stage where the page prints
// one. No times are kept.
//
// Every reader takes { year, site } ("brasil" by default; SITES below). The
// page's title must name that site's festival, and the dates are read in its
// language (Portuguese for Brasil, Spanish for Chile and Argentina). The site
// printed its lineup three ways over the years; each reader below proves the
// edition from the page itself and throws on anything it cannot confirm. All
// three return the same shape:
//
//   { title, printed, days: [{ heading, label, date, acts: [{ artist, stage }] }],
//     stageOrder, dropped: [...], credits: [...] }
//
// 1. "por-dia" (Brasil 2014-2016: /2014-line-up-por-dia, /line-up-por-dia-2015,
//    /lineup-por-dia/; Chile 2014-2016: /lineup-diario, /lineupdiario2015,
//    /lineupdiario2016/; Argentina 2015-2016: /por-dia, /lineup-2016-diario/).
//    The site's header prints the festival's run, <p class="site-dates">5-6
//    de abril de 2014 - Autódromo de Interlagos, São Paulo</p> ("28 e 29 de
//    março de 2015, no …", "14 & 15 de marzo 2015 - Parque O'Higgins", "18 y
//    19 de marzo de 2016. Hipódromo de San Isidro."). Where the header prints
//    no year ("29 y 30 de Marzo - Parque O'Higgins", "21 y 22 de Marzo.
//    Hipódromo …"), the page's title must: either the same run with the year
//    ("… | Santiago – 29 y 30 de Marzo 2014") or the festival and the year
//    ("Por día | Lollapalooza Argentina 2015"). The page then prints one
//    heading per day ("Sábado, 5 de abril", "Sábado 28 de março", "Sábado
//    29", "Viernes 18") over an <ol class="lineup-list"> with one <li> per
//    act: <a …>Muse</a> (2014), or <a …> [play button] Jack White <span
//    class="artist__subtitle"></span> [favourite button] </a>. Each list is
//    headed by the nearest heading before it. A day heading's date must be one
//    of the run's, in order (a heading that prints only the day of the month
//    is that day of the run), and its weekday the date's own. A list headed by
//    a stage the site names (Chile 2016's "Kidzapalooza" under each day)
//    belongs to the day before it, on that stage; any other heading stops the
//    read. A subtitle that continues the billing ("Robert Plant" over "and the
//    Sensational Space Shifters") is part of it; any other subtitle stops the
//    read unless the caller names it as a credit printed under that billing
//    (`credits`), which is set apart in `credits`. No other stage is printed.
//
// 2. "grid" (Brasil 2017 /lineup-horarios/, 2019 /lineup-2019/): the C3
//    schedule grid that ACL's and Lollapalooza's sites use (acl-schedule.mjs
//    reads it). Its day tabs carry the date with its year (data-value=
//    "saturday-2017-03-25") and print it in the site's language ("sábado mar
//    25th"); each column is a stage, each block an act with its printed range.
//    The tabs must be exactly the run's dates, each label naming its own
//    weekday, month and day. The ranges are printed but not kept: the edition
//    is a lineup. A block the grid marks cancelled, or draws twice, is not
//    read as an act (returned in `dropped`), and an act drawn twice on one
//    stage on one day is one row.
//
// 3. "cards" (Brasil 2018 /lineup/2018-interativo/): the C3 interactive
//    lineup, one card per act, <div class="c-lineup__artist " … data-day-
//    titles="[&quot;24\/3\/2018&quot;]"> whose caption (<p class="c-lineup__
//    caption-text …">) is the act as billed. The page's description names the
//    edition and its run ("O Lollapalooza Brasil 2018 será dias 23, 24 e 25 de
//    março!"); every card's days must be among that run's dates. No stage.

import { parseAclSchedule } from "./acl-schedule.mjs";

const ENT = { "&amp;": "&", "&quot;": '"', "&#39;": "'", "&#039;": "'", "&lt;": "<", "&gt;": ">", "&nbsp;": " ",
  "&#8211;": "–", "&#8217;": "’", "&#8216;": "‘", "&#8220;": "“", "&#8221;": "”", "&rsquo;": "’", "&ndash;": "–" };
export const plain = s => String(s).replace(/<br\s*\/?>/gi, " ").replace(/<[^>]+>/g, " ")
  .replace(/&#?\w+;/g, e => ENT[e] ?? (/^&#(\d+);$/.test(e) ? String.fromCodePoint(+e.slice(2, -1)) : e))
  .replace(/\s+/g, " ").trim();

// The three sites, the festival each title names, the language its dates
// are printed in, the prefix of the formats in its ledgers, and the stages a
// day-by-day page may head a list with (a list of acts under that day).
export const SITES = {
  brasil: { name: "Lollapalooza Brasil", lang: "pt", prefix: "lollabr", listStages: [] },
  chile: { name: "Lollapalooza Chile", lang: "es", prefix: "lollacl", listStages: ["Kidzapalooza"] },
  argentina: { name: "Lollapalooza Argentina", lang: "es", prefix: "lollaar", listStages: [] },
};
const siteOf = site => { const s = SITES[site]; if (!s) throw new Error(`lollabr-lineup: unknown site "${site}"`); return s; };

export const MESES = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
const MONTHS_BY_LANG = { pt: MESES,
  es: ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"] };
const DIAS_BY_LANG = { pt: ["domingo", "segunda-feira", "terça-feira", "quarta-feira", "quinta-feira", "sexta-feira", "sábado"],
  es: ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"] };
// Names are compared without accents or case: Argentina 2016 prints "Sabado 19".
const fold = s => String(s).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
const monthIndex = (name, lang) => MONTHS_BY_LANG[lang].map(fold).indexOf(fold(name));
const weekdayIs = (name, date, lang) => fold(DIAS_BY_LANG[lang][dow(date)]) === fold(name);
const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const pad = n => String(n).padStart(2, "0");
const real = d => { const t = new Date(d + "T12:00:00Z"); return !isNaN(t) && t.toISOString().slice(0, 10) === d; };
const dow = d => new Date(d + "T12:00:00Z").getUTCDay();
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
// The label the ledger keeps for a day, in the order datedLabel reads
// ("Saturday 5 April 2014").
export const dayLabel = d => { const [y, m, dd] = d.split("-"); return `${WEEKDAYS[dow(d)]} ${+dd} ${MONTHS[+m - 1]} ${y}`; };

// A printed run → its dates, or null. Portuguese "5-6 de abril de 2014", "28
// e 29 de março de 2015", "dias 23, 24 e 25 de março" (no year: `year`);
// Spanish "29 y 30 de Marzo 2014", "14 & 15 de marzo 2015", "19 y 20 de Marzo,
// 2016", "18 y 19 de marzo de 2016". A year it prints must be `year`; the
// days must run one after another.
const SEP = String.raw`\s*(?:-|,|&|\be\b|\by\b)\s*`;
export function printedRun(text, year, lang = "pt") {
  const m = new RegExp(String.raw`(\d{1,2}(?:${SEP}\d{1,2})+)\s+de\s+([a-zç]+)(?:,?\s+(?:de\s+)?(\d{4}))?`, "i").exec(String(text || ""));
  if (!m) return null;
  if (m[3] && +m[3] !== +year) return null;
  const mi = monthIndex(m[2], lang);
  if (mi < 0) return null;
  const dates = m[1].split(new RegExp(SEP)).map(d => `${year}-${pad(mi + 1)}-${pad(+d)}`);
  if (!dates.every(real)) return null;
  for (let i = 1; i < dates.length; i++) if (Date.parse(dates[i]) - Date.parse(dates[i - 1]) !== 864e5) return null;
  return dates;
}

// A day heading in `year` → the date, or null when it is not one or its
// weekday is not that date's own. "Sábado, 5 de abril", "Sábado 28 de março",
// or (with the page's `run`) a weekday and a day of the month, "Sábado 29",
// "Viernes 18": that day of the run.
export function dayHeading(text, year, { lang = "pt", run } = {}) {
  const t = String(text).trim();
  let m = /^([\p{L}-]+),?\s+(\d{1,2})\s+de\s+([\p{L}]+)$/iu.exec(t), d;
  if (m) {
    const mi = monthIndex(m[3], lang);
    d = `${year}-${pad(mi + 1)}-${pad(+m[2])}`;
    if (mi < 0) return null;
  } else if ((m = /^([\p{L}-]+),?\s+(\d{1,2})$/iu.exec(t)) && run) {
    const hits = run.filter(x => +x.slice(8) === +m[2]);
    if (hits.length !== 1) return null;
    d = hits[0];
  } else return null;
  if (!real(d) || !weekdayIs(m[1], d, lang)) return null;
  return d;
}

// A grid tab ("sábado mar 25th", "sexta-feira abr 5th") prints its date's
// own weekday, month and day of month, with the right ordinal.
const ordinal = n => n % 100 >= 11 && n % 100 <= 13 ? "th" : ["th", "st", "nd", "rd"][n % 10] || "th";
export function tabPrints(label, date, lang = "pt") {
  const m = /^([\p{L}-]+)\s+([\p{L}]{3})\s+(\d{1,2})(st|nd|rd|th)$/iu.exec(String(label).trim());
  if (!m || !real(date)) return false;
  const [, mo, dd] = date.split("-").map(Number);
  return weekdayIs(m[1], date, lang) && fold(MONTHS_BY_LANG[lang][mo - 1].slice(0, 3)) === fold(m[2]) && +m[3] === dd && m[4] === ordinal(dd);
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

const namesSite = (title, site) => {
  if (!title.includes(site.name)) throw new Error(`lollabr-lineup: the title "${title}" does not name ${site.name}`);
};
// A subtitle that goes on with the billing: "and the Sensational Space
// Shifters" under "Robert Plant".
const CONTINUES = /^(?:and|&|with|y|e|con|com)\s/i;

export function parsePorDia(html, { year, site: key = "brasil", credits = {} } = {}) {
  const site = siteOf(key), text = String(html), title = titleOf(text);
  namesSite(title, site);
  const printed = plain(/<p class="site-dates">([\s\S]*?)<\/p>/.exec(text)?.[1] || "");
  if (!printed) throw new Error("lollabr-lineup: the page prints no festival dates");
  const run = printedRun(printed, year, site.lang);
  if (!run) throw new Error(`lollabr-lineup: the header "${printed}" is not a run of dates in ${year}`);
  // The year: the header prints it, or the title prints the same run with
  // it, or the title names the festival with it.
  const printsYear = new RegExp(`\\b${year}\\b`);
  if (!printsYear.test(printed)) {
    const titleRun = printsYear.test(title) && printedRun(title, year, site.lang);
    if (!(titleRun && same(titleRun, run)) && !new RegExp(`${site.name} ${year}\\b`).test(title))
      throw new Error(`lollabr-lineup: neither the header "${printed}" nor the title "${title}" prints ${year}`);
  }
  const headings = [...text.matchAll(/<h([1-3])[^>]*>([\s\S]*?)<\/h\1>/g)];
  const days = [], kept = [], stageOrder = [], used = new Set();
  for (const list of text.matchAll(/<ol class="lineup-list">([\s\S]*?)<\/ol>/g)) {
    const h = headings.filter(x => x.index < list.index).pop();
    if (!h) throw new Error("lollabr-lineup: a list of acts has no heading");
    if (used.has(h.index)) throw new Error(`lollabr-lineup: the heading "${plain(h[2])}" heads two lists`);
    used.add(h.index);
    const heading = plain(h[2]), date = dayHeading(heading, year, { lang: site.lang, run });
    const stage = date ? "" : site.listStages.find(s => s === heading);
    if (!date && !stage) throw new Error(`lollabr-lineup: the list headed "${heading}" is not dated in ${year}`);
    if (stage && !days.length) throw new Error(`lollabr-lineup: the ${stage} list comes before any day`);
    const day = date ? { heading, label: dayLabel(date), date, acts: [] } : days.at(-1);
    const where = stage ? `${day.heading} (${stage})` : heading;
    const acts = [...list[1].matchAll(/<li class="(?:lineup__artist|headliner__artist)[^"]*"[^>]*>\s*<a [^>]*>([\s\S]*?)<\/a>/g)].map(([, a]) => {
      const sub = plain(/<span class="artist__subtitle">([\s\S]*?)<\/span>/.exec(a)?.[1] || "");
      const name = plain(a.replace(/<button[\s\S]*?<\/button>/g, " ").replace(/<span class="artist__subtitle">[\s\S]*?<\/span>/g, " "));
      if (!name) throw new Error(`lollabr-lineup: an act on ${where} has no name`);
      if (sub && !CONTINUES.test(sub) && credits[name] !== sub)
        throw new Error(`lollabr-lineup: ${name} on ${where} prints a subtitle "${sub}" the reader does not place`);
      if (sub && !CONTINUES.test(sub)) kept.push({ date: day.date, stage, artist: name, credit: sub });
      return { artist: sub && CONTINUES.test(sub) ? `${name} ${sub}` : name, stage };
    });
    const items = (list[1].match(/<li[\s>]/g) || []).length;
    if (items !== acts.length) throw new Error(`lollabr-lineup: ${where} prints ${items} items, ${acts.length} read as acts`);
    if (!acts.length) throw new Error(`lollabr-lineup: ${where} names no act`);
    if (stage && !stageOrder.includes(stage)) stageOrder.push(stage);
    day.acts.push(...acts);
    noDup(day.acts, day.heading);
    if (date) days.push(day);
  }
  if (!same(days.map(d => d.date), run))
    throw new Error(`lollabr-lineup: the page lists ${days.map(d => d.heading).join(", ") || "no day"}, not the run "${printed}"`);
  for (const [name, sub] of Object.entries(credits))
    if (!kept.some(c => c.artist === name && c.credit === sub)) throw new Error(`lollabr-lineup: no act ${name} prints the credit "${sub}"`);
  return { title, printed, days, stageOrder, dropped: [], credits: kept };
}

export function parseGrid(html, { year, site: key = "brasil" } = {}) {
  const site = siteOf(key), text = String(html), title = titleOf(text);
  namesSite(title, site);
  const page = parseAclSchedule(text);
  if (!page.tabs.length) throw new Error("lollabr-lineup: the grid prints no day tabs");
  for (const t of page.tabs) {
    if (!t.date.startsWith(`${year}-`)) throw new Error(`lollabr-lineup: a day tab is dated ${t.date}, not in ${year}`);
    if (!tabPrints(t.label, t.date, site.lang)) throw new Error(`lollabr-lineup: the day tab "${t.label}" does not print ${t.date}`);
  }
  if (!same(page.days.map(d => d.date), page.tabs.map(t => t.date)))
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
  return { title, printed: page.tabs.map(t => t.label).join(" | "), days, stageOrder, dropped, credits: [] };
}

export function parseCards(html, { year, site: key = "brasil" } = {}) {
  const site = siteOf(key), text = String(html), title = titleOf(text);
  namesSite(title, site);
  const desc = plain(/<meta name="description" content="([^"]*)"/.exec(text)?.[1] || "");
  if (!new RegExp(`${site.name} ${year}\\b`).test(desc)) throw new Error(`lollabr-lineup: the description "${desc}" does not name ${site.name} ${year}`);
  const run = printedRun(desc, year, site.lang);
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
  return { title, printed: desc, days, stageOrder: [], dropped: [], credits: [] };
}

export const READERS = { "por-dia": parsePorDia, grid: parseGrid, cards: parseCards };
