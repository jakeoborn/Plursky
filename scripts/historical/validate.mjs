// validate.mjs — every rule a historical edition must satisfy before it ships.
// Returns a list of problems; empty means valid. Used by the verify gate
// (scripts/test-historical-editions.mjs) and by the build during review.

import { EDITIONS, PRINTED_NON_LATIN, dropReason } from "./editions.mjs";
import { citeToken, datedLabel, dayMinutes, graphicPrints, receiptGaps, sameGraphic, weekdayOf } from "./lib.mjs";

// The festival's own web properties. A capture of anything else is not an
// official source, however accurate it looks.
export const OFFICIAL_HOSTS = {
  "governors-ball": ["governorsballmusicfestival.com", "cdn.prod.website-files.com"],
  "lollapalooza": ["lollapalooza.com", "cdn.prod.website-files.com"],
  "hard-summer": ["hardsummer.com"],
  "edc-lv": ["lasvegas.electricdaisycarnival.com"],
  "acl": ["aclfestival.com", "cdn.prod.website-files.com"],
  "beyond-wonderland-socal": ["socal.beyondwonderland.com"],
  "beyond-wonderland-gorge": ["pnw.beyondwonderland.com"],
  "escape-halloween": ["escapehalloween.com"],
  "edc-orlando": ["orlando.electricdaisycarnival.com"],
  "nocturnal-wonderland": ["nocturnalwonderland.com"],
};

// Where an official graphic may be re-hosted for an `official_sources`
// edition (ruling A): the image must visibly be the festival's own graphic,
// and the page it was found on is recorded with its publish date. A first-
// party capture replaces it when one turns up.
export const REHOST_HOSTS = {
  "pbs.twimg.com": "X (Twitter) media",
  "edmidentity.com": "EDM Identity",
};

// Where the page citing a graphic may live, by the graphic's host: EDM
// Identity posts carry their own uploads and X media they re-upload.
export const RECEIPT_HOSTS = {
  "edmidentity.com": ["edmidentity.com"],
  "pbs.twimg.com": ["edmidentity.com"],
};

const DAY = /^\d{4}-\d{2}-\d{2}$/;
const hostOf = u => { try { return new URL(u).hostname.replace(/^www\./, ""); } catch { return ""; } };

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
  if (e.provenance?.extractionMethod === "official_sources") officialSources(e, meta, p);
  else for (const c of e.provenance?.captures || []) {
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
  // Founder rulings: the Bonus Tracks stage, fireworks, silent disco, unnamed
  // slots and non-music activities are not in the library in ANY form (not an artist, a set, an
  // event, a stage or an id). The ledger holds them as the audit trail.
  if ("events" in e) p.push(`${e.id}: carries an events list; operational rows are dropped, not stored`);
  const hit = new Set();
  for (const x of strings({ stages: e.stages, artists: e.artists, sets: e.sets, events: e.events })) {
    // Each string is tried as a billing and as a stage name.
    const why = dropReason(x, x);
    if (why && !hit.has(x)) { hit.add(x); p.push(`${e.id}: dropped ${why.category} "${x}" appears in the edition`); }
  }
  // A stage-scoped rule (Kinetic Field's show segments) only fires with the
  // set's own stage, so each set's billing is tried on the stage it plays.
  const stageName = new Map(e.stages.map(s => [s.id, s.name])), artistName = new Map(e.artists.map(a => [a.id, a.name]));
  for (const s of e.sets) {
    const billing = s.billing || artistName.get(s.artistId) || "", why = dropReason(billing, stageName.get(s.stageId) || "");
    if (why && !hit.has(billing)) { hit.add(billing); p.push(`${e.id}: dropped ${why.category} "${billing}" appears in the edition`); }
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
    if (/(?=\p{L})\P{Script=Latin}/u.test(x.name) && !(PRINTED_NON_LATIN[e.id] || []).includes(x.name)) p.push(`${e.id}: "${x.name}" contains a non-Latin look-alike character`);

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

  // Every printed row of an official_sources day came from exactly one of
  // its sources: the sources' row counts sum to what the day keeps and drops.
  // Each graphic was reviewed against its pixels, row for row.
  if (e.provenance?.extractionMethod === "official_sources") {
    for (const d of e.days) {
      const caps = e.provenance.captures.filter(c => c.day === d.day);
      const kept = e.sets.filter(s => s.day === d.day).length, gone = dropped.filter(s => s.day === d.day).length;
      const sum = caps.reduce((n, c) => n + (c.rows || 0), 0);
      if (sum !== kept + gone) p.push(`${e.id} day ${d.day}: sources account for ${sum} printed rows, edition keeps ${kept} and drops ${gone}`);
    }
    const graphics = e.provenance.captures.filter(c => c.kind === "graphic");
    if (graphics.length && !review) p.push(`${e.id}: re-hosted graphics with no visual-review manifest`);
    else for (const c of graphics) {
      const r = review.days?.find(x => x.day === c.day && x.sha256 === c.sha256);
      if (!r) { p.push(`${e.id} day ${c.day}: graphic ${c.sha256?.slice(0, 12)} is not in the review manifest (or was reviewed as a different file)`); continue; }
      if (!r.reviewer || !r.reviewedAt) p.push(`${e.id} day ${c.day}: review not signed`);
      if (r.rowsConfirmed !== c.rows) p.push(`${e.id} day ${c.day}: ${r.rowsConfirmed} rows confirmed against the graphic's pixels, the source claims ${c.rows}`);
      if (r.imageUrl !== c.imageUrl) p.push(`${e.id} day ${c.day}: the review of ${c.sha256?.slice(0, 12)} names image ${r.imageUrl || "(none)"}, the source cites ${c.imageUrl}`);
    }
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

// official_sources: each capture is either an archived official page or an
// official graphic with a dated re-host receipt. Either way it must print the
// day it is cited for.
function officialSources(e, meta, p) {
  const lastDay = meta.dates[meta.dates.length - 1][0];
  for (const c of e.provenance.captures) {
    const tag = `${e.id} day ${c.day}`, date = meta.dates[c.day - 1]?.[0];
    if (!date) { p.push(`${tag}: a source for a day the edition does not have`); continue; }
    if (!/^[0-9a-f]{64}$/.test(c.sha256 || "")) p.push(`${tag}: artifact hash missing`);
    if (!Number.isInteger(c.rows) || c.rows < 1) p.push(`${tag}: source carries no row count`);
    if (c.kind === "page") {
      const ts = officialArchive(c.archivedUrl, e.festivalId, e.year, p, tag);
      // A post-event capture can fall in the next year (Escape 2019's set
      // times survive only in an Aug 2020 capture). Its own day tab must
      // still print this day's weekday and date in the edition year.
      if (ts && !(ts.startsWith(String(e.year)) || ts.startsWith(String(e.year + 1)))) p.push(`${tag}: page capture ${ts} is not from ${e.year} or the year after`);
      if (ts && ts !== c.captureTimestamp) p.push(`${tag}: captureTimestamp ${c.captureTimestamp} ≠ the archived URL's ${ts}`);
      if (datedLabel(c.printed, e.year) !== date) p.push(`${tag}: the page's day tab "${c.printed}" does not print ${date}`);
    } else if (c.kind === "graphic") {
      const host = hostOf(c.imageUrl);
      const official = (OFFICIAL_HOSTS[e.festivalId] || []).some(h => host === h || host.endsWith("." + h));
      if (!official && !REHOST_HOSTS[host]) p.push(`${tag}: graphic host ${host || "(none)"} is neither official nor an approved re-host`);
      if (!/^https:\/\//.test(c.foundAt || "")) p.push(`${tag}: graphic has no page it was found on`);
      else receiptLinks(c, e, official, host, tag, p);
      if (!c.rehostedBy) p.push(`${tag}: graphic does not name who re-hosted it`);
      // The receipt: the re-host was published in the edition's year, no
      // later than its last day (a pre-event schedule, not a later recap).
      if (!DAY.test(c.published || "") || !c.published.startsWith(String(e.year)) || c.published > lastDay)
        p.push(`${tag}: re-host published ${c.published || "(no date)"}, not in ${e.year} on or before ${lastDay}`);
      if (!DAY.test(c.fetchedAt || "")) p.push(`${tag}: graphic has no fetch date`);
      if (!c.printed) p.push(`${tag}: graphic has no printed header recorded`);
      else if (!graphicPrints(c.printed, date, e.year, meta.dates.map(([d]) => d)))
        p.push(`${tag}: the graphic's header "${c.printed}" does not print ${weekdayOf(date)} ${date}`);
      // A styled stage name carried onto the edition's other printing: only
      // case and spacing may change, and the target must be a stage it shows.
      const fold = x => String(x).replace(/\s+/g, "").toLowerCase();
      for (const [from, to] of Object.entries(c.stagesAs || {})) {
        if (fold(from) !== fold(to)) p.push(`${tag}: stagesAs "${from}" → "${to}" renames the stage; only case and spacing may differ`);
        if (!e.stages.some(st => st.name === to)) p.push(`${tag}: stagesAs maps "${from}" onto "${to}", which is not a stage of the edition`);
      }
    } else p.push(`${tag}: source kind "${c.kind}" is neither page nor graphic`);
  }
  for (const [i] of meta.dates.entries()) if (!e.provenance.captures.some(c => c.day === i + 1)) p.push(`${e.id} day ${i + 1}: no source`);
  // Completeness against the receipt pages, not just the chosen sources:
  // every set-times graphic an EDM Identity receipt page shows is used by a
  // source or excluded with its reason (Orlando 2017 shipped without the
  // Corona Electric Beach graphic its own receipt page carried).
  const graphics = e.provenance.captures.filter(c => c.kind === "graphic" && c.receipt);
  for (const c of graphics.filter((c, i) => graphics.findIndex(x => x.receipt.archivedUrl === c.receipt.archivedUrl && x.receipt.cites === c.receipt.cites) === i)) {
    if (hostOf(c.foundAt) !== "edmidentity.com") continue;
    const shown = c.receipt.setTimesGraphics;
    if (!Array.isArray(shown)) p.push(`${e.id} day ${c.day}: receipt ${c.receipt.archivedUrl} does not list the set-times graphics its page shows`);
    else if (!shown.some(t => sameGraphic(t, c.receipt.cites))) p.push(`${e.id} day ${c.day}: receipt ${c.receipt.archivedUrl} lists set-times graphics without the one it cites`);
  }
  const { unused, stale } = receiptGaps(graphics, e.provenance.notUsedGraphics);
  for (const u of unused) p.push(`${e.id}: receipt ${u.page} shows set-times graphic ${u.cites}, which no source uses and notUsedGraphics does not exclude`);
  for (const n of stale) p.push(`${e.id}: notUsedGraphics ${n.cites} is used by a source, on no receipt page, or has no reason`);
}

// A graphic's page is linked to the graphic, not just named: the page sits on
// a host that carries that image host's graphics (an EDM Identity post's
// /YYYY/MM/DD/ path is its publish date), and a Wayback capture of exactly
// that page cites the image. The importer found the citation in the
// capture; the validator holds the record to that page and that image.
function receiptLinks(c, e, official, host, tag, p) {
  const page = hostOf(c.foundAt);
  const allowed = official ? OFFICIAL_HOSTS[e.festivalId] || [] : RECEIPT_HOSTS[host] || [];
  if (!allowed.some(h => page === h || page.endsWith("." + h))) p.push(`${tag}: found-at page ${page} is not where ${host} graphics are cited`);
  const dated = /^\/(\d{4})\/(\d{2})\/(\d{2})\//.exec(new URL(c.foundAt).pathname);
  if (page === "edmidentity.com" && (!dated || dated.slice(1).join("-") !== c.published))
    p.push(`${tag}: found-at page ${c.foundAt} is not dated ${c.published}`);
  const r = c.receipt;
  if (!r) return p.push(`${tag}: graphic has no receipt capture of the page it was found on`);
  const m = WAYBACK.exec(r.archivedUrl || "");
  if (!m || r.archivedUrl !== `https://web.archive.org/web/${m[1]}/${c.foundAt}`) p.push(`${tag}: receipt ${r.archivedUrl || "(none)"} is not a capture of ${c.foundAt}`);
  else if (m[1] !== r.captureTimestamp) p.push(`${tag}: receipt captureTimestamp ${r.captureTimestamp} ≠ its URL's ${m[1]}`);
  if (!/^[0-9a-f]{64}$/.test(r.sha256 || "")) p.push(`${tag}: receipt capture hash missing`);
  if (r.cites !== citeToken(c.imageUrl)) p.push(`${tag}: receipt cites ${r.cites || "(nothing)"}, not the graphic ${citeToken(c.imageUrl)}`);
}
