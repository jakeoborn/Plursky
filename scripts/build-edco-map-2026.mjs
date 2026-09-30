#!/usr/bin/env node
// build-edco-map-2026.mjs — the EDC Orlando 2026 ground plate, made from the
// official festival map and nothing else. Same pipeline as
// build-acl-map-2026.mjs; read that file for the reasoning.
//
//   node scripts/build-edco-map-2026.mjs          # (re)build the plate
//   node scripts/build-edco-map-2026.mjs --check  # verify source + derivative
//
// ⚠ NOT PINNED YET. The official 2026 map is not published (checked
// 2026-09-30: orlando.edc.com's guide and stages pages carry no map image), so
// every field the map decides is null and the app still ships the generated
// placeholder `edco-tinker-2026.jpg`. While unpinned, --check passes and says
// so, and a build refuses to run.
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
  // What ships until the official map is pinned.
  placeholder: "edco-tinker-2026.jpg",
  source: "map-sources/edco-map-2026-source.png",
  sourceUrl: null,
  sourceObservedAt: null,
  sourceSha256: null,
  sourceSize: null,
  crop: null,                       // { x, y, w, h } in source pixels
  pad: null,                        // { top, bottom, left, right, color }
  derivative: "edco-tinker-2026.webp",
  derivativeSize: null,
  derivativeSha256: null,
  cwebp: ["-q", "86", "-m", "6", "-sharp_yuv", "-metadata", "none"],
  // Derivative pixels, at the centre of the thing itself. Empty until step 5.
  measured: { stages: {}, amenities: {} },
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
