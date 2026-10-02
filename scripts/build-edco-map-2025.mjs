#!/usr/bin/env node
// build-edco-map-2025.mjs — the plate EDC Orlando 2026 ships until its own map
// publishes: the official EDC Orlando 2025 festival map, and nothing else.
//
//   node scripts/build-edco-map-2025.mjs          # (re)build edco-tinker-2025.webp
//   node scripts/build-edco-map-2025.mjs --check  # verify source + derivative
//
// Founder ruling 2026-09-30: open EDC Orlando 2026 on its lineup with the 2025
// map, and say the official 2026 map is pending. It is the same venue (Tinker
// Field) and the same five stage names, but it is LAST YEAR'S layout: the app
// labels it as the 2025 map wherever it is drawn, and nothing measured on it
// is a claim about 2026. scripts/build-edco-map-2026.mjs replaces it at the flip.
//
// Source (first-party, kept unedited as provenance, never shipped/precached):
//   map-sources/edco-map-2025-source.png
//   = edco_2025_de_festival_map_1080x1350_r03.png, 1080 x 1350, Insomniac's CDN:
//     https://d3vhc53cl8e8km.cloudfront.net/hello-staging/wp-content/uploads/sites/44/2025/11/04103936/edco_2025_de_festival_map_1080x1350_r03.png
//     (200 on 2026-09-30; its .webp sibling was archived 2025-11-05 and is
//     byte-identical to the live one. The 2025 map PAGE is gone: /guide/map/
//     answers 404 now, so there is no page to link.)
//
// Derivative: the map art only. The crop starts at y=306, one row under the
// title block's "NOV 7+8+9" line (rows 291-305), so the plate carries no 2025
// date; "TINKER FIELD" (rows 315-324) stays, and is still true. It ends at
// y=1005, above the legend box (from row 1009). Left and right keep ~21 px of
// margin around the art (columns 91-986). Then pad top and bottom to a square.
// No scaling, no stretch, so:
//   derivative (dx, dy) = source (sx - 70, sy - 306 + 120)
//
// EDCO_STAGES x/y in data.jsx are measured on the derivative against these
// exact numbers. The build refuses a source whose hash or size differs.

import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { checkEdcoMap, buildPlate } from "./build-edco-map-2026.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
export const EDCO_MAP_2025 = {
  festivalId: "edc-orlando-2026",
  // The edition the art was drawn for. Not the festival's year, on purpose.
  mapYear: 2025,
  source: "map-sources/edco-map-2025-source.png",
  sourceUrl: "https://d3vhc53cl8e8km.cloudfront.net/hello-staging/wp-content/uploads/sites/44/2025/11/04103936/edco_2025_de_festival_map_1080x1350_r03.png",
  sourceObservedAt: "2026-09-30",
  sourceSha256: "a438644f797a406d6b8bfd3e638e15b98487c0aedc0cc93b3f9560a9bb19bcac",
  sourceSize: [1080, 1350],
  crop: { x: 70, y: 306, w: 940, h: 700 },
  pad: { top: 120, bottom: 120, left: 0, right: 0, color: "0F0328" },
  derivative: "edco-tinker-2025.webp",
  derivativeSize: [940, 940],
  derivativeSha256: "f76d77f2fa76c084e7178917727a2a189ff80291471d8e9866c35cd71b26fe30",
  cwebp: ["-q", "86", "-m", "6", "-sharp_yuv", "-metadata", "none"],
  // Derivative pixels at the centre of the stage's own STRUCTURE, never its
  // logo badge or label. data.jsx must equal round(100·px/940, 1) per row.
  // No amenities: the eight placeholder pins were removed (founder ruling
  // 2026-09-30) and none is measured off last year's map.
  measured: {
    stages: {
      kinetic: { px: [690, 604], confidence: "high",   note: "the long stage wall with the flower at its centre, south-east field; taken at the flower" },
      circuit: { px: [155, 239], confidence: "high",   note: "pink stage block with the light beams, north-west corner, above the circuitGROUNDS badge" },
      neon:    { px: [832, 359], confidence: "high",   note: "screen wall under the teal roof, east of Rainbow Bazaar, above the neonGARDEN badge" },
      stereo:  { px: [122, 619], confidence: "medium", note: "curved blue structure south-west of the stereoBLOOM badge; the art draws it small and at an angle" },
      bacardi: { px: [415, 705], confidence: "low",    note: "no structure is drawn: this is the BACARDÍ medallion south of Kinetic Trail, the only mark the map gives it" },
    },
    amenities: {},
  },
};

const isMain = import.meta.url === `file://${process.argv[1]}`;
if (isMain) {
  const M = EDCO_MAP_2025;
  const fail = msg => { console.error(`✗ ${msg}`); process.exit(1); };
  if (process.argv.includes("--check")) {
    const state = checkEdcoMap(M);
    if (!state.ok || !state.built) fail(state.msg);
    console.log(`✓ ${state.msg}`);
    process.exit(0);
  }
  const pre = checkEdcoMap({ ...M, derivativeSize: null, derivativeSha256: null });
  if (!pre.ok) fail(pre.msg);
  try { console.log(buildPlate(M, ROOT)); } catch (e) { fail(e.message); }
}
