// validate.mjs — every rule a historical edition must satisfy before it ships.
// Returns a list of problems; empty means valid. Used by the verify gate
// (scripts/test-historical-editions.mjs) and by the build during review.

import { EDITIONS, KEPT_STAGES, PRINTED_LONG_SETS, PRINTED_NON_LATIN, dropReason } from "./editions.mjs";
import { printedDate as govBallDate } from "./govball-wp-schedule.mjs";
import { tabDate as primaveraDate } from "./primavera-horarios-schedule.mjs";
import { tabRun as primaveraRun } from "./primavera-completos-schedule.mjs";
import { tabDate as szigetDate } from "./sziget-days-schedule.mjs";
import { headerDate as defqonDate } from "./defqon-schedule.mjs";
import { subtitleDate as defqonLogosDate } from "./defqon-logos-schedule.mjs";
import { cardDate as lollaCardDate } from "./lolla-lineup.mjs";
import { printedDate as insomniacDate } from "./insomniac-music-schedule.mjs";
import { titleDate as tmlTitleDate } from "./tml-drupal-schedule.mjs";
import { printedDate as tmlCmsDate } from "./tml-cms-schedule.mjs";
import { readRun as hardRun } from "./hard-wp-schedule.mjs";
import { datesFromPost as shambhalaRun } from "./shambhala-webflow-schedule.mjs";
import { embedPageOk, EMBED_PAGES } from "./dostuff-embed-schedule.mjs";
import { citeToken, datedLabel, dayMinutes, graphicPrints, receiptGaps, sameGraphic, undatedOwnPost, weekdayOf } from "./lib.mjs";

// The festival's own web properties. A capture of anything else is not an
// official source, however accurate it looks.
export const OFFICIAL_HOSTS = {
  "governors-ball": ["governorsballmusicfestival.com", "cdn.prod.website-files.com"],
  // assets-global.website-files.com (the older Webflow CDN hostname, as for
  // ACL below): the archived 2021-2023 lollapalooza.com/schedule captures
  // embed their daily grids from it. Extended to Lollapalooza on 2026-11-19
  // (Plur thread), Lollapalooza grids only; the image must still be embedded
  // on an archived official page and carry its hash and review entry.
  "lollapalooza": ["lollapalooza.com", "cdn.prod.website-files.com", "assets-global.website-files.com"],
  // hardfest.com: HARD's own site, where HARD Summer 2012's page lived
  // (/hardsummer/) before the festival had its own domain.
  "hard-summer": ["hardsummer.com", "hardfest.com"],
  "electric-forest": ["electricforestfestival.com", "electricforest.com"],
  // Ultra's own site. Its WordPress uploads serve resized copies
  // ("-1600x1000.jpg"); only those were archived for 2024.
  "ultra-miami": ["ultramusicfestival.com", "legacy.ultramusicfestival.com"],
  // III Points' own site. Its 2014 schedule page embedded one grid image per
  // day under www.iiipoints.com/Schedule/.
  "iii-points": ["iiipoints.com"],
  // coachella.com, plus two exact folders in AEG's blob store, where
  // coachella.com/schedule embedded its 2025 and 2026 set-times graphics.
  // An entry with a "/" is a host+path prefix: it admits that folder only,
  // never the host. Added 2026-11-21 (Plur thread), Coachella only.
  "coachella": ["coachella.com", "aegwebprod.blob.core.windows.net/content/coachella2025/", "aegwebprod.blob.core.windows.net/content/coachella-2026/"],
  // 2012-2013 Las Vegas pages lived on the brand's root domain
  // (/LasVegas/music.php, /music.php). "=" matches that host alone, so the
  // other cities' subdomains (orlando., mexico.) are never Las Vegas's.
  "edc-lv": ["lasvegas.electricdaisycarnival.com", "=electricdaisycarnival.com"],
  // assets-global.website-files.com is the same Webflow CDN under its older
  // hostname: every archived 2022 aclfestival.com/schedule capture embeds the
  // grids from it (/626ab670470f4322713394d1/). Allowed for ACL (Instinct
  // ruling, SPEC-182, 2026-11-06) and, since 2026-11-19, Lollapalooza only; the image must still be embedded on an
  // archived official page and carry its hash and review entry.
  "acl": ["aclfestival.com", "cdn.prod.website-files.com", "assets-global.website-files.com"],
  // The 2012 and 2013 SoCal lineups lived on the root domain (lineup.php).
  "beyond-wonderland-socal": ["socal.beyondwonderland.com", "beyondwonderland.com"],
  "beyond-wonderland-gorge": ["pnw.beyondwonderland.com"],
  "escape-halloween": ["escapehalloween.com"],
  "edc-orlando": ["orlando.electricdaisycarnival.com"],
  "edc-mexico": ["mexico.electricdaisycarnival.com"],
  "nocturnal-wonderland": ["nocturnalwonderland.com"],
  "countdown-nye": ["countdownnye.com"],
  "dreamstate-socal": ["dreamstateusa.com"],
  // tomorrowland.be: the festival's own site until 2012.
  "tomorrowland": ["tomorrowland.com", "tomorrowland.be"],
  "shambhala": ["shambhalamusicfestival.com"],
  // The schedule grid and act pages lived on the lineup subdomain (DoStuff).
  // 2022-2025: the official lineup page (sfoutsidelands.com/lineup/) loads
  // its widget from one DoStuff host per year (<script src=
  // "https://<host>/embeds/lineup.js">), each seen on the archived page
  // captured seconds before the script. "=" matches that host alone.
  "outside-lands": ["sfoutsidelands.com", "lineup.sfoutsidelands.com", "=sfosl.dostff.co", "=sfosl19.dostff.co", "=22-osl.dostff.co", "=osl23fest.dostff.co", "=fest24outsidelands.dostff.co", "=ds25festlands.dostff.co"],
  // Lightning in a Bottle's site (libfestival.org today); its 2018-2019
  // lineup page loads its widget from one DoStuff host per year.
  "lightning-in-a-bottle": ["lightninginabottle.org", "libfestival.org", "=lib2018.dostff.co", "=lib2019.dostff.co"],
  // primaverasound.es: the festival's own site through 2015 (Barcelona's
  // timetable lived at /horarios); primaverasound.com is its site today.
  "primavera-sound": ["primaverasound.es", "primaverasound.com"],
  // sonar.es: Sónar Barcelona's own site; each year's timetable lives at
  // /en/<year>/schedules.
  "sonar": ["sonar.es"],
  // sziget.hu: the festival's own site through 2013 (its English programme
  // lived at /festival_english/programs); szigetfestival.com is its site today.
  "sziget": ["sziget.hu", "szigetfestival.com"],
  // defqon1.nl: Defqon.1's own site, where each year's timetable lived.
  "defqon1": ["defqon1.nl"],
  // time-warp.de: Time Warp's own site, whose lineup page for the Mannheim
  // edition lived at /mannheim/line-up (2012-2013), /germany/line-up
  // (2014-2018), /germany/lineup (2019, 2023-2024), a year's sub-site (/21/,
  // /22/) or /germany/mannheim/<year>/ (2025).
  "time-warp": ["time-warp.de"],
  // creamfields.com: Creamfields' own site, whose /artists page listed each
  // year's lineup by day and stage.
  "creamfields": ["creamfields.com"],
};

// Where an official graphic may be re-hosted for an `official_sources`
// edition (ruling A): the image must visibly be the festival's own graphic,
// and the page it was found on is recorded with its publish date. A first-
// party capture replaces it when one turns up.
export const REHOST_HOSTS = {
  "pbs.twimg.com": "X (Twitter) media",
  "edmidentity.com": "EDM Identity",
  // The promoter's own CDN and the festival's own Instagram posts: first-party
  // graphics served off a host the festival does not brand. An Instagram
  // graphic must cite the post it belongs to (checked below).
  "cdn-insomniac.s3.amazonaws.com": "Insomniac's CDN",
  "cdninstagram.com": "Instagram media",
};
// A host is in a list when it is an entry or a subdomain of one; an entry
// written "=host" matches that host alone.
export const hostIn = (list, host) => (list || []).some(h => h.startsWith("=") ? host === h.slice(1) : host === h || host.endsWith("." + h));
// A URL is in a list when its host is, or when host+path starts with an entry
// that holds a "/" (a folder on a shared host). hostIn never matches such an
// entry, so a folder entry admits that folder and nothing else on its host.
export const urlIn = (list, url) => {
  let u; try { u = new URL(url); } catch { return false; }
  const host = u.hostname.replace(/^www\./, "");
  return hostIn(list, host) || (list || []).some(h => h.includes("/") && h.endsWith("/") && (host + u.pathname).startsWith(h));
};
const rehostOf = host => Object.keys(REHOST_HOSTS).find(h => host === h || host.endsWith("." + h));

// Where the page citing a graphic may live, by the graphic's host: EDM
// Identity posts carry their own uploads and X media they re-upload; an
// Instagram slide is cited by its own post.
export const RECEIPT_HOSTS = {
  "edmidentity.com": ["edmidentity.com"],
  "pbs.twimg.com": ["edmidentity.com"],
  "cdninstagram.com": ["instagram.com"],
};

const DAY = /^\d{4}-\d{2}-\d{2}$/;
// A Wayback timestamp (YYYYMMDDhhmmss, UTC) in seconds.
const tsSeconds = ts => Date.parse(String(ts).replace(/^(\d{4})(\d\d)(\d\d)(\d\d)(\d\d)(\d\d)$/, "$1-$2-$3T$4:$5:$6Z")) / 1000;
const hostOf = u => { try { return new URL(u).hostname.replace(/^www\./, ""); } catch { return ""; } };

const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;
const WAYBACK = /^https:\/\/web\.archive\.org\/web\/(\d{14})\/(https?:\/\/[^/]+)\//;
const WAYBACK_PREFIX = /^https:\/\/web\.archive\.org\/web\/\d{14}\//;

function officialArchive(url, festivalId, year, p, label) {
  const m = WAYBACK.exec(url || "");
  // Report and return nothing: returning p.push() handed callers a number,
  // and a note citing a non-Wayback URL crashed on ts.startsWith.
  if (!m) { p.push(`${label}: "${url}" is not a Wayback archive URL`); return null; }
  const host = new URL(m[2]).hostname.replace(/^www\./, "");
  if (!urlIn(OFFICIAL_HOSTS[festivalId], url.replace(WAYBACK_PREFIX, "")))
    p.push(`${label}: ${host} is not an official ${festivalId} property`);
  return m[1];
}

// Every string an edition carries, plus each ":"-scoped segment of an id, so a
// dropped billing is found whether it comes back as a name, a label or a slug.
const strings = x => typeof x === "string" ? [x, ...x.split(":").slice(1)]
  : x && typeof x === "object" ? Object.values(x).flatMap(strings) : [];

// `dropped` is ledger/<id>.json's record of the printed rows the build left out.
// A year-end edition (New Year's Eve) is often only captured in the first
// days of January: a capture from the next year counts only when it falls
// within 31 days after the edition's last day.
function earlyNextYear(ts, e) {
  const last = (e.days || []).map(d => d.date).sort().pop();
  if (!last || !ts.startsWith(String(e.year + 1))) return false;
  const cap = Date.UTC(+ts.slice(0, 4), +ts.slice(4, 6) - 1, +ts.slice(6, 8));
  const end = Date.parse(last + "T00:00:00Z");
  return cap > end && cap - end <= 31 * 864e5;
}

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
    if (!!d.untimed !== (meta.untimedDays || []).includes(d.day)) p.push(`${e.id}: day ${d.day} untimed is ${!!d.untimed}, the edition registry says ${!d.untimed}`);
  });
  // Notes are the registry's, verbatim; each is dated and cites an archived
  // official page of the edition's year. An untimed day must be covered by a
  // note that names it, and a cancelled day by an edition-wide note.
  if (JSON.stringify(e.notes || null) !== JSON.stringify(meta.notes || null)) p.push(`${e.id}: notes differ from the edition registry`);
  if (!!e.undated !== !!meta.undated) p.push(`${e.id}: undated is ${!!e.undated}, the edition registry says ${!!meta.undated}`);
  for (const n of e.notes || []) {
    if (!DAY.test(n.asOf || "")) p.push(`${e.id}: a note has no asOf date`);
    if (!n.text) p.push(`${e.id}: a note has no text`);
    const ts = officialArchive(n.source, e.festivalId, e.year, p, `${e.id} note`);
    if (ts && !(ts.startsWith(String(e.year)) || ts.startsWith(String(e.year + 1)))) p.push(`${e.id}: note source ${ts} is not from ${e.year} or the year after`);
    for (const d of n.days || []) if (!e.days.some(x => x.day === d)) p.push(`${e.id}: a note names day ${d}, which the edition does not have`);
  }
  for (const d of e.days) if (d.untimed && !(e.notes || []).some(n => n.days?.includes(d.day))) p.push(`${e.id}: day ${d.day} is untimed with no note saying why`);
  // A set the festival moved (movedSets) is listed only where it was played,
  // so a note must name both its printed day and its played day.
  for (const m of meta.movedSets || []) {
    const from = (meta.dates || []).findIndex(([d]) => d === m.date) + 1, to = (meta.dates || []).findIndex(([d]) => d === m.to?.date) + 1;
    if (!from || !to) p.push(`${e.id}: moved set ${m.artist} names a date the edition does not have`);
    else if (!(e.notes || []).some(n => n.days?.includes(from) && n.days?.includes(to))) p.push(`${e.id}: moved set ${m.artist} has no note naming days ${from} and ${to}`);
  }
  // An edition-level status is the registry's, verbatim. "canceled" is the
  // only one, and it needs two dated sources from different publishers, each
  // published by the first day, plus an announcement date.
  if (JSON.stringify(e.status ?? null) !== JSON.stringify(meta.status ?? null) || JSON.stringify(e.canceled ?? null) !== JSON.stringify(meta.canceled ?? null))
    p.push(`${e.id}: status differs from the edition registry`);
  if (meta.status != null && meta.status !== "canceled") p.push(`${e.id}: unknown edition status "${meta.status}"`);
  if (meta.status === "canceled") {
    const c = meta.canceled || {}, first = meta.dates[0]?.[0] || "";
    if (!DAY.test(c.announced || "") || c.announced > first) p.push(`${e.id}: canceled with no announcement date on or before ${first}`);
    if (!c.reason) p.push(`${e.id}: canceled with no reason`);
    const srcs = (c.sources || []).filter(x => /^https:\/\//.test(x.url || "") && x.publisher && DAY.test(x.published || "") && x.published <= first && DAY.test(x.fetched || ""));
    if (new Set(srcs.map(x => hostOf(x.url))).size < 2) p.push(`${e.id}: canceled needs two dated sources from different publishers, each published by ${first}`);
  } else if (meta.canceled) p.push(`${e.id}: carries cancellation evidence but is not canceled`);
  for (const c of meta.cancelledDays || []) {
    if (meta.dates.some(([x]) => x === c.date)) p.push(`${e.id}: cancelled day ${c.date} is still an edition day`);
    if (!(e.notes || []).some(n => !n.days && n.text.includes(c.banner))) p.push(`${e.id}: cancelled day ${c.date} has no edition note quoting its banner`);
    if (!(e.provenance?.cancelledDays || []).some(x => x.date === c.date && x.banner === c.banner && x.blocks > 0)) p.push(`${e.id}: cancelled day ${c.date} has no ledger proof of its banner`);
  }

  // Provenance: every capture official, archived, and of the right year.
  if (!e.provenance?.captures?.length) p.push(`${e.id}: no provenance captures`);
  if (e.provenance?.extractionMethod === "official_sources") officialSources(e, meta, p);
  else for (const c of e.provenance?.captures || []) {
    const url = c.archivedUrl || c.pageArchivedUrl;
    const where = c.day ? `day ${c.day}` : `${c.page || "?"} page`;
    const ts = officialArchive(url, e.festivalId, e.year, p, `${e.id} ${where}`);
    // Time Warp keeps each Mannheim edition's lineup at its own address
    // (time-warp.de/<yy>/lineup) under a header naming that edition, so a
    // capture from the year after cannot be a later year's lineup (2022's
    // survives only in a Feb 2023 capture).
    const yearPage = c.page === "lineup" && e.festivalId === "time-warp" && ts?.startsWith(String(e.year + 1))
      && new RegExp(`^https?://(www\\.)?time-warp\\.de/${String(e.year).slice(2)}/lineup$`).test((url || "").replace(/^https:\/\/web\.archive\.org\/web\/\d{14}\//, ""));
    if (ts && !ts.startsWith(String(e.year)) && !earlyNextYear(ts, e) && !yearPage) p.push(`${e.id} ${where}: page capture ${ts} is not from ${e.year}`);
    if (c.imageArchivedUrl) officialArchive(c.imageArchivedUrl, e.festivalId, e.year, p, `${e.id} ${where} graphic`);
    if (!/^[0-9a-f]{64}$/.test(c.sha256 || "")) p.push(`${e.id} ${where}: artifact hash missing`);
  }

  // Completeness.
  if (!["complete_schedule", "selected_stages", "lineup_only"].includes(e.completeness)) p.push(`${e.id}: completeness "${e.completeness}"`);
  // selected_stages: the official schedule had stages that are not imported.
  // The registry names each one and the days it ran; a stage named missing
  // must have no set on those days, so adding its data forces the label off.
  if (JSON.stringify(e.coverage || null) !== JSON.stringify(meta.coverage || null)) p.push(`${e.id}: coverage differs from the edition registry`);
  if ((e.completeness === "selected_stages") !== !!e.coverage?.missing?.length) p.push(`${e.id}: selected_stages needs a coverage.missing list, and only selected_stages may carry one`);
  if (e.coverage) {
    if (!DAY.test(e.coverage.asOf || "")) p.push(`${e.id}: coverage has no asOf date`);
    for (const m of e.coverage.missing || []) {
      if (!m.stage || !m.when || !m.days?.length) p.push(`${e.id}: a missing stage needs stage, when and days`);
      for (const d of m.days || []) {
        if (!e.days.some(x => x.day === d)) p.push(`${e.id}: missing stage ${m.stage} names day ${d}, which the edition does not have`);
        const st = new Set(e.stages.filter(s => s.name.toLowerCase() === String(m.stage).toLowerCase()).map(s => s.id));
        if ((e.sets || []).some(s => s.day === d && st.has(s.stageId))) p.push(`${e.id}: ${m.stage} is listed as missing on day ${d} but has sets there`);
      }
    }
  }
  const lineupOnly = e.completeness === "lineup_only";
  if (lineupOnly && (e.sets?.length || e.provenance?.extractionMethod !== "official_lineup_html"))
    p.push(`${e.id}: lineup_only must carry no sets (no placeholder times) and come from an official lineup page`);
  if (!lineupOnly && e.provenance?.extractionMethod === "official_lineup_html")
    return p.concat(`${e.id}: a lineup page has no times, so it cannot make a complete_schedule`);
  if (lineupOnly && !e.artists?.length) p.push(`${e.id}: lineup_only with no artists`);

  const stageIds = new Set(e.stages.map(s => s.id)), artistIds = new Set(e.artists.map(a => a.id)), artistNames = new Map(e.artists.map(a => [a.id, a.name]));
  if (stageIds.size !== e.stages.length) p.push(`${e.id}: duplicate stage id`);
  if (artistIds.size !== e.artists.length) p.push(`${e.id}: duplicate artist id`);
  // Founder rulings: the Bonus Tracks stage, fireworks, silent disco, unnamed
  // slots and non-music activities are not in the library in ANY form (not an artist, a set, an
  // event, a stage or an id). The ledger holds them as the audit trail.
  if ("events" in e) p.push(`${e.id}: carries an events list; operational rows are dropped, not stored`);
  const hit = new Set();
  // A stage the founder ruled to keep as printed (KEPT_STAGES) is not checked
  // by its name or the slug its ids carry; every billing on it, and every
  // other edition, still is (the set check below).
  const kept = new Set(e.stages.filter(s => (KEPT_STAGES[e.id] || []).includes(s.name)).flatMap(s => [s.name, s.id.split(":").pop()]));
  for (const x of strings({ stages: e.stages, artists: e.artists, sets: e.sets, events: e.events })) {
    if (kept.has(x)) continue;
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

  if (lineupOnly) return p.concat(validateLineup(e, { expected, dropped }, stageIds));

  const ids = new Set(), slots = new Set(), used = new Set();
  for (const s of e.sets) {
    const tag = `${e.id} ${s.id}`;
    if (ids.has(s.id)) p.push(`${tag}: duplicate set id`);
    ids.add(s.id);
    if (!s.id.startsWith(e.id + ":")) p.push(`${tag}: id not scoped to its edition`);
    if (!Number.isInteger(s.day) || s.day < 1 || s.day > e.days.length) p.push(`${tag}: day ${s.day} is not an edition day`);
    if (!stageIds.has(s.stageId)) p.push(`${tag}: unknown stage ${s.stageId}`);
    if (!artistIds.has(s.artistId)) p.push(`${tag}: unknown artist ${s.artistId}`);
    // An untimed day's set carries no time at all, never a placeholder.
    if (e.days.find(d => d.day === s.day)?.untimed) {
      if (s.start !== null || s.end !== null || s.openEnd) p.push(`${tag}: a set on an untimed day carries a time`);
      const k = `${s.day}|${s.stageId}|untimed|${s.artistId}`;
      if (slots.has(k)) p.push(`${tag}: duplicate artist-stage row on an untimed day`);
      slots.add(k); used.add(s.artistId);
      continue;
    }
    if (!HHMM.test(s.start || "")) { p.push(`${tag}: start "${s.start}" is blank or unparseable`); continue; }
    if (s.end == null) { if (!s.openEnd) p.push(`${tag}: end is blank and the row is not marked as printed open-ended`); }
    else if (!HHMM.test(s.end)) p.push(`${tag}: end "${s.end}" unparseable`);
    else {
      const a = dayMinutes(s.start, e.rolloverHour), b = dayMinutes(s.end, e.rolloverHour);
      if (b <= a) p.push(`${tag}: ${s.start}–${s.end} has no positive duration after overnight normalisation`);
      if (b - a > 8 * 60 && !(PRINTED_LONG_SETS[e.id] || []).includes(`${artistNames.get(s.artistId)}|${s.start}|${s.end}`)) p.push(`${tag}: ${s.start}–${s.end} runs over 8 hours — a cross-day misread`);
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
  p.push(...nonLatin(e));

  // Every documented day and stage present; counts locked from the reviewed sheet.
  for (const d of e.days) if (!e.sets.some(s => s.day === d.day)) p.push(`${e.id}: day ${d.day} has no sets`);
  for (const st of e.stages) if (!e.sets.some(s => s.stageId === st.id)) p.push(`${e.id}: stage ${st.name} is empty`);
  if (!expected) p.push(`${e.id}: no locked expected counts`);
  else {
    if (expected.stages !== e.stages.length) p.push(`${e.id}: ${e.stages.length} stages, locked ${expected.stages}`);
    if (!Array.isArray(expected.setsPerDay)) p.push(`${e.id}: no locked setsPerDay`);
    else expected.setsPerDay.forEach((n, i) => {
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

// Letters only: symbols in a stylized billing are real ("€URO TRA$H").
const nonLatin = e => [...e.artists, ...e.stages]
  // Letters only: symbols in a stylized billing are real ("€URO TRA$H"), and
  // a name the source itself printed in another script is listed in
  // PRINTED_NON_LATIN.
  .filter(x => /(?=\p{L})\P{Script=Latin}/u.test(x.name) && !(PRINTED_NON_LATIN[e.id] || []).includes(x.name))
  .map(x => `${e.id}: "${x.name}" contains a non-Latin look-alike character`);

// A lineup_only edition: artists as the official lineup page billed them,
// each with the day and stage it printed (where it printed them), no times.
function validateLineup(e, { expected, dropped }, stageIds) {
  const p = nonLatin(e), used = new Set();
  for (const a of e.artists) {
    if (!a.id.startsWith(e.id + ":")) p.push(`${e.id} ${a.id}: id not scoped to its edition`);
    for (const x of a.appearances || []) {
      const keys = Object.keys(x);
      if (keys.some(k => k !== "day" && k !== "stageId") || !keys.length) p.push(`${e.id} ${a.name}: appearance ${JSON.stringify(x)} carries something other than a day and a stage`);
      if ("day" in x && (!Number.isInteger(x.day) || x.day < 1 || x.day > e.days.length)) p.push(`${e.id} ${a.name}: day ${x.day} is not an edition day`);
      if ("stageId" in x) { if (!stageIds.has(x.stageId)) p.push(`${e.id} ${a.name}: unknown stage ${x.stageId}`); used.add(x.stageId); }
    }
  }
  for (const st of e.stages) if (!used.has(st.id)) p.push(`${e.id}: stage ${st.name} is on no artist's appearance`);
  // An undated lineup page printed no days: no artist may carry one, and the
  // edition must say so in a note. Any other lineup edition dates every day.
  if (e.undated) {
    if (e.artists.some(a => (a.appearances || []).some(x => "day" in x))) p.push(`${e.id}: undated lineup, but an artist carries a day`);
    if (!(e.notes || []).some(n => /printed no days/.test(n.text))) p.push(`${e.id}: undated lineup without a note saying the page printed no days`);
  } else for (const d of e.days) if (!e.artists.some(a => (a.appearances || []).some(x => x.day === d.day))) p.push(`${e.id}: day ${d.day} has no billed artist`);
  if (!expected) return p.concat(`${e.id}: no locked expected counts`);
  if (expected.artists !== e.artists.length) p.push(`${e.id}: ${e.artists.length} artists, locked ${expected.artists}`);
  if (expected.stages !== e.stages.length) p.push(`${e.id}: ${e.stages.length} stages, locked ${expected.stages}`);
  const per = e.days.map(d => e.artists.reduce((n, a) => n + (a.appearances || []).filter(x => x.day === d.day).length, 0));
  if (JSON.stringify(per) !== JSON.stringify(expected.appearancesPerDay)) p.push(`${e.id}: appearances per day ${per.join("/")}, locked ${(expected.appearancesPerDay || []).join("/")}`);
  if ((dropped || []).length !== (expected.dropped ?? -1)) p.push(`${e.id}: drops ${(dropped || []).length} printed billings, locked ${expected.dropped}`);
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
      // Sónar keeps each year's timetable at its own address
      // (sonar.es/<lang>/<year>/schedules) and the page names its edition, so
      // a later capture of that address cannot be a later year's timetable
      // (2016's survives only in 2018 and 2019 captures).
      const yearPage = c.format === "sonar-calendar" && new RegExp(`^https?://(www\\.)?sonar\\.es/[a-z]{2}/${e.year}/schedules$`).test((c.archivedUrl || "").replace(/^https:\/\/web\.archive\.org\/web\/\d{14}\//, ""))
        && new RegExp(`Sónar Barcelona ${e.year}\\b`).test(c.named || "");
      if (ts && !yearPage && !(ts.startsWith(String(e.year)) || ts.startsWith(String(e.year + 1)))) p.push(`${tag}: page capture ${ts} is not from ${e.year} or the year after`);
      if (ts && ts !== c.captureTimestamp) p.push(`${tag}: captureTimestamp ${c.captureTimestamp} ≠ the archived URL's ${ts}`);
      // Shambhala's tabs print the weekday alone; the date is the one the
      // day's table writes its first slot as (<td id="time_T">, T a UTC epoch).
      if (c.firstSlot) {
        const T = +/^time_(\d+)$/.exec(c.firstSlot)?.[1], wd = new Date(date + "T12:00:00Z").toLocaleDateString("en-US", { weekday: "long", timeZone: "UTC" });
        if (!T || new Date(T * 1000).toISOString().slice(0, 10) !== date) p.push(`${tag}: the page's first slot ${c.firstSlot} is not on ${date}`);
        if (String(c.printed).toLowerCase() !== wd.toLowerCase()) p.push(`${tag}: the page's day tab "${c.printed}" is not ${wd}`);
      } else if (c.firstStart) {
        // Outside Lands' 2010-2011 planner prints no day tab: it writes each
        // set's start with its date as data ("2011-08-12 12:00:00").
        if (c.printed !== date || !String(c.firstStart).startsWith(date + " ")) p.push(`${tag}: the page's data writes "${c.printed}" (first start ${c.firstStart}), not ${date}`);
      } else if (c.tabDate) {
        // Electric Forest's 2014-2015 Scheduler tab prints the month and day
        // ("June 25") and carries its date as data-target.
        const [, m, d] = date.split("-").map(Number);
        const md = `${new Date(date + "T12:00:00Z").toLocaleDateString("en-US", { month: "long", timeZone: "UTC" })} ${d}`;
        if (c.tabDate !== date || c.printed !== md) p.push(`${tag}: the page's day tab "${c.printed}" (${c.tabDate}) does not print ${date}`);
      } else if (c.format === "tml-cms") {
        // Tomorrowland's 2010-2012 line-up page prints its day as its own
        // tab, with no year ("Saturday 24 july").
        if (tmlCmsDate(c.printed, e.year) !== date) p.push(`${tag}: the page's day tab "${c.printed}" does not print ${date}`);
      } else if (c.format === "tml-drupal") {
        // Tomorrowland's 2013-2016 day page prints its weekday and date with
        // no year in its title ("Saturday/ 27 July").
        if (tmlTitleDate(c.printed, e.year) !== date || c.titleDate !== date) p.push(`${tag}: the page's title "${c.printed}" does not print ${date}`);
      } else if (c.format === "shambhala-webflow") {
        // Shambhala's 2024-2025 page prints its weekday alone; the date is
        // the run the festival's own dated post prints ("July 26-29, 2024").
        const f = c.datesFrom || {};
        officialArchive(f.archivedUrl, e.festivalId, e.year, p, `${tag} dates`);
        if (!/^[0-9a-f]{64}$/.test(f.sha256 || "")) p.push(`${tag}: the dated post's hash is missing`);
        if (shambhalaRun(f.printed, e.year)?.[c.printed] !== date || c.weekday !== c.printed || !String(c.published || "").startsWith(String(e.year)))
          p.push(`${tag}: the page prints "${c.printed}" (published ${c.published}) and the post "${f.printed}", not ${date}`);
      } else if (c.format === "insomniac-music") {
        // EDC Las Vegas's 2012-2013 music page prints each day's heading
        // ("Friday - June 8th", no year); the year is the page's own title or
        // description, and the page names Las Vegas.
        if (insomniacDate(c.printed, e.year) !== date || !/^the page's (title|description)$/.test(c.yearFrom || "") || !/^the page's (title|own og:url)$/.test(c.place || ""))
          p.push(`${tag}: the page's day "${c.printed}" (year from ${c.yearFrom}, Las Vegas from ${c.place}) does not print ${date}`);
      } else if (c.format === "hard-wp") {
        // HARD Summer's 2012 page heads each day with its weekday alone
        // ("FRIDAY"); the date is the run the page's own essential info prints
        // ("Friday, August 3rd & Saturday, August 4th, 2012").
        if (hardRun(c.dateFrom, e.year)?.[c.printed] !== date) p.push(`${tag}: the page's day "${c.printed}" (run "${c.dateFrom}") does not print ${date}`);
      } else if (c.format === "dostuff-embed") {
        // The official lineup widget (Outside Lands 2018-2019 and 2022-2025, Lightning in a
        // Bottle 2018-2019) prints each set's start as a full date with its
        // offset; the day is that date, inside the run of days the widget's
        // own options print (which may add a gate day at either end, never
        // more), and the official lineup page that loads the widget was
        // captured on the festival's own site close to the script
        // (EMBED_PAGES).
        const run = /^(\d{4}-\d{2}-\d{2}) to (\d{4}-\d{2}-\d{2})$/.exec(c.run || "");
        const dayGap = (a, b) => (Date.parse(b + "T12:00:00Z") - Date.parse(a + "T12:00:00Z")) / 864e5;
        if (c.printed !== date || !run || !(dayGap(run[1], meta.dates[0][0]) >= 0 && dayGap(run[1], meta.dates[0][0]) <= 1)
          || !(dayGap(meta.dates.at(-1)[0], run[2]) >= 0 && dayGap(meta.dates.at(-1)[0], run[2]) <= 1))
          p.push(`${tag}: the widget's day "${c.printed}" (run "${c.run}") does not print ${date}`);
        if (!embedPageOk(e.festivalId, c.captureTimestamp, c.embeddedBy))
          p.push(`${tag}: embeddedBy ${c.embeddedBy?.url || "(none)"} @${c.embeddedBy?.captureTimestamp || "?"} is not the official lineup page ${EMBED_PAGES[e.festivalId]?.label || "(no rule for this festival)"}`);
      } else if (c.format === "lolla-cards") {
        // Lollapalooza's 2018 lineup cards print each set's day as "Sat 8/04"
        // (no year); the year is the cards' own "2018 Schedule:" heading.
        if (lollaCardDate(c.printed, e.year) !== date) p.push(`${tag}: the page's day "${c.printed}" does not print ${date}`);
      } else if (c.format === "govball-wp") {
        // Governors Ball's 2011-2012 schedule prints each day's heading
        // ("SATURDAY 6/23", no year); 2011's one day is the one the page's
        // own description prints ("Saturday, June 18th, 2011").
        if (govBallDate(c.printed, e.year) !== date || !/^the (day's heading|page's description)$/.test(c.dateFrom || "")) p.push(`${tag}: the page's day "${c.printed}" (${c.dateFrom}) does not print ${date}`);
      } else if (c.format === "primavera-horarios") {
        // Primavera Sound's Fòrum timetable prints each day as a tab with no
        // year, in Catalan, Spanish or English ("dimecres 27 de maig",
        // "Friday May 29"); its weekday must fall on that date in the year.
        if (primaveraDate(c.printed, e.year) !== date || !(c.tabs || []).includes(c.printed) || !/Parc del Fòrum/.test(c.heading || ""))
          p.push(`${tag}: the page's day tab "${c.printed}" (heading "${c.heading}") does not print ${date} at Parc del Fòrum`);
      } else if (c.format === "sziget-days") {
        // Sziget's day programme prints each day as a tab with no year
        // ("August 14. Saturday"); its weekday must fall on that date in the
        // year, the tab must be one of the page's own, and the page must be
        // the English programme's day page for that date.
        if (szigetDate(c.printed, e.year) !== date || !(c.tabs || []).includes(c.printed)
          || !new RegExp(`/festival_english/programs/-/days\\?day=${date}&`).test(c.archivedUrl || ""))
          p.push(`${tag}: the page's day tab "${c.printed}" at ${c.archivedUrl} does not print ${date}`);
      } else if (c.format === "defqon-areas") {
        // Defqon.1's 2015 timetable heads each part of the weekend with its
        // weekday, date, year and hours ("Friday • 19 June 2015 • 20:00 -
        // 01:00"), and the page's own title names the edition's timetable.
        if (defqonDate(c.printed, e.year) !== date || c.named !== `Timetable - Defqon.1 ${e.year}`)
          p.push(`${tag}: the page's heading "${c.printed}" (titled "${c.named}") does not print ${date}`);
      } else if (c.format === "defqon-logos") {
        // Defqon.1's 2014 timetable heads each area's box with its weekday
        // and date, no year ("SATURDAY • 28 JUNE"); the page's own title names
        // the edition's festival.
        if (defqonLogosDate(c.printed, e.year) !== date || c.named !== `Timetable | Defqon.1 Festival ${e.year}`)
          p.push(`${tag}: the page's subtitle "${c.printed}" (titled "${c.named}") does not print ${date}`);
      } else if (c.format === "sonar-calendar") {
        // Sónar's timetable heads each of a day's sessions with the weekday
        // and the day of the month ("Friday 19 | Sónar by Day"), no year; the
        // page itself names the edition's year (its title or logo), and every
        // heading of the day must print the same weekday and day.
        const parts = String(c.printed || "").split(" · "), d = new Date(date + "T12:00:00Z");
        const want = `${["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"][d.getUTCDay()]} ${d.getUTCDate()}`;
        if (!parts.length || parts.some(x => !new RegExp(`^${want} \\| Sónar by (Day|Night)$`).test(x)) || !new RegExp(`Sónar Barcelona ${e.year}\\b`).test(c.named || ""))
          p.push(`${tag}: the page's headings "${c.printed}" (edition "${c.named}") do not print ${date}`);
      } else if (c.format === "primavera-completos") {
        // Primavera Sound's 2016-2019 full timetable prints each day as a
        // weekday and a day of the month ("MIÉRCOLES 1"; 2019 the whole date); the row of tabs names its
        // dates as one run of days in the year, and the page is the full
        // timetable, not one venue's.
        const run = primaveraRun(c.tabs, e.year), i = (c.tabs || []).indexOf(c.printed);
        if (!run || i < 0 || run[i] !== date || !/^(Horarios|Horaris|Timetable|Set times)$/.test(c.heading || "") || !/^(Horarios completos|Horaris complets|Full timetable|All set times)$/.test(c.active || ""))
          p.push(`${tag}: the page's day tab "${c.printed}" (tabs ${(c.tabs || []).join(", ")}; "${c.heading}", "${c.active}") does not print ${date} on the full timetable`);
      } else if (datedLabel(c.printed, e.year) !== date) p.push(`${tag}: the page's day tab "${c.printed}" does not print ${date}`);
      // Outside Lands' grid prints no am/pm: the day's meridiem comes from one
      // act's own page on the official site, which must print this day.
      if (c.meridiemFrom) {
        const m = c.meridiemFrom;
        officialArchive(m.archivedUrl, e.festivalId, e.year, p, `${tag} meridiem`);
        if (!/^[0-9a-f]{64}$/.test(m.sha256 || "")) p.push(`${tag}: the meridiem page's hash is missing`);
        // "Friday Aug 9 7:10 PM on Lands End" (through 2014), "Friday, August 7, 7:55 PM" (2015 on)
        // or Lollapalooza 2011's "Sunday, Aug. 7 4:00pm on Music Unlimited".
        const pm = /^([A-Za-z]+),? ([A-Za-z]{3,9})\.? (\d{1,2}),? \d{1,2}:\d{2} ?(?:[AP]M|[ap]m)(?: .+)?$/.exec(m.printed || "");
        const d = new Date(date + "T12:00:00Z");
        if (!pm || pm[1] !== d.toLocaleDateString("en-US", { weekday: "long", timeZone: "UTC" }) || pm[2].slice(0, 3) !== d.toLocaleDateString("en-US", { month: "short", timeZone: "UTC" })
          || (pm[2].length > 3 && pm[2] !== d.toLocaleDateString("en-US", { month: "long", timeZone: "UTC" })) || +pm[3] !== d.getUTCDate())
          p.push(`${tag}: the meridiem page prints "${m.printed}", not a set on ${date}`);
      }
    }
    // A stage printed two ways carried onto one name: only case, spacing and
    // a leading "The" may change, and the target must be a stage it shows.
    if (c.kind === "page" || c.kind === "graphic") {
      const fold = x => String(x).replace(/^the\s+/i, "").replace(/\s+/g, "").toLowerCase();
      for (const [from, to] of Object.entries(c.stagesAs || {})) {
        if (fold(from) !== fold(to)) p.push(`${tag}: stagesAs "${from}" → "${to}" renames the stage; only case, spacing and a leading "The" may differ`);
        if (!e.stages.some(st => st.name === to)) p.push(`${tag}: stagesAs maps "${from}" onto "${to}", which is not a stage of the edition`);
      }
    }
    if (c.kind === "page") {
    } else if (c.kind === "graphic") {
      const host = hostOf(c.imageUrl);
      const official = hostIn(OFFICIAL_HOSTS[e.festivalId], host);
      const rehost = rehostOf(host);
      if (!official && !rehost) p.push(`${tag}: graphic host ${host || "(none)"} is neither official nor an approved re-host`);
      if (rehost === "cdninstagram.com" && !/^https:\/\/www\.instagram\.com\/p\/[\w-]+\/$/.test(c.foundAt || ""))
        p.push(`${tag}: an Instagram graphic must cite its post (instagram.com/p/<shortcode>/), not ${c.foundAt || "(none)"}`);
      if (!/^https:\/\//.test(c.foundAt || "")) p.push(`${tag}: graphic has no page it was found on`);
      else receiptLinks(c, e, official, host, tag, p);
      if (!c.rehostedBy) p.push(`${tag}: graphic does not name who re-hosted it`);
      // The receipt: the re-host was published in the edition's year, no
      // later than its last day (a pre-event schedule, not a later recap).
      // Only the festival's own listed posts that print no date may leave it
      // blank (undatedOwnPost); a date any post carries is held to the rule.
      if (!undatedOwnPost(e.id, c) &&
          (!DAY.test(c.published || "") || !c.published.startsWith(String(e.year)) || c.published > lastDay))
        p.push(`${tag}: re-host published ${c.published || "(no date)"}, not in ${e.year} on or before ${lastDay}`);
      if (!DAY.test(c.fetchedAt || "")) p.push(`${tag}: graphic has no fetch date`);
      if (!c.printed) p.push(`${tag}: graphic has no printed header recorded`);
      else if (!graphicPrints(c.printed, date, e.year, meta.dates.map(([d]) => d)))
        p.push(`${tag}: the graphic's header "${c.printed}" does not print ${weekdayOf(date)} ${date}`);
      // A styled stage name carried onto the edition's other printing: only
      // case and spacing may change, and the target must be a stage it shows.
    } else p.push(`${tag}: source kind "${c.kind}" is neither page nor graphic`);
  }
  for (const [i] of meta.dates.entries()) if (!e.provenance.captures.some(c => c.day === i + 1)) p.push(`${e.id} day ${i + 1}: no source`);
  // Completeness against the receipt pages, not just the chosen sources:
  // every set-times graphic an EDM Identity receipt page shows, and every
  // slide of an Instagram post, is used by a source or excluded with its
  // reason (Orlando 2017 shipped without the Corona Electric Beach graphic
  // its own receipt page carried).
  const graphics = e.provenance.captures.filter(c => c.kind === "graphic" && c.receipt);
  const page = r => r.archivedUrl || r.url;
  for (const c of graphics.filter((c, i) => graphics.findIndex(x => page(x.receipt) === page(c.receipt) && x.receipt.cites === c.receipt.cites) === i)) {
    if (!["edmidentity.com", "instagram.com"].includes(hostOf(c.foundAt))) continue;
    const shown = c.receipt.setTimesGraphics;
    if (!Array.isArray(shown)) p.push(`${e.id} day ${c.day}: receipt ${page(c.receipt)} does not list the set-times graphics its page shows`);
    else if (!shown.some(t => sameGraphic(t, c.receipt.cites))) p.push(`${e.id} day ${c.day}: receipt ${page(c.receipt)} lists set-times graphics without the one it cites`);
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
// Wayback holds no Instagram post, so an Instagram slide's receipt is the
// post's own logged-out embed (/embed/captioned/), read on a recorded date.
function receiptLinks(c, e, official, host, tag, p) {
  const page = hostOf(c.foundAt), rehost = rehostOf(host);
  const allowed = official ? OFFICIAL_HOSTS[e.festivalId] || [] : RECEIPT_HOSTS[rehost] || [];
  if (!hostIn(allowed, page)) p.push(`${tag}: found-at page ${page} is not where ${host} graphics are cited`);
  const dated = /^\/(\d{4})\/(\d{2})\/(\d{2})\//.exec(new URL(c.foundAt).pathname);
  if (page === "edmidentity.com" && (!dated || dated.slice(1).join("-") !== c.published))
    p.push(`${tag}: found-at page ${c.foundAt} is not dated ${c.published}`);
  const r = c.receipt;
  if (!r) return p.push(`${tag}: graphic has no receipt capture of the page it was found on`);
  if (rehost === "cdninstagram.com") {
    if (r.url !== `${c.foundAt}embed/captioned/`) p.push(`${tag}: receipt ${r.url || "(none)"} is not the embed of ${c.foundAt}`);
    if (!DAY.test(r.fetchedAt || "")) p.push(`${tag}: receipt has no read date`);
  } else {
    const m = WAYBACK.exec(r.archivedUrl || "");
    if (!m || r.archivedUrl !== `https://web.archive.org/web/${m[1]}/${c.foundAt}`) p.push(`${tag}: receipt ${r.archivedUrl || "(none)"} is not a capture of ${c.foundAt}`);
    else if (m[1] !== r.captureTimestamp) p.push(`${tag}: receipt captureTimestamp ${r.captureTimestamp} ≠ its URL's ${m[1]}`);
  }
  if (!/^[0-9a-f]{64}$/.test(r.sha256 || "")) p.push(`${tag}: receipt capture hash missing`);
  if (r.cites !== citeToken(c.imageUrl)) p.push(`${tag}: receipt cites ${r.cites || "(nothing)"}, not the graphic ${citeToken(c.imageUrl)}`);
}
