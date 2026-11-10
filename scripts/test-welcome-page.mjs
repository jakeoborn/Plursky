#!/usr/bin/env node
// Gate for /welcome/ (scripts/gen-welcome-page.mjs).
//
// 1. The committed page matches what the template and the registry generate.
// 2. The onboarding hand-off writes the exact keys the app reads, so a pick
//    made on /welcome/ is there when /?f=<id> opens. If either side renames a
//    key, this fails instead of the picks silently vanishing.
// 3. Every festival the page can open has a lineup to load.

import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const fail = (m) => { console.error(`✗ ${m}`); process.exit(1); };
const read = (f) => readFileSync(path.join(root, f), 'utf8');

console.log('▸ Welcome page gate');
execFileSync(process.execPath, ['scripts/gen-welcome-page.mjs', '--check'], { cwd: root, stdio: 'inherit' });

const page = read('welcome/index.html');
const landing = read('landing.jsx');
const app = read('app.jsx');

if (!landing.includes('"plursky_saved_festivals_v1"')) fail('landing.jsx no longer uses plursky_saved_festivals_v1; update the welcome hand-off');
if (!/readSavedFestivals[\s\S]*raw\.ids/.test(landing)) fail('landing.jsx saved-festival shape changed from { v, ids }; update the welcome hand-off');
if (!app.includes('const _SAVED_KEY = `${_FID}_saved_v1`')) fail('app.jsx saved-artist key changed from <festivalId>_saved_v1; update the welcome hand-off');
if (!page.includes('"plursky_saved_festivals_v1"')) fail('welcome page does not write plursky_saved_festivals_v1');
if (!page.includes('id + "_saved_v1"')) fail('welcome page does not write <festivalId>_saved_v1');
if (!page.includes('"/?f=" + encodeURIComponent(id)')) fail('welcome page no longer hands off with ?f=<id>');
console.log('  ✓ hand-off keys match landing.jsx and app.jsx');

const m = page.match(/window\.WELCOME_DATA = (\{[\s\S]*?\});\n/);
if (!m) fail('welcome page has no WELCOME_DATA');
const { festivals } = JSON.parse(m[1]);
const open = festivals.filter((f) => f.available && f.hasSchedule);
for (const f of open) {
  if (!existsSync(path.join(root, 'f', f.id, 'schedule.json'))) fail(`${f.id} is offered but f/${f.id}/schedule.json is missing`);
}
if (/<\/script/i.test(m[1])) fail('WELCOME_DATA contains a closing script tag');
console.log(`  ✓ ${open.length} open festivals each have a lineup to load`);
