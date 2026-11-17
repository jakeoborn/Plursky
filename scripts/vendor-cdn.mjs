// Refreshes scripts/vendor/ from the app's pinned CDN assets and verifies each
// download against its pin: index.html's integrity attribute for the three
// scripts, scripts/vendor/manifest.json for the MapLibre script and stylesheet
// map.jsx injects at runtime (the manifest entry is written the first time a
// URL is vendored; delete it on purpose to re-pin a URL whose body changed).
// Run it after bumping a pin; the gates refuse a stale, unpinned or missing
// copy. `--check` only verifies what is on disk.
import { writeFileSync, mkdirSync, existsSync, readFileSync } from 'node:fs';
import { allAssets, sha384, VENDOR_DIR, MANIFEST, readManifest } from './lib/vendor-cdn.mjs';

const check = process.argv.includes('--check');
mkdirSync(VENDOR_DIR, { recursive: true });
const manifest = readManifest();
let bad = 0, pinned = 0;
for (const s of allAssets()) {
  let body;
  if (check) {
    if (!s.integrity) { console.log(`  ✗ ${s.url} is not pinned in ${s.pin}`); bad++; continue; }
    if (!existsSync(s.file)) { console.log(`  ✗ missing ${s.file}`); bad++; continue; }
    body = readFileSync(s.file);
  } else {
    const res = await fetch(s.url);
    if (!res.ok) { console.log(`  ✗ ${res.status} ${s.url}`); bad++; continue; }
    body = Buffer.from(await res.arrayBuffer());
  }
  const got = sha384(body);
  if (!s.integrity) {
    manifest[s.url] = got; pinned++;
    writeFileSync(s.file, body);
    console.log(`  ✓ vendored and pinned ${s.url} (${body.length} bytes, ${got})`);
    continue;
  }
  if (got !== s.integrity) { console.log(`  ✗ ${s.url}: ${got} does not match ${s.pin}'s ${s.integrity}`); bad++; continue; }
  if (!check) writeFileSync(s.file, body);
  console.log(`  ✓ ${check ? 'verified' : 'vendored'} ${s.url} (${body.length} bytes, ${s.pin} pin ok)`);
}
if (pinned) writeFileSync(MANIFEST, JSON.stringify(Object.fromEntries(Object.entries(manifest).sort()), null, 2) + '\n');
if (bad) { console.log(`✗ vendor-cdn: ${bad} asset(s) not vendored`); process.exit(1); }
console.log(`✓ vendor-cdn: ${allAssets().length} pinned assets ${check ? 'verified' : 'vendored'} in scripts/vendor/`);
