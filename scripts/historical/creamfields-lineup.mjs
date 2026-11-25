// creamfields-lineup.mjs — Creamfields' own Lineup page (creamfields.com
// /lineup/, 2022 onwards), read from an archived capture, as a LINEUP: who
// plays which stage on which day. No times.
//
// The page has one block per day and, inside it, one column per stage:
//
//   2022       <section id="tab-friday"> · <h2 class="day-title"><span
//              class="date">AUGUST 2022</span> … <span class="below">FRIDAY
//              LINE-UP</span> · <h3><a …><span>Arc</span></a></h3> ·
//              <li><h4 class="a-name">…</h4>
//   2024       <section id="tab-friday"> · <h2 class="day-title"><span
//              class="title">Friday</span><span class="below">23rd August
//              2024</span> · <h3><span>STEEL YARD <strong>Presented by
//              Gopuff</strong></span></h3> · <li class="a-list-item"><h4 …>
//   2025       <div class="lineup-section" id="panel-friday"> · the same h2 ·
//              <h3><span>Teletech <span class="sub">Artists A-Z</span></span>
//              · <li class="a-list-item"><strong class="a-name">…
//
// An act may carry a line above its name (<span class="box-above">SPECIAL
// GUEST</span>), one after it (<span class="inline-after">LIVE</span>) and one
// below it (<span class="below-highlight">Just Added</span>, or 2024's
// <span class="below-small">Presents Game Time</span>). "B2B" after or
// below a name joins it to the next act in the column ("Alex Farell B2B" then
// "Sikoti"). A column may end "+ more": the page did not print the rest of
// that stage.
//
// Throws on anything it cannot confirm: a title it does not know, no day, a
// day it cannot name, a printed date outside the year, a stage or act with no
// name, text in an act's entry it does not place, or "B2B" with no act after.

import { plain, WEEKDAYS } from "./creamfields-artists.mjs";

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const cap = w => w[0].toUpperCase() + w.slice(1).toLowerCase();

// "21st August 2025" → "2025-08-21".
export function printedDate(s) {
  const m = /^(\d{1,2})(?:st|nd|rd|th) ([A-Za-z]+) (\d{4})$/.exec(s);
  const mo = m && MONTHS.indexOf(cap(m[2]));
  if (!m || mo < 0) return null;
  const iso = `${m[3]}-${String(mo + 1).padStart(2, "0")}-${m[1].padStart(2, "0")}`;
  return new Date(iso + "T12:00:00Z").toISOString().slice(0, 10) === iso ? iso : null;
}
const weekdayOf = iso => WEEKDAYS[(new Date(iso + "T12:00:00Z").getUTCDay() + 6) % 7];

// Text in `s` outside every element matched by `re`, and what each matched.
const take = (s, re) => { const got = []; const rest = s.replace(re, (_, x) => { got.push(plain(x)); return " "; }); return { rest, got }; };

function parseStage(h3attrs, inner) {
  const silent = /class="silent-disco"/.test(h3attrs);
  let { rest, got: hidden } = take(inner, /<span class="visually-hidden">([\s\S]*?)<\/span>/g);
  if (hidden.some(h => h !== ": Silent disco (low noise event)") || (hidden.length && !silent)) throw new Error(`creamfields-lineup: a stage heading hides "${hidden.join(" ")}"`);
  const sub = take(rest, /<(?:span class="sub"|strong)>([\s\S]*?)<\/(?:span|strong)>/g);
  if (sub.got.length > 1) throw new Error(`creamfields-lineup: a stage heading prints ${sub.got.length} subtitles`);
  const name = plain(sub.rest);
  if (!name) throw new Error("creamfields-lineup: a stage with no name");
  return { name, sub: sub.got[0] || "", silent };
}

// An act's name may carry the class "force-to-lower": the page shows it in
// lower case (2022's "T&gt;l B2B LEVELA" reads "t>l b2b levela"), and it is
// billed as shown. Any other class on the name is one this does not know.
function parseAct(li) {
  const above = take(li, /<span class="box-above">([\s\S]*?)<\/span>/g);
  const below = take(above.rest, /<span class="below-(?:highlight|small)">([\s\S]*?)<\/span>/g);
  const after = take(below.rest, /<span class="inline-after">([\s\S]*?)<\/span>/g);
  const classes = [];
  const nm = take(after.rest.replace(/<(h4|strong) class="a-name([^"]*)">/g, (_, t, c) => { classes.push(c.trim()); return `<${t} class="a-name">`; }),
    /<(?:h4|strong) class="a-name">([\s\S]*?)<\/(?:h4|strong)>/g);
  if (nm.got.length !== 1 || !nm.got[0]) throw new Error(`creamfields-lineup: an act's entry holds ${nm.got.length} names: "${plain(li).slice(0, 80)}"`);
  if (classes[0] && classes[0] !== "force-to-lower") throw new Error(`creamfields-lineup: ${nm.got[0]}'s name carries the class "${classes[0]}"`);
  const left = plain(nm.rest.replace(/<br\s*\/?>/g, " "));
  if (left) throw new Error(`creamfields-lineup: ${nm.got[0]}'s entry also prints "${left}"`);
  for (const x of [above, below, after]) if (x.got.length > 1) throw new Error(`creamfields-lineup: ${nm.got[0]} carries two lines in one place`);
  const lowered = classes[0] === "force-to-lower";
  return { name: lowered ? nm.got[0].toLowerCase() : nm.got[0], ...(lowered && { printed: nm.got[0] }), above: above.got[0] ?? null, after: after.got[0] ?? null, below: below.got[0] ?? null };
}

export function parseCreamfieldsLineup(html, { year } = {}) {
  const text = String(html);
  const title = plain(/<title>([\s\S]*?)<\/title>/i.exec(text)?.[1] || "");
  // 2022 names the year in the title; 2024-2025's title names none, and the
  // year is proved by the dates each day prints.
  const titled = title === `cinch presents Creamfields ${year} | Arenas`;
  if (!titled && title !== "Rockstar Energy presents Creamfields | lineup") throw new Error(`creamfields-lineup: the title "${title}" is not a Creamfields ${year} lineup page`);
  const starts = [...text.matchAll(/<(?:section|div class="lineup-section[^"]*") id="(?:tab|panel)-(\w+)"/g)];
  const days = [];
  starts.forEach((m, i) => {
    if (/^featured?$/.test(m[1])) return;
    const block = text.slice(m.index, starts[i + 1]?.index ?? text.length);
    const h2 = /<h2 class="day-title">([\s\S]*?)<\/h2>/.exec(block)?.[1] || "";
    const span = c => plain(new RegExp(`<span class="${c}">([\\s\\S]*?)</span>`).exec(h2)?.[1] || "");
    let weekday, date = null;
    if (span("title")) {
      weekday = cap(span("title"));
      date = printedDate(span("below"));
      if (!date) throw new Error(`creamfields-lineup: ${weekday} prints "${span("below")}", not a date`);
      if (date.slice(0, 4) !== String(year)) throw new Error(`creamfields-lineup: ${weekday} is dated ${date}, not in ${year}`);
      if (weekdayOf(date) !== weekday) throw new Error(`creamfields-lineup: ${date} is a ${weekdayOf(date)}, not a ${weekday}`);
    } else {
      // 2022: "AUGUST 2022" above "FRIDAY LINE-UP".
      const w = /^(\w+) LINE-UP$/i.exec(span("below"))?.[1];
      if (!w || !titled || !new RegExp(` ${year}$`).test(span("date"))) throw new Error(`creamfields-lineup: a day block (${m[1]}) prints "${plain(h2)}"`);
      weekday = cap(w);
    }
    if (!WEEKDAYS.includes(weekday) || weekday.toLowerCase() !== m[1].toLowerCase()) throw new Error(`creamfields-lineup: the ${m[1]} block is headed ${weekday}`);
    const stages = [];
    for (const col of block.split(/<div class="listing-col[^"]*">/).slice(1)) {
      const h3 = /<h3([^>]*)>([\s\S]*?)<\/h3>/.exec(col);
      if (!h3) throw new Error(`creamfields-lineup: a ${weekday} column has no stage`);
      const end = col.indexOf("</ul>", h3.index);
      const ul = end < 0 ? "" : col.slice(col.indexOf("<ul>", h3.index), end);
      const acts = ul.split(/<li[^>]*>/).slice(1).map(li => parseAct(li.replace(/<\/li>[\s\S]*$/, "")));
      const more = end >= 0 && /^\s*<\/ul>\s*<span class="plus-more">\s*\+ more\s*<\/span>/.test(col.slice(end));
      stages.push({ ...parseStage(h3[1], h3[2]), acts, more });
    }
    if (days.some(d => d.weekday === weekday)) throw new Error(`creamfields-lineup: ${weekday} printed twice`);
    days.push({ weekday, date, stages });
  });
  if (!days.length) throw new Error("creamfields-lineup: no day");
  return { title, days };
}

// Lines that place an act or a stage's list in the page's layout, not on its
// bill: the rest of a list is A-Z ("Artists A-Z" above 2025's first such act,
// "A-Z" below 2022's last headliner), or an empty box.
const LAYOUT = new Set(["", "A-Z", "Artists A-Z"]);
const isB2B = s => /^B2B$/i.test(s || "");

// The stage a heading bills: its name, with the subtitle when the name only
// introduces it ("Pepsi presents" over "Future Sounds of Egypt"). Any other
// subtitle (a host, a sponsor, "Indoor Main Stage") describes the stage.
const stageName = s => /\bpresents$/i.test(s.name) && s.sub ? `${s.name} ${s.sub}` : s.name;

// The page's acts as rows (artist, weekday, stage), with what the rows leave
// out: subtitles, lines printed with an act, B2B joins, names the page shows
// in lower case, unfinished stages.
//
// A stage printed in spellings that differ only in case (2024's "ARC" and
// "Arc") is one stage, billed under the spelling the page prints most (the
// first printed, on a tie); an act likewise, under its first spelling.
export function creamfieldsLineupRows(page) {
  const billed = [];
  const notes = [], joined = [], stageNotes = [], more = [], lowered = [];
  for (const d of page.days) for (const s of d.stages) {
    const stage = stageName(s);
    if (s.sub && stage === s.name && !LAYOUT.has(s.sub) && !stageNotes.some(x => x.weekday === d.weekday && x.stage === stage && x.subtitle === s.sub)) stageNotes.push({ weekday: d.weekday, stage, subtitle: s.sub });
    if (s.silent && !stageNotes.some(x => x.weekday === d.weekday && x.stage === stage && x.silentDisco)) stageNotes.push({ weekday: d.weekday, stage, silentDisco: true });
    if (s.more) more.push({ weekday: d.weekday, stage });
    for (let i = 0; i < s.acts.length; i++) {
      let a = s.acts[i], name = a.name, lines = [a];
      while (isB2B(a.after) || isB2B(a.below)) {
        const next = s.acts[i + 1];
        if (!next) throw new Error(`creamfields-lineup: ${a.name} is billed B2B with no act after it`);
        name = `${name} B2B ${next.name}`; a = next; lines.push(a); i++;
      }
      for (const x of lines) if (x.printed && !lowered.some(l => l.printed === x.printed)) lowered.push({ printed: x.printed, shownAs: x.name });
      if (lines.length > 1) joined.push({ weekday: d.weekday, stage, printed: lines.map(x => x.name), billedAs: name });
      const printed = lines.flatMap(x => [["above", x.above], ["after", x.after], ["below", x.below]].filter(([, v]) => v !== null && !LAYOUT.has(v) && !isB2B(v)).map(([where, line]) => ({ where, line })));
      if (printed.length) notes.push({ artist: name, weekday: d.weekday, stage, printed });
      billed.push({ artist: name, weekday: d.weekday, stage });
    }
  }
  const count = new Map();
  for (const b of billed) count.set(b.stage, (count.get(b.stage) || 0) + 1);
  for (const d of page.days) for (const s of d.stages) if (!count.has(stageName(s))) count.set(stageName(s), 0);
  const spelling = new Map(), folded = [];
  for (const [s, n] of count) { const k = s.toLowerCase(), best = spelling.get(k); if (best === undefined || n > count.get(best)) spelling.set(k, s); }
  for (const s of count.keys()) if (spelling.get(s.toLowerCase()) !== s) folded.push({ printed: s, billedAs: spelling.get(s.toLowerCase()) });
  const stageOf = s => spelling.get(s.toLowerCase());
  const actName = new Map(), sameActs = [];
  for (const b of billed) {
    const k = b.artist.toLowerCase();
    if (!actName.has(k)) actName.set(k, b.artist);
    else if (actName.get(k) !== b.artist && !sameActs.some(x => x.printed === b.artist)) sameActs.push({ printed: b.artist, billedAs: actName.get(k) });
  }
  const rows = [], seen = new Set();
  for (const b of billed) {
    const r = { artist: actName.get(b.artist.toLowerCase()), weekday: b.weekday, stage: stageOf(b.stage) };
    const k = `${r.artist}\t${r.weekday}\t${r.stage}`;
    if (!seen.has(k)) { seen.add(k); rows.push(r); }
  }
  const fix = x => ({ ...x, stage: stageOf(x.stage) });
  return { rows, folded, sameActs, lowered, joined: joined.map(fix), notes: notes.map(fix), stageNotes: stageNotes.map(fix), more: more.map(fix) };
}
