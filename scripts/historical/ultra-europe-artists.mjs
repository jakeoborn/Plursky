// ultra-europe-artists.mjs — Ultra Europe's own Artists page (ultraeurope.com
// /artists/, the 2013 WordPress site), read from an archived capture, as a
// LINEUP: who plays which day, and on which stage. No times are kept.
//
// The page prints a grid of every act, then one block per act in the same
// order:
//
//   <a href="…#adventure-club"><div class="artist">…<div class="name …">
//     Adventure Club</div></div></a>                      — the grid;
//   <div id="adventure-club" class="selected-artist">
//     <div class="name uppercase white dock11">Adventure Club</div>
//     <div class="perform">Day 1 - 05:00PM - Main Stage</div>  — the block,
//     one "Day N - <time> - <stage>" per appearance, joined with ", "
//     ("Carl Cox": Day 1 … Carl Cox & Friends Arena, Day 2 … Carl Cox &
//     Friends Arena).
//
// The days are numbered, never dated. The page's own countdown, in the
// header of every page of the site, is set to the festival's opening:
//
//   timer: "2013:7:12:16:0:0"   — year, month, day, hour, minute, second.
//
// so Day 1 is that date and Day N the (N-1)th day after it. The printed
// times are read only to check the line's shape; a lineup carries none.
//
// Throws on anything it cannot confirm: a title that is not the Artists page,
// no countdown or one not in `year`, no act, a grid and blocks that do not
// name the same acts in the same order, an act with no name or no
// appearance, an appearance line it cannot read, or an act printed twice on
// one day and stage.

const ENT = { "&amp;": "&", "&quot;": '"', "&#39;": "'", "&#039;": "'", "&lt;": "<", "&gt;": ">", "&nbsp;": " ", "&#8211;": "–", "&#8217;": "’", "&#8216;": "‘" };
const MARK = { uml: "̈", acute: "́", grave: "̀", circ: "̂", tilde: "̃", cedil: "̧", ring: "̊" };
const accent = e => { const m = /^&([A-Za-z])(uml|acute|grave|circ|tilde|cedil|ring);$/.exec(e); return m ? (m[1] + MARK[m[2]]).normalize("NFC") : undefined; };
const unent = s => String(s).replace(/&#?\w+;/g, e => ENT[e] ?? accent(e) ?? (/^&#(\d+);$/.test(e) ? String.fromCodePoint(+e.slice(2, -1)) : e));
export const plain = s => unent(String(s).replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim();
const pad = n => String(n).padStart(2, "0");

// "2013:7:12:16:0:0" → "2013-07-12", or null when it is not a real moment.
export function countdownDate(printed) {
  const m = /^(\d{4}):(\d{1,2}):(\d{1,2}):(\d{1,2}):(\d{1,2}):(\d{1,2})$/.exec(String(printed || "").trim());
  if (!m || +m[4] > 23 || +m[5] > 59 || +m[6] > 59) return null;
  const date = `${m[1]}-${pad(m[2])}-${pad(m[3])}`, t = new Date(date + "T12:00:00Z");
  return !isNaN(t) && t.toISOString().slice(0, 10) === date ? date : null;
}

// One appearance: "Day 1 - 05:00PM - Main Stage" (2013's Sander van Doorn
// prints two spaces after the dash).
const APPEARANCE = /^Day (\d+) - +((?:0?[1-9]|1[0-2]):[0-5]\d[AP]M) - (\S.*)$/;
export function appearances(line) {
  const parts = String(line).trim().split(/, (?=Day \d)/);
  return parts.map(p => {
    const m = APPEARANCE.exec(p.trim());
    if (!m || +m[1] < 1) return null;
    return { day: +m[1], stage: m[3].trim() };
  });
}

export function parseUltraEuropeArtists(html, { year } = {}) {
  const text = String(html);
  const title = plain(/<title>([\s\S]*?)<\/title>/i.exec(text)?.[1] || "");
  // qTranslate writes the English and Croatian titles together.
  if (!/^Artists(Umjetnici)? « Ultra Europe/.test(title)) throw new Error(`ultra-europe-artists: the title "${title}" is not Ultra Europe's Artists page`);
  const timers = [...text.matchAll(/timer:\s*"([^"]*)"/g)].map(m => m[1]);
  if (timers.length !== 1) throw new Error(`ultra-europe-artists: the page prints ${timers.length} countdowns, not one`);
  const opens = countdownDate(timers[0]);
  if (!opens || !opens.startsWith(`${year}-`)) throw new Error(`ultra-europe-artists: the countdown "${timers[0]}" is not a moment in ${year}`);
  const grid = [...text.matchAll(/<a href="[^"]*#([^"]*)">\s*<div class="artist">[\s\S]*?<div class="name[^"]*">([\s\S]*?)<\/div>/g)].map(m => ({ slug: m[1], name: plain(m[2]) }));
  const blocks = [...text.matchAll(/<div id="([^"]*)" class="selected-artist">\s*<div class="name[^"]*">([\s\S]*?)<\/div>\s*<div class="perform">([\s\S]*?)<\/div>/g)]
    .map(m => ({ slug: m[1], name: plain(m[2]), perform: plain(m[3]) }));
  if (!blocks.length) throw new Error("ultra-europe-artists: no act");
  if (text.split('class="selected-artist"').length - 1 !== blocks.length) throw new Error("ultra-europe-artists: an act block the reader does not understand");
  if (JSON.stringify(grid.map(g => [g.slug, g.name])) !== JSON.stringify(blocks.map(b => [b.slug, b.name])))
    throw new Error("ultra-europe-artists: the grid and the act blocks do not name the same acts in the same order");
  const acts = blocks.map(b => {
    if (!b.name) throw new Error(`ultra-europe-artists: the act #${b.slug} has no name`);
    if (!b.perform) throw new Error(`ultra-europe-artists: ${b.name} prints no appearance`);
    const apps = appearances(b.perform);
    if (apps.some(a => !a)) throw new Error(`ultra-europe-artists: ${b.name}'s appearance "${b.perform}" cannot be read`);
    const keys = apps.map(a => `${a.day}\t${a.stage}`);
    if (new Set(keys).size !== keys.length) throw new Error(`ultra-europe-artists: ${b.name} is printed twice on one day and stage`);
    return { artist: b.name, slug: b.slug, appearances: apps };
  });
  const names = acts.map(a => a.artist);
  const dup = names.find((n, i) => names.indexOf(n) !== i);
  if (dup) throw new Error(`ultra-europe-artists: ${dup} is listed twice`);
  return { title, countdown: timers[0], opens, acts };
}
