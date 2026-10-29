#!/usr/bin/env node
// build-edco-map-2026.mjs — the EDC Orlando 2026 ground plate, made from the
// official festival map and nothing else. Same pipeline as
// build-acl-map-2026.mjs; read that file for the reasoning.
//
//   node scripts/build-edco-map-2026.mjs          # (re)build the plate
//   node scripts/build-edco-map-2026.mjs --check  # verify source + derivative
//
// PINNED 2026-10-29 from the official Festival Map page
// (https://orlando.edc.com/guide/map/), which shows the 2026 map: "ORLANDO
// 2026, NOV 6+7+8, TINKER FIELD". config.mapImage ships the derivative. The
// stage and amenity x/y in data.jsx are the `measured` rows below, and the
// five anchors are fitted from map-sources/edco-map-2026-control-points.json.
// The festival stays gated until the official set times are out.
//
// The flip session fills this in, in order:
//   1. Save the official map UNEDITED at `source`. Record its URL and date here.
//   2. Set sourceSha256 + sourceSize from the file.
//   3. Set crop (map art only, legend off) and pad (to a square, no scaling).
//   4. Build. Set derivativeSize + derivativeSha256 from the output.
//   5. Measure every stage and amenity on the DERIVATIVE and list it under
//      `measured`, then point config.mapImage at the derivative.
//   6. Fit anchors with scripts/georef-map.mjs; the grid x/y and the anchors
//      are derived together, never separately.

import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { imageSize, sha256 } from "./build-acl-map-2026.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
export const EDCO_MAP_2026 = {
  festivalId: "edc-orlando-2026",
  // What shipped until the official map was pinned (deleted with the pin).
  placeholder: "edco-tinker-2026.jpg",
  source: "map-sources/edco-map-2026-source.png",
  // The official page that shows the map (in a <figure>, as data-lazy-src),
  // and the file it shows. No `mapSource` in data.jsx yet: the public /f/
  // page's map link is held for EDC Orlando by test-festival-maps-hours.mjs
  // until a ruling gives it one.
  sourcePage: "https://orlando.edc.com/guide/map/",
  sourceUrl: "https://d3vhc53cl8e8km.cloudfront.net/hello-staging/wp-content/uploads/sites/44/2026/10/27141013/edco_2026_de_festival_map_1080x1350_r02.png",
  sourceObservedAt: "2026-10-29",
  sourceSha256: "4d0196f6896fe85d34ad5687c16b3f31161a7a8616dacff6ab6d27d51c46f5e5",
  sourceSize: [1080, 1350],
  crop: { x: 60, y: 326, w: 960, h: 719 },  // map art only: below "TINKER FIELD", above the legend
  pad: { top: 120, bottom: 121, left: 0, right: 0, color: "0C170F" },
  derivative: "edco-tinker-2026.webp",
  derivativeSize: [960, 960],
  // The committed plate. A rebuild with these settings reproduces it byte for
  // byte (cwebp 1.6.0); a re-encode elsewhere is a new plate and fails --check.
  derivativeSha256: "51b377145fda9de0a5639442eddf6207a532fe5922d56e08ea7348043d985e24",
  cwebp: ["-q", "86", "-m", "6", "-sharp_yuv", "-metadata", "none"],
  // Derivative pixels, at the centre of the thing itself (step 5, 2026-10-29).
  measured: {
    stages: {
      kinetic: { px: [675, 612], confidence: "high",   note: "middle of the diagonal stage deck under the light rig, south-east of the KINETIC FIELD owl" },
      circuit: { px: [145, 245], confidence: "high",   note: "stage deck under the light rig on West Church Street, north of the circuitGROUNDS logo" },
      neon:    { px: [839, 360], confidence: "medium", note: "light rig north of the neon garden lotus; the lotus is a logo, so the rig is taken as the stage" },
      stereo:  { px: [135, 615], confidence: "high",   note: "centre of the blue light-tower cluster beside the stereoBLOOM logo" },
      bacardi: { px: [395, 736], confidence: "low",    note: "the BACARDÍ medallion; the art draws no stage structure here, so this is the label's position" },
    },
    // Every printed First Aid, Info, Water Station, Restroom / GA+ Restroom
    // and Food badge, centred on the glyph (legend under the map). VIP-only
    // badges, bars, lockers and the rest of the legend are not pinned.
    amenities: {
      eom1: { px: [102, 470], confidence: "high", note: "First Aid badge in Pixel Forest" },
      eom2: { px: [279, 456], confidence: "high", note: "First Aid badge south-west of the stadium" },
      eom3: { px: [424, 451], confidence: "high", note: "First Aid badge south-east of the stadium, by Kandi Casino" },
      eom4: { px: [729, 322], confidence: "high", note: "First Aid badge beside the Entrance" },
      eoi1: { px: [371, 450], confidence: "high", note: "Info badge south of the stadium, beside Lost & Found" },
      eow1: { px: [95, 545],  confidence: "high", note: "the 40 TAPS water-station pill south of Pixel Forest" },
      eow2: { px: [480, 737], confidence: "high", note: "the 64 TAPS water-station pill beside Rockstar" },
      eot1: { px: [289, 371], confidence: "high", note: "Restrooms badge on the stadium's west stand" },
      eot2: { px: [312, 371], confidence: "high", note: "GA+ Restrooms badge on the stadium's west stand" },
      eot3: { px: [419, 358], confidence: "high", note: "Restrooms badge on the stadium's east stand" },
      eot4: { px: [440, 358], confidence: "high", note: "GA+ Restrooms badge on the stadium's east stand" },
      eot5: { px: [528, 168], confidence: "high", note: "Restrooms badge in the north annex off West Church Street" },
      eot6: { px: [786, 471], confidence: "high", note: "GA+ Restrooms badge east of Kinetic Field" },
      eot7: { px: [786, 502], confidence: "high", note: "Restrooms badge east of Kinetic Field" },
      eof1: { px: [78, 419],  confidence: "high", note: "Food badge in Pixel Forest" },
      eof2: { px: [410, 539], confidence: "high", note: "Food badge on Rainbow Road" },
      eof3: { px: [698, 350], confidence: "high", note: "Food half of the bar + food pill in Rainbow Bazaar" },
      eof4: { px: [501, 536], confidence: "high", note: "Food badge below Flower Tower" },
      eof5: { px: [551, 562], confidence: "high", note: "Food badge on Kinetic Field's west edge" },
      eof6: { px: [504, 606], confidence: "high", note: "Food badge by Jack Daniel's" },
    },
  },
};

const PIN_FIELDS = ["sourceUrl", "sourceObservedAt", "sourceSha256", "sourceSize", "crop", "pad"];
export const isPinned = M => PIN_FIELDS.some(k => M[k] != null);

// Pure, so the gate can drive it with a mutated manifest. `mapImage` is what
// the registry ships for the festival today.
export function checkEdcoMap(M, { root = ROOT, mapImage } = {}) {
  const src = join(root, M.source), out = join(root, M.derivative);
  const dims = f => (imageSize(readFileSync(f)) || [0, 0]).join("x");
  if (!isPinned(M)) {
    // A source file with no pin is a map somebody saved and never recorded.
    if (existsSync(src)) return { ok: false, msg: `${M.source} exists but is not pinned — set sourceUrl, sourceObservedAt, sourceSha256 and sourceSize` };
    if (Object.keys(M.measured.stages).length || Object.keys(M.measured.amenities).length)
      return { ok: false, msg: "measured rows exist with no pinned source to measure them on" };
    if (mapImage !== undefined && mapImage !== M.placeholder)
      return { ok: false, msg: `config.mapImage is ${mapImage}, but no official map is pinned — only the placeholder ${M.placeholder} may ship` };
    return { ok: true, pinned: false, msg: `no official 2026 map pinned — placeholder ${M.placeholder} still ships` };
  }
  const missing = PIN_FIELDS.filter(k => M[k] == null);
  if (missing.length) return { ok: false, msg: `half-pinned: ${missing.join(", ")} still null` };
  if (!existsSync(src)) return { ok: false, msg: `${M.source} is missing` };
  if (sha256(src) !== M.sourceSha256) return { ok: false, msg: `${M.source} is not the map these measurements were taken on (sha256 differs)` };
  if (dims(src) !== M.sourceSize.join("x")) return { ok: false, msg: `${M.source} is ${dims(src)}, expected ${M.sourceSize.join("x")}` };
  if (!M.derivativeSize || !M.derivativeSha256) return { ok: true, pinned: true, built: false, msg: "source pinned; plate not built yet" };
  if (M.derivativeSize[0] !== M.derivativeSize[1]) return { ok: false, msg: `derivative must be square, got ${M.derivativeSize.join("x")}` };
  if (!existsSync(out)) return { ok: false, msg: `${M.derivative} is missing` };
  if (dims(out) !== M.derivativeSize.join("x")) return { ok: false, msg: `${M.derivative} is ${dims(out)}, expected ${M.derivativeSize.join("x")}` };
  if (sha256(out) !== M.derivativeSha256) return { ok: false, msg: `${M.derivative} is not the plate these coordinates were measured on (sha256 differs) — rebuild or re-measure` };
  if (mapImage !== undefined && mapImage !== M.derivative)
    return { ok: false, msg: `config.mapImage is ${mapImage}, but the official 2026 plate ${M.derivative} is pinned and built — ship it` };
  return { ok: true, pinned: true, built: true, msg: `${M.source} ${M.sourceSize.join("x")} · ${M.derivative} ${M.derivativeSize.join("x")}` };
}

const isMain = import.meta.url === `file://${process.argv[1]}`;
if (isMain) {
  const M = EDCO_MAP_2026;
  const fail = msg => { console.error(`✗ ${msg}`); process.exit(1); };
  const state = checkEdcoMap(M);
  if (process.argv.includes("--check")) {
    if (!state.ok) fail(state.msg);
    console.log(`${state.pinned ? "✓" : "·"} ${state.msg}`);
    process.exit(0);
  }
  if (!state.pinned) fail(`${state.msg}. Nothing to build: pin the official map first (steps 1-3 in this file).`);
  if (!state.ok && !/derivative|plate/.test(state.msg)) fail(state.msg);

  // Building needs macOS (sips + cwebp); the committed webp is what ships.
  const src = join(ROOT, M.source), out = join(ROOT, M.derivative);
  const dims = f => (imageSize(readFileSync(f)) || [0, 0]).join("x");
  const { x, y, w, h } = M.crop;
  const W = w + M.pad.left + M.pad.right, H = h + M.pad.top + M.pad.bottom;
  if (W !== H) fail(`crop ${w}x${h} plus pad gives ${W}x${H}; the plate must be square`);
  const tmp = mkdtempSync(join(tmpdir(), "edco-map-"));
  try {
    const cropped = join(tmp, "crop.png"), padded = join(tmp, "pad.png");
    execFileSync("sips", ["--cropOffset", String(y), String(x), "-c", String(h), String(w), src, "--out", cropped], { stdio: "ignore" });
    if (dims(cropped) !== `${w}x${h}`) fail(`crop produced ${dims(cropped)}`);
    execFileSync("sips", ["--padToHeightWidth", String(H), String(W), "--padColor", M.pad.color, cropped, "--out", padded], { stdio: "ignore" });
    if (dims(padded) !== `${W}x${H}`) fail(`pad produced ${dims(padded)}`);
    execFileSync("cwebp", [...M.cwebp, padded, "-o", out], { stdio: "ignore" });
    console.log(`✓ ${M.derivative} ${dims(out)} sha256 ${sha256(out)}\n  set derivativeSize + derivativeSha256 to these, then measure on this plate.`);
  } finally { rmSync(tmp, { recursive: true, force: true }); }
}
