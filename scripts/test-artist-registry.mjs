#!/usr/bin/env node
// Artist registry gate (artist repository, M1). Every billing row maps or is
// excluded with a reason, the identity rules hold on the cases that defined
// them, review rows are flagged and never guessed, and the generated files
// are current. No network.
import { readFileSync } from 'node:fs';
import { build, parseBilling } from './build-artist-registry.mjs';

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
console.log(`  ✓ artist registry: ${checks} checks — ${out.counts.rows} rows → ${out.counts.billings} billings, ${out.counts.artists} artists, ${out.counts.review} in review, ${out.counts.excluded} excluded`);
