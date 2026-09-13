#!/usr/bin/env node
// Test for import-set-times.mjs against the REAL gated festival modules, in a
// throwaway copy of the data files so nothing in the repo is written.
//
// Covers the flip paths the Q4 queue needs:
//   A  a festival module is the default target (data/festivals/<id>.js)
//   B  --days-from-sheet: a lineup with no per-act day (CRSSD) takes the day
//      from the sheet, written as the tuple's 4th element
//   C  an act whose day is null (Escape's lineup-card acts) matches by name
//      and gets the sheet's day; an act with a real day keeps the 3-tuple
//   D  data.jsx is the target for a festival without a module (EDC Orlando)
//   E  refusals: a day-2 row without the flag, a festival with no stages,
//      and --days-from-sheet on a lineup that already has days
// The times in these sheets are test fixtures, written only into the copy.

import { mkdtempSync, mkdirSync, cpSync, readFileSync, writeFileSync, rmSync } from "node:fs";
import { spawnSync } from "node:child_process";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadRegistry } from "./lib/load-registry.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const tmp = mkdtempSync(path.join(os.tmpdir(), "plursky-import-"));
const fails = [];
const check = (ok, msg) => { if (!ok) fails.push(msg); };
try {
  mkdirSync(path.join(tmp, "scripts"));
  cpSync(path.join(root, "scripts", "import-set-times.mjs"), path.join(tmp, "scripts", "import-set-times.mjs"));
  cpSync(path.join(root, "data.jsx"), path.join(tmp, "data.jsx"));
  cpSync(path.join(root, "data", "festivals"), path.join(tmp, "data", "festivals"), { recursive: true });

  // CRSSD's config has one TBA day until the flip adds Sat/Sun; give the copy a day 2.
  const crssdFile = path.join(tmp, "data", "festivals", "crssd-fall-2026.js");
  const crssdSrc = readFileSync(crssdFile, "utf8");
  check(/dayDates: \{/.test(crssdSrc), "fixture: crssd-fall-2026.js has no `dayDates: {` to extend");
  writeFileSync(crssdFile, crssdSrc.replace(/dayDates: \{/, 'dayDates: { 2: { y: 2026, m: 8, d: 27, name: "Sunday", short: "SUN", midnightUtc: 0 },'));

  const before = loadRegistry(tmp).DS;
  const crssd = before["crssd-fall-2026"], esc = before["escape-halloween-2026"], edco = before["edc-orlando-2026"];
  const cr1 = crssd.artists[0], cr2 = crssd.artists[1];
  const stageName = id => crssd.stages.find(s => s.id === id).name;
  const escDay = esc.artists.find(a => a.day === 1), escNull = esc.artists.find(a => a.day == null);
  const edco1 = edco.artists.find(a => a.day === 1);

  const run = (id, rows, ...flags) => {
    const sheet = path.join(tmp, `${id}.tsv`);
    writeFileSync(sheet, ["day\tstage\tstart\tend\tartist", ...rows.map(r => r.join("\t"))].join("\n") + "\n");
    return spawnSync(process.execPath, ["scripts/import-set-times.mjs", id, sheet, ...flags], { cwd: tmp, encoding: "utf8" });
  };
  const SRC = ["--source", "https://example.invalid/fixture"];

  // E1 — a day-2 row on a no-per-act-day lineup, without the flag: refused, with the hint.
  const e1 = run("crssd-fall-2026", [[2, stageName(cr1.stage), "20:00", "21:00", cr1.name]], "--check");
  check(e1.status === 1 && /pass --days-from-sheet/.test(e1.stderr), `E1: expected exit 1 with a --days-from-sheet hint, got ${e1.status}: ${e1.stderr.trim()}`);

  // A + B — module target, days from the sheet.
  const b = run("crssd-fall-2026", [
    [2, stageName(cr1.stage), "20:00", "21:00", cr1.name],
    [1, stageName(cr2.stage), "18:00", "19:00", cr2.name],
  ], "--days-from-sheet", ...SRC);
  check(b.status === 0, `B: import failed (${b.status}): ${b.stderr.trim()}`);
  const crssdOut = readFileSync(crssdFile, "utf8");
  check(crssdOut.includes(`${JSON.stringify(cr1.id)}: [${JSON.stringify(cr1.stage)}, "20:00", "21:00", 2],`), "B: CRSSD row 1 not written as a 4-tuple with day 2");
  check(readFileSync(path.join(tmp, "data.jsx"), "utf8") === readFileSync(path.join(root, "data.jsx"), "utf8"), "A: a module festival's import must not touch data.jsx");

  // C — Escape: the null-day act takes day 2, the real-day act keeps a 3-tuple.
  const escStage = esc.stages[0].name;
  const c = run("escape-halloween-2026", [
    [1, escStage, "19:00", "20:00", escDay.name],
    [2, escStage, "21:00", "22:00", escNull.name],
  ], ...SRC);
  check(c.status === 0, `C: import failed (${c.status}): ${c.stderr.trim()}`);
  const escOut = readFileSync(path.join(tmp, "data", "festivals", "escape-halloween-2026.js"), "utf8");
  check(escOut.includes(`${JSON.stringify(escDay.id)}: [${JSON.stringify(esc.stages[0].id)}, "19:00", "20:00"],`), "C: Escape day-1 act not written as a 3-tuple");
  check(escOut.includes(`${JSON.stringify(escNull.id)}: [${JSON.stringify(esc.stages[0].id)}, "21:00", "22:00", 2],`), "C: Escape null-day act not written with day 2");

  // D — EDC Orlando has no module: the block lands in data.jsx.
  const d = run("edc-orlando-2026", [[1, edco.stages[0].name, "22:00", "23:00", edco1.name]], ...SRC);
  check(d.status === 0, `D: import failed (${d.status}): ${d.stderr.trim()}`);

  // The written blocks must load back as scheduled acts.
  const after = loadRegistry(tmp).DS;
  const a1 = after["crssd-fall-2026"].artists.find(a => a.id === cr1.id);
  check(a1 && a1.day === 2 && a1.start === "20:00" && a1.end === "21:00" && !a1.provisional && a1.bio === "Playing CRSSD Fest Fall 2026.",
    `B: CRSSD act did not load back scheduled: ${JSON.stringify(a1 && { day: a1.day, start: a1.start, provisional: a1.provisional, bio: a1.bio })}`);
  const untouched = after["crssd-fall-2026"].artists.find(a => a.id === crssd.artists[2].id);
  check(untouched && untouched.start === "" && untouched.provisional === true, "B: an act the sheet did not name must stay untimed and provisional");
  const n1 = after["escape-halloween-2026"].artists.find(a => a.id === escNull.id);
  check(n1 && n1.day === 2 && n1.stage === esc.stages[0].id && !n1.unscheduled, `C: Escape null-day act did not load back on day 2: ${JSON.stringify(n1 && { day: n1.day, stage: n1.stage })}`);
  const o1 = after["edc-orlando-2026"].artists.find(a => a.id === edco1.id);
  check(o1 && o1.stage === edco.stages[0].id && o1.start === "22:00", `D: EDC Orlando act did not load back scheduled: ${JSON.stringify(o1 && { stage: o1.stage, start: o1.start })}`);

  // E2 — no stages yet: refused before any row is read.
  const e2 = run("decadence-colorado-2026", [[1, "Arena", "20:00", "21:00", "anyone"]], "--check");
  check(e2.status === 2 && /has no stages yet/.test(e2.stderr), `E2: expected exit 2 "has no stages yet", got ${e2.status}: ${e2.stderr.trim()}`);
  // E3 — the flag on a lineup that already has per-act days: refused.
  const e3 = run("escape-halloween-2026", [[1, escStage, "19:00", "20:00", escDay.name]], "--days-from-sheet", "--check");
  check(e3.status === 2 && /already sit on days/.test(e3.stderr), `E3: expected exit 2 for --days-from-sheet on a dated lineup, got ${e3.status}: ${e3.stderr.trim()}`);
} finally {
  rmSync(tmp, { recursive: true, force: true });
}

const real = fails.filter(Boolean);
if (real.length) { real.forEach(f => console.error(`  ✗ ${f}`)); process.exit(1); }
console.log("✓ import-set-times: module target, --days-from-sheet, null-day acts, data.jsx target, 3 refusals");
