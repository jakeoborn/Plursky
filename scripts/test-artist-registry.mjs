#!/usr/bin/env node
// Artist registry gate (artist repository, M1). Every billing row maps or is
// excluded with a reason, the identity rules hold on the cases that defined
// them, review rows are flagged and never guessed, and the generated files
// are current. No network.
import { readFileSync } from 'node:fs';
import { build, parseBilling, keyOf, indexStages } from './build-artist-registry.mjs';

const problems = []; let checks = 0;
const check = (ok, msg) => { checks++; if (!ok) problems.push(msg); };
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const keys = p => p.performers.map(x => `${x.key}:${x.role}`);

// ── The rules, on the cases that defined them ─────────────────────────────
{
  const p = parseBilling('Above & Beyond (Sunrise Set)');
  check(same(keys(p), ['above-and-beyond:performer']) && p.setTag === 'Sunrise Set' && !p.review, `set tag: "Above & Beyond (Sunrise Set)" → ${JSON.stringify(p)}`);
  const t = parseBilling('Adventure Club (Throwback Set)');
  check(same(keys(t), ['adventure-club:performer']) && t.setTag === 'Throwback Set', `set tag: "Adventure Club (Throwback Set)" → ${JSON.stringify(t)}`);
  const amp = parseBilling('Walker & Royce');
  check(same(keys(amp), ['walker-and-royce:performer']) && !amp.review, `"&" never splits: ${JSON.stringify(amp)}`);
  const b2b = parseBilling('GRiZ b2b Wooli');
  check(same(keys(b2b), ['griz:b2b', 'wooli:b2b']) && b2b.act === 'griz-b2b-wooli', `b2b: ${JSON.stringify(b2b)}`);
  const b3b = parseBilling('Josh Baker b3b Kettama b3b Prospa');
  check(same(keys(b3b), ['josh-baker:b2b', 'kettama:b2b', 'prospa:b2b']), `b3b: ${JSON.stringify(b3b)}`);
  const unnamed = parseBilling('VNSSA B2B ????');
  check(same(keys(unnamed), ['vnssa:b2b']), `an unnamed partner never becomes an artist: ${JSON.stringify(unnamed)}`);
  const present = parseBilling('Bicep present Chroma');
  check(present.kind === 'project' && present.performers[0].key === 'chroma' && same(present.performers[0].parents, ['bicep']), `"present" is "presents": ${JSON.stringify(present)}`);
  const proj = parseBilling('Levity presents Lasership');
  check(proj.kind === 'project' && proj.performers[0].key === 'lasership' && same(proj.performers[0].parents, ['levity']), `presents: ${JSON.stringify(proj)}`);
  const people = parseBilling('Skull Machine (Black Tiger Sex Machine x Kai Wachi)');
  check(/names people/.test(people.review || '') && people.performers.length === 1, `a parenthetical that names people goes to review: ${JSON.stringify(people)}`);
  const unknownTag = parseBilling('Rabbit In The Moon (1994)');
  check(/not a known set tag/.test(unknownTag.review || ''), `an unknown parenthetical goes to review: ${JSON.stringify(unknownTag)}`);
  check(/"\+"/.test(parseBilling('Mefjus + Daxta MC').review || ''), '"+" goes to review');
  check(/feat/.test(parseBilling('Fallen with MC Dino').review || ''), '"with" goes to review');
  const xKnown = parseBilling('Zara Larsson x Davis Burleson', new Set(['zara-larsson', 'davis-burleson']));
  check(xKnown.kind === 'collab' && same(xKnown.performers[0].parents, ['davis-burleson', 'zara-larsson'].sort()) || same(xKnown.performers[0].parents, ['zara-larsson', 'davis-burleson']), `"x" with both sides known is a collab: ${JSON.stringify(xKnown)}`);
  check(/"x"/.test(parseBilling('Wave X Nile', new Set()).review || ''), '"x" with unknown sides goes to review');
}

// ── Letters the slug cannot decompose fold into keys (M2) ─────────────────
check(keyOf('RØZ') === 'roz' && keyOf('ØTTA') === 'otta' && keyOf('BØRNS') === 'borns' && keyOf('Æon:Mode') === keyOf('AEON:MODE'), `Ø / Æ fold: ${keyOf('RØZ')} ${keyOf('ØTTA')} ${keyOf('BØRNS')}`);
check(keyOf('¥ØU$UK€ ¥UK1MAT$U') === keyOf('YØU$UK€ ¥UK1MAT$U'), 'a stylised ¥ is a Y');

// ── The whole build ───────────────────────────────────────────────────────
const out = build();
{
  const { registry, billings, review, excluded, counts } = out;
  check(counts.billings + counts.excluded === counts.rows, `orphans: ${counts.rows} rows, ${counts.billings} billings + ${counts.excluded} excluded`);
  check(new Set(billings.map(b => b.id)).size === billings.length, 'billing ids are not unique');
  check(counts.rows >= 3700, `control: only ${counts.rows} rows read (the scan broke?)`);
  const regKeys = new Set(registry.map(r => r.key));
  const missing = billings.flatMap(b => b.performers.map(p => p.key)).filter(k => !regKeys.has(k));
  check(!missing.length, `performer keys missing from the registry: ${[...new Set(missing)].slice(0, 5)}`);
  // Case and accent variants are one key (the 101 spelling groups → 0).
  const fold = s => s.normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase();
  const byFold = new Map(); for (const r of registry) { const f = fold(r.name); byFold.set(f, (byFold.get(f) || 0) + 1); }
  check([...byFold.values()].every(n => n === 1), `spelling variants left as separate artists: ${[...byFold].filter(([, n]) => n > 1).slice(0, 5).map(([f]) => f)}`);
  const fc = registry.find(r => r.key === 'fcukers');
  check(fc && fc.name === 'Fcukers' && fc.aliases.includes('FCUKERS'), `display name: fcukers → ${JSON.stringify(fc && { name: fc.name, aliases: fc.aliases })}`);
  // No email address in the public files ("Cigarettes @ Sunset" is a band).
  const email = /[\w.+-]+@[\w-]+\.[\w.]+/;
  check(!email.test(JSON.stringify(registry)) && !email.test(JSON.stringify(billings)), 'an email address in the generated artist files');
  check(review.some(r => r.id === 'key:klo'), 'klo (tech house at EDC, bass at Lost Lands) is not in review');
  // The genre trigger on its own (klo is also a short name): a key whose only
  // flag is a genre-family conflict.
  check(review.some(r => r.id.startsWith('key:') && /^genre families conflict/.test(r.reason)), 'the genre-family trigger flagged nothing');
  // Stage-level labels (every Ultra stage carries one or two) and b2b-row
  // labels never trigger; per-artist labels still do.
  for (const k of ['armin-van-buuren', 'lilly-palmer', 'laidback-luke', 'bolo', 'bullet-tooth', 'chris-lorenzo'])
    check(!review.some(r => r.id === `key:${k}`), `${k} is flagged by a stage-level or b2b label`);
  check(review.length <= 100, `review queue is ${review.length} rows (> 100 means stop and report)`);
  check(review.every(r => r.reason) && excluded.every(e => e.reason && e.category), 'a review or excluded row without its reason');
  check(excluded.some(e => e.category === 'unnamed-slot'), 'control: no unnamed slot was excluded');
  // Bare non-acts never become artists; a NAMED kids act ("Special Guest: The
  // Happiness Club") is a real billing and stays.
  check(!registry.some(r => /^(special-guest|surprise-guest|fireworks|closing-fireworks|tba|silent-disco)$/.test(r.key)), 'a non-act became an artist');
  const lasership = registry.find(r => r.key === 'lasership');
  check(lasership && lasership.kind === 'project' && lasership.parents.includes('levity'), `Lasership is not Levity's project: ${JSON.stringify(lasership)}`);
  const cl = billings.find(b => /Cloonee/i.test(b.printed) && b.source === 'live');
  check(cl && cl.closing !== null && cl.date, `control: a timed live billing has no closing flag or date: ${JSON.stringify(cl)}`);
}

// ── M2: every review row is ruled or explicitly pending ───────────────────
{
  const { review, billings, registry, sources, overrides: ov, counts } = out;
  check(counts.unruled === 0, `${counts.unruled} review rows are neither ruled nor pending: ${review.filter(r => !r.pending).slice(0, 3).map(r => r.printed)}`);
  check(review.every(r => !r.pending || r.why), 'a pending row without its why');
  check((ov.billing || []).length >= 30 && (ov.pending || []).length >= 10, `control: overrides not read (${(ov.billing || []).length} rulings, ${(ov.pending || []).length} pending)`);
  // A ruling cites the page its billing was recorded from, and matches a row.
  for (const o of ov.billing || []) {
    const rec = sources.get(o.printed);
    check(rec, `ruling matches no billing: "${o.printed}"`);
    for (const u of [].concat(o.source)) check(rec && rec.has(u), `ruling "${o.printed}" cites ${u}, not a page that billing was recorded from`);
  }
  const ids = new Set(review.map(r => r.id)), printed = new Set(review.map(r => r.printed));
  for (const o of ov.pending || []) check(o.key ? ids.has(`key:${o.key}`) : printed.has(o.printed), `stale pending entry: ${o.key || o.printed}`);
  const by = t => billings.find(b => b.printed === t);
  const roles = b => b && b.performers.map(x => `${x.key}:${x.role}`).join(' ');
  check(roles(by('Fallen with MC Dino')) === 'fallen:performer mc-dino:mc', `MC ruling: ${roles(by('Fallen with MC Dino'))}`);
  check(roles(by('BT + Matt Fax')) === 'bt:cobilled matt-fax:cobilled', `co-billed ruling: ${roles(by('BT + Matt Fax'))}`);
  const a = by('Above & Beyond (Anjunabeats Classics)');
  check(roles(a) === 'above-and-beyond:performer' && a.setTag === 'Anjunabeats Classics', `set-tag ruling: ${JSON.stringify(a && { p: roles(a), t: a.setTag })}`);
  const key = registry.find(r => r.key === 'key4050'), bk = registry.find(r => r.key === 'bryan-kearney');
  check(key && key.kind === 'project' && key.parents.includes('bryan-kearney') && bk && bk.projects.includes('key4050'), `project ruling: ${JSON.stringify({ key, bk })}`);
  const regKeys = new Set(registry.map(r => r.key));
  check(registry.every(r => r.parents.every(p => regKeys.has(p))), 'a parent without a registry record');
  check(review.some(r => r.id === 'key:klo' && r.pending), 'klo is not pending');
  check(!billings.some(b => b.printed === 'Sultan + Shepard' && b.performers.length > 1), '"+" split without a ruling');
  // An unbuilt override kind throws instead of being ignored.
  let threw = false; try { build(undefined, { merge: [{ into: 'a', from: ['b'], why: 'w', source: 's' }] }); } catch { threw = true; }
  check(threw, 'a merge override was silently ignored');
}

// ── M3: the app's photo key is the registry's key ─────────────────────────
{
  const { slug } = await import('./historical/lib.mjs');
  const { artistKey } = globalThis.PlurskyArtistKey;
  const ruledPrinted = new Set((out.overrides.billing || []).map(o => o.printed));
  let solo = 0; const off = [];
  for (const b of out.billings) {
    if (b.performers.length !== 1 || b.performers[0].role !== 'performer' || ruledPrinted.has(b.printed)) continue;
    solo++; if (artistKey(b.printed) !== b.performers[0].key) off.push(b.printed);
  }
  check(solo >= 3000, `control: only ${solo} solo billings compared`);
  check(!off.length, `app photo key differs from the registry key for ${off.length}: ${off.slice(0, 3)}`);
  // Outside the folded letters, the key is the historical library's slug.
  const plain = out.billings.map(b => b.printed).filter(t => !/[¥ØøÆæŒœßŁłĐđÞþð]/.test(t));
  check(plain.every(t => keyOf(t) === slug(t)), 'keyOf drifted from the historical slug');
}

// ── M4: stage overlay ─────────────────────────────────────────────────────
{
  const { billings, stageErrors } = out;
  const doc = JSON.parse(readFileSync('data/artists/stages.json', 'utf8'));
  const lineages = Object.values(doc.brands).flatMap(b => b.lineages);
  check(lineages.length >= 120, `control: only ${lineages.length} stage lineages read`);
  check(!stageErrors.length, `stage overlay: ${stageErrors.slice(0, 3).join(' · ')}`);
  const staged = billings.filter(b => b.stage != null);
  check(staged.length >= 3000 && staged.every(b => b.stageLineage), `${staged.filter(b => !b.stageLineage).length} billings with a stage have no lineage`);
  check(billings.filter(b => b.stage == null).every(b => b.stageLineage === null && b.mainStage === null), 'a billing without a stage carries a lineage or a main-stage claim');
  check(!billings.some(b => b.stage === 'Schedule TBA'), 'the app placeholder "Schedule TBA" is read as a stage');
  const lin = (fid, stage) => billings.find(b => b.festivalId === fid && b.stage === stage)?.stageLineage;
  check(lin('governors-ball-2025', 'GOVBALLNYC') === lin('governors-ball-2026', 'GovBallNYC'), 'case variants of one stage name are two lineages');
  check(lin('acl-2025', 'T-MOBILE') !== lin('acl-2026', 'T-Mobile Stage') && lin('hard-summer-2025', 'HARD Stage') !== lin('hard-summer-2026', 'HARD'), 'a rename was joined without a source');
  // Main stage: only where an official page names it, per edition, and every
  // other stage of that edition is false; every other edition makes no claim.
  const claims = billings.filter(b => b.mainStage !== null);
  check(claims.length && claims.every(b => b.festivalId === 'ultra-miami-2026'), `main-stage claims outside the sourced edition: ${[...new Set(claims.filter(b => b.festivalId !== 'ultra-miami-2026').map(b => b.festivalId))]}`);
  check(claims.filter(b => b.mainStage).every(b => b.stage === 'ULTRA Main Stage') && claims.some(b => b.mainStage) && claims.some(b => b.mainStage === false), 'Ultra 2026 main stage is not exactly ULTRA Main Stage');
  check(!billings.some(b => b.festivalBrand === 'edc-lv' && b.mainStage !== null), 'EDC LV carries a main-stage claim (no official page names one)');
  // The rules reject what they should, on planted documents.
  const L = (id, names, extra = {}) => ({ id, names: names.map(p => ({ printed: p, editions: ['x-2026'] })), joins: [], mainStage: null, ...extra });
  const bad = brands => indexStages({ version: 1, brands }).errors.length > 0;
  check(bad({ x: { lineages: [L('x:a', ['A Stage', 'B Stage'])] } }), 'two names in one lineage without a join were accepted');
  check(bad({ x: { lineages: [L('x:a', ['A Stage', 'B Stage'], { joins: [{ from: 'A Stage', to: 'B Stage', why: 'w' }] })] } }), 'a join without a source was accepted');
  check(!bad({ x: { lineages: [L('x:a', ['A Stage', 'B Stage'], { joins: [{ from: 'A Stage', to: 'B Stage', why: 'w', source: 'https://x', observedAt: '2026-10-06' }] })] } }), 'control: a sourced join was rejected');
  check(bad({ x: { lineages: [L('x:a', ['A']), L('x:b', ['a'])] } }), 'one printed name in two lineages was accepted');
  check(bad({ x: { lineages: [L('x:a', ['A'], { mainStage: { editions: ['x-2026'], source: 'https://x', observedAt: '2026-10-06' } })] } }), 'a main stage without its quote was accepted');
  const ms = { editions: ['x-2026'], source: 'https://x', quote: 'q', observedAt: '2026-10-06' };
  check(bad({ x: { lineages: [L('x:a', ['A'], { mainStage: ms }), L('x:b', ['B'], { mainStage: ms })] } }), 'two main stages in one edition were accepted');
}

// ── Overrides need a why and a source ─────────────────────────────────────
{
  let threw = false;
  try { build(undefined, { display: [{ key: 'fcukers', name: 'FCUKERS' }] }); } catch { threw = true; }
  check(threw, 'an override without why and source was accepted');
}

// ── The files on disk are this build ──────────────────────────────────────
{
  const text = v => JSON.stringify(v, null, 1) + '\n';
  for (const [f, v] of Object.entries({ 'registry.json': out.registry, 'billings.json': out.billings, 'review.json': out.review, 'excluded.json': out.excluded })) {
    let disk = null; try { disk = readFileSync(`data/artists/${f}`, 'utf8'); } catch {}
    check(disk === text(v), `data/artists/${f} is stale — run: node scripts/build-artist-registry.mjs`);
  }
}

if (problems.length) {
  console.log(`  ✗ artist registry: ${problems.length} of ${checks} checks failed`);
  for (const p of problems) console.log(`    ✗ ${p}`);
  process.exit(1);
}
console.log(`  ✓ artist registry: ${checks} checks — ${out.counts.rows} rows → ${out.counts.billings} billings (${out.counts.ruled} by ruling), ${out.counts.artists} artists, ${out.counts.review} in review (${out.counts.pending} pending, ${out.counts.unruled} unruled), ${out.counts.excluded} excluded`);
