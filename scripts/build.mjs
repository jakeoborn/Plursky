#!/usr/bin/env node
// Copies the static SPA into dist/ for Capacitor to bundle into the iOS app.
import { cp, mkdir, rm, readdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dist = path.join(root, 'dist');

const COPY = [
  'index.html',
  'callback.html',
  'privacy.html',
  'manifest.json',
  'sw.js',
  'apple-touch-icon.png',
  'icon-192.png',
  'icon-512.png',
  'og.svg',
];

await rm(dist, { recursive: true, force: true });
await mkdir(dist, { recursive: true });

const entries = await readdir(root, { withFileTypes: true });
const jsxFiles = entries.filter(e => e.isFile() && e.name.endsWith('.jsx')).map(e => e.name);
// Image assets (map artwork, etc.) so the iOS bundle has them too — without
// this, image-overlay maps (EDC aerial, ACL park) are blank in the native app.
const imgFiles = entries
  .filter(e => e.isFile() && /\.(webp|jpe?g|png|gif|svg)$/i.test(e.name))
  .map(e => e.name);

// Per-festival data modules (data/festivals/*.js). These are loaded by
// index.html BEFORE data.jsx and every festival they carry disappears from the
// switcher without them — and it disappears QUIETLY, because data.jsx skips a
// missing module with a console warning rather than throwing. The copy loop
// above only walks the repo root, so nested directories have to be named here;
// anything else added under a subdirectory needs the same treatment.
const dataFiles = existsSync(path.join(root, 'data', 'festivals'))
  ? (await readdir(path.join(root, 'data', 'festivals')))
      .filter(f => f.endsWith('.js')).map(f => path.join('data', 'festivals', f))
  : [];

const allFiles = [...new Set([...COPY, ...jsxFiles, ...imgFiles, ...dataFiles])];
for (const file of allFiles) {
  const src = path.join(root, file);
  if (!existsSync(src)) {
    console.warn(`[build] skip missing: ${file}`);
    continue;
  }
  const dest = path.join(dist, file);
  await mkdir(path.dirname(dest), { recursive: true });
  await cp(src, dest);
}

// Guard: index.html must not reference a local file the copy above missed. A
// 404 on a data module is silent in the app (the festival just vanishes), so
// catch it here where it is loud.
{
  const html = (await import('node:fs')).readFileSync(path.join(root, 'index.html'), 'utf8');
  const refs = [...html.matchAll(/(?:src|href)="(?!https?:|data:|#)([^"?]+)(?:\?[^"]*)?"/g)]
    .map(m => m[1].replace(/^\.\//, ''))
    .filter(f => !f.startsWith('/') && /\.(js|jsx|css|json|svg|png|webp|jpe?g)$/i.test(f));
  const missing = [...new Set(refs)].filter(f => !existsSync(path.join(dist, f)));
  if (missing.length) {
    console.error(`[build] index.html references files missing from dist/: ${missing.join(', ')}`);
    process.exit(1);
  }
}

console.log(`[build] dist/ ready (${allFiles.length} files)`);
