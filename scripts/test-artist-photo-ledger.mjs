import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { validateLedger } from './lib/artist-photo-ledger.mjs';
const root = mkdtempSync(join(tmpdir(), 'artist-ledger-'));
mkdirSync(join(root, 'artist-photos'));
const asset = 'artist-photos/test-artist.png';
const bytes = Buffer.from('fixture bytes, not production artwork');
writeFileSync(join(root, asset), bytes);
const row = {artist:'Test Artist', author:'Fixture Photographer', source:'commons', license:'CC-BY-4.0', licenseUrl:'https://creativecommons.org/licenses/by/4.0/', sourceUrl:'https://commons.wikimedia.org/wiki/File:Fixture.png', reviewedBy:'Fixture Reviewer', reviewedAt:'2026-09-30T18:00:00-05:00', allowExport:false, asset, sha256:createHash('sha256').update(bytes).digest('hex')};
let checks = 0;
const ok = (v, msg) => { assert.ok(v, msg); checks++; };
try {
  ok(validateLedger([row], root)['test-artist'].url === './'+asset, 'maps reviewed local asset under its artist key');
  assert.throws(() => validateLedger([row,{...row,artist:'TÉST ARTIST'}], root)); checks++;
  ok(Object.keys(validateLedger([], root)).length === 0, 'empty stays honest');
  for (const patch of [
    {source:'spotify'}, {source:'instagram'}, {license:'all-rights-reserved'},
    {author:''}, {author:'x'.repeat(33)}, {reviewedBy:''}, {reviewedAt:'bad'}, {allowExport:true},
    {sourceUrl:'https://example.com/photo'}, {licenseUrl:'http://bad.invalid'},
    {sha256:'0'.repeat(64)}, {asset:'../outside.jpg'}, {asset:'artist-photos/file.svg'},
    {license:'Press-Grant'}, {source:'press-kit',license:'Press-Grant',grantUrl:'https://example.com/press',grantText:''},
    {source:'press-kit',license:'Press-Grant',sourceUrl:'https://www.instagram.com/p/test',grantUrl:'https://example.com/press',grantText:'Grant'},
  ]) { assert.throws(() => validateLedger([{...row,...patch}], root)); checks++; }
  assert.throws(() => validateLedger([row,row], root)); checks++;
  const press = {...row,source:'press-kit',license:'Press-Grant',sourceUrl:'https://artist.example/press',grantUrl:'https://artist.example/press-terms',grantText:'Fixture grant permits permanent display and storage.'};
  ok(!!validateLedger([press],root), 'explicit press grant passes');
  ok(!!validateLedger([{...press,grantType:'press-page'}],root), 'press page is the default grant type');
  const {grantUrl, ...noUrl} = press;
  const email = {...noUrl,grantType:'email',grantFrom:'Fixture Management (artist management)',grantDate:'2026-09-29',grantText:'Yes, you may store and display this photo in the app with credit.',grantEvidenceSha256:'a'.repeat(64)};
  ok(!!validateLedger([email],root), 'documented email grant passes');
  for (const patch of [
    {grantType:'dm'}, {grantUrl:'https://artist.example/press-terms'}, {grantFrom:''},
    {grantFrom:'manager@artist.example'}, {grantText:'OK. Reach me at manager@artist.example'},
    {grantDate:''}, {grantDate:'2026-10-01'}, {grantDate:'29/09/2026'}, {grantEvidenceSha256:''},
    {grantEvidenceSha256:'A'.repeat(64)}, {license:'CC-BY-4.0'},
  ]) { assert.throws(() => validateLedger([{...email,...patch}], root)); checks++; }
  { const {grantType, ...asPressPage} = email; assert.throws(() => validateLedger([asPressPage], root)); checks++; }
  console.log(`Artist photo ledger: ${checks} checks passed`);
} finally { rmSync(root,{recursive:true,force:true}); }
// Test the actual runtime resolver, not a duplicated implementation.
const { readFileSync } = await import('node:fs');
const { runInNewContext } = await import('node:vm');
const source = readFileSync(new URL('../chrome.jsx', import.meta.url), 'utf8');
const start = source.indexOf('const ARTIST_IMAGES_KEY');
const end = source.indexOf('// Drops expired Spotify');
const store = {'temporary':{url:'https://spotify.example/photo.jpg',source:'spotify',fetchedAt:1000}};
const permanent = {...row,url:'./artist-photos/test-artist.png'};
const sandbox = {window:{PLURSKY_ARTIST_PHOTOS:{'test artist':permanent}},localStorage:{getItem:()=>JSON.stringify(store)},Date};
runInNewContext(readFileSync(new URL('../data/artist-key.js', import.meta.url),'utf8'),sandbox);
sandbox.window.PLURSKY_ARTIST_PHOTOS={'test-artist':permanent};
runInNewContext(source.slice(start,end)+';this.get = getArtistImage;this.share=getShareableArtistImage;',sandbox);
assert.equal(sandbox.get('Test Artist').source,'commons');
assert.equal(sandbox.share('Test Artist'),null);
assert.equal(sandbox.get('temporary',1001).source,'spotify');
assert.equal(sandbox.get('temporary',1000+24*60*60*1000),null);
assert.equal(sandbox.share('temporary'),null);
assert.equal(sandbox.get('Unknown Artist'),null);
// M3: the photo follows the artist key, not the exact billing string; a
// billing that names several people never borrows one member's photo.
for (const n of ['TEST ARTIST','Test Artist (Sunrise Set)','Tést Artist (live)']) assert.equal(sandbox.get(n)?.source,'commons',n);
for (const n of ['Test Artist b2b Other','Other presents Test Artist (Test Artist + Other)','Test Artist (Classics)']) assert.equal(sandbox.get(n),null,n);
sandbox.window.PLURSKY_ARTIST_PHOTOS['bad']={...permanent,url:'https://instagram.com/download.jpg'};
assert.equal(sandbox.get('bad'),null);
console.log('Artist photo runtime: 13 checks passed');
