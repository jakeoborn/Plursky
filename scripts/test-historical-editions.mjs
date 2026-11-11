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
import { lineupDropReason, ACTIVITIES, EDITIONS, KEPT_STAGES, dropReason } from "./historical/editions.mjs";
import { activeTab, parseDayTabs, stageFor } from "./historical/import-gather.mjs";
import { datedLabel, graphicPrints, instant, sameGraphic, to24 } from "./historical/lib.mjs";
import { dayTabs, sheetRow } from "./historical/extract-insomniac.mjs";
import { parseLineupPage, provesEdition, lineupRows } from "./historical/extract-insomniac-lineup.mjs";
import { parseAclSchedule, axisMinutes, readAxis } from "./historical/acl-schedule.mjs";

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
    if (led.method === "official_lineup_html") {
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
    for (const d of e.days) ok(e.artists.some(a => a.appearances.some(x => x.day === d.day)), `${e.id}: day ${d.day} has no billed artist`);
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
