import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { validateLedger } from './lib/artist-photo-ledger.mjs';
const root = fileURLToPath(new URL('../', import.meta.url));
const ledger = validateLedger(JSON.parse(readFileSync(new URL('../data/artist-photos/ledger.json', import.meta.url))), root);
const output = 'window.PLURSKY_ARTIST_PHOTOS = ' + JSON.stringify(ledger, null, 2) + ';\n';
const target = new URL('../data/artist-photos.js', import.meta.url);
if (process.argv.includes('--check')) {
  if (readFileSync(target, 'utf8') !== output) throw new Error('Artist photo runtime ledger is stale');
} else writeFileSync(target, output);
console.log('Artist photo ledger: ' + Object.keys(ledger).length + ' reviewed assets');
