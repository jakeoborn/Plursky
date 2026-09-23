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
import { buildEdition, performerKeys, artistKey } from "./historical/build-editions.mjs";
import { EDITIONS } from "./historical/editions.mjs";
import { datedLabel, instant, to24 } from "./historical/lib.mjs";
import { dayTabs, sheetRow } from "./historical/extract-insomniac.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const H = p => join(ROOT, "data/historical", p);
const fails = [];
let checks = 0, mutations = 0;
const ok = (cond, msg) => { checks++; if (!cond) fails.push(msg); };
const clone = x => JSON.parse(JSON.stringify(x));

const expected = JSON.parse(readFileSync(H("expected-counts.json"), "utf8"));
const reviewFor = id => existsSync(H(`review/${id}.json`)) ? JSON.parse(readFileSync(H(`review/${id}.json`), "utf8")) : undefined;
const files = existsSync(H("editions")) ? readdirSync(H("editions")).filter(f => f.endsWith(".json")) : [];
ok(files.length >= 2, `expected at least the 2 structured editions, found ${files.length}`);

// ── 1. shipped editions are valid and generated ──
const editions = {};
for (const f of files) {
  const e = editions[f.replace(/\.json$/, "")] = JSON.parse(readFileSync(H(`editions/${f}`), "utf8"));
  const p = validateEdition(e, { expected: expected[e.id], review: reviewFor(e.id) });
  ok(!p.length, `${e.id} is invalid:\n      ${p.slice(0, 8).join("\n      ")}`);
}
try { execFileSync(process.execPath, ["scripts/historical/build-editions.mjs", "--check"], { cwd: ROOT, stdio: "pipe" }); ok(true); }
catch (e) { ok(false, `an edition file differs from what its sheet builds:\n${e.stdout}${e.stderr}`); }

// ── 2. mutations: each must be caught ──
const base = editions["hard-summer-2025"];
const edc = editions["edc-las-vegas-2025"];
const mustFail = (label, mutate, e = base) => {
  const m = clone(e); mutate(m); mutations++;
  const p = validateEdition(m, { expected: expected[e.id], review: reviewFor(e.id) });
  ok(p.length > 0, `mutation not caught: ${label}`);
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
  mustFail("fireworks dropped (EDC)", m => { m.events.pop(); }, edc);
  mustFail("Cyrillic look-alike in a billing (Lolla OCR)", m => { m.artists[0].name = "ОTОBOKE BEAVER"; });
  const lolla = editions["lollapalooza-2025"], acl = editions["acl-2025"];
  if (lolla && acl) {
    const withReview = (label, mutateEdition, mutateReview, e) => {
      const m = clone(e), r = clone(reviewFor(e.id)); mutateEdition(m); mutateReview(r); mutations++;
      ok(validateEdition(m, { expected: expected[e.id], review: r }).length > 0, `mutation not caught: ${label}`);
    };
    withReview("reviewed graphic hash differs from the shipped provenance", () => {}, r => { r.days[0].sha256 = "0".repeat(64); }, lolla);
    withReview("fewer rows confirmed against pixels than shipped", () => {}, r => { r.days[1].rowsConfirmed -= 1; }, lolla);
    withReview("unsigned review", () => {}, r => { delete r.days[2].reviewer; }, lolla);
    mutations++;
    ok(validateEdition(clone(acl), { expected: expected[acl.id], review: undefined }).length > 0, "mutation not caught: ACL with no review manifest");
    withReview("Silent Disco turned into an artist set", m => { const ev = m.events.pop(); m.artists.push({ id: `${m.id}:silent-disco`, name: "SILENT DISCO" }); m.sets.push({ ...ev, id: ev.id + "-x", artistId: `${m.id}:silent-disco` }); }, () => {}, acl);
  }
  mustFail("image-derived edition with no review manifest", m => { m.provenance.extractionMethod = "official_image_transcription"; m.provenance.captures.forEach(c => { c.pageArchivedUrl = c.archivedUrl; }); });
}

// An edition that is valid as lineup_only must be accepted without times.
if (base) {
  const lo = clone(base);
  lo.completeness = "lineup_only"; lo.sets = []; lo.stages = []; lo.events = [];
  ok(validateEdition(lo, {}).length === 0, `a clean lineup_only edition was rejected: ${validateEdition(lo, {}).join("; ")}`);
}

// ── operational rows and artist keys ──
{
  const led = { official: "x", days: [{ day: 1, archivedUrl: "u", chosen: "t", sha256: "h" }] };
  const e = buildEdition("edc-las-vegas-2025", [
    { day: "1", stage: "Kinetic Field", start: "01:41", end: "01:47", artist: "Fireworks" },
    { day: "1", stage: "Kinetic Field", start: "01:47", end: "02:57", artist: "Illenium B2B SLANDER" },
    { day: "1", stage: "Ubuntu", start: "22:00", end: "23:30", artist: "Special Guest" },
  ], led);
  ok(e.events.length === 1 && e.events[0].label === "Fireworks", "Fireworks must become an operational event");
  ok(!e.artists.some(a => /fireworks/i.test(a.name)), "Fireworks must never be an artist");
  ok(e.artists.find(a => a.name === "Special Guest")?.key === null, "an unnamed slot gets no cross-edition artist key");
  ok(JSON.stringify(performerKeys("Illenium B2B SLANDER")) === '["illenium","slander"]', "B2B splits into performer keys");
  ok(JSON.stringify(performerKeys("Chase & Status")) === '["chase-and-status"]', "an act with & in its name stays one performer");
  ok(artistKey("RÜFÜS DU SOL") === artistKey("Rufus Du Sol"), "artist keys fold case and accents across editions");
}

// ── dates come from the page, not from editions.mjs alone ──
const MONTH = ["JANUARY","FEBRUARY","MARCH","APRIL","MAY","JUNE","JULY","AUGUST","SEPTEMBER","OCTOBER","NOVEMBER","DECEMBER"];
for (const [id, e] of Object.entries(editions)) {
  const led = JSON.parse(readFileSync(H(`ledger/${id}.json`), "utf8")), rev = reviewFor(id);
  for (const d of e.days) {
    if (led.method === "structured_html") {
      ok(led.days.find(x => x.day === d.day)?.date === d.date, `${id} day ${d.day}: ${d.date} is not what the archived page's day tab printed`);
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
  const walk = d => readdirSync(d, { withFileTypes: true }).flatMap(x => x.isDirectory() ? walk(join(d, x.name)) : [join(d, x.name)]);
  const art = walk(H("")).filter(f => /\.(png|jpe?g|webp|gif|svg|html?)$/i.test(f));
  ok(!art.length, `archived creative assets must never be committed: ${art.join(", ")}`);
}

if (fails.length) { fails.forEach(f => console.error(`  ✗ ${f}`)); console.error(`  ${fails.length} of ${checks} historical-edition checks failed`); process.exit(1); }
console.log(`  ✓ historical editions: ${files.length} edition(s) valid, ${checks} checks (${mutations} mutations, each caught), identity read off the page, isolated from the live app`);
