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
import { validateEdition } from "./historical/validate.mjs";
import { buildEdition, droppedRows, performerKeys, artistKey, readSheet } from "./historical/build-editions.mjs";
import { ACTIVITIES, EDITIONS } from "./historical/editions.mjs";
import { datedLabel, graphicPrints, instant, to24 } from "./historical/lib.mjs";
import { dayTabs, sheetRow } from "./historical/extract-insomniac.mjs";

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
    ...Object.entries(ACTIVITIES).flatMap(([id, list]) => list.map(a => [id, a]))];
  for (const [id, billing] of dropSamples) {
    const e = editions[id]; if (!e) continue;
    const back = { id: `${id}:back`, name: billing, key: artistKey(billing), performers: performerKeys(billing) };
    mustFail(`${billing} back as an artist set`, m => { m.artists.push(back); m.sets.push({ ...m.sets[0], id: `${m.sets[0].id}-${artistKey(billing)}`, artistId: back.id }); }, e, undefined, /: dropped /);
    mustFail(`${billing} back as an event`, m => { m.events = [{ id: `${id}:d1:x:0000:${artistKey(billing)}`, label: billing, day: 1, stageId: m.stages[0].id, start: "20:00", end: "21:00" }]; }, e, undefined, /: dropped .*appears/);
    mustFail(`${billing} back as a stage`, m => { m.stages[0].name = billing; }, e, undefined, /: dropped /);
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
  const lo = clone(base);
  lo.completeness = "lineup_only"; lo.sets = []; lo.stages = [];
  ok(validateEdition(lo, {}).length === 0, `a clean lineup_only edition was rejected: ${validateEdition(lo, {}).join("; ")}`);
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
  const printed = new Set(readSheet(H(`sheets/${id}.tsv`)).map(r => `${r.day}|${r.stage}|${r.start}|${r.artist}`));
  for (const r of droppedFor(id)) ok(printed.has(`${r.day}|${r.stage}|${r.start}|${r.billing}`) && r.reason, `${id}: recorded drop ${r.billing} is not a printed row, or has no reason`);
}

// ── dates come from the page, not from editions.mjs alone ──
const MONTH = ["JANUARY","FEBRUARY","MARCH","APRIL","MAY","JUNE","JULY","AUGUST","SEPTEMBER","OCTOBER","NOVEMBER","DECEMBER"];
for (const [id, e] of Object.entries(editions)) {
  const led = JSON.parse(readFileSync(H(`ledger/${id}.json`), "utf8")), rev = reviewFor(id);
  for (const d of e.days) {
    if (led.method === "structured_html") {
      ok(led.days.find(x => x.day === d.day)?.date === d.date, `${id} day ${d.day}: ${d.date} is not what the archived page's day tab printed`);
    } else if (led.method === "official_sources") {
      // Every source cited for a day prints that day: a page's own day tab,
      // or the header read off a graphic (weekday, month, day of month).
      const [, m, dd] = d.date.split("-").map(Number);
      const wd = new Date(d.date + "T12:00:00Z").toLocaleDateString("en-US", { weekday: "long", timeZone: "UTC" }).toUpperCase();
      const srcs = led.days.find(x => x.day === d.day)?.sources || [];
      ok(srcs.length > 0, `${id} day ${d.day}: no source in the ledger`);
      for (const s of srcs) {
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
  const { joinLineup, LINEUP_PAGES } = await import("./historical/check-insomniac-lineup.mjs");
  for (const id of Object.keys(EDITIONS).filter(id => EDITIONS[id].year >= 2026 && existsSync(H(`editions/${id}.json`)))) {
    const lc = JSON.parse(readFileSync(H(`ledger/${id}.json`), "utf8")).lineupCheck;
    ok(lc && lc.billings > 0 && !lc.unmatched.length && lc.matched + lc.aliased.length === lc.billings,
      `${id}: no clean lineup check in its ledger (${lc ? `${lc.unmatched.length} unmatched of ${lc.billings}` : "missing"}) — run check-insomniac-lineup.mjs`);
    ok(lc && /^https:\/\/web\.archive\.org\/web\/\d{14}\//.test(lc.archivedUrl) && /^[0-9a-f]{64}$/.test(lc.sha256) && (lc.title.includes(EDITIONS[id].name) || (lc.staleTitle && LINEUP_PAGES[id]?.staleTitle === lc.title && lc.identityText === LINEUP_PAGES[id]?.identityText)),
      `${id}: the lineup check must cite an archived capture, its hash, and a page titled ${EDITIONS[id].name}`);
    ok(!!LINEUP_PAGES[id], `${id}: no LINEUP_PAGES entry`);
  }
  const j = joinLineup(["A", "B B2B C", "Diesel"], ["A", "B B2B C", "DJ Diesel"], { "Diesel": "DJ Diesel" });
  ok(!j.unmatched.length && j.matched === 2 && j.aliased.length === 1, "joinLineup matches billings and a listed alias");
  mutations++; ok(joinLineup(["A", "Missing Act"], ["A"]).unmatched.length === 1, "mutation not caught: a billed act with no set");
  mutations++; ok(joinLineup(["Diesel"], ["DJ Diesel"]).unmatched.length === 1, "mutation not caught: an alias nobody listed");
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
  ok(/'data\/historical\/index\.json'/.test(bld) && /'historical', 'editions'/.test(bld) && !/sheets|ledger|'review'/.test(bldHist),
    "build.mjs must ship data/historical/index.json and editions/*.json only (sheets, ledgers and review manifests stay out of the app)");
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

if (fails.length) { fails.forEach(f => console.error(`  ✗ ${f}`)); console.error(`  ${fails.length} of ${checks} historical-edition checks failed`); process.exit(1); }
console.log(`  ✓ historical editions: ${files.length} edition(s) valid, ${checks} checks (${mutations} mutations, each caught), identity read off the page, isolated from the live app`);
