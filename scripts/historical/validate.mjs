// validate.mjs — every rule a historical edition must satisfy before it ships.
// Returns a list of problems; empty means valid. Used by the verify gate
// (scripts/test-historical-editions.mjs) and by the build during review.

import { EDITIONS, dropReason } from "./editions.mjs";
import { dayMinutes, weekdayOf } from "./lib.mjs";

// The festival's own web properties. A capture of anything else is not an
// official source, however accurate it looks.
export const OFFICIAL_HOSTS = {
  "governors-ball": ["governorsballmusicfestival.com", "cdn.prod.website-files.com"],
  "lollapalooza": ["lollapalooza.com", "cdn.prod.website-files.com"],
  "hard-summer": ["hardsummer.com"],
  "edc-lv": ["lasvegas.electricdaisycarnival.com"],
  "acl": ["aclfestival.com", "cdn.prod.website-files.com"],
};

const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;
const WAYBACK = /^https:\/\/web\.archive\.org\/web\/(\d{14})\/(https?:\/\/[^/]+)\//;

function officialArchive(url, festivalId, year, p, label) {
  const m = WAYBACK.exec(url || "");
  if (!m) return p.push(`${label}: "${url}" is not a Wayback archive URL`);
  const host = new URL(m[2]).hostname.replace(/^www\./, "");
  if (!(OFFICIAL_HOSTS[festivalId] || []).some(h => host === h || host.endsWith("." + h)))
    p.push(`${label}: ${host} is not an official ${festivalId} property`);
  return m[1];
}

// Every string an edition carries, plus each ":"-scoped segment of an id, so a
// dropped billing is found whether it comes back as a name, a label or a slug.
const strings = x => typeof x === "string" ? [x, ...x.split(":").slice(1)]
  : x && typeof x === "object" ? Object.values(x).flatMap(strings) : [];

// `dropped` is ledger/<id>.json's record of the printed rows the build left out.
export function validateEdition(e, { expected, review, dropped = [] } = {}) {
  const p = [];
  const meta = EDITIONS[e.id];
  if (!meta) return [`${e.id}: not a registered historical edition`];
  if (e.year !== meta.year || !e.id.endsWith(`-${e.year}`)) p.push(`${e.id}: id/year disagree (year ${e.year})`);
  if (e.festivalId !== meta.festivalId) p.push(`${e.id}: festivalId ${e.festivalId} ≠ ${meta.festivalId}`);
  if (e.days.length !== meta.dates.length) p.push(`${e.id}: ${e.days.length} days, the edition has ${meta.dates.length}`);
  e.days.forEach((d, i) => {
    const [date, wd] = meta.dates[i] || [];
    if (d.day !== i + 1 || d.date !== date) p.push(`${e.id}: day ${d.day} is ${d.date}, expected day ${i + 1} = ${date}`);
    if (!d.date?.startsWith(String(e.year))) p.push(`${e.id}: day ${d.day} date ${d.date} is outside ${e.year}`);
    if (d.date && weekdayOf(d.date) !== wd?.toLowerCase()) p.push(`${e.id}: ${d.date} is not a ${wd}`);
  });

  // Provenance: every capture official, archived, and of the right year.
  if (!e.provenance?.captures?.length) p.push(`${e.id}: no provenance captures`);
  for (const c of e.provenance?.captures || []) {
    const url = c.archivedUrl || c.pageArchivedUrl;
    const ts = officialArchive(url, e.festivalId, e.year, p, `${e.id} day ${c.day}`);
    if (ts && !ts.startsWith(String(e.year))) p.push(`${e.id} day ${c.day}: page capture ${ts} is not from ${e.year}`);
    if (c.imageArchivedUrl) officialArchive(c.imageArchivedUrl, e.festivalId, e.year, p, `${e.id} day ${c.day} graphic`);
    if (!/^[0-9a-f]{64}$/.test(c.sha256 || "")) p.push(`${e.id} day ${c.day}: artifact hash missing`);
  }

  // Completeness.
  if (!["complete_schedule", "lineup_only"].includes(e.completeness)) p.push(`${e.id}: completeness "${e.completeness}"`);
  if (e.completeness === "lineup_only") {
    if (e.sets?.length || e.stages?.length) p.push(`${e.id}: lineup_only must carry no stages or sets (no placeholder times)`);
    if (!e.artists?.length) p.push(`${e.id}: lineup_only with no artists`);
    return p;
  }

  const stageIds = new Set(e.stages.map(s => s.id)), artistIds = new Set(e.artists.map(a => a.id));
  if (stageIds.size !== e.stages.length) p.push(`${e.id}: duplicate stage id`);
  if (artistIds.size !== e.artists.length) p.push(`${e.id}: duplicate artist id`);
  // Founder rulings: fireworks, silent disco, unnamed slots and non-music
  // activities are not in the library in ANY form (not an artist, a set, an
  // event, a stage or an id). The ledger holds them as the audit trail.
  if ("events" in e) p.push(`${e.id}: carries an events list; operational rows are dropped, not stored`);
  const hit = new Set();
  for (const x of strings({ stages: e.stages, artists: e.artists, sets: e.sets, events: e.events })) {
    const why = dropReason(x);
    if (why && !hit.has(x)) { hit.add(x); p.push(`${e.id}: dropped ${why.category} "${x}" appears in the edition`); }
  }

  const ids = new Set(), slots = new Set(), used = new Set();
  for (const s of e.sets) {
    const tag = `${e.id} ${s.id}`;
    if (ids.has(s.id)) p.push(`${tag}: duplicate set id`);
    ids.add(s.id);
    if (!s.id.startsWith(e.id + ":")) p.push(`${tag}: id not scoped to its edition`);
    if (!Number.isInteger(s.day) || s.day < 1 || s.day > e.days.length) p.push(`${tag}: day ${s.day} is not an edition day`);
    if (!stageIds.has(s.stageId)) p.push(`${tag}: unknown stage ${s.stageId}`);
    if (!artistIds.has(s.artistId)) p.push(`${tag}: unknown artist ${s.artistId}`);
    if (!HHMM.test(s.start || "")) { p.push(`${tag}: start "${s.start}" is blank or unparseable`); continue; }
    if (s.end == null) { if (!s.openEnd) p.push(`${tag}: end is blank and the row is not marked as printed open-ended`); }
    else if (!HHMM.test(s.end)) p.push(`${tag}: end "${s.end}" unparseable`);
    else {
      const a = dayMinutes(s.start, e.rolloverHour), b = dayMinutes(s.end, e.rolloverHour);
      if (b <= a) p.push(`${tag}: ${s.start}–${s.end} has no positive duration after overnight normalisation`);
      if (b - a > 8 * 60) p.push(`${tag}: ${s.start}–${s.end} runs over 8 hours — a cross-day misread`);
    }
    {
      const k = `${s.day}|${s.stageId}|${s.start}|${s.artistId}`;
      if (slots.has(k)) p.push(`${tag}: duplicate artist-stage-start row`);
      slots.add(k);
      used.add(s.artistId);
    }
  }
  for (const a of e.artists) if (!used.has(a.id)) p.push(`${e.id}: artist ${a.name} has no set`);
  // OCR can return a look-alike letter from another script (Lolla's
  // "ОTОBOKE BEAVER" came back with Cyrillic О). It renders identically and
  // silently breaks search and cross-edition matching, so billing and stage
  // names must be Latin-script letters (accented Latin such as RÜFÜS, BÔA is fine).
  for (const x of [...e.artists, ...e.stages])
    // Letters only: symbols in a stylized billing are real ("€URO TRA$H").
    if (/(?=\p{L})\P{Script=Latin}/u.test(x.name)) p.push(`${e.id}: "${x.name}" contains a non-Latin look-alike character`);

  // Every documented day and stage present; counts locked from the reviewed sheet.
  for (const d of e.days) if (!e.sets.some(s => s.day === d.day)) p.push(`${e.id}: day ${d.day} has no sets`);
  for (const st of e.stages) if (!e.sets.some(s => s.stageId === st.id)) p.push(`${e.id}: stage ${st.name} is empty`);
  if (!expected) p.push(`${e.id}: no locked expected counts`);
  else {
    if (expected.stages !== e.stages.length) p.push(`${e.id}: ${e.stages.length} stages, locked ${expected.stages}`);
    expected.setsPerDay.forEach((n, i) => {
      const got = e.sets.filter(s => s.day === i + 1).length;
      if (got !== n) p.push(`${e.id}: day ${i + 1} has ${got} sets, locked ${n}`);
    });
    if (!expected.droppedPerDay) p.push(`${e.id}: no locked droppedPerDay`);
    else expected.droppedPerDay.forEach((n, i) => {
      const got = dropped.filter(r => r.day === i + 1).length;
      if (got !== n) p.push(`${e.id}: day ${i + 1} drops ${got} printed rows, locked ${n}`);
    });
  }

  // Image-derived editions need a signed review manifest that covers every row.
  if (e.provenance?.extractionMethod === "official_image_transcription") {
    if (!review) p.push(`${e.id}: image-derived edition has no visual-review manifest`);
    else {
      for (const c of e.provenance.captures) {
        const r = review.days?.find(d => d.day === c.day);
        if (!r) { p.push(`${e.id} day ${c.day}: not in the review manifest`); continue; }
        if (r.sha256 !== c.sha256) p.push(`${e.id} day ${c.day}: reviewed a different graphic (hash mismatch)`);
        if (!r.reviewer || !r.reviewedAt) p.push(`${e.id} day ${c.day}: review not signed`);
        // Every printed row was confirmed; each one is either a set or a recorded drop.
        const kept = e.sets.filter(s => s.day === c.day).length, gone = dropped.filter(s => s.day === c.day).length;
        if (r.rowsConfirmed !== kept + gone) p.push(`${e.id} day ${c.day}: ${r.rowsConfirmed} rows confirmed against pixels, edition keeps ${kept} and drops ${gone}`);
      }
    }
  }
  return p;
}
