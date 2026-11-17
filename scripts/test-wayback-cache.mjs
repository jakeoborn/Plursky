#!/usr/bin/env node
// test-wayback-cache.mjs — fetchCapture never returns a neighbouring capture
// under the requested key (wayback.mjs).
//
//   node scripts/test-wayback-cache.mjs [path/to/wayback.mjs]
//
// Runs against a throwaway cache dir with `fetch` stubbed: no network, and the
// real research cache is never touched. The optional path runs the same
// checks against another copy of the module (e.g. the old code) to prove
// they fail there. Two paths are covered:
//   1. an ALREADY-POISONED entry: the key for 20181206131718 holds metadata
//      saying 20190501000000 → it must be moved aside and refetched, and the
//      exact capture returned;
//   2. a FRESH REDIRECT: Wayback serves a neighbour → the record says what was
//      served, and nothing is cached under the requested key.

import { mkdtempSync, existsSync, readdirSync, writeFileSync, mkdirSync } from "node:fs";
import { createHash } from "node:crypto";
import { tmpdir } from "node:os";
import { join, resolve, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const dir = mkdtempSync(join(tmpdir(), "wayback-cache-test-"));
process.env.PLURSKY_HISTORICAL_CACHE = dir;
const modPath = resolve(process.argv[2] || join(ROOT, "scripts/historical/wayback.mjs"));
const { fetchCapture, CACHE_DIR } = await import(pathToFileURL(modPath).href);
if (CACHE_DIR !== dir) { console.error(`✗ cache dir not isolated (${CACHE_DIR}); refusing to run`); process.exit(1); }

let failed = 0, checks = 0;
const ok = (cond, msg) => { checks++; if (!cond) { failed++; console.log(`  ✗ ${msg}`); } };

const URL_ = "http://www.aclfestival.com/schedule/weekend-two/";
const REQ = "20181206131718", NEIGHBOUR = "20190501000000";
const key = createHash("sha256").update(`${REQ} ${URL_}`).digest("hex").slice(0, 24);
const page = ts => `<html>capture ${ts}</html>`;

// Stub fetch: `serve` decides which capture Wayback "answers" with.
let serve = REQ, calls = 0;
globalThis.fetch = async () => {
  calls++;
  const body = page(serve);
  return { ok: true, status: 200, url: `https://web.archive.org/web/${serve}id_/${URL_}`,
    headers: { get: () => "text/html" }, arrayBuffer: async () => new TextEncoder().encode(body).buffer };
};

// 1. Poisoned entry already on disk.
mkdirSync(dir, { recursive: true });
writeFileSync(join(dir, key + ".html"), page(NEIGHBOUR));
writeFileSync(join(dir, key + ".html.json"), JSON.stringify({ requestedUrl: URL_, requestedTimestamp: REQ,
  captureTimestamp: NEIGHBOUR, archivedUrl: `https://web.archive.org/web/${NEIGHBOUR}/${URL_}` }));
serve = REQ; calls = 0;
let got;
try { got = await fetchCapture(REQ, URL_); } catch (e) { got = { error: e.message }; }
ok(got.captureTimestamp === REQ, `poisoned entry: captureTimestamp is ${got.captureTimestamp}, want ${REQ}`);
ok(got.text === page(REQ), `poisoned entry: returned "${got.text}", want the ${REQ} page`);
ok(calls === 1, `poisoned entry: refetched ${calls}×, want 1`);
ok(readdirSync(dir).some(f => f.startsWith(key + ".html.stale-")), "poisoned entry: moved aside as evidence");
// …and the refetched exact capture is now what the key holds.
calls = 0;
const again = await fetchCapture(REQ, URL_);
ok(calls === 0 && again.captureTimestamp === REQ && again.text === page(REQ), "poisoned entry: exact capture cached after refetch");

// 2. Fresh redirect to a neighbour.
const URL2 = "http://www.aclfestival.com/schedule/weekend-one/";
const key2 = createHash("sha256").update(`${REQ} ${URL2}`).digest("hex").slice(0, 24);
serve = NEIGHBOUR; calls = 0;
const red = await fetchCapture(REQ, URL2);
ok(red.captureTimestamp === NEIGHBOUR && red.requestedTimestamp === REQ, `fresh redirect: record says served ${red.captureTimestamp}, requested ${red.requestedTimestamp}`);
ok(!existsSync(join(dir, key2 + ".html")) && !existsSync(join(dir, key2 + ".html.json")), "fresh redirect: neighbour cached under the requested key");
// A later run where Wayback serves the exact capture must get it, not the neighbour.
serve = REQ; calls = 0;
const later = await fetchCapture(REQ, URL2);
ok(calls === 1 && later.captureTimestamp === REQ && later.text === page(REQ), `fresh redirect: later run got ${later.captureTimestamp}, want ${REQ} from a refetch`);

if (failed) { console.log(`✗ wayback cache: ${failed} of ${checks} checks failed`); process.exit(1); }
console.log(`✓ wayback cache: ${checks} checks — a poisoned entry is moved aside and refetched, a redirected neighbour is recorded as served and never cached under the requested key`);
