#!/usr/bin/env node
// Item 3a, Jake's pick A (Oct 18): each stage on Lineup's overview keeps a
// stable hue. Holds the contract:
//   tokens   --lane-1..6 exist in Dark and Light, each >= 3:1 (non-text, WCAG
//            1.4.11) on --paper and --paper-3 (the overview's ground and --s3);
//   door     LineupOverview colours lanes through stageLaneHue() only, in map
//            order mod 6;
//   picked   the capture-only options B and C (the localStorage variant flag,
//            names on sets, tinted faces) are gone.
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
let checks = 0, failed = 0;
const check = (ok, msg) => { checks++; if (!ok) { failed++; console.log(`  ✗  ${msg}`); } };

const html = readFileSync(join(ROOT, "index.html"), "utf8");
const src = readFileSync(join(ROOT, "lineup.jsx"), "utf8");

// Every `:root[data-mode="X"]{…}` block, later declarations win (the cascade).
function tokens(mode) {
  const out = {};
  const re = new RegExp(`:root\\[data-mode="${mode}"\\]\\{([^}]*)\\}`, "g");
  for (const m of html.matchAll(re)) {
    for (const d of m[1].matchAll(/--([\w-]+)\s*:\s*(#[0-9a-fA-F]{6})\b/g)) out[d[1]] = d[2];
  }
  return out;
}
const lum = hex => {
  const c = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map(v => v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
};
const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };

for (const mode of ["dark", "light"]) {
  const t = tokens(mode);
  for (const g of ["paper", "paper-3"]) check(!!t[g], `${mode}: --${g} is found (the parser broke?)`);
  for (let n = 1; n <= 6; n++) {
    const c = t[`lane-${n}`];
    check(!!c, `${mode}: --lane-${n} is defined`);
    if (!c) continue;
    for (const g of ["paper", "paper-3"]) {
      if (!t[g]) continue;
      const r = ratio(c, t[g]);
      check(r >= 3, `${mode}: --lane-${n} ${c} on --${g} ${t[g]} is ${r.toFixed(2)}:1 (needs >= 3:1)`);
    }
  }
}

const at = src.indexOf("function LineupOverview(");
const ov = at < 0 ? "" : src.slice(at, at + 6000);
check(/function stageLaneHue\(stageId\)/.test(src), "lineup.jsx: stageLaneHue() is the one door for stage colour");
check(/\(i % 6\) \+ 1/.test(src), "stageLaneHue assigns lanes in map order, mod 6");
check(/const hue = stageLaneHue\(stage\.id\)/.test(ov), "LineupOverview colours each lane through stageLaneHue (A is the default, no flag)");
check(/data-lane-chip/.test(ov), "each stage name carries its hue chip");
check(!/plursky_lineup_overview|LINEUP_OVERVIEW_VARIANT/.test(src), "the capture-only variant flag is gone");
check(!/OVERVIEW_NAME_MIN_PX|data-overview-set/.test(src), "option B (names on sets) is gone");
check(!/--lane-\dw/.test(html) && !/tint=\{/.test(src), "option C (tinted faces, --lane-Nw washes) is gone");

if (failed) { console.log(`✗ lineup stage hues: ${failed} of ${checks} checks failed`); process.exit(1); }
console.log(`✓ lineup stage hues: ${checks} checks (6 lanes >= 3:1 on paper and s3 in both modes; one door; B and C removed)`);
