#!/usr/bin/env node
// Artist registry gate (artist repository, M1). Every billing row maps or is
// excluded with a reason, the identity rules hold on the cases that defined
// them, review rows are flagged and never guessed, and the generated files
// are current. No network.
import { readFileSync } from 'node:fs';
import { build, parseBilling, keyOf, indexStages } from './build-artist-registry.mjs';
import { undatedOwnPost } from './historical/lib.mjs';

const problems = []; let checks = 0;
const check = (ok, msg) => { checks++; if (!ok) problems.push(msg); };
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const keys = p => p.performers.map(x => `${x.key}:${x.role}`);

// ── The rules, on the cases that defined them ─────────────────────────────
{
  const p = parseBilling('Above & Beyond (Sunrise Set)');
  check(same(keys(p), ['above-and-beyond:performer']) && p.setTag === 'Sunrise Set' && !p.review, `set tag: "Above & Beyond (Sunrise Set)" → ${JSON.stringify(p)}`);
  // EDC Orlando prints a bare "(SUNSET)" for the sunset slot: a set tag, so
  // the act keeps one key with its untagged sets.
  const ss = parseBilling('KASKADE (SUNSET)');
  check(same(keys(ss), ['kaskade:performer']) && ss.setTag === 'SUNSET' && !ss.review, `set tag: "KASKADE (SUNSET)" → ${JSON.stringify(ss)}`);
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
  // The stop line was 100 until batch 6 (Tomorrowland 2017–2023): eleven
  // rows no standing rule settles (seven "x" billings, four short names now
  // billed at Tomorrowland too) took the pending queue to 109. Raised to 110
  // and reported in that pull request. Batch 8 (Coachella 2014 to 2016)
  // added four more short names billed at a second brand (Nas, UZ, Zoé, RAC),
  // each left separate by the standing short-name rule: raised to 120 under
  // Jake's standing "make the best decision" call, and reported in that pull
  // request. Batch 11 (Shambhala 2011 to 2016) added five billings no
  // standing rule settles (four "Name (Act)" parentheticals, the Bunny (Rabbit
  // in the Moon) case, and WAVS (VS. + Wakcutt ft. Lyndi Lush)) and two more
  // short names billed at a second brand (TJR, R/D): 125 rows. Raised to 130
  // under the same standing call and reported in that pull request.
  // Coachella 2027 added two x billings no standing rule settles (135).
  // Lollapalooza 2012 added one more short name billed at a second brand
  // (LP, also at ACL), left separate by the standing short-name rule: 136
  // rows. Raised to 140 under the same standing call and reported in that
  // pull request. ACL 2011 and 2012 then added two more (Dev and WAX,
  // both also at Lollapalooza 2012) and one more "+" billing:
  // 139 rows. Governors Ball 2011 and 2012 added one (Big Boi (of
  // Outkast)): 140. Tomorrowland 2013 to 2016 (2,079 sets) ruled 41 billings
  // under the existing feat., MC and aka rules and left six as printed: an
  // "ID" guest, an ambiguous "vs", two one-name parentheticals, a "+" billing
  // and the short name GMS (seven rows: the "ID" billing prints on both
  // weekends). 147 rows, raised here and reported in that pull
  // request. Shambhala 2024 and 2025 ruled ten billings under the existing
  // feat./with and event-title rules and left four as printed: three
  // "Name (Act)" parentheticals (Shawna (KMLN), on both years; DJ Pee .Wee
  // (Anderson .Paak); GUNFINGAZ (WRAZ & SUBSTANCE)) and one "x" billing
  // (Parkbreezy x TF Marz): 152 rows, raised here and reported in that pull
  // request. EDC Las Vegas 2012 and 2013 ruled two billings under the
  // feat./with rule and left three as printed: "Lee Curtiss, Ryan Crosson,
  // Shaun Reeves (Visionquest)", the short name BT, and Cosmic Gate feat.
  // Emma Hewitt (already pending, now printed in 2012 too): 155 rows, raised
  // here and reported in that pull request. Tomorrowland 2010 to 2012 ruled 26
  // billings under the existing feat., MC, aka and band rules and left six as
  // printed: five parentheticals naming the people or crew behind a billing
  // (Airscape, Club Cheval, Frequency 7 and Killa Productions, NGA, Fiocco)
  // and the short name NU: 161 rows, raised here and reported in that pull
  // request. Lollapalooza 2018 ruled three billings under the existing
  // country-code and feat. rules (Slaves (UK), BONES (UK), LL COOL J FEAT. DJ
  // Z-TRIP) and left the short name NAV as printed (Coachella 2017 and
  // Lollapalooza 2018): 162 rows, raised here and reported in that pull
  // request. Governors Ball 2015 ruled Pat Mahoney's DJ set under the existing
  // band-parenthetical rule and left one "+" billing as printed (Florence +
  // The Machine): 163 rows, raised here and reported in that pull request.
  // Primavera Sound 2016 ruled three billings under the existing feat., set
  // tag and band-parenthetical rules (BEN WATT BAND FEAT. BERNARD BUTLER, BOB
  // MOULD (SOLO ELECTRIC), FARIS BADWAN (THE HORRORS)) and left one
  // parenthetical as printed (OPTIMO (ESPACIO)): 164 rows, raised here and
  // reported in that pull request. Primavera Sound 2017 ruled three more under
  // the same band-parenthetical and set tag rules and a new one for a name
  // printed with how it is said (PATRICK CODENYS (FRONT 242), !!! (CHK CHK
  // CHK) and its DJ SET), leaving the queue at 164. Primavera Sound 2019
  // ruled one billing under the existing feat. rule (HURRICANE G FEAT TONY
  // TOUCH) and left six as printed: two parentheticals naming the people
  // behind an act (SHAKTI ALLIANCE (IVY, MODET, VIR), TONY TOUCH & FRIENDS
  // (DON CHEZINA + SONI WITHANEYE)), three feat. billings whose guests the
  // printing does not settle (a show title, a one-letter guest, a "&" that
  // may be one act or two) and the short name IDK: 170 rows, raised here and
  // reported in that pull request. Primavera Sound 2018 ruled LIMINAL
  // SOUNDBATH WITH JÓNSI, ALEX SOMERS AND PAUL CORLEY under the feat. rule
  // and left two curated days as printed (FOUR TET PRESENTS and DEKMANTEL
  // PRESENTS, names joined by "/" in one all-day block, as Crew Love): 172
  // rows, raised here and reported in that pull request. Primavera Sound
  // 2012 ruled Barry Hogan DJ (ATP) and Jeff Mangum (Neutral Milk Hotel) and
  // left the short name OFF! (Primavera Sound 2012 and Coachella 2015) to a
  // first-party link: 173 rows, raised here and reported in that pull
  // request. Outside Lands 2022 to 2025 ruled nine billings under the
  // existing feat./with, band-parenthetical and project rules (the Dolores'
  // drag shows' guests, The Far Side (formerly of The Pharcyde), Beck with an
  // unnamed symphony, Girl Math (VNSSA b2b Nala)) and left four as printed:
  // Diesel (Shaquille O'Neal) (no "aka"), an "x" billing with an unsettled
  // guest list, a feat. list whose "&" may be one act or two, and the short
  // name J.I.D (Lollapalooza 2019 and Outside Lands 2023): 177 rows, raised
  // here and reported in that pull request. Outside Lands' widget hides set
  // titles, so its feat. list is now billed as the act's own name ("A Family
  // Affair featuring ...", no longer a review row, 176), and Lightning in a
  // Bottle 2018-2019 adds seven pending rows: a crew takeover listing its DJs,
  // an "x" billing (Carlo x Ofier), a feat. list whose "&" may be one act or
  // two (SOULECTION ft ...), Andres (SOULECTION) (a short name the crew tag
  // cannot settle), and three short names billed at other brands (B3K, LUM,
  // Tor): 183 rows. Outside Lands 2018-2019 adds four: Florence + the
  // Machine (the "+" rule, already pending at ACL 2012), SOB x RBE (an "x"
  // billing) and two feat. lists whose "&" may be one act or two (Groove
  // Well Ft. ..., As You Like It Ft. ...): 187 rows. Sónar Barcelona
  // 2016-2019 and 2022 add six: four billings whose "&" may join one act or
  // two (Congo Natty feat. ... Nãnci & Phoebe, bRUNA & Wooky + Alba G.
  // Corral, Ratkje & Barruk, LAO & Wasted Fates) and two short names also
  // billed at Primavera Sound (MOW, Za!): 193 rows. Sziget 2010-2011 adds
  // one: a feat. list whose guests are printed with nicknames in quotes
  // (Muzsikas feat. Ildiko Toth "Fecske" and Zoltan Farkas "Batyu"); its
  // country-tagged billings ("The Cribs (UK)") are ruled under its house
  // style: 194 rows. Defqon.1 2015 adds four: three billings joined by "ft."
  // or "with" (Mad Dog ft. Jeff, Kasparov & System Shock ft Diesel, Qlubtempo
  // Parade with Pavo, Pila, Trilok & Chiren) and one "a.k.a." parenthetical
  // (Elkabass (a.k.a. The Prophet)): 198 rows. Lollapalooza 2024 and
  // Governors Ball 2024 add two: a billing joined by "with" (LAUFEY WITH THE
  // CHICAGO PHILHARMONIC) and a short name now at three brands (FLO): 200
  // rows. Ultra Miami 2022 and 2023 add three: an "x" billing whose sides are
  // not both known acts (KVSH X PONTIFEXX), a "+" billing (ASH TRÉS + MOSES
  // JAZZ) and a short name now at two brands (Kx5): 203 rows. Lollapalooza
  // 2021 to 2023 add eight, all pending with no claim: four "x" or "+"
  // billings (TOMORROW X TOGETHER twice, KOSINE X FRAYNE VIBEZ, DPR IAN + DPR
  // LIVE), a BONNIE X CLYDE billing under its existing pending entry, and
  // three short names now at more than one brand (CAM, BIA, YG): 211 rows.
  // Ultra Miami 2016, 2017 and 2019 add one, pending with no claim: a second
  // BONNIE X CLYDE billing (2019 Saturday) under its existing pending entry:
  // 212 rows. III Points 2014 adds two, pending with no claim: VI (THE DEEP
  // END) and LAURA (OF MIAMI), each a parenthetical that is not sourced (the
  // Bunny (Rabbit in the Moon) rule): 214 rows. LAUFEY WITH THE CHICAGO
  // PHILHARMONIC is then ruled under the "with" rule (the orchestra's own event
  // page bills the set as Laufey's): 213 rows. Coachella 2022 adds four, all
  // pending with no claim: "The Blessed Madonna + Honey Dijon" (two rows, one
  // per weekend's Sunday), "Loboman x Massio" (Weekend 2 Saturday) and PUP, a
  // short name now at two brands (Lollapalooza 2017, Coachella 2022): 217 rows.
  // Coachella 2010, 2011, 2023 and 2024 add fifteen, all pending with no claim,
  // and drop one: "Loboman x Massio" now reads as a collab of two known acts
  // (Loboman plays Coachella 2023 and 2024). The fifteen: "Thao with the Get
  // Down Stay Down" and "Andy C. + GQ" (2011); "Dennis Cruz + PAWSA", "DJ Tennis
  // + Carlita", "Fisher + Chris Lake" and "DPR LIVE + DPR IAN" (2023, two rows
  // each, one per weekend); "Triste Juventud x TÓTEM" (2023) and "Triste
  // Juventud x TOTEM" (2024); "Jamie xx x Floating Points x Daphni" (2024); and
  // UMI and Maz, short names now at more than one brand: 231 rows. The cap is
  // 231.
  // Coachella 2025 adds five, all pending with no claim: "Triste Juventud x
  // Tótem", "Fcukers DJ set x HAAi", "Barry Can't Swim x 2manydjs x salute",
  // "Kaskade Redux x IDRIS" and "Alesso Body Hi x Gorgon City": 236 rows.
  // The cap is 1000 (Jake's typed "we can go cap 1000", 2026-11-22), in place
  // of 236/238. Past 1000, stop and report.
  check(review.length <= 1000, `review queue is ${review.length} rows (> 1000 means stop and report)`);
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

// ── Every archived set carries its source's date ─────────────────────────
// An official_sources graphic has no Wayback timestamp: its own publish date
// stands in (Escape 2024 read null until the graphic kind was handled).
{
  const ed = out.rows.filter(r => r.source === 'edition');
  check(ed.length > 1000, `control: ${ed.length} archived rows read`);
  // The one exception: a day whose only sources are the festival's own listed
  // Instagram posts, which print no date (none is inferred from a shortcode),
  // so the card shows none. Dreamstate 2023 and 2025 are that case; the
  // predicate is the validator's own (undatedOwnPost), so the two cannot drift.
  const undated = (id, day) => {
    const caps = JSON.parse(readFileSync(new URL(`../data/historical/editions/${id}.json`, import.meta.url), 'utf8')).provenance.captures.filter(c => c.day === day);
    return caps.length > 0 && caps.every(c => undatedOwnPost(id, c));
  };
  const missing = ed.filter(r => !r.published && !undated(r.festivalId, r.day));
  check(missing.length === 0, `archived sets with no "as published" date: ${[...new Set(missing.map(r => r.festivalId))]}`);
  {
    const real = JSON.parse(readFileSync(new URL('../data/historical/editions/dreamstate-socal-2023.json', import.meta.url), 'utf8')).provenance.captures[0];
    const other = { ...real, foundAt: 'https://www.instagram.com/p/UNRELATED_POST/', receipt: { ...real.receipt, url: 'https://www.instagram.com/p/UNRELATED_POST/embed/captioned/' }, rehostedBy: 'Another Instagram account' };
    check(undatedOwnPost('dreamstate-socal-2023', real), 'control: the real undated Dreamstate 2023 post is accepted');
    check(!undatedOwnPost('dreamstate-socal-2023', other), 'an unrelated post by another account is accepted as undated');
    check(!undatedOwnPost('escape-halloween-2024', real), "another festival's edition borrows Dreamstate's undated post");
  }
  const ig = ed.filter(r => /^dreamstate-socal-202[35]$/.test(r.festivalId));
  check(ig.length === 154 && ig.every(r => r.published == null), `Dreamstate 2023 + 2025 sets carry no inferred date: ${ig.length} rows, ${ig.filter(r => r.published).length} dated`);
  const nk = ed.filter(r => r.festivalId === 'escape-halloween-2019' && /^nukid$/i.test(r.printed)).map(r => `${r.printed} ${r.published}`).sort();
  check(nk.join() === 'NUKID 2019-10-21,NuKid 2020-08-17', `a set keeps its own printing and its own source's date (Escape 2019 NuKid): ${nk}`);
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
  // #309: a ruling is evidence only where its page printed the act. Every row
  // a ruling applies to must have been recorded from one of the ruling's own
  // sources, not just from some page that printed the same text at another
  // festival. Rows below use a ruling whose source is another page, and no
  // read has yet confirmed their own page prints the act. Each stays listed,
  // NOT VERIFIED, until a read adds its page to the ruling or rules it
  // per festival. A listed row that becomes cited fails as stale.
  const RULING_SRC_UNVERIFIED = new Set([
    'lights-all-night-2026:lan-skull-machine-black-tiger-sex-machine-x-kai-wachi',
    'defqon1-2015:d2:brown:1800:mark-with-a-k',
    'edc-las-vegas-2024:d1:quantum-valley:2000:paul-oakenfold-full-on-fluoro',
    'edc-las-vegas-2024:d2:cosmic-meadow:0400:worship-sub-focus-b2b-dimension-b2b-culture-shock-b2b-1991',
    'edc-las-vegas-2024:d2:basspod:1900:fallen-with-mc-dino',
    'edc-orlando-2024:d2:circuit-grounds:1300:fury-with-mc-dino',
    'electric-forest-2014:d2:tripolee:1330:fury-mc-dino',
    'ultra-miami-2016:d2:ultra-main-stage:1915:tiesto-sunset-slot',
    'ultra-miami-2019:d1:worldwide-stage:2330:dog-blood-skrillex-boys-noize',
    'ultra-miami-2022:d2:live-stage:2300:kshmr-the-live-experience',
  ]);
  {
    const rulingOf = new Map((ov.billing || []).map(o => [o.printed, [].concat(o.source)]));
    const dropped = new Set(out.excluded.map(e => e.id));
    const uncited = out.rows.filter(r => rulingOf.has(r.printed) && !dropped.has(r.id) && !rulingOf.get(r.printed).includes(r.src));
    const unlisted = uncited.filter(r => !RULING_SRC_UNVERIFIED.has(r.id));
    check(unlisted.length === 0, `a ruling applied where its source never printed the row: ${unlisted.slice(0, 5).map(r => `${r.id} (${r.src})`).join(', ')}`);
    const live = new Set(uncited.map(r => r.id));
    const stale = [...RULING_SRC_UNVERIFIED].filter(id => !live.has(id));
    check(stale.length === 0, `stale RULING_SRC_UNVERIFIED entries (now cited, or gone): ${stale.join(', ')}`);
    check(uncited.length >= 1 || RULING_SRC_UNVERIFIED.size === 0, 'control: the per-row source check read no rows');
  }
  const ids = new Set(review.map(r => r.id)), printed = new Set(review.map(r => r.printed));
  for (const o of ov.pending || []) check(o.key ? ids.has(`key:${o.key}`) : printed.has(o.printed), `stale pending entry: ${o.key || o.printed}`);
  const by = t => billings.find(b => b.printed === t);
  const roles = b => b && b.performers.map(x => `${x.key}:${x.role}`).join(' ');
  check(roles(by('Fallen with MC Dino')) === 'fallen:performer mc-dino:mc', `MC ruling: ${roles(by('Fallen with MC Dino'))}`);
  // A past edition's billing, so a lineup refresh cannot remove the fixture
  // (BT + Matt Fax left the Dreamstate SoCal 2026 lineup on 2026-11-20).
  check(roles(by('Nosaj Thing + Daito Manabe')) === 'nosaj-thing:cobilled daito-manabe:cobilled', `co-billed ruling: ${roles(by('Nosaj Thing + Daito Manabe'))}`);
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
  // Every folded letter folds in both cases: the table had ð but not Ð, so
  // Lollapalooza 2024's "DAÐI FREYR" keyed apart from "Daði Freyr".
  const pairs = 'ØøÆæŒœŁłĐđÞþÐð';
  for (let i = 0; i < pairs.length; i += 2)
    check(artistKey(`A${pairs[i]}B`) === artistKey(`a${pairs[i + 1]}b`) && artistKey(`a${pairs[i]}b`) !== 'a-b', `${pairs[i]} / ${pairs[i + 1]} fold to different keys`);
  check(artistKey('DAÐI FREYR') === artistKey('Daði Freyr'), 'DAÐI FREYR and Daði Freyr are two keys');
  const plain = out.billings.map(b => b.printed).filter(t => !/[¥ØøÆæŒœßŁłĐđÞþÐð]/.test(t));
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
  // The slices the app ships are written compact. directory.json went stale
  // on main (ecda893 moved III Points' RC95 close) while this checked only
  // the four files above.
  for (const [f, v] of Object.entries({ 'directory.json': out.directory, 'careers.json': out.careers })) {
    let disk = null; try { disk = readFileSync(`data/artists/${f}`, 'utf8'); } catch {}
    check(disk === JSON.stringify(v) + '\n', `data/artists/${f} is stale — run: node scripts/build-artist-registry.mjs`);
  }
}

if (problems.length) {
  console.log(`  ✗ artist registry: ${problems.length} of ${checks} checks failed`);
  for (const p of problems) console.log(`    ✗ ${p}`);
  process.exit(1);
}
console.log(`  ✓ artist registry: ${checks} checks — ${out.counts.rows} rows → ${out.counts.billings} billings (${out.counts.ruled} by ruling), ${out.counts.artists} artists, ${out.counts.review} in review (${out.counts.pending} pending, ${out.counts.unruled} unruled), ${out.counts.excluded} excluded`);
