#!/usr/bin/env node
// build-acl-map-2026.mjs — the ACL 2026 runtime ground plate, made from the
// official patron map and nothing else.
//
//   node scripts/build-acl-map-2026.mjs          # (re)build acl-park-2026.webp
//   node scripts/build-acl-map-2026.mjs --check  # verify source + derivative
//
// Source (first-party, kept unedited as provenance, never shipped/precached):
//   map-sources/acl-map-2026-source.png
//   = ACL26_Patron.Map_Horizontal_09.21.png, 2305 x 1441,
//     https://support.aclfestival.com/hc/article_attachments/53823874434324
//     (article https://support.aclfestival.com/hc/en-us/articles/4405399774484-Festival-Map,
//     updated 2026-09-22T17:02:28Z)
//
// Derivative: crop off the legend panel ONLY (x 0-539 is the dark legend; the
// map art starts at x=540 and runs to the right edge, full height), then pad
// top and bottom to a square. No scaling, no stretch, no center-crop, so every
// derivative pixel is a source pixel shifted by (-540, +162):
//   derivative (dx, dy) = source (sx - 540, sy + 162)
// The title lockup stays: it is printed inside the map art, not beside it.
//
// ACL_STAGES / ACL_AMENITIES x/y in data.jsx were measured on the derivative
// against these exact numbers. The script refuses a source whose hash or size
// differs, so a later map cannot silently inherit the 2026 measurements.
// Building needs macOS (sips + cwebp); the committed webp is what ships.
// --check, and the verify gate that imports this module, are pure Node.

import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
export const ACL_MAP_2026 = {
  source: "map-sources/acl-map-2026-source.png",
  sourceSha256: "83a95f1545aa1a232ecbea4b381f08744c99bf783164bc5ea355e9cb80db7cb3",
  sourceSize: [2305, 1441],
  crop: { x: 540, y: 0, w: 1765, h: 1441 },
  pad: { top: 162, bottom: 162, left: 0, right: 0, color: "060B13" },
  derivative: "acl-park-2026.webp",
  derivativeSize: [1765, 1765],
  // The committed plate. A rebuild with these settings reproduces it byte for
  // byte (cwebp 1.6.0); a re-encode elsewhere is a new plate and fails --check.
  derivativeSha256: "d6e59ca186b624367c4f3185178ab656888b38eadf9e4d57cf943361e0560856",
  cwebp: ["-q", "86", "-m", "6", "-sharp_yuv", "-metadata", "none"],
  // Every x/y ACL ships, measured in DERIVATIVE pixels at the centre of the
  // thing itself: a stage's structure (never its label), an amenity's symbol.
  // data.jsx must equal round(100·px/1765, 1) for each row
  // (scripts/test-acl-map-2026.mjs), and nothing else may carry a coordinate.
  measured: {
    stages: {
      amex:     { px: [1547, 880],  confidence: "high",   note: "blue stage block west of the AMERICAN EXPRESS label; the label covers part of the facade, so the centre is taken on the visible roof and diamond facade" },
      snapchat: { px: [908, 930],   confidence: "high",   note: "dark tent labelled SNAPCHAT beside The Grove; the only structure with that label" },
      titos:    { px: [1188, 640],  confidence: "high",   note: "salmon roof platform under the TITO'S sign" },
      miller:   { px: [554, 455],   confidence: "high",   note: "stage deck between the two speaker stacks, under the MILLER LITE sign (midpoint of the speaker centres)" },
      tmobile:  { px: [256, 684],   confidence: "high",   note: "pink stage block east of the T-MOBILE label (bounding-box centre)" },
      bmi:      { px: [516, 1000],  confidence: "high",   note: "red stage block beside the BMI label" },
      beatbox:  { px: [491, 1286],  confidence: "high",   note: "light-blue stage block above the BEATBOX label" },
    },
    amenities: {
      aa3: { px: [1002, 500],  confidence: "high", note: "food-court marker (1), the legend's ACL EATS" },
      aa4: { px: [771, 1288],  confidence: "high", note: "food-court marker (2), the legend's ACL EATS SOUTH" },
      // Every printed hydration drop, restroom and medical badge (founder
      // ruling 2026-09-23), centred on the glyph's own pixels in the source:
      // drops 13-14x19-20 px, restrooms 15-16x20-21, medical squares 35-36.
      // Guest services ("i") and every other symbol stay off until verified.
      ah1: { px: [412, 477], confidence: "high", note: "drop in the dark pill east of the Lady Bird Entrance EE (i · drop · recycle · beer)" },
      ah2: { px: [266, 583], confidence: "high", note: "drop in the pill north of T-Mobile (drop · restroom · beer)" },
      ah3: { px: [939, 447], confidence: "high", note: "drop at the east end of the pill by the SafeFest hand (i · bodega · drop)" },
      ah4: { px: [1255, 709], confidence: "high", note: "drop in the pill south of Tito's (drop · beer)" },
      ah5: { px: [590, 1032], confidence: "high", note: "drop leading the Accessibility Center pill east of BMI" },
      ah6: { px: [1047, 765], confidence: "high", note: "drop in the pill east of ACL Market (drop · beer)" },
      ah7: { px: [1213, 959], confidence: "high", note: "drop in the pill by ACL Sweets (bar · drop · merch · recycle)" },
      ah8: { px: [702, 1336], confidence: "high", note: "drop in the pill south of Merch Palace (bar · drop)" },
      ar1: { px: [288, 582], confidence: "high", note: "restroom glyph in the pill north of T-Mobile (drop · restroom · beer)" },
      ar2: { px: [1122, 572], confidence: "high", note: "restroom badge west of Tito's" },
      ar3: { px: [260, 857], confidence: "high", note: "restroom glyph in the pill east of VIP Grove West (bar · restroom)" },
      ar4: { px: [1459, 752], confidence: "high", note: "restroom glyph in the pill west of the Platinum Lounge (bar · restroom)" },
      ar5: { px: [1458, 976], confidence: "high", note: "restroom badge south-west of American Express" },
      ar6: { px: [1353, 1020], confidence: "high", note: "restroom badge beside the EE east of VIP Grove East" },
      ar7: { px: [865, 1290], confidence: "high", note: "restroom badge east of Merch Palace" },
      am1: { px: [359, 665], confidence: "high", note: "medical cross square north-east of T-Mobile" },
      am2: { px: [463, 1219], confidence: "high", note: "medical cross square north-east of BEATBOX" },
      am3: { px: [853, 887], confidence: "high", note: "medical cross square north of Snapchat" },
      am4: { px: [1606, 812], confidence: "high", note: "medical cross square above the American Express stage" },
    },
  },
};

// Pixel size from the file header, so the check runs anywhere (CI is Linux).
export function imageSize(buf) {
  if (buf.readUInt32BE(0) === 0x89504e47) return [buf.readUInt32BE(16), buf.readUInt32BE(20)];   // PNG IHDR
  if (buf.toString("ascii", 0, 4) === "RIFF" && buf.toString("ascii", 8, 12) === "WEBP") {
    const kind = buf.toString("ascii", 12, 16);
    if (kind === "VP8 ") return [buf.readUInt16LE(26) & 0x3fff, buf.readUInt16LE(28) & 0x3fff];
    if (kind === "VP8L") { const b = buf.readUInt32LE(21); return [(b & 0x3fff) + 1, ((b >> 14) & 0x3fff) + 1]; }
    if (kind === "VP8X") return [1 + buf.readUIntLE(24, 3), 1 + buf.readUIntLE(27, 3)];
  }
  return null;
}
export const sha256 = f => createHash("sha256").update(readFileSync(f)).digest("hex");

const sha = sha256;
const dims = f => imageSize(readFileSync(f)) || [0, 0];

const isMain = import.meta.url === `file://${process.argv[1]}`;
if (isMain) {
const M = ACL_MAP_2026, src = join(ROOT, M.source), out = join(ROOT, M.derivative);
const fail = msg => { console.error(`✗ ${msg}`); process.exit(1); };
if (!existsSync(src)) fail(`${M.source} is missing`);
if (sha(src) !== M.sourceSha256) fail(`${M.source} is not the 2026 patron map these measurements were taken on (sha256 differs)`);
if (dims(src).join("x") !== M.sourceSize.join("x")) fail(`${M.source} is ${dims(src).join("x")}, expected ${M.sourceSize.join("x")}`);

if (process.argv.includes("--check")) {
  if (!existsSync(out)) fail(`${M.derivative} is missing`);
  if (dims(out).join("x") !== M.derivativeSize.join("x")) fail(`${M.derivative} is ${dims(out).join("x")}, expected square ${M.derivativeSize.join("x")}`);
  if (sha(out) !== M.derivativeSha256) fail(`${M.derivative} is not the plate these coordinates were measured on (sha256 differs) — rebuild or re-measure`);
  console.log(`✓ ${M.source} ${M.sourceSize.join("x")} sha256 ${M.sourceSha256.slice(0, 12)}… · ${M.derivative} ${dims(out).join("x")} sha256 ${sha(out).slice(0, 12)}…`);
  process.exit(0);
}

const tmp = mkdtempSync(join(tmpdir(), "acl-map-"));
try {
  const cropped = join(tmp, "crop.png"), padded = join(tmp, "pad.png");
  const { x, y, w, h } = M.crop, [W, H] = M.derivativeSize;
  execFileSync("sips", ["--cropOffset", String(y), String(x), "-c", String(h), String(w), src, "--out", cropped], { stdio: "ignore" });
  if (dims(cropped).join("x") !== `${w}x${h}`) fail(`crop produced ${dims(cropped).join("x")}`);
  execFileSync("sips", ["--padToHeightWidth", String(H), String(W), "--padColor", M.pad.color, cropped, "--out", padded], { stdio: "ignore" });
  if (dims(padded).join("x") !== `${W}x${H}`) fail(`pad produced ${dims(padded).join("x")}`);
  execFileSync("cwebp", [...M.cwebp, padded, "-o", out], { stdio: "ignore" });
  console.log(`✓ ${M.derivative} ${dims(out).join("x")} sha256 ${sha(out)}`);
} finally { rmSync(tmp, { recursive: true, force: true }); }
}
