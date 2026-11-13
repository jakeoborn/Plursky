#!/usr/bin/env node
// The Commons photo pipeline's match, license and credit rules
// (scripts/find-commons-photos.mjs), offline. A wrong face is worse than
// initials, so each rule has a case that must be refused.
import assert from 'node:assert/strict';
import { pickEntity, isMusicAct, namesBilling, mapLicense, cleanAuthor, commonsFlag } from './find-commons-photos.mjs';

let checks = 0;
const ok = (v, m) => { checks++; assert.ok(v, m); };
const eq = (a, b, m) => { checks++; assert.deepEqual(a, b, m); };
const snak = v => ({ rank: 'normal', mainsnak: { snaktype: 'value', datavalue: { value: v } } });
const ent = (id, label, claims = {}, aliases = [], description) => ({
  id, labels: { en: { value: label } }, aliases: { en: aliases.map(value => ({ value })) },
  ...(description ? { descriptions: { en: { value: description } } } : {}),
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

// The recheck's over-correction: real acts Wikidata types loosely.
const img = { P18: ['Face.jpg'] };
eq(pickEntity('Michael Bibi', [ent('Q30', 'Michael Bibi', { P31: [{ id: 'Q5' }], ...img }, [], 'British DJ and record producer')]).image, 'Face.jpg', 'a human described as a DJ counts');
eq(pickEntity('Japanese Breakfast', [ent('Q31', 'Japanese Breakfast', { P31: [{ id: 'Q99' }], ...img }, [], 'American indie pop band')]).image, 'Face.jpg', 'a project described as a band counts');
eq(pickEntity('KATSEYE', [ent('Q32', 'Katseye', { P31: [{ id: 'Q641066' }], ...img })]).image, 'Face.jpg', 'a girl group counts');
eq(pickEntity('P!NK', [ent('Q33', 'Pink', { ...person, ...img }, ['P!nk'])]).image, 'Face.jpg', 'a three-letter alias matches');
eq(pickEntity('O.A.R.', [ent('Q34', 'O.A.R. (band)', { P31: [{ id: 'Q5741069' }], ...img })]).image, 'Face.jpg', "a label's own disambiguation is ignored");
eq(pickEntity('Nero', [ent('Q35', 'Nero', { P31: [{ id: 'Q5' }], ...img }, [], 'Roman emperor from 54 to 68')]).reason, 'no-music-item', 'an emperor is still refused');
eq(pickEntity('Zero', [ent('Q36', 'Zero', img, [], 'fictional singer in an anime series')]).reason, 'no-music-item', 'a fictional singer by description is refused');
eq(pickEntity('Twin Peaks', [ent('Q37', 'Twin Peaks', img, [], 'American comedy duo')]).reason, 'no-music-item', 'a comedy duo is refused');
eq(pickEntity('Pulse', [ent('Q38', 'Pulse', img, [], 'song by an American band')]).reason, 'no-music-item', 'a song is refused');
eq(pickEntity('Adam Scott', [ent('Q39', 'Adam Scott', { P31: [{ id: 'Q5' }], P106: [{ id: 'Q33999' }], ...img }, [], 'American actor')]).reason, 'no-music-item', 'an actor namesake is refused');
eq(pickEntity('Corbu', [ent('Q4724', 'Corbu', { ...person, ...img })], new Set(['Q4724'])).reason, 'no-item', 'a held item is never used');

// Licenses: only the ledger's allow-list, with its canonical https URL.
eq(mapLicense('CC BY-SA 4.0'), { license: 'CC-BY-SA-4.0', licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0/' }, 'BY-SA 4.0');
eq(mapLicense('CC0')?.license, 'CC0-1.0', 'CC0');
eq(mapLicense('Public domain')?.license, 'Public-Domain', 'public domain');
eq(mapLicense('CC BY-SA 3.0 de')?.license, 'CC-BY-SA-3.0-DE', 'German 3.0 port');
for (const bad of ['CC BY-NC 2.0', 'CC BY-SA 2.5', 'GFDL', 'Copyrighted free use', 'All rights reserved', '', undefined])
  eq(mapLicense(bad), null, `refused: ${bad}`);

// Rule 5: a flagged Commons page is refused, whatever its license field says.
// The flagged fixtures are the live pages of the five files #419 dropped
// (read Nov 2026); each must be REFUSED with its reason. (Evan Giia went by
// ruling: its page carries no flag, see the clean cases below.)
const pg = (title, templates = [], categories = [], extra = {}) => ({ title: 'File:' + title,
  templates: templates.map(t => ({ ns: 10, title: 'Template:' + t })), categories: categories.map(c => ({ ns: 14, title: 'Category:' + c })), ...extra });
const flagged = [
  [pg('Gallant-Plaid-Suit-Yellow-Green.jpg', ['Deletion template tag', 'No permission since', 'No permission since/en'], ['All media missing permission', 'CC-Zero', 'Media missing permission as of 8 November 2026']), 'commons-deletion-request'],
  [pg('Gallant-Plaid-Suit-Yellow-Green.jpg', [], ['All media missing permission', 'CC-Zero']), 'commons-missing-permission'],
  [pg('R3hab (Cropped).jpg', ['Delete', 'Delete/en', 'FlickreviewR/link'], ['CC-BY-2.0', 'Deletion requests October 2026', 'Flickr images reviewed by trusted users']), 'commons-deletion-request'],
  [pg('R3hab (Cropped).jpg', [], ['Deletion requests October 2026']), 'commons-deletion-request'],
  [pg('Fujii Kaze (cropped) (2).jpg', ['Extracted from deleted', 'Extracted from deleted/en'], ['CC-BY-4.0', 'Extracted images with broken file links (unreviewed)']), 'commons-source-deleted'],
  [pg('Katseye at Wango Tango 2025 (cropped).jpg', ['Extracted from deleted'], ['CC-BY-4.0', 'Extracted images with broken file links (unreviewed)']), 'commons-source-deleted'],
  [pg('Copied.jpg', ['Copyvio']), 'commons-copyright-dispute'],
  [pg('Copied.jpg', [], ['Copyright violations']), 'commons-copyright-dispute'],
  [pg('NoSource.jpg', ['No source since']), 'commons-no-source-or-license'],
  [pg('NoLicense.jpg', [], ['Media without a license as of 1 November 2026']), 'commons-no-source-or-license'],
  [pg('Gone.jpg', [], [], { missing: '' }), 'commons-file-missing'],
];
for (const [page, reason] of flagged) eq(commonsFlag(page)?.reason, reason, `refused (${reason}): ${page.title}`);
// Clean pages pass: review, extraction and undeletion are not flags.
for (const page of [
  pg('Skrillex.jpg', ['Information', 'Cc-by-2.0', 'FlickreviewR/link', 'Flickrreview'], ['CC-BY-2.0', 'Flickr images reviewed by FlickreviewR', 'Skrillex']),
  pg('Act (cropped).jpg', ['Extracted from', 'Self'], ['CC-BY-SA-4.0', 'Extracted images', 'Self-published work']),
  pg('Restored.jpg', ['Undeleted'], ['Undeleted files', 'License review needed? no']),
  pg('Plain.jpg'),
  // A broken link is not a flag: Gesaffelstein's crop links a deleted copy made
  // FROM it; Evan Giia's links a stray "TestPhoto2.jpg" (live pages, Nov 2026).
  pg('Brodinski&Gesaffelstein crop.jpg', ['Information', 'Image extracted', 'Cc-by-2.0'], ['Gesaffelstein', 'Files with broken file links']),
  pg('Evan GIIA performing in Montreal (cropped).jpg', ['Information', 'Extracted from', 'Self'], ['CC-BY-SA-4.0', 'Extracted images', 'Files with broken file links', 'Self-published work']),
]) eq(commonsFlag(page), null, `clean: ${page.title}`);
eq(commonsFlag(undefined), null, 'no page read: no claim (the caller skips it as unread)');

// Credits: text only, never cut mid-name, never longer than 32.
eq(cleanAuthor('<a href="//commons.wikimedia.org/wiki/User:Jane">Jane Doe</a>'), 'Jane Doe', 'link text');
eq(cleanAuthor('Rich &amp; Co'), 'Rich & Co', 'entities');
eq(cleanAuthor('Jane Doe from Denver, Colorado, United States of America'), 'Jane Doe', 'flickr place suffix dropped');
eq(cleanAuthor('A Very Long Photographer Name Indeed Beyond'), null, 'too long, no safe cut');
eq(cleanAuthor('Unknown author'), null, 'unknown author refused');
eq(cleanAuthor(''), null, 'empty refused');

console.log(`commons-photos: ${checks} checks`);
