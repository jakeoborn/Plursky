#!/usr/bin/env node
// The Commons photo pipeline's match, license and credit rules
// (scripts/find-commons-photos.mjs), offline. A wrong face is worse than
// initials, so each rule has a case that must be refused.
import assert from 'node:assert/strict';
import { pickEntity, isMusicAct, namesBilling, mapLicense, cleanAuthor } from './find-commons-photos.mjs';

let checks = 0;
const ok = (v, m) => { checks++; assert.ok(v, m); };
const eq = (a, b, m) => { checks++; assert.deepEqual(a, b, m); };
const snak = v => ({ rank: 'normal', mainsnak: { snaktype: 'value', datavalue: { value: v } } });
const ent = (id, label, claims = {}, aliases = []) => ({
  id, labels: { en: { value: label } }, aliases: { en: aliases.map(value => ({ value })) },
  claims: Object.fromEntries(Object.entries(claims).map(([p, vs]) => [p, vs.map(snak)])),
});
const person = { P31: [{ id: 'Q5' }], P106: [{ id: 'Q639669' }] };
const music = { ...person, P18: ['Act.jpg'] };

// 1. Same artist key, music id, image: matched, with its image.
eq(pickEntity('GRiZ', [ent('Q1', 'Griz', music)]).image, 'Act.jpg', 'case-folded label matches');
eq(pickEntity('Tiësto', [ent('Q2', 'Tiesto', music)]).entity?.id, 'Q2', 'accent-folded label matches');
eq(pickEntity('ISOxo', [ent('Q3', 'Someone Else', music, ['ISOxo'])]).entity?.id, 'Q3', 'an alias matches');
// Refusals.
eq(pickEntity('Kasbo', [ent('Q4', 'Kasbon', music)]).reason, 'no-item', 'near name is not a match');
eq(pickEntity('Daniel Allan', [ent('Q12', 'Daniel Allan', { P31: [{ id: 'Q5' }], P106: [{ id: 'Q130857' }], P18: ['DJ.jpg'] })]).image, 'DJ.jpg', 'a DJ occupation counts as music');
eq(pickEntity('The Resistance', [ent('Q13', 'The Resistance', { P31: [{ id: 'Q215380' }], P18: ['Band.jpg'] })]).image, 'Band.jpg', 'a musical group counts as music');
eq(pickEntity('Levity', [ent('Q14', 'Levity', { P31: [{ id: 'Q5' }], P106: [{ id: 'Q36180' }], P18: ['Writer.jpg'] })]).reason, 'no-music-item', 'a writer namesake is refused');
eq(pickEntity('Levity', [ent('Q5', 'Levity', { P18: ['Book.jpg'] })]).reason, 'no-music-item', 'a namesake with no music id is refused');
eq(pickEntity('Zingara', [ent('Q6', 'Zingara', music), ent('Q7', 'Zingara', { ...person, P18: ['B.jpg'] })]).reason, 'ambiguous', 'two musical namesakes are refused');
eq(pickEntity('Deathpact', [ent('Q8', 'Deathpact', person)]).reason, 'no-image', 'no image');
const dep = ent('Q9', 'Crankdat', { ...person, P18: ['Old.jpg'] }); dep.claims.P18[0].rank = 'deprecated';
eq(pickEntity('Crankdat', [dep]).reason, 'no-image', 'a deprecated image is not used');
const pref = ent('Q10', 'Kasbo', { ...person, P18: ['A.jpg', 'B.jpg'] }); pref.claims.P18[1].rank = 'preferred';
eq(pickEntity('Kasbo', [pref]).image, 'B.jpg', 'the preferred image wins');
eq(pickEntity('Kasbo', [undefined, { id: 'Q11', missing: '' }]).reason, 'no-item', 'missing items are ignored');

// The Nov 2026 catalog spot check: namesakes that carried a music id.
eq(pickEntity('Nero', [ent('Q1413', 'Nero', { P31: [{ id: 'Q5' }], P106: [{ id: 'Q82955' }], P434: ['m'], P18: ['Bust.jpg'] })]).reason, 'no-music-item', 'an emperor with a MusicBrainz id is refused');
eq(pickEntity('Koa', [ent('Q20', 'Koa', { P31: [{ id: 'Q1060829' }], P434: ['m'], P18: ['Hall.jpg'] })]).reason, 'no-music-item', 'a building with a music id is refused');
eq(pickEntity('Zero', [ent('Q21', 'Zero', { P31: [{ id: 'Q15632617' }], P106: [{ id: 'Q177220' }], P18: ['Figure.jpg'] })]).reason, 'no-music-item', 'a fictional singer is refused');
eq(pickEntity('SJ', [ent('Q22', 'Super Junior', { P31: [{ id: 'Q215380' }], P18: ['Group.jpg'] }, ['SJ'])]).reason, 'no-item', 'a two-letter alias is not a match');
eq(pickEntity('Q', [ent('Q23', 'Quincy Jones', music, ['Q'])]).reason, 'no-item', 'a one-letter alias is not a match');
eq(pickEntity('Duo Act', [ent('Q24', 'Duo Act', { P31: [{ id: 'Q9212979' }], P18: ['Duo.jpg'] })]).image, 'Duo.jpg', 'a musical duo counts');
ok(isMusicAct(ent('Q25', 'X', music)) && !isMusicAct(ent('Q26', 'X', { P434: ['m'] })), 'a music id alone is not a musical act');
ok(namesBilling('Kasbo', ent('Q27', 'Kasbo')) && !namesBilling('Kasbo', ent('Q28', 'Other', {}, ['Kasb'])), 'label match, near alias refused');

// Licenses: only the ledger's allow-list, with its canonical https URL.
eq(mapLicense('CC BY-SA 4.0'), { license: 'CC-BY-SA-4.0', licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0/' }, 'BY-SA 4.0');
eq(mapLicense('CC0')?.license, 'CC0-1.0', 'CC0');
eq(mapLicense('Public domain')?.license, 'Public-Domain', 'public domain');
eq(mapLicense('CC BY-SA 3.0 de')?.license, 'CC-BY-SA-3.0-DE', 'German 3.0 port');
for (const bad of ['CC BY-NC 2.0', 'CC BY-SA 2.5', 'GFDL', 'Copyrighted free use', 'All rights reserved', '', undefined])
  eq(mapLicense(bad), null, `refused: ${bad}`);

// Credits: text only, never cut mid-name, never longer than 32.
eq(cleanAuthor('<a href="//commons.wikimedia.org/wiki/User:Jane">Jane Doe</a>'), 'Jane Doe', 'link text');
eq(cleanAuthor('Rich &amp; Co'), 'Rich & Co', 'entities');
eq(cleanAuthor('Jane Doe from Denver, Colorado, United States of America'), 'Jane Doe', 'flickr place suffix dropped');
eq(cleanAuthor('A Very Long Photographer Name Indeed Beyond'), null, 'too long, no safe cut');
eq(cleanAuthor('Unknown author'), null, 'unknown author refused');
eq(cleanAuthor(''), null, 'empty refused');

console.log(`commons-photos: ${checks} checks`);
