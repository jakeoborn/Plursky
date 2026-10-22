#!/usr/bin/env node
// build-iiip-map-2026.mjs — the III Points 2026 ground plate, made from the
// official festival map and nothing else. Same pipeline as
// build-acl-map-2026.mjs; read that file for the reasoning.
//
//   node scripts/build-iiip-map-2026.mjs          # (re)build the plate
//   node scripts/build-iiip-map-2026.mjs --check  # verify source + derivative
//
// PINNED 2026-10-15. The official map was published on iiipoints.com the day
// before gates opened (event Oct 16-17, Mana Wynwood). The source is the
// 1080w asset; only 600w and 1080w variants exist.
//
// One pipeline deviation, deliberate: ACL/EDCO build with macOS sips + cwebp.
// This plate was built on Linux with PIL (quality 86, method 6), and the
// build step below reproduces it with python3 + PIL, not sips. The committed
// webp and its sha256 are what ships either way; --check verifies bytes, not
// encoders.
//
// The map is oblique ILLUSTRATED art: its streets converge (a vanishing
// point), so no affine registers it. Anchors were fitted with a homography
// over 8 street control points (NW 22nd/23rd/24th/25th St × NW 5th/6th Ave
// plus the NW 22nd Lane segment's two ends, all OSM-surveyed 2026-10-15),
// RMS 12.6 m, and stay src: "poster" until a real measurement lands.

import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { imageSize, sha256 } from "./build-acl-map-2026.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
export const IIIP_MAP_2026 = {
  festivalId: "iii-points-2026",
  source: "map-sources/iiip-map-2026-source.webp",
  sourceUrl: "https://www.iiipoints.com/assets/campaign/festival-map-2026-1080.webp",
  sourceObservedAt: "2026-10-15",
  sourceSha256: "049fd21c23e5a341d2c8654fdca7496d8a0ef66c4e102ec7f1d7f6d640d3312b",
  sourceSize: [1080, 1350],
  crop: { x: 0, y: 0, w: 1080, h: 1116 }, // legend box cut (starts y=1117); title/logo kept as art
  pad: { top: 0, bottom: 0, left: 18, right: 18, color: [249, 179, 230], colorRight: [255, 215, 255] },
  derivative: "iiip-map-2026.webp",
  derivativeSize: [1116, 1116],
  derivativeSha256: "4d8f043dbd2f8c173e00430c4983158cad1c88452de8c90ada8fbe3e278269fa",
  // Derivative pixels, at the centre of the thing itself (signage for the
  // signed stages, structure centre for mind-melt).
  measured: {
    stages: {
      "mind-melt": [703, 305], "players-club": [538, 400], "444": [848, 435],
      "unforeseen": [810, 478], "door-iv": [570, 580], "s3qu3nce": [358, 510],
      "iii-points-radio": [353, 675], "isotropic": [143, 715], "halo-88": [273, 775],
      "sec3": [648, 702], "vertex": [818, 682], "grand-central": [843, 855], "rc95": [373, 918],
    },
    amenities: {},
  },
};

const isMain = import.meta.url === `file://${process.argv[1]}`;
if (isMain) {
  const M = IIIP_MAP_2026;
  const fail = msg => { console.error(`✗ ${msg}`); process.exit(1) };
  const src = join(ROOT, M.source), out = join(ROOT, M.derivative);
  const dims = f => (imageSize(readFileSync(f)) || [0, 0]).join("x");
  const check = () => {
    if (!existsSync(src)) return { ok: false, msg: `${M.source} is missing` };
    if (sha256(src) !== M.sourceSha256) return { ok: false, msg: `${M.source} is not the map these measurements were taken on (sha256 differs)` };
    if (dims(src) !== M.sourceSize.join("x")) return { ok: false, msg: `${M.source} is ${dims(src)}, expected ${M.sourceSize.join("x")}` };
    if (!existsSync(out)) return { ok: false, msg: `${M.derivative} is missing` };
    if (dims(out) !== M.derivativeSize.join("x")) return { ok: false, msg: `${M.derivative} is ${dims(out)}, expected ${M.derivativeSize.join("x")}` };
    if (sha256(out) !== M.derivativeSha256) return { ok: false, msg: `${M.derivative} is not the plate these coordinates were measured on (sha256 differs) — rebuild or re-measure` };
    return { ok: true, msg: `${M.source} ${M.sourceSize.join("x")} · ${M.derivative} ${M.derivativeSize.join("x")}` };
  };
  const state = check();
  if (process.argv.includes("--check")) {
    if (!state.ok) fail(state.msg);
    console.log(`✓ ${state.msg}`);
    process.exit(0);
  }
  // Build with python3 + PIL (see header for why not sips/cwebp).
  const py = `
from PIL import Image
im = Image.open(${JSON.stringify(src)}).convert('RGB')
crop = im.crop((${M.crop.x}, ${M.crop.y}, ${M.crop.x + M.crop.w}, ${M.crop.y + M.crop.h}))
W = ${M.crop.w + M.pad.left + M.pad.right}; H = ${M.crop.h + M.pad.top + M.pad.bottom}
assert W == H, f"crop ${M.crop.w}x${M.crop.h} plus pad gives {W}x{H}; the plate must be square"
out = Image.new('RGB', (W, H))
out.paste(Image.new('RGB', (${M.pad.left}, ${M.crop.h}), tuple(${JSON.stringify(M.pad.color)})), (0, 0))
out.paste(crop, (${M.pad.left}, 0))
out.paste(Image.new('RGB', (${M.pad.right}, ${M.crop.h}), tuple(${JSON.stringify(M.pad.colorRight)})), (W - ${M.pad.right}, 0))
out.save(${JSON.stringify(out)}, 'WEBP', quality=86, method=6)
`;
  const tmp = mkdtempSync(join(tmpdir(), "iiip-map-"));
  try {
    execFileSync("python3", ["-c", py], { stdio: "inherit" });
    console.log(`✓ ${M.derivative} ${dims(out)} sha256 ${sha256(out)}`);
    const after = check();
    if (!after.ok) console.log(`  note: ${after.msg}`);
  } finally { rmSync(tmp, { recursive: true, force: true }); }
}
