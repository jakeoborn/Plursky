// unofficial.mjs — lineups that come from somewhere other than the festival's
// own pages: a fan-run timetable (Clashfinder), a news article, Wikipedia, a
// social post or a poster. Jake approved these on 2026-11-27 for the years no
// official page survives, as long as every such year says where its lineup
// came from. They are always lineup_only: no source here is trusted for set
// times.
//
// Each edition's source is fetched once into the research cache (never
// committed): <cache>/unofficial/<edition-id>/source.json (what it is) and
// source.txt (the text as fetched). Its rows are either read by a parser for
// the source's format (Clashfinder's line-up view) or listed by hand in
// rows.tsv; either way every billing must appear in the saved text, and the
// ledger keeps the text's hash.

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { CACHE_DIR } from "./wayback.mjs";

export const METHOD = "unofficial_lineup";
export const sourceDir = id => join(CACHE_DIR, "unofficial", id);

// What a source is, and how the app names it. `label` reads after "From".
export const KINDS = {
  fan_timetable: { label: site => `a fan-made timetable on ${site}`, short: site => `${site} (fan-made)` },
  press: { label: site => `an article on ${site}`, short: site => site },
  wikipedia: { label: () => "Wikipedia", short: () => "Wikipedia" },
  social: { label: site => `a post on ${site}`, short: site => site },
  poster: { label: site => `a lineup poster found on ${site}`, short: site => `${site} (poster)` },
};
// Display names for the hosts a source can sit on; anything else is shown as
// its bare host name.
export const SITE_NAMES = {
  "clashfinder.com": "Clashfinder", "en.wikipedia.org": "Wikipedia", "instagram.com": "Instagram", "facebook.com": "Facebook",
  "x.com": "X", "twitter.com": "X", "residentadvisor.net": "Resident Advisor", "ra.co": "Resident Advisor",
  "edm.com": "EDM.com", "billboard.com": "Billboard", "mixmag.net": "Mixmag", "dancingastronaut.com": "Dancing Astronaut",
  "youredm.com": "Your EDM", "edmtunes.com": "EDMTunes", "rollingstone.com": "Rolling Stone", "pitchfork.com": "Pitchfork",
  "consequence.net": "Consequence", "nme.com": "NME", "djmag.com": "DJ Mag", "edmidentity.com": "EDM Identity",
  "efestivals.co.uk": "eFestivals", "festicket.com": "Festicket", "songkick.com": "Songkick", "setlist.fm": "setlist.fm",
  "1001tracklists.com": "1001Tracklists", "musicfestivalwizard.com": "Music Festival Wizard", "edmmaniac.com": "EDM Maniac",
};
export const hostOf = u => { try { return new URL(u).hostname.replace(/^(www|m|mobile)\./, ""); } catch { return ""; } };
export const siteName = host => SITE_NAMES[host] || host;
export const sourceLabel = src => KINDS[src.kind]?.label(siteName(src.site)) || siteName(src.site);
export const sourceShort = src => KINDS[src.kind]?.short(siteName(src.site)) || siteName(src.site);

// The fields a ledger's source must carry. Returns a list of problems.
const DAY = /^\d{4}-\d{2}-\d{2}$/;
export function sourceProblems(src, tag) {
  const p = [];
  if (!src || typeof src !== "object") return [`${tag}: no source`];
  if (!KINDS[src.kind]) p.push(`${tag}: unknown source kind "${src.kind}"`);
  if (!/^https:\/\/[^/\s]+\/\S*$/.test(src.url || "")) p.push(`${tag}: source url ${src.url || "(none)"} is not an https address`);
  else if (hostOf(src.url) !== src.site) p.push(`${tag}: source url ${src.url} is not on ${src.site}`);
  if (/[?&](user|token|session|sid|auth)[^=]*=/i.test(src.url || "")) p.push(`${tag}: source url carries a user or session parameter`);
  if (!src.title) p.push(`${tag}: source has no title`);
  if (!DAY.test(src.fetchedAt || "")) p.push(`${tag}: source has no fetch date`);
  if (src.published != null && !DAY.test(src.published)) p.push(`${tag}: source published "${src.published}" is not a date`);
  if (!["full", "partial"].includes(src.scope)) p.push(`${tag}: source scope "${src.scope}" is neither full nor partial`);
  if (!/^[0-9a-f]{64}$/.test(src.sha256 || "")) p.push(`${tag}: source text hash missing`);
  return p;
}

// A billing appears in a text when its letters and digits do, in order, with
// only spacing, punctuation and case between: "Martin Garrix" is in
// "MARTIN GARRIX," and "Chase & Status" in "Chase &amp; Status".
const fold = s => s.normalize("NFKD").replace(/[̀-ͯ]/g, "").replace(/&amp;/g, "&").toLowerCase().replace(/[^\p{L}\p{N}&+]+/gu, " ").trim();
export const billedIn = (text, billing) => {
  const b = fold(billing);
  return !!b && ` ${fold(text)} `.includes(` ${b} `);
};

export function readSource(id) {
  const dir = sourceDir(id), meta = join(dir, "source.json"), txt = join(dir, "source.txt");
  if (!existsSync(meta) || !existsSync(txt)) throw new Error(`${id}: no saved source in ${dir} (source.json and source.txt)`);
  return { meta: JSON.parse(readFileSync(meta, "utf8")), text: readFileSync(txt, "utf8"), dir };
}

// ── Clashfinder's line-up view (/m/<event>/), as markdown ──
// "# <title>", then per day "## Wednesday 7th August", per stage "### Stage",
// then one line per set "16:00 - 17:15The Act". A day heading carries no
// year; its weekday must be true of the edition's date with that day and
// month. The fetch may insert zero-width spaces inside a weekday.
const MONTHS = ["january","february","march","april","may","june","july","august","september","october","november","december"];
const WEEKDAYS = ["sunday","monday","tuesday","wednesday","thursday","friday","saturday"];
export function clashfinderDay(heading, dates) {
  const m = /^(\w+)\s+(\d{1,2})(?:st|nd|rd|th)?\s+([A-Za-z]+)$/.exec(heading.replace(/[​-‍﻿]/g, "").trim());
  if (!m) return null;
  const wd = m[1].toLowerCase(), dom = +m[2], mon = MONTHS.indexOf(m[3].toLowerCase());
  if (!WEEKDAYS.includes(wd) || mon < 0) return null;
  const i = dates.findIndex(d => { const t = new Date(d + "T12:00:00Z"); return t.getUTCDate() === dom && t.getUTCMonth() === mon && WEEKDAYS[t.getUTCDay()] === wd; });
  return i < 0 ? null : i + 1;
}
export function parseClashfinder(md) {
  const lines = md.replace(/\r/g, "").split("\n").map(l => l.replace(/[​-‍﻿]/g, "").trim()).filter(Boolean);
  const title = (lines.find(l => /^# /.test(l)) || "").slice(2).trim();
  const days = [];
  let day = null, stage = null;
  for (const l of lines) {
    let m;
    if ((m = /^## (.+)$/.exec(l))) { days.push(day = { heading: m[1].trim(), stages: [] }); stage = null; continue; }
    if ((m = /^### (.+)$/.exec(l))) { if (!day) throw new Error(`stage "${m[1]}" before any day`); day.stages.push(stage = { name: m[1].trim(), acts: [] }); continue; }
    if ((m = /^(\d{2}:\d{2}) - (\d{2}:\d{2})\s*(.+)$/.exec(l))) {
      if (!stage) throw new Error(`set "${l}" outside a stage`);
      stage.acts.push({ start: m[1], end: m[2], act: m[3].trim() });
    }
  }
  if (!title) throw new Error("no title");
  if (!days.length || !days.some(d => d.stages.some(s => s.acts.length))) throw new Error("no sets");
  return { title, days };
}
