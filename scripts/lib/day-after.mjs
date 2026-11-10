// The day-after card: "the story of the night" for one festival day, on that
// festival's page, the morning after (PM spec Nov 9 row 9; concept spec
// plursky-festival-day-after-2026-10-03).
//
// Locked shape:
//   - link-only: every source is an OFFICIAL recap post this repo already
//     verified in data/official-embeds.json (same festival, same day, verified
//     ok for that exact record). No embeds, no media, no third-party script.
//   - Plur drafts the copy; Instinct checks every claim against official
//     sources (`claimCheck`); an approver looks before it goes out (`approval`).
//     Only a `published` record carrying both renders, and only from 08:00
//     festival-local time the day after.
//   - fails closed: one malformed record stops the build, whatever its status.
//
// Set times are never typed into copy: a chapter names `artist`, and the card
// prints that act's stage and time from the schedule the page already renders.

import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { validateEmbed, embedSig, accountKey } from './official-embeds.mjs';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

export const STATUSES = ['draft', 'review', 'published', 'withdrawn'];
export const LIMITS = { title: 60, summary: 280, chapterTitle: 70, caption: 220, chapters: 6, sources: 2 };
const MORNING_HOUR = 8;
const PLATFORM = { youtube: 'YouTube', x: 'X', instagram: 'Instagram' };
const DAY_NAME_RE = /^(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)$/;

export function loadDayAfter(root = REPO) {
  const p = path.join(root, 'data', 'day-after.json');
  return existsSync(p) ? JSON.parse(readFileSync(p, 'utf8')) : {};
}

// Wall-clock time in an IANA zone → UTC ms. DST-safe: the offset is read for
// the instant itself, then re-read once in case the guess crossed a change.
export function zonedToUtc(tz, y, m0, d, h, min = 0) {
  const guess = Date.UTC(y, m0, d, h, min);
  const offsetAt = (ms) => {
    const p = Object.fromEntries(new Intl.DateTimeFormat('en-US', { timeZone: tz, hourCycle: 'h23', year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric' })
      .formatToParts(new Date(ms)).filter(x => x.type !== 'literal').map(x => [x.type, Number(x.value)]));
    return Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute) - ms;
  };
  const first = guess - offsetAt(guess);
  return guess - offsetAt(first);
}

// 08:00 festival-local on the calendar day after this festival day.
export function morningAfterMs(cfg, day) {
  const e = (cfg.dayDates || {})[day];
  if (!e || !cfg.tz) return null;
  return zonedToUtc(cfg.tz, e.y, e.m, e.d + 1, MORNING_HOUR);
}

// Plain text only: no markup, no URLs, no control characters. Copy is ours;
// links come only from the verified source list.
function textError(v, max, what) {
  if (typeof v !== 'string' || !v.trim()) return `${what} is missing`;
  if (v !== v.trim()) return `${what} has leading or trailing space`;
  if (v.length > max) return `${what} is over ${max} characters`;
  if (/[<>]/.test(v)) return `${what} contains markup`;
  if (/https?:|www\./i.test(v)) return `${what} contains a link; sources go in sources[]`;
  if (/[\u0000-\u001f]/.test(v)) return `${what} contains a control character`;
  return null;
}
const isDate = v => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v);
const signOff = (v, what) => (!v || typeof v !== 'object' || typeof v.by !== 'string' || !v.by.trim() || !isDate(v.at)) ? `${what} needs {by, at: YYYY-MM-DD}` : null;

// Every problem with one record, [] when clean. ctx = { cfg, acts, embeds }:
// the festival config, its schedule rows ({name, day, stage, start, end}) and
// loadEmbedData()'s { curated, verified }.
export function validateDayAfter(fid, rec, ctx) {
  const errs = [];
  const add = e => { if (e) errs.push(e); };
  if (!rec || typeof rec !== 'object') return ['record is not an object'];
  const known = new Set(['id', 'day', 'status', 'title', 'summary', 'chapters', 'drafted', 'claimCheck', 'approval', 'publishedAt', 'withdrawnReason']);
  for (const k of Object.keys(rec)) if (!known.has(k)) errs.push(`unknown field ${k}`);
  if (typeof rec.id !== 'string' || !/^[a-z0-9-]+$/.test(rec.id)) errs.push('id must be lowercase letters, digits and dashes');
  if (!STATUSES.includes(rec.status)) errs.push(`unknown status ${rec.status}`);
  const cfg = ctx.cfg;
  if (!cfg) return [...errs, `festival ${fid} is not in the registry`];
  if (!Number.isInteger(rec.day) || !(cfg.dayDates || {})[rec.day]) errs.push(`day ${rec.day} is not a ${fid} festival day`);
  if (!cfg.tz) errs.push(`${fid} has no tz, so "the morning after" is undefined`);
  add(textError(rec.title, LIMITS.title, 'title'));
  add(textError(rec.summary, LIMITS.summary, 'summary'));
  add(signOff(rec.drafted, 'drafted'));
  if (!Array.isArray(rec.chapters) || !rec.chapters.length || rec.chapters.length > LIMITS.chapters) errs.push(`chapters must be 1-${LIMITS.chapters}`);
  const seen = new Set();
  for (const [i, ch] of (Array.isArray(rec.chapters) ? rec.chapters : []).entries()) {
    const at = `chapter ${i + 1}`;
    if (!ch || typeof ch !== 'object') { errs.push(`${at} is not an object`); continue; }
    for (const k of Object.keys(ch)) if (!['title', 'caption', 'artist', 'sources'].includes(k)) errs.push(`${at}: unknown field ${k}`);
    add(textError(ch.title, LIMITS.chapterTitle, `${at} title`));
    add(textError(ch.caption, LIMITS.caption, `${at} caption`));
    if (ch.artist !== undefined && !(ctx.acts || []).some(a => a.name === ch.artist && Number(a.day) === rec.day && a.stage && a.start && a.end))
      errs.push(`${at}: ${ch.artist} has no timed set on day ${rec.day} in the official schedule`);
    if (!Array.isArray(ch.sources) || !ch.sources.length || ch.sources.length > LIMITS.sources) { errs.push(`${at}: sources must be 1-${LIMITS.sources} URLs`); continue; }
    for (const url of ch.sources) {
      if (typeof url !== 'string') { errs.push(`${at}: a source is not a string`); continue; }
      if (seen.has(url)) errs.push(`${at}: ${url} is already used in this recap`);
      seen.add(url);
      const e = (ctx.embeds.curated[fid] || []).find(x => x.url === url);
      if (!e) { errs.push(`${at}: ${url} is not an official post on record for ${fid}`); continue; }
      const bad = validateEmbed(e);
      if (bad) { errs.push(`${at}: ${url} fails the official-post check (${bad})`); continue; }
      if (!PLATFORM[e.platform]) errs.push(`${at}: ${e.platform} is not a link platform here`);
      if (e.kind !== 'recap' || e.day !== rec.day) errs.push(`${at}: ${url} is not an official recap of day ${rec.day}`);
      if (ch.artist !== undefined && e.artist !== undefined && e.artist !== ch.artist) errs.push(`${at}: ${url} is the official post for ${e.artist}, not ${ch.artist}`);
      const r = ctx.embeds.verified.results?.[url];
      if (!r || r.ok !== true || r.sig !== embedSig(fid, e)) errs.push(`${at}: ${url} has no current verification for this record`);
    }
  }
  if (rec.status === 'published' || rec.status === 'withdrawn') {
    add(signOff(rec.claimCheck, `${rec.status}: claimCheck`));
    add(signOff(rec.approval, `${rec.status}: approval`));
    if (!isDate(rec.publishedAt)) errs.push(`${rec.status}: publishedAt is not YYYY-MM-DD`);
  }
  if (rec.status === 'withdrawn') add(textError(rec.withdrawnReason, 200, 'withdrawnReason'));
  else if (rec.withdrawnReason !== undefined) errs.push('withdrawnReason is only for a withdrawn record');
  return errs;
}

// Every record across every festival; throws listing all problems.
export function assertDayAfter(data, ctxFor) {
  const errs = [];
  for (const [fid, list] of Object.entries(data || {})) {
    if (fid.startsWith('_')) continue;
    if (!Array.isArray(list)) { errs.push(`${fid}: not a list`); continue; }
    const days = new Set();
    for (const rec of list) {
      for (const e of validateDayAfter(fid, rec, ctxFor(fid))) errs.push(`${fid}/${rec && rec.id}: ${e}`);
      if (rec && rec.status === 'published') {
        if (days.has(rec.day)) errs.push(`${fid}: two published recaps for day ${rec.day}`);
        days.add(rec.day);
      }
    }
  }
  if (errs.length) throw new Error(`data/day-after.json:\n  ${errs.join('\n  ')}`);
}

// What a page shows at `nowMs`: published, signed off, the morning after or
// later, in day order. Drafts, review copies and withdrawn records never show.
export function selectDayAfter(fid, data, cfg, nowMs) {
  return (data[fid] || [])
    .filter(r => r.status === 'published' && r.claimCheck && r.approval)
    .filter(r => { const t = morningAfterMs(cfg, r.day); return t != null && nowMs >= t; })
    .sort((a, b) => a.day - b.day);
}

const esc = s => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
const clock = hm => { const [h, m] = String(hm).split(':').map(Number); return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`; };
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const longDate = iso => { const [y, m, d] = iso.split('-').map(Number); return `${MONTHS[m - 1]} ${d}, ${y}`; };

function sourceLink(e) {
  const handle = accountKey(e.platform, e.officialAccount);
  const who = handle ? (handle.startsWith('@') ? handle : '@' + handle) : 'the official account';
  // The account's display case comes from its URL, not the lowercased key.
  const shown = (String(e.officialAccount).match(/(?:youtube\.com\/|(?:x|twitter)\.com\/|instagram\.com\/)(@?[A-Za-z0-9_.-]+)/) || [])[1];
  const name = shown ? (shown.startsWith('@') ? shown : '@' + shown) : who;
  return `<span class="da-one"><a class="da-src" href="${esc(e.url)}" rel="noopener noreferrer" target="_blank">View on ${PLATFORM[e.platform]}</a><span class="da-who">${esc(name)}, official account</span></span>`;
}

// One card per published day. `dayTitle(n)` names the day ("Friday, November 6").
export function dayAfterSection(festivalName, recs, { cfg, acts, embeds, dayTitle, stageName }) {
  if (!recs.length) return '';
  const fid = cfg.id;
  const cards = recs.map(r => {
    const dn = (cfg.dayDates[r.day] || {}).name;
    const lead = DAY_NAME_RE.test(dn || '') ? `${dn}'s story` : `Day ${r.day}'s story`;
    const chapters = r.chapters.map(ch => {
      const act = ch.artist !== undefined ? acts.find(a => a.name === ch.artist && Number(a.day) === r.day) : null;
      const set = act ? `<p class="da-set">Scheduled: ${esc(stageName(act.stage))} · ${clock(act.start)} – ${clock(act.end)}</p>` : '';
      const links = ch.sources.map(u => sourceLink(embeds.curated[fid].find(x => x.url === u))).join('');
      return `        <li>
          <h4>${esc(ch.title)}</h4>${set}
          <p>${esc(ch.caption)}</p>
          <p class="da-links">${links}</p>
        </li>`;
    }).join('\n');
    return `    <article class="da-card" id="day-after-${r.day}" aria-labelledby="da-${r.day}-h">
      <p class="da-label">${esc(lead)} · Curated by Plursky from official posts</p>
      <h3 id="da-${r.day}-h">${esc(r.title)}</h3>
      <p class="da-when">${esc(dayTitle(r.day))} · published ${esc(longDate(r.publishedAt))}</p>
      <p class="da-sum">${esc(r.summary)}</p>
      <ol class="da-chapters">
${chapters}
      </ol>
    </article>`;
  }).join('\n');
  return `
  <section id="day-after" class="day-after" aria-labelledby="day-after-h">
    <h2 id="day-after-h">The story of the night</h2>
    <p class="note">Each link opens the original post from an official ${esc(festivalName)} account on its own platform.</p>
${cards}
  </section>`;
}

// Only emitted with a card, so a page without one is byte-identical.
export const DAY_AFTER_CSS = `
  section.day-after .da-card { background:var(--panel); border:1px solid var(--line); border-radius:14px; padding:16px; margin:16px 0 20px; max-width:620px; box-sizing:border-box; overflow-wrap:anywhere; }
  section.day-after .da-label { color:var(--muted); font-size:13px; font-weight:600; margin:0 0 6px; }
  section.day-after h3 { margin:0 0 4px; }
  section.day-after .da-when { color:var(--muted); font-size:13px; margin:0 0 10px; }
  section.day-after .da-sum { margin:0 0 12px; }
  section.day-after .da-chapters { margin:0; padding-left:20px; }
  section.day-after .da-chapters li { margin:0 0 14px; }
  section.day-after h4 { margin:0 0 2px; font-size:16px; text-transform:none; letter-spacing:normal; color:var(--ink); }
  section.day-after .da-set { color:var(--muted); font-size:13px; margin:0 0 4px; }
  section.day-after .da-chapters p { margin:0 0 6px; }
  section.day-after .da-links { display:flex; flex-wrap:wrap; gap:12px; }
  section.day-after .da-one { display:flex; flex-direction:column; align-items:flex-start; gap:4px; }
  section.day-after a.da-src { display:inline-flex; align-items:center; min-height:44px; padding:0 14px; border:1px solid var(--ember); border-radius:10px; color:var(--ember); font-weight:600; font-size:15px; text-decoration:none; }
  section.day-after a.da-src:focus-visible { outline:2px solid var(--ember); outline-offset:2px; }
  section.day-after .da-who { color:var(--muted); font-size:13px; }`;

// The sitemap fingerprint covers exactly what the cards show.
export const dayAfterFingerprintInput = recs => recs.map(r => JSON.stringify([r.id, r.day, r.title, r.summary, r.publishedAt, r.chapters]));
