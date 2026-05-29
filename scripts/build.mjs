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

const allFiles = [...new Set([...COPY, ...jsxFiles, ...imgFiles])];
for (const file of allFiles) {
  const src = path.join(root, file);
  if (!existsSync(src)) {
    console.warn(`[build] skip missing: ${file}`);
    continue;
  }
  await cp(src, path.join(dist, file));
}

console.log(`[build] dist/ ready (${allFiles.length} files)`);
