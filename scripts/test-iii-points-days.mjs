#!/usr/bin/env node
// III Points 2026: every act's day is the official lineup-by-day graphic's.
//
// The graphic (FRIDAY OCTOBER 16 / SATURDAY OCTOBER 17) is transcribed in
// docs/qa/reports/iii-points-2026-day-split/graphic.tsv. The lineup itself is
// the official list page, which is newer; the module header records how the
// two are joined. This holds that join in both directions:
//   - every graphic row is an act on that day, or a GRAPHIC_ONLY record on
//     that day (billed on the graphic, not on the list);
//   - every act with a day is on the graphic on that day, and every act
//     without one is `unscheduled` and absent from the graphic;
//   - a B2B billed on the graphic keeps the graphic's member order;
//   - nothing places an act in space or time: the graphic has no stage and
//     no set time, so no act has either and the festival stays scheduleTBA.
// Each rule is proven live by an in-process mutation that must fail it.
import { readFileSync } from "node:fs";
import vm from "node:vm";

let checks = 0, failed = 0;
const check = (ok, msg) => { checks++; if (!ok) { failed++; console.log(`  ✗  ${msg}`); } };

const ctx = { window: {} }; vm.createContext(ctx);
vm.runInContext(readFileSync("data/festivals/iii-points-2026.js", "utf8"), ctx);
const M = ctx.window.PLURSKY_FESTIVALS["iii-points-2026"];
const rows = readFileSync("docs/qa/reports/iii-points-2026-day-split/graphic.tsv", "utf8").split("\n")
  .filter(l => l && !l.startsWith("#") && !l.startsWith("day\t")).map(l => { const [day, zone, billing] = l.split("\t"); return { day: +day, zone, billing }; });

const fold = s => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/\((live|hybrid|dj set)\)/g, "")
  .replace(/0/g, "o").replace(/1/g, "i").replace(/[^a-z0-9¥ø$€+]/g, "");
const members = s => s.split(/\s+B2B\s+/i).map(fold);
const key = s => members(s).sort().join("|");
// Graphic billing → list billing, where the two print one act differently.
// Each is recorded in the module header; the last three are the one-member
// inferences (the graphic bills one member, the list a B2B with them).
const ALIAS = { "Malóne Morez B2B Miluhska": "Malóne B2B Miluhska", "Maccabiii B2B Pezlo MD": "Maccabi B2B Pezlo MD",
  "ITBSP": "1tbsp", "Fiuza": "FIUZA B2B Madison Kay", "SEL.6": "SEL.6 B2B Playshado", "Day/Dem": "Bricolage B2B DAY/DEM" };
const ONE_MEMBER = ["Fiuza", "SEL.6", "Day/Dem"];

const run = (artists, graphicOnly) => {
  const bad = [];
  const byKey = new Map(artists.map(a => [key(a.name), a]));
  const onlyKey = new Map((graphicOnly || []).map(r => [key(r.billing), r]));
  const seen = new Set();
  for (const r of rows) {
    const a = byKey.get(key(ALIAS[r.billing] || r.billing));
    if (a) {
      seen.add(a.id);
      if (a.day !== r.day) bad.push(`${a.name}: day ${a.day}, the graphic says ${r.day}`);
      if (/ B2B /i.test(r.billing) && !ALIAS[r.billing] && members(a.name).join("|") !== members(r.billing).join("|"))
        bad.push(`${a.name}: B2B order is not the graphic's ("${r.billing}")`);
    } else {
      const o = onlyKey.get(key(r.billing));
      if (!o) bad.push(`graphic "${r.billing}" (day ${r.day}) is neither an act nor a GRAPHIC_ONLY record`);
      else if (o.day !== r.day) bad.push(`GRAPHIC_ONLY "${r.billing}": day ${o.day}, the graphic says ${r.day}`);
    }
  }
  for (const a of artists) {
    if (a.day != null && !seen.has(a.id)) bad.push(`${a.name}: has day ${a.day} but is not on the graphic`);
    if (a.day == null && (!a.unscheduled || seen.has(a.id))) bad.push(`${a.name}: no day, so it must be unscheduled and off the graphic`);
    if (a.stage != null || a.start || a.end) bad.push(`${a.name}: carries a stage or a time the graphic does not have`);
  }
  return bad;
};

const bad = run(M.artists, M.graphicOnly);
bad.forEach(b => check(false, b));
checks += 1; // the join as a whole
check(rows.length === 217 && rows.filter(r => r.day === 1).length === 108 && rows.filter(r => r.day === 2).length === 109,
  `the transcription is the whole graphic: 217 entries, 108 Friday, 109 Saturday (${rows.length})`);
const count = d => M.artists.filter(a => a.day === d).length;
check(M.artists.length === 229 && count(1) === 105 && count(2) === 108 && count(null) === 16,
  `229 acts: 105 Friday, 108 Saturday, 16 with no day (${M.artists.length}: ${count(1)}, ${count(2)}, ${count(null)})`);
const dd = M.config.dayDates;
check(Object.keys(dd).join() === "1,2" && dd[1].d === 16 && dd[1].m === 9 && dd[1].name === "Friday" && dd[2].d === 17 && dd[2].name === "Saturday",
  "the days are Friday Oct 16 and Saturday Oct 17");
check(M.registry.available === true && M.registry.scheduleTBA === true && M.stages.length === 0, "open on its lineup, set times pending, no stages");
check(ONE_MEMBER.every(b => { const a = M.artists.find(x => key(x.name) === key(ALIAS[b])); return a && a.day === rows.find(r => r.billing === b).day; }),
  "the three one-member inferences are the ones the header names, each on its member's day");
check((M.graphicOnly || []).map(r => r.billing).sort().join("|") === ["GZA performing Liquid Swords", "Jencarlos", "Mr. Brown", "Underscores"].sort().join("|"),
  `graphic-only records: Underscores, GZA, Mr. Brown, Jencarlos (${(M.graphicOnly || []).map(r => r.billing).join(", ")})`);

// Mutations: each must be caught by run().
const clone = x => JSON.parse(JSON.stringify(x));
const mutate = (label, f) => { const arts = clone(M.artists), go = clone(M.graphicOnly || []); f(arts, go); check(run(arts, go).length > 0, `mutation not caught: ${label}`); };
mutate("an act moved to the other day", a => { a.find(x => x.name === "Four Tet").day = 1; });
mutate("a B2B back in the list's alphabetical order", a => { a.find(x => x.id === "iiip-artime-b2b-mystic-bill").name = "Artime B2B Mystic Bill"; });
mutate("an unscheduled act given a day", a => { a.find(x => x.name === "Blind Fish").day = 2; });
mutate("a graphic-only act dropped from the records", (a, go) => { go.splice(go.findIndex(r => r.billing === "Underscores"), 1); });
mutate("a stage invented for an act", a => { a[0].stage = "main"; });
mutate("an act on the graphic lost", a => { a.splice(a.findIndex(x => x.name === "Underworld"), 1); });

console.log(`  ${failed ? "✗" : "✓"}  III Points day split: ${checks - failed}/${checks} checks, 6 mutations`);
process.exit(failed ? 1 : 0);
