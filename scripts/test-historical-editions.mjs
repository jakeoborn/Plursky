#!/usr/bin/env node
// test-historical-editions.mjs — the Past Festivals data gate (verify 1z-c4).
//
// 1. Every checked-in edition validates and equals what its sheet builds.
// 2. Each validation rule is proven live: a mutated copy of a real edition
//    must FAIL (dropped row, wrong year, duplicate id, blank time, …). A rule
//    that a mutation cannot trip is a rule that is not running.
// 3. Edition identity is read off the page, not the <title> or "closest"
//    capture: the spec's known misses (ARC 2021, Summerfest rolled to 2026)
//    are fixtures.
// 4. Historical data stays out of the live app: no registry, precache or
//    schedule reference, and no archived graphic anywhere in the repo.

import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";
import { validateEdition, hostIn, urlIn, OFFICIAL_HOSTS } from "./historical/validate.mjs";
import { buildEdition, droppedRows, performerKeys, artistKey, readSheet } from "./historical/build-editions.mjs";
import { lineupDropReason, ACTIVITIES, EDITIONS, KEPT_STAGES, dropReason } from "./historical/editions.mjs";
import { activeTab, parseDayTabs, stageFor } from "./historical/import-gather.mjs";
import { datedLabel, graphicPrints, instant, sameGraphic, to24 } from "./historical/lib.mjs";
import { dayTabs, sheetRow } from "./historical/extract-insomniac.mjs";
import { parseLineupPage, provesEdition, lineupRows, LINEUP_EDITIONS, printedRange } from "./historical/extract-insomniac-lineup.mjs";
import { parseAclSchedule, axisMinutes, readAxis } from "./historical/acl-schedule.mjs";
import { parseTomorrowland, eventDay } from "./historical/tml-schedule.mjs";
import { parseElectricForest, navDay } from "./historical/ef-schedule.mjs";
import { parseShambhala, slotLabel } from "./historical/shambhala-schedule.mjs";
import { parseDoStuff, parseDoStuffBand, timeDay } from "./historical/dostuff-schedule.mjs";
import { parseMyScheduler, restoreSets } from "./historical/myscheduler-schedule.mjs";
import { parseEfScheduler } from "./historical/ef-scheduler-schedule.mjs";
import { parseGovBallWp, printedDate as govBallDate } from "./historical/govball-wp-schedule.mjs";
import { parsePrimaveraHorarios, tabDate as primaveraDate } from "./historical/primavera-horarios-schedule.mjs";
import { parsePrimaveraCompletos, tabRun as primaveraRun } from "./historical/primavera-completos-schedule.mjs";
import { parseInsomniacMusic, printedDate as insomniacDate } from "./historical/insomniac-music-schedule.mjs";
import { parseTmlCms, printedDate as tmlCmsDate } from "./historical/tml-cms-schedule.mjs";
import { parseHardWp, readRun as hardRun } from "./historical/hard-wp-schedule.mjs";
import { parseLollaLineup, cardDate as lollaCardDate } from "./historical/lolla-lineup.mjs";
import { parseTmlDrupal, titleDate as tmlTitleDate } from "./historical/tml-drupal-schedule.mjs";
import { parseShambhalaWebflow, datesFromPost as shambhalaRun, readDatesPost } from "./historical/shambhala-webflow-schedule.mjs";
import { parseCoachella, parseCoachellaData, parseCoachella2012 } from "./historical/coachella-lineup.mjs";
import { parseDoStuffEmbed, embedPageOk, pageLoadsScript, scriptSetsSrc } from "./historical/dostuff-embed-schedule.mjs";
import { parseSonarSchedule } from "./historical/sonar-schedule.mjs";
import { parseSzigetDays, tabDate as szigetDate } from "./historical/sziget-days-schedule.mjs";
import { parseDefqonAreas, headerDate as defqonDate } from "./historical/defqon-schedule.mjs";
import { parseTomorrowlandLineup } from "./historical/tomorrowland-lineup.mjs";
import { parseTimeWarpLineup, headerDates as twHeaderDates } from "./historical/timewarp-lineup.mjs";
import { parseCreamfieldsArtists, creamfieldsRows } from "./historical/creamfields-artists.mjs";
import { censusRow, runDates, CENSUS as CREAMFIELDS_CENSUS } from "./historical/extract-creamfields.mjs";
import { parseCreamfieldsLineup, creamfieldsLineupRows, printedDate } from "./historical/creamfields-lineup.mjs";
import { parseDefqonGrid, dayHeading as dgDayHeading } from "./historical/defqon-grid-lineup.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const H = p => join(ROOT, "data/historical", p);
const fails = [];
let checks = 0, mutations = 0;
const ok = (cond, msg) => { checks++; if (!cond) fails.push(msg); };
const clone = x => JSON.parse(JSON.stringify(x));

const expected = JSON.parse(readFileSync(H("expected-counts.json"), "utf8"));
const droppedFor = id => JSON.parse(readFileSync(H(`ledger/${id}.json`), "utf8")).dropped;
const reviewFor = id => existsSync(H(`review/${id}.json`)) ? JSON.parse(readFileSync(H(`review/${id}.json`), "utf8")) : undefined;
const files = existsSync(H("editions")) ? readdirSync(H("editions")).filter(f => f.endsWith(".json")) : [];
ok(files.length >= 2, `expected at least the 2 structured editions, found ${files.length}`);

// ── 1. shipped editions are valid and generated ──
const editions = {};
for (const f of files) {
  const e = editions[f.replace(/\.json$/, "")] = JSON.parse(readFileSync(H(`editions/${f}`), "utf8"));
  const p = validateEdition(e, { expected: expected[e.id], review: reviewFor(e.id), dropped: droppedFor(e.id) });
  ok(!p.length, `${e.id} is invalid:\n      ${p.slice(0, 8).join("\n      ")}`);
}
try { execFileSync(process.execPath, ["scripts/historical/build-editions.mjs", "--check"], { cwd: ROOT, stdio: "pipe" }); ok(true); }
catch (e) { ok(false, `an edition file differs from what its sheet builds:\n${e.stdout}${e.stderr}`); }

// ── 2. mutations: each must be caught ──
const base = editions["hard-summer-2025"];
const edc = editions["edc-las-vegas-2025"];
// `by` names the rule that must catch it, when a count check would catch the
// mutation anyway and so could hide a rule that is not running.
const mustFail = (label, mutate, e = base, mutateDropped = () => {}, by = /./) => {
  const m = clone(e), d = clone(droppedFor(e.id)); mutate(m); mutateDropped(d); mutations++;
  const p = validateEdition(m, { expected: expected[e.id], review: reviewFor(e.id), dropped: d });
  ok(p.some(x => by.test(x)), `mutation not caught${by.source === "." ? "" : ` by ${by}`}: ${label}`);
};
if (base && edc) {
  mustFail("drop one set row", m => m.sets.pop());
  mustFail("alter the edition year", m => { m.year = 2024; });
  mustFail("shift a day's date into another year", m => { m.days[0].date = "2026-08-02"; });
  mustFail("duplicate a set id", m => { m.sets[1].id = m.sets[0].id; });
  mustFail("duplicate an artist-stage-start row", m => { m.sets.push({ ...m.sets[0], id: m.sets[0].id + "-dup" }); });
  mustFail("blank a start time", m => { m.sets[0].start = ""; });
  mustFail("blank an end time without the open-end flag", m => { m.sets[0].end = null; });
  mustFail("reverse a set's times", m => { const s = m.sets[0]; [s.start, s.end] = [s.end, s.start]; });
  mustFail("reference an unknown stage", m => { m.sets[0].stageId = "hard-summer-2025:nowhere"; });
  mustFail("reference an unknown artist", m => { m.sets[0].artistId = "hard-summer-2025:nobody"; });
  mustFail("drop a whole day", m => { m.sets = m.sets.filter(s => s.day !== 2); });
  mustFail("drop a stage", m => { const st = m.stages.pop(); m.sets = m.sets.filter(s => s.stageId !== st.id); });
  mustFail("un-scoped set id (reused live row id)", m => { m.sets[0].id = "kaytranada"; });
  mustFail("capture from a non-official host", m => { m.provenance.captures[0].archivedUrl = "https://web.archive.org/web/20251006215127/https://www.clashfinder.com/s/hard2025/"; });
  mustFail("capture from the wrong year (ARC's closest was 2021)", m => { m.provenance.captures[0].archivedUrl = m.provenance.captures[0].archivedUrl.replace(/\/web\/2025/, "/web/2021"); });
  mustFail("missing artifact hash", m => { m.provenance.captures[0].sha256 = ""; });
  mustFail("lineup_only carrying placeholder times", m => { m.completeness = "lineup_only"; });
  mustFail("overnight set misread across days (EDC)", m => { const s = m.sets.find(x => x.start === "04:13"); s.start = "16:13"; }, edc);
  mustFail("a dropped Fireworks row left out of the ledger (EDC)", () => {}, edc, d => { d.pop(); });
  mustFail("Cyrillic look-alike in a billing (Lolla OCR)", m => { m.artists[0].name = "ОTОBOKE BEAVER"; });
  // A printed set over 8 hours stands only as its edition lists it.
  const tml13 = editions["tomorrowland-2013"];
  if (tml13) {
    const longSet = m => m.sets.find(x => x.start === "13:00" && x.end === "01:00");
    mustFail("a listed long set read an hour longer (Tomorrowland 2013)", m => { longSet(m).end = "02:00"; }, tml13, () => {}, /over 8 hours/);
    mustFail("a listed long set credited to another act (Tomorrowland 2013)", m => { const s = longSet(m); s.artistId = m.sets.find(x => x.artistId !== s.artistId).artistId; }, tml13, () => {}, /over 8 hours/);
  }
  // Primavera Sound's 2015 tabs print no year: the weekday must fall on the
  // day's date, the tab must be one the page printed, and the page must be
  // Primavera's own Parc del Fòrum timetable.
  const ps15 = editions["primavera-sound-2015"];
  if (ps15) {
    const psCap = m => m.provenance.captures.find(c => c.format === "primavera-horarios" && c.day === 3);
    mustFail("a Primavera Sound tab whose weekday is not its day", m => { psCap(m).printed = "Saturday May 29"; }, ps15, () => {}, /does not print/);
    mustFail("a Primavera Sound tab the page does not print", m => { psCap(m).tabs = psCap(m).tabs.filter(t => t !== psCap(m).printed); }, ps15, () => {}, /does not print/);
    mustFail("a Primavera Sound timetable for the city stages", m => { psCap(m).heading = "Horarios Ciutat"; }, ps15, () => {}, /Parc del Fòrum/);
    mustFail("a Primavera Sound page off another site", m => { psCap(m).archivedUrl = psCap(m).archivedUrl.replace("www.primaverasound.es", "www.clashfinder.com"); }, ps15);
  }
  // Primavera Sound's 2016 tabs print a weekday and a day of the month: the
  // row of tabs as a whole must name the day, on the full timetable.
  const ps16 = editions["primavera-sound-2016"];
  if (ps16) {
    const pcCap = m => m.provenance.captures.find(c => c.format === "primavera-completos" && c.day === 3);
    mustFail("a Primavera Sound 2016 tab on another day of the run", m => { pcCap(m).printed = "JUEVES 2"; }, ps16, () => {}, /does not print/);
    mustFail("Primavera Sound 2016 tabs that name no run in the year", m => { pcCap(m).tabs = pcCap(m).tabs.map(t => t === "LUNES 30" ? "MARTES 30" : t); }, ps16, () => {}, /does not print/);
    mustFail("a Primavera Sound 2016 page that is one venue's", m => { pcCap(m).active = "PARC DEL FÒRUM"; }, ps16, () => {}, /full timetable/);
    mustFail("a Primavera Sound 2016 page off another site", m => { pcCap(m).archivedUrl = pcCap(m).archivedUrl.replace("www.primaverasound.es", "www.clashfinder.com"); }, ps16);
  }
  // Shambhala 2024-2025 pages print no date: a capture is dated by the run
  // the festival's own post prints, and must be published in the year.
  const sh25 = editions["shambhala-2025"];
  if (sh25) {
    const shCap = m => m.provenance.captures.find(c => c.format === "shambhala-webflow" && c.day === 2);
    mustFail("a Shambhala page dated by a run the post does not print", m => { shCap(m).datesFrom.printed = "August 1-4, 2025"; }, sh25, () => {}, /does not|not 2025/);
    mustFail("a Shambhala page published the year before", m => { shCap(m).published = "2024-09-17"; }, sh25, () => {}, /published/);
    mustFail("a Shambhala page dated off another site", m => { shCap(m).datesFrom.archivedUrl = shCap(m).datesFrom.archivedUrl.replace("www.shambhalamusicfestival.com", "www.clashfinder.com"); }, sh25);
    mustFail("a Shambhala page whose weekday is not its day", m => { shCap(m).printed = "Saturday"; }, sh25);
    mustFail("a listed long set read half an hour longer (Shambhala 2025)", m => { m.sets.find(x => x.start === "00:30" && x.end === "09:00").end = "09:30"; }, sh25, () => {}, /over 8 hours/);
  }
  // EDC Las Vegas 2012-2013: one page prints every day, with no year in its
  // headings; the year is the page's own, on the brand's root domain.
  const edc12 = editions["edc-las-vegas-2012"];
  if (edc12) {
    const imCap = m => m.provenance.captures.find(c => c.format === "insomniac-music" && c.day === 2);
    mustFail("an EDC day heading whose weekday is not its day", m => { imCap(m).printed = "Sunday - June 9th"; }, edc12);
    mustFail("an EDC page dated by neither its title nor its description", m => { imCap(m).yearFrom = "the capture's timestamp"; }, edc12);
    mustFail("an EDC page that never names Las Vegas", m => { imCap(m).place = "the URL"; }, edc12);
    mustFail("an EDC page on another city's subdomain", m => { const c = imCap(m); c.archivedUrl = c.archivedUrl.replace("//electricdaisycarnival.com/", "//orlando.electricdaisycarnival.com/"); }, edc12);
  }
  // Time Warp 2022: its lineup survives only in a Feb 2023 capture of the
  // edition's own /22/ address; no other address or later year may pass.
  const tw22 = editions["time-warp-2022"];
  if (tw22) {
    const twCap = m => m.provenance.captures[0];
    mustFail("a Time Warp 2022 lineup read off the 2023 edition's address", m => { const c = twCap(m); c.archivedUrl = c.archivedUrl.replace("/22/lineup", "/23/lineup"); }, tw22, () => {}, /is not from 2022/);
    mustFail("a Time Warp 2022 lineup captured two years on", m => { const c = twCap(m); c.archivedUrl = c.archivedUrl.replace("/web/2023", "/web/2024"); c.captureTimestamp = c.captureTimestamp.replace(/^2023/, "2024"); }, tw22, () => {}, /is not from 2022/);
  }
  // Tomorrowland 2010-2012: each day page prints its day as its own tab, with
  // no year, on the festival's own .be site.
  const tml10 = editions["tomorrowland-2010"];
  if (tml10) {
    const tcCap = m => m.provenance.captures.find(c => c.format === "tml-cms" && c.day === 1);
    mustFail("a Tomorrowland 2010 tab printed for another day", m => { tcCap(m).printed = "Sunday 25 july"; }, tml10);
    mustFail("a Tomorrowland 2010 tab whose weekday is not its date", m => { tcCap(m).printed = "Friday 24 july"; }, tml10);
    mustFail("a Tomorrowland 2010 page read off another site", m => { const c = tcCap(m); c.archivedUrl = c.archivedUrl.replace("www.tomorrowland.be", "www.tomorrowlandfans.com"); }, tml10);
  }
  // HARD Summer 2012: one page draws both days; each heading prints its
  // weekday alone and the dates are the run the page prints, on HARD's site.
  const hs12 = editions["hard-summer-2012"];
  if (hs12) {
    const hwCap = m => m.provenance.captures.find(c => c.format === "hard-wp" && c.day === 2);
    mustFail("a HARD Summer day heading printed for the other day", m => { hwCap(m).printed = "FRIDAY"; }, hs12);
    mustFail("a HARD Summer run that is not the edition's", m => { hwCap(m).dateFrom = "Friday, August 2nd & Saturday, August 3rd, 2013"; }, hs12);
    mustFail("a HARD Summer page read off another site", m => { const c = hwCap(m); c.archivedUrl = c.archivedUrl.replace("www.hardfest.com", "www.hardsummerfans.com"); }, hs12);
  }
  // Lollapalooza 2018: the lineup cards print each set's day as "Sat 8/04" on
  // Lollapalooza's own site; the capture predates the festival, so no day is
  // timed.
  const lo18 = editions["lollapalooza-2018"];
  if (lo18) {
    const lcCap = m => m.provenance.captures.find(c => c.format === "lolla-cards" && c.day === 3);
    mustFail("a Lollapalooza 2018 card day printed for another day", m => { lcCap(m).printed = "Fri 8/03"; }, lo18);
    mustFail("a Lollapalooza 2018 card day whose weekday is not its date", m => { lcCap(m).printed = "Sun 8/04"; }, lo18);
    mustFail("a Lollapalooza 2018 page read off another site", m => { const c = lcCap(m); c.archivedUrl = c.archivedUrl.replace("www.lollapalooza.com", "www.lollapaloozafans.com"); }, lo18);
  }
  // Outside Lands 2018-2019 and 2022-2025 and Lightning in a Bottle
  // 2018-2019: the official lineup widget's script prints each set's whole
  // date; the day is inside the run its options print (a gate day at either
  // end at most), and the official lineup page that loads it was captured
  // within a month of it (Outside Lands 2019: through the site's own script,
  // captured within a day of the page on the page's own host).
  const osl23 = editions["outside-lands-2023"];
  if (osl23) {
    const deCap = m => m.provenance.captures.find(c => c.format === "dostuff-embed" && c.day === 2);
    mustFail("an Outside Lands widget day printed for another day", m => { deCap(m).printed = "2023-08-13"; }, osl23);
    mustFail("an Outside Lands widget run that leaves out a day of the edition", m => { deCap(m).run = "2023-08-12 to 2023-08-13"; }, osl23);
    mustFail("an Outside Lands widget run two days past the edition", m => { deCap(m).run = "2023-08-11 to 2023-08-15"; }, osl23);
    mustFail("an Outside Lands widget read off another site", m => { const c = deCap(m); c.archivedUrl = c.archivedUrl.replace("osl23fest.dostff.co", "oslfans.dostff.co"); }, osl23);
    mustFail("an Outside Lands widget embedded by another site's page", m => { deCap(m).embeddedBy.url = "https://www.oslfans.com/lineup/"; }, osl23);
    mustFail("an Outside Lands widget whose page was captured two months before", m => { deCap(m).embeddedBy.captureTimestamp = "20230614134823"; }, osl23);
    mustFail("an Outside Lands widget whose page was captured two months after", m => { deCap(m).embeddedBy.captureTimestamp = "20231014134830"; }, osl23);
  }
  const osl19 = editions["outside-lands-2019"];
  if (osl19) {
    const viaCap = m => m.provenance.captures.find(c => c.format === "dostuff-embed" && c.day === 1);
    mustFail("an Outside Lands widget loaded through another site's script", m => { viaCap(m).embeddedBy.via.url = "https://www.oslfans.com/assets/js/dist/main.js"; }, osl19);
    mustFail("an Outside Lands widget loaded through a site script captured two days after its page", m => { viaCap(m).embeddedBy.via.captureTimestamp = "20190826062646"; }, osl19);
    mustFail("an Outside Lands widget loaded through a site page, not a script", m => { viaCap(m).embeddedBy.via.url = "https://www.sfoutsidelands.com/lineup/"; }, osl19);
  }
  const lib18 = editions["lightning-in-a-bottle-2018"];
  if (lib18) {
    const libCap = m => m.provenance.captures.find(c => c.format === "dostuff-embed" && c.day === 1);
    mustFail("a Lightning in a Bottle widget day printed for another day", m => { libCap(m).printed = "2018-05-23"; }, lib18);
    mustFail("a Lightning in a Bottle widget whose page was captured two months away", m => { libCap(m).embeddedBy.captureTimestamp = "20180904142540"; }, lib18);
    mustFail("a Lightning in a Bottle widget embedded by another festival's page", m => { libCap(m).embeddedBy.url = "https://sfoutsidelands.com/lineup/"; }, lib18);
    mustFail("a Lightning in a Bottle widget read off another site", m => { const c = libCap(m); c.archivedUrl = c.archivedUrl.replace("lib2018.dostff.co", "libfans.dostff.co"); }, lib18);
  }
  const lolla = editions["lollapalooza-2025"], acl = editions["acl-2025"];
  if (lolla && acl) {
    const withReview = (label, mutateEdition, mutateReview, e) => {
      const m = clone(e), r = clone(reviewFor(e.id)); mutateEdition(m); mutateReview(r); mutations++;
      ok(validateEdition(m, { expected: expected[e.id], review: r, dropped: droppedFor(e.id) }).length > 0, `mutation not caught: ${label}`);
    };
    withReview("reviewed graphic hash differs from the shipped provenance", () => {}, r => { r.days[0].sha256 = "0".repeat(64); }, lolla);
    withReview("fewer rows confirmed against pixels than shipped", () => {}, r => { r.days[1].rowsConfirmed -= 1; }, lolla);
    withReview("unsigned review", () => {}, r => { delete r.days[2].reviewer; }, lolla);
    mutations++;
    ok(validateEdition(clone(acl), { expected: expected[acl.id], review: undefined, dropped: droppedFor(acl.id) }).length > 0, "mutation not caught: ACL with no review manifest");
    mustFail("a graphic day's dropped Silent Disco missing from the ledger (ACL)", () => {}, acl, d => { d.shift(); });
  }
  // Founder rulings (#221): a dropped category must not appear in an edition in
  // ANY form. Every category, and every listed activity, is put back as an
  // artist set, as an event, and as a stage, into the edition it came from.
  const dropSamples = [["edc-las-vegas-2025", "Fireworks"], ["acl-2025", "SILENT DISCO"], ["edc-las-vegas-2025", "Special Guest"],
    ["escape-halloween-2025", "SECRET GUEST"], ["escape-halloween-2022", "DANSE MACABRE - SILENT DISCO"],
    ["escape-halloween-2024", "AFTER PARTY SET TIMES – THE CAULDRON"],
    ["edc-orlando-2019", "CHANGEOVER"], ["edc-orlando-2022", "DISCOVERY PROJECT"],
    ...Object.entries(ACTIVITIES).flatMap(([id, list]) => list.map(a => [id, a]))];
  for (const [id, billing] of dropSamples) {
    const e = editions[id]; if (!e) continue;
    const back = { id: `${id}:back`, name: billing, key: artistKey(billing), performers: performerKeys(billing) };
    mustFail(`${billing} back as an artist set`, m => { m.artists.push(back); m.sets.push({ ...m.sets[0], id: `${m.sets[0].id}-${artistKey(billing)}`, artistId: back.id }); }, e, undefined, /: dropped /);
    mustFail(`${billing} back as an event`, m => { m.events = [{ id: `${id}:d1:x:0000:${artistKey(billing)}`, label: billing, day: 1, stageId: m.stages[0].id, start: "20:00", end: "21:00" }]; }, e, undefined, /: dropped .*appears/);
    mustFail(`${billing} back as a stage`, m => { m.stages[0].name = billing; }, e, undefined, /: dropped /);
  }
  // Stage-scoped drops: a Kinetic Field show segment is only dropped on
  // Kinetic Field, so each is put back as a set there, and the same name on
  // another stage stays a performer. "Discovery Project" is an unnamed slot
  // only on a printed stage; the stageless 2026 lineup entries keep it.
  {
    const o = editions["edc-orlando-2022"], o25 = editions["edc-orlando-2025"];
    ok(o && o25, "the EDC Orlando 2022 and 2025 editions must exist for the show-segment mutations");
    for (const [e, billing] of [[o, "GROW"], [o, "KINETIC BLOOM"], [o25, "INTERMEZZO: TECHNOPOLIS"], [o25, "KINETIC CELEBRATION: CITY OF SOUND & FIREWORKS"]]) if (e) {
      const kf = e.stages.find(s => /^kinetic ?field$/i.test(s.name));
      mustFail(`${billing} back as a Kinetic Field set (${e.id})`, m => {
        const a = { id: `${e.id}:${artistKey(billing)}-back`, name: billing, key: artistKey(billing), performers: performerKeys(billing) };
        m.artists.push(a); m.sets.push({ ...m.sets[0], id: `${m.sets[0].id}-${artistKey(billing)}`, artistId: a.id, stageId: kf.id });
      }, e, undefined, /: dropped show-segment /);
    }
    ok(!dropReason("GROW", "Neon Garden") && !dropReason("Discovery Project", ""), "a show-segment name off Kinetic Field, or a stageless Discovery Project, must not be dropped");
    ok(lineupDropReason("Discovery Project", "")?.category === "unnamed-slot" && !lineupDropReason("Discovery Project Winner Name", ""), "a past lineup page's bare Discovery Project is an unnamed slot; a named act is kept");
    for (const id of ["nocturnal-wonderland-2016", "beyond-wonderland-socal-2016"]) {
      const ed = editions[id];
      ok(ed && !ed.artists.some(a => /^discovery project$/i.test(a.name)), `${id}: the bare Discovery Project slot must not be listed as an artist`);
    }
    // The 2012 and 2013 lineup.php "Discovery Project" stage of named DJs is
    // kept by name (KEPT_STAGES), and nothing else about it is exempt: a bare
    // "Discovery Project" set on it is still an unnamed slot.
    for (const id of Object.keys(KEPT_STAGES)) {
      const k = editions[id];
      ok(k, `${id} must exist: its kept stage is locked by this test`);
      if (!k) continue;
      const st = k.stages.find(s => KEPT_STAGES[id].includes(s.name));
      ok(st && k.sets.some(s => s.stageId === st.id), `${id} must keep its "${KEPT_STAGES[id][0]}" stage with its sets`);
      mustFail(`a bare Discovery Project set back on ${id}'s kept stage`, m => {
        const a = { id: `${id}:discovery-project-back`, name: "Discovery Project", key: artistKey("Discovery Project"), performers: [] };
        m.artists.push(a); m.sets.push({ ...m.sets.find(s => s.stageId === st.id), id: `${id}:d1:x:9999:discovery-project`, artistId: a.id });
      }, k, undefined, /: dropped unnamed-slot /);
    }
    // New Year's Eve: a capture from early January counts, a later one does not.
    const nye = editions["countdown-nye-2023"];
    ok(nye && nye.provenance.captures[0].captureTimestamp.startsWith("2024"), "countdown-nye-2023 must keep its early-January capture: it locks the year-end rule");
    if (nye) {
      const at = ts => m => { const c = m.provenance.captures[0]; c.archivedUrl = c.archivedUrl.replace(/\/web\/\d+\//, `/web/${ts}/`); c.captureTimestamp = ts; };
      mustFail("a New Year's Eve capture from February of the next year", at("20240215120000"), nye, undefined, /is not from 2023/);
      mustFail("a New Year's Eve capture from before the year", at("20221231120000"), nye, undefined, /is not from 2023/);
      const okP = validateEdition((() => { const m = clone(nye); at("20240120120000")(m); return m; })(), { expected: expected[nye.id], review: reviewFor(nye.id), dropped: droppedFor(nye.id) });
      ok(!okP.length, `a New Year's Eve capture 20 days after the last day must pass: ${okP.join("; ")}`);
    }
    // An unnamed B2B partner stays in the billing but is no performer.
    const dw = editions["edc-orlando-2021"]?.artists.find(a => a.name === "DRINKURWATER B2B Special Guest");
    ok(dw && dw.performers.join() === "drinkurwater", `Orlando 2021's "DRINKURWATER B2B Special Guest" must keep its billing with drinkurwater as its only performer: ${JSON.stringify(dw)}`);
    // The importer: a stage map may only re-case and re-space a name, and a
    // page's day is its active tab, never the dates in its site translations.
    ok(stageFor({ stageAs: { kineticFIELD: "Kinetic Field" } }, "kineticFIELD") === "Kinetic Field" && stageFor({ stageAs: { kineticFIELD: "Kinetic Field" } }, "neonGARDEN") === "neonGARDEN",
      "stageAs must carry a mapped stage and leave an unmapped one as printed");
    let renamed = false; try { stageFor({ stageAs: { rynobusARTCAR: "Rynobus" } }, "rynobusARTCAR"); } catch { renamed = true; }
    mutations++; ok(renamed, "mutation not caught: a stageAs map that renames a stage (rynobusARTCAR → Rynobus)");
    const tabHtml = `<a class="button-blocks"> Friday, November 07</a><a href="/day-2/" class="button-blocks button-blocks--active">Saturday, November 09</a>`;
    ok(activeTab(tabHtml) === "Saturday, November 09" && activeTab(`_siteTranslations={"d":"Saturday, November 08"}`) === undefined,
      "the active day tab must be read from the tab, never from other dates on the page");
    // Dreamstate 2016's theme: every day on one page, a pane per day, stage
    // headers in order, then one ds-stage column per stage.
    const box = (a, t) => `<div class="ds-event-box"><div class="ds-event-container"><div class="ds-tooltip"><img></div><strong class="ds-event-title">${a}</strong> <span class="ds-time-range">${t}</span></div></div>`;
    const pane = (id, stages, cols) => `<div role="tabpanel" class="tab-pane" id="${id}"><div class="ds-schedule-header">${stages.map(x => `<div class="stg ">${x}</div>`).join("")}</div>`
      + cols.map(c => `<div class="ds-stage "><div class="ds-bands">${c.join("")}</div></div>`).join("") + `</div>`;
    const tabs = `<li id="day_fri" data-day="fri" class="active">Friday, November 25 </li><li id="day_sat" data-day="sat">Saturday, November 26</li>`;
    const dt = parseDayTabs(tabs + pane("fri", ["THE DREAM", "TIMELESS"], [[box("UCast", "5:00 PM - 6:00 PM")], [box("Tom &amp; Jerry", "1:00 AM - 2:00 AM")]])
      + pane("sat", ["THE DREAM"], [[box("KhoMha", "6:00 PM - 7:00 PM"), box("Special Guest", "11:00 PM - 12:00 AM")]]));
    ok(JSON.stringify(dt) === JSON.stringify([{ tab: "Friday, November 25", sets: [{ stage: "THE DREAM", artist: "UCast", printed: "5:00 PM - 6:00 PM" },
      { stage: "TIMELESS", artist: "Tom & Jerry", printed: "1:00 AM - 2:00 AM" }] }, { tab: "Saturday, November 26", sets: [
      { stage: "THE DREAM", artist: "KhoMha", printed: "6:00 PM - 7:00 PM" }, { stage: "THE DREAM", artist: "Special Guest", printed: "11:00 PM - 12:00 AM" }] }]),
      `a day-tabs page must come back pane by pane, each set under its own stage and tab: ${JSON.stringify(dt)}`);
    let short = false; try { parseDayTabs(tabs + pane("fri", ["THE DREAM", "TIMELESS"], [[box("UCast", "5:00 PM - 6:00 PM")]])); } catch { short = true; }
    mutations++; ok(short, "mutation not caught: a day-tabs pane with more stage headers than columns");
    // Tomorrowland's timetable page: every day of both weekends on one page,
    // stage headings in order, then one performance list per stage. The days
    // are printed a second time further down; reading stops where an id repeats.
    const perf = (a, t, d0 = "2019-07-19") => { const [x, y] = t.split(" - "); return `<li class="performance" data-start="${d0}T${x}:00+02:00" data-end="${d0}T${y}:00+02:00">`
      + (a ? `<span class="performance__artist">${a}</span>` : "") + `<span class="performance__timeslot">${t}</span></li>`; };
    const tday = (idn, label, heads, lists) => `<div class="eventday" data-eventday-id="${idn}" data-eventday="${label}"><div class="stages">`
      + heads.map(h => `<div class="stage"><div class="stage__heading"><h4>${h}</h4></div></div>`).join("") + `</div><div class="performances">`
      + lists.map(l => `<ul class="stage__performances">${l.join("")}</ul>`).join("") + `</div></div>`;
    const loc = (a, b) => `${a}<span class="stage__location"> - ${b}</span>`;
    const tml = tday(1, "Thursday 18 July 2019", ["The Gathering"], [[perf("Opening", "20:00 - 21:00", "2019-07-18")]])
      + tday(2, "Friday 19 July 2019", ["Mainstage", loc("Holosphere", "Freedom Stage")], [[perf("Carl Cox (Daybreak Session)", "12:00 - 13:00"), perf("", "13:00 - 14:00")], [perf("Tom &amp; Jerry", "23:00 - 01:00")]])
      + `<section>` + tday(1, "Thursday 18 July 2019", [], []);
    const tp = parseTomorrowland(tml), tf = tp.days[1];
    ok(tp.days.length === 2 && tp.days[0].date === "2019-07-18" && tf.date === "2019-07-19" && tf.empty.length === 1
      && JSON.stringify(tf.sets) === JSON.stringify([{ stage: "Mainstage", start: "12:00", end: "13:00", artist: "Carl Cox (Daybreak Session)" }, { stage: "Freedom Stage", start: "23:00", end: "01:00", artist: "Tom & Jerry" }])
      && tf.stages[1].host === "Holosphere", `a Tomorrowland page must come back day by day, stopping at the repeated days, with the host kept apart: ${JSON.stringify(tp)}`);
    ok(parseTomorrowland(tml, { stageFrom: "heading" }).days[1].sets[1].stage === "Holosphere", "stageFrom heading must read the stage off the heading");
    ok(eventDay("The Gathering 19 July 2018")?.weekday === "Thursday" && eventDay("Saturday 19 July 2019") === null, "a day label must name its own weekday (or The Gathering)");
    let drift = false; try { parseTomorrowland(tml.replace("2019-07-19T12:00", "2019-07-19T12:30")); } catch { drift = true; }
    mutations++; ok(drift, "mutation not caught: a Tomorrowland set whose data-start disagrees with its printed time");
    let lists = false; try { parseTomorrowland(tday(2, "Friday 19 July 2019", ["Mainstage", "Cage"], [[perf("A", "12:00 - 13:00")]])); } catch { lists = true; }
    mutations++; ok(lists, "mutation not caught: a Tomorrowland day with more stage headings than performance lists");
    // Electric Forest's set-times.php (2012, 2013): an "All Days" view, then
    // one grid per day tab. Each artist block is placed on a 15-minute axis
    // (49 px a mark): its top must be its printed start, and a single block's
    // height its length, or the set is not kept.
    const efNav = tabs => `<ul class="page-nav set-times-nav"><li class="first current">All Days</li>`
      + tabs.map((t, i) => `<li><a href="set-times.php?day=${i + 1}">${t}</a></li>`).join("") + `</ul>`;
    const efPx = (from, to) => `height: ${+((to - from) * 49 / 15 - 5).toFixed(3)}px; top: ${+(from * 49 / 15 + 2).toFixed(3)}px;`;
    const efEntry = (a, t) => `<span class="artist-title">${a}</span> <span class="artist-times">${t}</span>`;
    const efBlock = (cls, from, to, inner) => `<a class="artist-block${cls}" style="${efPx(from, to)}">${inner}</a>`;
    const efDay = (weekday, stages, cols) => `<div class="set-stages"><h5 class="set-time-day">${weekday}</h5>`
      + stages.map((n, i) => `<h3 class="stage-title stage-number-${i + 1}">${n}</h3>`).join("") + `</div><div class="set-times">`
      + ["6:00pm", "6:15pm", "6:30pm", "6:45pm"].map(t => `<div class="time-marker" style="height: 48px;"> <span>${t}</span></div>`).join("")
      + cols.map((c, i) => `<div class="stage-block stage-number-${i + 1}">${c.join("")}</div>`).join("") + `</div>`;
    // Minutes after the 6:00pm axis start.
    const efCols = [[efBlock("", 0, 60, efEntry("Ranch Act", "6:00pm - 7:00pm")), efBlock("", 345, 420, efEntry("Late &amp; Co", "11:45pm - 1:00am")),
      efBlock("", 420, 480, efEntry("Closer", "1:00am - Close"))],
      [efBlock(" format", 0, 60, `<span class="group-title">Curated Hour</span>` + efEntry("Pair A", "6:00pm - 6:30pm") + efEntry("Pair B", "6:30pm - 7:00pm")),
      efBlock("", 90, 120, efEntry("Bar Set", "*beginning at 7:30pm")), efBlock("", 120, 165, efEntry("Short Block", "8:00pm - 9:00pm"))]];
    const efPage = efNav(["Thursday - June 28th"]) + efDay("Thursday", ["Ranch Arena", "Tripolee"], efCols);
    const ep = parseElectricForest(efPage, { year: 2012 }).days[0];
    ok(ep.date === "2012-06-28" && JSON.stringify(ep.sets.map(s => [s.stage, s.start, s.end, s.artist, !!s.openEnd, s.group || ""])) === JSON.stringify([
      ["Ranch Arena", "18:00", "19:00", "Ranch Act", false, ""], ["Ranch Arena", "23:45", "01:00", "Late & Co", false, ""], ["Ranch Arena", "01:00", "", "Closer", true, ""],
      ["Tripolee", "18:00", "18:30", "Pair A", false, "Curated Hour"], ["Tripolee", "18:30", "19:00", "Pair B", false, "Curated Hour"]])
      && ep.untimed.map(u => u.artist).join() === "Bar Set" && ep.misprints.length === 1 && /runs 20:00 to 20:45/.test(ep.misprints[0].misprint),
      `an Electric Forest grid must come back set by set, across midnight, with groups, open ends, untimed rows and misprints apart: ${JSON.stringify(ep)}`);
    ok(navDay("Thursday - June 28th", 2012)?.date === "2012-06-28" && navDay("Friday - June 28th", 2012) === null, "an Electric Forest day tab must name its date's own weekday");
    const efMust = (what, html) => { let bad = false; try { parseElectricForest(html, { year: 2012 }); } catch { bad = true; } mutations++; ok(bad, `mutation not caught: ${what}`); };
    efMust("an Electric Forest block off its printed start", efPage.replace(efPx(345, 420), efPx(355, 430)));
    efMust("an Electric Forest plain block printing two artists", efPage.replace(efEntry("Ranch Act", "6:00pm - 7:00pm"), efEntry("Ranch Act", "6:00pm - 6:30pm") + efEntry("Other", "6:30pm - 7:00pm")));
    efMust("an Electric Forest group entry outside its group block", efPage.replace("6:30pm - 7:00pm", "6:30pm - 7:30pm"));
    efMust("an Electric Forest artist printed outside any block", efPage.replace(`</div></div>`, `${efEntry("Stray", "9:00pm - 10:00pm")}</div></div>`));
    efMust("an Electric Forest day grid without its tab", efNav([]) + efDay("Thursday", ["Ranch Arena", "Tripolee"], efCols));
    efMust("an Electric Forest page that is one day's view", efPage.replace(`<li class="first current">All Days</li>`, `<li class="first">All Days</li>`));
    // Shambhala's schedule page (2011 to 2016): one table per weekday tab, a
    // row per half hour whose time cell is id="time_T" (T the wall time as a
    // UTC epoch), a set printed in its block's first cell with its start under
    // it. A table's last row is the next table's first, printed again.
    const shT = (d, h, m) => Date.UTC(2016, 7, d, h, m) / 1000;
    const shHead = `<tr><th id="time_head">Time</th><th id="Pagoda_head">Pagoda</th><th id="Village_head">Village</th></tr>`;
    const shRow = (T, a, b) => `<tr><td id="time_${T}">${slotLabel(new Date(T * 1000).getUTCHours() * 60 + new Date(T * 1000).getUTCMinutes())}</td>`
      + `<td id="pagoda_${T}"${a[0] ? ` class="${a[0]}"` : ""}>${a[1] || ""}</td><td id="village_${T}"${b[0] ? ` class="${b[0]}"` : ""}>${b[1] || ""}</td></tr>`;
    const shSet = (who, at) => `${who}<br><span class="little">${at}</span>`;
    const shTable = (rows, again = "") => `<table class="x" id="schedule_table"><thead>${shHead}</thead><tbody>${again}${rows.join("")}</tbody></table>`;
    const shPage = `<ul class="tabList"><li><a href="#">Thursday</a></li><li><a href="#">Friday</a></li></ul>`
      + shTable([shRow(shT(4, 23, 0), ["open top", shSet("Opener", "11:10PM")], ["closed top", "CLOSED"]),
        shRow(shT(4, 23, 30), ["open bottom"], ["closed bottom"]),
        shRow(shT(5, 0, 0), ["open top bottom", shSet("Midnight Act", "12:00AM")], ["top bottom"])])
      + shTable([shRow(shT(5, 0, 0), ["open top bottom", shSet("Midnight Act", "12:00AM")], ["open top bottom", shSet("Ranged (12:05-12:50am)", "12:05AM")]),
        shHead, shRow(shT(5, 0, 30), ["open top bottom", shSet("Deeps", "12:30AM")], []),
        shRow(shT(5, 1, 0), ["open top bottom", shSet("vs. Wakcutt (12:30-1:30am)", "1:00AM")], [])]);
    const sp = parseShambhala(shPage, { year: 2016 }).days;
    ok(JSON.stringify(sp.map(d => [d.label, d.date, d.firstSlot, d.sets.map(x => [x.stage, x.start, x.end, x.artist, x.openEnd]), d.overlap.map(x => x.artist), d.joined.length, d.closed, d.empty, d.lastRowRepeatsNext]))
      === JSON.stringify([
        ["Thursday", "2016-08-04", `time_${shT(4, 23, 0)}`, [["Pagoda", "23:10", "", "Opener", true]], ["Midnight Act"], 0, 1, 1, true],
        ["Friday", "2016-08-05", `time_${shT(5, 0, 0)}`, [["Pagoda", "00:00", "", "Midnight Act", true], ["Pagoda", "00:30", "01:30", "Deeps vs. Wakcutt", false], ["Village", "00:05", "00:50", "Ranged", false]], [], 1, 0, 0, false]]),
      `a Shambhala table must come back set by set, with the next day's first row kept once, printed ranges read, split billings joined: ${JSON.stringify(sp)}`);
    const shMust = (what, html) => { let bad = false; try { parseShambhala(html, { year: 2016 }); } catch { bad = true; } mutations++; ok(bad, `mutation not caught: ${what}`); };
    shMust("a Shambhala start outside its half hour", shPage.replace("11:10PM", "11:40PM"));
    shMust("a Shambhala closed block printing a name", shPage.replace("CLOSED", "Somebody"));
    shMust("a Shambhala tab naming another weekday", shPage.replace(">Thursday<", ">Wednesday<"));
    shMust("a Shambhala last row not printed again as the next day's first", shPage.replace(/(<table[\s\S]*?<table[\s\S]*?)Midnight Act/, "$1Other Act"));
    shMust("a Shambhala billing printed inside a block, not at its top", shPage.replace(`class="open bottom"></td>`, `class="open bottom">Stray</td>`));
    shMust("a Shambhala split billing continuing no set", shPage.replace("Ranged (12:05-12:50am)", "&amp; Friend"));
    shMust("a Shambhala time cell printing another slot", shPage.replace(">11:30<", ">11:45<"));
    shMust("a Shambhala printed range of more than six hours", shPage.replace("(12:05-12:50am)", "(12:05-6:50am)"));
    shMust("a Shambhala heading whose id is not its name", shPage.replace(`<th id="Village_head">Village</th></tr></thead>`, `<th id="Village_head">Grove</th></tr></thead>`));
    shMust("a Shambhala cell with an unknown class", shPage.replace(`class="open top"`, `class="open top live"`));
    shMust("a Shambhala tab with no table", shPage.replace(`</ul>`, `<li><a href="#">Saturday</a></li></ul>`));
    shMust("a Shambhala repeated head row naming other stages", shPage.replace(`${shHead}<tr><td id="time_${shT(5, 0, 30)}"`, `${shHead.replace(">Village<", ">Grove<").replace('"Village_head"', '"Grove_head"')}<tr><td id="time_${shT(5, 0, 30)}"`));
    shMust("a Shambhala row not half an hour after the one before", shPage.replaceAll(String(shT(5, 1, 0)), String(shT(5, 1, 30))));
    // Outside Lands' DoStuff grid: one day per page, 15-minute axis rows of
    // 29 px (2 px a minute), times printed with no am/pm; one act's own page
    // prints its set with a meridiem and fixes the day's axis.
    const dsRow = (i, l) => `<li style="height: 29.0px; line-height: 29.0px;" class="ds-schedule-row-${i}">${l}</li>`;
    const dsBox = (id, top, h, slug, name, range, extra = "") => `<div ${extra}class="ds-event-box ds-event-${id}" id="${id}" style="top:${top}px;height:${h}px;line-height:${h}px"><span class="ds-vert-align">&nbsp;</span><div class="ds-event-container"><strong class="ds-event-title" style="font-size:1.0em;"><a href="https://web.archive.org/band/${slug}">${name}</a></strong><span class="ds-time-range" style="font-size:1.0em;">${range}</span></div></div>`;
    const dsAxis = ["12:00", "12:15", "12:30", "12:45", "1:00", "1:15", "1:30", "1:45", "2:00", "2:15"].map((l, i) => dsRow(100 + i, l)).join("");
    const dsPage = `<title>Outside Lands 2013</title><ul class="ds-schedule-days"><li class=""><a href="https://web.archive.org/events/2013/08/09/">Friday, August 9</a></li>`
      + `<li class="ds-schedule-days-current-date"><a href="https://web.archive.org/events/2013/08/10/">Saturday, August 10</a></li></ul>`
      + `<div class="ds-schedule ds-player day10"><table><tbody><tr class="ds-schedule-header"><th class="ds-time"></th><th class="ds-venue-column-1-20130810">Lands End</th><th class="ds-venue-column-2-20130810">The Barbary</th></tr>`
      + `<tr><th class="ds-times"><ul>${dsAxis}</ul></th><td class="ds-stage ds-stage1 ds-venue-column-1-20130810"><div class="ds-bands">`
      + dsBox(11, "0.0", "79.0", "opener", "Opener", "12:00 - 12:40") + dsBox(12, "120.0", "99.0", "headliner", "Headliner &amp; Friends", "1:00 - 1:50", `band_id="9" `)
      + `</div></td><td class="ds-stage ds-stage2 ds-venue-column-2-20130810"><div class="ds-bands">` + dsBox(21, "30.0", "-1261.0", "comic", "Comic", "12:15 - 1:00")
      + `</div></td></tr></tbody></table></div>`;
    const dsBand = `<title>Headliner at Outside Lands 2013</title><div class="ds-arrange ds-performance-location"> <h2>Playing</h2> <p> <a href="https://web.archive.org/events/2013/08/10">Saturday Aug 10 1:00 PM</a> on Lands End<br> </p> </div>`;
    const dp = parseDoStuff(dsPage), dsT = timeDay(dp, parseDoStuffBand(dsBand), "headliner");
    ok(JSON.stringify([dp.label, dp.date, dp.stages, dp.scale, dp.misprints.map(x => x.artist), dsT.axisStart, dsT.sets.map(x => [x.stage, x.start, x.end, x.artist])])
      === JSON.stringify(["Saturday, August 10", "2013-08-10", ["Lands End", "The Barbary"], 2, ["Comic"], "12:00", [["Lands End", "12:00", "12:40", "Opener"], ["Lands End", "13:00", "13:50", "Headliner & Friends"]]]),
      `an Outside Lands grid must come back set by set, its axis fixed by the act's page and a misplaced block kept apart: ${JSON.stringify([dp, dsT])}`);
    const dsMust = (what, html, band = dsBand) => { let bad = false; try { timeDay(parseDoStuff(html), parseDoStuffBand(band), "headliner"); } catch { bad = true; } mutations++; ok(bad, `mutation not caught: ${what}`); };
    dsMust("an Outside Lands block placed off its printed start", dsPage.replace("top:120.0px", "top:140.0px"));
    dsMust("an Outside Lands block whose length is not its range", dsPage.replace("height:99.0px", "height:119.0px"));
    dsMust("an Outside Lands tab naming another weekday", dsPage.replace(">Saturday, August 10<", ">Sunday, August 10<"));
    dsMust("an Outside Lands stage column printed for another date", dsPage.replace("ds-venue-column-2-20130810\">The", "ds-venue-column-2-20130811\">The"));
    dsMust("an Outside Lands axis row not 15 minutes after the one before", dsPage.replace(">12:45<", ">1:15<"));
    dsMust("an Outside Lands page of another festival", dsPage.replace("<title>Outside Lands 2013", "<title>Other Fest 2013"));
    dsMust("an Outside Lands grid block that cannot be read", dsPage.replace(`style="top:0.0px;height:79.0px`, `style="top: 0px; height: 79px`));
    dsMust("an Outside Lands anchor whose time is not its block's on the axis", dsPage, dsBand.replace("1:00 PM", "1:10 PM"));
    dsMust("an Outside Lands anchor printed for another day", dsPage, dsBand.replace("events/2013/08/10", "events/2013/08/09"));
    dsMust("an Outside Lands anchor on another stage", dsPage, dsBand.replace("on Lands End", "on Sutro"));
    dsMust("an Outside Lands anchor printing no meridiem", dsPage, dsBand.replace(" PM<", "<"));
    // From 2015 the act's page prints one linked heading per set, the stage
    // after the time only from 2017: both must time the day the same way.
    const dsBand15 = `<title>Headliner at Outside Lands 2013</title><div class="ds-arrange ds-performance-location"> <p> </p><h2><a href="https://web.archive.org/events/2013/08/10">Saturday, August 10, 1:00 PM</a></h2> <p></p> </div>`;
    const dsBand17 = dsBand15.replace("1:00 PM</a>", "1:00 PM Lands End<br></a>");
    for (const b of [dsBand15, dsBand17]) {
      const t = timeDay(dp, parseDoStuffBand(b), "headliner");
      ok(JSON.stringify(t.sets) === JSON.stringify(dsT.sets) && t.anchor.text === parseDoStuffBand(b).sets[0].text, `a newer Outside Lands act page must time the day as the older one does: ${JSON.stringify(t)}`);
    }
    dsMust("a newer Outside Lands anchor on another stage", dsPage, dsBand17.replace("Lands End<br>", "Sutro<br>"));
    dsMust("a newer Outside Lands anchor whose weekday is not its link's date", dsPage, dsBand15.replace("Saturday, August 10", "Friday, August 10"));
    dsMust("a newer Outside Lands anchor whose time is not its block's on the axis", dsPage, dsBand15.replace("1:00 PM", "1:10 PM"));
    // Lollapalooza 2012 ran on the same platform: its pages print the name
    // alone ("Lollapalooza", "Dev at Lollapalooza"), the year then the day
    // tab's own. A printed year must still be the tab's.
    const lpPage = dsPage.replace("<title>Outside Lands 2013", "<title>Lollapalooza"), lpBand = dsBand.replace("at Outside Lands 2013", "at Lollapalooza");
    const lp = parseDoStuff(lpPage), lpB = parseDoStuffBand(lpBand), lpT = timeDay(lp, lpB, "headliner");
    ok(dp.festival === "outside-lands" && dp.year === 2013 && lp.festival === "lollapalooza" && lp.year === 2013 && lpB.festival === "lollapalooza" && lpB.year === null
      && parseDoStuffBand(dsBand).festival === "outside-lands" && parseDoStuffBand(dsBand).year === 2013 && JSON.stringify(lpT.sets) === JSON.stringify(dsT.sets),
      `a Lollapalooza grid that prints no year must read as its tab's year, and time as Outside Lands' does: ${JSON.stringify([lp.festival, lp.year, lpB])}`);
    dsMust("a Lollapalooza page printing a year that is not its tab's", dsPage.replace("<title>Outside Lands 2013", "<title>Lollapalooza 2012"), lpBand);
    dsMust("a DoStuff act's page of another festival", lpPage, dsBand.replace("at Outside Lands 2013", "at Other Fest"));
    dsMust("a DoStuff act's page naming no festival", lpPage, dsBand.replace("Headliner at Outside Lands 2013", "Headliner"));
    // Lollapalooza 2011's older page: the days as a drop-down (the current
    // one as plain text, "Sat, Aug 6"), plain stage headers in column order,
    // an axis with no row heights (the blocks keep the scale) and autograph
    // signings listed below the grid, never read as sets. Its act page prints
    // the day and stage, then the linked time ("4:00<span>pm</span>").
    const oBox = (id, top, h, slug, name, range) => `<div band_id="${id}" class="ds-event-box   ds-player-show-state" id="${id}" style="top:${top}px;height:${h}px;line-height:${h}px"><span class="ds-vert-align">&nbsp;</span><div class="ds-event-container"><strong class="ds-event-title" style="font-size:1.4em;"><a href="https://web.archive.org/band/${slug}">${name}</a></strong><span class="ds-time-range" style="font-size:1.4em;">${range}</span></div></div>`;
    const oAxis = ["12:00", "12:15", "12:30", "12:45", "1:00", "1:15", "1:30", "1:45", "2:00", "2:15"].map(l => `<li>${l}</li>`).join("\n");
    const oPage = `<title>Lollapalooza 2011</title><div class="fl-vb-drop"><span>Sat, Aug 6</span><div><a href="https://web.archive.org/events/2011/08/05/">Fri, Aug 5</a><a href="https://web.archive.org/events/2011/08/07/">Sun, Aug 7</a></div>\n  </div>`
      + `<div class="ds-schedule ds-player day6"><table><tbody><tr class="ds-schedule-header"><th class="ds-time"></th><th> Bud Light </th><th> Perry's </th></tr>`
      + `<tr><th class="ds-times"><ul class="fl-schedule-times">${oAxis}</ul></th><td class="ds-stage ds-stage1"><div class="ds-bands">`
      + oBox(1, "0.0", "79.0", "opener", "Opener", "12:00 - 12:40") + oBox(2, "120.0", "99.0", "headliner", "Headliner", "1:00 - 1:50")
      + `</div></td><td class="ds-stage ds-stage2"><div class="ds-bands">` + oBox(3, "30.0", "59.0", "dj-one", "DJ One", "12:15 - 12:45") + oBox(4, "90.0", "89.0", "dj-two", "DJ Two", "12:45 - 1:30")
      + `</div></td></tr></tbody><div class="ds-schedule-lower"><div class="ds-stage-lower"><h3>f.y.e. Autograph Tent</h3><div class="ds-event-lower"><div class="ds-event-lower-time">1:15 PM</div><a href="https://web.archive.org/band/opener" class="ds-event-lower" id="9">Opener</a></div></div></div></table></div>`;
    const oBand = `<title>Headliner at Lollapalooza 2011</title><div class="fl-time">\n <p>Saturday, Aug. 6<br>Bud Light</p>\n <a href="https://web.archive.org/events/2011/08/06">\n <strong> 1:00<span>pm</span></strong>\n </a>\n </div>`;
    const op = parseDoStuff(oPage), oB = parseDoStuffBand(oBand), oT = timeDay(op, oB, "headliner");
    ok(JSON.stringify([op.festival, op.year, op.label, op.date, op.tabs.map(t => t.date), op.stages, op.scale, op.lower, oB.festival, oB.year, oT.anchor.text, oT.sets.map(x => [x.stage, x.start, x.end, x.artist])])
      === JSON.stringify(["lollapalooza", 2011, "Sat, Aug 6", "2011-08-06", ["2011-08-05", "2011-08-06", "2011-08-07"], ["Bud Light", "Perry's"], 2, 1, "lollapalooza", 2011, "Saturday, Aug. 6 1:00pm on Bud Light",
        [["Bud Light", "12:00", "12:40", "Opener"], ["Bud Light", "13:00", "13:50", "Headliner"], ["Perry's", "12:15", "12:45", "DJ One"], ["Perry's", "12:45", "13:30", "DJ Two"]]]),
      `a Lollapalooza 2011 grid must come back set by set, its scale kept by its blocks, its signings counted and never read as sets: ${JSON.stringify([op, oT])}`);
    const oMust = (what, html, band = oBand) => { let bad = false; try { timeDay(parseDoStuff(html), parseDoStuffBand(band), "headliner"); } catch { bad = true; } mutations++; ok(bad, `mutation not caught: ${what}`); };
    oMust("a Lollapalooza 2011 current day naming another weekday", oPage.replace("<span>Sat, Aug 6</span>", "<span>Sun, Aug 6</span>"));
    oMust("a Lollapalooza 2011 day link whose label is not its date", oPage.replace(">Fri, Aug 5<", ">Fri, Aug 12<"));
    oMust("a Lollapalooza 2011 grid marked for another day", oPage.replace("ds-player day6", "ds-player day7"));
    oMust("a Lollapalooza 2011 page whose title prints no year", oPage.replace("<title>Lollapalooza 2011", "<title>Lollapalooza"));
    oMust("a Lollapalooza 2011 page whose title prints another year", oPage.replace("<title>Lollapalooza 2011", "<title>Lollapalooza 2010"));
    oMust("a Lollapalooza 2011 column out of order", oPage.replace("ds-stage ds-stage2", "ds-stage ds-stage3"));
    oMust("a Lollapalooza 2011 column with no stage header", oPage.replace("<th> Perry's </th>", ""));
    oMust("a Lollapalooza 2011 axis row not 15 minutes after the one before", oPage.replace("<li>12:45</li>", "<li>1:15</li>"));
    oMust("Lollapalooza 2011 blocks that keep no one scale", oPage.replace("height:79.0px", "height:99.0px").replace("height:59.0px", "height:69.0px"));
    oMust("a Lollapalooza 2011 anchor whose time is not its block's on the axis", oPage, oBand.replace(" 1:00<span>", " 1:10<span>"));
    oMust("a Lollapalooza 2011 anchor printed for another day", oPage, oBand.replace("events/2011/08/06", "events/2011/08/07"));
    oMust("a Lollapalooza 2011 anchor whose weekday is not its link's date", oPage, oBand.replace("Saturday, Aug. 6", "Friday, Aug. 6"));
    oMust("a Lollapalooza 2011 anchor on another stage", oPage, oBand.replace("<br>Bud Light</p>", "<br>Perry's</p>"));
    oMust("a Lollapalooza 2011 anchor printing no time (Date & Time TBA)", oPage, oBand.replace(/<a href[\s\S]*<\/a>/, "Date &amp; Time TBA"));
    // ACL 2011 and 2012 mix the two: the newer tab row over the older grid
    // (plain headers, no axis heights), the signings just after the table,
    // and the older act page's "Playing" line.
    const aPage = oPage.replace("<title>Lollapalooza 2011", "<title>ACL 2011")
      .replace(/<div class="fl-vb-drop">[\s\S]*?<\/div>\n  <\/div>/, `<ul class="ds-schedule-days"><li class=""><a href="https://web.archive.org/events/2011/08/05/">Friday, August 5</a></li><li class="ds-schedule-days-current-date"><a href="https://web.archive.org/events/2011/08/06/">Saturday, August 6</a></li></ul>`)
      .replace(`<th class="ds-times"><ul class="fl-schedule-times">`, `<th class="ds-times"><ul>`)
      .replace(`</tbody><div class="ds-schedule-lower">`, `</tbody></table><div class="ds-schedule-lower">`);
    const aBand = `<title>Headliner at ACL 2011</title><div class="ds-arrange ds-performance-location"> <h2>Playing</h2> <p> <a href="https://web.archive.org/events/2011/08/06">Saturday Aug 6 1:00 PM</a> on Bud Light<br> </p> </div>`;
    const ap = parseDoStuff(aPage), aT = timeDay(ap, parseDoStuffBand(aBand), "headliner");
    ok(JSON.stringify([ap.festival, ap.label, ap.date, ap.stages, ap.scale, ap.lower, aT.sets]) === JSON.stringify(["acl", "Saturday, August 6", "2011-08-06", ["Bud Light", "Perry's"], 2, 1, oT.sets]),
      `an ACL 2011 grid (tab row over the older grid) must read as Lollapalooza 2011's does: ${JSON.stringify([ap, aT])}`);
    const aMust = (what, html, band = aBand) => { let bad = false; try { timeDay(parseDoStuff(html), parseDoStuffBand(band), "headliner"); } catch { bad = true; } mutations++; ok(bad, `mutation not caught: ${what}`); };
    aMust("an ACL 2011 grid marked for another day than its current tab", aPage.replace("ds-player day6", "ds-player day5"));
    aMust("an ACL 2011 current tab naming another weekday", aPage.replace(">Saturday, August 6<", ">Sunday, August 6<"));
    aMust("an ACL 2011 page with no day tabs at all", aPage.replace(/<ul class="ds-schedule-days">[\s\S]*?<\/ul>/, ""));
    aMust("an ACL 2011 page of another festival", aPage.replace("<title>ACL 2011", "<title>Other Fest 2011"));
    // Outside Lands' 2010-2011 planner: the page writes its stages and sets
    // as data (each set's date, 24-hour start and length), twice in 2011.
    const msEnt = (id, v, name, start, dur, extra = "") => `\t${id}: {\n\t\tid: ${id},\n\t\tvenueId: ${v},\n\t\tline1: '${name}',\n\t\tline2: '${extra}',\n\t\tstart: ${start === null ? "null" : `'${start}'`},\n\t\tduration: ${dur},\n\t\tminor: false\n\t}`;
    const msMaps = `var venueMap = {  1: {id: 1, line1: "Lands End", line2: 'Polo Field', line3: "", secondary:false},  5: {id: 5, line1: "The Barbary", line2: 'Polo Field', line3: "", secondary:false}  }; var entityMap = { `
      + [msEnt(39, 1, "Opener", "2011-08-12 12:00:00", 50), msEnt(46, 1, "Diego\\'s Band", "2011-08-12 18:30:00", 210), msEnt(52, 1, "Headliner", "2011-08-13 20:10:00", 105),
        msEnt(177, 5, "Comedy: Two Comics", "2011-08-12 12:50:00", 30, "Comedy: Two Comics"), msEnt(80, "null", "Floating DJ", null, 60)].join(",\n") + "\n};";
    const msPage = `<script>var festivalStart = Date.parseExact("2011-08-12", "yyyy-MM-dd");</script><script>${msMaps}</script><script>${msMaps}</script>`;
    const mp = parseMyScheduler(msPage, { year: 2011 });
    ok(JSON.stringify([mp.festivalStart, mp.stages, mp.unscheduled, mp.days.map(d => [d.date, d.firstStart, d.sets.map(x => [x.stage, x.start, x.end, x.artist, x.subtitle || ""])])])
      === JSON.stringify(["2011-08-12", ["Lands End", "The Barbary"], ["Floating DJ"], [["2011-08-12", "2011-08-12 12:00:00", [["Lands End", "12:00", "12:50", "Opener", ""], ["Lands End", "18:30", "22:00", "Diego's Band", ""], ["The Barbary", "12:50", "13:20", "Comedy: Two Comics", "Comedy: Two Comics"]]], ["2011-08-13", "2011-08-13 20:10:00", [["Lands End", "20:10", "21:55", "Headliner", ""]]]]]),
      `an Outside Lands planner must come back set by set, with its end from its length and an entry with no stage kept apart: ${JSON.stringify(mp)}`);
    const msMust = (what, html, restore) => { let bad = false; try { const pg = parseMyScheduler(html, { year: 2011 }); if (restore) restoreSets(pg, restore); } catch { bad = true; } mutations++; ok(bad, `mutation not caught: ${what}`); };
    msMust("an Outside Lands planner whose two copies of the data differ", msPage.replace("'Opener'", "'Openers'"));
    msMust("an Outside Lands planner of another year", msPage.replaceAll("2011-", "2012-"));
    msMust("an Outside Lands planner whose first day is not festivalStart", msPage.replace('"2011-08-12", "yyyy', '"2011-08-11", "yyyy'));
    msMust("an Outside Lands set on a stage the page does not name", msPage.replaceAll("venueId: 5,", "venueId: 7,"));
    msMust("an Outside Lands set before 6 AM", msPage.replaceAll("2011-08-13 20:10:00", "2011-08-13 02:10:00"));
    msMust("two Outside Lands sets overlapping on one stage", msPage.replaceAll("2011-08-12 18:30:00", "2011-08-12 12:30:00"));
    msMust("an Outside Lands entry whose key is not its id", msPage.replaceAll("\t39: {", "\t38: {"));
    msMust("an Outside Lands planner skipping a day", msPage.replaceAll("2011-08-13 20:10:00", "2011-08-14 20:10:00"));
    msMust("an Outside Lands set with a length of no minutes", msPage.replaceAll("duration: 105", "duration: 0"));
    // A billing the capture cannot decode is read only by a name that keeps
    // every other character and stands one letter for each lost run.
    const msLost = msPage.replaceAll("'Headliner'", "'Head��liner'");
    ok(restoreSets(parseMyScheduler(msLost, { year: 2011 }), ["Headéliner"]).days[1].sets[0].artist === "Headéliner", "an undecodable Outside Lands billing must be read by its restored name");
    msMust("an undecodable Outside Lands billing with no restored name", msLost, []);
    msMust("an undecodable Outside Lands billing restored by a name that changes another letter", msLost, ["Heaxéliner"]);
    msMust("an undecodable Outside Lands billing restored by two letters for one lost run", msLost, ["Headéeliner"]);
    // Electric Forest's 2014-2015 Scheduler: a tab per day, then one
    // container per day whose blocks sit on a minute scale from the axis.
    const esBlock = (name, range, left, mins, px = 10, inner = true) => `<a class="timeslot minute-${mins}" style="left: ${left}px; width: ${mins * px}px;" title="${name} - ${range}"><div class="timeslot-title">${name}</div>${inner ? `<div class="timeslot-time">${range}</div>` : ""}</a>`;
    const esDay = (date, axisIso, first, rows) => `<div class="container date-${date}" data-date-min="${Date.parse(axisIso) / 1000}" data-date-max="${Date.parse(axisIso) / 1000 + 36000}"><div class="time-gauge"><div>${first}</div></div>`
      + rows.map(([st]) => `<div class="stage-label" title="${st}">`).join("</div>") + `</div><div class="schedule">` + rows.map(([, b]) => `<div class="row clearfix">${b.join("")}</div>`).join("") + `</div></div>`;
    const esTabs = `<a class="date-switcher" data-target="2015-06-25">June 25</a><a class="date-switcher active" data-target="2015-06-26">June 26</a>`;
    const esD1 = [["Ranch Arena", [esBlock("Opener", "4:00pm - 4:45pm", 0, 45), esBlock("Opener", "4:00pm - 4:45pm", 0, 45), esBlock("Brewery Tasting", "4:15pm - 4:30pm", 150, 15), esBlock("Headliner", "11:30pm - 12:45am", 4500, 75)]],
      ["Tripolee", [esBlock("Wrong Spot", "5:00pm - 5:30pm", 1200, 30), esBlock("Late DJ", "1:00am - 2:00am", 5400, 60)]]];
    const esD2 = [["Ranch Arena", [esBlock("Day Two", "3:00pm - 3:30pm", 0, 30)]], ["Tripolee", [esBlock("Channel Act", "4:00pm - 5:00pm", 600, 60, 10, false)]]];
    const esPage = (d1 = esD1, d2 = esD2, tabs = esTabs) => tabs + esDay("2015-06-25", "2015-06-25T16:00:00Z", "4:00pm", d1) + esDay("2015-06-26", "2015-06-26T15:00:00Z", "3:00pm", d2);
    const esp = parseEfScheduler(esPage(), { year: 2015, programme: ["Brewery Tasting"] });
    ok(JSON.stringify([esp.scale, esp.days.map(d => [d.date, d.label, d.weekday, d.axisStart, d.stages, d.sets.map(x => [x.stage, x.start, x.end, x.artist]), d.misprints.map(x => [x.artist, x.misprint]), d.repeats.map(x => x.artist)])])
      === JSON.stringify([10, [["2015-06-25", "June 25", "Thursday", "16:00", ["Ranch Arena", "Tripolee"],
        [["Ranch Arena", "16:00", "16:45", "Opener"], ["Ranch Arena", "16:15", "16:30", "Brewery Tasting"], ["Ranch Arena", "23:30", "00:45", "Headliner"], ["Tripolee", "01:00", "02:00", "Late DJ"]],
        [["Wrong Spot", "the block starts at 18:00 and runs 30 minutes"]], ["Opener"]],
        ["2015-06-26", "June 26", "Friday", "15:00", ["Ranch Arena", "Tripolee"], [["Ranch Arena", "15:00", "15:30", "Day Two"], ["Tripolee", "16:00", "17:00", "Channel Act"]], [], []]]]),
      `an Electric Forest Scheduler must come back set by set, past midnight on its own night, a misplaced block apart and a block drawn twice once: ${JSON.stringify(esp)}`);
    const esMust = (what, html, programme = ["Brewery Tasting"]) => { let bad = false; try { parseEfScheduler(html, { year: 2015, programme }); } catch { bad = true; } mutations++; ok(bad, `mutation not caught: ${what}`); };
    esMust("an Electric Forest tab whose label is not its date", esPage(esD1, esD2, esTabs.replace(">June 25<", ">June 24<")));
    esMust("an Electric Forest Scheduler of another year", esPage().replaceAll("2015-06-2", "2014-06-2"));
    esMust("Electric Forest containers in another order than the tabs", esPage(esD1, esD2, esTabs.replace('data-target="2015-06-25">June 25', 'data-target="2015-06-27">June 27')));
    esMust("an Electric Forest axis that prints another first hour", esPage().replace("<div>4:00pm</div>", "<div>5:00pm</div>"));
    esMust("an Electric Forest day with more stage labels than rows", esPage().replace('<div class="stage-label" title="Tripolee">', '<div class="stage-label" title="Tripolee"></div><div class="stage-label" title="Sherwood Court">'));
    esMust("an Electric Forest block drawn at another scale", esPage().replace("minute-45", "minute-40"));
    esMust("an Electric Forest block whose title is not its name and range", esPage().replace('title="Opener - 4:00pm', 'title="Openers - 4:00pm'));
    esMust("an Electric Forest range with no meridiem", esPage().replaceAll("4:00pm - 4:45pm", "4:00 - 4:45pm"));
    esMust("two Electric Forest sets overlapping on one stage", esPage([[esD1[0][0], [...esD1[0][1], esBlock("Clash", "4:30pm - 5:00pm", 300, 30)]], esD1[1]]));
    esMust("an Electric Forest programme entry not named as programme", esPage(), []);
    esMust("an Electric Forest Scheduler skipping a day", esPage().replaceAll("2015-06-26", "2015-06-28").replace(">June 26<", ">June 28<").replace(String(Date.parse("2015-06-26T15:00:00Z") / 1000), String(Date.parse("2015-06-28T15:00:00Z") / 1000)));
    msMust("a restored Outside Lands name that reads no billing", msPage, ["Headéliner"]);
    // Tomorrowland's 2013-2016 day page: a title with the day, an hour axis,
    // one row per stage whose slots and gaps are drawn at the axis's scale.
    const tdSlot = (w, name, range) => name ? `<div class="time-slot performance" style="width:${w}px;"><div class="facebook-bookmark follow"><span class="tml-heart"></span>\n<a href="/en/artist/x" title="${name}">${name}</a>\n<span class="time">${range}</span></div></div>` : `<div class="time-slot empty" style=" width: ${w}px;"></div>`;
    const tdAxis = ["22:00", "23:00", "0:00", "1:00"].map((h, i) => `<div class="pull-left" style="width:${i === 3 ? 40 : 60}px;">${h}</div>`).join("");
    const tdRows = [["5", [tdSlot(30, "Opener", "22:00-22:30"), tdSlot(30, "Late &amp; Co", "22:30-23:00"), tdSlot(15), tdSlot(45, "Past Midnight", "23:15-0:00"), tdSlot(60, "Night", "0:00-1:00")]],
      ["32", [tdSlot(60, "Clash One", "22:00-23:00"), tdSlot(60, "Clash Two", "22:30-23:30")]], ["350", [tdSlot(180, "Radio Show", "22:00-1:00")]], ["76", []]];
    const tdNames = [["5", `<img class="stage-icon" alt="Mainstage">`], ["32", `<img alt="Super You&amp;amp;Me">`], ["350", `<img alt="Radio Modern">`], ["76", "More Artists"]];
    const tdPage = (title = "Saturday/ 27 July", rows = tdRows, names = tdNames, axis = tdAxis) => `<h1 class="page-title">${title}</h1><div class="stages" style="width: 240px;"><div class="hours">${axis}</div>`
      + rows.map(([id, s]) => `<div class="stage" data-id="${id}">${s.length ? `<div class="artists">${s.join("")}</div>` : ""}</div>`).join("")
      + `</div><div class="wrap stage-titles">` + names.map(([id, n]) => `<div class="stage-logo-wrap"><div class="stage-logo" data-id="${id}">${n}</div></div>`).join("") + `</div><div class="row"></div>`;
    const tdp = parseTmlDrupal(tdPage(), { year: 2013 });
    ok(JSON.stringify([tdp.date, tdp.label, tdp.axis, tdp.pxPerHour, tdp.stages, tdp.blank, tdp.sets.map(x => [x.stage, x.start, x.end, x.artist]), tdp.misprints.map(x => [x.artist, x.printed])])
      === JSON.stringify(["2013-07-27", "Saturday/ 27 July", "22:00-01:40", 60, ["Mainstage", "Super You&Me", "Radio Modern"], ["More Artists"],
        [["Mainstage", "22:00", "22:30", "Opener"], ["Mainstage", "22:30", "23:00", "Late & Co"], ["Mainstage", "23:15", "00:00", "Past Midnight"], ["Mainstage", "00:00", "01:00", "Night"], ["Radio Modern", "22:00", "01:00", "Radio Show"]],
        [["Clash One", "22:00-23:00"], ["Clash Two", "22:30-23:30"]]]),
      `a Tomorrowland day page must come back set by set past midnight, a stage with no slot apart and two sets at once misprints: ${JSON.stringify(tdp)}`);
    ok(tmlTitleDate("Friday 26 July", 2013) === "2013-07-26" && tmlTitleDate("Saturday 26 July", 2013) === null, "a Tomorrowland title must print its own weekday");
    const tdMust = (what, html, year = 2013) => { let bad = false; try { const p = parseTmlDrupal(html, { year }); bad = p.misprints.length !== 2; } catch { bad = true; } mutations++; ok(bad, `mutation not caught: ${what}`); };
    tdMust("a Tomorrowland title whose weekday is not its date", tdPage("Sunday/ 27 July"));
    tdMust("a Tomorrowland page of another year", tdPage(), 2014);
    tdMust("a Tomorrowland axis that skips an hour", tdPage(undefined, undefined, undefined, tdAxis.replace(">23:00<", ">23:30<")));
    tdMust("a Tomorrowland axis drawn at two widths", tdPage(undefined, undefined, undefined, tdAxis.replace("width:60px;\">23:00", "width:50px;\">23:00")));
    tdMust("a Tomorrowland slot drawn wider than its range", tdPage(undefined, [[tdRows[0][0], [tdSlot(45, "Opener", "22:00-22:30"), ...tdRows[0][1].slice(1)]], ...tdRows.slice(1)]));
    tdMust("a Tomorrowland gap that is not the time between two sets", tdPage(undefined, [[tdRows[0][0], tdRows[0][1].map(s => s.replace("width: 15px", "width: 30px"))], ...tdRows.slice(1)]));
    tdMust("Tomorrowland stage names in another order than the rows", tdPage(undefined, undefined, [tdNames[1], tdNames[0], ...tdNames.slice(2)]));
    tdMust("a Tomorrowland stage named twice", tdPage(undefined, undefined, [...tdNames, ["5", "Again"]]));
    tdMust("a Tomorrowland range with no time", tdPage().replace("22:30-23:00", "22:30"));
    // Tomorrowland's 2010-2012 line-up page: a tab per day ("Saturday 28
    // july", the page's own marked current), then each stage as a heading
    // followed by its acts and ranges, 24-hour, a time before 6 AM the night's.
    const tcTabs = (cur = 1, labels = ["Friday 27 july", "Saturday 28 july", "Sunday 29 july"], again = -1) => labels.map((l, i) =>
      `<li class="left tab292"><a href="/line-up/x"${i === cur || i === again ? ' class="currentactive"' : ""} title="${l}">${l.split(" ")[0]}</a></li>`).join("");
    const tcStage = n => `<h5 class="stage"><img src="i.png"><span class="title-content-coverlineup">${n}</span></h5>`;
    const tcAct = (a, r) => `<div class="left artist"><a href="/artist/x">${a}</a></div><div class="left lineup_right_wrapper"><div class="play lineup_right_time">${r.replace(" > ", "&nbsp;&gt;&nbsp;")}</div></div>`;
    const tcBody = [tcStage("Mainstage"), tcAct("MC Allday", "12:00 > 01:00"), tcAct("Opener", "21:30 > 23:00"), tcAct("Late &amp; Co", "23:00 > 00:30"), tcAct("Night", "00:30 > 01:00"),
      tcStage("Radio Modern"), tcAct("Radio Modern on Saturday!", "14:00 > 20:00"),
      tcStage("Clash Stage"), tcAct("Clash One", "20:00 > 21:00"), tcAct("Clash Two", "20:30 > 21:30"), tcAct("Repeat", "22:00 > 23:00"), tcAct("Repeat", "22:00 > 23:00"), tcAct("Back", "23:00 > 22:00")].join("");
    const tcPage = (tabs = tcTabs(), body = tcBody, title = "Tomorrowland") => `<title>${title}</title><body class="not-front page-line-up">${tabs}${body}</body>`;
    const tcp = parseTmlCms(tcPage(), { year: 2012 });
    ok(JSON.stringify([tcp.template, tcp.date, tcp.weekday, tcp.tabs, tcp.stages, tcp.blank, tcp.overlays.map(x => x.artist), tcp.stageBlocks.map(x => x.artist), tcp.repeats,
      tcp.sets.map(x => [x.stage, x.start, x.end, x.artist]), tcp.misprints.map(x => `${x.artist}: ${x.misprint}`)])
      === JSON.stringify(["2012", "2012-07-28", "saturday", ["Friday 27 july", "Saturday 28 july", "Sunday 29 july"], ["Mainstage", "Clash Stage"], ["Radio Modern"], ["MC Allday"], ["Radio Modern on Saturday!"], 1,
        [["Mainstage", "21:30", "23:00", "Opener"], ["Mainstage", "23:00", "00:30", "Late & Co"], ["Mainstage", "00:30", "01:00", "Night"], ["Clash Stage", "22:00", "23:00", "Repeat"]],
        ["Clash One: printed while another set on the stage is still on", "Clash Two: printed while another set on the stage is still on", "Back: the range runs backwards"]]),
      `a Tomorrowland 2012 line-up page must come back set by set past midnight, an all-day block, a block named as its stage, two sets at once and a backwards range never as sets: ${JSON.stringify(tcp)}`);
    const tc10Act = (a, f, t) => `<div class="left artist"><a href="/cms/en/artist/x">${a}</a></div>\n<div class="left play"><span class="date-display-single">${f}</span>&nbsp;&gt;&nbsp;<span class="date-display-single">${t}</span></div>`;
    const tc10 = tcPage(tcTabs(0, ["Saturday 24 july", "Sunday 25 july"]), tcStage("<cufon><canvas></canvas><cufontext>Kompakt</cufontext></cufon>") + tc10Act("Late", "23:30", "01:00") + tc10Act("Early", "22:00", "23:30"));
    const tcq = parseTmlCms(tc10, { year: 2010 });
    ok(JSON.stringify([tcq.template, tcq.date, tcq.stages, tcq.sets.map(x => [x.start, x.end, x.artist])]) === JSON.stringify(["2010", "2010-07-24", ["Kompakt"], [["22:00", "23:30", "Early"], ["23:30", "01:00", "Late"]]]),
      `a Tomorrowland 2010 line-up page must read two times per act and a stage name drawn in Cufón: ${JSON.stringify(tcq)}`);
    ok(parseTmlCms(tcPage(undefined, tcStage("Solo") + tcAct("MC Over", "20:00 > 23:00") + tcAct("One", "21:00 > 22:00")), { year: 2012 }).misprints.map(x => x.artist).join() === "MC Over,One",
      "a block over one set only is two sets at once, never dropped as an all-day block");
    ok(tmlCmsDate("Saturday 24 july", 2010) === "2010-07-24" && tmlCmsDate("Saturday 24 july", 2011) === null && tmlCmsDate("Saturday 31 june", 2010) === null, "a Tomorrowland tab must print its own weekday and a real date");
    const tcMust = (what, html, year = 2012) => { let bad = false; try { parseTmlCms(html, { year }); } catch { bad = true; } mutations++; ok(bad, `mutation not caught: ${what}`); };
    tcMust("a Tomorrowland 2012 page of another year", tcPage(), 2013);
    tcMust("a Tomorrowland tab whose weekday is not its date", tcPage(tcTabs(1, ["Friday 27 july", "Sunday 28 july", "Sunday 29 july"])));
    tcMust("Tomorrowland tabs that skip a day", tcPage(tcTabs(1, ["Friday 27 july", "Saturday 28 july", "Monday 30 july"])));
    tcMust("two Tomorrowland tabs marked current", tcPage(tcTabs(1, undefined, 2)));
    tcMust("no Tomorrowland tab marked current", tcPage(tcTabs(-1)));
    tcMust("a Tomorrowland range with one time", tcPage(undefined, tcBody.replace("21:30&nbsp;&gt;&nbsp;23:00", "21:30")));
    tcMust("a Tomorrowland act heading with no range", tcPage(undefined, tcBody.replace('<div class="left lineup_right_wrapper"><div class="play lineup_right_time">21:30&nbsp;&gt;&nbsp;23:00</div></div>', "")));
    tcMust("a Tomorrowland 2010 act printing one time", tc10.replace('&nbsp;&gt;&nbsp;<span class="date-display-single">01:00</span>', "&nbsp;&gt;&nbsp;01:00"), 2010);
    tcMust("a page that is not Tomorrowland's", tcPage(undefined, undefined, "Tomorrowland Fans"));
    tcMust("a Tomorrowland page that is not the line-up", tcPage().replace("page-line-up", "page-news"));
    tcMust("a Tomorrowland stage printed twice", tcPage(undefined, tcBody + tcStage("Mainstage") + tcAct("Again", "13:00 > 14:00")));
    tcMust("a Tomorrowland range past 23:59", tcPage(undefined, tcBody.replace("21:30 > 23:00".replace(" > ", "&nbsp;&gt;&nbsp;"), "24:30&nbsp;&gt;&nbsp;25:00")));
    // HARD Summer's 2012 home page: a grid per day (half-hour labels, latest
    // first), a column per stage, each set a block whose height is its length
    // and whose top margin is the gap to the block above; ranges print no am
    // or pm, and the dates are the run the page's essential info prints.
    const hwGrid = (labels = ["10:00pm", "9:30pm", "9:00pm", "8:30pm", "8:00pm"]) => labels.map(l => `<div class="grid-section">\n<span>${l}</span></div>`).join("")
      + `<!-- <div class="grid-section"><span>10:30pm</span></div> -->`;
    const hwBlock = (m, h, a, r) => `<div class="settime" style="margin-top: ${m}px; height: ${h}px;"><span class="artist-name">${a}</span><br><span class="artist-time">${r}</span></div>`;
    const hwCol = (day, name, cls, blocks) => `<!-- ${day} ${name.toUpperCase()} STAGE -->\n<div class="stage ${cls}">\n<h2 class="stage-name">${name}</h2>${blocks.join("")}</div>`;
    const hwFri = [hwCol("FRIDAY", "Main", "main", [hwBlock(0, 120, "Closer", "9:00 - 10:00"), hwBlock(0, 120, "Opener &amp; Co", "8:00 - 9:00")]),
      hwCol("FRIDAY", "Tent", "tent", [hwBlock(20, 60, "Late", "9:30 - 10:00"), hwBlock(20, 80, "Mid", "8:40 - 9:20"), hwBlock(20, 50, "Wrong Height", "8:00 - 8:30")])];
    const hwSat = [hwCol("SATURDAY", "Club", "club", [hwBlock(0, 120, "Club One", "9:00 - 10:00"), hwBlock(0, 60, "Club Three", "8:30 - 9:00"), hwBlock(20, 60, "Club Two", "8:00 - 8:30")])];
    const hwRun = "Friday, August 3rd &amp; Saturday, August 4th, 2012";
    const hwDay = (cls, h1, cols, grid = hwGrid()) => `<div class="${cls}-sets sets"><h1>${h1}</h1>${grid}${cols.join("")}</div>`;
    const hwPage = ({ title = "HARD Summer - August 3 &amp; 4", run = hwRun, fri = hwDay("friday", "FRIDAY", hwFri), sat = hwDay("saturday", "SATURDAY", hwSat) } = {}) =>
      `<title>${title}</title><p>Music is scheduled from 5:00pm both days, ${run}.</p>${fri}${sat}`;
    const hwp = parseHardWp(hwPage(), { year: 2012 });
    ok(JSON.stringify([hwp.run, hwp.days.map(d => [d.label, d.date, d.weekday, d.axis, d.pxPerMinute, d.stages, d.columnTops, d.sets.map(x => [x.stage, x.start, x.end, x.artist]), d.misprints.map(x => `${x.artist}: ${x.misprint}`)])])
      === JSON.stringify(["Friday, August 3rd & Saturday, August 4th, 2012", [
        ["FRIDAY", "2012-08-03", "friday", "20:00-22:30", 2, ["Main", "Tent"], { Main: "22:00", Tent: "22:10" },
          [["Main", "20:00", "21:00", "Opener & Co"], ["Main", "21:00", "22:00", "Closer"], ["Tent", "20:40", "21:20", "Mid"], ["Tent", "21:30", "22:00", "Late"]], ["Wrong Height: drawn 25 minutes long"]],
        ["SATURDAY", "2012-08-04", "saturday", "20:00-22:30", 2, ["Club"], { Club: "22:00" },
          [["Club", "20:30", "21:00", "Club Three"], ["Club", "21:00", "22:00", "Club One"]], ["Club Two: drawn 10 minutes earlier than its column puts it"]]]]),
      `a HARD Summer 2012 page must read each range as the one time inside its day's grid, keep a column drawn a little high, and never keep a block drawn at the wrong length or place: ${JSON.stringify(hwp)}`);
    ok(JSON.stringify(hardRun("Friday, August 3rd & Saturday, August 4th, 2012", 2012)) === JSON.stringify({ FRIDAY: "2012-08-03", SATURDAY: "2012-08-04" })
      && hardRun("Friday, August 3rd & Saturday, August 4th, 2012", 2013) === null && hardRun("Friday, August 4th & Saturday, August 5th, 2012", 2012) === null,
      "a HARD Summer run must print two consecutive days of the edition's year, each on its own weekday");
    const hwMust = (what, html, year = 2012) => { let bad = false; try { parseHardWp(html, { year }); } catch { bad = true; } mutations++; ok(bad, `mutation not caught: ${what}`); };
    hwMust("a HARD Summer 2012 page of another year", hwPage(), 2013);
    hwMust("a HARD Summer run whose weekday is not its date", hwPage({ run: "Friday, August 4th &amp; Saturday, August 5th, 2012" }));
    hwMust("a HARD Summer run of two days a week apart", hwPage({ run: "Friday, August 3rd &amp; Saturday, August 11th, 2012" }));
    hwMust("a HARD Summer page that prints no run", hwPage({ run: "see you there" }));
    hwMust("a page that is not HARD Summer's", hwPage({ title: "HARD Day of the Dead" }));
    hwMust("a HARD Summer day block headed as another day", hwPage({ fri: hwDay("friday", "SATURDAY", hwFri) }));
    hwMust("a HARD Summer day the run does not print", hwPage({ sat: hwDay("sunday", "SUNDAY", hwSat) }));
    hwMust("a HARD Summer grid that skips half an hour", hwPage({ fri: hwDay("friday", "FRIDAY", hwFri, hwGrid(["10:00pm", "9:30pm", "8:30pm", "8:00pm"])) }));
    hwMust("a HARD Summer range that is no time inside the grid", hwPage().replace("9:30 - 10:00", "11:30 - 12:00"));
    hwMust("a HARD Summer range with one time", hwPage().replace("9:30 - 10:00", "9:30"));
    hwMust("a HARD Summer block with two acts", hwPage().replace('<span class="artist-name">Late</span>', '<span class="artist-name">Late</span><span class="artist-name">Later</span>'));
    hwMust("a Saturday stage inside Friday's block", hwPage({ fri: hwDay("friday", "FRIDAY", [hwFri[0], hwFri[1].replace("FRIDAY TENT", "SATURDAY TENT")]) }));
    hwMust("a HARD Summer stage printed twice on a day", hwPage({ fri: hwDay("friday", "FRIDAY", [hwFri[0], hwFri[0]]) }));
    hwMust("a HARD Summer column whose blocks agree on no top", hwPage().replace(hwBlock(0, 60, "Club Three", "8:30 - 9:00"), hwBlock(10, 60, "Club Three", "8:30 - 9:00")));
    hwMust("a HARD Summer column drawn off its grid", hwPage({ sat: hwDay("saturday", "SATURDAY", [hwCol("SATURDAY", "Club", "club", [hwBlock(120, 120, "Club One", "9:00 - 10:00"), hwBlock(0, 60, "Club Three", "8:30 - 9:00")])]) }));
    // Lollapalooza's 2018 lineup page: one card per act, each set its day
    // ("Sat 8/04"), start and stage, no end; a card shows at most two sets and
    // links to the act's page for more.
    const lcSet = (day, time, stage) => `<div class="layout__item c-lineup__details-session">\n<p class="c-lineup__details-session-times">\n${day}\n${time}    <br>\n<span>${stage}</span>\n</p>\n</div>`;
    const lcCard = (id, name, titles, sets, { more = false, year = 2018, title = name } = {}) =>
      `<div class="c-lineup__artist " data-weekends="[0,1,2]" data-id="${id}" data-title="${title}" data-position="0" data-sort-name="${name}" data-days="[1]" data-day-titles="${JSON.stringify(titles).replace(/"/g, "&quot;").replace(/\//g, "\\/")}" data-hashes="[]">`
      + `<p class="c-lineup__caption-text js-view-details js-lineup__caption-text ">\n ${name}   </p>`
      + `<h3 class="c-lineup__details-category-title">${year} Schedule:</h3>${sets.join("")}`
      + (more ? `<a class="text--light-gray" href="https://www.lollapalooza.com/artist/x/">View more set times</a>` : "") + `</div>`;
    const lcCards = [lcCard(1, "Headliner &amp; Co", ["Saturday, 8/4"], [lcSet("Sat 8/04", "8:30pm", "Grant Park")]),
      lcCard(2, "Kid Act", ["Thursday, 8/2", "Saturday, 8/4", "Sunday, 8/5"], [lcSet("Thu 8/02", "1:30pm", "Kidz"), lcSet("Sat 8/04", "1:30pm", "Kidz")], { more: true }),
      lcCard(3, "Opener", ["Thursday, 8/2"], [lcSet("Thu 8/02", "12:00pm", "Perry’s"), lcSet("Thu 8/02", "12:00pm", "Perry’s")])];
    const lcPage = (cards = lcCards, desc = "Join us in Chicago August 2-5, 2018.") => `<meta name="description" content="${desc}">${cards.join("")}`;
    const lcp = parseLollaLineup(lcPage(), { year: 2018 });
    ok(JSON.stringify([lcp.cards, lcp.days.map(d => [d.date, d.label, d.stages, d.duplicates, d.sets.map(x => [x.stage, x.start, x.end, x.artist])]), lcp.hidden])
      === JSON.stringify([3, [["2018-08-02", "Thu 8/02", ["Kidz", "Perry’s"], 1, [["Kidz", "13:30", "", "Kid Act"], ["Perry’s", "12:00", "", "Opener"]]],
        ["2018-08-04", "Sat 8/04", ["Grant Park", "Kidz"], 0, [["Grant Park", "20:30", "", "Headliner & Co"], ["Kidz", "13:30", "", "Kid Act"]]]],
        [{ date: "2018-08-05", artist: "Kid Act", title: "Sunday, 8/5" }]]),
      `a Lollapalooza 2018 lineup page must read each card's sets as printed, with no end, count a set printed twice once, and keep a day only the card's day titles list out of the sets: ${JSON.stringify(lcp)}`);
    ok(lollaCardDate("Sat 8/04", 2018) === "2018-08-04" && lollaCardDate("Saturday, 8/4", 2018) === "2018-08-04" && lollaCardDate("Sat 8/04", 2019) === null
      && lollaCardDate("Sun 8/04", 2018) === null && lollaCardDate("Sat 8/32", 2018) === null, "a Lollapalooza card day must print its own weekday and a real date");
    const lcMust = (what, html, year = 2018) => { let bad = false; try { parseLollaLineup(html, { year }); } catch { bad = true; } mutations++; ok(bad, `mutation not caught: ${what}`); };
    lcMust("a Lollapalooza 2018 page of another year", lcPage(), 2019);
    lcMust("a Lollapalooza page whose description names another year", lcPage(lcCards, "Join us in Chicago August 1-4, 2019."));
    lcMust("a Lollapalooza card scheduled for another year", lcPage([lcCard(1, "A", ["Saturday, 8/4"], [lcSet("Sat 8/04", "8:30pm", "Grant Park")], { year: 2017 })]));
    lcMust("a Lollapalooza card with no set", lcPage([lcCard(1, "A", ["Saturday, 8/4"], [])]));
    lcMust("a Lollapalooza set on a day its card does not list", lcPage([lcCard(1, "A", ["Saturday, 8/4"], [lcSet("Sun 8/05", "8:30pm", "Grant Park")])]));
    lcMust("a Lollapalooza card day no set prints, with no link to more", lcPage([lcCard(1, "A", ["Saturday, 8/4", "Sunday, 8/5"], [lcSet("Sat 8/04", "8:30pm", "Grant Park")])]));
    lcMust("a Lollapalooza set whose weekday is not its date", lcPage([lcCard(1, "A", ["Saturday, 8/4"], [lcSet("Sun 8/04", "8:30pm", "Grant Park")])]));
    lcMust("a Lollapalooza set with no am or pm", lcPage([lcCard(1, "A", ["Saturday, 8/4"], [lcSet("Sat 8/04", "8:30", "Grant Park")])]));
    lcMust("a Lollapalooza set with no stage", lcPage([lcCard(1, "A", ["Saturday, 8/4"], [lcSet("Sat 8/04", "8:30pm", "")])]));
    lcMust("a Lollapalooza card captioned as another act", lcPage([lcCard(1, "A", ["Saturday, 8/4"], [lcSet("Sat 8/04", "8:30pm", "Grant Park")], { title: "B" })]));
    lcMust("a Lollapalooza card printed twice", lcPage([lcCards[0], lcCards[0]]));
    lcMust("a page with no Lollapalooza cards", lcPage([]));
    // Governors Ball's 2011-2012 WordPress schedule: a grid per day, a column
    // per stage, every range with its own am or pm.
    const gbBlock = (pre, cls, name, range, head = "") => `<div class="${pre}-block ${cls}">${head}<h2>${name}</h2><h3>${range}</h3></div>`;
    const gbAxis = `<div class="time-column"><h3>12:00 PM</h3><h3>1:00 PM</h3><h3>2:00 PM</h3><h3>3:00 PM</h3></div>`;
    const gbDay = (heading, cols) => `<div class="schedule-header">${heading ? `<div class="stage-heading">${heading}</div>` : ""}${cols.map(([st]) => `<h2>${st}</h2>`).join("")}</div>`
      + gbAxis + cols.map(([, pre, blocks]) => `<div class="${pre}-column">${blocks.join("")}</div>`).join("");
    const gbD1 = [["HYPE MACHINE<br>STAGE", "hypem", [gbBlock("hypem", "a", "Opener", "12:15 pm - 12:45 pm"), gbBlock("hypem", "b", "Closer", "2:30 pm - 3:30 pm", `<h3 class="headline">Headline Set By</h3>`)]],
      ["HONDA STAGE", "honda", [gbBlock("honda", "c", "Early &amp; Act", "11:45 am - 12:10 pm"), gbBlock("honda", "d", "Backwards", "11:45 pm - 12:10 pm"), gbBlock("honda", "e", "Last", "1:00 pm - ???")]]];
    const gbD2 = [["HYPE MACHINE<br>STAGE", "hypem", [gbBlock("hypem", "f", "Day Two", "1:00 pm - 1:40 pm")]], ["HONDA STAGE", "honda", [gbBlock("honda", "g", "Two Honda", "2:00 pm - 2:30 pm")]]];
    const gbDesc = `<meta name="description" content="The Governors Ball returns to Randall&#039;s Island in 2012" />`;
    const gbPage = (d1 = gbD1, d2 = gbD2, desc = gbDesc) => desc + `<div id="schedule">` + gbDay("SATURDAY 6/23", d1) + gbDay("SUNDAY 6/24", d2) + `<!-- END main-content -->`;
    const gbp = parseGovBallWp(gbPage(), { year: 2012 });
    ok(JSON.stringify(gbp.days.map(d => [d.date, d.label, d.dateFrom, d.stages, d.axis, d.sets.map(x => [x.stage, x.start, x.end, x.artist, !!x.openEnd]), d.misprints.map(x => [x.artist, x.printed])]))
      === JSON.stringify([["2012-06-23", "SATURDAY 6/23", "the day's heading", ["HYPE MACHINE STAGE", "HONDA STAGE"], "12:00-15:00",
        [["HYPE MACHINE STAGE", "12:15", "12:45", "Opener", false], ["HYPE MACHINE STAGE", "14:30", "15:30", "Closer", false], ["HONDA STAGE", "11:45", "12:10", "Early & Act", false], ["HONDA STAGE", "13:00", "", "Last", true]],
        [["Backwards", "11:45 pm - 12:10 pm"]]],
        ["2012-06-24", "SUNDAY 6/24", "the day's heading", ["HYPE MACHINE STAGE", "HONDA STAGE"], "12:00-15:00", [["HYPE MACHINE STAGE", "13:00", "13:40", "Day Two", false], ["HONDA STAGE", "14:00", "14:30", "Two Honda", false]], []]]),
      `a Governors Ball schedule must come back set by set, a "???" end open and a backwards range a misprint: ${JSON.stringify(gbp)}`);
    const gbOne = `<meta name="description" content="A one-day, two-stage festival on Randall&#039;s Island on Saturday, June 18th, 2011" />` + `<div id="schedule">` + gbDay("", gbD2) + `<!-- END main-content -->`;
    ok(parseGovBallWp(gbOne, { year: 2011 }).days.map(d => [d.date, d.dateFrom]).join() === "2011-06-18,the page's description", "a one-day Governors Ball page must be dated by its own description");
    ok(govBallDate("SATURDAY 6/23", 2012) === "2012-06-23" && govBallDate("SUNDAY 6/23", 2012) === null && govBallDate("Saturday, June 18th, 2011", 2011) === "2011-06-18" && govBallDate("Saturday, June 18th, 2011", 2012) === null, "a Governors Ball day label must print its own weekday and year");
    const gbMust = (what, html, year = 2012) => { let bad = false; try { parseGovBallWp(html, { year }); } catch { bad = true; } mutations++; ok(bad, `mutation not caught: ${what}`); };
    gbMust("a Governors Ball page of another year", gbPage(), 2013);
    gbMust("a Governors Ball heading whose weekday is not its date", gbPage().replace("SATURDAY 6/23", "FRIDAY 6/23"));
    gbMust("a Governors Ball page skipping a day", gbPage().replace("SUNDAY 6/24", "MONDAY 6/25"));
    gbMust("a Governors Ball one-day page with two grids and no headings", gbOne.replace("<!-- END", gbDay("", gbD2) + "<!-- END"), 2011);
    gbMust("a Governors Ball page with no heading that is not one day", gbOne.replace("A one-day, two-stage festival", "A festival"), 2011);
    gbMust("a Governors Ball range with no meridiem", gbPage().replace("1:00 pm - 1:40 pm", "1:00 - 1:40 pm"));
    gbMust("a Governors Ball hour axis that skips an hour", gbPage().replace("<h3>2:00 PM</h3>", "<h3>2:30 PM</h3>"));
    gbMust("a Governors Ball day with more stage headers than columns", gbPage().replace("<h2>HONDA STAGE</h2>", "<h2>HONDA STAGE</h2><h2>THIRD STAGE</h2>"));
    gbMust("a Governors Ball open end before a column's last block", gbPage(undefined, [[gbD2[0][0], "hypem", [gbBlock("hypem", "f", "Day Two", "1:00 pm - ???"), gbBlock("hypem", "h", "After", "2:00 pm - 2:30 pm")]], gbD2[1]]));
    gbMust("two Governors Ball sets overlapping on one stage", gbPage(undefined, [[gbD2[0][0], "hypem", [gbBlock("hypem", "f", "Day Two", "1:00 pm - 1:40 pm"), gbBlock("hypem", "h", "Clash", "1:30 pm - 2:00 pm")]], gbD2[1]]));
    gbMust("a Governors Ball block in another stage's column", gbPage().replace('class="honda-block g"', 'class="hypem-block g"'));
    gbMust("a Governors Ball block with two names", gbPage().replace("<h2>Two Honda</h2>", "<h2>Two</h2><h2>Honda</h2>"));
    // Primavera Sound's 2015 Fòrum timetable: one page a day, day tabs with no
    // year in Catalan, Spanish or English, a 15-minute grid with a cell per
    // stage, each block on its row plus its offset and two pixels a minute.
    const psBox = (add, h, name, hora) => `<div class="concertContainer"><div class="concertBox KKaddMinutes-${add}" style="height:${h}px;top:0px;"><a href="/artistas?id=1"><div class="artista">${name}</div><div class="hora ">${hora}</div></a></div></div>`;
    const psTabs = (own = 1, labels = ["dimecres 27 de maig", "jueves 28 de mayo", "Friday May 29", "dissabte 30 de maig"]) => `<div id="title_dias" class="font01 group">`
      + labels.map((l, i) => i === own ? `<span class="rojo">${l}</span>` : `<span class=""><a href="/horarios?d=${i + 1}">${l}</a> </span>`).join("") + `</div>`;
    const psRow = (t, cells) => `<tr><td class="horaleft">${t}</td>${cells.map(c => `<td>${c}</td>`).join("")}<td class="horaright"><span>${t}</span></td></tr>`;
    const psRows = [psRow("23:30", [psBox(5, 60, "Early &amp; Late", "(23:35 - 00:05)"), ""]), psRow("23:45", ["", psBox(0, 120, "Over Midnight", "(23:45 - 00:45)")]),
      psRow("0:00", ["", ""]), psRow("0:15", [psBox(0, 0, "No End", "(00:15)"), ""])];
    const psPage = ({ tabs = psTabs(), heading = "Horarios Parc del Fòrum", stages = ["Ray-Ban", "H&amp;M PRO"], foot = stages, rows = psRows, picker = "forum" } = {}) =>
      `<h1 class="font01">${heading}</h1>${tabs}<select name="l" id="horarios-escenarios-select"><option value="ciutat">ciutat</option><option value="${picker}" selected="selected">${picker}</option></select>`
      + `<table id="listaHorarios"><thead><tr><th></th>${stages.map(x => `<th class="escenario">${x}</th>`).join("")}<th></th></tr></thead><tbody>${rows.join("")}`
      + `<tr id="footer-header"><td></td>${foot.map(x => `<td class="escenario">${x}</td>`).join("")}<td></td></tr></tbody></table>`;
    const psp = parsePrimaveraHorarios(psPage(), { year: 2015 });
    ok(JSON.stringify([psp.date, psp.label, psp.tabDates, psp.stages, psp.axis, psp.sets.map(x => [x.stage, x.start, x.end, x.artist, !!x.openEnd])])
      === JSON.stringify(["2015-05-28", "jueves 28 de mayo", ["2015-05-27", "2015-05-28", "2015-05-29", "2015-05-30"], ["Ray-Ban", "H&M PRO"], "23:30-00:15",
        [["Ray-Ban", "23:35", "00:05", "Early & Late", false], ["H&M PRO", "23:45", "00:45", "Over Midnight", false], ["Ray-Ban", "00:15", "", "No End", true]]]),
      `a Primavera Sound timetable must come back set by set, past midnight and a start-only block open: ${JSON.stringify(psp)}`);
    ok(primaveraDate("dimecres 27 de maig", 2015) === "2015-05-27" && primaveraDate("miércoles 27 de mayo", 2015) === "2015-05-27" && primaveraDate("Wednesday May 27", 2015) === "2015-05-27"
      && primaveraDate("dimecres 27 de maig", 2016) === null && primaveraDate("dijous 27 de maig", 2015) === null && primaveraDate("miércoles 27 de maig", 2015) === null,
      "a Primavera Sound day tab must print its own weekday in the edition's year, in one language");
    const psMust = (what, html, year = 2015) => { let bad = false; try { parsePrimaveraHorarios(html, { year }); } catch { bad = true; } mutations++; ok(bad, `mutation not caught: ${what}`); };
    psMust("a Primavera Sound timetable of another year", psPage(), 2016);
    psMust("a Primavera Sound page that is not Parc del Fòrum's", psPage({ heading: "Horarios Ciutat" }));
    psMust("a Primavera Sound page with the city picked", psPage({ picker: "ciutat" }));
    psMust("a Primavera Sound page with no day of its own", psPage({ tabs: psTabs(-1) }));
    psMust("a Primavera Sound page with two days of its own", psPage({ tabs: psTabs(1).replace('<span class=""><a href="/horarios?d=3">Friday May 29</a> </span>', '<span class="rojo">Friday May 29</span>') }));
    psMust("Primavera Sound tabs that skip a day", psPage({ tabs: psTabs(1, ["dimecres 27 de maig", "jueves 28 de mayo", "Saturday May 30"]) }));
    psMust("a Primavera Sound block off its row's time", psPage({ rows: [psRow("23:30", [psBox(0, 60, "Early &amp; Late", "(23:35 - 00:05)"), ""]), ...psRows.slice(1)] }));
    psMust("a Primavera Sound block offset a whole row", psPage({ rows: [psRow("23:30", [psBox(15, 60, "Early &amp; Late", "(23:45 - 00:15)"), ""]), ...psRows.slice(1)] }));
    psMust("a Primavera Sound block not drawn two pixels a minute", psPage({ rows: [psRow("23:30", [psBox(5, 61, "Early &amp; Late", "(23:35 - 00:05)"), ""]), ...psRows.slice(1)] }));
    psMust("a Primavera Sound row skipping 15 minutes", psPage({ rows: [psRows[0], psRow("0:00", ["", ""]), ...psRows.slice(3)] }));
    psMust("a Primavera Sound row closing on another time", psPage({ rows: [psRows[0].replace("<span>23:30</span>", "<span>23:45</span>"), ...psRows.slice(1)] }));
    psMust("a Primavera Sound footer naming other stages", psPage({ foot: ["Ray-Ban", "Pitchfork"] }));
    psMust("a Primavera Sound row with a cell missing", psPage({ rows: [psRow("23:30", [psBox(5, 60, "Early &amp; Late", "(23:35 - 00:05)")]), ...psRows.slice(1)] }));
    psMust("two Primavera Sound sets overlapping on one stage", psPage({ rows: [...psRows.slice(0, 2), psRow("0:00", [psBox(0, 30, "Clash", "(00:00 - 00:15)"), ""]), psRows[3]] }));
    psMust("a Primavera Sound block with no name", psPage({ rows: [psRow("23:30", [psBox(5, 60, "", "(23:35 - 00:05)"), ""]), ...psRows.slice(1)] }));
    // The 2012 template (2012 and 2013): stage headers with a width, no
    // footer, each block a start alone inside its row's 15 minutes, and an
    // empty slot with no artist id counted apart, never read as a set.
    const ps12Box = (name, hora, inner = true, id = "1") => `<div class="concertBoxSinCaja" style="height:-44702280px;">${inner ? '<div class="concertBox2" style="width:197px;height:-44702280px;">' : ""}`
      + `<a href="/artistaSingle?idArtista=${id}" class="artistaAnchor"><div class="artista">${name}</div><div class="hora horaInLine"> ${hora} </div></a>${inner ? "</div>" : ""}</div>`;
    const ps12Rows = [psRow("23:30", [ps12Box("Early &amp; Late", "(23:40)"), ""]), psRow("23:45", ["", ps12Box("Over Midnight", "(23:45)", false)]),
      psRow("0:00", [ps12Box("", "(00:05)", true, ""), ""]), psRow("0:15", [ps12Box("After", "(00:20)"), ""])];
    const ps12Page = ({ rows = ps12Rows, foot = "" } = {}) => `<h1 class="font01">Horarios Parc del Fòrum</h1>${psTabs(1, ["jueves 31 de mayo", "viernes 01 de junio", "sábado 02 de junio"])}`
      + `<table id="listaHorarios"><thead><tr><th></th><th class="escenario" width="200">Ray-Ban</th><th class="escenario" width="200">H&amp;M PRO</th><th></th></tr></thead><tbody>${rows.join("")}${foot}</tbody></table>`;
    const ps12 = parsePrimaveraHorarios(ps12Page(), { year: 2012 });
    ok(JSON.stringify([ps12.template, ps12.date, ps12.label, ps12.axis, ps12.sets.map(x => [x.stage, x.start, x.end, x.artist, !!x.openEnd]), ps12.blanks])
      === JSON.stringify(["2012", "2012-06-01", "viernes 01 de junio", "23:30-00:15", [["Ray-Ban", "23:40", "", "Early & Late", true], ["H&M PRO", "23:45", "", "Over Midnight", true], ["Ray-Ban", "00:20", "", "After", true]],
        [{ stage: "Ray-Ban", printed: "(00:05)" }]]),
      `a 2012 Primavera Sound timetable must come back start by start, open-ended, its empty slot apart: ${JSON.stringify(ps12)}`);
    psMust("a 2012 Primavera Sound page read in another year", ps12Page(), 2013);
    psMust("a 2012 Primavera Sound block printing a range", ps12Page({ rows: [psRow("23:30", [ps12Box("Early &amp; Late", "(23:40 - 00:10)"), ""]), ...ps12Rows.slice(1)] }), 2012);
    psMust("a 2012 Primavera Sound block past its row's 15 minutes", ps12Page({ rows: [psRow("23:30", [ps12Box("Early &amp; Late", "(23:50)"), ""]), ...ps12Rows.slice(1)] }), 2012);
    psMust("a 2012 Primavera Sound page with a footer", ps12Page({ foot: '<tr id="footer-header"><td></td><td class="escenario">Ray-Ban</td><td class="escenario">H&amp;M PRO</td><td></td></tr>' }), 2012);
    psMust("a Primavera Sound page mixing both templates", ps12Page({ rows: [psRow("23:30", [ps12Box("Early &amp; Late", "(23:40)"), psBox(5, 60, "New", "(23:35 - 00:05)")]), ...ps12Rows.slice(1)] }), 2012);
    psMust("two 2012 Primavera Sound sets starting together on one stage", ps12Page({ rows: [psRow("23:30", [ps12Box("Early &amp; Late", "(23:40)") + ps12Box("Twin", "(23:40)"), ""]), ...ps12Rows.slice(1)] }), 2012);
    psMust("a 2012 Primavera Sound block with an artist id and no name", ps12Page({ rows: [psRow("23:30", [ps12Box("", "(23:40)", true, "7"), ""]), ...ps12Rows.slice(1)] }), 2012);
    psMust("a 2012 Primavera Sound inner box with no block", ps12Page({ rows: [psRow("23:30", [ps12Box("Early &amp; Late", "(23:40)") + '<div class="concertBox2" style="width:197px;height:-1px;"></div>', ""]), ...ps12Rows.slice(1)] }), 2012);
    // Primavera Sound's 2016 full timetable: Parc del Fòrum's columns beside
    // the city's, tabs that print a weekday and a day of the month only, each
    // block in its own venue's colour, on its row plus its offset and two
    // pixels a minute. Only the Fòrum's blocks are sets.
    ok(JSON.stringify(primaveraRun(["LUNES 30", "MARTES 31", "MIÉRCOLES 1"], 2016)) === JSON.stringify(["2016-05-30", "2016-05-31", "2016-06-01"])
      && primaveraRun(["LUNES 30", "MARTES 31", "MIÉRCOLES 1"], 2017) === null && primaveraRun(["JUEVES 1"], 2016) === null
      && primaveraRun(["LUNES 30", "DIMARTS 31", "MIÉRCOLES 1"], 2016) === null && JSON.stringify(primaveraRun(["Monday 30", "Tuesday 31"], 2016)) === JSON.stringify(["2016-05-30", "2016-05-31"])
      && JSON.stringify(primaveraRun(["MIÉ-03", "JUE-04", "LUN-08"], 2017)) === JSON.stringify(["2017-05-03", "2017-05-04", "2017-05-08"])
      && primaveraRun(["MIÉ-03", "JUE-04", "LUN-15"], 2017) === null && primaveraRun(["MIÉ-03", "MIÉRCOLES 4"], 2017) === null
      && JSON.stringify(primaveraRun(["2019-05-29", "2019-05-30"], 2019)) === JSON.stringify(["2019-05-29", "2019-05-30"])
      && primaveraRun(["2019-05-29", "2019-05-30"], 2018) === null && primaveraRun(["2019-05-30", "2019-05-29"], 2019) === null
      && primaveraRun(["2019-05-20", "2019-05-29"], 2019) === null && primaveraRun(["2019-02-30"], 2019) === null && primaveraRun(["2019-05-29", "JUEVES 30"], 2019) === null,
      "a row of Primavera Sound 2016-2019 tabs must name exactly one run of days in the year, a week apart at most, in one language");
    const pcBox = (venue, add, h, name, hora) => `<div class="concertContainer"><div class="concertBox${venue} KKaddMinutes-${add}" style="height:${h}px;top:0px;"><a href="/2016_artists?id=1" class="artistaAnchor" style="text-align:center;"><div class="hora ">${hora}</div><div class="2016_artists"> ${name}</div></a></div></div>`;
    const pcLabels = ["LUNES 30", "MARTES 31", "MIÉRCOLES 1", "JUEVES 2"];
    const pcTabs = (own = 3, labels = pcLabels) => `<div id="title_dias" class="font01 group">`
      + labels.map((l, i) => i === own ? `<span class="rojo">${l}</span>` : `<span class=""><a href="/horarios?d=${i + 1}&amp;l=forum&amp;content=">${l}</a> </span>`).join("") + `</div>`;
    const pcRows = [psRow("23:30", [pcBox("forum", 5, 60, "EARLY &amp; LATE", "(23:35 - 00:05)"), "", pcBox("ciutat", 0, 30, "CITY ACT", "(23:30 - 23:45)")]),
      psRow("23:45", ["", pcBox("forum", 0, 120, "OVER MIDNIGHT", "(23:45 - 00:45)"), ""]), psRow("0:00", ["", "", ""]), psRow("0:15", [pcBox("forum", 0, 95, "NO END", "(00:15)"), "", ""])];
    const pcCols = [["forum", "Ray-Ban"], ["forum", "H&amp;M"], ["ciutat", "DayPro"]];
    const pcPage = ({ tabs = pcTabs(), heading = "Horarios", active = "Horarios completos", groups = [["forum", "PARC DEL FÒRUM"], ["forum", ""], ["ciutat", "Primavera a la Ciutat"]], cols = pcCols, foot = cols, rows = pcRows } = {}) =>
      `<h1 class="font01">${heading}</h1><ul><li class="horarios-location active"><a href="/horarios?">${active}</a></li><li class="horarios-location "><a href="/horarios?content=forum">PARC DEL FÒRUM</a></li></ul>${tabs}`
      + `<table id="listaHorarios"><thead><tr><th style="width:35px;" class="TituloEscenarioforum"></th>${groups.map(([v, t]) => `<th class="TituloEscenario${v}">${t ? `<h3>${t}</h3>` : ""}</th>`).join("")}</tr></thead>`
      + `<thead><tr><th></th>${cols.map(([v, x]) => `<th class="escenario${v}">${x}</th>`).join("")}<th></th></tr></thead><tbody>${rows.join("")}`
      + `<tr id="footer-header"><td></td>${foot.map(([v, x]) => `<td class="escenario${v}">${x}</td>`).join("")}<td></td></tr></tbody></table>`;
    const pcp = parsePrimaveraCompletos(pcPage(), { year: 2016 });
    ok(JSON.stringify([pcp.date, pcp.label, pcp.tabDates, pcp.stages, pcp.cityStages, pcp.citySets, pcp.axis, pcp.sets.map(x => [x.stage, x.start, x.end, x.artist, !!x.openEnd])])
      === JSON.stringify(["2016-06-02", "JUEVES 2", ["2016-05-30", "2016-05-31", "2016-06-01", "2016-06-02"], ["Ray-Ban", "H&M"], ["DayPro"], 1, "23:30-00:15",
        [["Ray-Ban", "23:35", "00:05", "EARLY & LATE", false], ["H&M", "23:45", "00:45", "OVER MIDNIGHT", false], ["Ray-Ban", "00:15", "", "NO END", true]]]),
      `a Primavera Sound 2016 timetable must come back as Parc del Fòrum's sets only, past midnight and a start-only block open: ${JSON.stringify(pcp)}`);
    const pcMust = (what, html, year = 2016) => { let bad = false; try { parsePrimaveraCompletos(html, { year }); } catch { bad = true; } mutations++; ok(bad, `mutation not caught: ${what}`); };
    pcMust("a Primavera Sound 2016 timetable of another year", pcPage(), 2017);
    pcMust("a Primavera Sound 2016 page under another heading", pcPage({ heading: "Artistas" }));
    pcMust("a Primavera Sound 2016 page showing one venue only", pcPage({ active: "PARC DEL FÒRUM" }));
    pcMust("a Primavera Sound 2016 page with no day of its own", pcPage({ tabs: pcTabs(-1) }));
    pcMust("Primavera Sound 2016 tabs out of order", pcPage({ tabs: pcTabs(2, ["LUNES 30", "MARTES 31", "JUEVES 2", "MIÉRCOLES 1"]) }));
    pcMust("Primavera Sound 2016 tabs in two languages", pcPage({ tabs: pcTabs(3, ["LUNES 30", "DIMARTS 31", "MIÉRCOLES 1", "JUEVES 2"]) }));
    pcMust("a Primavera Sound 2016 Fòrum column headed as the city", pcPage({ groups: [["forum", "Primavera a la Ciutat"], ["forum", ""], ["ciutat", "Primavera a la Ciutat"]] }));
    pcMust("Primavera Sound 2016 city stages with no city heading", pcPage({ groups: [["forum", "PARC DEL FÒRUM"], ["forum", ""], ["ciutat", ""]] }));
    pcMust("a Primavera Sound 2016 page with no Fòrum stage", pcPage({ cols: pcCols.map(([, x]) => ["ciutat", x]), rows: [psRow("23:30", ["", "", ""]), psRow("23:45", ["", "", ""])] }));
    pcMust("a Primavera Sound 2016 name linked to another year's artist page", pcPage().replace('<a href="/2016_artists?id=1" class="artistaAnchor" style="text-align:center;"><div class="hora ">(23:35', '<a href="/2015_artists?id=1" class="artistaAnchor" style="text-align:center;"><div class="hora ">(23:35'));
    pcMust("a Primavera Sound 2016 block linking to no artist's page", pcPage().replace('<a href="/2016_artists?id=1" class="artistaAnchor" style="text-align:center;"><div class="hora ">(23:35', '<a href="/horarios?d=1" class="artistaAnchor" style="text-align:center;"><div class="hora ">(23:35'));
    // 2019 prints whole dates on its tabs, "Set times" over the page and the
    // Fòrum's heading in mixed case, and keeps 2017's name class: the link
    // carries the year.
    const pc19 = pcPage({ tabs: pcTabs(1, ["2019-05-29", "2019-05-30", "2019-05-31"]), heading: "Set times", active: "All set times", groups: [["forum", "Parc del Fòrum"], ["forum", ""], ["ciutat", "Primavera a la Ciutat"]] })
      .replaceAll("2016_artists?id=", "2019_artists?id=").replaceAll('class="2016_artists"', 'class="artists_2017"');
    const pcp19 = parsePrimaveraCompletos(pc19, { year: 2019 });
    ok(pcp19.date === "2019-05-30" && pcp19.label === "2019-05-30" && pcp19.sets.length === 3 && pcp19.citySets === 1,
      `a Primavera Sound 2019 timetable must read like 2016's, its tabs whole dates: ${JSON.stringify(pcp19)}`);
    pcMust("a Primavera Sound 2019 page read as 2017's", pc19, 2017);
    ok(parsePrimaveraCompletos(pcPage({ rows: [psRow("23:30", [pcBox("forum", 5, 60, "EARLY &amp; LATE", "(23:35 - 00:05)"), "", pcBox("ciutat", 0, 60, "CITY ACT", "(23:30 - 00:00)")]), psRow("23:45", ["", pcBox("forum", 0, 120, "OVER MIDNIGHT", "(23:45 - 00:45)"), pcBox("ciutat", 0, 30, "CITY TALK", "(23:45 - 00:00)")]), ...pcRows.slice(2)] }), { year: 2016 }).citySets === 2,
      "two Primavera Sound city sessions at once must be read (the city is never this edition's sets)");
    pcMust("a Primavera Sound 2019 page with another year's dates on its tabs", pc19.replace(">2019-05-31<", ">2018-05-31<"), 2019);
    pcMust("a Primavera Sound 2016 city block in a Fòrum column", pcPage({ rows: [psRow("23:30", [pcBox("ciutat", 5, 60, "EARLY &amp; LATE", "(23:35 - 00:05)"), "", ""]), ...pcRows.slice(1)] }));
    pcMust("a Primavera Sound 2016 block off its row's time", pcPage({ rows: [psRow("23:30", [pcBox("forum", 0, 60, "EARLY &amp; LATE", "(23:35 - 00:05)"), "", ""]), ...pcRows.slice(1)] }));
    pcMust("a Primavera Sound 2016 block not drawn two pixels a minute", pcPage({ rows: [psRow("23:30", [pcBox("forum", 5, 61, "EARLY &amp; LATE", "(23:35 - 00:05)"), "", ""]), ...pcRows.slice(1)] }));
    pcMust("a Primavera Sound 2016 city block not drawn two pixels a minute", pcPage({ rows: [psRow("23:30", [pcBox("forum", 5, 60, "EARLY &amp; LATE", "(23:35 - 00:05)"), "", pcBox("ciutat", 0, 31, "CITY ACT", "(23:30 - 23:45)")]), ...pcRows.slice(1)] }));
    pcMust("a Primavera Sound 2016 row skipping 15 minutes", pcPage({ rows: [pcRows[0], psRow("0:00", ["", "", ""]), pcRows[3]] }));
    pcMust("a Primavera Sound 2016 footer naming other stages", pcPage({ foot: [pcCols[0], pcCols[1], ["ciutat", "Sala Apolo"]] }));
    pcMust("a Primavera Sound 2016 footer moving a stage to the other venue", pcPage({ foot: [pcCols[0], pcCols[1], ["forum", "DayPro"]] }));
    pcMust("a Primavera Sound 2016 row with a cell missing", pcPage({ rows: [psRow("23:30", [pcBox("forum", 5, 60, "EARLY &amp; LATE", "(23:35 - 00:05)"), ""]), ...pcRows.slice(1)] }));
    pcMust("two Primavera Sound 2016 sets overlapping on one stage", pcPage({ rows: [...pcRows.slice(0, 2), psRow("0:00", [pcBox("forum", 0, 30, "CLASH", "(00:00 - 00:15)"), "", ""]), pcRows[3]] }));
    pcMust("a Primavera Sound 2016 block with no name", pcPage({ rows: [psRow("23:30", [pcBox("forum", 5, 60, "", "(23:35 - 00:05)"), "", ""]), ...pcRows.slice(1)] }));
    // Sónar's timetable: one dated calendar per session, its stages as
    // columns and its events as JSON; a night runs past midnight and stays
    // that night's.
    const snEsc = x => JSON.stringify(x).replace(/&/g, "&amp;").replace(/"/g, "&quot;");
    const snEv = (title, start, end, column, tz = "dia", extra = {}) => ({ title, start, end, allDay: false, timezone: tz, column, link_artist: "", ...extra });
    const snCal = ({ date = "20160616", tz = "dia", init = 13, end = 22, cols = [{ id: 1, name: "SonarVillage" }, { id: 2, name: "Stage+D" }], events, id = `calendar_${date}_${tz}`, dataDate = date }) =>
      `<div id="${id}" class="calendar_mod" data-events="${snEsc(events)}" data-columns="${snEsc(cols)}" data-date="${dataDate}" data-init-hour="${init}" data-end-hour="${end}" data-timezone="${tz}">`;
    const snDay = [snEv("Day Act", "13:00", "14:00", 1), snEv("Next &amp; Co", "14:00", "15:30", 1), snEv("A Talk", "11:00", "12:00", 2)];
    const snNight = [snEv("Night Act", "23:30", "01:00", 1, "nit"), snEv("Closer", "05:00", "07:00", 1, "nit")];
    const snPage = ({ title = "Schedule - Sónar Barcelona 2016", h1 = "Thursday 16 | Sónar by Day ", h2 = "Thursday 16 | Sónar by Night", day = {}, night = {} } = {}) =>
      `<title>${title}</title><h1 class="no-text">Sonar Sónar Barcelona 2016</h1><h3>${h1}</h3>${snCal({ events: snDay, ...day })}<h3>${h2}</h3>${snCal({ tz: "nit", init: 20, end: 7, cols: [{ id: 1, name: "SonarClub" }], events: snNight, ...night })}`;
    const snp = parseSonarSchedule(snPage(), { year: 2016, programme: ["Stage+D"] });
    ok(JSON.stringify([snp.days.map(d => [d.date, d.label]), snp.stages, snp.sessions.map(x => x.hours), snp.days[0].sets.map(x => [x.session, x.stage, x.start, x.end, x.artist, !!x.programme])])
      === JSON.stringify([[["2016-06-16", "Thursday 16 | Sónar by Day · Thursday 16 | Sónar by Night"]], ["SonarVillage", "Stage+D", "SonarClub"], ["13:00 to 22:00", "20:00 to 07:00"],
        [["dia", "SonarVillage", "13:00", "14:00", "Day Act", false], ["dia", "SonarVillage", "14:00", "15:30", "Next & Co", false], ["dia", "Stage+D", "11:00", "12:00", "A Talk", true],
          ["nit", "SonarClub", "23:30", "01:00", "Night Act", false], ["nit", "SonarClub", "05:00", "07:00", "Closer", false]]]),
      `a Sónar timetable must come back as one day of both sessions, a night set after midnight that night's and Sónar+D's entries marked programme: ${JSON.stringify(snp)}`);
    const snMust = (what, html, year = 2016, programme = ["Stage+D"]) => { let bad = false; try { parseSonarSchedule(html, { year, programme }); } catch { bad = true; } mutations++; ok(bad, `mutation not caught: ${what}`); };
    snMust("a Sónar 2016 timetable read as another year's", snPage(), 2017);
    snMust("a Sónar page naming no edition", snPage({ title: "Schedules" }).replace("Sonar Sónar Barcelona 2016", "Sonar"));
    snMust("a Sónar session headed with another weekday", snPage({ h1: "Friday 16 | Sónar by Day" }));
    snMust("a Sónar session headed as the other session", snPage({ h2: "Thursday 16 | Sónar by Day" }));
    snMust("a Sónar calendar whose id and date disagree", snPage({ day: { dataDate: "20160617" } }));
    snMust("a Sónar set in a column the calendar does not print", snPage({ day: { events: [snEv("Lost", "13:00", "14:00", 9)] } }));
    snMust("a Sónar day set outside the session's hours", snPage({ day: { events: [snEv("Early", "11:00", "12:00", 1)] } }));
    snMust("a Sónar Sónar+D entry out of hours read as a music set", snPage(), 2016, []);
    snMust("two Sónar sets overlapping on one stage", snPage({ night: { events: [snEv("Night Act", "23:30", "01:00", 1, "nit"), snEv("Clash", "00:30", "02:00", 1, "nit")] } }));
    snMust("a Sónar set printed all-day", snPage({ day: { events: [snEv("Day Act", "13:00", "14:00", 1, "dia", { allDay: true })] } }));
    snMust("a Sónar night set filed under the day session", snPage({ night: { events: [snEv("Night Act", "23:30", "01:00", 1, "dia")] } }));
    snMust("a Sónar set with no 24-hour end", snPage({ day: { events: [snEv("Day Act", "13:00", "2pm", 1)] } }));
    snMust("a Sónar calendar drawn twice, differently", snPage() + snCal({ events: snDay, init: 12 }));
    // Sziget's day programme: one day per page, its tabs the week with no
    // year, a stage picker whose checked stages are the grid's columns, and
    // a grid of starts where a set covers the rows below it (rowspan) and a
    // night runs past midnight. A cell billing several acts is a bill.
    const szTab = (date, label, sel) => `<td${sel ? ' class="selected"' : ""}>\n<a href="https://web.archive.org/web/20100817142126/http://www.sziget.hu/festival_english/programs/-/days?day=${date}&amp;stages[]=1&amp;stages[]=2" style="cursor:pointer">${label}</a>\n</td>`;
    const szCell = (span, stage, text, slug = stage === 1 ? "main_stage" : "party_arena") => `<td rowspan="${span}">\n<a href="https://web.archive.org/web/20100817142126/http://www.sziget.hu/festival_english/programs/helyszin/${slug}.${stage}.html#p${span}${stage}">${text}</a>\n</td>`;
    const szE = '<td class="prprogramcellaures"></td>';
    const szRow = (t, cells, i) => `<tr class="row${i % 2}">\n<td class="time" valign="middle">${t}</td>${cells.join("")}</tr>`;
    const szRows = [szRow("19:30", [szCell(2, 1, "Muse (UK)"), szE], 0), szRow("21:00", [szCell(1, 2, "Kode9 (UK)")], 1), szRow("23:30", [szE, szCell(1, 2, "Night &amp; Day")], 2), szRow("01:00", [szE, szCell(1, 2, "Closer<p></p><p>Guest</p>")], 3)];
    const szPage = ({ title = "Sziget.hu - Programs", tabs = [["2010-08-14", "August 14.<br>Saturday", true], ["2010-08-15", "August 15.<br>Sunday", false]], checked = [true, true], heads = ["Main Stage", "Party Arena"], rows = szRows } = {}) =>
      `<title>${title}</title><link href="http://s.sziget.hu/templates/sziget2010b/style.css"><div class="cikk"><form id="dailyForm"><table class="dailyDaySelector"><tbody><tr>${tabs.map(t => szTab(...t)).join("")}</tr></tbody></table>`
      + `<td><input type="checkbox" name="stages[]" value="1" id="loc1"${checked[0] ? ' checked="checked"' : ""}><label for="loc1">Main Stage</label></td><td><input type="checkbox" name="stages[]" value="2" id="loc2"${checked[1] ? ' checked="checked"' : ""}><label for="loc2">Party Arena</label></td>`
      + `<td><input type="checkbox" name="stages[]" value="3" id="loc3"><label for="loc3">Blues Stage</label></td><td><a style="x" target="_blank" href="http://www.sziget.hu/festival_english/programs/helyszin/hungaricum_village.9.html">Hungaricum Village</a></td></form>`
      + `<div class="prg_szinpad">\n<table width="930">\n<tbody>\n<tr class="tableheader">\n<td><!-- sh --></td>${heads.map(h => `<th>${h}</th>`).join("")}</tr>\n<tr class="tablesep"><td class="orange1"></td></tr>${rows.join("")}</tbody></table></div></div>`;
    const szp = parseSzigetDays(szPage(), { year: 2010 });
    ok(JSON.stringify([szp.date, szp.label, szp.template, szp.tabDates, szp.stages, szp.unshown, szp.venues, szp.sets.map(x => [x.stage, x.start, x.end, x.artist, x.openEnd]), szp.bills.map(b => [b.stage, b.start, b.lines])])
      === JSON.stringify(["2010-08-14", "August 14. Saturday", "sziget2010b", ["2010-08-14", "2010-08-15"], ["Main Stage", "Party Arena"], ["Blues Stage"], ["Hungaricum Village"],
        [["Main Stage", "19:30", "", "Muse (UK)", true], ["Party Arena", "21:00", "", "Kode9 (UK)", true], ["Party Arena", "23:30", "", "Night & Day", true]],
        [["Party Arena", "01:00", ["Closer", "Guest"]]]]),
      `a Sziget day page must come back as its selected day, open-ended sets after midnight that night's and a several-act cell as a bill: ${JSON.stringify(szp)}`);
    ok(szigetDate("August 14. Saturday", 2010) === "2010-08-14" && szigetDate("August 14. Sunday", 2010) === null, "a Sziget tab must be dated by its weekday in the year");
    const szMust = (what, html, year = 2010) => { let bad = false; try { parseSzigetDays(html, { year }); } catch { bad = true; } mutations++; ok(bad, `mutation not caught: ${what}`); };
    szMust("a Sziget 2010 page read as another year's", szPage(), 2011);
    szMust("a page that is not Sziget's programme", szPage({ title: "Sziget.hu - News" }));
    szMust("a Sziget page with no selected day", szPage({ tabs: [["2010-08-14", "August 14.<br>Saturday", false], ["2010-08-15", "August 15.<br>Sunday", false]] }));
    szMust("a Sziget tab whose weekday is not its date's", szPage({ tabs: [["2010-08-14", "August 14.<br>Friday", true]] }));
    szMust("Sziget tabs that skip a day", szPage({ tabs: [["2010-08-14", "August 14.<br>Saturday", true], ["2010-08-16", "August 16.<br>Monday", false]] }));
    szMust("a Sziget grid whose columns are not the checked stages", szPage({ checked: [true, false] }));
    szMust("a Sziget set linked to another stage than its column", szPage({ rows: [szRow("19:30", [szCell(2, 2, "Muse (UK)"), szE], 0), ...szRows.slice(1)] }));
    szMust("a Sziget row with a cell left over", szPage({ rows: [szRow("19:30", [szCell(2, 1, "Muse (UK)"), szE, szE], 0), ...szRows.slice(1)] }));
    szMust("a Sziget row missing a cell", szPage({ rows: [szRow("19:30", [szCell(2, 1, "Muse (UK)")], 0), ...szRows.slice(1)] }));
    szMust("a Sziget set spanning past the grid", szPage({ rows: [...szRows.slice(0, 3), szRow("01:00", [szE, szCell(2, 2, "Closer")], 3)] }));
    szMust("Sziget rows out of time order", szPage({ rows: [szRows[0], szRow("18:00", [szCell(1, 2, "Kode9 (UK)")], 1), ...szRows.slice(2)] }));
    szMust("a Sziget night wrapping past midnight twice", szPage({ rows: [...szRows, szRow("00:30", [szE, szE], 4)] }));
    szMust("a Sziget set naming no act", szPage({ rows: [szRow("19:30", [szCell(2, 1, " "), szE], 0), ...szRows.slice(1)] }));
    // Defqon.1 2015's timetable: one page for the weekend, a section per day
    // and an undated afterparty, an article per area naming its weekday.
    const dqSet = (start, end, name) => `<li><time><span class="start">${start}</span> - <span class="end">${end}</span></time><h3 class="name">${name}</h3></li>`;
    const dqArt = (cls, h2, lis) => `<article class="area ${cls}"><header><h2>${h2}</h2></header><ul>${lis.join("")}</ul></article>`;
    const dqSec = (head, arts) => `<section class="d"><header class="x day"><div class="inn"><h2>${head}</h2></div></header>${arts.join("")}</section>`;
    const dqFri = [dqArt("red friday", "Hardstyle", [dqSet("20:00", "21:00", "Max Enforcer"), dqSet("21:00", "22:00", "B &amp; C"), "<li><h3 class=\"name\">Hosted by Villain</h3></li>"])];
    const dqSun = [dqArt("red sunday", "Hardcore", [dqSet("12:00", "13:00", "Day Act")]), dqArt("cafe sunday", "Café", ["<li><p>Coffee all day</p></li>"]),
      dqArt("closing sunday", "Sunday from 20.00 till 23.00 at the Red", ["<li><h3 class=\"name\">Closer One</h3></li>", "<li><h3 class=\"name\">Closer Two</h3></li>"])];
    const dqAfter = [dqArt("red friday", "Afterparty", [dqSet("23:00", "00:30", "Night Act"), dqSet("00:30", "02:00", "Late Act")])];
    const dqPage = ({ title = "Timetable - Defqon.1 2015", fri = dqFri, sun = dqSun, after = dqAfter, friHead = "Friday • 19 June 2015 • 20:00 - 01:00" } = {}) =>
      `<title>${title}</title>` + ["friday", "sunday", "red", "closing"].map(k => `<input type="checkbox" value=".${k}" id="${k}">`).join("")
      + dqSec(friHead, fri) + dqSec("Afterparty • 23:00 – 04:00", after) + dqSec("Sunday • 21 June 2015 • 11:00 - 23:00", sun);
    const dqp = parseDefqonAreas(dqPage(), { year: 2015 });
    ok(JSON.stringify([dqp.stages, dqp.days.map(d => [d.date, d.sets.map(x => [x.stage, x.start, x.end, x.artist])]), dqp.hosts.map(h => h.host), dqp.noSets.map(n => n.heading), dqp.bills.map(b => [b.date, b.stage, b.start, b.end, b.acts])])
      === JSON.stringify([["Red"], [["2015-06-19", [["Red", "20:00", "21:00", "Max Enforcer"], ["Red", "21:00", "22:00", "B & C"], ["Red", "23:00", "00:30", "Night Act"], ["Red", "00:30", "02:00", "Late Act"]]],
        ["2015-06-21", [["Red", "12:00", "13:00", "Day Act"]]]], ["Hosted by Villain"], ["Café"], [["2015-06-21", "Closing", "20:00", "23:00", ["Closer One", "Closer Two"]]]]),
      `a Defqon.1 page must come back as its dated days, the afterparty on the night its areas name, the host and the café as no sets and the closing as a block: ${JSON.stringify(dqp)}`);
    ok(defqonDate("Friday • 19 June 2015 • 20:00 - 01:00", 2015) === "2015-06-19" && defqonDate("Saturday • 19 June 2015 • 20:00 - 01:00", 2015) === null, "a Defqon.1 heading must be dated by its weekday in the year");
    const dqMust = (what, html, year = 2015) => { let bad = false; try { parseDefqonAreas(html, { year }); } catch { bad = true; } mutations++; ok(bad, `mutation not caught: ${what}`); };
    dqMust("a Defqon.1 2015 page read as another year's", dqPage(), 2016);
    dqMust("a page that is not Defqon.1's timetable", dqPage({ title: "Line-up - Defqon.1 2015" }));
    dqMust("a Defqon.1 heading whose weekday is not its date's", dqPage({ friHead: "Saturday • 19 June 2015 • 20:00 - 01:00" }));
    dqMust("a Defqon.1 area under another day's section", dqPage({ fri: [dqArt("red sunday", "Hardstyle", [dqSet("20:00", "21:00", "Max Enforcer")])] }));
    dqMust("a Defqon.1 area the filter bar does not offer", dqPage({ fri: [dqArt("blue friday", "Hardstyle", [dqSet("20:00", "21:00", "Max Enforcer")])] }));
    dqMust("Defqon.1 sets overlapping on one area", dqPage({ fri: [dqArt("red friday", "Hardstyle", [dqSet("20:00", "21:30", "Max Enforcer"), dqSet("21:00", "22:00", "B")])] }));
    dqMust("a Defqon.1 set printed with no time range", dqPage({ fri: [dqArt("red friday", "Hardstyle", ["<li><time><span class=\"start\">20</span> - <span class=\"end\">21:00</span></time><h3 class=\"name\">X</h3></li>"])] }));
    dqMust("a Defqon.1 line that is neither a set nor a host", dqPage({ fri: [dqArt("red friday", "Hardstyle", [dqSet("20:00", "21:00", "Max Enforcer"), "<li><h3 class=\"name\">Surprise</h3></li>"])] }));
    dqMust("a Defqon.1 area with no set that is neither a description nor a block", dqPage({ sun: [dqArt("closing sunday", "Closing", ["<li><h3 class=\"name\">Closer One</h3></li>"])] }));
    // Tomorrowland's lineup page: a Stages tab (a day per eventday, a stage per
    // block, an optional host) checked against its A-Z Artists tab.
    const tlA = (slug, name) => `<li><a class="noTracking" data-artist="${slug}"> ${name} </a></li>`;
    const tlStage = (name, acts, host = "") => `<div class="stage"><div class="stage__heading"><h4>${name}</h4></div><div class="stage__content">${host ? `<div class="stage__title"><p class="stage__location">${host}</p></div>` : ""}<ul>${acts.join("")}</ul></div></div>`;
    const tlDay = (label, stages) => `<div class="eventday" data-eventday-id="1" style="display:none;" data-eventday="${label}"><div class="stage-sizer"></div>${stages.join("")}</div>`;
    const tlDays = [tlDay("Friday 19 July 2024", [tlStage("Mainstage", [tlA("armin", "Armin van Buuren"), tlA("k-ouml-lsch", "K&ouml;lsch")]), tlStage("Elixir", [tlA("mc", "Mc Stretch")], "Mangrove")]),
      tlDay("Saturday 20 July 2024", [tlStage("Mainstage", [tlA("armin", "Armin van Buuren")])])];
    const tlPage = ({ days = tlDays, az = [tlA("armin", "Armin van Buuren"), tlA("k-ouml-lsch", "K&ouml;lsch"), tlA("mc", "Mc Stretch")] } = {}) =>
      `<title>Line-up - Festival -  Tomorrowland</title><div class="eventdays">${days.join("")}</div><div class="lineup__page lineup__page--artists" style="display: none;"><ul>${az.join("")}</ul></div>`;
    const tlp = parseTomorrowlandLineup(tlPage(), { year: 2024 });
    ok(JSON.stringify([tlp.title, tlp.days.map(d => [d.date, d.stages.map(x => [x.stage, x.host || "", x.acts.map(a => a.name)])]), tlp.findings])
      === JSON.stringify(["Line-up - Festival - Tomorrowland", [["2024-07-19", [["Mainstage", "", ["Armin van Buuren", "Kölsch"]], ["Elixir", "Mangrove", ["Mc Stretch"]]]], ["2024-07-20", [["Mainstage", "", ["Armin van Buuren"]]]]], []]),
      `a Tomorrowland lineup page must come back as its dated days, each stage with its host apart from its acts: ${JSON.stringify(tlp)}`);
    const tlf = parseTomorrowlandLineup(tlPage({ az: [tlA("armin", "Armin Van Buuren"), tlA("k-ouml-lsch", "K&ouml;lsch"), tlA("ghost", "Ghost")] }), { year: 2024 });
    ok(tlf.findings.length === 3 && tlf.findings.some(f => /Mc Stretch: on the Stages tab, not on the Artists tab/.test(f)) && tlf.findings.some(f => /Ghost: on the Artists tab, on no stage/.test(f)) && tlf.findings.some(f => /the Artists tab prints "Armin Van Buuren"/.test(f)),
      `the two Tomorrowland tabs must be checked against each other (got ${tlf.findings.join("; ")})`);
    const tlMust = (what, html, year = 2024) => { let bad = false; try { parseTomorrowlandLineup(html, { year }); } catch { bad = true; } mutations++; ok(bad, `mutation not caught: ${what}`); };
    tlMust("a Tomorrowland 2024 page read as another year's", tlPage(), 2025);
    tlMust("a Tomorrowland day whose weekday is not its date's", tlPage({ days: [tlDay("Saturday 19 July 2024", [tlStage("Mainstage", [tlA("armin", "Armin van Buuren")])])] }));
    tlMust("a Tomorrowland day printed twice", tlPage({ days: [tlDays[0], tlDays[0]] }));
    tlMust("a Tomorrowland stage with no name", tlPage({ days: [tlDay("Friday 19 July 2024", [tlStage(" ", [tlA("armin", "Armin van Buuren")])])] }));
    tlMust("a Tomorrowland stage naming no act", tlPage({ days: [tlDay("Friday 19 July 2024", [tlStage("Mainstage", [])])] }));
    tlMust("a Tomorrowland act with no name", tlPage({ days: [tlDay("Friday 19 July 2024", [tlStage("Mainstage", [tlA("x", " ")])])] }));
    tlMust("a Tomorrowland page with no Artists tab", tlPage().replace('lineup__page--artists', 'lineup__page--other'));
    tlMust("a Tomorrowland page with no Stages tab", tlPage().replace('<div class="eventdays">', '<div class="days">'));
    // Time Warp's edition sub-site: a hidden header naming the edition and its
    // nights, then one A-Z list per night, a live set marked by a span.
    const twAct = (name, live = false) => `<li class="js-overlay-item"><a class="clearing" href="#"><span class="ix-header"><h3>${name}${live ? '<span class="artist-live">Live</span>' : ""}</h3></span></a></li>`;
    const twList = (n, heading, acts) => `<h2 id="e${n}"> ${heading}<br></h2><section class="index"><ul data-id="e${n + 1}" class="ix-lineup js-overlay" data-slide-length="${acts.length}">${acts.join("")}</ul></section>`;
    const twLists = [twList(1, "Friday A-Z", [twAct("Amelie Lens"), twAct("Reinier Zonneveld", true)]), twList(3, "Saturday A-Z", [twAct("K&ouml;lsch"), twAct("Sven Väth")])];
    const twPage = ({ head = '<h1>Germany 22</h1><h2>28. + 29. October 2022 | Mannheim</h2>', lists = twLists } = {}) =>
      `<title> Lineup 2022 </title><div class="hgroup" style="display: none;">${head}</div><div class="content">${lists.join("")}</div>`;
    const twp = parseTimeWarpLineup(twPage(), { year: 2022 });
    ok(JSON.stringify([twp.title, twp.edition, twp.city, twp.days.map(d => [d.date, d.label, d.acts])])
      === JSON.stringify(["Lineup 2022", "Germany 22", "Mannheim", [["2022-10-28", "Friday 28 October 2022", ["Amelie Lens", "Reinier Zonneveld (Live)"]], ["2022-10-29", "Saturday 29 October 2022", ["Kölsch", "Sven Väth"]]]]),
      `a Time Warp lineup page must come back as its header's nights, each with its acts, a live set billed "(Live)": ${JSON.stringify(twp)}`);
    ok(JSON.stringify(twHeaderDates("1. April 2023", 2023)) === JSON.stringify(["2023-04-01"]) && twHeaderDates("31. + 32. October 2022", 2022) === null,
      "Time Warp header dates must be real dates");
    const twMust = (what, html, year = 2022) => { let bad = false; try { parseTimeWarpLineup(html, { year }); } catch { bad = true; } mutations++; ok(bad, `mutation not caught: ${what}`); };
    twMust("a Time Warp 2022 page read as another year's", twPage(), 2023);
    twMust("a Time Warp page with no edition header", twPage({ head: "<h1>Lineup</h1>" }));
    twMust("a Time Warp header naming another edition", twPage({ head: '<h1>Germany 23</h1><h2>28. + 29. October 2022 | Mannheim</h2>' }));
    twMust("a Time Warp header date that is not a date", twPage({ head: '<h1>Germany 22</h1><h2>28. + 32. October 2022 | Mannheim</h2>' }));
    twMust("a Time Warp page with fewer lists than nights", twPage({ lists: [twLists[0]] }));
    twMust("a Time Warp list headed with the wrong weekday", twPage({ lists: [twLists[1], twLists[0]] }));
    twMust("a Time Warp act with no name", twPage({ lists: [twList(1, "Friday A-Z", [twAct(" ")]), twLists[1]] }));
    twMust("a Time Warp act listed twice on one night", twPage({ lists: [twList(1, "Friday A-Z", [twAct("Perel"), twAct("Perel")]), twLists[1]] }));
    // Defqon.1 2013's timetable grid: one section per day, one row per area,
    // blocks by width with no time; a named part with its acts and hosts.
    const dgCell = (cls, inner) => `<li class="${cls}"><div class="inner">${inner}</div></li>`;
    const dgRow = (cls, area, cells) => `<div class="day-lineup ${cls}">\n<ul class="lineup-bar">${area ? dgCell("area", area) : ""}${cells.join("")}</ul>\n</div>`;
    const dgDay = (id, heading, rows) => `<section class="day ${id}" id="${id}"><h2 class="day-title"><span>${heading}</span></h2>${rows.join("")}</section>`;
    const dgDays = [
      dgDay("friday", "Festival Day 1 - Friday June 21", [dgRow("fri blue", null, [dgCell("ten", "<div><div><h3>The Gathering @ The Blue</h3>Frontliner<br>Zatox<br>Hosted By Villain &amp; Ruffian</div></div>")])]),
      dgDay("saturday", "Festival Day 2 - Saturday June 22", [dgRow("sat red", "RED", [dgCell("one", "Ran-D"), dgCell("half double", '<div class="holder">Outbreak <br>/ Live</div>'), dgCell("one off", ""),
        dgCell("one double", '<div class="holder">Endymion &amp;<br><span>Evil Activities</span></div>'), dgCell("half", "End<br>show")]),
        dgRow("sat uv", "UV", [dgCell("one", "Alpha<span class=\"up\">2</span>"), dgCell("one", "N-Vitral / Live")])]),
      dgDay("sunday", "Festival Day 3 - Sunday June 23", [dgRow("sun black", "BLACK", [dgCell("one", "Coone"), dgCell("four red ending", "<div><div><h3>The Closing</h3>Coone<br>Wildstylez<br>Hosted By Villain</div></div>")])]),
    ];
    const dgPage = ({ days = dgDays, title = "DEFQON.1 FESTIVAL - TIME-TABLE" } = {}) => `<title>${title}</title>${days.join("")}`;
    const dgp = parseDefqonGrid(dgPage(), { year: 2013 });
    ok(JSON.stringify([dgp.title, dgp.days.map(d => [d.date, d.label, d.acts.map(a => `${a.artist}@${a.stage}`)]), dgp.segments, dgp.parts.map(x => [x.heading, x.stage, x.acts, x.hosts])])
      === JSON.stringify(["DEFQON.1 FESTIVAL - TIME-TABLE", [["2013-06-21", "Friday 21 June 2013", ["Frontliner@Blue", "Zatox@Blue"]],
        ["2013-06-22", "Saturday 22 June 2013", ["Ran-D@Red", "Outbreak (Live)@Red", "Endymion & Evil Activities@Red", "Alpha²@UV", "N-Vitral (Live)@UV"]],
        ["2013-06-23", "Sunday 23 June 2013", ["Coone@Black", "Coone@", "Wildstylez@"]]],
        [{ day: 2, stage: "Red", segment: "End show" }],
        [["The Gathering @ The Blue", "Blue", ["Frontliner", "Zatox"], ["Hosted By Villain & Ruffian"]], ["The Closing", "", ["Coone", "Wildstylez"], ["Hosted By Villain"]]]]),
      `a Defqon.1 grid must come back as its dated days, each act with its area, live sets billed "(Live)", hosts and show segments apart: ${JSON.stringify(dgp)}`);
    ok(dgDayHeading("Festival Day 2 - Saturday June 22", 2013)?.date === "2013-06-22" && dgDayHeading("Festival Day 2 - Sunday June 22", 2013) === null && dgDayHeading("Festival Day 2 - Saturday June 31", 2013) === null,
      "Defqon.1 day headings must be a weekday and a real date in the year");
    const dgMust = (what, html, year = 2013) => { let bad = false; try { parseDefqonGrid(html, { year }); } catch { bad = true; } mutations++; ok(bad, `mutation not caught: ${what}`); };
    dgMust("a Defqon.1 2013 grid read as another year's", dgPage(), 2014);
    dgMust("a Defqon.1 grid with no day", dgPage({ days: [] }));
    dgMust("a Defqon.1 day printed twice", dgPage({ days: [dgDays[0], dgDays[0]] }));
    dgMust("a Defqon.1 day out of order", dgPage({ days: [dgDays[1], dgDays[0]] }));
    dgMust("a Defqon.1 block the grid does not draw", dgPage({ days: [dgDays[0], dgDay("saturday", "Festival Day 2 - Saturday June 22", [dgRow("sat red", "RED", [dgCell("seven", "Ran-D")])])] }));
    dgMust("a Defqon.1 gap that prints a name", dgPage({ days: [dgDays[0], dgDay("saturday", "Festival Day 2 - Saturday June 22", [dgRow("sat red", "RED", [dgCell("one off", "Ran-D")])])] }));
    dgMust("a Defqon.1 act row with no area", dgPage({ days: [dgDays[0], dgDay("saturday", "Festival Day 2 - Saturday June 22", [dgRow("sat red", null, [dgCell("one", "Ran-D")])])] }));
    dgMust("a Defqon.1 day naming no act", dgPage({ days: [dgDays[0], dgDay("saturday", "Festival Day 2 - Saturday June 22", [dgRow("sat red", "RED", [dgCell("one off", "")])])] }));
    dgMust("a Defqon.1 named part with hosts only", dgPage({ days: [dgDay("friday", "Festival Day 1 - Friday June 21", [dgRow("fri blue", null, [dgCell("ten", "<div><div><h3>The Gathering @ The Blue</h3>Hosted By Villain</div></div>")])])] }));
    dgMust("a Defqon.1 named part drawn in another area's row", dgPage({ days: [dgDay("friday", "Festival Day 1 - Friday June 21", [dgRow("fri red", "RED", [dgCell("ten", "<div><div><h3>The Gathering @ The Blue</h3>Zatox</div></div>")])])] }));
    // Creamfields' Artists page: a weekday filter, then one block per act with
    // its days and A-Z key as classes and its stages as "Playing" links.
    const cfAct = (cls, name, stages = []) => `<div class="item ${cls}" style="position: absolute;"><article><span class="name">${name}</span><h4>Playing:</h4>${stages.map(x => `<a class="playing" href="https://www.creamfields.com/lineup/x">${x}</a>`).join("")}</article></div>`;
    const cfFilter = (days = ["friday", "saturday", "sunday", "thursday"]) => days.map(d => `<input type="checkbox" data-filter="and" name="${d}" id="${d}" value="${d}">`).join("");
    const cfActs = [cfAct("featured friday saturday A", "Armin Van Buuren", ["Armada", "Horizon"]), cfAct("thursday B", "Ben Nicky", ["Pepsi Max"]),
      cfAct("sunday S", "Sasha &amp; Digweed", ["Sub_aural", "Cream"]), cfAct("saturday S", "Steel Yard Presents s\\/stem", ["Sub_Aural"]), cfAct("saturday S", "Sub Focus", ["Sub_aural"]),
      cfAct("friday �", "Ørjan Nilsen", ["Private: Blow"]), cfAct("friday J", "Junior J"), cfAct("thursday B", "Ben Nicky", ["Pepsi Max"]), cfAct("thursday B", "BEN NICKY", ["Pepsi Max"])];
    const cfPage = ({ title = "Creamfields 2019 | Artists", filter = cfFilter(), acts = cfActs } = {}) => `<title>${title}</title>${filter}${acts.join("")}`;
    const cfp = parseCreamfieldsArtists(cfPage(), { year: 2019 }), cfr = creamfieldsRows(cfp);
    ok(JSON.stringify([cfp.filter, cfr.rows.map(r => `${r.artist}|${r.weekday}|${r.stage}`), cfr.unpaired, cfr.folded, cfr.sameActs])
      === JSON.stringify([["Friday", "Saturday", "Sunday", "Thursday"],
        ["Armin Van Buuren|Friday|", "Armin Van Buuren|Saturday|", "Ben Nicky|Thursday|Pepsi Max", "Sasha & Digweed|Sunday|Sub_aural", "Sasha & Digweed|Sunday|Cream",
          "Steel Yard Presents s/stem|Saturday|Sub_aural", "Sub Focus|Saturday|Sub_aural", "Ørjan Nilsen|Friday|Blow", "Junior J|Friday|"],
        [{ artist: "Armin Van Buuren", days: ["Friday", "Saturday"], stages: ["Armada", "Horizon"] }],
        [{ printed: "Sub_Aural", billedAs: "Sub_aural" }, { printed: "Private: Blow", billedAs: "Blow" }], [{ printed: "BEN NICKY", billedAs: "Ben Nicky" }]]),
      `a Creamfields Artists page must come back as one row per act, day and stage, multi-day stages unpaired, case and "Private: " folded, an act printed twice billed once: ${JSON.stringify([cfr.rows, cfr.folded])}`);
    ok(parseCreamfieldsArtists(cfPage({ title: "cinch presents Creamfields 2021 | Artists", acts: [cfAct("featured saturday ABOVE &amp; BEYOND", "Above &amp; Beyond"), cfAct("sunday KöLSCH", "Kölsch")] }), { year: 2021 }).acts.length === 2,
      "a 2021 Creamfields page keys each act by its name in ASCII capitals, under cinch's title");
    ok(JSON.stringify(runDates(["2019-08-22", "2019-08-25"])) === '["2019-08-22","2019-08-23","2019-08-24","2019-08-25"]', "a census run expands to each of its days");
    const cfMust = (what, html, year = 2019) => { let bad = false; try { parseCreamfieldsArtists(html, { year }); } catch { bad = true; } mutations++; ok(bad, `mutation not caught: ${what}`); };
    cfMust("a Creamfields 2019 page read as another year's", cfPage(), 2018);
    cfMust("a Creamfields page with another title", cfPage({ title: "Creamfields 2019 | Tickets" }));
    cfMust("a Creamfields page with no day filter", cfPage({ filter: "" }));
    cfMust("a Creamfields day filter printing a day twice", cfPage({ filter: cfFilter(["friday", "friday", "saturday"]) }));
    cfMust("a Creamfields act on a day the filter does not offer", cfPage({ filter: cfFilter(["friday", "saturday"]), acts: [cfAct("sunday S", "Sasha")] }));
    cfMust("a Creamfields act on no day", cfPage({ acts: [cfAct("featured G", "Green Velvet")] }));
    cfMust("a Creamfields act with no name", cfPage({ acts: [cfAct("friday A", " ")] }));
    cfMust("a Creamfields act whose key is not its letter or name", cfPage({ acts: [cfAct("friday Z", "Armin Van Buuren")] }));
    cfMust("a Creamfields act with a class the page does not explain", cfPage({ acts: [cfAct("friday headliner A", "Armin Van Buuren")] }));
    cfMust("a Creamfields act listing a stage with no name", cfPage({ acts: [cfAct("friday A", "Armin Van Buuren", [" "])] }));
    cfMust("a Creamfields page with no act", cfPage({ acts: [] }));
    // Creamfields' Lineup page (2022 on): a block per day, a column per stage.
    const clAct = (name, { tag = "strong", cls = "", above, after, below } = {}) => `<li class="a-list-item ">${above !== undefined ? `<span class="box-above">${above}</span><br>` : ""}<${tag} class="a-name ${cls}">${name}${after !== undefined ? ` <span class="inline-after">${after}</span>` : ""}</${tag}>${below !== undefined ? ` <span class="below-highlight">${below}</span><br>` : ""}</li>`;
    const clCol = (h3, acts, { more = false, attrs = "" } = {}) => `<div class="listing-col "><h3${attrs}><span>${h3}</span></h3><ul>${acts.join("")}</ul>${more ? '<span class="plus-more">+ more</span>' : ""}</div>`;
    const clDay = (key, title, below, cols) => `<div class="lineup-section is-hidden" id="panel-${key}"><div class="lineup-section-content"><h2 class="day-title"><span class="title">${title}</span><span class="below">${below}</span></h2><div class="arena-list">${cols.join("")}</div></div></div>`;
    const clDays = [
      clDay("thursday", "Thursday", "21st August 2025", [clCol('Cream <span class="visually-hidden"> : Silent disco (low noise event)</span>', [clAct("KC Lights")], { attrs: ' class="silent-disco"' })]),
      clDay("friday", "Friday", "22nd August 2025", [
        clCol('APEX <span class="sub">Indoor Main Stage</span>', [clAct("Dom Dolla"), clAct("Alex Farell", { after: "B2B" }), clAct("Sikoti"), clAct("Maddix", { above: "SPECIAL GUEST" })], { more: true }),
        clCol('Pepsi presents <span class="sub">Future Sounds of Egypt</span>', [clAct("Aly &amp; Fila"), clAct("Thrillseekers", { after: "(25 YEARS SET)" })]),
        clCol('ARC', [clAct("Alesso")]), clCol('Arc', [clAct("Hardwell"), clAct("HARDWELL")])]),
    ];
    const clPage = ({ title = "Rockstar Energy presents Creamfields | lineup", days = clDays } = {}) => `<title>${title}</title><div class="lineup-section" id="panel-featured"><h2 class="day-title"><span class="title">Featured</span><span class="below">artists a-z</span></h2></div>${days.join("")}`;
    const clp = parseCreamfieldsLineup(clPage(), { year: 2025 }), clr = creamfieldsLineupRows(clp);
    ok(JSON.stringify([clp.days.map(d => `${d.weekday} ${d.date}`), clr.rows.map(r => `${r.artist}|${r.weekday}|${r.stage}`), clr.joined.map(j => j.billedAs), clr.notes.map(n => `${n.artist}:${n.printed.map(x => x.line).join("+")}`),
      clr.stageNotes, clr.more, clr.folded, clr.sameActs])
      === JSON.stringify([["Thursday 2025-08-21", "Friday 2025-08-22"],
        ["KC Lights|Thursday|Cream", "Dom Dolla|Friday|APEX", "Alex Farell B2B Sikoti|Friday|APEX", "Maddix|Friday|APEX", "Aly & Fila|Friday|Pepsi presents Future Sounds of Egypt",
          "Thrillseekers|Friday|Pepsi presents Future Sounds of Egypt", "Alesso|Friday|Arc", "Hardwell|Friday|Arc"],
        ["Alex Farell B2B Sikoti"], ["Maddix:SPECIAL GUEST", "Thrillseekers:(25 YEARS SET)"],
        [{ weekday: "Thursday", stage: "Cream", silentDisco: true }, { weekday: "Friday", stage: "APEX", subtitle: "Indoor Main Stage" }],
        [{ weekday: "Friday", stage: "APEX" }], [{ printed: "ARC", billedAs: "Arc" }], [{ printed: "HARDWELL", billedAs: "Hardwell" }]]),
      `a Creamfields Lineup page must come back as one row per act, day and stage, B2B joined, "presents" subtitles billed, case folded, "+ more" kept: ${JSON.stringify([clr.rows, clr.folded, clr.stageNotes])}`);
    // 2022: weekdays only under "AUGUST 2022", h4 names, a name the page's style lowers.
    const cl22 = parseCreamfieldsLineup(`<title>cinch presents Creamfields 2022 | Arenas</title><section id="tab-friday"><div class="tier"><h2 class="day-title"><span class="date">AUGUST 2022</span><br><span class="below">FRIDAY LINE-UP</span></h2></div>${clCol('<a href="https://creamfields.com/lineup/paradise">Paradise</a>', [clAct("Alan Fitzpatrick", { tag: "h4", below: "B2B" }), clAct("Richy Ahmed", { tag: "h4" }), clAct("T&gt;l B2B LEVELA", { tag: "h4", cls: "force-to-lower" })])}</section>`, { year: 2022 });
    const cl22r = creamfieldsLineupRows(cl22);
    ok(JSON.stringify([cl22.days.map(d => `${d.weekday} ${d.date}`), cl22r.rows.map(r => r.artist), cl22r.lowered]) === JSON.stringify([["Friday null"], ["Alan Fitzpatrick B2B Richy Ahmed", "t>l b2b levela"], [{ printed: "T>l B2B LEVELA", shownAs: "t>l b2b levela" }]]),
      `a 2022 Creamfields Lineup page reads its weekday, joins a B2B printed below, and bills a lowered name as shown: ${JSON.stringify(cl22r.rows)}`);
    ok(printedDate("22nd August 2024") === "2024-08-22" && printedDate("31st February 2024") === null && printedDate("22 August 2024") === null, "Creamfields' printed dates read as ISO dates, impossible ones refused");
    const clMust = (what, html, year = 2025) => { let bad = false; try { creamfieldsLineupRows(parseCreamfieldsLineup(html, { year })); } catch { bad = true; } mutations++; ok(bad, `mutation not caught: ${what}`); };
    clMust("a Creamfields Lineup page read as another year's", clPage(), 2024);
    clMust("a Creamfields Lineup page with another title", clPage({ title: "Creamfields | Tickets" }));
    clMust("a Creamfields Lineup page with no day", clPage({ days: [] }));
    clMust("a Creamfields Lineup day whose date is not its weekday", clPage({ days: [clDay("friday", "Friday", "23rd August 2025", [clCol("Arc", [clAct("Alesso")])])] }));
    clMust("a Creamfields Lineup day block headed another day", clPage({ days: [clDay("friday", "Saturday", "23rd August 2025", [clCol("Arc", [clAct("Alesso")])])] }));
    clMust("a Creamfields Lineup day printing no date", clPage({ days: [clDay("friday", "Friday", "artists a-z", [clCol("Arc", [clAct("Alesso")])])] }));
    clMust("a Creamfields Lineup day printed twice", clPage({ days: [clDays[1], clDays[1]] }));
    clMust("a Creamfields Lineup stage with no name", clPage({ days: [clDay("friday", "Friday", "22nd August 2025", [clCol(" ", [clAct("Alesso")])])] }));
    clMust("a Creamfields Lineup act with no name", clPage({ days: [clDay("friday", "Friday", "22nd August 2025", [clCol("Arc", [clAct(" ")])])] }));
    clMust("a Creamfields Lineup act entry with text it does not place", clPage({ days: [clDay("friday", "Friday", "22nd August 2025", [clCol("Arc", [clAct("Alesso").replace("</li>", "<em>LIVE</em></li>")])])] }));
    clMust("a Creamfields Lineup act name with a class it does not know", clPage({ days: [clDay("friday", "Friday", "22nd August 2025", [clCol("Arc", [clAct("Alesso", { cls: "headliner" })])])] }));
    clMust("a Creamfields Lineup B2B with no act after it", clPage({ days: [clDay("friday", "Friday", "22nd August 2025", [clCol("Arc", [clAct("Alesso", { after: "B2B" })])])] }));
    clMust("a Creamfields Lineup heading hiding other text", clPage({ days: [clDay("friday", "Friday", "22nd August 2025", [clCol('Arc <span class="visually-hidden">Main</span>', [clAct("Alesso")])])] }));
    clMust("a 2022 Creamfields Lineup page whose day names another year", `<title>cinch presents Creamfields 2022 | Arenas</title><section id="tab-friday"><h2 class="day-title"><span class="date">AUGUST 2021</span><br><span class="below">FRIDAY LINE-UP</span></h2>${clCol("Arc", [clAct("Alesso")])}</section>`, 2022);
    // Outside Lands' 2022-2025 lineup widget: its script sets the options on
    // one line of JSON; each artist lists its performances, a shared set (a
    // b2b) under each artist with the same id, every time with its offset.
    const dePerf = (id, start, end, stage, name) => ({ id, start: `2023-08-${start}:00.000-07:00`, end: `2023-08-${end}:00.000-07:00`, stage, name });
    const deArtists = [{ name: "Headliner", performances: [dePerf(1, "11T20:40", "11T21:55", "Lands End", "Headliner")] },
      { name: "B", performances: [dePerf(2, "12T01:00", "12T02:00", "SOMA", "B b2b C")] }, { name: "C", performances: [dePerf(2, "12T01:00", "12T02:00", "SOMA", "B b2b C")] },
      { name: "Day Two", performances: [dePerf(3, "12T14:00", "12T15:00", "Lands End", "Day Two")] }];
    const deScript = ({ artists = deArtists, ...o } = {}) => `(function(){\n  window._fest_options = ${JSON.stringify({ name: "Outside Lands 2023", start_date: "2023-08-11", end_date: "2023-08-12",
      timezone: "America/Los_Angeles", initial_grouping: { name: "Interactive Lineup", lineups: [{ name: "All", artists }] }, ...o })};\n  \n  var el = document.getElementById("ds-fest");\n})();`;
    const dep = parseDoStuffEmbed(deScript());
    ok(JSON.stringify([dep.name, dep.run, dep.timezone, dep.grouping, dep.artists, dep.performances, dep.stages, dep.days.map(d => [d.date, d.sets.map(x => [x.stage, x.start, x.end, x.artist, x.billedUnder.join("+")])])])
      === JSON.stringify(["Outside Lands 2023", ["2023-08-11", "2023-08-12"], "America/Los_Angeles", "Interactive Lineup", 4, 3, ["Lands End", "SOMA"],
        [["2023-08-11", [["Lands End", "20:40", "21:55", "Headliner", "Headliner"], ["SOMA", "01:00", "02:00", "B b2b C", "B+C"]]], ["2023-08-12", [["Lands End", "14:00", "15:00", "Day Two", "Day Two"]]]]]),
      `an Outside Lands widget must come back as one set per performance, a b2b once, a set after midnight on the night before: ${JSON.stringify(dep.days)}`);
    const deMust = (what, text) => { let bad = false; try { parseDoStuffEmbed(text); } catch { bad = true; } mutations++; ok(bad, `mutation not caught: ${what}`); };
    const deWith = (i, f) => deArtists.map((a, j) => j === i ? { ...a, performances: a.performances.map(x => ({ ...x, ...f(x) })) } : a);
    deMust("an Outside Lands script with no options", deScript().replace("window._fest_options", "window._fest"));
    deMust("Outside Lands options broken over two lines", deScript().replace('"timezone"', '\n"timezone"'));
    deMust("Outside Lands options with no time zone", deScript({ timezone: "" }));
    deMust("Outside Lands options with no run of days", deScript({ end_date: "2023-08-10" }));
    deMust("an Outside Lands set whose offset is not the zone's", deScript({ artists: deWith(0, x => ({ start: x.start.replace("-07:00", "-08:00") })) }));
    deMust("an Outside Lands set ending before it starts", deScript({ artists: deWith(0, x => ({ end: x.start.replace("20:40", "20:00") })) }));
    deMust("an Outside Lands set over twelve hours", deScript({ artists: deWith(0, x => ({ start: "2023-08-11T08:40:00.000-07:00" })) }));
    deMust("an Outside Lands set outside the run", deScript({ artists: deWith(3, x => ({ start: "2023-08-13T14:00:00.000-07:00", end: "2023-08-13T15:00:00.000-07:00" })) }));
    deMust("an Outside Lands set with seconds", deScript({ artists: deWith(0, x => ({ start: "2023-08-11T20:40:30.000-07:00" })) }));
    deMust("an Outside Lands set with no stage", deScript({ artists: deWith(0, () => ({ stage: "" })) }));
    deMust("an Outside Lands set with no name", deScript({ artists: deWith(0, () => ({ name: " " })) }));
    deMust("one Outside Lands id drawn as two sets", deScript({ artists: deWith(2, () => ({ stage: "Sutro" })) }));
    deMust("two Outside Lands sets overlapping on one stage", deScript({ artists: deWith(3, () => ({ start: "2023-08-11T21:00:00.000-07:00", end: "2023-08-11T22:00:00.000-07:00" })) }));
    // With set titles hidden (show_performance_titles false: Outside Lands
    // 2022-2025, Lightning in a Bottle 2019) a set is billed as the act it is
    // drawn under; a shared set keeps its title; a second performance in the
    // very same slot with the same billing is one set drawn twice, and a gate
    // day with no set is not a day the widget prints sets on.
    const deAct = [{ name: "Headliner", performances: [dePerf(1, "11T20:40", "11T21:55", "Lands End", "Headliner (Special Set)")] },
      { name: "B", performances: [dePerf(2, "12T01:00", "12T02:00", "SOMA", "B b2b C")] }, { name: "C", performances: [dePerf(2, "12T01:00", "12T02:00", "SOMA", "B b2b C")] },
      { name: "Late", performances: [dePerf(4, "11T23:00", "12T00:00", "SOMA", "Surprise"), dePerf(5, "11T23:00", "12T00:00", "SOMA", "Late")] }];
    const dea = parseDoStuffEmbed(deScript({ artists: deAct, show_performance_titles: false, end_date: "2023-08-13" }));
    ok(JSON.stringify([dea.byAct, dea.setDays, dea.sets.map(x => x.artist), dea.drawnTwice.map(x => x.artist)])
      === JSON.stringify([true, ["2023-08-11"], ["Headliner", "Late", "B b2b C"], ["Late"]]),
      `a widget with set titles hidden must bill each set as its act, a shared set as its title, one slot drawn twice once: ${JSON.stringify([dea.byAct, dea.setDays, dea.sets.map(x => x.artist), dea.drawnTwice.map(x => x.artist)])}`);
    ok(parseDoStuffEmbed(deScript({ artists: deAct.slice(0, 3) })).sets.some(x => x.artist === "Headliner (Special Set)"), "a widget that shows set titles must bill each set as its title");
    deMust("a widget with titles shown and two sets in one slot", deScript({ artists: deAct }));
    const dePage = `<div id="ds-fest"></div>\n<script src="https://lib2019.dostff.co/embeds/lineup.js"></script>`;
    ok(pageLoadsScript(dePage, "https://lib2019.dostff.co/embeds/lineup.js") && !pageLoadsScript(dePage, "https://lib2018.dostff.co/embeds/lineup.js")
      && !pageLoadsScript(`<a href="https://lib2019.dostff.co/embeds/lineup.js">`, "https://lib2019.dostff.co/embeds/lineup.js"), "a lineup page must load the widget's own script, by its <script src>");
    const shell = `<script src="https://web.archive.org/assets/js/dist/main.js?v=9"></script><script src="https://web.archive.org/web/2019/https://x.example/a.js"></script>`;
    ok(pageLoadsScript(shell, "https://www.sfoutsidelands.com/assets/js/dist/main.js?v=9", "https://www.sfoutsidelands.com/lineup/")
      && !pageLoadsScript(shell, "https://www.sfoutsidelands.com/assets/js/dist/main.js?v=8", "https://www.sfoutsidelands.com/lineup/")
      && !pageLoadsScript(shell, "https://x.example/a.js", "https://www.sfoutsidelands.com/lineup/"),
      "a page read as rendered from the archive loads its site-relative script on its own host, never an archive capture link");
    const mainJs = `e.setAttribute("id","dostuff-js"),e.setAttribute("src","https://sfosl19.dostff.co/embeds/lineup.js")`;
    ok(scriptSetsSrc(mainJs, "https://sfosl19.dostff.co/embeds/lineup.js") && !scriptSetsSrc(mainJs, "https://sfosl.dostff.co/embeds/lineup.js")
      && !scriptSetsSrc(`// see "https://sfosl19.dostff.co/embeds/lineup.js"`, "https://sfosl19.dostff.co/embeds/lineup.js")
      && !scriptSetsSrc(mainJs.replace("lineup.js", "lineup.js?v=2"), "https://sfosl19.dostff.co/embeds/lineup.js"),
      "a site script must set a <script>'s src to the widget's own address, whole");
    ok(embedPageOk("lightning-in-a-bottle", "20181121121544", { url: "https://lightninginabottle.org/lineup/", captureTimestamp: "20181104142540" })
      && !embedPageOk("lightning-in-a-bottle", "20181121121544", { url: "https://lightninginabottle.org/lineup/", captureTimestamp: "20180904142540" })
      && !embedPageOk("lightning-in-a-bottle", "20181121121544", { url: "https://sfoutsidelands.com/lineup/", captureTimestamp: "20181121121540" })
      && !embedPageOk("outside-lands", "20230814134825", { url: "https://sfoutsidelands.com/lineup/", captureTimestamp: "20230613134825" })
      && embedPageOk("outside-lands", "20190820205437", { url: "https://www.sfoutsidelands.com/lineup/", captureTimestamp: "20190824062635", via: { url: "https://www.sfoutsidelands.com/assets/js/dist/main.js?v=1", captureTimestamp: "20190824062646" } })
      && !embedPageOk("outside-lands", "20190820205437", { url: "https://www.sfoutsidelands.com/lineup/", captureTimestamp: "20190824062635", via: { url: "https://cdn.example.com/assets/main.js", captureTimestamp: "20190824062646" } })
      && !embedPageOk("coachella", "20230814134825", { url: "https://www.coachella.com/lineup/", captureTimestamp: "20230814134820" }),
      "a widget's lineup page must be its own festival's, captured within that festival's window of the script");
    // EDC Las Vegas's 2012 and 2013 music pages: one page prints every day by
    // stage, each day's heading with no year; a time before noon is the night.
    const im12Day = (cls, label, acts, host = "") => `<div class="lineup-day ${cls}"><h2>${label}</h2><div class="inner">${host}`
      + acts.map(([a, t]) => `<h3 class="no-date"><a href="artist.php?id=1">${a}</a></h3><p class="set-time">${t}</p><div class="artist-divider"></div>`).join("") + `</div></div>`;
    const im12Stage = (name, d1, d2) => `<div class="stage-group group"><h3 class="all-stage-title">${name}</h3>${im12Day("friday", "Friday - June 8th", d1, `<h3 class="sponsor">Hosted By: Dim Mak</h3>`)}${im12Day("saturday", "Saturday - June 9th", d2)}</div>`;
    const im12Main = [["Late &amp; Act", "12:00AM - 1:30AM"], ["Opener", "9:00PM - 10:00PM"], ["Closer", "4:30AM - 5:30AM"]];
    const im12 = (main = im12Main, title = "Music - Electric Daisy Carnival 2012 - Presented by Insomniac Events", og = "http://electricdaisycarnival.com/LasVegas/music.php") =>
      `<title>${title}</title><meta property="og:url" content="${og}"><ul id="lineup-nav"><li><a href="music.php?stage=kineticfield">kineticFIELD</a></li><li><a href="music.php?stage=basspod">bassPOD</a></li><li><a href="music.php?stage=all">All Stages</a></li></ul>`
      + im12Stage("kineticFIELD", main, [["Sat One", "8:00PM - 9:00PM"]]) + im12Stage("bassPOD", [["Bass One", "10:00PM - 11:15PM"]], [["Bass Two", "11:00PM - 12:30AM"]]) + `<!-- end #lineup-inner -->`;
    const imp = parseInsomniacMusic(im12(), { year: 2012 });
    ok(JSON.stringify([imp.template, imp.yearFrom, imp.place, imp.stages, imp.days.map(d => [d.date, d.label, d.hosts, d.sets.map(x => [x.stage, x.start, x.end, x.artist])])])
      === JSON.stringify(["2012", "the page's title", "the page's own og:url", ["kineticFIELD", "bassPOD"], [
        ["2012-06-08", "Friday - June 8th", ["kineticFIELD: Dim Mak", "bassPOD: Dim Mak"], [["kineticFIELD", "21:00", "22:00", "Opener"], ["kineticFIELD", "00:00", "01:30", "Late & Act"], ["kineticFIELD", "04:30", "05:30", "Closer"], ["bassPOD", "22:00", "23:15", "Bass One"]]],
        ["2012-06-09", "Saturday - June 9th", [], [["kineticFIELD", "20:00", "21:00", "Sat One"], ["bassPOD", "23:00", "00:30", "Bass Two"]]]]]),
      `an EDC 2012 music page must come back set by set, a time before noon the night's: ${JSON.stringify(imp)}`);
    const im13Art = (a, t, b = a, u = t) => `<div class="artist"><div class="top-wrap"><h3><span>${a}<br><em>${t}</em></span></h3></div><div class="bottom-wrap"><h4>${b}<br><span>${u}</span></h4></div></div>`;
    const im13 = (art = im13Art("Borgore", "4:30AM - 5:30AM")) => `<title>Music - Experience - Electric Daisy Carnival Las Vegas - Presented by Insomniac Events</title>`
      + `<meta name="description" content="The official website of Electric Daisy Carnival Las Vegas - Friday June 21st, Saturday June 22nd 2013">`
      + `<a href="#" class="stage stage-all" data-filter="stage-all">All Stages</a><a href="#" class="stage stage-kineticfield" data-filter="stage-">kineticFIELD</a><!-- STAGE SORT -->`
      + `<div class="stage clearfix stage-all stage-kineticfield"><h3>kineticFIELD</h3><div class="day"><h5>Fri - June 21st <div class="host hard"><span>Hosted by</span></div></h5>${art}${im13Art("Dada Life", "3:30AM - 4:30AM")}</div>`
      + `<div class="day"><h5>Sat - June 22nd</h5>${im13Art("Kaskade", "2:00AM - 3:30AM")}${im13Art("Kaskade", "2:00AM - 3:30AM")}</div></div><!-- END STAGE SORT -->`;
    const imq = parseInsomniacMusic(im13(), { year: 2013 });
    ok(JSON.stringify([imq.template, imq.yearFrom, imq.place, imq.days.map(d => [d.date, d.hosts, d.repeats, d.sets.map(x => [x.start, x.end, x.artist])])])
      === JSON.stringify(["2013", "the page's description", "the page's title", [["2013-06-21", ["kineticFIELD: hard"], 0, [["03:30", "04:30", "Dada Life"], ["04:30", "05:30", "Borgore"]]], ["2013-06-22", [], 1, [["02:00", "03:30", "Kaskade"]]]]]),
      `an EDC 2013 music page must read both copies of a block and drop a repeat: ${JSON.stringify(imq)}`);
    const imOut = (html, year) => parseInsomniacMusic(html, { year }).days.flatMap(d => d.misprints.map(x => `${x.artist}: ${x.misprint}`)).join("; ");
    ok(imOut(im13(im13Art("Borgore", "4:30AM - 5:30AM", "Borgore", "4:00AM - 5:30AM")), 2013) === "Borgore: the block prints two readings (Borgore 4:30AM - 5:30AM / Borgore 4:00AM - 5:30AM)"
      && imOut(im12([["Clash A", "10:00PM - 11:00PM"], ["Clash B", "10:30PM - 11:30PM"]]), 2012) === "Clash A: printed while another set on the stage is still on; Clash B: printed while another set on the stage is still on"
      && imOut(im12([["Back", "11:00PM - 10:00PM"]]), 2012) === "Back: the range runs backwards",
      "an EDC block whose readings disagree, two sets at once, or a backwards range must be a misprint, never a set");
    ok(insomniacDate("Friday - June 8th", 2012) === "2012-06-08" && insomniacDate("Fri - June 21st", 2013) === "2013-06-21" && insomniacDate("Fri - June 8th", 2013) === null && insomniacDate("Friday - June 8rd", 2012) === null,
      "an EDC day heading must print its own weekday and ordinal");
    const imMust = (what, html, year = 2012) => { let bad = false; try { parseInsomniacMusic(html, { year }); } catch { bad = true; } mutations++; ok(bad, `mutation not caught: ${what}`); };
    imMust("an EDC page of another year", im12(), 2013);
    imMust("an EDC page that does not name Las Vegas", im12(undefined, undefined, "http://electricdaisycarnival.com/Orlando/music.php"));
    imMust("an EDC page of another festival", im12(undefined, "Music - Beyond Wonderland 2012"));
    imMust("an EDC 2013 page whose description names another year", im13().replace("June 22nd 2013", "June 22nd 2014"), 2013);
    imMust("an EDC heading whose weekday is not its date", im12().replace("Friday - June 8th", "Thursday - June 8th"));
    imMust("an EDC page skipping a day", im12().replaceAll("Saturday - June 9th", "Sunday - June 10th").replaceAll('lineup-day saturday', 'lineup-day sunday'));
    imMust("an EDC day class that is not its heading's weekday", im12().replace('lineup-day saturday', 'lineup-day sunday'));
    imMust("an EDC range with no meridiem", im12([["Opener", "9:00 - 10:00PM"]]));
    imMust("an EDC stage menu that is not its stages", im12().replace("bassPOD</a>", "bassPOD</a></li><li><a href=\"music.php?stage=neongarden\">neonGARDEN</a>"));
    imMust("an EDC stage printing other days", im12().replace("Saturday - June 9th</h2><div class=\"inner\"><h3 class=\"no-date\"><a href=\"artist.php?id=1\">Bass Two", "Sunday - June 10th</h2><div class=\"inner\"><h3 class=\"no-date\"><a href=\"artist.php?id=1\">Bass Two"));
    imMust("an EDC act heading with no set time", im12().replace('<p class="set-time">9:00PM - 10:00PM</p>', ""));
    imMust("an EDC 2013 block with one reading", im13(`<div class="artist"><h3><span>Borgore<br><em>4:30AM - 5:30AM</em></span></h3></div>`), 2013);
    imMust("an EDC 2013 page with no stage sort", im13().replace("<!-- STAGE SORT -->", ""), 2013);
    // Shambhala's 2024-2025 Webflow day page: the weekday in its title and
    // active tab, a "Last Published" stamp, an hour axis from 10 AM, and one
    // column per stage whose blocks carry each range three ways.
    const swH = h => `${h % 12 || 12} ${h % 24 < 12 ? "am" : "pm"}`;
    const swAxis = `<div class="time-column">` + Array.from({ length: 24 }, (_, i) => `<div class="time-marker">${swH(10 + i)}</div>`).join("") + `</div>`;
    const sw12 = t => { const [h, m] = t.split(":").map(Number); return `${h % 12 || 12}:${String(m).padStart(2, "0")} ${h < 12 ? "am" : "pm"}`; };
    const swBlock = (name, a, b, { top, height, hidden = "", print } = {}) => {
      const rel = t => { const [h, m] = t.split(":").map(Number); return ((h * 60 + m - 600) + 1440) % 1440; };
      const x = rel(a), y = rel(b) || 1440;
      return `<div role="listitem" class="playing-time w-dyn-item" style="top: ${top ?? Math.floor(x * 70 / 60)}px; min-height: ${height ?? (y - x) * 70 / 60 - 2}px;"><div class="pt-time"><div data-start="${a}" class="time">${print?.[0] ?? sw12(a)}</div><div>-</div><div data-end="${b}" class="time">${print?.[1] ?? sw12(b)}</div></div><div class="pt-body"><h3 class="pt-artist">${name}</h3>${hidden}</div></div>`;
    };
    const swCol = (cls, head, blocks) => `<div class="playing-times-column${cls ? ` ${cls}` : ""}">${head}<div class="playing-times w-dyn-list"><div role="list" class="w-dyn-items">${blocks.join("")}</div></div></div>`;
    const swCols = [swCol("", `<img src="https://cdn.example/amp_logo.png" loading="lazy" alt="AMP stage" class="stage-logo-set">`, [swBlock("Opener", "12:00", "13:00"), swBlock("Late &amp; Co", "23:00", "00:30"), swBlock("Sunrise", "07:00", "09:00")]),
      swCol("village", `<img src="https://cdn.example/village.png" loading="lazy" alt="The Village stage" class="stage-logo-set">`, [swBlock("Show", "15:00", "16:00", { hidden: `<h3 class="pt-artist w-condition-invisible">Guest</h3>` }), swBlock("Show", "15:00", "16:00"), swBlock("Twin A", "22:00", "23:00"), swBlock("Twin B", "22:00", "23:00"), swBlock("???? B2B ???", "04:00", "05:00")]),
      swCol("secret-garden", `<img src="https://cdn.example/Secret_Garden.png" loading="lazy" alt="The Village stage" class="stage-logo-set">`, [swBlock("Morning Class", "11:00", "12:30")]),
      swCol("grove", `<h2 class="stage-heading">Grove</h2>`, [])];
    const swPage = ({ title = "Set Times - Friday | Shambhala Music Festival 2023", tab = "friday", pub = "Tue Sep 17 2024 13:51:15", axis = swAxis, cols = swCols } = {}) =>
      `<html data-wf-page="x"><!-- Last Published: ${pub} GMT+0000 (Coordinated Universal Time) --><head><title>${title}</title></head><body><a href="/set-times/${tab}" aria-current="page" class="w--current">Day</a>`
      + axis + `<div class="playing-times-grid">` + cols.join("") + `</div></body></html>`;
    const swLogo = { "secret-garden": "Secret Garden" };
    const swp = parseShambhalaWebflow(swPage(), { year: 2024, stageByLogo: swLogo });
    ok(JSON.stringify([swp.weekday, swp.published, swp.axis, swp.pxPerHour, swp.stages, swp.blank, swp.renamed, swp.sets.map(x => [x.stage, x.start, x.end, x.artist]), swp.misprints.map(x => x.artist), swp.repeats.map(x => x.artist), swp.unnamed.map(x => x.artist)])
      === JSON.stringify(["Friday", "2024-09-17", "10:00-09:00", 70, ["AMP", "The Village", "Secret Garden"], ["Grove"], [{ column: "secret-garden", printed: "The Village", as: "Secret Garden" }],
        [["AMP", "12:00", "13:00", "Opener"], ["AMP", "23:00", "00:30", "Late & Co"], ["AMP", "07:00", "09:00", "Sunrise"], ["The Village", "15:00", "16:00", "Show"], ["Secret Garden", "11:00", "12:30", "Morning Class"]],
        ["Twin A", "Twin B"], ["Show"], ["???? B2B ???"]]),
      `a Shambhala day page must come back set by set past midnight, a repeated block once, two acts in one slot misprints and a mystery set unnamed: ${JSON.stringify(swp)}`);
    ok(JSON.stringify(shambhalaRun("July 26-29, 2024", 2024)) === JSON.stringify({ Thursday: "2024-07-25", Friday: "2024-07-26", Saturday: "2024-07-27", Sunday: "2024-07-28" })
      && shambhalaRun("July 25th to 28th, 2025", 2025)?.Friday === "2025-07-25" && shambhalaRun("July 26-29, 2024", 2025) === null && shambhalaRun("July 27-30, 2024", 2024) === null && shambhalaRun("July 26-28, 2024", 2024) === null,
      "a Shambhala run must be printed for its year, Friday to Monday");
    ok(readDatesPost("<p>Shambhala returns <b>July 26-29, 2024</b></p><p>See you July 26-29, 2024!</p>", 2024).days.Sunday === "2024-07-28", "a Shambhala dated post must read its run");
    const swPostMust = (what, html) => { let bad = false; try { readDatesPost(html, 2024); } catch { bad = true; } mutations++; ok(bad, `mutation not caught: ${what}`); };
    swPostMust("a Shambhala post that prints two runs that disagree", "<p>July 26-29, 2024</p><p>August 2-5, 2024</p>");
    swPostMust("a Shambhala post that prints no run in the year", "<p>July 25th to 28th, 2025</p>");
    const swMust = (what, html, year = 2024, logo = swLogo) => { let bad = false; try { const p = parseShambhalaWebflow(html, { year, stageByLogo: logo }); bad = p.misprints.length !== 2 || p.sets.length !== 5; } catch { bad = true; } mutations++; ok(bad, `mutation not caught: ${what}`); };
    swMust("a Shambhala page published in another year", swPage(), 2025);
    swMust("a Shambhala page whose active tab is not its title's day", swPage({ tab: "saturday" }));
    swMust("a Shambhala page whose title names no weekday", swPage({ title: "Set Times | Shambhala Music Festival" }));
    swMust("a Shambhala axis that skips an hour", swPage({ axis: swAxis.replace(">1 pm<", ">2 pm<") }));
    swMust("a Shambhala axis that starts at 11 AM", swPage({ axis: swAxis.replace('<div class="time-marker">10 am</div>', "") }));
    swMust("two Shambhala columns with one name", swPage(), 2024, {});
    swMust("a Shambhala column renamed against its logo", swPage({ cols: [swCols[0], swCols[1], swCols[2].replace("Secret_Garden.png", "Village.png"), swCols[3]] }));
    swMust("a Shambhala block drawn an hour late", swPage({ cols: [swCols[0].replace("top: 140px", "top: 210px"), ...swCols.slice(1)] }));
    swMust("a Shambhala block drawn too tall", swPage({ cols: [swCols[0].replace("min-height: 68px", "min-height: 80px"), ...swCols.slice(1)] }));
    swMust("a Shambhala printed time that is not its data", swPage({ cols: [swCols[0].replace(">12:00 pm<", ">12:30 pm<"), ...swCols.slice(1)] }));
    swMust("a Shambhala block with two shown names", swPage({ cols: [swCols[0].replace("<h3 class=\"pt-artist\">Opener</h3>", "<h3 class=\"pt-artist\">Opener</h3><h3 class=\"pt-artist\">Other</h3>"), ...swCols.slice(1)] }));
    // Coachella's lineup cards (2016's two divs, 2015's one span): every set
    // open-ended, a card with no set unscheduled, an entry without its time
    // or stage incomplete, and nothing read off data-weekend.
    const coSep = `<span class="sep">|</span>`;
    const coCard = (id, name, lis, attr = "data-artistid") => `<div class="artist" ${attr}="${id}"><div class="artist-info">\n<h1>${name}</h1><ul class="artist-links"><li>x</li></ul><ul class="event-list"><strong>Login</strong>${lis}</ul></div></div>`;
    const coLi16 = (date, time, stage) => `<li data-eventid="1" data-weekend="1"><div class="perf-date">\n${date}\t</div><div class="perf-time-loc">${time}${coSep}\n ${stage}</div><div class="mylineup-buttons"></div></li>`;
    const coLi15 = (...parts) => `<li data-event-id="2" data-weekend="2"><span class="add-text">${parts.join(` ${coSep} `)} </span></li>`;
    const coPage = coCard(1, "Act &amp; One", coLi16("Friday, April 15, 2016", "06:10PM", "Sahara") + coLi16("Friday, April 22, 2016", "12:00AM", "Sahara"))
      + coCard(2, "Host Only", "") + coCard(3, "Later Act", coLi16("Saturday, April 16, 2016", "11:00AM", "Yuma"));
    const cp = parseCoachella(coPage, { year: 2016 });
    ok(JSON.stringify(cp.days.map(d => [d.date, d.label, d.sets.map(x => [x.stage, x.start, x.end, x.artist, x.openEnd])])) === JSON.stringify([
      ["2016-04-15", "Friday, April 15, 2016", [["Sahara", "18:10", "", "Act & One", true]]],
      ["2016-04-16", "Saturday, April 16, 2016", [["Yuma", "11:00", "", "Later Act", true]]],
      ["2016-04-22", "Friday, April 22, 2016", [["Sahara", "00:00", "", "Act & One", true]]]]) && cp.unscheduled.join() === "Host Only",
      `Coachella cards read wrong: ${JSON.stringify(cp)}`);
    const cp15 = parseCoachella(coCard(5, "Span Act", coLi15("Saturday, April 19, 2014", "09:50PM", "Sahara") + coLi15("Saturday, April 19, 2014", "Gobi") + coLi15("Saturday, April 19, 2014", "11:30PM", ""), "data-artist-id"), { year: 2014 });
    ok(cp15.days.length === 1 && cp15.days[0].sets.length === 1 && cp15.days[0].sets[0].start === "21:50"
      && JSON.stringify(cp15.days[0].incomplete.map(x => [x.stage, x.start])) === JSON.stringify([["Gobi", ""], ["", "23:30"]]), `Coachella span cards read wrong: ${JSON.stringify(cp15)}`);
    const coMust = (what, html, year = 2016) => { let bad = false; try { parseCoachella(html, { year }); } catch { bad = true; } mutations++; ok(bad, `mutation not caught: ${what}`); };
    coMust("a Coachella date from another year", coPage, 2017);
    coMust("a Coachella date whose weekday is wrong", coPage.replace("Friday, April 15, 2016", "Saturday, April 15, 2016"));
    coMust("a Coachella time that is not a clock time", coPage.replace("06:10PM", "TBA"));
    coMust("a Coachella set with no stage in the 2016 layout", coPage.replace(`${coSep}\n Sahara`, `${coSep}\n `));
    coMust("a Coachella card with no name", coPage.replace("<h1>Later Act</h1>", ""));
    coMust("a Coachella page with no cards", "<div>nothing</div>");
    // Coachella 2017's lineup data: start and end where the data has them,
    // open-ended without an end, incomplete with no start, a TBD stage or a
    // bare 00:00 start, one set for an act listed twice under two spellings.
    const coEv = (date, label, start, end, loc) => ({ event_date: date, date_time: label, start_time: start, end_time: end, location: loc, start_time_display: "" });
    const coAct = (name, w1, w2 = false) => ({ id: "1", name, festival_year: "2017", events: { weekend1: w1, weekend2: w2 } });
    const coData = acts => `<lineup-listing v-bind:artists="${JSON.stringify(acts).replace(/&/g, "&amp;").replace(/"/g, "&quot;")}"></lineup-listing>`;
    const fri17 = "Friday, April 14, 2017";
    const coActs = [coAct("R&oacute;is&iacute;n Murphy", coEv("2017-04-14", fri17, "18:00:00", "18:50:00", "Gobi")),
      coAct("Late Act", coEv("2017-04-14", fri17, "23:35:00", null, "Sahara")),
      coAct("No Time", coEv("2017-04-14", fri17, null, null, "Do Lab")), coAct("Unplaced", coEv("2017-04-14", fri17, "20:00:00", "21:00:00", "TBD")),
      coAct("Midnight Blank", coEv("2017-04-14", fri17, "00:00:00", null, "Mojave")),
      coAct("Shannon & the Clams", coEv("2017-04-14", fri17, "17:00:00", "17:50:00", "Sonora")), coAct("Shannon and the Clams", coEv("2017-04-14", fri17, "17:00:00", "17:50:00", "Sonora")),
      coAct("Host Only", false)];
    const cd = parseCoachellaData(coData(coActs), { year: 2017 });
    ok(JSON.stringify(cd.days.map(d => [d.date, d.sets.map(x => [x.stage, x.start, x.end, x.artist, !!x.openEnd]), d.incomplete.map(x => x.artist), d.duplicates, d.respelled])) === JSON.stringify([
      ["2017-04-14", [["Gobi", "18:00", "18:50", "Róisín Murphy", false], ["Sahara", "23:35", "", "Late Act", true], ["Sonora", "17:00", "17:50", "Shannon & the Clams", false]],
        ["No Time", "Unplaced", "Midnight Blank"], 1, ["Shannon and the Clams = Shannon & the Clams"]]]) && cd.unscheduled.join() === "Host Only",
      `Coachella 2017 data read wrong: ${JSON.stringify(cd)}`);
    const cdMust = (what, acts, year = 2017) => { let bad = false; try { parseCoachellaData(typeof acts === "string" ? acts : coData(acts), { year }); } catch { bad = true; } mutations++; ok(bad, `mutation not caught: ${what}`); };
    cdMust("a Coachella 2017 data page read as another year", coActs, 2016);
    cdMust("a Coachella 2017 event whose printed date is not its event_date", [coAct("A", coEv("2017-04-15", fri17, "18:00:00", "19:00:00", "Gobi"))]);
    cdMust("a Coachella 2017 time that is not a clock time", [coAct("A", coEv("2017-04-14", fri17, "6pm", "19:00:00", "Gobi"))]);
    cdMust("a Coachella 2017 act with a name entity the reader does not know", [coAct("A&eth;", coEv("2017-04-14", fri17, "18:00:00", "19:00:00", "Gobi"))]);
    cdMust("a Coachella 2017 page with no lineup data", "<div>nothing</div>");
    // Coachella 2012's hidden overlays: "date | time | stage" lines, a TBD
    // line incomplete, every set open-ended.
    const coOv = (id, name, lines, yr = "2012") => `<div class="artist-overlay" id="artist-${id}">\n<div class="artist-info">\n<h1 style="x">${name}</h1>\n<p class="artist-text-currentyear">${yr} Appearance</p><p class="artist-text">${lines.join("<br>")}</p></div></div>`;
    const ovPage = coOv(60, "Gary Clark Jr.", ["Friday April 13th | TBD", "Friday April 20th | 4:30pm | Gobi"]) + coOv(61, "Dr. Dre &amp; Snoop Dogg", ["Sunday April 15th | 10:55pm | Main Stage"]);
    const ov = parseCoachella2012(ovPage, { year: 2012 });
    ok(JSON.stringify(ov.days.map(d => [d.date, d.sets.map(x => [x.stage, x.start, x.end, x.artist, x.openEnd]), d.incomplete.map(x => x.printed)])) === JSON.stringify([
      ["2012-04-13", [], ["Friday April 13th | TBD"]], ["2012-04-15", [["Main Stage", "22:55", "", "Dr. Dre & Snoop Dogg", true]], []],
      ["2012-04-20", [["Gobi", "16:30", "", "Gary Clark Jr.", true]], []]]), `Coachella 2012 overlays read wrong: ${JSON.stringify(ov)}`);
    const ovMust = (what, html, year = 2012) => { let bad = false; try { parseCoachella2012(html, { year }); } catch { bad = true; } mutations++; ok(bad, `mutation not caught: ${what}`); };
    ovMust("a Coachella 2012 overlay for another year's appearances", coOv(1, "A", ["Friday April 13th | 4:30pm | Gobi"], "2011"));
    ovMust("a Coachella 2012 date whose weekday is wrong", ovPage.replace("Friday April 20th", "Saturday April 20th"));
    ovMust("a Coachella 2012 time that is not a clock time", ovPage.replace("4:30pm", "late"));
    ovMust("a Coachella 2012 line with no stage", ovPage.replace(" | Gobi", ""));
    ovMust("a Coachella 2012 page with no overlays", "<div>nothing</div>");
    ok(datedLabel("Friday 19 July 2019", 2019) === "2019-07-19" && datedLabel("Friday 19 July 2019", 2018) === null, "a European day label must print the edition year");
    ok(stageFor({ stageAs: { "The Rose Garden": "Rose Garden" } }, "The Rose Garden") === "Rose Garden", "stageAs may drop a leading The");
    let theRename = false; try { stageFor({ stageAs: { "The Library": "Library Bar" } }, "The Library"); } catch { theRename = true; }
    mutations++; ok(theRename, "mutation not caught: a stageAs map that renames a stage past its leading The");
    const o23 = editions["edc-orlando-2023"], sa23 = m => m.provenance.captures.find(c => c.stagesAs);
    if (o23) {
      mustFail("a stagesAs map that renames a stage", m => { sa23(m).stagesAs.rynobusARTCAR = "Rynobus"; }, o23, undefined, /renames the stage/);
      mustFail("a stagesAs target that is not a stage of the edition", m => { m.stages[5].name = "Anniversary Stage"; }, o23, undefined, /not a stage of the edition/);
    }
    // A graphic's styled stage name carried onto the page printing is recorded.
    const sa = editions["edc-orlando-2023"]?.stages.map(s => s.name).join("|");
    ok(sa === "Kinetic Field|Circuit Grounds|Neon Garden|Stereo Bloom|Rynobus Art Car|Anniversary Art Car", `Orlando 2023's day-2 graphic stages must join the pages' six: ${sa}`);
  }
  // Founder ruling 2: the Bonus Tracks stage is dropped whole. Every printed
  // Bonus Tracks row is put back on a restored stage, and a stage renamed to
  // it (with its sets intact) must fail too.
  for (const id of ["acl-2025", "lollapalooza-2025"]) {
    const e = editions[id]; if (!e) continue;
    const rows = droppedFor(id).filter(r => r.category === "bonus-tracks-stage");
    ok(rows.length > 0, `${id}: no Bonus Tracks rows recorded as dropped`);
    for (const r of rows) mustFail(`${id} Bonus Tracks row "${r.billing}" back on its stage`, m => {
      const st = { id: `${id}:bonus-tracks`, name: r.stage }, a = { id: `${id}:${artistKey(r.billing)}-bt`, name: r.billing, key: artistKey(r.billing), performers: performerKeys(r.billing) };
      m.stages.push(st); m.artists.push(a);
      m.sets.push({ id: `${id}:d${r.day}:bonus-tracks:${r.start.replace(":", "")}:${artistKey(r.billing)}`, artistId: a.id, day: r.day, stageId: st.id, start: r.start, end: r.end });
    }, e, undefined, /: dropped bonus-tracks-stage /);
    mustFail(`${id}: a kept stage renamed BONUS TRACKS`, m => { m.stages[0].name = "BONUS TRACKS"; }, e, undefined, /: dropped bonus-tracks-stage /);
  }
  // official_sources (Escape): every receipt rule is proven live on a real
  // edition. 2024 is all re-hosted graphics; 2019 mixes a next-year Wayback
  // page (day 1) with a re-hosted graphic (day 2).
  const e24 = editions["escape-halloween-2024"], e19 = editions["escape-halloween-2019"];
  ok(e24 && e19, "the Escape 2024 and 2019 editions must exist for the official_sources mutations");
  if (e24 && e19) {
    const g = m => m.provenance.captures.find(c => c.kind === "graphic");
    const pg = m => m.provenance.captures.find(c => c.kind === "page");
    mustFail("graphic from a non-approved host (Clashfinder)", m => { g(m).imageUrl = "https://clashfinder.com/s/escape2024/x.png"; }, e24, undefined, /approved re-host/);
    mustFail("re-host published after the edition's last day", m => { g(m).published = "2024-11-10"; }, e24, undefined, /re-host published/);
    mustFail("re-host published in another year", m => { g(m).published = "2023-10-18"; }, e24, undefined, /re-host published/);
    mustFail("graphic with no page it was found on", m => { delete g(m).foundAt; }, e24, undefined, /found on/);
    mustFail("graphic with no re-host named", m => { delete g(m).rehostedBy; }, e24, undefined, /re-hosted/);
    mustFail("graphic with no printed header", m => { delete g(m).printed; }, e24, undefined, /printed header/);
    mustFail("graphic with no fetch date", m => { delete g(m).fetchedAt; }, e24, undefined, /fetch date/);
    mustFail("graphic whose hash is not the reviewed file", m => { g(m).sha256 = "0".repeat(64); }, e24, undefined, /review manifest/);
    mustFail("a source claims one row more than it printed", m => { g(m).rows += 1; }, e24, undefined, /sources account/);
    mustFail("a source of unknown kind", m => { g(m).kind = "screenshot"; }, e24, undefined, /neither page nor graphic/);
    mustFail("a day left with no source", m => { m.provenance.captures = m.provenance.captures.filter(c => c.day !== 2); }, e24, undefined, /day 2: no source/);
    mustFail("a page capture two years after the edition", m => { const c = pg(m); c.archivedUrl = c.archivedUrl.replace("/web/2020", "/web/2021"); c.captureTimestamp = c.captureTimestamp.replace(/^2020/, "2021"); }, e19, undefined, /not from 2019 or the year after/);
    mustFail("a page capture timestamp that is not its URL's", m => { pg(m).captureTimestamp = "20200101000000"; }, e19, undefined, /captureTimestamp/);
    mustFail("a page whose day tab prints another day", m => { pg(m).printed = "Saturday, October 26"; }, e19, undefined, /day tab/);
    mustFail("a page capture from a non-official host", m => { const c = pg(m); c.archivedUrl = c.archivedUrl.replace("escapehalloween.com", "edmidentity.com"); }, e19, undefined, /not an official escape-halloween property/);
    // Completeness against the receipt pages: Orlando 2017's essentials post
    // carries a Corona Electric Beach graphic beside the main one, and Escape
    // 2025's carries a pre-party and an afterparty graphic it excludes.
    const o17 = editions["edc-orlando-2017"], e25 = editions["escape-halloween-2025"];
    const eb = c => /electricbeach2017/.test(c.receipt?.cites || "");
    ok(o17?.provenance.captures.filter(eb).length === 2 && e25?.provenance.notUsedGraphics?.length === 2, "Orlando 2017 must cite its Corona Electric Beach graphic on both days, and Escape 2025 must exclude 2 graphics");
    if (o17 && e25) {
      mustFail("Orlando 2017 without its Corona Electric Beach source", m => { m.provenance.captures = m.provenance.captures.filter(c => !eb(c)); }, o17, undefined, /shows set-times graphic wp-content\/uploads\/2017\/11\/electricbeach2017, which no source uses/);
      mustFail("Escape 2025 with its afterparty exclusion removed", m => { m.provenance.notUsedGraphics = m.provenance.notUsedGraphics.filter(n => !/after-party/.test(n.cites)); }, e25, undefined, /official-after-party, which no source uses/);
      mustFail("an exclusion with no reason", m => { delete m.provenance.notUsedGraphics[0].reason; }, e25, undefined, /notUsedGraphics .* has no reason/);
      mustFail("an exclusion naming a graphic on no receipt page", m => { m.provenance.notUsedGraphics[0].cites = "wp-content/uploads/2025/10/other"; }, e25, undefined, /notUsedGraphics wp-content\/uploads\/2025\/10\/other/);
      mustFail("an exclusion of a graphic a source uses", m => { m.provenance.notUsedGraphics.push({ cites: "wp-content/uploads/2025/10/friday-set-times", reason: "x" }); }, e25, undefined, /notUsedGraphics .*friday-set-times/);
      mustFail("a receipt that does not list its page's graphics", m => { delete m.provenance.captures.find(c => c.kind === "graphic").receipt.setTimesGraphics; }, o17, undefined, /does not list the set-times graphics/);
      // An Instagram post is held to every slide: Dreamstate 2025's carousel
      // has 2 and the edition uses both.
      const d25 = editions["dreamstate-socal-2025"], ig = m => m.provenance.captures.filter(c => /instagram\.com/.test(c.foundAt || ""));
      ok(d25 && ig(d25).length && ig(d25).every(c => c.receipt.setTimesGraphics?.length === 2), "Dreamstate 2025 must list both slides of its Instagram post");
      if (d25) {
        mustFail("an Instagram post with a third slide no source uses", m => { for (const c of ig(m)) c.receipt.setTimesGraphics.push("999_999_999_n"); }, d25, undefined, /shows set-times graphic 999_999_999_n, which no source uses/);
        mustFail("an Instagram receipt with no slide list", m => { delete ig(m)[0].receipt.setTimesGraphics; }, d25, undefined, /does not list the set-times graphics/);
        // Slide lists from one post are unioned too: dropping the second
        // slide's sources and trimming a later list to its own slide still flags it.
        const slide2 = [...new Set(ig(d25).map(c => c.receipt.cites))][1];
        mustFail("Dreamstate 2025 without its second slide, a later same-post list naming only its own slide", m => {
          m.provenance.captures = m.provenance.captures.filter(c => c.receipt?.cites !== slide2);
          const last = ig(m).pop();
          last.receipt.setTimesGraphics = [last.receipt.cites];
        }, d25, undefined, new RegExp(`shows set-times graphic ${slide2}, which no source uses`));
      }
      mustFail("a receipt whose list leaves out the graphic it cites", m => { const r = m.provenance.captures.find(eb).receipt; r.setTimesGraphics = r.setTimesGraphics.filter(t => !/electricbeach/.test(t)); }, o17, undefined, /without the one it cites/);
      // Lists from sources sharing one receipt page are unioned: a later
      // source listing only its own graphic cannot hide the omitted beach one.
      mustFail("Orlando 2017 without its beach source, a later same-page source listing only its own graphic", m => {
        m.provenance.captures = m.provenance.captures.filter(c => !eb(c));
        const last = m.provenance.captures.filter(c => c.kind === "graphic" && c.receipt?.setTimesGraphics).pop();
        last.receipt.setTimesGraphics = last.receipt.setTimesGraphics.filter(t => sameGraphic(t, last.receipt.cites));
      }, o17, undefined, /shows set-times graphic wp-content\/uploads\/2017\/11\/electricbeach2017, which no source uses/);
    }
    // The header must print the cited day: the 2017 graphic's Saturday header
    // swapped for another edition's date fails, the real combined-day one passes.
    const e17 = editions["escape-halloween-2017"], g2 = m => m.provenance.captures.find(c => c.kind === "graphic" && c.day === 2);
    ok(e17 && g2(e17)?.printed === "SATURDAY · OCTOBER 27 & 28, 2017", "Escape 2017 day 2 must cite the combined-day graphic header");
    mustFail("Escape 2017 day 2's header swapped for SATURDAY OCTOBER 29 2022", m => { g2(m).printed = "SATURDAY OCTOBER 29 2022"; }, e17, undefined, /header .* does not print saturday 2017-10-28/);
    mustFail("Escape 2017 day 2 cited with day 1's header", m => { g2(m).printed = "FRIDAY · OCTOBER 27 & 28, 2017"; }, e17, undefined, /does not print saturday/);
    mustFail("a combined-day header listing a day the edition does not have", m => { g2(m).printed = "SATURDAY · OCTOBER 28 & 29, 2017"; }, e17, undefined, /does not print saturday/);
    // Source linkage: the page a graphic was found on must be a capture that
    // cites that graphic, and the review must name the same image.
    mustFail("an unrelated HTTPS found-at page", m => { g(m).foundAt = "https://example.com/escape-2024-set-times/"; }, e24, undefined, /found-at page example\.com|is not a capture of/);
    mustFail("a found-at EDM Identity post from another day", m => { g(m).foundAt = "https://edmidentity.com/2024/10/11/escape-halloween-2024-set-times/"; }, e24, undefined, /is not dated 2024-10-18/);
    mustFail("a graphic with no receipt capture", m => { delete g(m).receipt; }, e24, undefined, /no receipt capture/);
    mustFail("a receipt capture of another page", m => { const r = g(m).receipt; r.archivedUrl = r.archivedUrl.replace("escape-halloween-2024-set-times", "edc-orlando-2024-set-times"); }, e24, undefined, /is not a capture of/);
    mustFail("a receipt whose timestamp is not its URL's", m => { g(m).receipt.captureTimestamp = "20250101000000"; }, e24, undefined, /receipt captureTimestamp/);
    mustFail("a receipt that cites another image", m => { g(m).receipt.cites = "Gac-P1vWEAA_2dT"; }, e24, undefined, /receipt cites/);
    mustFail("a graphic whose image is swapped under its receipt", m => { g(m).imageUrl = "https://pbs.twimg.com/media/Gac-XXXXXXXXXXX?format=jpg&name=orig"; }, e24, undefined, /receipt cites/);
    // The festival's own Instagram post (Dreamstate 2023, 2025): the CDN host
    // is approved only with the post it belongs to as the page it was found on.
    const ds23 = editions["dreamstate-socal-2023"];
    ok(ds23, "the Dreamstate SoCal 2023 edition must exist for the Instagram-graphic mutations");
    if (ds23) {
      mustFail("an Instagram graphic that cites no post", m => { g(m).foundAt = "https://www.instagram.com/dreamstateusa/"; }, ds23, undefined, /must cite its post/);
      mustFail("an Instagram graphic found on a re-host page", m => { g(m).foundAt = "https://edmidentity.com/2023/11/15/dreamstate-socal-2023/"; }, ds23, undefined, /must cite its post/);
      mustFail("a graphic on a look-alike of Instagram's CDN", m => { g(m).imageUrl = "https://scontent.cdninstagram.com.example.net/x.jpg"; }, ds23, undefined, /approved re-host/);
      // Its receipt is that post's own embed, read on a recorded date.
      mustFail("an Instagram receipt from another post's embed", m => { g(m).receipt.url = "https://www.instagram.com/p/DRK5JIlkh91/embed/captioned/"; }, ds23, undefined, /is not the embed of/);
      mustFail("an Instagram receipt with no read date", m => { delete g(m).receipt.fetchedAt; }, ds23, undefined, /no read date/);
      // No printed date, none inferred: the post leaves published blank, but
      // a date it carries must still fall in the edition's year, and only an
      // Instagram post may leave it blank.
      ok(ds23.provenance.captures.filter(c => /instagram\.com/.test(c.foundAt || "")).every(c => c.published == null), "Dreamstate 2023's Instagram graphics must carry no inferred published date");
      mustFail("an Instagram graphic dated in another year", m => { g(m).published = "2022-11-15"; }, ds23, undefined, /re-host published/);
      // The exception is bound to the festival's own listed posts: the lane's
      // repro (an unrelated post, its embed, another account) still fails, and
      // so does the right post re-hosted by another account.
      const igCaps = m => m.provenance.captures.filter(c => /instagram\.com/.test(c.foundAt || ""));
      mustFail("an unrelated post by another account, undated", m => { for (const c of igCaps(m)) { c.foundAt = "https://www.instagram.com/p/UNRELATED_POST/"; c.receipt.url = "https://www.instagram.com/p/UNRELATED_POST/embed/captioned/"; c.rehostedBy = "Another Instagram account"; } }, ds23, undefined, /re-host published \(no date\)/);
      mustFail("the festival's post credited to another account, undated", m => { for (const c of igCaps(m)) c.rehostedBy = "Instagram (@someoneelse)"; }, ds23, undefined, /re-host published \(no date\)/);
      mustFail("a look-alike account handle, undated", m => { for (const c of igCaps(m)) c.rehostedBy = "Instagram (@dreamstateusa.fan)"; }, ds23, undefined, /re-host published \(no date\)/);
      mustFail("a non-Instagram re-host with no published date", m => { delete g(m).published; }, e24, undefined, /re-host published \(no date\)/);
      mustFail("an Instagram receipt citing another slide", m => { g(m).receipt.cites = "581251862_18534320416060183_3114781477568202383_n"; }, ds23, undefined, /receipt cites/);
    }
    {
      const r = clone(reviewFor(e24.id)); r.days[0].rowsConfirmed -= 1; mutations++;
      ok(validateEdition(clone(e24), { expected: expected[e24.id], review: r, dropped: droppedFor(e24.id) }).some(x => /rows confirmed/.test(x)), "mutation not caught: a graphic's review confirms fewer rows than it printed");
      const w = clone(reviewFor(e24.id)); w.days[0].imageUrl = "https://edmidentity.com/wp-content/uploads/2024/10/other.jpg"; mutations++;
      ok(validateEdition(clone(e24), { expected: expected[e24.id], review: w, dropped: droppedFor(e24.id) }).some(x => /names image/.test(x)), "mutation not caught: a review naming a different image than the graphic's");
      const u = clone(reviewFor(e24.id)); delete u.days[1].reviewer; mutations++;
      ok(validateEdition(clone(e24), { expected: expected[e24.id], review: u, dropped: droppedFor(e24.id) }).some(x => /not signed/.test(x)), "mutation not caught: an unsigned graphic review");
      mutations++;
      ok(validateEdition(clone(e24), { expected: expected[e24.id], review: undefined, dropped: droppedFor(e24.id) }).some(x => /no visual-review manifest/.test(x)), "mutation not caught: re-hosted graphics with no review manifest");
    }
    // A styled non-Latin billing is allowed only where it was read by eye.
    mustFail("DAKЯΣD's allowance carried to another edition", m => { m.artists[0].name = "DAKЯΣD"; }, editions["escape-halloween-2025"], undefined, /non-Latin/);
    // One act printed in two casings is one artist; the set keeps its printing.
    const nk = e19.artists.filter(a => a.key === "nukid"), nkSets = e19.sets.filter(s => s.artistId === nk[0]?.id);
    ok(nk.length === 1 && nkSets.length === 2 && nkSets.some(s => s.billing === "NUKID") && nk[0].name === "NuKid",
      `Escape 2019's NuKid (page) and NUKID (graphic) must be one artist with both sets, the graphic's set keeping its billing: ${JSON.stringify(nk)}`);
  }

  // The named kids-stage act the ruling keeps.
  const hc = editions["lollapalooza-2025"]?.artists.find(a => a.name === "SPECIAL GUEST: THE HAPPINESS CLUB");
  ok(hc && editions["lollapalooza-2025"].sets.filter(x => x.artistId === hc.id).map(x => x.day).join() === "3,4",
    "Lolla's named kids-stage act SPECIAL GUEST: THE HAPPINESS CLUB must stay, on days 3 and 4");
  mustFail("image-derived edition with no review manifest", m => { m.provenance.extractionMethod = "official_image_transcription"; m.provenance.captures.forEach(c => { c.pageArchivedUrl = c.archivedUrl; }); });
}

// An edition that is valid as lineup_only must be accepted without times.
if (base) {
  // A lineup page with no By Stage tab (Dreamstate, EDC Orlando): days, no stages.
  const noc = editions["nocturnal-wonderland-2025"];
  if (noc) {
    const lo = clone(noc);
    lo.stages = []; lo.artists.forEach(a => a.appearances.forEach(x => delete x.stageId));
    const exp = { ...expected[noc.id], stages: 0 };
    const p = validateEdition(lo, { expected: exp, dropped: [] });
    ok(p.length === 0, `a clean lineup_only edition without stages was rejected: ${p.join("; ")}`);
  }
}

// ── dropped rows and artist keys ──
{
  const led = { official: "x", days: [{ day: 1, archivedUrl: "u", chosen: "t", sha256: "h" }] };
  const rows = [
    { day: "1", stage: "Kinetic Field", start: "01:41", end: "01:47", artist: "Fireworks" },
    { day: "1", stage: "Kinetic Field", start: "01:47", end: "02:57", artist: "Illenium B2B SLANDER" },
    { day: "1", stage: "Ubuntu", start: "22:00", end: "23:30", artist: "Special Guest" },
    { day: "1", stage: "TITO'S HANDMADE VODKA", start: "20:00", end: "22:00", artist: "SILENT DISCO" },
    { day: "1", stage: "BONUS TRACKS", start: "14:30", end: "15:00", artist: "STRETCH BEFORE THE SET" },
    { day: "1", stage: "Bonus Tracks", start: "16:30", end: "17:00", artist: "GIGI PEREZ X TATIANA MIRANDA" },
    { day: "1", stage: "PERRY'S", start: "18:00", end: "18:30", artist: "BOB'S DANCE SHOP" },
    { day: "1", stage: "KIDZAPALOOZA", start: "16:00", end: "16:30", artist: "SPECIAL GUEST: THE HAPPINESS CLUB" },
    { day: "1", stage: "AUSTIN KIDDIE LIMITS", start: "15:00", end: "15:30", artist: "SCHOOL OF ROCK" },
  ];
  const e = buildEdition("edc-las-vegas-2025", rows, led), gone = droppedRows(rows);
  ok(JSON.stringify(e.artists.map(a => a.name)) === '["Illenium B2B SLANDER","SPECIAL GUEST: THE HAPPINESS CLUB","SCHOOL OF ROCK"]',
    `only billed acts survive the build (kids-stage acts included): ${e.artists.map(a => a.name).join(" | ")}`);
  ok(!("events" in e) && !e.stages.some(s => /BONUS|TITO|Ubuntu|PERRY/i.test(s.name)), "dropped rows leave no event and no stage behind");
  ok(JSON.stringify(gone.map(r => r.category)) === '["operational","unnamed-slot","operational","bonus-tracks-stage","bonus-tracks-stage","activity"]' && gone.every(r => r.reason),
    `every dropped row is recorded with its category and reason: ${JSON.stringify(gone.map(r => r.category))}`);
  ok(JSON.stringify(performerKeys("Illenium B2B SLANDER")) === '["illenium","slander"]', "B2B splits into performer keys");
  ok(JSON.stringify(performerKeys("Chase & Status")) === '["chase-and-status"]', "an act with & in its name stays one performer");
  ok(artistKey("RÜFÜS DU SOL") === artistKey("Rufus Du Sol"), "artist keys fold case and accents across editions");
}

// Every listed activity must match a printed row of its edition (a misspelt
// entry would silently drop nothing), and every recorded drop must be a row
// the sheet actually printed.
for (const [id, list] of Object.entries(ACTIVITIES)) {
  const printed = new Set(readSheet(H(`sheets/${id}.tsv`)).map(r => r.artist));
  for (const a of list) ok(printed.has(a), `${id}: listed activity "${a}" is not a printed row`);
}
for (const id of Object.keys(editions)) {
  if (editions[id].completeness === "lineup_only") {
    const printed = new Set(readSheet(H(`sheets/${id}.lineup.tsv`)).map(r => `${r.day}|${r.stage}|${r.artist}`));
    for (const r of droppedFor(id)) ok(printed.has(`${r.day || ""}|${r.stage || ""}|${r.billing}`) && r.reason, `${id}: recorded drop ${r.billing} is not a printed billing, or has no reason`);
    continue;
  }
  const printed = new Set(readSheet(H(`sheets/${id}.tsv`)).map(r => `${r.day}|${r.stage}|${r.start}|${r.artist}`));
  for (const r of droppedFor(id)) ok(printed.has(`${r.day}|${r.stage}|${r.start}|${r.billing}`) && r.reason, `${id}: recorded drop ${r.billing} is not a printed row, or has no reason`);
}

// ── dates come from the page, not from editions.mjs alone ──
const MONTH = ["JANUARY","FEBRUARY","MARCH","APRIL","MAY","JUNE","JULY","AUGUST","SEPTEMBER","OCTOBER","NOVEMBER","DECEMBER"];
// Numeric headers (Dreamstate's "FRI 11.17.23") read through the same
// graphicPrints as named ones; a printed year must be the edition's.
{
  const DS23 = ["2023-11-17", "2023-11-18"], DS25 = ["2025-11-21", "2025-11-22"], ORL22 = ["2022-11-11", "2022-11-12", "2022-11-13"];
  for (const [printed, date, year, dates, want] of [["FRI 11.17.23", "2023-11-17", 2023, DS23, true], ["BEATBOX ART CAR · SAT 11.22", "2025-11-22", 2025, DS25, true],
    ["FRIDAY NOV 11", "2022-11-11", 2022, ORL22, true], ["FRI 11.17.22", "2023-11-17", 2023, DS23, false], ["FRI 11.18.23", "2023-11-17", 2023, DS23, false],
    ["SAT 11.17.23", "2023-11-17", 2023, DS23, false], ["FRI 10.17.23", "2023-11-17", 2023, DS23, false], ["FRIDAY NOV 12", "2022-11-11", 2022, ORL22, false]])
    ok(graphicPrints(printed, date, year, dates) === want, `graphic header "${printed}" should ${want ? "" : "not "}print ${date}`);
}
for (const [id, e] of Object.entries(editions)) {
  const led = JSON.parse(readFileSync(H(`ledger/${id}.json`), "utf8")), rev = reviewFor(id);
  for (const d of e.days) {
    if (led.method === "official_lineup_html" && e.undated) {
      // An undated page printed no days: the festival's own home page, captured
      // in the edition's year, printed them in its title.
      const dp = led.datesPrinted, host = new URL(led.official).hostname.replace(/^www\./, "");
      ok(!!dp && dp.captureTimestamp.startsWith(String(e.year)) && new URL(dp.archivedUrl.replace(/^https:\/\/web\.archive\.org\/web\/\d+\//, "")).hostname.replace(/^www\./, "") === host
        && printedRange(dp.title)[d.day - 1] === d.date && printedRange(dp.title).length === e.days.length,
        `${id} day ${d.day}: ${d.date} is not what the festival's ${e.year} home page title printed ("${dp?.title}")`);
    } else if (led.method === "official_lineup_html" && led.format === "creamfields-artists") {
      // Creamfields' Artists page prints weekdays only: the chosen capture's
      // day filter names this day's weekday, and the date is the census's
      // dated run for the year, which the ledger's datesFrom must quote.
      const c = led.considered.find(x => x.captureTimestamp === led.chosen), wd = new Date(d.date + "T12:00:00Z").toLocaleDateString("en-US", { weekday: "long", timeZone: "UTC" });
      const cen = censusRow(led.datesFrom?.family, e.year), run = cen ? runDates(cen.range) : [];
      ok(c?.days?.[d.day - 1] === wd && c.filter.length === e.days.length && c.filter.includes(wd)
        && led.datesFrom?.census === CREAMFIELDS_CENSUS && led.datesFrom.family === e.festivalId && cen?.lifecycle === "occurred" && cen.dates === led.datesFrom.dates
        && run.length === e.days.length && run[d.day - 1] === d.date,
        `${id} day ${d.day}: ${d.date} is not the census's ${e.year} run (${cen?.dates}) or the page's weekday "${c?.days?.[d.day - 1]}"`);
    } else if (led.method === "official_lineup_html" && led.format === "creamfields-lineup") {
      // Creamfields' Lineup page names each day's weekday, and from 2024 its
      // date: the chosen capture's day must be this one, and the date the
      // census's dated run for the year, which the ledger's datesFrom quotes.
      const c = led.considered.find(x => x.captureTimestamp === led.chosen), wd = new Date(d.date + "T12:00:00Z").toLocaleDateString("en-US", { weekday: "long", timeZone: "UTC" });
      const cen = censusRow(led.datesFrom?.family, e.year), run = cen ? runDates(cen.range) : [];
      ok(c?.days?.[d.day - 1] === wd && c.days.length === e.days.length && (c.printedDates === null || (c.printedDates.length === e.days.length && c.printedDates[d.day - 1] === d.date))
        && led.datesFrom?.census === CREAMFIELDS_CENSUS && led.datesFrom.family === e.festivalId && cen?.lifecycle === "occurred" && cen.dates === led.datesFrom.dates
        && run.length === e.days.length && run[d.day - 1] === d.date,
        `${id} day ${d.day}: ${d.date} is not the census's ${e.year} run (${cen?.dates}) or the page's day "${c?.days?.[d.day - 1]} ${c?.printedDates?.[d.day - 1] ?? ""}"`);
    } else if (led.method === "official_lineup_html") {
      // The chosen capture's own By Day header for this day, as the ledger recorded it.
      const head = led.considered.find(c => c.captureTimestamp === led.chosen)?.days?.[d.day - 1] || "";
      ok(datedLabel(head, e.year) === d.date, `${id} day ${d.day}: ${d.date} is not what the archived lineup's By Day tab printed ("${head}")`);
    } else if (led.method === "structured_html") {
      ok(led.days.find(x => x.day === d.day)?.date === d.date, `${id} day ${d.day}: ${d.date} is not what the archived page's day tab printed`);
    } else if (led.method === "official_sources") {
      // Every source cited for a day prints that day: a page's own day tab,
      // or the header read off a graphic (weekday, month, day of month).
      const [, m, dd] = d.date.split("-").map(Number);
      const wd = new Date(d.date + "T12:00:00Z").toLocaleDateString("en-US", { weekday: "long", timeZone: "UTC" }).toUpperCase();
      const srcs = led.days.find(x => x.day === d.day)?.sources || [];
      ok(srcs.length > 0, `${id} day ${d.day}: no source in the ledger`);
      for (const s of srcs) {
        // Shambhala's tab prints the weekday alone; the date is the one its
        // table's first slot is written as (<td id="time_T">, T a UTC epoch).
        if (s.format === "shambhala-table") {
          const T = +/^time_(\d+)$/.exec(s.firstSlot || "")?.[1];
          ok(s.printed.toUpperCase() === wd && !!T && new Date(T * 1000).toISOString().slice(0, 10) === d.date,
            `${id} day ${d.day}: page ${s.captureTimestamp} prints "${s.printed}" with first slot ${s.firstSlot}, not ${wd} ${MONTH[m - 1]} ${dd}`);
          continue;
        }
        // Outside Lands' 2010-2011 planner prints no day tab: it writes each
        // set's start with its date as data.
        if (s.format === "myscheduler-data") {
          ok(s.printed === d.date && String(s.firstStart || "").startsWith(d.date + " "),
            `${id} day ${d.day}: page ${s.captureTimestamp} writes "${s.printed}" (first start ${s.firstStart}), not ${d.date}`);
          continue;
        }
        // Electric Forest's 2014-2015 Scheduler prints the month and day on
        // its tab ("June 25") and writes the date as the tab's target.
        if (s.format === "ef-scheduler") {
          ok(s.tabDate === d.date && s.printed === `${MONTH[m - 1][0]}${MONTH[m - 1].slice(1).toLowerCase()} ${dd}` && s.pxPerMinute > 0 && /^\d{2}:\d{2}$/.test(s.axisStart || ""),
            `${id} day ${d.day}: page ${s.captureTimestamp} prints "${s.printed}" for tab ${s.tabDate}, not ${MONTH[m - 1]} ${dd}`);
          continue;
        }
        // Tomorrowland's 2010-2012 line-up page prints its day as its own tab,
        // with no year, on the festival's own .be site.
        if (s.format === "tml-cms") {
          ok(tmlCmsDate(s.printed, e.year) === d.date && /^https:\/\/web\.archive\.org\/web\/\d{14}\/https?:\/\/(www\.)?tomorrowland\.be(:80)?\//.test(s.archivedUrl || ""),
            `${id} day ${d.day}: page ${s.captureTimestamp} prints "${s.printed}" at ${s.archivedUrl}, not ${wd} ${MONTH[m - 1]} ${dd}`);
          continue;
        }
        // Tomorrowland's 2013-2016 day page prints its weekday and date in
        // its title, with no year.
        if (s.format === "tml-drupal") {
          ok(tmlTitleDate(s.printed, e.year) === d.date && s.titleDate === d.date && s.pxPerHour > 0,
            `${id} day ${d.day}: page ${s.captureTimestamp} prints "${s.printed}" (title date ${s.titleDate}), not ${wd} ${MONTH[m - 1]} ${dd}`);
          continue;
        }
        // Shambhala's 2024-2025 page prints its weekday alone; the date is the
        // run the festival's dated post prints, read off its own site.
        if (s.format === "shambhala-webflow") {
          ok(s.weekday === s.printed && s.printed.toUpperCase() === wd && shambhalaRun(s.datesFrom?.printed, e.year)?.[s.printed] === d.date
            && String(s.published || "").startsWith(String(e.year)) && s.pxPerHour === 70 && /^https:\/\/web\.archive\.org\/web\/\d{14}\/https?:\/\/(www\.)?shambhalamusicfestival\.com\//.test(s.datesFrom?.archivedUrl || ""),
            `${id} day ${d.day}: page ${s.captureTimestamp} prints "${s.printed}" (published ${s.published}) and the post "${s.datesFrom?.printed}", not ${wd} ${MONTH[m - 1]} ${dd}`);
          continue;
        }
        // EDC Las Vegas's 2012-2013 music page prints each day's heading
        // ("Friday - June 8th"), with the year from its own title or
        // description, on the brand's root domain.
        if (s.format === "insomniac-music") {
          ok(insomniacDate(s.printed, e.year) === d.date && /^the page's (title|description)$/.test(s.yearFrom || "") && /^the page's (title|own og:url)$/.test(s.place || "")
            && /^https:\/\/web\.archive\.org\/web\/\d{14}\/https?:\/\/(www\.)?electricdaisycarnival\.com\//.test(s.archivedUrl || ""),
            `${id} day ${d.day}: page ${s.captureTimestamp} prints "${s.printed}" (year from ${s.yearFrom}, Las Vegas from ${s.place}), not ${wd} ${MONTH[m - 1]} ${dd}`);
          continue;
        }
        // The official lineup widget (Outside Lands 2018-2019 and 2022-2025, Lightning in a
        // Bottle 2018-2019) prints each set's whole date, inside the run its
        // options print (a gate day at either end at most), from a dostff.co
        // script that the festival's own lineup page loaded, captured within
        // that festival's window of the script (EMBED_PAGES).
        if (s.format === "dostuff-embed") {
          const eb = s.embeddedBy || {}, run = /^(\d{4}-\d{2}-\d{2}) to (\d{4}-\d{2}-\d{2})$/.exec(s.run || "");
          const span = (a, b) => (Date.parse(b + "T12:00:00Z") - Date.parse(a + "T12:00:00Z")) / 864e5;
          ok(s.printed === d.date && run && span(run[1], e.days[0].date) >= 0 && span(run[1], e.days[0].date) <= 1 && span(e.days.at(-1).date, run[2]) >= 0 && span(e.days.at(-1).date, run[2]) <= 1
            && /^https:\/\/web\.archive\.org\/web\/\d{14}\/https?:\/\/[a-z0-9-]+\.dostff\.co\/embeds\/lineup\.js$/.test(s.archivedUrl || "")
            && eb.archivedUrl === `https://web.archive.org/web/${eb.captureTimestamp}/${eb.url}` && embedPageOk(e.festivalId, s.captureTimestamp, eb),
            `${id} day ${d.day}: widget ${s.captureTimestamp} prints "${s.printed}" (run "${s.run}") at ${s.archivedUrl}, loaded by ${eb.archivedUrl}, not ${wd} ${MONTH[m - 1]} ${dd}`);
          continue;
        }
        // Lollapalooza's 2018 lineup cards print each set's day as "Sat 8/04",
        // on Lollapalooza's own site, and the day is never timed.
        if (s.format === "lolla-cards") {
          ok(lollaCardDate(s.printed, e.year) === d.date && s.printed.startsWith(wd.slice(0, 1) + wd.slice(1, 3).toLowerCase() + " ")
            && /^https:\/\/web\.archive\.org\/web\/\d{14}\/https?:\/\/(www\.)?lollapalooza\.com(:80)?\//.test(s.archivedUrl || ""),
            `${id} day ${d.day}: page ${s.captureTimestamp} prints "${s.printed}" at ${s.archivedUrl}, not ${wd} ${MONTH[m - 1]} ${dd}`);
          continue;
        }
        // HARD Summer's 2012 page heads each day with its weekday alone; the
        // date is the run its essential info prints, on HARD's own site.
        if (s.format === "hard-wp") {
          ok(hardRun(s.dateFrom, e.year)?.[s.printed] === d.date && s.printed === wd && s.pxPerMinute > 0
            && /^https:\/\/web\.archive\.org\/web\/\d{14}\/https?:\/\/(www\.)?(hardfest|hardsummer)\.com(:80)?\//.test(s.archivedUrl || ""),
            `${id} day ${d.day}: page ${s.captureTimestamp} prints "${s.printed}" (run "${s.dateFrom}") at ${s.archivedUrl}, not ${wd} ${MONTH[m - 1]} ${dd}`);
          continue;
        }
        // Primavera Sound's Fòrum timetable prints the day as its own tab,
        // no year, in Catalan, Spanish or English, on Primavera's own site.
        if (s.format === "primavera-horarios") {
          ok(primaveraDate(s.printed, e.year) === d.date && (s.tabs || []).includes(s.printed) && /Parc del Fòrum/.test(s.heading || "")
            && /^https:\/\/web\.archive\.org\/web\/\d{14}\/https?:\/\/(www\.)?primaverasound\.(es|com)(:80)?\//.test(s.archivedUrl || ""),
            `${id} day ${d.day}: page ${s.captureTimestamp} prints "${s.printed}" at ${s.archivedUrl}, not ${wd} ${MONTH[m - 1]} ${dd}`);
          continue;
        }
        // Sónar's timetable heads each session of a day with its weekday, its
        // day of the month and the session ("Thursday 16 | Sónar by Day"), on
        // the year's own page at sonar.es, which names the edition.
        if (s.format === "sonar-calendar") {
          const W = wd[0] + wd.slice(1).toLowerCase(), parts = String(s.printed || "").split(" · ");
          ok(parts.every(x => new RegExp(`^${W} ${dd} \\| Sónar by (Day|Night)$`).test(x)) && new RegExp(`Sónar Barcelona ${e.year}\\b`).test(s.named || "")
            && new RegExp(`^https://web\\.archive\\.org/web/\\d{14}/https?://(www\\.)?sonar\\.es/[a-z]{2}/${e.year}/schedules$`).test(s.archivedUrl || ""),
            `${id} day ${d.day}: page ${s.captureTimestamp} prints "${s.printed}" (named "${s.named}") at ${s.archivedUrl}, not ${wd} ${MONTH[m - 1]} ${dd}`);
          continue;
        }
        // Sziget's day programme prints the day as its own tab, no year
        // ("August 14. Saturday"), on Sziget's own English programme page for
        // that date.
        if (s.format === "sziget-days") {
          ok(szigetDate(s.printed, e.year) === d.date && (s.tabs || []).includes(s.printed)
            && new RegExp(`^https://web\\.archive\\.org/web/\\d{14}/https?://(www\\.)?sziget\\.hu/festival_english/programs/-/days\\?day=${d.date}&`).test(s.archivedUrl || ""),
            `${id} day ${d.day}: page ${s.captureTimestamp} prints "${s.printed}" at ${s.archivedUrl}, not ${wd} ${MONTH[m - 1]} ${dd}`);
          continue;
        }
        // Primavera Sound's 2016-2019 full timetable prints the day as a
        // weekday and a day of the month (2019: the whole date); the row of
        // tabs names one run of days in the year, on Primavera's own site.
        if (s.format === "primavera-completos") {
          const run = primaveraRun(s.tabs, e.year);
          ok(run && run[(s.tabs || []).indexOf(s.printed)] === d.date && /^(Horarios completos|All set times)$/.test(s.active || "")
            && /^https:\/\/web\.archive\.org\/web\/\d{14}\/https?:\/\/(www\.)?primaverasound\.(es|com)(:80)?\//.test(s.archivedUrl || ""),
            `${id} day ${d.day}: page ${s.captureTimestamp} prints "${s.printed}" (tabs ${(s.tabs || []).join(", ")}) at ${s.archivedUrl}, not ${wd} ${MONTH[m - 1]} ${dd}`);
          continue;
        }
        // Defqon.1's 2015 timetable heads each day with its weekday, date and
        // year, on the festival's own site, titled as that year's timetable.
        if (s.format === "defqon-areas") {
          ok(defqonDate(s.printed, e.year) === d.date && s.named === `Timetable - Defqon.1 ${e.year}`
            && /^https:\/\/web\.archive\.org\/web\/\d{14}\/https?:\/\/(www\.)?defqon1\.nl(:80)?\//.test(s.archivedUrl || ""),
            `${id} day ${d.day}: page ${s.captureTimestamp} prints "${s.printed}" at ${s.archivedUrl}, not ${wd} ${MONTH[m - 1]} ${dd}`);
          continue;
        }
        // Governors Ball's 2011-2012 schedule prints each day's heading
        // ("SATURDAY 6/23"); 2011's one day is the one its description prints.
        if (s.format === "govball-wp") {
          ok(govBallDate(s.printed, e.year) === d.date && /^the (day's heading|page's description)$/.test(s.dateFrom || ""),
            `${id} day ${d.day}: page ${s.captureTimestamp} prints "${s.printed}" (${s.dateFrom}), not ${wd} ${MONTH[m - 1]} ${dd}`);
          continue;
        }
        ok(s.kind === "page" ? datedLabel(s.printed, e.year) === d.date : graphicPrints(s.printed, d.date, e.year, e.days.map(x => x.date)),
          `${id} day ${d.day}: ${s.kind} ${s.captureTimestamp || s.sha256?.slice(0, 12)} prints "${s.printed}", not ${wd} ${MONTH[m - 1]} ${dd}`);
      }
    } else {
      // The reviewer copied each graphic's printed header into its note;
      // it must name this day's weekday and month (full or abbreviated).
      const note = (rev?.days.find(x => x.day === d.day)?.note || "").toUpperCase();
      const [, m, dd] = d.date.split("-").map(Number);
      const wd = new Date(d.date + "T12:00:00Z").toLocaleDateString("en-US", { weekday: "long", timeZone: "UTC" }).toUpperCase();
      ok(note.includes(wd.slice(0, 3)) && note.includes(MONTH[m - 1].slice(0, 3)) && new RegExp(`\\b0?${dd}\\b`).test(note),
        `${id} day ${d.day}: the reviewed header "${note.slice(0, 60)}" does not print ${wd} ${MONTH[m - 1]} ${dd}`);
    }
  }
}

// ── 2b. a 2026 look-back is complete only against its official LINEUP page ──
// The set-times pages say who played when; the archived lineup page says who
// was billed. Every billing must be a set (or a hand-checked alias), so a
// look-back can never call a partial lineup complete.
{
  const { joinLineup, LINEUP_PAGES, aegAppBillings } = await import("./historical/check-insomniac-lineup.mjs");
  for (const id of Object.keys(EDITIONS).filter(id => EDITIONS[id].year >= 2026 && existsSync(H(`editions/${id}.json`)))) {
    const lc = JSON.parse(readFileSync(H(`ledger/${id}.json`), "utf8")).lineupCheck;
    ok(lc && lc.billings > 0 && !lc.unmatched.length && !lc.staleOffGraphic?.length && lc.matched + lc.aliased.length + (lc.offGraphic?.length || 0) === lc.billings,
      `${id}: no clean lineup check in its ledger (${lc ? `${lc.unmatched.length} unmatched of ${lc.billings}` : "missing"}) — run check-insomniac-lineup.mjs`);
    ok(lc && /^https:\/\/web\.archive\.org\/web\/\d{14}\//.test(lc.archivedUrl) && /^[0-9a-f]{64}$/.test(lc.sha256) && (lc.title.includes(EDITIONS[id].name) || (lc.staleTitle && LINEUP_PAGES[id]?.staleTitle === lc.title && lc.identityText === LINEUP_PAGES[id]?.identityText)),
      `${id}: the lineup check must cite an archived capture, its hash, and a page titled ${EDITIONS[id].name}`);
    ok(!!LINEUP_PAGES[id], `${id}: no LINEUP_PAGES entry`);
    // A lineup read from an app's data file cites that capture too, and every
    // act listed off the graphics carries its reason.
    if (LINEUP_PAGES[id]?.format === "aeg-app")
      ok(lc?.data && /^https:\/\/web\.archive\.org\/web\/\d{14}\//.test(lc.data.archivedUrl) && /^[0-9a-f]{64}$/.test(lc.data.sha256) && lc.data.url === LINEUP_PAGES[id].data.url,
        `${id}: the lineup check must cite the archived app data it read, with its hash`);
    for (const [n, why] of Object.entries(LINEUP_PAGES[id]?.offGraphic || {})) ok(typeof why === "string" && why.length > 20, `${id}: off-graphic "${n}" has no reason`);
  }
  const j = joinLineup(["A", "B B2B C", "Diesel"], ["A", "B B2B C", "DJ Diesel"], { "Diesel": "DJ Diesel" });
  ok(!j.unmatched.length && j.matched === 2 && j.aliased.length === 1, "joinLineup matches billings and a listed alias");
  mutations++; ok(joinLineup(["A", "Missing Act"], ["A"]).unmatched.length === 1, "mutation not caught: a billed act with no set");
  mutations++; ok(joinLineup(["Diesel"], ["DJ Diesel"]).unmatched.length === 1, "mutation not caught: an alias nobody listed");
  const og = joinLineup(["A", "Elsewhere"], ["A"], {}, { "Elsewhere": "x".repeat(30) });
  ok(!og.unmatched.length && og.offGraphic.length === 1 && !og.staleOffGraphic.length, "joinLineup takes a listed off-graphic act");
  mutations++; ok(joinLineup(["A"], ["A"], {}, { "A": "x".repeat(30) }).unmatched.length === 1, "mutation not caught: an act listed off-graphic that the sheet has");
  mutations++; ok(joinLineup(["A"], ["A"], {}, { "Gone": "x".repeat(30) }).staleOffGraphic.length === 1, "mutation not caught: an off-graphic entry nobody billed");
  mutations++; ok(aegAppBillings([{ title: "Panda &amp; Chok" }, { title: "Panda &amp; Chok" }, { title: "X" }]).join("|") === "Panda & Chok|X", "mutation not caught: app billings not decoded or not deduplicated");
  // A stale <title> passes only with the identity text recorded for it.
  for (const id of Object.keys(LINEUP_PAGES).filter(id => LINEUP_PAGES[id].staleTitle)) {
    const lc = JSON.parse(readFileSync(H(`ledger/${id}.json`), "utf8")).lineupCheck;
    const passes = x => x.title.includes(EDITIONS[id].name) || (x.staleTitle && LINEUP_PAGES[id].staleTitle === x.title && x.identityText === LINEUP_PAGES[id].identityText);
    mutations++; ok(lc && !passes({ ...lc, identityText: undefined }), `mutation not caught: ${id} stale title without its identity text`);
    mutations++; ok(lc && !passes({ ...lc, title: "Lineup – Some Other Festival 2025" }), `mutation not caught: ${id} a different stale title`);
  }
}

// ── 3. edition identity from the page itself ──
ok(datedLabel("Friday, May 16", 2025) === "2025-05-16", "EDC's 2025 day tab must validate for 2025");
ok(datedLabel("Friday, May 16", 2026) === null, "the same tab must NOT validate for 2026 (May 16 2026 is a Saturday)");
ok(datedLabel("Thursday - June 28th", 2012) === "2012-06-28" && datedLabel("Thursday - June 28th", 2013) === null && datedLabel("Thursday - June 28nd", 2012) === null, "Electric Forest's dashed day tab must validate only for its own year and ordinal");
ok(datedLabel("Friday, April 15, 2016", 2016) === "2016-04-15" && datedLabel("Friday, April 15, 2016", 2017) === null && datedLabel("Saturday, April 15, 2016", 2016) === null, "Coachella's dated label must validate only for its printed year and weekday");
ok(datedLabel("Saturday, August 02", 2025) === "2025-08-02", "HARD's zero-padded tab must validate");
ok(datedLabel("Friday, June 26", 2025) === null, "a Summerfest page rolled to 2026 (Fri Jun 26) must not pass as 2025");
{
  const html = `<a href="/lineup/set-times/day-1/">Friday, May 15</a><a href="/lineup/set-times/day-2/">Saturday, May 16</a>`;
  ok(dayTabs(html, 2025).some(t => !t.date), "a 2026 set list under a 2025 request must fail its day tabs");
}
ok(to24("12:30 AM") === "00:30" && to24("12:05 PM") === "12:05" && to24("04:13 AM") === "04:13", "12-hour clock conversion");
ok(sheetRow(1, { id: "1", stage: "S", artist: "A", start: "09:00", end: "10:00", printed: "04:13 AM - 05:28 AM" }).start === "04:13",
  "the printed range wins over epochs");
ok(instant("2025-05-16", "04:13", 12, -420) === "2025-05-17T11:13:00.000Z",
  "EDC Friday's 04:13 set is Saturday 04:13 PDT, still grouped under Friday");

// ── 3b. lineup-only editions (official lineup page, no times) ──
{
  const lineups = Object.values(editions).filter(e => e.completeness === "lineup_only");
  // Nocturnal and Beyond SoCal 2025 survive only as lineup pages. Escape, EDC
  // Orlando and Dreamstate 2025 have complete official schedules (#368/#369/
  // #371); a lineup page must never replace them.
  // Every other lineup edition is one registered as official_lineup_html in
  // editions.mjs (the 2010-2025 backfill); nothing else may be lineup_only.
  const LINEUP_2025 = ["beyond-wonderland-socal-2025", "nocturnal-wonderland-2025"];
  const LINEUP_ALL = Object.keys(EDITIONS).filter(id => EDITIONS[id].method === "official_lineup_html" && editions[id]).sort();
  for (const id of LINEUP_2025) ok(LINEUP_ALL.includes(id), `${id}: no longer a lineup edition`);
  ok(JSON.stringify(lineups.map(e => e.id).sort()) === JSON.stringify(LINEUP_ALL), `expected the lineup editions ${LINEUP_ALL.join(", ")}, found ${lineups.map(e => e.id).join(", ") || "none"}`);
  for (const id of ["escape-halloween-2025", "edc-orlando-2025", "dreamstate-socal-2025"])
    ok(editions[id]?.completeness === "complete_schedule" && editions[id].sets.length > 0, `${id}: downgraded to ${editions[id]?.completeness} with ${editions[id]?.sets?.length} sets`);
  for (const e of lineups) {
    ok(e.provenance.extractionMethod === "official_lineup_html" && !e.sets.length, `${e.id}: lineup_only must come from a lineup page and carry no sets`);
    ok(!JSON.stringify(e.artists).match(/"(start|end|time)"/), `${e.id}: an artist carries a time`);
    // An undated page printed no days (validate.mjs holds it to that).
    if (!e.undated) for (const d of e.days) ok(e.artists.some(a => a.appearances.some(x => x.day === d.day)), `${e.id}: day ${d.day} has no billed artist`);
    const led = JSON.parse(readFileSync(H(`ledger/${e.id}.json`), "utf8"));
    ok(led.chosen === led.considered.filter(c => c.valid && c.billings).at(-1)?.captureTimestamp, `${e.id}: the chosen capture is not the latest one that proves the edition`);
    ok(JSON.stringify(e.stages.map(s => s.name)) === JSON.stringify(led.stageOrder || []), `${e.id}: stages are not in the order the By Stage tab printed (${e.stages.map(s => s.name).join(", ")})`);
  }
  const noc = editions["nocturnal-wonderland-2025"], esc = editions["beyond-wonderland-socal-2025"];
  if (noc && esc) {
    mustFail("a lineup edition gains a set", m => { m.sets.push({ id: `${m.id}:d1:x:2000:y`, artistId: m.artists[0].id, day: 1, stageId: m.stages[0].id, start: "20:00", end: "21:00" }); }, noc, undefined, /no sets/);
    mustFail("a lineup appearance gains a time", m => { m.artists[0].appearances[0].start = "20:00"; }, noc, undefined, /other than a day and a stage/);
    mustFail("a lineup appearance on a day the edition does not have", m => { m.artists[0].appearances[0].day = 3; }, noc, undefined, /not an edition day/);
    mustFail("a lineup appearance on an unknown stage", m => { m.artists[0].appearances[0].stageId = `${m.id}:nowhere`; }, noc, undefined, /unknown stage/);
    mustFail("a lineup stage nobody played", m => { m.stages.push({ id: `${m.id}:empty`, name: "Empty Stage" }); }, noc, undefined, /on no artist/);
    mustFail("a lineup artist removed", m => { m.artists.pop(); }, noc, undefined, /artists, locked/);
    mustFail("a lineup day's appearance removed", m => { const a = m.artists.find(x => x.appearances.some(y => y.day === 2)); a.appearances = a.appearances.filter(y => y.day !== 2); }, noc, undefined, /appearances per day/);
    mustFail("a lineup page promoted to a complete schedule", m => { m.completeness = "complete_schedule"; }, noc, undefined, /cannot make a complete_schedule/);
    mustFail("a lineup capture from a non-official host", m => { m.provenance.captures[0].archivedUrl = "https://web.archive.org/web/20250912223717/https://www.clashfinder.com/s/nw2025/"; }, noc, undefined, /not an official/);
    mustFail("a lineup capture from the wrong year", m => { m.provenance.captures[0].archivedUrl = m.provenance.captures[0].archivedUrl.replace("/web/2025", "/web/2024"); }, noc, undefined, /not from 2025/);
    mustFail("Special Guest back in a lineup", m => { m.artists.push({ id: `${m.id}:special-guest`, name: "Special Guest", key: "special-guest", performers: ["special-guest"], appearances: [{ day: 1 }] }); }, esc, undefined, /: dropped /);
  }

  // selected_stages: an edition whose official schedule had stages that are
  // not imported names them (review of merged #440, 2026-11-12). Exactly these
  // carry the label, and it cannot drift from the rows: Coachella's three,
  // Sziget 2010 and 2011, whose day pages were archived for five stages only,
  // Defqon.1 2015, whose Sunday closing prints one block over untimed acts,
  // and Governors Ball 2024, whose Bud Light Backyard sheet prints weekdays
  // without dates and starts without ends.
  const SELECTED = ["coachella-2014", "coachella-2015", "coachella-2016", "defqon1-2015", "governors-ball-2024", "sziget-2010", "sziget-2011"];
  const selected = Object.values(editions).filter(e => e.completeness === "selected_stages").map(e => e.id).sort();
  ok(JSON.stringify(selected) === JSON.stringify(SELECTED), `selected_stages editions are ${selected.join(", ") || "none"}, want ${SELECTED.join(", ")}`);
  const c14 = editions["coachella-2014"];
  if (c14) {
    ok(c14.coverage.missing.map(m => m.stage).join() === "Heineken House,Do Lab", `coachella-2014 missing ${c14.coverage.missing.map(m => m.stage)}`);
    const dolab = c14.stages.find(x => x.name === "Do Lab");
    mustFail("a stage listed missing gains a set that day", m => { m.sets.push({ ...m.sets.find(x => x.stageId === dolab.id), id: `${m.id}:d1:do-lab:1200:x`, day: 1, start: "12:00" }); }, c14, undefined, /listed as missing on day 1 but has sets/);
    mustFail("selected stages relabelled complete", m => { m.completeness = "complete_schedule"; }, c14, undefined, /only selected_stages may carry one/);
    mustFail("the missing-stage list dropped", m => { delete m.coverage; }, c14, undefined, /coverage differs from the edition registry/);
    mustFail("a missing stage names a day the edition lacks", m => { m.coverage.missing[1].days = [7]; }, c14, undefined, /coverage differs|names day 7/);
  }
  const c17 = editions["coachella-2017"];
  if (c17) mustFail("a complete schedule claims a missing stage", m => { m.coverage = { asOf: "2026-11-12", missing: [{ stage: "X", days: [1], when: "Friday" }] }; }, c17, undefined, /coverage differs from the edition registry/);
  // Coachella 2025's graphics sit in AEG's shared blob store. Its
  // OFFICIAL_HOSTS entry is a folder: the folder is official, the host and
  // every other folder on it are not.
  const c25 = editions["coachella-2025"];
  ok(!!c25, "control: coachella-2025 is built (else the folder checks pass vacuously)");
  if (c25) {
    const BLOB = "aegwebprod.blob.core.windows.net";
    ok(!hostIn(OFFICIAL_HOSTS.coachella, BLOB), "a folder entry must not admit its host alone");
    ok(urlIn(OFFICIAL_HOSTS.coachella, `https://${BLOB}/content/coachella2025/c25-w1-friday.jpg`), "control: a graphic in the 2025 folder is official");
    const img = m => m.provenance.captures.find(c => c.day === 1);
    mustFail("a graphic in another folder of the same blob store", m => { const c = img(m); c.imageArchivedUrl = c.imageArchivedUrl.replace("/content/coachella2025/", "/content/edc2025/"); }, c25, undefined, /not an official coachella property/);
    mustFail("a graphic in a folder that only shares the prefix's stem", m => { const c = img(m); c.imageArchivedUrl = c.imageArchivedUrl.replace("/content/coachella2025/", "/content/coachella2025x/"); }, c25, undefined, /not an official coachella property/);
    mustFail("a graphic at the blob store's root", m => { const c = img(m); c.imageArchivedUrl = c.imageArchivedUrl.replace("/content/coachella2025/", "/"); }, c25, undefined, /not an official coachella property/);
    mustFail("a dot-segment walking out of the folder", m => { const c = img(m); c.imageArchivedUrl = c.imageArchivedUrl.replace("/content/coachella2025/", "/content/coachella2025/../edc2025/"); }, c25, undefined, /not an official coachella property/);
  }

  // Parser fixtures: the real markup shapes, and the traps.
  const li = (name, extra = "") => `<li><span><a href="#modal-lineup-artist" data-artist-id="1" data-artist-name="${name}"${extra}>${name}</a></span></li>`;
  const page = (title, dayHeads, stages) => `<title>Lineup &#8211; ${title}</title>
    <div class="tabs__trigger tabs__trigger--active">Alphabetical</div><div class="tabs__trigger">By Day</div>${stages ? `<div class="tabs__trigger">By Stage</div>` : ""}
    <div class="tabs__content tabs__content--active"><ul>${li("Alpha")}<li><span><a data-artist-name="Adam Beyer">Adam Beyer</a> B2B <a data-artist-name="Layton Giordani">Layton Giordani</a></span></li>${li("Beta", ' aria-label="view artist details for Beta"')}${li("Two Stager")}</ul></div>
    <div class="tabs__content"><h3>${dayHeads[0]}</h3><ul>${li("Alpha")}${li("Two Stager")}</ul><h3>${dayHeads[1]}</h3><ul><li><span><a data-artist-name="Adam Beyer">Adam Beyer</a> B2B <a data-artist-name="Layton Giordani">Layton Giordani</a></span></li>${li("Beta")}</ul><h3>Sponsors</h3><ul><li><a href="https://sponsor.example">Sponsor Co</a></li></ul></div>
    ${stages ? `<div class="tabs__content"><h3>Main</h3><ul>${li("Alpha")}${li("Two Stager")}</ul><h3>Casa</h3><ul>${li("Two Stager")}${li("Only Staged")}</ul></div>` : ""}`;
  const good = parseLineupPage(page("Nocturnal Wonderland 2025", ["Saturday, September 13", "Sunday, September 14"], true));
  const alpha = good.tabs[0].groups.flatMap(g => g.acts);
  ok(alpha.includes("Adam Beyer B2B Layton Giordani") && !alpha.includes("Adam Beyer"), "a B2B line is one billing, not one per link");
  ok(alpha.includes("Beta"), "a billing whose link carries aria-label is still read (Escape's markup)");
  ok(!good.tabs[1].groups.flatMap(g => g.acts).includes("Sponsor Co"), "a sponsor link is not an act");
  ok(provesEdition(good, "nocturnal-wonderland-2025").valid, "the 2025 page with 2025 day headers proves the edition");
  ok(!provesEdition(parseLineupPage(page("Nocturnal Wonderland 2024", ["Saturday, September 13", "Sunday, September 14"], true)), "nocturnal-wonderland-2025").valid,
    "a page titled 2024 must not pass as 2025");
  ok(!provesEdition(parseLineupPage(page("Nocturnal Wonderland 2025", ["Saturday, September 14", "Sunday, September 15"], true)), "nocturnal-wonderland-2025").valid,
    "2025 title over last year's day headers (Sat Sep 14 is 2024) must not pass");
  const { rows, findings } = lineupRows(good, "nocturnal-wonderland-2025");
  const at = n => rows.filter(r => r.artist === n).map(r => `${r.day}|${r.stage}`).sort().join(",");
  ok(at("Alpha") === "1|Main", `one day and one stage join into one appearance (got ${at("Alpha")})`);
  ok(at("Two Stager") === "1|Casa,1|Main", `one day and two stages give two appearances that day (got ${at("Two Stager")})`);
  ok(at("Only Staged") === "|Casa" && findings.some(f => f.startsWith("Only Staged:")), "a billing printed only under a stage keeps its stage, no invented day, and is flagged");
  ok(at("Beta") === "2|" && findings.some(f => f.startsWith("Beta:")), "a billing missing from By Stage keeps its day and is flagged");
  ok(!findings.some(f => f.startsWith("Alpha:")), "a billing every tab agrees on is not flagged");

  // Undated pages (EDC 2016/2017): the lineup only as `var artist_data`, no
  // tabs and no days. Proven by title alone, and never over a By Day tab.
  // Those editions now carry set times, so the tests run against a frozen
  // fixture (scripts/fixtures/historical-undated-lineup.json): EDC Orlando
  // 2016 and EDC Las Vegas 2017 as they were, undated and lineup-only,
  // swapped in under their own ids for this block and restored after it.
  const UF = JSON.parse(readFileSync(join(ROOT, "scripts/fixtures/historical-undated-lineup.json"), "utf8"));
  const UO = "edc-orlando-2016", UL = "edc-las-vegas-2017";
  const live = { o: EDITIONS[UO], ol: LINEUP_EDITIONS[UO], l: EDITIONS[UL] };
  EDITIONS[UO] = UF.orlando2016.registry; LINEUP_EDITIONS[UO] = UF.orlando2016.lineupPage;
  EDITIONS[UL] = UF.registry;
  try {
  const adata = (title, names) => `<title>${title}</title><script>\n    var artist_data = ${JSON.stringify({ artists: names.map(name => ({ name, image: "x.jpg", link: "y" })) })};\n</script>`;
  const und = parseLineupPage(adata("LINEUP - EDC Orlando 2016", ["Zed", "Alpha &amp; Beta", "Secret Guest", "Zed"]));
  ok(JSON.stringify(und.tabs) === JSON.stringify([{ tab: "Alphabetical", groups: [{ head: null, acts: ["Zed", "Alpha & Beta", "Secret Guest", "Zed"] }] }]),
    `artist_data is read as one Alphabetical tab, every name in page order (got ${JSON.stringify(und.tabs)})`);
  ok(provesEdition(und, UO).valid, "an undated page titled with the edition proves an undated edition");
  ok(!provesEdition(parseLineupPage(adata("LINEUP - EDC Orlando 2017", ["Zed"])), UO).valid, "an undated page titled with another year does not");
  ok(!provesEdition(und, "edc-orlando-2015").valid, "an undated page never proves a dated edition");
  ok(!provesEdition(parseLineupPage(page("EDC Orlando 2016", ["Friday, November 11", "Saturday, November 12"])), UO).valid,
    "a page that prints days does not pass as an undated edition: its dates must be proven instead");
  ok(!parseLineupPage("<title>x</title><script>var artist_data = {broken};</script>").tabs.length, "unparseable artist_data is no lineup");
  for (const [t, want] of [["EDC Las Vegas | June 17–19, 2016 | Las Vegas Motor Speedway", "2016-06-17,2016-06-18,2016-06-19"],
    ["EDC Orlando | November 4 – 5, 2016 | Tinker Field", "2016-11-04,2016-11-05"], ["EDC Las Vegas | Las Vegas Motor Speedway", ""],
    ["EDC | June 19–17, 2016", ""], ["Lineup | Smarch 4–5, 2016", ""]])
    ok(printedRange(t).join(",") === want, `home page title "${t}" prints ${want || "no dates"} (got ${printedRange(t).join(",") || "none"})`);
  const ur = lineupRows(und, UO);
  ok(ur.rows.filter(r => r.artist === "Zed").length === 1 && ur.rows.every(r => r.day === "" && r.stage === ""), "a name listed twice is one billing, with no day and no stage");
  ok(ur.findings.length === 1 && ur.findings[0].startsWith("Zed: alphabetical ×2"), `only the repeated name is a ledger finding on an undated page (got ${ur.findings.join("; ")})`);
  // The frozen undated edition still fails every way an undated lineup can.
  const lv17 = UF.edition;
  const mustFailU = (label, mutate, e, by) => {
    const m = clone(e); mutate(m); mutations++;
    const p = validateEdition(m, { expected: UF.expected, review: undefined, dropped: clone(UF.dropped) });
    ok(p.some(x => by.test(x)), `mutation not caught by ${by}: ${label}`);
  };
  ok(!validateEdition(clone(lv17), { expected: UF.expected, review: undefined, dropped: clone(UF.dropped) }).length, "the frozen undated edition is valid as it stands");
  mustFailU("an undated lineup gains a day", m => { m.artists[0].appearances.push({ day: 1 }); }, lv17, /undated lineup, but an artist carries a day/);
  mustFailU("an undated lineup loses its note", m => { delete m.notes; }, lv17, /notes differ|printed no days/);
  mustFailU("an undated lineup no longer marked undated", m => { delete m.undated; }, lv17, /day 1 has no billed artist/);
  // (Run while the frozen editions are swapped in.) A title that names no year proves nothing alone: its captures are read
  // only up to `until`, at most two weeks after the festival's last day.
  for (const [id, w] of Object.entries(LINEUP_EDITIONS)) {
    const ed = EDITIONS[id];
    if (!ed.undated) { ok(!w.until, `${id}: until is only for an undated edition`); continue; }
    if (w.title.includes(String(ed.year))) continue;
    const last = Date.parse(ed.dates.at(-1)[0]), until = w.until && Date.parse(`${w.until.slice(0, 4)}-${w.until.slice(4, 6)}-${w.until.slice(6)}`);
    ok(until && until >= last && until - last <= 14 * 86400000, `${id}: an undated page whose title names no year needs until within two weeks after the festival`);
  }
  } finally { EDITIONS[UO] = live.o; LINEUP_EDITIONS[UO] = live.ol; EDITIONS[UL] = live.l; }
  mustFail("a dated lineup marked undated", m => { m.undated = true; }, noc, undefined, /the edition registry says false/);
}

// ── 4. isolation from the live app ──
{
  const live = ["data.jsx", "sw.js", "index.html", "app.jsx", ...readdirSync(join(ROOT, "data/festivals")).map(f => `data/festivals/${f}`)];
  for (const f of live) {
    // Comments may mention Wayback as history (outside-lands-2026.js does);
    // only code can wire an edition into the app.
    const src = readFileSync(join(ROOT, f), "utf8").split("\n").filter(l => !/^\s*(\/\/|\*|\/\*|<!--)/.test(l)).join("\n");
    ok(!/data\/historical|historicalEditions|web\.archive\.org/.test(src), `${f} references historical data or Wayback — historical editions must not reach the live schedule, registry or precache`);
    for (const id of Object.keys(EDITIONS)) ok(!src.includes(`"${id}"`) && !src.includes(`'${id}'`), `${f} names historical edition ${id}`);
  }
  // historical.jsx is the one door: no other app source may fetch the library,
  // the precache must not carry it, and the screen may not reach the live
  // plan, reminders, the active festival or storage (it is read-only).
  const code = f => readFileSync(join(ROOT, f), "utf8").split("\n").filter(l => !/^\s*(\/\/|\*|\/\*)/.test(l)).join("\n");
  const doorless = readdirSync(ROOT).filter(f => f.endsWith(".jsx") && f !== "historical.jsx");
  for (const f of doorless) {
    ok(!/data\/historical/.test(code(f)), `${f} fetches the historical library; only historical.jsx may`);
  }
  const door = code("historical.jsx");
  ok(/"data\/historical\/"/.test(door), "historical.jsx no longer loads data/historical — the isolation checks above would pass vacuously");
  for (const [re, what] of [[/localStorage|sessionStorage|indexedDB/, "browser storage"], [/setActiveFestival|active_festival/, "the active festival"],
    [/\bsaved\b|markAttended|scheduleReminders|sbPush|_SAVED_KEY/, "the saved plan or reminders"]])
    ok(!re.test(door), `historical.jsx touches ${what}; the archive is read-only`);
  const sw = readFileSync(join(ROOT, "sw.js"), "utf8");
  ok(/\.\/build\/historical\.js/.test(sw) && !/historical\/(index|editions)/.test(sw), "sw.js must precache the screen (build/historical.js) and never the library data");
  const bld = code("scripts/build.mjs");
  // Only the lines that name the historical library: the artist-photo ledger's build
  // step is a different ledger, and a blanket /ledger/ refused it (2026-10-03).
  const bldHist = bld.split("\n").filter(l => /historical/.test(l)).join("\n");
  ok(/'data\/historical\/index\.json'/.test(bld) && /'historical', 'editions'/.test(bld) && /'data\/historical\/scan-calendar\.json'/.test(bld)
    && !/sheets|ledger|'review'|scan-calendar\/|\.tsv/.test(bldHist),
    "build.mjs must ship data/historical/index.json, editions/*.json and scan-calendar.json only (sheets, ledgers, review manifests and TSV sources stay out of the app)");
  const walk = d => readdirSync(d, { withFileTypes: true }).flatMap(x => x.isDirectory() ? walk(join(d, x.name)) : [join(d, x.name)]);
  const art = walk(H("")).filter(f => /\.(png|jpe?g|webp|gif|svg|html?)$/i.test(f));
  ok(!art.length, `archived creative assets must never be committed: ${art.join(", ")}`);
  // Public manifests carry public URLs, hashes and a stable reviewer label:
  // never a session id, a local path or the private gather folder.
  const PRIVATE = /\bsession [0-9a-f]{6,}|historical-gather|\/Users\/|~\/Plursky-private\/(?!historical-cache)/;
  ok(PRIVATE.test("reviewer, session d3003194") && PRIVATE.test("gathered: historical-gather/x") && !PRIVATE.test("~/Plursky-private/historical-cache/"),
    "the private-reference pattern must catch a session id and a gather path (control)");
  const pub = [...walk(H("")), ...readdirSync(join(ROOT, "scripts/historical")).map(f => join(ROOT, "scripts/historical", f))];
  for (const f of pub) {
    const hit = PRIVATE.exec(readFileSync(f, "utf8"));
    ok(!hit, `${f.slice(ROOT.length + 1)} carries a private reference "${hit?.[0]}"; use a public source, hash or the stable reviewer label`);
  }
}

// ── 5. graphic headers: what a header must print to cite a day ──
for (const [printed, date, year, dates, want] of [
  ["SATURDAY · OCTOBER 27 & 28, 2017", "2017-10-28", 2017, ["2017-10-27", "2017-10-28"], true],
  ["AFTER PARTY SET TIMES · FRIDAY, OCT 25 · OCTOBER 25 + 26, 2024", "2024-10-25", 2024, ["2024-10-25", "2024-10-26"], true],
  ["FRIDAY (SEPTEMBER 15 • 16, 2017)", "2017-09-15", 2017, ["2017-09-15", "2017-09-16"], true],
  ["SAT 11.18.23", "2023-11-18", 2023, ["2023-11-17", "2023-11-18"], true],
  ["SATURDAY OCTOBER 29 2022", "2017-10-28", 2017, ["2017-10-27", "2017-10-28"], false],
  ["SATURDAY · OCTOBER 27 & 28, 2018", "2017-10-28", 2017, ["2017-10-27", "2017-10-28"], false],
  ["FRIDAY, OCT 26", "2024-10-26", 2024, ["2024-10-25", "2024-10-26"], false],
  ["SAT 11.18.22", "2023-11-18", 2023, ["2023-11-17", "2023-11-18"], false],
  ["SET TIMES", "2024-10-25", 2024, ["2024-10-25"], false],
]) ok(graphicPrints(printed, date, year, dates) === want, `graphic header "${printed}" should ${want ? "" : "not "}print ${date}`);

// ── 6. ACL's grid: every start's am/pm is read off the page's own hour axis ──
// A synthetic page in the 2016-19 markup (no archived HTML in the repo). The
// scale is 0.2 em/min and the axis starts at 11:00am, so top = (start − 660) × 0.2.
{
  const AXIS = ["11:00am", "12:00pm", "1:00pm", "2:00pm", "3:00pm", "4:00pm", "5:00pm", "6:00pm", "7:00pm", "8:00pm", "9:00pm", "10:00pm"];
  const block = (title, time, top, h) => `<div class="o-session" style="top: ${top}em"><div class="o-session__inner" style="height: ${h}em"><p class="o-session__title">${title}</p><p class="o-session__time">${time}</p></div></div>`;
  const D = "friday-2017-10-06";
  const grid = ({ axis = AXIS, honda = [], kids = [] } = {}) => `<a data-value="${D}">Friday Oct 6th</a>
<option data-target="#schedule-column-date-${D}-location-1">Honda</option><option data-target="#schedule-column-date-${D}-location-2">Austin Kiddie Limits presented by Lifeway</option>
<ol class="c-schedule__timeslots">${axis.map(a => `<li><span>${a}</span></li>`).join("")}</ol>
<div id="schedule-column-date-${D}-location-1">${honda.join("")}</div><div id="schedule-column-date-${D}-location-2">${kids.join("")}</div>`;
  const HONDA = [block("Early Act", "12:30-1:15", 18, 9), block("Evening Act", "6:15-7:15", 87, 12)];
  const KIDS = [block("School of Rock", "11:30-11:55", 6, 5)];
  const day = html => parseAclSchedule(html).days[0];
  const good = day(grid({ honda: HONDA, kids: KIDS }));
  ok(good.timed && good.sets.map(x => `${x.artist} ${x.start}-${x.end}`).join(" | ") === "Early Act 12:30-13:15 | Evening Act 18:15-19:15 | School of Rock 11:30-11:55",
    `the ACL grid must read each start's meridiem off its axis: ${good.sets.map(x => `${x.artist} ${x.start}-${x.end}`).join(" | ")}`);
  ok(good.sets[2].stage === "Austin Kiddie Limits" && good.sets[2].stageSub === "presented by Lifeway", "the kids stage's sponsor must be split off as stageSub");
  ok(axisMinutes("12:00pm") === 720 && axisMinutes("12:00 am") === 0 && axisMinutes("12:00") === null && readAxis(["11:00am", "1:00pm"]) === null,
    "axis labels: noon and midnight read right, a label with no meridiem or a skipped hour is no axis");
  ok(datedLabel("Friday Oct 4th", 2013) === "2013-10-04" && datedLabel("Friday Sep 30th", 2016) === "2016-09-30" && datedLabel("Friday Oct 4rd", 2013) === null && datedLabel("Saturday Oct 4th", 2013) === null,
    "ACL day tabs: a 3-letter month and the right ordinal read; a wrong ordinal or weekday does not");
  ok(dropReason("Silent Disco powered by Quiet Events", "Tito’s Handmade Vodka") && !dropReason("Silent Discovery", ""), "a sponsored Silent Disco is dropped; another billing starting with the words is not");
  const untimed = (label, html, test = d => !d.timed && d.sets.every(x => x.start === "" && x.end === "" && x.meridiem === null)) => {
    mutations++; ok(test(day(html)), `mutation not caught: ${label}`);
  };
  untimed("an axis that prints no meridiem", grid({ axis: AXIS.map(a => a.replace(/[ap]m$/, "")), honda: HONDA, kids: KIDS }));
  untimed("an axis that wraps past midnight / skips an hour", grid({ axis: [...AXIS.slice(0, 11), "12:00am"], honda: HONDA, kids: KIDS }));
  untimed("a block whose top fits neither reading", grid({ honda: [HONDA[0], block("Evening Act", "6:15-7:15", 87 + 30, 12)], kids: KIDS }));
  untimed("a block placed off the axis that duplicates nothing", grid({ honda: [...HONDA, block("Ghost", "11:30-11:55", 150, 5)], kids: KIDS }));
  untimed("a page with one duration only has no scale", grid({ honda: [block("Early Act", "12:30-1:15", 18, 9)] }));
  untimed("an off-axis repeat of an on-axis block is reported, not kept", grid({ honda: HONDA, kids: [...KIDS, block("School of Rock", "11:30-11:55", 150, 5)] }),
    d => d.timed && d.duplicates.length === 1 && d.sets.filter(x => x.artist === "School of Rock").length === 1);
  untimed("a cancelled block is flagged and its billing kept clean", grid({ honda: [...HONDA, block("*canceled* Gone Band", "3:00-4:00", 48, 12)], kids: KIDS }),
    d => d.sets.some(x => x.canceled && x.artist === "Gone Band"));
  // Lollapalooza 2013 misprints one range (5:30-4:15): the scale is fitted
  // without it, the misprint is named, and the day ships untimed.
  untimed("a misprinted range is named and makes its day untimed", grid({ honda: [...HONDA, block("Misprint", "5:30-4:15", 78, 9)], kids: KIDS }),
    d => !d.timed && d.sets.some(x => x.artist === "Misprint" && x.rangeMismatch) && d.sets.every(x => x.start === ""));
  ok(day(grid({ honda: HONDA.map(b => b.replace('class="o-session__inner"', 'class="o-session__inner "')), kids: KIDS })).timed,
    "a block class with a trailing space (Lollapalooza 2017's markup) must still be read");
  untimed("a block printed twice in the same place is one set", grid({ honda: [...HONDA, HONDA[1]], kids: KIDS }),
    d => d.timed && d.duplicates.length === 1 && d.sets.filter(x => x.artist === "Evening Act").length === 1);
  const l13 = editions["lollapalooza-2013"];
  ok(l13 && l13.days.filter(d => d.untimed).map(d => d.day).join() === "2" && l13.sets.filter(x => x.day === 2).every(x => x.start === null)
    && l13.sets.filter(x => x.day === 2 && x.artistId === "lollapalooza-2013:school-of-rock").length === 1,
    "Lollapalooza 2013: the misprinted Saturday ships untimed, with School of Rock's two sets listed once");

  // Untimed days, notes and cancelled days are each held by a rule.
  const a17 = editions["acl-2017"], a13 = editions["acl-2013"];
  ok(a17 && a13, "the ACL 2017 and 2013 editions must exist for the untimed/cancelled mutations");
  if (a17 && a13) {
    ok(a17.days.filter(d => d.untimed).map(d => d.day).join() === "4,5,6" && a17.sets.filter(x => x.day >= 4).every(x => x.start === null && x.end === null)
      && a17.sets.filter(x => x.day < 4).every(x => /^\d{2}:\d{2}$/.test(x.start)), "ACL 2017: W2 ships lineup-only (no times), W1 timed");
    ok(a13.days.length === 5 && !a13.days.some(d => d.date === "2013-10-13") && a13.provenance.cancelledDays?.[0]?.blocks === 43, "ACL 2013: the flooded W2 Sunday has no day, and its 43 printed blocks are the ledger's proof");
    mustFail("a set on an untimed day given a time", m => { const x = m.sets.find(x => x.day === 5); x.start = "18:15"; x.end = "19:15"; }, a17, undefined, /untimed day carries a time/);
    mustFail("an untimed day losing its flag", m => { delete m.days[3].untimed; }, a17, undefined, /untimed is false/);
    mustFail("a timed day flagged untimed", m => { m.days[0].untimed = true; }, a17, undefined, /untimed is true/);
    mustFail("an untimed day with no note", m => { delete m.notes; }, a17, undefined, /no note saying why/);
    mustFail("a note reworded off the registry", m => { m.notes[0].text = "Times probably fine."; }, a13, undefined, /notes differ/);
    mustFail("a cancelled day with no ledger proof", m => { delete m.provenance.cancelledDays; }, a13, undefined, /no ledger proof/);
    mustFail("a cancelled day's proof without its blocks", m => { m.provenance.cancelledDays[0].blocks = 0; }, a13, undefined, /no ledger proof/);
  }
  // Governors Ball 2013: Kings of Leon, printed as Friday's closer, played
  // Saturday (the festival's own posts). The set is listed on Saturday only,
  // the ledger keeps Friday's block as an excluded moved row, and a note
  // naming both days says why.
  const gb13 = editions["governors-ball-2013"];
  ok(gb13, "the Governors Ball 2013 edition must exist for the moved-set mutations");
  if (gb13) {
    const kol = gb13.sets.filter(x => x.artistId.endsWith(":kings-of-leon"));
    const led = JSON.parse(readFileSync(H("ledger/governors-ball-2013.json"), "utf8"));
    ok(kol.length === 1 && kol[0].day === 2 && kol[0].start === "18:45"
      && led.excluded.length === 1 && led.excluded[0].moved && led.excluded[0].day === 1 && led.excluded[0].start === "21:30",
      "Governors Ball 2013: Kings of Leon listed once, Saturday 18:45, with Friday's printed block an excluded moved row");
    mustFail("a moved set with its note dropped", m => { delete m.notes; }, gb13, undefined, /notes differ|no note naming days 1 and 2/);
    mustFail("a moved set's note narrowed to one day", m => { m.notes[0].days = [2]; }, gb13, undefined, /notes differ|no note naming days 1 and 2/);
  }
}

// 7. The Wayback cache never hands back a neighbouring capture under the
// requested key: a poisoned entry is refetched, a redirect is never cached.
// ── 6. a canceled edition is kept but never offered ──
// Nocturnal Wonderland 2024 was canceled before it opened (Line Fire). Its
// printed rows stay as evidence; the index, the artist registry and the app's
// past-edition lists all skip it. Each rule has a mutant.
{
  const canceled = Object.entries(EDITIONS).filter(([, m]) => m.status === "canceled").map(([id]) => id);
  ok(canceled.includes("nocturnal-wonderland-2024"), "nocturnal-wonderland-2024 must be registered as canceled");
  const index = JSON.parse(readFileSync(H("index.json"), "utf8"));
  const indexProblems = ix => canceled.filter(id => ix.editions.some(e => e.id === id)).map(id => `index.json lists canceled ${id}`);
  ok(!indexProblems(index).length, indexProblems(index).join("; "));
  for (const id of canceled) {
    const e = editions[id], want = expected[id]?.setsPerDay?.reduce((a, b) => a + b, 0);
    ok(e && e.status === "canceled" && e.sets.length === want, `${id}: the edition file must keep all ${want} printed sets and say it was canceled (has ${e?.sets.length}, status ${e?.status})`);
  }
  const billings = JSON.parse(readFileSync(join(ROOT, "data/artists/billings.json"), "utf8"));
  const registry = JSON.parse(readFileSync(join(ROOT, "data/artists/registry.json"), "utf8"));
  const credited = id => billings.some(b => b.festivalId === id) || registry.some(a => a.billings.some(x => x.startsWith(id + ":")));
  ok(billings.length > 1000 && billings.some(b => b.festivalId === "nocturnal-wonderland-2022"), "control: billings.json carries Nocturnal Wonderland 2022");
  for (const id of canceled) ok(!credited(id), `the artist registry credits sets from canceled ${id}`);
  // The stage lineages (data/artists/stages.json, hand-written) may keep a
  // canceled edition only as a canceledEditions record carrying the
  // registry's sources, never in a name's held `editions` list.
  const lineageProblems = doc => Object.values(doc.brands).flatMap(br => br.lineages).flatMap(l => l.names.flatMap(nm => [
    ...canceled.filter(id => (nm.editions || []).includes(id)).map(id => `${l.id} "${nm.printed}" lists canceled ${id} as held`),
    ...(nm.canceledEditions || []).flatMap(c => {
      const m = EDITIONS[c.id];
      if (m?.status !== "canceled") return [`${l.id} "${nm.printed}" marks ${c.id} canceled, the edition registry does not`];
      const want = m.canceled.sources.map(x => x.url).sort().join(" "), got = (c.sources || []).map(x => x.url).sort().join(" ");
      return got === want ? [] : [`${l.id} "${nm.printed}": ${c.id}'s sources differ from the edition registry`];
    })]));
  const stagesDoc = JSON.parse(readFileSync(join(ROOT, "data/artists/stages.json"), "utf8"));
  ok(!lineageProblems(stagesDoc).length, lineageProblems(stagesDoc).slice(0, 4).join("; "));
  const marked = Object.values(stagesDoc.brands).flatMap(br => br.lineages).flatMap(l => l.names).filter(nm => (nm.canceledEditions || []).some(c => c.id === "nocturnal-wonderland-2024"));
  ok(marked.length === 4, `the 4 Nocturnal stage names that printed the 2024 grid must keep it as a canceled-edition record (found ${marked.length})`);
  ok(Object.values(stagesDoc.brands).flatMap(br => br.lineages).some(l => l.names.some(nm => nm.editions.includes("nocturnal-wonderland-2022"))), "control: lineages list Nocturnal Wonderland 2022 as held");
  { const m = clone(stagesDoc), nm = Object.values(m.brands).flatMap(br => br.lineages).flatMap(l => l.names).find(x => x.canceledEditions);
    nm.editions.push("nocturnal-wonderland-2024"); mutations++; ok(lineageProblems(m).length > 0, "mutation not caught: a lineage listing the canceled edition as held"); }
  { const m = clone(stagesDoc), nm = Object.values(m.brands).flatMap(br => br.lineages).flatMap(l => l.names).find(x => x.canceledEditions);
    nm.canceledEditions[0].sources.pop(); mutations++; ok(lineageProblems(m).length > 0, "mutation not caught: a lineage's canceled record missing a source"); }
  // The app: the compiled screen's own list function, against an index that
  // (stale or hand-served) still lists a canceled edition with its status.
  const vm = await import("node:vm");
  const appList = src => { const c = { React: {}, console }; vm.createContext(c); vm.runInContext(src + "\n;globalThis.__f = { pastEditionsOf };", c); return c.__f; };
  const src = readFileSync(join(ROOT, "build/historical.js"), "utf8");
  const fx = { editions: [
    { id: "nocturnal-wonderland-2024", festivalId: "nocturnal-wonderland", year: 2024, status: "canceled" },
    { id: "nocturnal-wonderland-2022", festivalId: "nocturnal-wonderland", year: 2022 }] };
  const shown = f => f.pastEditionsOf(fx, "nocturnal-wonderland-2026").map(e => e.id);
  ok(JSON.stringify(shown(appList(src))) === JSON.stringify(["nocturnal-wonderland-2022"]), `the app offers a canceled edition: ${shown(appList(src))}`);
  // Mutants.
  const nw = editions["nocturnal-wonderland-2024"];
  const meta = EDITIONS["nocturnal-wonderland-2024"], keep = clone(meta);
  const withMeta = (label, change, by) => { change(meta); try { mustFail(label, () => {}, nw, () => {}, by); } finally { Object.keys(meta).forEach(k => delete meta[k]); Object.assign(meta, clone(keep)); } };
  withMeta("canceled with one source", m => m.canceled.sources.pop(), /two dated sources/);
  withMeta("a source published after the first day", m => { m.canceled.sources[1].published = "2024-09-20"; }, /two dated sources/);
  withMeta("both sources from one publisher", m => { m.canceled.sources[1].url = m.canceled.sources[0].url + "?b"; }, /two dated sources/);
  withMeta("canceled with no announcement date", m => { delete m.canceled.announced; }, /announcement/);
  mustFail("the edition file drops its canceled status", m => { delete m.status; }, nw, () => {}, /status differs/);
  mutations++; ok(indexProblems({ editions: [...index.editions, { id: "nocturnal-wonderland-2024" }] }).length > 0, "mutation not caught: an index that lists the canceled edition");
  ok(credited("nocturnal-wonderland-2022"), "control: the credit check finds a real edition's sets (else the canceled check passes vacuously)");
  const unguarded = src.replace(/\.filter\(e => e\.status !== "canceled"\)/, "");
  ok(unguarded !== src, "the app's canceled guard pattern must be present in build/historical.js for its mutant");
  mutations++; ok(shown(appList(unguarded)).includes("nocturnal-wonderland-2024"), "mutation not caught: the app with no canceled guard");
}

// Own process: it isolates the cache dir and stubs fetch.
{
  checks++;
  try {
    const out = execFileSync(process.execPath, [join(ROOT, "scripts/test-wayback-cache.mjs")],
      { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
    process.stdout.write(out.trimEnd().replace(/^/gm, "  ") + "\n");
  } catch (e) { fails.push(`wayback cache: ${(e.stdout || "") + (e.stderr || "")}`.trim()); }
}

if (fails.length) { fails.forEach(f => console.error(`  ✗ ${f}`)); console.error(`  ${fails.length} of ${checks} historical-edition checks failed`); process.exit(1); }
console.log(`  ✓ historical editions: ${files.length} edition(s) valid, ${checks} checks (${mutations} mutations, each caught), identity read off the page, isolated from the live app`);
