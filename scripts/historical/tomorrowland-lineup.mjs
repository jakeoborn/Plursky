// tomorrowland-lineup.mjs — Tomorrowland's own LINEUP page (tomorrowland.com
// /en/festival/line-up/stages/…), read from an archived capture. It prints no
// times: who plays which stage on which day, before the festival.
//
// The page holds two tabs, both in the markup at once:
//
//   Stages: <div class="eventdays">, one <div class="eventday"
//     data-eventday="Friday 19 July 2024"> per festival day (both weekends),
//     each with one <div class="stage"> per stage: its name in
//     <div class="stage__heading"><h4>Mainstage</h4>, an optional host for
//     that day in <p class="stage__location">Rampage</p> (the label or act
//     curating the stage, never a stage of its own), and a <ul> with one
//     <li><a class="noTracking" data-artist="slug"> Name </a></li> per act.
//   Artists: <div class="lineup__page--artists">, every act once, A to Z,
//     with the same slug and name.
//
// Throws on anything it cannot confirm: no day, a day header that is not a
// weekday and date in `year`, a day printed twice, a stage with no name or no
// act, an act with no name, or a page with no Artists tab. Disagreements
// between the two tabs are returned as findings for the ledger, not thrown:
// the Stages tab is the lineup, the Artists tab the check on it.

import { datedLabel } from "./lib.mjs";

const ENT = { "&amp;": "&", "&quot;": '"', "&#39;": "'", "&#039;": "'", "&lt;": "<", "&gt;": ">", "&nbsp;": " " };
// An accented letter's named entity (&ouml;, &eacute;) as the letter itself.
const MARK = { uml: "\u0308", acute: "\u0301", grave: "\u0300", circ: "\u0302", tilde: "\u0303", cedil: "\u0327", ring: "\u030a" };
const accent = e => { const m = /^&([A-Za-z])(uml|acute|grave|circ|tilde|cedil|ring);$/.exec(e); return m ? (m[1] + MARK[m[2]]).normalize("NFC") : undefined; };
const unent = s => String(s).replace(/&#?\w+;/g, e => ENT[e] ?? accent(e) ?? (/^&#(\d+);$/.test(e) ? String.fromCodePoint(+e.slice(2, -1)) : e));
export const plain = s => unent(String(s).replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim();
const acts = html => [...String(html).matchAll(/<a class="noTracking" data-artist="([^"]*)">([\s\S]*?)<\/a>/g)].map(m => ({ slug: m[1], name: plain(m[2]) }));

export function parseTomorrowlandLineup(html, { year } = {}) {
  const text = String(html);
  const title = plain(/<title>([\s\S]*?)<\/title>/i.exec(text)?.[1] || "");
  const at = text.indexOf('<div class="eventdays">'), artistsAt = text.indexOf('<div class="lineup__page lineup__page--artists"');
  if (at < 0) throw new Error("tomorrowland-lineup: no Stages tab (eventdays)");
  if (artistsAt < at) throw new Error("tomorrowland-lineup: no Artists tab after the Stages tab");
  const parts = text.slice(at, artistsAt).split(/<div class="eventday" /).slice(1);
  if (!parts.length) throw new Error("tomorrowland-lineup: the Stages tab prints no day");
  const days = [];
  for (const part of parts) {
    const label = plain(/^[^>]*\bdata-eventday="([^"]+)"/.exec(part)?.[1] || "");
    const date = datedLabel(label, year);
    if (!date || !/^[A-Z][a-z]+day \d{1,2} [A-Z][a-z]+ \d{4}$/.test(label)) throw new Error(`tomorrowland-lineup: the day "${label}" is not a weekday and date in ${year}`);
    if (days.some(d => d.date === date)) throw new Error(`tomorrowland-lineup: ${date} is printed twice`);
    const stages = [];
    for (const s of part.split('<div class="stage">').slice(1)) {
      const stage = plain(/<div class="stage__heading">[\s\S]*?<h4>([\s\S]*?)<\/h4>/.exec(s)?.[1] || "");
      if (!stage) throw new Error(`tomorrowland-lineup: a stage on ${label} has no name`);
      const host = plain(/<p class="stage__location">([\s\S]*?)<\/p>/.exec(s)?.[1] || "");
      const list = acts(s);
      if (!list.length) throw new Error(`tomorrowland-lineup: ${stage} on ${label} names no act`);
      if (list.some(a => !a.name || !a.slug)) throw new Error(`tomorrowland-lineup: an act on ${stage} on ${label} has no name`);
      if (stages.some(x => x.stage === stage)) throw new Error(`tomorrowland-lineup: ${stage} is printed twice on ${label}`);
      stages.push({ stage, ...(host && { host }), acts: list });
    }
    if (!stages.length) throw new Error(`tomorrowland-lineup: ${label} prints no stage`);
    days.push({ label, date, stages });
  }
  const az = acts(text.slice(artistsAt));
  if (!az.length) throw new Error("tomorrowland-lineup: the Artists tab names no act");
  // The two tabs, joined by slug.
  const bySlug = new Map(az.map(a => [a.slug, a.name])), findings = [];
  const staged = new Map();
  for (const d of days) for (const s of d.stages) for (const a of s.acts) {
    if (!staged.has(a.slug)) staged.set(a.slug, a.name);
    if (staged.get(a.slug) !== a.name) findings.push(`${a.slug}: printed "${staged.get(a.slug)}" and "${a.name}" on the Stages tab`);
  }
  for (const [slug, name] of staged) {
    if (!bySlug.has(slug)) findings.push(`${name}: on the Stages tab, not on the Artists tab`);
    else if (bySlug.get(slug) !== name) findings.push(`${name}: the Artists tab prints "${bySlug.get(slug)}"`);
  }
  for (const [slug, name] of bySlug) if (!staged.has(slug)) findings.push(`${name}: on the Artists tab, on no stage`);
  return { title, days, artists: az, findings };
}
