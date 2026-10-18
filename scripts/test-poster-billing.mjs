#!/usr/bin/env node
// Item 4: III Points tiers are its official poster billing, row by row.
//   1. The module's BILLING block and the report are fresh (generator --check).
//   2. Loaded as the app loads it, every act's tier and tierSource match the
//      report: poster-tiered acts carry the zone's tier and "poster"; acts the
//      graphic does not bill keep tier 2 and no source.
//   3. "Top billed" (isTopBilled in data.jsx) is true exactly for poster tier 3,
//      never for a set-time tier 3 (EDC LV's are a time-of-night guess).
import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
let checks = 0, failed = 0;
const check = (ok, msg) => { checks++; if (!ok) { failed++; if (failed <= 12) console.log(`  ✗ ${msg}`); else if (failed === 13) console.log("  ✗ … (further failures not printed)"); } };

try { execFileSync(process.execPath, ["scripts/build-poster-billing.mjs", "--check"], { cwd: ROOT, stdio: "pipe" }); check(true, ""); }
catch (e) { check(false, `generator --check: ${String(e.stderr || e.stdout).trim()}`); }

// Load a festival module the way index.html does: a classic script on window.
const loadModule = fid => {
  const win = {}; win.window = win;
  vm.runInNewContext(readFileSync(join(ROOT, "data", "festivals", `${fid}.js`), "utf8"), win);
  return (win.PLURSKY_FESTIVALS || {})[fid] || null;
};
const mod = loadModule("iii-points-2026");
check(!!mod && Array.isArray(mod.artists), "iii-points-2026 module loads with an artists list");
const acts = new Map((mod?.artists || []).map(a => [a.id, a]));

const rows = readFileSync(join(ROOT, "docs/qa/reports/iii-points-2026-billing/billing.tsv"), "utf8").split("\n");
const head = rows.findIndex(l => l.startsWith("act_id\t"));
let n = 0;
for (const l of rows.slice(head + 1)) {
  if (!l.trim() || l.startsWith("#")) break;
  const [id, name, , zone, tier] = l.split("\t");
  const a = acts.get(id); n++;
  if (!a) { check(false, `${id} (${name}) is in the report but not in the module`); continue; }
  if (tier) check(a.tier === Number(tier) && a.tierSource === "poster", `${name}: ${zone} → tier ${tier} (module: ${a.tier}, ${a.tierSource})`);
  else check(a.tier === 2 && !a.tierSource, `${name}: not on the graphic → tier 2, no source (module: ${a.tier}, ${a.tierSource})`);
}
check(n >= 200, `the report has every act row (${n}; the scan broke?)`);
check(n === acts.size, `report rows (${n}) = module acts (${acts.size})`);

// isTopBilled, as data.jsx defines it.
const src = readFileSync(join(ROOT, "data.jsx"), "utf8");
const fn = src.match(/function isTopBilled\(a\) \{[^\n]*\}/);
check(!!fn, "data.jsx defines isTopBilled");
const isTopBilled = fn ? vm.runInNewContext(`(${fn[0]})`) : () => null;
const top = [...acts.values()].filter(isTopBilled);
check(top.length === [...acts.values()].filter(a => a.tier === 3).length && top.length === 44, `Top billed = the 44 poster tier-3 acts (centre + 444 on the graphic, fakemink no longer in the lineup) (got ${top.length})`);
check(top.some(a => /PAWSA/i.test(a.name)) && top.some(a => /Four Tet/i.test(a.name)), "control — PAWSA and Four Tet (centre oval) are Top billed");
check(!isTopBilled({ tier: 3 }) && !isTopBilled({ tier: 3, tierSource: null }), "a set-time tier 3 is never Top billed");
check(!isTopBilled({ tier: 2, tierSource: "poster" }), "a poster ring act (tier 2) is not Top billed");


// 4. Wording (Jake, Oct 18): "Top billed" wherever the tier comes from the
// poster. topTierLabel() answers for the festival; every tier-3 label calls it.
const lab = src.match(/function posterBilled\(\) \{[^\n]*\}\nfunction topTierLabel\(plural = false\) \{[^\n]*\}/);
check(!!lab, "data.jsx defines posterBilled + topTierLabel");
if (lab) {
  const at = cfg => vm.runInNewContext(`const TOP_BILLED = "Top billed"; ${lab[0]}; [topTierLabel(), topTierLabel(true)]`, { FESTIVAL_CONFIG: cfg });
  const p = at({ posterBilling: { url: "x" } }), t = at({});
  check(p[0] === "Top billed" && p[1] === "Top billed", `a poster-tiered festival says "Top billed" (got ${p.join(" / ")})`);
  check(t[0] === "Headliner" && t[1] === "Headliners", `a set-time-tiered festival keeps "Headliner" (got ${t.join(" / ")})`);
}
check(!!mod?.config?.posterBilling?.url, "III Points carries posterBilling (so it says Top billed)");
const home = readFileSync(join(ROOT, "home.jsx"), "utf8"), lineup = readFileSync(join(ROOT, "lineup.jsx"), "utf8");
check(/id: "headliners", label: topTierLabel\(true\)/.test(home) && /case "headliners": return \{ title: topTierLabel\(true\)/.test(home), "the essentials sheet is named by topTierLabel");
check(/opt\("tierFilter", "head", topTierLabel\(true\)\)/.test(lineup), "Lineup's tier filter is named by topTierLabel");
check(!/"Headliners?"/.test(lineup.replace(/topTierLabel[^\n]*/g, "")), "lineup.jsx has no other hardcoded Headliner label");
// The tier sheet picks its top three PER NIGHT: a festival-wide top nine
// gave every slot to night one once 22+ acts a night are poster tier 3.
const hh = home.slice(home.indexOf("function HeadlinerHighlights("), home.indexOf("function HeadlinerHighlights(") + 2500);
check(!/\.slice\(0, 9\)/.test(hh) && /top\.filter\(a => a\.day === d\)\.slice\(0, 3\)/.test(hh), "the Top billed sheet takes three per night, not nine festival-wide");
const perNight = [1, 2].map(d => [...acts.values()].filter(a => a.day === d && a.tier === 3).length);
check(perNight.every(n => n >= 3), `every night has >= 3 poster tier-3 acts to show (got ${perNight.join(" / ")})`);
if (failed) { console.log(`✗ poster billing: ${failed} of ${checks} checks failed`); process.exit(1); }
console.log(`✓ poster billing: ${checks} checks (III Points tiers match the official graphic row by row; Top billed only from the poster)`);
