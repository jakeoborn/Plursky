#!/usr/bin/env node
// extract-insomniac-lineup.mjs — a past edition's official Insomniac-platform
// LINEUP page, read from the Wayback Machine, for editions whose set-times
// pages were never archived (EDC Orlando, Nocturnal, Escape, Beyond SoCal,
// Dreamstate SoCal 2025). No times exist, so none are produced.
//
//   node scripts/historical/extract-insomniac-lineup.mjs edc-orlando-2025 [...]
//
// The page prints the same lineup in up to three tabs: Alphabetical, By Day
// (headed "Friday, November 07") and, on some sites, By Stage. The lineup is
// every billing printed in any tab, verbatim. A billing's day comes from By
// Day and its stage from By Stage; the tabs do not say which day a stage slot
// was on, so they are joined only where that is unambiguous (one day, or one
// stage). Every disagreement between the tabs goes to the ledger.
//
// Like extract-insomniac.mjs, it lists every capture in the edition's year,
// keeps only those whose own <title> names the edition and whose day headers
// are exactly the edition's dates (weekday + date), and extracts from the
// LATEST valid one: the published final. Other valid captures are diffed
// against it, so a lineup change between captures is a ledger finding.
//
// Writes data/historical/sheets/<id>.lineup.tsv and data/historical/ledger/<id>.json.

import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { listCaptures, fetchCapture } from "./wayback.mjs";
import { datedLabel } from "./lib.mjs";
import { EDITIONS } from "./editions.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");

export const LINEUP_EDITIONS = {
  "edc-orlando-2025": { url: "https://orlando.electricdaisycarnival.com/lineup/", title: "EDC Orlando 2025" },
  "nocturnal-wonderland-2025": { url: "https://www.nocturnalwonderland.com/lineup/", title: "Nocturnal Wonderland 2025" },
  "escape-halloween-2025": { url: "https://escapehalloween.com/lineup/", title: "Escape Halloween 2025" },
  "beyond-wonderland-socal-2025": { url: "https://socal.beyondwonderland.com/lineup/", title: "Beyond Wonderland SoCal 2025" },
  "dreamstate-socal-2025": { url: "https://socal.dreamstateusa.com/lineup/", title: "Dreamstate SoCal 2025" },
};

const ENTITIES = { "&amp;": "&", "&#038;": "&", "&quot;": '"', "&#039;": "'", "&#8216;": "‘", "&#8217;": "’",
  "&#8220;": "“", "&#8221;": "”", "&#8211;": "–", "&#8212;": "—", "&nbsp;": " ", "&#160;": " " };
export const text = s => String(s).replace(/<[^>]+>/g, "")
  .replace(/&#?\w+;/g, e => ENTITIES[e] ?? (/^&#(\d+);$/.test(e) ? String.fromCodePoint(+e.slice(2, -1)) : e))
  .replace(/\s+/g, " ").trim();

// The page → { title, tabs: [{ tab, groups: [{ head|null, acts: [billing] }] }] }.
// One <li> is one billing: "Adam Beyer B2B Layton Giordani" is two links and
// one act. An <li> without an artist link (sponsors, footer) is not an act.
export function parseLineupPage(html) {
  const title = text((/<title>([^<]*)/.exec(html) || [])[1] || "");
  const names = [...html.matchAll(/<div class="tabs__trigger[^"]*">([^<]*)<\/div>/g)].map(m => text(m[1]));
  const tabs = html.split(/<div class="tabs__content/).slice(1).map((b, i) => {
    const groups = [];
    let cur = { head: null, acts: [] };
    groups.push(cur);
    for (const m of b.matchAll(/<h[2-4][^>]*>([\s\S]*?)<\/h[2-4]>|<li>([\s\S]*?)<\/li>/g)) {
      if (m[1] !== undefined) { groups.push(cur = { head: text(m[1]), acts: [] }); continue; }
      if (/data-artist-(?:name|id)=/.test(m[2])) cur.acts.push(text(m[2]));
    }
    return { tab: names[i] || `tab ${i + 1}`, groups: groups.filter(g => g.acts.length) };
  });
  return { title, tabs };
}

const tab = (page, name) => page.tabs.find(t => t.tab.toLowerCase() === name);

// Whether a parsed page is this edition: its title names it and its By Day
// headers are exactly the edition's dates. Returns the evidence either way.
export function provesEdition(page, id) {
  const ed = EDITIONS[id], want = LINEUP_EDITIONS[id];
  const days = (tab(page, "by day")?.groups || []).map(g => ({ head: g.head, date: datedLabel(g.head, ed.year) }));
  const titled = page.title.includes(want.title);
  const dated = days.length === ed.dates.length && days.every((d, i) => d.date === ed.dates[i][0]);
  return { valid: titled && dated, titled, dated, days: days.map(d => `${d.head}${d.date ? "" : " ✗"}`) };
}

// Parsed page → sheet rows (one per billing and appearance) + cross-tab findings.
export function lineupRows(page, id) {
  const ed = EDITIONS[id];
  const dayOf = head => ed.dates.findIndex(([date]) => date === datedLabel(head, ed.year)) + 1;
  const count = list => list.reduce((m, x) => m.set(x, (m.get(x) || 0) + 1), new Map());
  const alpha = (tab(page, "alphabetical")?.groups || []).flatMap(g => g.acts);
  const byDay = new Map(), byStage = new Map();
  for (const g of tab(page, "by day")?.groups || []) for (const a of g.acts) byDay.set(a, [...(byDay.get(a) || []), dayOf(g.head)]);
  const stageTab = tab(page, "by stage");
  for (const g of stageTab?.groups || []) for (const a of g.acts) byStage.set(a, [...(byStage.get(a) || []), g.head]);

  const billings = [];
  for (const a of [...alpha, ...byDay.keys(), ...byStage.keys()]) if (!billings.includes(a)) billings.push(a);
  const A = count(alpha), findings = [], rows = [];
  for (const b of billings) {
    const days = byDay.get(b) || [], stages = byStage.get(b) || [];
    const where = [A.get(b) ? `alphabetical ×${A.get(b)}` : "not alphabetical", `days ${days.join("+") || "none"}`,
      stageTab ? `stages ${stages.join(" + ") || "none"}` : null].filter(Boolean).join("; ");
    if (!A.get(b) || !days.length || (stageTab && !stages.length) || (stageTab && stages.length !== days.length))
      findings.push(`${b}: ${where}`);
    let apps;
    if (!stageTab || !stages.length) apps = days.map(day => ({ day, stage: "" }));
    else if (!days.length) apps = stages.map(stage => ({ day: 0, stage }));
    else if (days.length === 1) apps = stages.map(stage => ({ day: days[0], stage }));
    else if (new Set(stages).size === 1) apps = days.map(day => ({ day, stage: stages[0] }));
    else { apps = days.map(day => ({ day, stage: "" })); findings.push(`${b}: ${days.length} days and ${stages.length} stages, stage not joined to a day`); }
    if (!apps.length) apps = [{ day: 0, stage: "" }];
    for (const x of apps) rows.push({ artist: b, day: x.day || "", stage: x.stage });
  }
  return { rows, findings, stageOrder: (stageTab?.groups || []).map(g => g.head),
    tabs: page.tabs.map(t => `${t.tab} ${t.groups.reduce((n, g) => n + g.acts.length, 0)}`) };
}

function diffLineups(chosen, other) {
  const a = new Set(chosen.rows.map(r => r.artist)), b = new Set(other.rows.map(r => r.artist));
  return [...[...a].filter(x => !b.has(x)).map(x => `added by the final: ${x}`),
    ...[...b].filter(x => !a.has(x)).map(x => `removed by the final: ${x}`)];
}

export async function extract(id) {
  const want = LINEUP_EDITIONS[id], ed = EDITIONS[id];
  if (!want || !ed) throw new Error(`unknown lineup edition ${id}`);
  const caps = await listCaptures(want.url.replace(/^https?:\/\//, ""), `${ed.year}0101`, `${ed.year}1231`);
  const considered = [];
  for (const c of caps) {
    const got = await fetchCapture(c.timestamp, want.url);
    const page = parseLineupPage(got.text);
    const proof = provesEdition(page, id);
    const parsed = proof.valid ? lineupRows(page, id) : null;
    considered.push({ captureTimestamp: got.captureTimestamp, archivedUrl: got.archivedUrl, sha256: got.sha256, bytes: got.bytes,
      title: page.title, ...proof, billings: parsed ? new Set(parsed.rows.map(r => r.artist)).size : 0, parsed });
  }
  const valid = considered.filter(c => c.valid && c.billings);
  const ledger = { id, method: "official_lineup_html", official: want.url };
  if (!valid.length) {
    ledger.blocked = `no ${ed.year} capture of ${want.url} proves the edition`;
    ledger.considered = considered.map(({ parsed, ...c }) => c);
    return { ledger, rows: [] };
  }
  const chosen = valid[valid.length - 1];
  Object.assign(ledger, {
    chosen: chosen.captureTimestamp, archivedUrl: chosen.archivedUrl, sha256: chosen.sha256, title: chosen.title,
    tabs: chosen.parsed.tabs, stageOrder: chosen.parsed.stageOrder, crossTab: chosen.parsed.findings,
    considered: considered.map(({ parsed, ...c }) => ({ ...c,
      diffVsChosen: c === chosen || !c.valid ? undefined : diffLineups(chosen.parsed, parsed) })),
  });
  const rows = chosen.parsed.rows;
  mkdirSync(join(ROOT, "data/historical/sheets"), { recursive: true });
  mkdirSync(join(ROOT, "data/historical/ledger"), { recursive: true });
  const cols = ["artist", "day", "stage"];
  writeFileSync(join(ROOT, `data/historical/sheets/${id}.lineup.tsv`),
    [cols.join("\t"), ...rows.map(r => cols.map(k => r[k]).join("\t"))].join("\n") + "\n");
  writeFileSync(join(ROOT, `data/historical/ledger/${id}.json`), JSON.stringify(ledger, null, 2) + "\n");
  return { ledger, rows };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const ids = process.argv.slice(2);
  if (!ids.length) { console.error("usage: extract-insomniac-lineup.mjs <edition-id>…"); process.exit(2); }
  for (const id of ids) {
    const { ledger, rows } = await extract(id);
    if (ledger.blocked) { console.log(`✗ ${id}: ${ledger.blocked}`); for (const c of ledger.considered) console.log(`   ${c.captureTimestamp} titled=${c.titled} dated=${c.dated} ${c.days.join(" | ")}`); continue; }
    console.log(`▸ ${id} @${ledger.chosen}: ${new Set(rows.map(r => r.artist)).size} billings · ${rows.length} rows · tabs ${ledger.tabs.join(", ")}`);
    for (const c of ledger.considered) console.log(`   ${c.captureTimestamp} valid=${c.valid} billings=${c.billings}${c.diffVsChosen ? ` diffs=${c.diffVsChosen.length}` : ""} ${c.title}`);
    for (const f of ledger.crossTab) console.log(`   ⚑ ${f}`);
  }
}
