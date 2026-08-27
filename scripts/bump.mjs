#!/usr/bin/env node
// Single entry point for the cache-bust version.
//
// The vNNN string has to move in lockstep across index.html + sw.js + app.jsx
// (CLAUDE.md §4, AGENTS.md §2 rule 3). Doing that as three hand-run seds is
// what produced the v230 -> v231 -> v232 collision cascade in one afternoon:
// three separate PRs each re-bumping by hand, each a chance to desync.
//
//   node scripts/bump.mjs           # report the current version
//   node scripts/bump.mjs --check   # exit non-zero if the three disagree
//   node scripts/bump.mjs 234       # set to v234
//   node scripts/bump.mjs --next    # bump by one
//
// Exits non-zero whenever the three files disagree, INCLUDING right after a
// write — a bump that half-lands is the failure mode this exists to catch.

import { readFileSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const FILES = ["index.html", "sw.js", "app.jsx"];
const RE = /v(\d{3,4})\b/g;

const read = f => readFileSync(join(ROOT, f), "utf8");

// Comments are NOT cache-bust tokens, and the repo is full of historical ones:
// app.jsx:494 says "Native Spotify OAuth handoff (v196)" and spotify.jsx is
// full of "// vNNN" markers (CLAUDE.md calls this out by name). Counting those
// as versions reports permanent drift that no bump can ever clear.
//
// Blanked rather than deleted so byte offsets — and therefore reported line
// numbers — stay true. The `(?<!:)` guard keeps "https://" from being read as
// the start of a comment.
const stripComments = src =>
  src
    .replace(/<!--[\s\S]*?-->/g, m => m.replace(/\S/g, " "))
    .replace(/\/\*[\s\S]*?\*\//g, m => m.replace(/\S/g, " "))
    .replace(/(?<!:)\/\/[^\n]*/g, m => m.replace(/\S/g, " "));

// Every distinct vNNN in a file, with its hit count. A file holding TWO
// different versions is itself a desync, so collect them all rather than
// trusting the first match.
function versionsIn(file) {
  const counts = new Map();
  for (const m of stripComments(read(file)).matchAll(RE)) {
    counts.set(m[1], (counts.get(m[1]) || 0) + 1);
  }
  return counts;
}

function survey() {
  const rows = FILES.map(f => {
    const c = versionsIn(f);
    return { file: f, versions: [...c.keys()].sort(), counts: c };
  });
  const all = new Set(rows.flatMap(r => r.versions));
  return { rows, all };
}

function report({ rows, all }) {
  for (const r of rows) {
    const detail = r.versions.map(v => `v${v}×${r.counts.get(v)}`).join(", ") || "(none)";
    console.log(`  ${r.file.padEnd(12)} ${detail}`);
  }
  return [...all];
}

function check(label) {
  const s = survey();
  const found = report(s);
  if (found.length === 1) {
    console.log(`✓ ${label}: all three files agree on v${found[0]}`);
    return found[0];
  }
  console.error(
    found.length === 0
      ? `✗ ${label}: no vNNN found in any of ${FILES.join(", ")}`
      : `✗ ${label}: version drift — found ${found.map(v => "v" + v).join(", ")}. ` +
        `These three must move together; fix with: node scripts/bump.mjs <n>`
  );
  process.exit(1);
}

const arg = process.argv[2];

if (!arg) { check("current"); process.exit(0); }
if (arg === "--check") { check("check"); process.exit(0); }

// Any write starts from a consistent state, so a bump can never paper over an
// existing desync by overwriting one file and not another.
const from = check("before");
const to = arg === "--next" ? String(Number(from) + 1) : arg.replace(/^v/, "");

if (!/^\d{3,4}$/.test(to)) {
  console.error(`✗ bad version "${arg}" — expected 3–4 digits, e.g. 234`);
  process.exit(1);
}
if (Number(to) <= Number(from)) {
  console.error(
    `✗ refusing to move v${from} → v${to}: the cache-bust must go UP. ` +
    `A lower or equal version leaves stale bundles cached on devices.`
  );
  process.exit(1);
}

// Rewrite only OUTSIDE comments. A blanket replaceAll would rewrite a
// historical "(v196)" marker the moment the live version happened to be v196,
// silently editing prose that documents the past.
let total = 0;
for (const f of FILES) {
  const before = read(f);
  const masked = stripComments(before);
  let out = "", cursor = 0, hits = 0;
  const needle = `v${from}`;
  for (let i = masked.indexOf(needle); i !== -1; i = masked.indexOf(needle, i + 1)) {
    out += before.slice(cursor, i) + `v${to}`;
    cursor = i + needle.length;
    hits++;
  }
  out += before.slice(cursor);
  writeFileSync(join(ROOT, f), out);
  total += hits;
  console.log(`  ${f.padEnd(12)} ${hits} replacement${hits === 1 ? "" : "s"}`);
}
console.log(`\nv${from} → v${to} (${total} replacements)`);
check("after");
