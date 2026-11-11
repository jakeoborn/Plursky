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
import { listCaptures, fetchCapture, RELAY } from "./wayback.mjs";
import { datedLabel } from "./lib.mjs";
import { EDITIONS } from "./editions.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");

export const LINEUP_EDITIONS = {
  "edc-orlando-2025": { url: "https://orlando.electricdaisycarnival.com/lineup/", title: "EDC Orlando 2025" },
  "nocturnal-wonderland-2025": { url: "https://www.nocturnalwonderland.com/lineup/", title: "Nocturnal Wonderland 2025" },
  "escape-halloween-2025": { url: "https://escapehalloween.com/lineup/", title: "Escape Halloween 2025" },
  "beyond-wonderland-socal-2025": { url: "https://socal.beyondwonderland.com/lineup/", title: "Beyond Wonderland SoCal 2025" },
  "dreamstate-socal-2025": { url: "https://socal.dreamstateusa.com/lineup/", title: "Dreamstate SoCal 2025" },
  "beyond-wonderland-socal-2022": { url: "https://socal.beyondwonderland.com/lineup/", title: "Beyond Wonderland SoCal 2022", staleTitle: "Lineup – Beyond Wonderland SoCal 2023" },
  "beyond-wonderland-socal-2024": { url: "https://socal.beyondwonderland.com/lineup/", title: "Beyond Wonderland SoCal 2024" },
  "nocturnal-wonderland-2023": { url: "https://www.nocturnalwonderland.com/lineup/", title: "Nocturnal Wonderland 2023" },
  "hard-summer-2018": { url: "https://www.hardsummer.com/lineup/", title: "HARD Summer 2018" },
  "hard-summer-2019": { url: "https://www.hardsummer.com/lineup/", title: "HARD Summer 2019" },
  "hard-summer-2022": { url: "https://www.hardsummer.com/lineup/", title: "HARD Summer 2022" },
  "hard-summer-2023": { url: "https://www.hardsummer.com/lineup/", title: "HARD Summer 2023" },
  "hard-summer-2024": { url: "https://www.hardsummer.com/lineup/", title: "HARD Summer 2024" },
  "escape-halloween-2023": { url: "https://escapehalloween.com/lineup/", title: "Escape Halloween 2023" },
  "edc-las-vegas-2019": { url: "https://lasvegas.electricdaisycarnival.com/lineup/", title: "EDC Las Vegas 2019" },
  "edc-las-vegas-2021": { url: "https://lasvegas.electricdaisycarnival.com/lineup/", title: "EDC Las Vegas 2021", staleTitle: "Lineup – EDC Las Vegas 2022" },
  "edc-las-vegas-2023": { url: "https://lasvegas.electricdaisycarnival.com/lineup/", title: "EDC Las Vegas 2023", staleTitle: "Lineup – EDC Las Vegas 2024" },
  "edc-orlando-2018": { url: "https://orlando.electricdaisycarnival.com/lineup/", title: "EDC Orlando 2018" },
  "edc-mexico-2020": { url: "https://mexico.electricdaisycarnival.com/lineup/", title: "EDC Mexico 2020" },
  // In 2019 the SoCal lineup was served from the root domain.
  "beyond-wonderland-socal-2019": { url: "https://beyondwonderland.com/lineup/", title: "Beyond Wonderland SoCal 2019" },
  "countdown-nye-2022": { url: "https://countdownnye.com/lineup/", title: "Countdown NYE 2022", window: ["20220701", "20230115"] },
  "countdown-nye-2023": { url: "https://countdownnye.com/lineup/", title: "Countdown NYE 2023", window: ["20230701", "20240115"] },
  // 2015 and 2016 /experience/lineup/ pages (performer items, see
  // performerTabs). Their <title> names the festival but not always the year
  // ("LINEUP |  Nocturnal"), so `title` is what the page printed; the day
  // headers, each a weekday and date that must fall in the edition's year,
  // decide the edition.
  "escape-halloween-2015": { url: "https://escapehalloween.com/experience/lineup/", title: "Escape 2015" },
  "nocturnal-wonderland-2015": { url: "https://nocturnalwonderland.com/experience/lineup/", title: "LINEUP | Nocturnal" },
  "nocturnal-wonderland-2016": { url: "https://nocturnalwonderland.com/experience/lineup/", title: "Nocturnal 2016" },
  "beyond-wonderland-socal-2016": { url: "https://socal.beyondwonderland.com/experience/lineup/", title: "Beyond SoCal" },
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
  return { title, tabs: tabs.length ? tabs : performerTabs(html) };
}

// The 2015 and 2016 sites (/experience/lineup/) printed each billing once as
// <div class="performer-item" data-title="…" data-date="FridaySeptember4">,
// under day headers <div class="date FridaySeptember4"><div class="title">
// Friday, September 4</div>. They are read as an Alphabetical tab (every
// item, in page order) and a By Day tab (items under their date's header).
// A page whose items carry no date (Countdown 2015) yields no By Day tab and
// so proves no edition.
function performerTabs(html) {
  const items = [...html.matchAll(/<div class="performer-item"([^>]*)>/g)].map(m => ({
    act: text((/data-title="([^"]*)"/.exec(m[1]) || [])[1] || ""), date: (/data-date="([^"]*)"/.exec(m[1]) || [])[1] || "" }))
    .filter(x => x.act);
  if (!items.length) return [];
  const heads = [...html.matchAll(/<div class="date ([^"\s]+)"><div class="title">([^<]*)<\/div>/g)].map(m => ({ key: m[1], head: text(m[2]) }));
  const tabs = [{ tab: "Alphabetical", groups: [{ head: null, acts: items.map(x => x.act) }] }];
  if (heads.length && items.every(x => x.date))
    tabs.push({ tab: "By Day", groups: heads.map(h => ({ head: h.head, acts: items.filter(x => x.date === h.key).map(x => x.act) })).filter(g => g.acts.length) });
  return tabs;
}

const tab = (page, name) => page.tabs.find(t => t.tab.toLowerCase() === name);

// Whether a parsed page is this edition: its title names it and its By Day
// headers are exactly the edition's dates. Returns the evidence either way.
export function provesEdition(page, id) {
  const ed = EDITIONS[id], want = LINEUP_EDITIONS[id];
  const days = (tab(page, "by day")?.groups || []).map(g => ({ head: g.head, date: datedLabel(g.head, ed.year) }));
  // A site that never updated its <title> (Beyond SoCal's 2022 page reads
  // "… 2023" over March 25/26 2022 day tabs) is accepted only under the exact
  // stale title listed by hand for that edition; the day tabs still decide.
  const titled = page.title.includes(want.title) || (!!want.staleTitle && page.title === want.staleTitle);
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
  // A By Stage tab that prints the whole lineup under one stage heading is a
  // site fault, not a stage assignment (Beyond SoCal 2024 printed all 119
  // billings under Queen's Domain). It is not used, and the ledger says so.
  let stageTab = tab(page, "by stage");
  const pageFindings = [];
  if (stageTab && stageTab.groups.length === 1 && alpha.length > 30 && stageTab.groups[0].acts.length >= alpha.length) {
    pageFindings.push(`By Stage tab printed all ${stageTab.groups[0].acts.length} billings under one heading ("${stageTab.groups[0].head}"): stage tab not used`);
    stageTab = null;
  }
  // A stage heading may name its day ("Cheshire Woods (Saturday)", Beyond
  // SoCal 2019): the weekday is one of the edition's days, so it is the
  // slot's day, not part of the stage's name. The ledger lists each one.
  const stageDay = new Map(), split = new Map();
  for (const g of stageTab?.groups || []) {
    const m = /^(.*\S)\s+\((Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)\)$/.exec(g.head);
    const day = m ? ed.dates.findIndex(([, w]) => w === m[2]) + 1 : 0;
    if (day) split.set(g.head, { stage: m[1], day });
  }
  for (const [head, x] of split) pageFindings.push(`By Stage heading "${head}" read as stage "${x.stage}" on day ${x.day}`);
  for (const g of stageTab?.groups || []) for (const a of g.acts) {
    const x = split.get(g.head);
    byStage.set(a, [...(byStage.get(a) || []), x ? x.stage : g.head]);
    stageDay.set(a, [...(stageDay.get(a) || []), x ? x.day : 0]);
  }

  const billings = [];
  for (const a of [...alpha, ...byDay.keys(), ...byStage.keys()]) if (!billings.includes(a)) billings.push(a);
  const A = count(alpha), findings = [...pageFindings], rows = [];
  for (const b of billings) {
    const days = byDay.get(b) || [], stages = byStage.get(b) || [];
    const where = [A.get(b) ? `alphabetical ×${A.get(b)}` : "not alphabetical", `days ${days.join("+") || "none"}`,
      stageTab ? `stages ${stages.join(" + ") || "none"}` : null].filter(Boolean).join("; ");
    if (!A.get(b) || !days.length || (stageTab && !stages.length) || (stageTab && stages.length !== days.length))
      findings.push(`${b}: ${where}`);
    let apps;
    const hinted = stageDay.get(b) || [];
    if (stages.length && hinted.every(Boolean)) {
      // Every stage heading named its day: join each slot to it, and check
      // the By Day tab printed the billing on that day too.
      apps = stages.map((stage, i) => ({ day: hinted[i], stage }));
      for (const x of apps) if (!days.includes(x.day)) findings.push(`${b}: By Stage puts it on day ${x.day}, By Day on ${days.join("+") || "none"}`);
    } else if (!stageTab || !stages.length) apps = days.map(day => ({ day, stage: "" }));
    else if (!days.length) apps = stages.map(stage => ({ day: 0, stage }));
    else if (days.length === 1) apps = stages.map(stage => ({ day: days[0], stage }));
    else if (new Set(stages).size === 1) apps = days.map(day => ({ day, stage: stages[0] }));
    else { apps = days.map(day => ({ day, stage: "" })); findings.push(`${b}: ${days.length} days and ${stages.length} stages, stage not joined to a day`); }
    if (!apps.length) apps = [{ day: 0, stage: "" }];
    for (const x of apps) rows.push({ artist: b, day: x.day || "", stage: x.stage });
  }
  return { rows, findings, stageOrder: [...new Set((stageTab?.groups || []).map(g => split.get(g.head)?.stage || g.head))],
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
  // An edition whose lineup page stayed up past New Year (Countdown NYE, held
  // on December 30 and 31) names a wider window; the rest read their year.
  const [from, to] = want.window || [`${ed.year}0101`, `${ed.year}1231`];
  const caps = await listCaptures(want.url.replace(/^https?:\/\//, ""), from, to);
  const considered = [];
  for (const c of caps) {
    let got;
    try { got = await fetchCapture(c.timestamp, want.url); } catch (e) {
      // Relay mode only: a capture the fetching client could not file is
      // listed, never skipped silently. If it is later than the chosen
      // capture, the edition is blocked below: it might be the final.
      if (!RELAY) throw e;
      considered.push({ captureTimestamp: c.timestamp, notFiled: e.message, valid: false, billings: 0 });
      continue;
    }
    const page = parseLineupPage(got.text);
    const proof = provesEdition(page, id);
    const parsed = proof.valid ? lineupRows(page, id) : null;
    considered.push({ captureTimestamp: got.captureTimestamp, archivedUrl: got.archivedUrl, sha256: got.sha256, bytes: got.bytes,
      ...(got.via ? { via: got.via } : {}),
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
  const laterUnfiled = considered.filter(c => c.notFiled && c.captureTimestamp > chosen.captureTimestamp);
  if (laterUnfiled.length) {
    ledger.blocked = `relay did not file ${laterUnfiled.map(c => c.captureTimestamp).join(", ")}, later than the latest valid capture ${chosen.captureTimestamp}`;
    ledger.considered = considered.map(({ parsed, ...c }) => c);
    return { ledger, rows: [] };
  }
  Object.assign(ledger, {
    chosen: chosen.captureTimestamp, archivedUrl: chosen.archivedUrl, sha256: chosen.sha256, title: chosen.title,
    // Relayed bytes are the fetching client's copy of the id_ capture; their
    // hash is of that copy, not of a direct Wayback response.
    ...(chosen.via ? { relayedVia: chosen.via } : {}),
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
