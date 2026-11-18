// lolla-lineup.mjs — Lollapalooza's official lineup page, lollapalooza.com/lineup/
// (2018 design, its "Interactive Lineup" tab), read from an archived capture.
// Format "lolla-cards".
//
// The page prints one card per act: <div class="c-lineup__artist "
// data-id="N" data-title="…" data-day-titles="[&quot;Saturday, 8\/4&quot;]">,
// whose caption (<p class="c-lineup__caption-text …">) is the act as billed,
// then under <h3 class="c-lineup__details-category-title">2018 Schedule:</h3>
// one <p class="c-lineup__details-session-times"> per set: "Sat 8/04 8:30pm
// <br> <span>Grant Park</span>". A set is the act, its date, its start and
// its stage. The page prints no end times.
//
// A card shows at most two sets; an act with more prints a "View more set
// times" link to its own page. A day the card's own day-titles list but no
// set it shows prints (2018: School of Rock AllStars' Sunday) comes back in
// `hidden`, with the card's day title, never as a set: its stage and time are
// not on this page. A day-title that no set prints, on a card with no such
// link, stops the read, as does a set whose date is not among the card's
// day-titles. A set printed twice on one card is one set; each day counts its
// second copies in `duplicates`. A card with no set stops the read. Nothing on
// the page is guessed.
//
// The page names the year twice: each card's schedule heading ("2018
// Schedule:") and the page's description ("… August 2-5, 2018."). Both must
// be the edition's.

import { to24 } from "./lib.mjs";

const WEEKDAYS = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
const ENT = { "&amp;": "&", "&nbsp;": " ", "&#039;": "'", "&#39;": "'", "&quot;": '"', "&rsquo;": "’", "&lsquo;": "‘", "&#8217;": "’", "&ndash;": "–", "&mdash;": "—" };
const pad = n => String(n).padStart(2, "0");
export const plain = s => String(s).replace(/<br\s*\/?>/gi, " ").replace(/<[^>]+>/g, "")
  .replace(/&#?\w+;/g, e => ENT[e] ?? (/^&#(\d+);$/.test(e) ? String.fromCodePoint(+e.slice(2, -1)) : e))
  .replace(/\s+/g, " ").trim();
const weekdayOf = iso => WEEKDAYS[new Date(iso + "T12:00:00Z").getUTCDay()];
const realDate = iso => !Number.isNaN(new Date(iso + "T12:00:00Z").getTime()) && new Date(iso + "T12:00:00Z").toISOString().slice(0, 10) === iso;

// "Sat 8/04" (a set) or "Saturday, 8/4" (a card's day title) → the date in
// `year`, or null. The weekday must be the date's, abbreviated or in full.
export function cardDate(label, year) {
  const m = /^([A-Za-z]+),? (\d{1,2})\/(\d{1,2})$/.exec(String(label || "").trim());
  if (!m) return null;
  const iso = `${year}-${pad(+m[2])}-${pad(+m[3])}`;
  if (!realDate(iso)) return null;
  const wd = weekdayOf(iso), w = m[1].toLowerCase();
  return w === wd || (w.length === 3 && wd.slice(0, 3) === w) ? iso : null;
}

export function parseLollaLineup(html, { year } = {}) {
  if (!year) throw new Error("no year");
  const text = String(html);
  const desc = plain(/<meta name="description" content="([^"]*)"/.exec(text)?.[1] ?? "");
  if (!new RegExp(`\\b${year}\\b`).test(desc)) throw new Error(`the page's description does not name ${year}: "${desc}"`);
  const cards = text.split(/<div class="c-lineup__artist "/).slice(1);
  if (!cards.length) throw new Error("no artist cards on the page");
  const byDate = new Map(), hidden = [], ids = new Set();
  for (const card of cards) {
    const head = /^\s*data-weekends="[^"]*" data-id="(\d+)" data-title="([^"]*)"[^>]*? data-day-titles="([^"]*)"/.exec(card);
    if (!head) throw new Error(`a card without its id, title or day titles: ${plain(card.slice(0, 120))}`);
    const id = head[1];
    if (ids.has(id)) throw new Error(`card ${id} printed twice`);
    ids.add(id);
    const cap = /<p class="c-lineup__caption-text[^"]*">([\s\S]*?)<\/p>/.exec(card);
    const artist = cap && plain(cap[1]);
    if (!artist) throw new Error(`card ${id}: no name`);
    if (plain(head[2]) !== artist) throw new Error(`card ${id}: captioned "${artist}", titled "${plain(head[2])}"`);
    let titles;
    try { titles = JSON.parse(plain(head[3])); } catch { throw new Error(`${artist}: day titles "${plain(head[3])}" are not a list`); }
    if (!Array.isArray(titles) || !titles.length) throw new Error(`${artist}: no day titles`);
    const titleDates = titles.map(t => { const d = cardDate(t, year); if (!d) throw new Error(`${artist}: day title "${t}" is not a ${year} date`); return d; });
    const sched = card.indexOf(`<h3 class="c-lineup__details-category-title">${year} Schedule:</h3>`);
    if (sched < 0) throw new Error(`${artist}: no "${year} Schedule:" heading`);
    const sessions = [...card.slice(sched).matchAll(/<p class="c-lineup__details-session-times">([\s\S]*?)<\/p>/g)];
    if (!sessions.length) throw new Error(`${artist}: a card with no set`);
    const more = /<a [^>]*href="[^"]*\/artist\/[^"]*"[^>]*>\s*View more set times\s*<\/a>/.test(card);
    const shown = new Set(), seen = new Set();
    for (const s of sessions) {
      const m = /^\s*([A-Za-z]{3} \d{1,2}\/\d{1,2})\s+(\d{1,2}:\d{2} ?[ap]m)\s*<br\s*\/?>\s*<span>([\s\S]*?)<\/span>\s*$/i.exec(s[1]);
      if (!m) throw new Error(`${artist}: a set that is not "day time | stage": "${plain(s[1])}"`);
      const label = m[1], date = cardDate(label, year), start = to24(m[2].replace(/\s+/, "").toUpperCase()), stage = plain(m[3]);
      if (!date) throw new Error(`${artist}: "${label}" is not a ${year} date`);
      if (!start) throw new Error(`${artist} ${label}: time "${m[2]}"`);
      if (!stage) throw new Error(`${artist} ${label}: no stage`);
      if (!titleDates.includes(date)) throw new Error(`${artist}: a set on ${label}, a day the card's day titles do not list`);
      if (!byDate.has(date)) byDate.set(date, { date, label, sets: [], duplicates: 0 });
      const day = byDate.get(date);
      if (day.label !== label) throw new Error(`${date} printed as "${day.label}" and "${label}"`);
      shown.add(date);
      const k = [date, stage, start].join("|");
      if (seen.has(k)) { day.duplicates++; continue; }
      seen.add(k);
      day.sets.push({ stage, start, end: "", artist, openEnd: true });
    }
    const off = titleDates.filter(d => !shown.has(d));
    if (off.length && !more) throw new Error(`${artist}: day titles list ${off.join(", ")}, which no set on the card prints, and the card has no "View more set times" link`);
    for (const d of off) hidden.push({ date: d, artist, title: titles[titleDates.indexOf(d)] });
  }
  const days = [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date))
    .map(d => ({ ...d, stages: [...new Set(d.sets.map(x => x.stage))] }));
  return { description: desc, cards: cards.length, days, hidden };
}
