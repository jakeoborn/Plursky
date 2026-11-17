#!/usr/bin/env node
// Career arc gate (artist repository, M6; B6 spec §4, §7). Every on-screen
// claim traces to a billing id; untimed billings never feed a slot or
// closing claim; a single billing reads "First on a lineup in our records"
// with no axis; a key under review shows its billings separately and nothing
// comparative. Three layers:
//   1. data: every career-slice row agrees with billings.json field for
//      field, and every shared-lineup count recounts from the registry;
//   2. pages: Cloonee, VNSSA (b2b tab, ARC), Noizu, a single billing (619) and a
//      pending key (EAR) in Dark and Light at 393 and 320, plus Cloonee with
//      one set served untimed, read back claim by claim against the slice
//      the page was served;
//   3. --mutate: four code mutations, each must be caught.
// No network beyond the local server (the script CDNs come from scripts/vendor/).
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { existsSync, readFileSync } from 'node:fs';
import { serverReady } from './lib/server-ready.mjs';
import { wireVendor } from './lib/vendor-cdn.mjs';

const problems = []; let checks = 0;
const check = (ok, msg) => { checks++; if (!ok) problems.push(msg); };
const reservePort = () => new Promise((resolve, reject) => { const s = createServer(); s.once('error', reject); s.listen(0, '127.0.0.1', () => { const a = s.address(); s.close(e => e ? reject(e) : resolve(a.port)); }); });
const CAREERS = JSON.parse(readFileSync('data/artists/careers.json', 'utf8'));
const BILLINGS = new Map(JSON.parse(readFileSync('data/artists/billings.json', 'utf8')).map(b => [b.id, b]));
const REGISTRY = JSON.parse(readFileSync('data/artists/registry.json', 'utf8'));
const REVIEW = JSON.parse(readFileSync('data/artists/review.json', 'utf8'));
const AT = '2026-10-06T17:00:00Z';
const MUTATE = process.argv.includes('--mutate');

// ── 1. Data: the slice is the billings, nothing added ─────────────────────
const sw = readFileSync('sw.js', 'utf8');
check(!/artists\/careers\.json/.test(sw), 'sw.js precaches the career slice (it loads on demand)');
check(/'data\/artists\/careers\.json'/.test(readFileSync('scripts/build.mjs', 'utf8')), 'the build does not ship data/artists/careers.json');
const pendingKeys = new Set(REVIEW.filter(r => r.pending && r.id.startsWith('key:')).map(r => r.id.slice(4)));
let rowsChecked = 0, untimed = 0;
const eq = (a, b) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);
for (const [k, a] of Object.entries(CAREERS.artists)) {
  for (const x of a.b) {
    rowsChecked++;
    const b = BILLINGS.get(x[0]);
    if (!b) { check(false, `${k}: ${x[0]} is not a billing`); continue; }
    const f = CAREERS.festivals[x[1]];
    const bad = [];
    if (!b.performers.some(p => p.key === k)) bad.push('performer');
    if (f.id !== b.festivalId) bad.push('festival');
    for (const [i, field] of [[2, 'date'], [3, 'stage'], [4, 'start'], [5, 'end'], [6, 'setTag'], [8, 'closing'], [9, 'mainStage']]) if (!eq(x[i], b[field])) bad.push(field);
    if (!eq(x[10], b.performers.filter(p => p.key !== k).map(p => p.key))) bad.push('partners');
    if ((b.source === 'live') !== !!x[13]) bad.push('liveId');
    if (b.source === 'live' && x[11]) bad.push('a live set carries a published date');
    if (!b.start) { untimed++; if (x[8] !== null) bad.push('an untimed billing carries a closing claim'); }
    check(!bad.length, `${k}: ${x[0]} disagrees with billings.json on ${bad.join(', ')}`);
  }
  check(!!a.pending === pendingKeys.has(k), `${k}: pending flag ${!!a.pending} but review says ${pendingKeys.has(k)}`);
  if (a.pending) check(!a.s, `${k}: a pending key carries shared lineups`);
}
// Shared lineups recount from the registry.
const festsOfKey = new Map(REGISTRY.map(r => [r.key, new Set(r.billings.map(id => BILLINGS.get(id).festivalId))]));
let sharedChecked = 0;
for (const [k, a] of Object.entries(CAREERS.artists)) for (const [o, n] of a.s || []) {
  sharedChecked++;
  const mine = festsOfKey.get(k), theirs = festsOfKey.get(o) || new Set();
  const real = [...mine].filter(f => theirs.has(f)).length;
  check(real === n && n >= 2 && o !== k, `${k}: shared with ${o} says ${n}, the registry counts ${real}`);
}
check(rowsChecked >= BILLINGS.size, `control: ${rowsChecked} career rows for ${BILLINGS.size} billings`);
check(untimed > 100, `control: ${untimed} untimed career rows (expected the untimed billings to be present)`);
check(sharedChecked > 1000, `control: ${sharedChecked} shared-lineup counts`);

// ── 2. Pages ──────────────────────────────────────────────────────────────
// Each fixture: festival, artist id, optional B2B tab, registry key, the slice
// override (or null), and what this page must show.
const UNTIMED = JSON.parse(JSON.stringify(CAREERS));
for (const x of UNTIMED.artists.cloonee.b) if (x[0] === 'edc-lv-2026:k26') { x[4] = null; x[5] = null; x[8] = null; }
const FIX = [
  { name: 'Cloonee', fest: 'iii-points-2026', id: 'iiip-cloonee', key: 'cloonee', kind: 'arc',
    move: '2025 Circuit Grounds 2:00 AM → 2026 Kinetic Field 3:01 AM' },
  // ARC's "WALKER & ROYCE B2B VNSSA", both tabs. Escape's "VNSSA B2B ????" was
  // the b2b fixture until the official lineup dropped it (2026-10-26), and its
  // '????' no-career page fixture went with it: no other lineup prints an
  // unnamed partner (parseBilling's unit test in test-artist-registry still
  // pins that rule). The first-performer mutation runs on the Walker & Royce
  // tab because its key is NOT the billing's first in the slice ("vnssa"
  // sorts first), so "[0]" shows VNSSA's career there; on the VNSSA tab
  // "[0]" happens to be right and the mutation is invisible.
  { name: 'VNSSA', fest: 'arc-2026', id: 'arc-walker-and-royce-b2b-vnssa-midway-d3', tab: 'VNSSA', key: 'vnssa', kind: 'arc', partner: 'Walker & Royce' },
  { name: 'Walker & Royce', fest: 'arc-2026', id: 'arc-walker-and-royce-b2b-vnssa-midway-d3', tab: 'WALKER & ROYCE', key: 'walker-and-royce', kind: 'arc', partner: 'VNSSA' },
  { name: 'Noizu', fest: 'edc-lv-2026', id: 's13', key: 'noizu', kind: 'arc', move: '2025 Kinetic Field 8:00 PM → 2026 Stereo Bloom 11:15 PM' },
  { name: '619', fest: 'iii-points-2026', id: 'iiip-619', key: '619', kind: 'single' },
  { name: 'EAR (pending)', fest: 'iii-points-2026', id: 'iiip-ear', key: 'ear', kind: 'pending' },
  { name: 'Cloonee, EDC 2026 untimed', fest: 'iii-points-2026', id: 'iiip-cloonee', key: 'cloonee', kind: 'arc', slice: UNTIMED,
    move: '2025 Circuit Grounds → 2026 Kinetic Field' },
];

// Anchors are the COMPILED build/artists.js text (Babel's output); a missing
// anchor throws, so a refactor can't turn a mutation vacuous.
const MUTATIONS = [
  { name: 'a move shows times when one side is untimed', from: 'var timed = !!(from[4] && to[4]);', to: 'var timed = true;', fixture: 'Cloonee, EDC 2026 untimed' },
  { name: 'every timed set reads as a closing slot', from: 'if (_x[8] === true && _x[3])', to: 'if (_x[3])', fixture: 'Cloonee' },
  { name: 'a pending key gets an arc', from: 'var m = c.pending ? null : _careerModel', to: 'var m = _careerModel', also: ['if (c.pending) return', 'if (false) return'], fixture: 'EAR (pending)' },
  { name: 'the page takes the billing\'s first performer, not this name\'s', from: '.find(k => k === want)', to: '[0]', fixture: 'Walker & Royce' },
];

async function readPage(browser, port, fx, scheme, width, mutation) {
  const ctx = await browser.newContext({ viewport: { width, height: 1400 }, deviceScaleFactor: 1, serviceWorkers: 'block', reducedMotion: 'reduce', colorScheme: scheme });
  await ctx.route(u => !u.toString().startsWith(`http://127.0.0.1:${port}/`), r => r.abort());
  await wireVendor(ctx);
  if (fx.slice) await ctx.route(/\/data\/artists\/careers\.json/, r => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(fx.slice) }));
  if (mutation) await ctx.route(/\/build\/artists\.js/, async r => {
    const res = await r.fetch(); const body = await res.text();
    if (!body.includes(mutation.from)) throw new Error(`mutation "${mutation.name}": anchor not in build/artists.js`);
    let out = body.replace(mutation.from, mutation.to);
    if (mutation.also) { if (!out.includes(mutation.also[0])) throw new Error(`mutation "${mutation.name}": second anchor not in build/artists.js`); out = out.replace(mutation.also[0], mutation.also[1]); }
    await r.fulfill({ response: res, body: out });
  });
  await ctx.clock.install({ time: new Date(AT) });
  await ctx.addInitScript(({ scheme, fest }) => {
    localStorage.setItem('onboarded', 'v1'); localStorage.setItem('active_festival_id', fest); localStorage.setItem('active_festival_explicit', '1');
    localStorage.setItem('cloud_nudge_seen', '1'); localStorage.setItem('plursky.appearance', scheme);
  }, { scheme, fest: fx.fest });
  const page = await ctx.newPage();
  const errs = []; page.on('pageerror', e => errs.push(e.message));
  try {
    const slice = page.waitForResponse(/\/data\/artists\/careers\.json/, { timeout: 60000 });
    await page.goto(`http://127.0.0.1:${port}/index.html?f=${fx.fest}&artist=${fx.id}`, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForFunction(() => document.querySelector('[data-artist-hero-name]'), null, { timeout: 30000 });
    if (fx.tab) await page.getByRole('button', { name: fx.tab, exact: true }).click();
    // The slice is fetched on demand: wait for it, then a beat for React.
    await slice;
    await page.clock.runFor(400); await page.waitForTimeout(250);
    // Years open newest first; open the rest so every billing row is read.
    for (const b of await page.$$('[data-career-year] > button[aria-expanded="false"]')) await b.click();
    await page.waitForTimeout(100);
    return await page.evaluate(() => {
      const r = el => el.getBoundingClientRect();
      const card = document.querySelector('[data-career-ladder]');
      return {
        career: document.querySelector('[data-artist-career]')?.getAttribute('data-artist-career') ?? null,
        detail: !!document.querySelector('[data-artist-career-detail]'),
        ladder: !!card, single: !!document.querySelector('[data-career-single]'),
        claims: [...document.querySelectorAll('[data-claim]')].map(e => ({ kind: e.dataset.claim, ids: (e.dataset.billings || '').split(' ').filter(Boolean), shared: e.dataset.shared || null, text: e.textContent, cut: e.scrollWidth > e.clientWidth + 1 })),
        nodes: [...document.querySelectorAll('[data-ladder-node]')].map(n => ({ id: n.dataset.billings, small: n.querySelector('circle').getAttribute('r') === '3', inside: !card || (r(n).left >= r(card).left - 0.5 && r(n).right <= r(card).right + 0.5) })),
        rows: [...document.querySelectorAll('[data-career-billing]')].map(e => ({ id: e.dataset.careerBilling, text: e.textContent })),
        overflowX: document.documentElement.scrollWidth > innerWidth + 1,
      };
    }).then(v => ({ ...v, errs }));
  } finally { await ctx.close(); }
}

// 24h "HH:MM" → "h:MM AM", as fmt12 prints it.
const t12 = t => { const [h, m] = t.split(':').map(Number); return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`; };
const TIME = /\b\d{1,2}:\d\d [AP]M\b/g;

function judge(fx, v, tag) {
  const p = [];
  const slice = fx.slice || CAREERS;
  const own = fx.key ? new Map(slice.artists[fx.key].b.map(x => [x[0], x])) : new Map();
  if (v.errs.length) p.push(`page error: ${v.errs[0]}`);
  if (v.overflowX) p.push('the page scrolls sideways');
  if (fx.kind === 'none') { if (v.career !== null || v.detail) p.push('a name with no billing of its own shows a career'); return p; }
  if (fx.kind === 'pending') {
    if (v.career !== 'pending') p.push('a pending key does not say its billings are listed separately');
    if (v.ladder || v.single) p.push('a pending key draws an arc');
    if (v.claims.some(c => ['fact', 'move', 'first', 'partner', 'shared'].includes(c.kind))) p.push('a pending key makes a comparative claim');
  }
  if (fx.kind === 'single') {
    if (!v.single || v.ladder) p.push('a single billing does not show one node with no axis');
    if (!v.claims.some(c => c.kind === 'first' && c.text === `First on a lineup in our records: ${slice.festivals[[...own.values()][0][1]].name}`)) p.push('a single billing does not read "First on a lineup in our records: <festival>"');
  }
  if (fx.kind === 'arc' && !v.ladder) p.push('no ladder');
  if (fx.move && !v.claims.some(c => c.kind === 'move' && c.text === fx.move)) p.push(`the ladder move is not "${fx.move}" (${v.claims.filter(c => c.kind === 'move').map(c => c.text).join(' | ') || 'none'})`);
  if (fx.partner && !v.claims.some(c => c.kind === 'partner' && c.text.includes(fx.partner))) p.push(`partner ${fx.partner} missing`);
  for (const c of v.claims) {
    if (c.kind === 'shared') {
      const [k, n] = c.shared.split(':');
      if (!(slice.artists[fx.key].s || []).some(([o, m]) => o === k && String(m) === n)) p.push(`shared ${c.shared} is not in the slice`);
      if (!c.text.endsWith(`${n} festivals together`)) p.push(`shared ${k} does not print its count`);
      continue;
    }
    if (!c.ids.length) { p.push(`a ${c.kind} claim carries no billing id: "${c.text}"`); continue; }
    const rows = c.ids.map(id => own.get(id));
    if (rows.some(x => !x)) { p.push(`a ${c.kind} claim cites a billing not this artist's: ${c.ids.join(' ')}`); continue; }
    if (c.cut) p.push(`claim cut: "${c.text}"`);
    const times = c.text.match(TIME) || [];
    const timedTimes = new Set(rows.filter(x => x[4]).map(x => t12(x[4])));
    // Untimed never feeds a slot claim: every time printed is a cited row's
    // own start, and a move prints times only when both sides are timed.
    for (const t of times) if (!timedTimes.has(t)) p.push(`"${c.text}" prints ${t}, no cited timed billing starts then`);
    if (c.kind === 'move' && times.length && rows.some(x => !x[4])) p.push(`"${c.text}" prints a slot across an untimed billing`);
    if (/^Closed /.test(c.text) && rows.some(x => x[8] !== true)) p.push(`"${c.text}" cites a billing that did not close its stage`);
    if (/main stage|main-stage/.test(c.text) && !rows.some(x => x[9] === true)) p.push(`"${c.text}" claims a main stage with no ruling behind it`);
    if (/^First /.test(c.text) && !/in our records/.test(c.text)) p.push(`"${c.text}" is a first not scoped "in our records"`);
    if (c.kind === 'billing') {
      const x = rows[0];
      if (!x[4] && !c.text.includes('time TBA')) p.push(`untimed ${x[0]} does not read "time TBA"`);
      if (x[11] && !c.text.includes('as published')) p.push(`archived ${x[0]} does not say "as published"`);
    }
  }
  if (fx.kind === 'arc') {
    const untimedIds = new Set([...own.values()].filter(x => !x[4]).map(x => x[0]));
    for (const n of v.nodes) { if (n.small !== untimedIds.has(n.id)) p.push(`node ${n.id} shape says ${n.small ? 'untimed' : 'timed'}`); if (!n.inside) p.push(`node ${n.id} sits outside the ladder card`); }
    if (v.nodes.length !== own.size) p.push(`${v.nodes.length} ladder nodes for ${own.size} billings`);
    // Year by year lists every billing once.
    const listed = new Set(v.rows.map(r => r.id));
    if ([...own.keys()].some(id => !listed.has(id))) p.push('a billing is missing from year by year');
  }
  return p.map(s => `${tag}: ${s}`);
}

const PORT = await reservePort();
const server = spawn('python3', ['-m', 'http.server', String(PORT), '--bind', '127.0.0.1'], { cwd: process.cwd(), stdio: 'ignore' });
try {
  await serverReady(`http://127.0.0.1:${PORT}/index.html`);
  const executablePath = ['/opt/google/chrome/chrome', '/usr/bin/google-chrome', '/usr/bin/chromium'].find(existsSync);
  const browser = await chromium.launch({ headless: true, ...(executablePath ? { executablePath } : {}) });
  if (MUTATE) {
    let caught = 0;
    for (const m of MUTATIONS) {
      const fx = FIX.find(f => f.name === m.fixture);
      const v = await readPage(browser, PORT, fx, 'dark', 393, m);
      const p = judge(fx, v, fx.name);
      console.log(`  ${p.length ? '✓ caught' : '✗ MISSED'}: ${m.name}${p.length ? ` (${p[0]})` : ''}`);
      if (p.length) caught++;
    }
    await browser.close();
    if (caught !== MUTATIONS.length) { console.log(`  ✗ career arc mutations: ${caught} of ${MUTATIONS.length} caught`); process.exit(1); }
    console.log(`  ✓ career arc mutations: ${caught} of ${MUTATIONS.length} caught`);
    process.exit(0);
  }
  for (const scheme of ['dark', 'light']) for (const width of [393, 320]) for (const fx of FIX) {
    const v = await readPage(browser, PORT, fx, scheme, width, null);
    for (const s of judge(fx, v, `${fx.name} ${scheme} ${width}`)) check(false, s);
    check(true, 'page');
  }
  await browser.close();
} finally { server.kill(); }

if (problems.length) {
  console.log(`  ✗ career arc: ${problems.length} of ${checks} checks failed`);
  for (const p of problems.slice(0, 30)) console.log(`    ✗ ${p}`);
  process.exit(1);
}
console.log(`  ✓ career arc: ${checks} checks — ${rowsChecked} slice rows match billings.json (${untimed} untimed, none closing), ${sharedChecked} shared counts recount, ${FIX.length} fixtures × Dark/Light × 393/320 trace every claim to a billing`);
