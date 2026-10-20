#!/usr/bin/env node
// watch-edco-map.mjs: has Insomniac published the official EDC Orlando 2026
// map yet? Run every Monday by .github/workflows/edco-map-watch.yml.
//
//   exit 0  no map image on the official pages (the expected state)
//   exit 1  a map image appeared: rebuild from it before the Nov 6-8 flip
//           (scripts/build-edco-map-2026.mjs, steps 1-6 in its header)
//   exit 2  a page could not be read, so the answer is UNKNOWN, not "no map"
//
// A red run is the alert. It reads first-party pages only, and it never
// downloads, crops or ships the art; the flip session does that by hand.

const PAGES = [
  "https://orlando.edc.com/guide/",
  "https://orlando.edc.com/experience/stages/",
  "https://orlando.edc.com/info/",
];
const MAP_ASSET = /https?:\/\/[^"'\s)]+?map[^"'\s)]*?\.(?:jpe?g|png|webp|pdf)/gi;

let unreadable = 0;
const found = new Set();
for (const url of PAGES) {
  try {
    const res = await fetch(url, { redirect: "follow", headers: { "user-agent": "Mozilla/5.0 (Plursky map watch)" } });
    if (!res.ok) { console.log(`✗ ${url} → HTTP ${res.status}`); unreadable++; continue; }
    const hits = (await res.text()).match(MAP_ASSET) || [];
    for (const h of hits) if (!/sitemap/i.test(h)) found.add(h);
    console.log(`· ${url} → ${hits.length} map-named asset(s)`);
  } catch (e) {
    console.log(`✗ ${url} → ${e.message}`); unreadable++;
  }
}

if (found.size) {
  console.log(`\n✗ OFFICIAL MAP CANDIDATE(S) — rebuild EDC Orlando from it before the flip:`);
  for (const u of found) console.log(`  ${u}`);
  process.exit(1);
}
if (unreadable) { console.log(`\n✗ ${unreadable} page(s) unreadable — map status UNKNOWN`); process.exit(2); }
console.log("\n✓ no official 2026 map on orlando.edc.com yet");
