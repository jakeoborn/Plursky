#!/usr/bin/env node
// assemble-ocr.mjs — OCR lines from one official schedule grid → CANDIDATE rows.
//
//   node scripts/historical/assemble-ocr.mjs <ocr.jsonl> --header Y0,Y1 --grid-bottom Y --axis-x X [--pm-before H]
//
// The graphics are grids: stage headers across the top, then per stage a
// column of blocks, each one or more name lines above a "H:MM - H:MM" line
// (a closing headliner prints only its start). A line is put in the column
// whose header centre is nearest. Everything below --grid-bottom (the small
// footer strips some festivals print) is left for hand transcription.
//
// Output is a candidate TSV on stdout. It is NOT data: every row is checked
// against the pixels and corrected in the review manifest before it ships.
//
// Printed times carry no AM/PM. These are daytime festivals, so an hour below
// --pm-before (default 11) is PM and 11/12 are as printed (11:30 AM, 12:15 PM).

import { readFileSync } from "node:fs";

const argv = process.argv.slice(2);
const flag = k => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : null; };
const [h0, h1] = (flag("--header") || "0,0").split(",").map(Number);
const bottom = +flag("--grid-bottom"), axisX = +(flag("--axis-x") || 0), pmBefore = +(flag("--pm-before") || 11);

const lines = readFileSync(argv[0], "utf8").split("\n").filter(Boolean).map(l => JSON.parse(l))
  // The ASL-interpreted-set glyph OCRs as "6g"/"bg"/"69"; it is not billing.
  .map(l => ({ ...l, t: l.t.replace(/(^|\s)(6g|bg|69|6y|by|Gg)(?=\s|$)/g, " ").replace(/\s+/g, " ").trim(), cx: l.x + l.w / 2, cy: l.y + l.h / 2 }))
  .filter(l => l.t);

const RANGE = /^(\d{1,2}):(\d{2})\s*[-–—~]\s*(\d{1,2}):(\d{2})$/;
const SINGLE = /^(\d{1,2}):(\d{2})$/;
export const to24 = (h, m) => {
  h = +h;
  if (h < pmBefore) h += 12;
  return `${String(h % 24).padStart(2, "0")}:${m}`;
};

// Header cells: text in the header band, merged per column by x overlap.
const heads = [];
for (const l of lines.filter(l => l.cy >= h0 && l.cy <= h1 && l.x > axisX).sort((a, b) => a.y - b.y)) {
  const c = heads.find(h => Math.abs(h.cx - l.cx) < Math.max(h.w, l.w) / 2);
  if (c) { c.parts.push(l.t); c.w = Math.max(c.w, l.w); } else heads.push({ cx: l.cx, w: l.w, parts: [l.t] });
}
heads.sort((a, b) => a.cx - b.cx);
const col = x => heads.reduce((best, h, i) => Math.abs(h.cx - x) < Math.abs(heads[best].cx - x) ? i : best, 0);

const body = lines.filter(l => l.cy > h1 && l.cy < bottom && l.x > axisX);
const rows = [];
heads.forEach((h, i) => {
  const mine = body.filter(l => col(l.cx) === i).sort((a, b) => a.cy - b.cy);
  let name = [];
  for (const l of mine) {
    const r = RANGE.exec(l.t), s = SINGLE.exec(l.t);
    if (r) { rows.push({ stage: h.parts.join(" "), start: to24(r[1], r[2]), end: to24(r[3], r[4]), artist: name.join(" "), y: Math.round(l.cy) }); name = []; }
    else if (s) { rows.push({ stage: h.parts.join(" "), start: to24(s[1], s[2]), end: "", artist: name.join(" "), openEnd: 1, y: Math.round(l.cy) }); name = []; }
    else if (/[A-Za-z]/.test(l.t) && l.h > 8) name.push(l.t);
  }
  if (name.length) rows.push({ stage: h.parts.join(" "), start: "", end: "", artist: name.join(" ") + "  ⚠ no time line", y: -1 });
});
const foot = lines.filter(l => l.cy >= bottom).map(l => l.t);

console.log(["stage", "start", "end", "artist", "openEnd", "y"].join("\t"));
// A candidate whose duration is not positive or runs past 4 hours is almost
// always a misread digit; flag it so review looks there first.
const mins = t => { const [h, m] = t.split(":").map(Number); return (h < 6 ? h + 24 : h) * 60 + m; };
for (const r of rows) if (r.start && r.end && (mins(r.end) <= mins(r.start) || mins(r.end) - mins(r.start) > 240)) r.artist += "  ⚠ duration";
for (const r of rows) console.log([r.stage, r.start, r.end, r.artist, r.openEnd ? 1 : "", r.y].join("\t"));
console.error(`# ${heads.length} stage headers: ${heads.map(h => h.parts.join(" ")).join(" | ")}`);
console.error(`# ${rows.length} grid rows; footer text for hand transcription: ${foot.join(" / ")}`);
