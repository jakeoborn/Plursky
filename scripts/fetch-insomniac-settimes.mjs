#!/usr/bin/env node
// fetch-insomniac-settimes.mjs — turn an Insomniac-platform festival's OFFICIAL
// set-times pages into the sheet scripts/import-set-times.mjs reads.
//
// The festival sites Insomniac builds (EDC Las Vegas, EDC Orlando, Nocturnal,
// Escape Halloween, Dreamstate, and the III Points site on the same theme)
// publish `/lineup/set-times/day-N/`. Each page lists, per stage, one
// `a.set-block[data-settime-id]` per set: the printed billing in its first
// <span>, and `data-timestamp-start` / `data-timestamp-end` epochs. Nocturnal
// 2026's 86 rows were transcribed from these same pages (#125).
//
//   node scripts/fetch-insomniac-settimes.mjs <set-times-url> --days N [--first-day K] [--out sheet.tsv]
//   node scripts/fetch-insomniac-settimes.mjs --html day1.html [--html day2.html …] [--out sheet.tsv]
//
//   <set-times-url>  e.g. https://www.nocturnalwonderland.com/lineup/set-times
//   --days N         pages day-1 … day-N
//   --first-day K    sheet day number of page day-1 (default 1), for a
//                    festival whose config numbers days differently
//   --html FILE      parse saved pages instead of fetching (tests, offline)
//
// Exit 0 = sheet written; exit 3 = a day page is not published yet (404), so
// a watcher can poll it; anything else is a failure. Nothing here writes
// data.jsx: the importer validates every row against the lineup first.
//
// ⚠ TIMES: the epochs carry the PRINTED wall clock encoded as UTC, not the
// real instant (Nocturnal's 23:00 PDT deadmau5 set is 1789858800 =
// 2026-09-19T23:00Z). So they are read in UTC and never converted to local.

import { readFileSync, writeFileSync } from "node:fs";

const argv = process.argv.slice(2);
const flag  = k => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : null; };
const flags = k => argv.flatMap((a, i) => a === k ? [argv[i + 1]] : []);
const die = (msg, code = 1) => { console.error(`✗ ${msg}`); process.exit(code); };

// Billings carry accents ("Chloé Caillet"), and WordPress may emit them as
// named entities. An undecoded "&eacute;" would reach the importer as a name
// that matches no act, so the Latin-1 letters are decoded here and any entity
// still left in a billing fails the sheet below.
const ENT = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", szlig: "ß",
  hellip: "…", ndash: "–", mdash: "—", lsquo: "‘", rsquo: "’", ldquo: "“", rdquo: "”" };
for (const [base, marks] of Object.entries({ a: "grave acute circ tilde uml ring", e: "grave acute circ uml",
  i: "grave acute circ uml", o: "grave acute circ tilde uml slash", u: "grave acute circ uml", n: "tilde", c: "cedil", y: "acute uml" }))
  for (const mk of marks.split(" ")) for (const ch of [base, base.toUpperCase()]) {
    const combining = { grave: "̀", acute: "́", circ: "̂", tilde: "̃", uml: "̈", ring: "̊", cedil: "̧" }[mk];
    ENT[ch + mk] = mk === "slash" ? (ch === "o" ? "ø" : "Ø") : (ch + combining).normalize("NFC");
  }
const decode = s => s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e) =>
  e[0] === "#" ? String.fromCodePoint(e[1].toLowerCase() === "x" ? parseInt(e.slice(2), 16) : +e.slice(1)) : (ENT[e.toLowerCase()] ?? m));
const text = s => decode(s.replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim();
const clock = epoch => new Date(epoch * 1000).toISOString().slice(11, 16);

// One page → its sets, in page order. A set appears twice (the "By Stage" tab,
// then "Full Schedule"); the first sighting carries the stage heading above it.
export function parseDay(html) {
  const tok = /<li class="set-list__stage">\s*<h2>([\s\S]*?)<\/h2>|<a\b[^>]*\bdata-settime-id="(\d+)"[^>]*>([\s\S]*?)<\/a>/g;
  const seen = new Map();
  let stage = null, m;
  while ((m = tok.exec(html))) {
    if (m[1] != null) { stage = text(m[1]); continue; }
    const id = m[2], body = m[3];
    if (seen.has(id)) continue;
    const name = text((/<span\b[^>]*>([\s\S]*?)<\/span>/.exec(body) || [])[1] || "");
    const s = /data-timestamp-start="(\d+)"/.exec(body), e = /data-timestamp-end="(\d+)"/.exec(body);
    seen.set(id, { id, stage, artist: name, start: s ? clock(+s[1]) : "", end: e ? clock(+e[1]) : "" });
  }
  return [...seen.values()];
}

const isMain = import.meta.url === `file://${process.argv[1]}`;
if (isMain) {
  const base = argv.find((a, i) => /^https?:\/\//.test(a) && argv[i - 1] !== "--out");
  const files = flags("--html");
  const first = +(flag("--first-day") || 1);
  const pages = [];
  if (files.length) {
    files.forEach((f, i) => pages.push({ day: first + i, url: `file:${f}`, html: readFileSync(f, "utf8") }));
  } else {
    const n = +(flag("--days") || 0);
    if (!base || !n) die("usage: fetch-insomniac-settimes.mjs <set-times-url> --days N [--first-day K] [--out sheet.tsv] | --html FILE…", 2);
    for (let d = 1; d <= n; d++) {
      const url = `${base.replace(/\/+$/, "")}/day-${d}/`;
      const r = await fetch(url, { headers: { "user-agent": "Mozilla/5.0 (Macintosh) Plursky schedule import" }, redirect: "follow" });
      if (r.status === 404) die(`${url} is not published yet (404)`, 3);
      if (!r.ok) die(`${url} → HTTP ${r.status}`);
      pages.push({ day: first + d - 1, url, html: await r.text() });
    }
  }

  const rows = [], problems = [];
  for (const p of pages) {
    const sets = parseDay(p.html);
    if (!sets.length) problems.push(`${p.url}: no set blocks found (page layout changed, or not a set-times page)`);
    for (const s of sets) {
      if (!s.stage) problems.push(`${p.url}: set ${s.id} "${s.artist}" has no stage heading above it`);
      if (!s.start || !s.end) problems.push(`${p.url}: set ${s.id} "${s.artist}" has no timestamps`);
      if (/&[#a-z0-9]+;/i.test(s.artist)) problems.push(`${p.url}: set ${s.id} "${s.artist}" still carries an HTML entity — add it to ENT`);
      rows.push({ day: p.day, ...s, source: p.url });
    }
    const by = {};
    for (const s of sets) by[s.stage] = (by[s.stage] || 0) + 1;
    // Progress goes to stderr: without --out, stdout IS the sheet.
    console.error(`▸ day ${p.day}: ${sets.length} set(s) · ${Object.entries(by).map(([k, v]) => `${k} ${v}`).join(" · ")}`);
  }
  if (problems.length) { problems.forEach(x => console.error(`  ✗ ${x}`)); die(`${problems.length} problem(s) — no sheet written`); }

  const tsv = ["day\tstage\tstart\tend\tartist\tsource",
    ...rows.map(r => [r.day, r.stage, r.start, r.end, r.artist, r.source].join("\t"))].join("\n") + "\n";
  const out = flag("--out");
  if (out) { writeFileSync(out, tsv); console.error(`  ✓ ${rows.length} row(s) → ${out}`); }
  else process.stdout.write(tsv);
}
