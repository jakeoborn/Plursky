// The app's CDN assets (React, ReactDOM, supabase-js from index.html; the
// MapLibre script and stylesheet map.jsx injects at runtime), served to a gate
// from scripts/vendor/ instead of the live CDN. A gate that fetched them live read
// a CDN hiccup as an app fault: "React is not defined", "createClient of
// undefined", a screen that never mounted (this Mac, 2026-10-14, twice in one
// afternoon). index.html's integrity pins are the source of truth: each
// vendored file is checked against its sha384 before it is served, so the
// copy can never drift from what the app ships — bump the pin and the gate
// says "run node scripts/vendor-cdn.mjs" until the copy is refreshed. The
// runtime assets carry no integrity attribute in the app, so their pin is
// scripts/vendor/manifest.json, written by the refresh command the first time
// a URL is vendored and verified against on every later refresh and check.
import { readFileSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
export const VENDOR_DIR = join(ROOT, 'scripts', 'vendor');
export const MANIFEST = join(VENDOR_DIR, 'manifest.json');
const JS = 'application/javascript; charset=utf-8', CSS = 'text/css; charset=utf-8';
const fileFor = (url) => join(VENDOR_DIR, url.replace(/^https:\/\//, '').replace(/[^a-z0-9.@-]/gi, '_'));
export const readManifest = () => existsSync(MANIFEST) ? JSON.parse(readFileSync(MANIFEST, 'utf8')) : {};

// Every pinned outside script in index.html: [{ url, integrity, type, file, pin }].
export function cdnScripts(indexHtml = join(ROOT, 'index.html')) {
  const html = readFileSync(indexHtml, 'utf8');
  const out = [];
  for (const m of html.matchAll(/<script src="(https:\/\/[^"]+)" integrity="(sha384-[^"]+)"/g)) {
    out.push({ url: m[1], integrity: m[2], type: JS, file: fileFor(m[1]), pin: 'index.html' });
  }
  if (!out.length) throw new Error(`vendor-cdn: no pinned <script src integrity> in ${indexHtml}`);
  return out;
}

// The assets map.jsx injects when the real map opens (PACK_LIB's script and
// stylesheet). No integrity attribute in the app, so `integrity` is the
// manifest's entry for that URL, or null until the refresh command pins it.
export function runtimeAssets(mapJsx = join(ROOT, 'map.jsx')) {
  const src = readFileSync(mapJsx, 'utf8');
  const m = src.match(/const PACK_LIB = \{\s*js: "(https:\/\/[^"]+)",\s*css: "(https:\/\/[^"]+)",?\s*\}/);
  if (!m) throw new Error(`vendor-cdn: PACK_LIB { js, css } not found in ${mapJsx}`);
  const manifest = readManifest();
  return [[m[1], JS], [m[2], CSS]].map(([url, type]) => ({ url, integrity: manifest[url] || null, type, file: fileFor(url), pin: 'scripts/vendor/manifest.json' }));
}

export const allAssets = (indexHtml, mapJsx) => cdnScripts(indexHtml).concat(runtimeAssets(mapJsx));

export const sha384 = (buf) => 'sha384-' + createHash('sha384').update(buf).digest('base64');

// The vendored bodies, verified. Throws naming the file and the fix when a
// copy is missing, unpinned, or no longer matches its pin.
export function vendoredScripts(indexHtml, mapJsx) {
  return allAssets(indexHtml, mapJsx).map((s) => {
    if (!s.integrity) throw new Error(`vendor-cdn: ${s.url} is not pinned in ${s.pin} — run node scripts/vendor-cdn.mjs`);
    if (!existsSync(s.file)) throw new Error(`vendor-cdn: ${s.file} is missing — run node scripts/vendor-cdn.mjs`);
    const body = readFileSync(s.file);
    const got = sha384(body);
    if (got !== s.integrity) throw new Error(`vendor-cdn: ${s.file} is ${got}, ${s.pin} pins ${s.integrity} — run node scripts/vendor-cdn.mjs`);
    return { ...s, body };
  });
}

// Routes the pinned CDN URLs on a Playwright context to the vendored bodies.
// Register it AFTER any broader route (Playwright tries the last-registered
// handler first), so an "abort everything outside the box" route still
// refuses the rest of the network while these are served locally.
export async function wireVendor(ctx, indexHtml, mapJsx) {
  const scripts = vendoredScripts(indexHtml, mapJsx);
  for (const s of scripts) {
    await ctx.route(s.url, (route) => route.fulfill({
      status: 200, body: s.body,
      headers: { 'content-type': s.type, 'access-control-allow-origin': '*', 'cache-control': 'no-store' },
    }));
  }
  return scripts.map((s) => s.url);
}
