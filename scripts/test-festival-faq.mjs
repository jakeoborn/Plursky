#!/usr/bin/env node
// Gate: a festival page's FAQPage structured data may never outrun what the
// page visibly says.
//
// THE DEFECT CLASS THIS EXISTS FOR:
//   Google treats FAQPage markup describing content that is not in the rendered
//   page as a structured-data violation — the penalty lands on the whole site's
//   rich-result eligibility, not just the offending page. The generator builds
//   the visible <dl> and the JSON-LD from ONE array, so today they cannot
//   disagree. This gate is what keeps that true after someone edits one of the
//   two render paths without the other, which is the cheap and likely mistake.
//
// It also enforces the honesty rules that array encodes, because "answer every
// question" and "answer it TRUTHFULLY" are different properties:
//   - a stage-count question requires a rendered stage list
//   - "Yes, times are published" requires a rendered schedule grid
//   - "Not yet" requires that there is genuinely NO schedule grid
//   - a stated artist count must equal the count the lineup section prints
//
// Reads the COMMITTED pages, not a fresh in-memory render: what ships to
// plursky.com is what a crawler reads, and gen --check already proves the
// committed files match the generator.
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const F_DIR = join(ROOT, 'f');

let checks = 0, failed = 0;
const fail = (msg) => { checks++; failed++; console.log(`  ✗  ${msg}`); };
const ok = () => { checks++; };

// Phrases that report the PUBLISHER's state. We can only source our own
// ingestion state, so these may not appear in a generated answer unless
// explicit per-festival source state backs them.
const BANNED_PUBLISHER_CLAIMS = [
  'has not published', 'have not published', 'has yet to publish',
  'the festival has not', 'not been announced by', 'not yet announced',
];
const NO_TIMES_HEAD = 'Plursky does not have set times for ';
const NO_TIMES_TAIL = ' The announced lineup is listed on this page; the schedule will appear here when it is available.';
let neutralSeen = 0;

const decode = (s) => String(s)
  .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"')
  .replace(/&#39;/g, "'").replace(/&amp;/g, '&');

// Visible text = the page with every <script> (and its JSON-LD) removed, tags
// stripped, entities decoded. Comparing against the raw HTML instead would let
// a question "match" its own JSON-LD copy and prove nothing.
const visibleText = (html) => decode(
  html.replace(/<script[\s\S]*?<\/script>/g, ' ').replace(/<[^>]+>/g, ' ')
).replace(/\s+/g, ' ').trim();

const ldBlocks = (html) => [...html.matchAll(/<script type="application\/ld\+json">\s*([\s\S]*?)\s*<\/script>/g)]
  .map(m => { try { return JSON.parse(m[1]); } catch { return null; } })
  .filter(Boolean);

if (!existsSync(F_DIR)) {
  console.log('  ✗  HARNESS DEAD: f/ does not exist — run node scripts/gen-festival-pages.mjs');
  process.exit(1);
}

const pages = readdirSync(F_DIR, { withFileTypes: true })
  .filter(d => d.isDirectory() && existsSync(join(F_DIR, d.name, 'index.html')))
  .map(d => d.name).sort();

// ── Harness positive control ──────────────────────────────────────────────
// Without this, a glob that matched nothing — or a JSON-LD shape change that
// made every FAQPage unparseable — would sail through as "0 violations", which
// reads exactly like a clean pass. An empty sweep is not evidence.
let withFaq = 0;
for (const id of pages) if (ldBlocks(readFileSync(join(F_DIR, id, 'index.html'), 'utf8')).some(d => d['@type'] === 'FAQPage')) withFaq++;
if (pages.length < 5 || withFaq === 0) {
  console.log(`  ✗  HARNESS DEAD: pages=${pages.length} carrying a parseable FAQPage=${withFaq}`);
  process.exit(1);
}

for (const id of pages) {
  const html = readFileSync(join(F_DIR, id, 'index.html'), 'utf8');
  const text = visibleText(html);
  const faq = ldBlocks(html).find(d => d['@type'] === 'FAQPage');
  if (!faq) { fail(`${id}: no FAQPage JSON-LD — every festival page should answer its basic questions`); continue; }

  const hasSchedule = /id="schedule-h"/.test(html);
  const hasStages = /id="stages-h"/.test(html);

  for (const q of faq.mainEntity || []) {
    const question = q.name;
    const answer = q.acceptedAnswer?.text || '';

    if (!text.includes(question)) fail(`${id}: question is in JSON-LD but NOT visible on the page — "${question}"`);
    else ok();

    if (!text.includes(answer)) fail(`${id}: answer is in JSON-LD but NOT visible on the page — "${answer.slice(0, 70)}…"`);
    else ok();

    if (/stage/i.test(question)) {
      if (!hasStages) fail(`${id}: answers a stage question with no rendered stage list`);
      else ok();
    }
    // Our own data absence is not evidence about the PUBLISHER. An answer may
    // report what Plursky has; it may never report what the festival has or has
    // not done, unless explicit source state backs the stronger words.
    const inferred = BANNED_PUBLISHER_CLAIMS.find(b => answer.toLowerCase().includes(b));
    if (inferred) fail(`${id}: answer infers publisher state from our own data absence — "${inferred}"`);
    else ok();

    // Likewise a rendered list proves a list, not an app capability.
    if (/stage/i.test(question) && /plursky app/i.test(answer)) {
      fail(`${id}: stage answer claims an app capability this page does not show`);
    } else ok();

    if (/set times/i.test(question)) {
      if (/^Yes\./.test(answer)) {
        if (!hasSchedule) fail(`${id}: claims set times are published with no rendered schedule grid`);
        else ok();
      } else {
        if (hasSchedule) fail(`${id}: gives the no-ingested-times answer while rendering a schedule grid`);
        else ok();
        if (!answer.startsWith(NO_TIMES_HEAD) || !answer.endsWith(NO_TIMES_TAIL)) {
          fail(`${id}: the no-ingested-times answer must stay neutral — got "${answer.slice(0, 90)}…"`);
        } else { ok(); neutralSeen++; }
      }
    }

    // A stated artist count must equal the one the lineup section prints.
    const stated = /^(\d+) artists are announced/.exec(answer);
    const printed = /(\d+) artists announced\./.exec(text);
    if (stated) {
      if (!printed || printed[1] !== stated[1]) {
        fail(`${id}: answer says ${stated[1]} artists, page prints ${printed ? printed[1] : 'no count'}`);
      } else ok();
    }
  }
}

// Positive control for the neutrality rule. If NO page exercises the
// no-ingested-times branch, the banned-phrase sweep above passed only because
// that branch never ran — and an unexercised rule reads exactly like a
// satisfied one. This is the dead-control failure mode, so it gets an
// assertion rather than trust.
if (!neutralSeen) {
  fail('no page exercised the neutral no-ingested-times branch — the neutrality rule is UNPROVEN, not satisfied');
} else ok();

if (failed) {
  console.log(`\n  ${failed}/${checks} checks FAILED — structured data claims something the page does not show.`);
  process.exit(1);
}
console.log(`  ✓ festival FAQ: ${checks} checks across ${pages.length} pages — every question and answer is visible, and every claim is backed by rendered content`);
