#!/usr/bin/env node
// ocr-queue.mjs — on a Mac, fetch and OCR every queued edition's official
// schedule graphics in one go, so review can start from candidates.
//
//   node scripts/historical/ocr-queue.mjs            # every edition in MAC_QUEUE
//   node scripts/historical/ocr-queue.mjs movement-2017 governors-ball-2023
//
// For each edition: resolve-graphics.mjs picks and caches the official graphic
// per day (writing its ledger), then ocr-vision.swift reads each cached graphic
// into <review-root>/<id>/<id>-dN.jsonl. A graphic shared by several days is
// read once and copied. Nothing here is data: the next step is still
// assemble-ocr.mjs and a check of every row against the pixels
// (data/historical/README.md, "Adding an edition"), then finalize-review.mjs.
//
// Needs macOS (Vision) and direct access to web.archive.org. The review root
// is the private review folder in the home directory unless PLURSKY_REVIEW_ROOT
// says otherwise.

import { execFileSync } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, writeFileSync } from "node:fs";
import { homedir, platform } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { CACHE_DIR, fetchCapture } from "./wayback.mjs";
import { GRAPHIC_EDITIONS, resolve } from "./resolve-graphics.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));

// The editions whose official graphics are known and not yet reviewed, in the
// order to review them. data/historical/MAC-QUEUE.md lists them with what to
// check, and the years still waiting for a source.
export const MAC_QUEUE = [
  "governors-ball-2023",
  "movement-2016", "movement-2017", "movement-2018", "movement-2019",
  "electric-forest-2025", "electric-forest-2024", "electric-forest-2022", "electric-forest-2019", "electric-forest-2017",
  "ultra-europe-2025", "ultra-europe-2024", "ultra-europe-2023", "ultra-europe-2019",
  "coachella-2019", "coachella-2018",
  "ultra-miami-2012", "ultra-miami-2011",
];

if (import.meta.url === `file://${process.argv[1]}`) {
  if (platform() !== "darwin") { console.error("ocr-queue.mjs runs on macOS only (it uses the Vision framework)"); process.exit(2); }
  const ids = process.argv.slice(2).length ? process.argv.slice(2) : MAC_QUEUE;
  for (const id of ids) if (!GRAPHIC_EDITIONS[id]) { console.error(`no GRAPHIC_EDITIONS entry for ${id}`); process.exit(2); }
  const root = process.env.PLURSKY_REVIEW_ROOT || join(homedir(), "Plursky-private", "review");
  const ocr = join(root, ".bin", "ocr-vision");
  mkdirSync(dirname(ocr), { recursive: true });
  execFileSync("swiftc", ["-O", join(HERE, "ocr-vision.swift"), "-o", ocr], { stdio: "inherit" });
  const summary = [];
  for (const id of ids) {
    const ledger = await resolve(id);
    const dir = join(root, id);
    mkdirSync(dir, { recursive: true });
    const read = new Map();
    for (const d of ledger.days) {
      if (d.blocked) { summary.push(`${id} day ${d.day}: ${d.blocked}`); continue; }
      const out = join(dir, `${id}-d${d.day}.jsonl`);
      const key = `${d.imageCapture} ${d.originalUrl}`;
      if (read.has(key)) copyFileSync(read.get(key), out);
      else {
        // wayback.mjs caches only an exact capture. A graphic is requested at
        // the page's timestamp and usually served from a neighbouring capture,
        // so its bytes were not kept. Fetch it again at the capture actually
        // served, check it is the same file the ledger hashed, and read that.
        let img = join(CACHE_DIR, d.cacheFile);
        if (!existsSync(img)) {
          const got = await fetchCapture(d.imageCapture, d.originalUrl, { binary: true });
          if (got.sha256 !== d.sha256) { summary.push(`${id} day ${d.day}: the graphic served for ${d.imageCapture} does not match the ledger's hash`); continue; }
          img = existsSync(got.file) ? got.file : join(dir, `.graphic-d${d.day}`);
          if (img !== got.file) writeFileSync(img, got.buf);
        }
        writeFileSync(out, execFileSync(ocr, [img], { maxBuffer: 64 << 20 }));
        read.set(key, out);
      }
      summary.push(`${id} day ${d.day} (${d.date}): ${d.originalUrl.split("/").pop()} → ${out}`);
    }
  }
  console.log(summary.join("\n"));
}
