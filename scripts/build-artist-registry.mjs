#!/usr/bin/env node
// Artist registry and billing map (artist repository, M1).
//
// An INDEX over the billings we already have, never a rewrite of them: every
// live lineup row and every archived edition set maps to one or more artist
// keys with a role. Billing rows stay verbatim.
//
//   node scripts/build-artist-registry.mjs           write data/artists/{registry,billings,review,excluded}.json
//   node scripts/build-artist-registry.mjs --check   exit 1 when the files differ from a fresh build
//
// Rules, in order (each one is asserted by scripts/test-artist-registry.mjs):
//   1. excluded rows (unnamed slots, operational, activities) are ledgered with
//      their reason, never silently dropped (scripts/historical/editions.mjs);
//   2. a trailing set tag ("(Sunrise Set)", "(DJ set)", "(live)") comes off
//      identity into setTag; a parenthetical that names people, or one that is
//      not a known tag, goes to review;
//   3. b2b / b3b is one set, several performers; an unnamed partner ("????")
//      never becomes an artist;
//   4. "&" never splits (Walker & Royce is a name);
//   5. "<A> presents <B>" is project B with parent A;
//   6. "<A> x <B>" is a collab only when both sides are billed on their own
//      somewhere; otherwise review;
//   7. "+", "feat", "ft", "with", "w/" go to review;
//   8. case and accent variants are one key (the historical library's slug);
//   9. a key billed under conflicting genre families, or a very short name
//      billed across festivals of different families, goes to review: same
//      key is the default, review is a flag, never an automatic split.
// A review row still maps, to its printed act as one key ("leave separate":
// a wrong merge is worse than a split), with the reason attached.
//
// Rulings (M2) live in data/artists/overrides.json, the only hand-written file:
//   billing  a sourced reading of one printed billing: who is on it and in what
//            role (performer, b2b, cobilled, mc, guest, project with parents).
//            Its source is the page the billing was recorded from.
//   pending  a review row left as printed, with why. No claim; the billings
//            render separately until a source rules it.
//   display / notAnAct as in the spec. merge / split / project are not built:
//            an entry there throws instead of being silently ignored.
import { readFileSync, readdirSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { loadRegistry } from './lib/load-registry.mjs';
import { dropReason } from './historical/editions.mjs';

const ROOT = process.cwd();

// Keys come from data/artist-key.js, the same function the app's photo lookup
// calls (the historical slug, after folding Ø / Æ / ¥ and the rest).
import '../data/artist-key.js';
const { foldKey, splitSetTag } = globalThis.PlurskyArtistKey;
export const keyOf = foldKey;
const OUT = `${ROOT}/data/artists`;

// ── Parsing one printed billing ───────────────────────────────────────────
const UNNAMED = /^\?+$|^(tba|special guest|surprise guest)$/i;

export function parseBilling(printed, known = null) {
  const split = splitSetTag(printed);
  const name = split.name, setTag = split.setTag;
  const review = split.paren === 'people' ? 'parenthetical names people' : split.paren ? 'parenthetical is not a known set tag' : null;
  const act = keyOf(name);
  if (review) return { act: keyOf(printed), setTag, kind: 'performer', performers: [{ key: keyOf(printed), role: 'act' }], review };
  // b2b / b3b first: one set, several performers.
  const parts = name.split(/\s+b[23]b\s+/i);
  if (parts.length > 1) {
    const named = parts.map(p => p.trim()).filter(p => p && !UNNAMED.test(p));
    return { act, setTag, kind: 'performer', performers: named.map(p => ({ key: keyOf(p), role: 'b2b' })), review: null };
  }
  if (/\s\+\s/.test(name)) return { act, setTag, kind: 'performer', performers: [{ key: act, role: 'act' }], review: '"+" billing' };
  if (/\b(feat\.?|ft\.?|with|w\/)\s/i.test(name)) return { act, setTag, kind: 'performer', performers: [{ key: act, role: 'act' }], review: 'feat / with billing' };
  const pres = name.match(/^(.*?)\s+(?:presents?|pres\.?)\s*:?\s+(.*)$/i);
  if (pres) {
    const parent = keyOf(pres[1]), project = keyOf(pres[2]);
    return { act, setTag, kind: 'project', performers: [{ key: project, role: 'project', parents: [parent], parentNames: [pres[1].trim()] }], review: null };
  }
  const x = name.match(/^(.*?)\s+[x×]\s+(.*)$/i);
  if (x) {
    const a = keyOf(x[1]), b = keyOf(x[2]);
    if (known && known.has(a) && known.has(b)) return { act, setTag, kind: 'collab', performers: [{ key: act, role: 'collab', parents: [a, b], parentNames: [x[1].trim(), x[2].trim()] }], review: null };
    return { act, setTag, kind: 'performer', performers: [{ key: act, role: 'act' }], review: '"x" billing whose sides are not both known acts' };
  }
  return { act, setTag, kind: 'performer', performers: [{ key: act, role: 'performer' }], review: null };
}

// ── Stage overlay (M4): data/artists/stages.json, hand-written ────────────
// Every printed stage name maps to exactly one lineage per festival brand.
// Names equal after case folding are one name ("THE GROVE" / "The Grove");
// any other pair shares a lineage only through a sourced join. mainStage is
// per edition, sourced and quoted, never inferred. --seed-stages adds each
// unmapped printed name as its own lineage (the default is separate).
const STAGES_FILE = 'data/artists/stages.json';
const foldName = n => String(n).trim().toLowerCase();
export function readStages(root = ROOT) {
  return indexStages(existsSync(`${root}/${STAGES_FILE}`) ? JSON.parse(readFileSync(`${root}/${STAGES_FILE}`, 'utf8')) : { version: 1, brands: {} });
}
export function indexStages(doc) {
  const errors = [], index = new Map(), mainByEdition = new Map();
  for (const [brand, b] of Object.entries(doc.brands || {})) for (const l of b.lineages || []) {
    if (!l.id || !l.id.startsWith(`${brand}:`)) errors.push(`lineage ${l.id} is not under ${brand}`);
    const folds = [...new Set((l.names || []).map(n => foldName(n.printed)))];
    for (const n of l.names || []) {
      const k = `${brand}|${foldName(n.printed)}`;
      if (index.has(k) && index.get(k) !== l.id) errors.push(`"${n.printed}" (${brand}) is in two lineages: ${index.get(k)}, ${l.id}`);
      index.set(k, l.id);
    }
    for (const j of l.joins || []) if (!j.why || !j.source || !j.observedAt || !j.from || !j.to) errors.push(`join in ${l.id} needs from, to, why, source and observedAt`);
    // Two distinct names in one lineage need a join that connects them.
    if (folds.length > 1) {
      const joined = new Set([folds[0]]); let grew = true;
      while (grew) { grew = false; for (const j of l.joins || []) { const a = foldName(j.from), c = foldName(j.to); if (joined.has(a) !== joined.has(c)) { joined.add(a); joined.add(c); grew = true; } } }
      const loose = folds.filter(f => !joined.has(f));
      if (loose.length) errors.push(`${l.id} merges ${loose.join(', ')} without a sourced join`);
    }
    if (l.mainStage) {
      const m = l.mainStage;
      if (!Array.isArray(m.editions) || !m.editions.length || !m.source || !m.quote || !m.observedAt) errors.push(`mainStage on ${l.id} needs editions, source, quote and observedAt`);
      for (const e of m.editions || []) { if (mainByEdition.has(e)) errors.push(`${e} has two main stages: ${mainByEdition.get(e)}, ${l.id}`); mainByEdition.set(e, l.id); }
    }
  }
  return { doc, errors, lineageOf: (brand, printed) => printed == null ? null : index.get(`${brand}|${foldName(printed)}`) || undefined, mainByEdition };
}

// ── Genre families: a review TRIGGER, never an identity rule ──────────────
function family(genre) {
  const g = String(genre || '').toLowerCase();
  if (!g || g === '—' || /^electronic$|^edm$|^dance$/.test(g)) return null;
  if (/drum|dnb|jungle/.test(g)) return 'dnb';
  if (/hardstyle|hard dance|hardcore|hard techno/.test(g)) return 'hard';
  if (/bass house/.test(g)) return 'basshouse';
  if (/dubstep|bass|riddim|trap|wave/.test(g)) return 'bass';
  if (/techno/.test(g)) return 'techno';
  if (/trance|progressive/.test(g)) return 'trance';
  if (/house|disco|garage|afro/.test(g)) return 'house';
  if (/hip.?hop|rap|r&b/.test(g)) return 'hiphop';
  if (/rock|indie|pop|folk|country|punk|soul|alt|singer|jazz|blues|latin|metal/.test(g)) return 'band';
  return null;
}

// Crossover pairs that the same act plays all the time are not a conflict:
// bass house next to bass and to house, house/techno, techno/hard, bass/hard, trance/hard, bass/dnb. A conflict is
// two families outside those pairs (klo: tech house at EDC, bass at Lost Lands).
const NEAR = new Set(['bass|basshouse', 'basshouse|house', 'house|techno', 'hard|techno', 'bass|hard', 'hard|trance', 'bass|dnb', 'techno|trance']);
export function conflicts(families) {
  const f = [...families].sort();
  for (let i = 0; i < f.length; i++) for (let j = i + 1; j < f.length; j++) if (!NEAR.has(`${f[i]}|${f[j]}`)) return true;
  return false;
}

export function build(root = ROOT, overrides = null) {
  const { REG, DS } = loadRegistry(root);
  const ov = overrides || (existsSync(`${root}/data/artists/overrides.json`) ? JSON.parse(readFileSync(`${root}/data/artists/overrides.json`, 'utf8')) : {});
  for (const kind of ['merge', 'split', 'project']) if ((ov[kind] || []).length) throw new Error(`override kind "${kind}" is not built yet; its entries would be ignored`);
  for (const kind of ['display', 'notAnAct', 'billing'])
    for (const o of ov[kind] || []) if (!o.why || !o.source) throw new Error(`override ${kind} ${JSON.stringify(o).slice(0, 80)} needs a why and a source`);
  for (const o of ov.pending || []) if (!o.why || !(o.key || o.printed)) throw new Error(`pending ${JSON.stringify(o).slice(0, 80)} needs a key or printed, and a why`);
  const ROLES = new Set(['performer', 'b2b', 'cobilled', 'mc', 'guest', 'project']);
  for (const o of ov.billing || []) for (const x of o.performers || []) if (!x.name || !ROLES.has(x.role)) throw new Error(`billing ${o.printed}: performer ${JSON.stringify(x)} needs a name and a role in ${[...ROLES]}`);
  const billingOv = new Map((ov.billing || []).map(o => [o.printed, o]));
  const pendingOv = new Map((ov.pending || []).map(o => [o.key ? `key:${o.key}` : o.printed, o]));
  const notAnAct = new Set((ov.notAnAct || []).map(o => keyOf(o.printed)));
  const displayOv = new Map((ov.display || []).map(o => [o.key, o.name]));

  // Every printed row, live then archived.
  const rows = [];
  const brandOf = id => id.replace(/-20\d\d$/, '').replace(/^edc-las-vegas$/, 'edc-lv');
  for (const e of REG) {
    const cfg = e.config || {}; const fid = cfg.id || e.id; const ds = DS[fid];
    if (!ds?.artists?.length) continue;
    // "tba" is the app's placeholder bucket ("Schedule TBA"), not a stage.
    const stageName = new Map((ds.stages || []).filter(s => s.id !== 'tba').map(s => [s.id, s.name]));
    const src = (cfg.scheduleSource || cfg.lineupSource || {}).url || null;
    for (const a of ds.artists) {
      const dd = cfg.dayDates?.[a.day];
      let date = dd ? new Date(Date.UTC(dd.y, dd.m, dd.d)) : null;
      if (date && a.weekend === 'W2') date = new Date(date.getTime() + 7 * 86400000);
      rows.push({ id: `${fid}:${a.id}`, source: 'live', festivalId: fid, festivalBrand: brandOf(fid), year: cfg.year || null,
        date: date ? date.toISOString().slice(0, 10) : null, day: a.day ?? null, stage: stageName.get(a.stage) || null,
        start: a.start || null, end: a.end || null, printed: a.name, genre: a.genre || null, src, festivalName: cfg.name || fid });
    }
  }
  const H = `${root}/data/historical/editions`;
  for (const fn of readdirSync(H).filter(f => f.endsWith('.json')).sort()) {
    const ed = JSON.parse(readFileSync(`${H}/${fn}`, 'utf8'));
    const art = new Map(ed.artists.map(a => [a.id, a])), st = new Map(ed.stages.map(s => [s.id, s.name])), days = new Map((ed.days || []).map(d => [d.day, d.date]));
    for (const s of ed.sets) {
      const a = art.get(s.artistId);
      rows.push({ id: s.id, source: 'edition', festivalId: ed.id, festivalBrand: brandOf(ed.festivalId || ed.id), year: ed.year,
        date: days.get(s.day) || null, day: s.day ?? null, stage: st.get(s.stageId) || null,
        start: s.start || null, end: s.end || null, printed: a ? a.name : s.artistId, genre: null, src: ed.provenance?.official || null, festivalName: ed.name || ed.id });
    }
  }

  // A stage whose acts all carry one or two labels is labelled by STAGE, not by
  // artist (Ultra: Worldwide Stage 27 of 28 "Bass", UMF Radio 27 of 27 "Hard
  // Dance"), so its label says nothing about the act and never triggers review.
  const stageLabels = new Map();
  for (const r of rows) if (r.source === 'live') { const k = `${r.festivalId}|${r.stage}`; if (!stageLabels.has(k)) stageLabels.set(k, { n: 0, labels: new Set() }); const v = stageLabels.get(k); v.n++; v.labels.add(r.genre || '—'); }
  const stageLabelled = r => { const v = stageLabels.get(`${r.festivalId}|${r.stage}`); return !!v && v.n >= 10 && v.labels.size <= 2; };

  // Where each printed billing was recorded from (rulings must cite one of these).
  const sources = new Map();
  for (const r of rows) { if (!sources.has(r.printed)) sources.set(r.printed, new Set()); if (r.src) sources.get(r.printed).add(r.src); }

  // A sourced ruling replaces the parser's reading of that printing.
  const ruled = (o, printed) => {
    const tagless = o.setTag ? printed.replace(/\s*\([^()]*\)\s*$/, '') : printed;
    const project = o.performers.some(x => x.role === 'project');
    return { act: keyOf(tagless), setTag: o.setTag || null, kind: project ? 'project' : 'performer', ruled: true,
      performers: o.performers.map(x => ({ key: keyOf(x.name), role: x.role, name: x.name, ...(x.parents ? { parents: x.parents.map(keyOf), parentNames: x.parents } : {}) })), review: null };
  };

  // Keys billed on their own (for "x" collabs).
  const standalone = new Set();
  for (const r of rows) { const p = parseBilling(r.printed); if (!p.review && p.performers.length === 1 && p.performers[0].role === 'performer') standalone.add(p.performers[0].key); }

  // Closing slot: the last start on that stage-night, timed rows only.
  const nightMin = t => { const [h, m] = t.split(':').map(Number); return (h < 8 ? h + 24 : h) * 60 + m; };
  const lastStart = new Map();
  for (const r of rows) if (r.start && r.stage) { const k = `${r.festivalId}|${r.date || r.day}|${r.stage}`; lastStart.set(k, Math.max(lastStart.get(k) ?? -1, nightMin(r.start))); }

  const stagesIx = readStages(root);
  const unmappedStages = new Set();
  const billings = [], review = [], excluded = [];
  const reg = new Map();
  const touch = (key, kind) => { if (!reg.has(key)) reg.set(key, { key, kind, parents: new Set(), projects: new Set(), printings: new Map(), billings: [], dates: [], families: new Set(), festivals: new Set() }); return reg.get(key); };
  for (const r of rows) {
    const drop = dropReason(r.printed, r.stage || '') || (notAnAct.has(keyOf(r.printed)) ? { category: 'not-an-act', reason: 'override: not an act' } : null);
    if (drop) { excluded.push({ id: r.id, printed: r.printed, stage: r.stage, ...drop }); continue; }
    const p = billingOv.has(r.printed) ? ruled(billingOv.get(r.printed), r.printed) : parseBilling(r.printed, standalone);
    if (p.review) review.push({ id: r.id, printed: r.printed, reason: p.review });
    const k = `${r.festivalId}|${r.date || r.day}|${r.stage}`;
    billings.push({ id: r.id, source: r.source, festivalId: r.festivalId, festivalBrand: r.festivalBrand, year: r.year, date: r.date, day: r.day,
      stage: r.stage, start: r.start, end: r.end, printed: r.printed, setTag: p.setTag,
      performers: p.performers.map(({ key, role }) => ({ key, role })), act: p.act,
      closing: r.start && r.stage ? nightMin(r.start) === lastStart.get(k) : null,
      stageLineage: (() => { const l = stagesIx.lineageOf(r.festivalBrand, r.stage); if (l === undefined) unmappedStages.add(`${r.festivalBrand}|${r.stage}`); return l ?? null; })(),
      // true / false only for an edition with a sourced main-stage ruling; null means no claim.
      mainStage: r.stage == null || !stagesIx.mainByEdition.has(r.festivalId) ? null : stagesIx.mainByEdition.get(r.festivalId) === stagesIx.lineageOf(r.festivalBrand, r.stage),
      ...(p.review ? { review: p.review } : {}) });
    for (const perf of p.performers) {
      const rec = touch(perf.key, perf.role === 'project' || (!p.ruled && p.kind === 'project') ? 'project' : p.kind === 'collab' ? 'collab' : 'performer');
      for (const par of perf.parents || []) rec.parents.add(par);
      // A parent named only inside a billing ("Bryan Kearney + John O'Callaghan
      // pres Key4050", "Brody Jenner presents Brosa") still gets a record, so it
      // can be found; the set counts on its arc as a project, never as the
      // parent billed alone.
      (perf.parentNames || []).forEach((n, i) => { const pr = touch(perf.parents[i], 'performer'); if (!pr.printings.size) pr.printings.set(n, 0); });
      // A review row is keyed by its whole printing, so it is named by it too.
      const shown = perf.name ? perf.name : p.review ? r.printed : p.performers.length > 1 ? null : r.printed.replace(/\s*\([^()]*\)\s*$/, '').replace(/^.*?\s+(?:presents?|pres\.?)\s*:?\s+/i, '');
      // b2b members are named by their own segment of the printing.
      const seg = shown ?? (r.printed.replace(/\s*\([^()]*\)\s*$/, '').split(/\s+b[23]b\s+/i).find(s => keyOf(s) === perf.key) || perf.key);
      rec.printings.set(seg, (rec.printings.get(seg) || 0) + 1);
      rec.billings.push(r.id); if (r.date) rec.dates.push(r.date);
      // A label on a b2b row is one label for several acts, so only solo rows count.
      const fam = stageLabelled(r) || p.performers.length > 1 ? null : family(r.genre); if (fam) rec.families.add(fam);
      rec.festivals.add(r.festivalBrand);
    }
  }
  // Collision triggers.
  for (const rec of reg.values()) {
    if (conflicts(rec.families)) review.push({ id: `key:${rec.key}`, printed: [...rec.printings.keys()][0], reason: `genre families conflict across festivals: ${[...rec.families].sort().join(', ')}` });
    else if (rec.key.replace(/-/g, '').length <= 3 && rec.festivals.size > 1) review.push({ id: `key:${rec.key}`, printed: [...rec.printings.keys()][0], reason: 'very short name billed at more than one festival brand' });
  }
  // Pending: left as printed, no claim, with why. Everything else in review is unruled.
  for (const row of review) { const o = pendingOv.get(row.id) || pendingOv.get(row.printed); if (o) { row.pending = true; row.why = o.why; } }
  for (const rec of reg.values()) for (const par of rec.parents) reg.get(par)?.projects.add(rec.key);
  const isMixed = s => /[a-z]/.test(s) && /[A-Z]/.test(s);
  const registry = [...reg.values()].sort((a, b) => a.key.localeCompare(b.key)).map(rec => {
    const printings = [...rec.printings.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
    const mixed = printings.find(([s]) => isMixed(s));
    const name = displayOv.get(rec.key) || (mixed ? mixed[0] : printings[0][0]);
    const dates = rec.dates.sort();
    return { key: rec.key, name, aliases: printings.map(([s]) => s).filter(s => s !== name), kind: rec.kind, parents: [...rec.parents].sort(), projects: [...rec.projects].sort(),
      billings: rec.billings, firstSeen: dates[0] || null, lastSeen: dates[dates.length - 1] || null, photo: null, links: [] };
  });
  // The in-app Artists directory slice (M5), loaded on demand, never
  // precached: one row per artist with a billing or a project, display name,
  // the people behind a project or collab, and its billings compactly as
  // [festival, date, stage, start, setTag, role]. Pending collisions (§3.4)
  // are flagged so the app shows their billings separately, never as one arc.
  const festIx = [], festPos = new Map();
  const festOf = r => { if (!festPos.has(r.festivalId)) { festPos.set(r.festivalId, festIx.length); festIx.push({ id: r.festivalId, brand: r.festivalBrand, name: r.festivalName, year: r.year }); } return festPos.get(r.festivalId); };
  const rowById = new Map(rows.map(r => [r.id, r]));
  const billingById = new Map(billings.map(b => [b.id, b]));
  const pendingKeys = new Set(review.filter(r => r.pending && r.id.startsWith('key:')).map(r => r.id.slice(4)));
  const nameOf = new Map(registry.map(r => [r.key, r.name]));
  const directory = {
    version: 1,
    festivals: null,
    artists: registry.filter(r => r.billings.length || r.projects.length).map(r => {
      const bs = r.billings.map(id => { const b = billingById.get(id), row = rowById.get(id); const role = b.performers.find(x => x.key === r.key)?.role || 'performer';
        // Last: the festival's own artist id for a live row (opens its artist page), null for an archived set.
        return [festOf(row), b.date, b.stage, b.start, b.setTag, role, b.printed, row.source === 'live' ? id.slice(row.festivalId.length + 1) : null]; })
        .sort((a, b) => String(a[1]).localeCompare(String(b[1])) || String(a[3]).localeCompare(String(b[3])));
      return { k: r.key, n: r.name, ...(r.parents.length ? { m: r.parents.map(k => nameOf.get(k) || k) } : {}), ...(r.projects.length ? { p: r.projects.map(k => nameOf.get(k) || k) } : {}), ...(pendingKeys.has(r.key) ? { pending: 1 } : {}), b: bs };
    }),
  };
  directory.festivals = festIx;
  const unruled = review.filter(r => !r.pending).length;
  const stageErrors = [...stagesIx.errors, ...[...unmappedStages].map(k => `printed stage not in ${STAGES_FILE}: ${k.replace('|', ' → ')} (run --seed-stages, then join with a source)`)];
  return { registry, billings, review, excluded, directory, sources, overrides: ov, stageErrors, rows,
    counts: { rows: rows.length, billings: billings.length, excluded: excluded.length, review: review.length, pending: review.length - unruled, unruled, ruled: billings.filter(b => billingOv.has(b.printed)).length, artists: registry.length } };
}

if (import.meta.url === `file://${process.argv[1]}` && process.argv[2] === '--seed-stages') {
  // Adds every unmapped printed stage name as its own lineage, ordered by the
  // edition that printed it first. Never joins and never sets a main stage.
  const { rows } = build();
  const { doc, lineageOf } = readStages(ROOT);
  const first = new Map();
  for (const r of [...rows].sort((a, b) => (a.year || 0) - (b.year || 0) || a.festivalId.localeCompare(b.festivalId))) {
    if (r.stage == null) continue;
    const k = `${r.festivalBrand}|${foldName(r.stage)}`;
    if (!first.has(k)) first.set(k, { brand: r.festivalBrand, printed: new Map() });
    const f = first.get(k).printed; if (!f.has(r.stage)) f.set(r.stage, new Set()); f.get(r.stage).add(r.festivalId);
  }
  let added = 0;
  for (const { brand, printed } of first.values()) {
    const names = [...printed].map(([p, eds]) => ({ printed: p, editions: [...eds].sort() }));
    if (lineageOf(brand, names[0].printed) !== undefined) continue;
    const b = (doc.brands[brand] ||= { lineages: [] });
    let id = `${brand}:${keyOf(names[0].printed)}`; for (let i = 2; b.lineages.some(l => l.id === id); i++) id = `${brand}:${keyOf(names[0].printed)}-${i}`;
    b.lineages.push({ id, names, joins: [], mainStage: null }); added++;
  }
  doc.brands = Object.fromEntries(Object.entries(doc.brands).sort(([a], [b]) => a.localeCompare(b)));
  writeFileSync(`${ROOT}/${STAGES_FILE}`, JSON.stringify(doc, null, 1) + '\n');
  console.log(`[stages] ${added} lineages added`);
  process.exit(0);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const out = build();
  if (out.stageErrors.length) { console.log(`✗ stage overlay: ${out.stageErrors.length} problems`); for (const e of out.stageErrors.slice(0, 10)) console.log(`  ✗ ${e}`); process.exit(1); }
  const files = { 'registry.json': out.registry, 'billings.json': out.billings, 'review.json': out.review, 'excluded.json': out.excluded };
  // The directory slice ships to the app, so it is written compact.
  const compact = { 'directory.json': JSON.stringify(out.directory) + '\n' };
  const text = v => JSON.stringify(v, null, 1) + '\n';
  if (process.argv[2] === '--check') {
    const drift = [...Object.entries(files).map(([f, v]) => [f, text(v)]), ...Object.entries(compact)].filter(([f, t]) => !existsSync(`${OUT}/${f}`) || readFileSync(`${OUT}/${f}`, 'utf8') !== t).map(([f]) => f);
    if (drift.length) { console.log(`✗ artist registry is stale: ${drift.join(', ')} — run: node scripts/build-artist-registry.mjs`); process.exit(1); }
    console.log(`✓ artist registry current: ${out.counts.artists} artists, ${out.counts.billings} billings, ${out.counts.review} in review, ${out.counts.excluded} excluded`);
  } else {
    mkdirSync(OUT, { recursive: true });
    for (const [f, v] of Object.entries(files)) writeFileSync(`${OUT}/${f}`, text(v));
    for (const [f, t] of Object.entries(compact)) writeFileSync(`${OUT}/${f}`, t);
    console.log(`[artists] ${out.counts.rows} rows → ${out.counts.billings} billings (${out.counts.ruled} by ruling), ${out.counts.artists} artists, ${out.counts.review} in review (${out.counts.pending} pending, ${out.counts.unruled} unruled), ${out.counts.excluded} excluded`);
  }
}
