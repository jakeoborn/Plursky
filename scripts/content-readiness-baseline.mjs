#!/usr/bin/env node
// Public content readiness baseline (offline, read-only).
//
//   node scripts/content-readiness-baseline.mjs              print the summary
//   node scripts/content-readiness-baseline.mjs --out <file> also write the full receipt
//
// Reads bundled festival data through load-registry.mjs, scores every billing
// with scripts/lib/content-readiness.mjs and reports the editor queue. No
// network, no writes outside --out, and nothing the app renders changes.
import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { loadRegistry } from './lib/load-registry.mjs';
import { RUBRIC_VERSION, buildItems, summarize } from './lib/content-readiness.mjs';

const ROOT = process.cwd();
const outAt = process.argv.indexOf('--out');
const out = outAt > 0 ? process.argv[outAt + 1] : null;

const { DS } = loadRegistry(ROOT);
const showcases = JSON.parse(readFileSync(`${ROOT}/data/content-readiness/showcases.json`, 'utf8'));
const items = Object.keys(DS).sort().flatMap(id => buildItems(id, DS[id], { showcases }));
const inputHash = createHash('sha256').update(JSON.stringify(items)).digest('hex');
let sourceSha = null;
try { sourceSha = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: ROOT, encoding: 'utf8' }).trim(); } catch {}

const summary = summarize(items);
const receipt = { rubric: RUBRIC_VERSION, sourceSha, inputHash, semanticScorer: 'NOT_RUN', summary, items };
if (out) writeFileSync(out, JSON.stringify(receipt, null, 1) + '\n');

const { editions, ...top } = summary;
console.log(JSON.stringify({ rubric: RUBRIC_VERSION, sourceSha, inputHash, ...top }, null, 1));
for (const [id, e] of Object.entries(editions))
  console.log(`  ${id.padEnd(28)} items ${String(e.items).padStart(4)}  eligible ${String(e.semanticEligible).padStart(3)}  readiness ${JSON.stringify(e.readiness)}`);
