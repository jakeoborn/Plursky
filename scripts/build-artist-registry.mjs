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
import { readFileSync, readdirSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { loadRegistry } from './lib/load-registry.mjs';
import { slug } from './historical/lib.mjs';
import { dropReason } from './historical/editions.mjs';

const ROOT = process.cwd();
const OUT = `${ROOT}/data/artists`;

// ── Parsing one printed billing ───────────────────────────────────────────
const SET_TAG = /^(?:.*\bset|live|hybrid|in the round|unmasked)$/i;
const PEOPLE_IN_PARENS = /\s[x×+]\s|\sb[23]b\s|,|\s&\s/i;
const UNNAMED = /^\?+$|^(tba|special guest|surprise guest)$/i;

export function parseBilling(printed, known = null) {
  let name = String(printed).trim();
  let setTag = null, review = null;
  const paren = name.match(/^(.*?)\s*\(([^()]*)\)\s*$/);
  if (paren) {
    const inner = paren[2].trim();
    if (SET_TAG.test(inner) && !PEOPLE_IN_PARENS.test(inner)) { setTag = inner; name = paren[1].trim(); }
    else review = PEOPLE_IN_PARENS.test(inner) ? 'parenthetical names people' : 'parenthetical is not a known set tag';
  }
  const act = slug(name);
  if (review) return { act: slug(printed), setTag, kind: 'performer', performers: [{ key: slug(printed), role: 'act' }], review };
  // b2b / b3b first: one set, several performers.
  const parts = name.split(/\s+b[23]b\s+/i);
  if (parts.length > 1) {
    const named = parts.map(p => p.trim()).filter(p => p && !UNNAMED.test(p));
    return { act, setTag, kind: 'performer', performers: named.map(p => ({ key: slug(p), role: 'b2b' })), review: null };
  }
  if (/\s\+\s/.test(name)) return { act, setTag, kind: 'performer', performers: [{ key: act, role: 'act' }], review: '"+" billing' };
  if (/\b(feat\.?|ft\.?|with|w\/)\s/i.test(name)) return { act, setTag, kind: 'performer', performers: [{ key: act, role: 'act' }], review: 'feat / with billing' };
  const pres = name.match(/^(.*?)\s+(?:presents|pres\.?)\s*:?\s+(.*)$/i);
  if (pres) {
    const parent = slug(pres[1]), project = slug(pres[2]);
    return { act, setTag, kind: 'project', performers: [{ key: project, role: 'project', parents: [parent] }], review: null };
  }
  const x = name.match(/^(.*?)\s+[x×]\s+(.*)$/i);
  if (x) {
    const a = slug(x[1]), b = slug(x[2]);
    if (known && known.has(a) && known.has(b)) return { act, setTag, kind: 'collab', performers: [{ key: act, role: 'collab', parents: [a, b] }], review: null };
    return { act, setTag, kind: 'performer', performers: [{ key: act, role: 'act' }], review: '"x" billing whose sides are not both known acts' };
  }
  return { act, setTag, kind: 'performer', performers: [{ key: act, role: 'performer' }], review: null };
}

// ── Genre families: a review TRIGGER, never an identity rule ──────────────
function family(genre) {
  const g = String(genre || '').toLowerCase();
  if (!g || g === '—' || /^electronic$|^edm$|^dance$/.test(g)) return null;
  if (/drum|dnb|jungle/.test(g)) return 'dnb';
  if (/hardstyle|hard dance|hardcore|hard techno/.test(g)) return 'hard';
  if (/dubstep|bass|riddim|trap|wave/.test(g)) return 'bass';
  if (/techno/.test(g)) return 'techno';
  if (/trance|progressive/.test(g)) return 'trance';
  if (/house|disco|garage|afro/.test(g)) return 'house';
  if (/hip.?hop|rap|r&b/.test(g)) return 'hiphop';
  if (/rock|indie|pop|folk|country|punk|soul|alt|singer|jazz|blues|latin|metal/.test(g)) return 'band';
  return null;
}

// Crossover pairs that the same act plays all the time are not a conflict:
// house/techno, techno/hard, bass/hard, trance/hard, bass/dnb. A conflict is
// two families outside those pairs (klo: tech house at EDC, bass at Lost Lands).
const NEAR = new Set(['house|techno', 'hard|techno', 'bass|hard', 'hard|trance', 'bass|dnb', 'techno|trance']);
export function conflicts(families) {
  const f = [...families].sort();
  for (let i = 0; i < f.length; i++) for (let j = i + 1; j < f.length; j++) if (!NEAR.has(`${f[i]}|${f[j]}`)) return true;
  return false;
}

export function build(root = ROOT, overrides = null) {
  const { REG, DS } = loadRegistry(root);
  const ov = overrides || (existsSync(`${root}/data/artists/overrides.json`) ? JSON.parse(readFileSync(`${root}/data/artists/overrides.json`, 'utf8')) : {});
  for (const kind of ['merge', 'split', 'display', 'project', 'notAnAct'])
    for (const o of ov[kind] || []) if (!o.why || !o.source) throw new Error(`override ${kind} ${JSON.stringify(o).slice(0, 80)} needs a why and a source`);
  const notAnAct = new Set((ov.notAnAct || []).map(o => slug(o.printed)));
  const displayOv = new Map((ov.display || []).map(o => [o.key, o.name]));

  // Every printed row, live then archived.
  const rows = [];
  const brandOf = id => id.replace(/-20\d\d$/, '').replace(/^edc-las-vegas$/, 'edc-lv');
  for (const e of REG) {
    const cfg = e.config || {}; const fid = cfg.id || e.id; const ds = DS[fid];
    if (!ds?.artists?.length) continue;
    const stageName = new Map((ds.stages || []).map(s => [s.id, s.name]));
    for (const a of ds.artists) {
      const dd = cfg.dayDates?.[a.day];
      let date = dd ? new Date(Date.UTC(dd.y, dd.m, dd.d)) : null;
      if (date && a.weekend === 'W2') date = new Date(date.getTime() + 7 * 86400000);
      rows.push({ id: `${fid}:${a.id}`, source: 'live', festivalId: fid, festivalBrand: brandOf(fid), year: cfg.year || null,
        date: date ? date.toISOString().slice(0, 10) : null, day: a.day ?? null, stage: stageName.get(a.stage) || null,
        start: a.start || null, end: a.end || null, printed: a.name, genre: a.genre || null });
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
        start: s.start || null, end: s.end || null, printed: a ? a.name : s.artistId, genre: null });
    }
  }

  // Keys billed on their own (for "x" collabs).
  const standalone = new Set();
  for (const r of rows) { const p = parseBilling(r.printed); if (!p.review && p.performers.length === 1 && p.performers[0].role === 'performer') standalone.add(p.performers[0].key); }

  // Closing slot: the last start on that stage-night, timed rows only.
  const nightMin = t => { const [h, m] = t.split(':').map(Number); return (h < 8 ? h + 24 : h) * 60 + m; };
  const lastStart = new Map();
  for (const r of rows) if (r.start && r.stage) { const k = `${r.festivalId}|${r.date || r.day}|${r.stage}`; lastStart.set(k, Math.max(lastStart.get(k) ?? -1, nightMin(r.start))); }

  const billings = [], review = [], excluded = [];
  const reg = new Map();
  const touch = (key, kind) => { if (!reg.has(key)) reg.set(key, { key, kind, parents: new Set(), printings: new Map(), billings: [], dates: [], families: new Set(), festivals: new Set() }); return reg.get(key); };
  for (const r of rows) {
    const drop = dropReason(r.printed, r.stage || '') || (notAnAct.has(slug(r.printed)) ? { category: 'not-an-act', reason: 'override: not an act' } : null);
    if (drop) { excluded.push({ id: r.id, printed: r.printed, stage: r.stage, ...drop }); continue; }
    const p = parseBilling(r.printed, standalone);
    if (p.review) review.push({ id: r.id, printed: r.printed, reason: p.review });
    const k = `${r.festivalId}|${r.date || r.day}|${r.stage}`;
    billings.push({ id: r.id, source: r.source, festivalId: r.festivalId, festivalBrand: r.festivalBrand, year: r.year, date: r.date, day: r.day,
      stage: r.stage, start: r.start, end: r.end, printed: r.printed, setTag: p.setTag,
      performers: p.performers.map(({ key, role }) => ({ key, role })), act: p.act,
      closing: r.start && r.stage ? nightMin(r.start) === lastStart.get(k) : null, mainStage: null, ...(p.review ? { review: p.review } : {}) });
    for (const perf of p.performers) {
      const rec = touch(perf.key, p.kind === 'project' ? 'project' : p.kind === 'collab' ? 'collab' : 'performer');
      for (const par of perf.parents || []) rec.parents.add(par);
      // A review row is keyed by its whole printing, so it is named by it too.
      const shown = p.review ? r.printed : p.performers.length > 1 ? null : r.printed.replace(/\s*\([^()]*\)\s*$/, '').replace(/^.*?\s+(?:presents|pres\.?)\s*:?\s+/i, '');
      // b2b members are named by their own segment of the printing.
      const seg = shown ?? (r.printed.replace(/\s*\([^()]*\)\s*$/, '').split(/\s+b[23]b\s+/i).find(s => slug(s) === perf.key) || perf.key);
      rec.printings.set(seg, (rec.printings.get(seg) || 0) + 1);
      rec.billings.push(r.id); if (r.date) rec.dates.push(r.date);
      const fam = family(r.genre); if (fam) rec.families.add(fam);
      rec.festivals.add(r.festivalBrand);
    }
  }
  // Collision triggers.
  for (const rec of reg.values()) {
    if (conflicts(rec.families)) review.push({ id: `key:${rec.key}`, printed: [...rec.printings.keys()][0], reason: `genre families conflict across festivals: ${[...rec.families].sort().join(', ')}` });
    else if (rec.key.replace(/-/g, '').length <= 3 && rec.festivals.size > 1) review.push({ id: `key:${rec.key}`, printed: [...rec.printings.keys()][0], reason: 'very short name billed at more than one festival brand' });
  }
  const isMixed = s => /[a-z]/.test(s) && /[A-Z]/.test(s);
  const registry = [...reg.values()].sort((a, b) => a.key.localeCompare(b.key)).map(rec => {
    const printings = [...rec.printings.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
    const mixed = printings.find(([s]) => isMixed(s));
    const name = displayOv.get(rec.key) || (mixed ? mixed[0] : printings[0][0]);
    const dates = rec.dates.sort();
    return { key: rec.key, name, aliases: printings.map(([s]) => s).filter(s => s !== name), kind: rec.kind, parents: [...rec.parents].sort(),
      billings: rec.billings, firstSeen: dates[0] || null, lastSeen: dates[dates.length - 1] || null, photo: null, links: [] };
  });
  return { registry, billings, review, excluded, counts: { rows: rows.length, billings: billings.length, excluded: excluded.length, review: review.length, artists: registry.length } };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const out = build();
  const files = { 'registry.json': out.registry, 'billings.json': out.billings, 'review.json': out.review, 'excluded.json': out.excluded };
  const text = v => JSON.stringify(v, null, 1) + '\n';
  if (process.argv[2] === '--check') {
    const drift = Object.entries(files).filter(([f, v]) => !existsSync(`${OUT}/${f}`) || readFileSync(`${OUT}/${f}`, 'utf8') !== text(v)).map(([f]) => f);
    if (drift.length) { console.log(`✗ artist registry is stale: ${drift.join(', ')} — run: node scripts/build-artist-registry.mjs`); process.exit(1); }
    console.log(`✓ artist registry current: ${out.counts.artists} artists, ${out.counts.billings} billings, ${out.counts.review} in review, ${out.counts.excluded} excluded`);
  } else {
    mkdirSync(OUT, { recursive: true });
    for (const [f, v] of Object.entries(files)) writeFileSync(`${OUT}/${f}`, text(v));
    console.log(`[artists] ${out.counts.rows} rows → ${out.counts.billings} billings, ${out.counts.artists} artists, ${out.counts.review} in review, ${out.counts.excluded} excluded`);
  }
}
