#!/usr/bin/env node
// New-user audit: walks the full app in a fresh browser context, takes
// screenshots of each surface, captures JS errors + console errors, and
// specifically exercises the crew/group-code share flow with two
// independent browser contexts to verify presence works end-to-end.
//
// Findings are printed at the end as a structured report. Severities:
//   • error  — broken (JS exception, missing page, dead button)
//   • warn   — degraded (console error, missing data, slow path)
//   • info   — observation worth noting
//
// Run: node scripts/audit-new-user.mjs

import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PORT = 8766;

function startServer() {
  const proc = spawn('python3', ['-m', 'http.server', String(PORT), '--bind', '127.0.0.1'], {
    cwd: root, stdio: ['ignore', 'pipe', 'pipe'],
  });
  return new Promise((resolve, reject) => {
    const start = Date.now();
    (function tick() {
      fetch(`http://127.0.0.1:${PORT}/index.html`).then(r => {
        if (r.ok) resolve(proc); else setTimeout(tick, 100);
      }).catch(() => {
        if (Date.now() - start > 5000) reject(new Error('server failed to start'));
        else setTimeout(tick, 100);
      });
    })();
  });
}

const findings = [];
const add = (area, severity, note) => findings.push({ area, severity, note });

function attachErrorListeners(page, label) {
  page.on('pageerror', e => add(label, 'error', `JS error: ${e.message.split('\n')[0]}`));
  page.on('console', m => {
    if (m.type() !== 'error') return;
    const txt = m.text();
    // Tolerate known noisy external errors (CORS on setlist proxy, etc.)
    // surfaced during browsing — those aren't audit issues for THIS code.
    if (/setlist|proxy-setlist|CORS|Failed to load resource/i.test(txt)) {
      add(label, 'info', `external: ${txt.slice(0, 120)}`);
      return;
    }
    add(label, 'warn', `console.error: ${txt.slice(0, 200)}`);
  });
}

async function newFreshContext(browser) {
  const ctx = await browser.newContext({ timezoneId: 'America/Los_Angeles' });
  await ctx.clearCookies();
  return ctx;
}

async function bootstrap(page) {
  await page.goto(`http://127.0.0.1:${PORT}/`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => Array.isArray(window.ARTISTS) && window.ARTISTS.length > 0, { timeout: 20000 });
  await page.waitForTimeout(800);
}

async function dismissOnboarding(page) {
  // Step 1: name
  const nameInput = page.locator('input[placeholder*="call you"]');
  if (await nameInput.count() > 0) {
    await nameInput.fill('Audit User');
    await page.getByRole('button', { name: /CONTINUE/i }).first().click();
    await page.waitForTimeout(300);
  } else {
    add('onboarding', 'error', 'Step 1 name input not visible on fresh load');
  }
  // Step 2: Spotify — SKIP
  const skip2 = page.getByRole('button', { name: /^SKIP$/i });
  if (await skip2.count() > 0) {
    await skip2.first().click();
    await page.waitForTimeout(300);
  } else {
    add('onboarding', 'warn', 'Step 2 SKIP button not visible');
  }
  // Step 3: notifications — MAYBE LATER (or GOT IT for unsupported)
  const skip3 = page.getByRole('button', { name: /MAYBE LATER|GOT IT/i });
  if (await skip3.count() > 0) {
    await skip3.first().click();
    await page.waitForTimeout(500);
  } else {
    add('onboarding', 'warn', 'Step 3 dismiss button not visible');
  }
}

async function audit() {
  const server = await startServer();
  const browser = await chromium.launch({ headless: true });

  // ── TEST 1: ONBOARDING ──────────────────────────────────────
  const ctxA = await newFreshContext(browser);
  const pageA = await ctxA.newPage();
  attachErrorListeners(pageA, 'user-a');

  await bootstrap(pageA);
  await pageA.screenshot({ path: '/tmp/audit-01-welcome.png', fullPage: true });
  if (await pageA.locator('text=/Welcome to/i').count() === 0) {
    add('onboarding', 'error', 'Welcome modal did not render');
  }
  await dismissOnboarding(pageA);
  await pageA.screenshot({ path: '/tmp/audit-02-after-onboarding.png', fullPage: true });

  // ── TEST 2: TODAY (HOME) TAB ────────────────────────────────
  // After dismiss we should land on Home. Verify some hero content + nav.
  await pageA.waitForTimeout(500);
  const todayTab = pageA.locator('button').filter({ hasText: /^Today$/i });
  if (await todayTab.count() === 0) {
    add('home', 'error', 'TODAY nav tab not visible');
  }
  if (await pageA.locator('text=/EDC|Las Vegas|Friday|Saturday|Sunday/i').count() === 0) {
    add('home', 'warn', 'No festival-date references visible on Home (post-festival empty state?)');
  }
  await pageA.screenshot({ path: '/tmp/audit-03-home.png', fullPage: true });

  // ── TEST 3: LINEUP TAB + ARTIST DRILL-IN ────────────────────
  const lineupTab = pageA.locator('button').filter({ hasText: /^Lineup$/i }).first();
  if (await lineupTab.count() === 0) {
    add('lineup', 'error', 'LINEUP nav tab not visible');
  } else {
    await lineupTab.click();
    await pageA.waitForTimeout(600);
    await pageA.screenshot({ path: '/tmp/audit-04-lineup.png', fullPage: true });
    // Try to click into an artist (any name that looks like an artist row).
    // Lineup renders artist names as serif text inside clickable rows.
    const peggyGou = pageA.locator('text=/Peggy Gou/').first();
    if (await peggyGou.count() === 0) {
      add('lineup', 'warn', 'Peggy Gou not visible in default lineup view');
    } else {
      await peggyGou.click();
      await pageA.waitForTimeout(700);
      await pageA.screenshot({ path: '/tmp/audit-05-artist-peggy.png', fullPage: true });
      // Verify artist screen elements
      const checks = [
        ['Peggy Gou header', await pageA.locator('text=/^Peggy Gou$/').count() >= 1],
        ['Stage name (Neon Garden)', await pageA.locator('text=/Neon Garden/').count() >= 1],
        ['Bio / chip row', await pageA.locator('text=/^BIO$/i').count() >= 1],
        ['Social links (SPOTIFY)', await pageA.locator('text=/^SPOTIFY ↗$/').count() >= 1],
        ['Add-to-lineup button', await pageA.locator('text=/\\+ ADD TO LINEUP|SAVED TO LINEUP/i').count() >= 1],
      ];
      for (const [name, ok] of checks) {
        if (!ok) add('artist-screen', 'warn', `${name} missing on Peggy Gou page`);
      }
      // Save the set so we have crew/saved data later
      const saveBtn = pageA.locator('button').filter({ hasText: /\+ ADD TO LINEUP|SAVED TO LINEUP/i }).first();
      if (await saveBtn.count() > 0) {
        const txtBefore = (await saveBtn.textContent() || '').trim();
        if (!/SAVED/i.test(txtBefore)) {
          try { await saveBtn.click({ timeout: 2000 }); } catch {}
          await pageA.waitForTimeout(400);
        }
      }
      // Back button — looks for either aria-label="Back" or the "←" arrow.
      const backBtn = pageA.locator('button[aria-label="Back"], button:has-text("←")').first();
      if (await backBtn.count() > 0) {
        try { await backBtn.click({ timeout: 2000 }); } catch {}
      } else {
        add('artist-screen', 'warn', 'No back affordance on artist screen');
      }
      await pageA.waitForTimeout(400);
    }
  }

  // ── TEST 4: MAP TAB ─────────────────────────────────────────
  const mapTab = pageA.locator('button').filter({ hasText: /^Map$/i }).first();
  if (await mapTab.count() === 0) {
    add('map', 'error', 'MAP nav tab not visible');
  } else {
    await mapTab.click();
    await pageA.waitForTimeout(900);
    await pageA.screenshot({ path: '/tmp/audit-06-map.png', fullPage: true });
    // Map should render the SVG or MapLibre canvas
    const hasSvg = await pageA.locator('svg').count();
    if (hasSvg === 0) add('map', 'error', 'No SVG on Map screen (TopDownMap render failed?)');
  }

  // ── TEST 5: ME TAB + CREW CARD EXPAND ───────────────────────
  const meTab = pageA.locator('button').filter({ hasText: /^Me$/i }).first();
  if (await meTab.count() === 0) {
    add('me', 'error', 'ME nav tab not visible');
  } else {
    await meTab.click();
    await pageA.waitForTimeout(600);
    await pageA.screenshot({ path: '/tmp/audit-07-me.png', fullPage: true });
    // Check core sections: identity card, 4-card grid (SAVED/MEMORIES/CREW/BADGES)
    const grid = [
      ['SAVED tile', await pageA.locator('button:has-text("SAVED")').count() >= 1],
      ['MEMORIES tile', await pageA.locator('button:has-text("MEMORIES")').count() >= 1],
      ['CREW tile', await pageA.locator('button:has-text("CREW")').count() >= 1],
      ['BADGES tile', await pageA.locator('button:has-text("BADGES")').count() >= 1],
    ];
    for (const [n, ok] of grid) if (!ok) add('me-screen', 'warn', `${n} not found`);
    // Open Crew Mode (collapsible at bottom)
    const crewToggle = pageA.locator('text=/^Crew Mode$/').first();
    if (await crewToggle.count() === 0) {
      add('crew', 'error', 'Crew Mode collapsible header not visible on Me');
    } else {
      // Scroll into view then click
      await crewToggle.scrollIntoViewIfNeeded();
      await crewToggle.click();
      await pageA.waitForTimeout(500);
      await pageA.screenshot({ path: '/tmp/audit-08-crew-expanded.png', fullPage: true });
    }
  }

  // ── TEST 6: SEARCH FAB ──────────────────────────────────────
  // The SEARCH button floats bottom-right above the tab bar.
  const searchBtn = pageA.locator('button').filter({ hasText: /SEARCH/ }).first();
  if (await searchBtn.count() === 0) {
    add('search', 'warn', 'SEARCH FAB not visible from Me screen');
  } else {
    await searchBtn.click();
    await pageA.waitForTimeout(400);
    await pageA.screenshot({ path: '/tmp/audit-09-search-modal.png', fullPage: true });
    // Type a query
    const input = pageA.locator('input[placeholder*="Artist, stage"]').first();
    if (await input.count() > 0) {
      await input.fill('peggy');
      await pageA.waitForTimeout(300);
      await pageA.screenshot({ path: '/tmp/audit-10-search-results.png', fullPage: true });
      const hasResult = await pageA.locator('text=/Peggy Gou/i').count();
      if (hasResult === 0) add('search', 'warn', 'Searching "peggy" returned no Peggy Gou hit');
      // Try Escape first — but the input handler is the ONLY listener, so
      // once focus leaves the input, Escape is a dead key. That's a real
      // UX bug (filed below). Fall back to clicking CLOSE.
      await pageA.keyboard.press('Escape');
      await pageA.waitForTimeout(200);
      if (await pageA.locator('input[placeholder*="Artist, stage"]').count() > 0) {
        // Still open after Escape — bug.
        add('search', 'warn', 'Search modal did NOT close on Escape (no global key handler — only the input listens)');
        const closeBtn = pageA.locator('button').filter({ hasText: /^CLOSE$/ }).first();
        if (await closeBtn.count() > 0) await closeBtn.click();
        await pageA.waitForTimeout(300);
      }
    } else {
      add('search', 'warn', 'Search input not found inside FAB modal — selector "input[type=text]" did not match (input has default-type, no explicit type attribute)');
    }
  }

  // ── TEST 7: CREW CODE SHARE FLOW (two contexts) ─────────────
  // User A is already on Me with Crew Mode expanded. Tap the start
  // button if there is one (or read the auto-generated code), then
  // share the ?crew=CODE URL with User B in a second context. Wait
  // ~5s for presence to register and verify A sees B and vice versa.
  let crewCode = null;
  try {
    crewCode = await pageA.evaluate(() => localStorage.getItem('plursky_group_code'));
  } catch {}
  if (!crewCode) {
    // CrewCard auto-generates via sbGetOrCreateGroupCode on mount, so it
    // should be present. If not, that's a finding.
    add('crew', 'error', 'plursky_group_code not generated for User A on Me visit');
  } else {
    add('crew', 'info', `User A crew code = ${crewCode}`);
    // Look for a "JOIN" / "START CREW" button — naming may differ.
    const startBtn = pageA.locator('button').filter({ hasText: /START CREW|JOIN MY CREW|CREATE MY CREW|JOIN/i }).first();
    if (await startBtn.count() > 0) {
      try { await startBtn.click({ timeout: 2000 }); } catch {}
      await pageA.waitForTimeout(2500); // wait for presence to come online
    } else {
      add('crew', 'info', 'No explicit START CREW button; CrewCard may auto-bind on link visit');
    }

    // User B in a fresh context joins via the deep link.
    const ctxB = await newFreshContext(browser);
    const pageB = await ctxB.newPage();
    attachErrorListeners(pageB, 'user-b');
    await ctxB.addInitScript(() => {
      // Skip onboarding so the Me tab can mount cleanly.
      try {
        localStorage.setItem('onboarded', 'v1');
        localStorage.setItem('user_name', 'Friend B');
      } catch {}
    });
    await pageB.goto(`http://127.0.0.1:${PORT}/?crew=${crewCode}`, { waitUntil: 'domcontentloaded' });
    await pageB.waitForFunction(() => Array.isArray(window.ARTISTS), { timeout: 20000 });
    await pageB.waitForTimeout(3500); // realtime presence often needs a few seconds

    await pageB.screenshot({ path: '/tmp/audit-11-user-b-after-join.png', fullPage: true });

    // Verify B has the crew code stored.
    const bCode = await pageB.evaluate(() => localStorage.getItem('plursky_group_code'));
    if (bCode !== crewCode) {
      add('crew', 'error', `User B did NOT pick up crew code from URL (got ${bCode}, expected ${crewCode})`);
    } else {
      add('crew', 'info', 'User B picked up crew code from URL ✓');
    }
    // Verify autojoin flag was cleared (it should be consumed once on mount).
    const autojoinLeftovers = await pageB.evaluate(() => localStorage.getItem('plursky_crew_autojoin'));
    if (autojoinLeftovers) {
      add('crew', 'warn', `User B's autojoin flag was NOT cleared after consume (=${autojoinLeftovers})`);
    }
    // Open the Me tab + expand Crew Mode and see if A's count went up to 2.
    const meTabB = pageB.locator('button').filter({ hasText: /^Me$/i }).first();
    if (await meTabB.count() > 0) {
      await meTabB.click();
      await pageB.waitForTimeout(800);
      const crewToggleB = pageB.locator('text=/^Crew Mode$/').first();
      if (await crewToggleB.count() > 0) {
        await crewToggleB.scrollIntoViewIfNeeded();
        await crewToggleB.click();
        await pageB.waitForTimeout(3500);
        await pageB.screenshot({ path: '/tmp/audit-12-user-b-crew-expanded.png', fullPage: true });
      }
    }

    // Now check A's view — should show "● 2 IN CREW".
    await pageA.bringToFront();
    await pageA.waitForTimeout(2500);
    await pageA.screenshot({ path: '/tmp/audit-13-user-a-after-b-joined.png', fullPage: true });
    const inCrewText = await pageA.locator('text=/2 IN CREW/').count();
    const inCrewTextSingle = await pageA.locator('text=/1 IN CREW/').count();
    if (inCrewText >= 1) {
      add('crew', 'info', 'User A sees "2 IN CREW" — presence working ✓');
    } else if (inCrewTextSingle >= 1) {
      add('crew', 'error', 'User A only sees "1 IN CREW" — User B presence did not arrive');
    } else {
      add('crew', 'warn', 'User A did not show "N IN CREW" counter (CrewCard may not be joined; user did not tap START)');
    }

    // Mirror check: B's count should also be 2.
    const inCrewTextB = await pageB.locator('text=/2 IN CREW/').count();
    if (inCrewTextB >= 1) {
      add('crew', 'info', 'User B sees "2 IN CREW" — bidirectional presence ✓');
    } else {
      add('crew', 'warn', 'User B did not show "2 IN CREW" (autojoin may have silently failed)');
    }

    await ctxB.close();
  }

  // ── TEST 8: MEMORIES tab reachable from Me ──────────────────
  // Dismiss any open transient sheets/toasts before clicking the tile.
  try { await pageA.keyboard.press('Escape'); } catch {}
  await pageA.waitForTimeout(300);
  const memoriesTile = pageA.locator('button').filter({ hasText: /MEMORIES/ }).first();
  let memoriesOk = false;
  if (await memoriesTile.count() > 0) {
    try {
      await memoriesTile.click({ timeout: 5000, force: true });
      memoriesOk = true;
    } catch (e) {
      add('memories', 'error', `MEMORIES tile click blocked: ${e.message?.split('\n')[0]}`);
    }
  } else {
    add('memories', 'error', 'MEMORIES tile not found on Me screen');
  }
  if (memoriesOk) {
    await pageA.waitForTimeout(600);
    await pageA.screenshot({ path: '/tmp/audit-14-memories-empty.png', fullPage: true });
    const importBtn = await pageA.locator('text=/Import from camera roll/i').count();
    if (importBtn === 0) add('memories', 'error', 'Import button not visible on Memories tab');
    const emptyMsg = await pageA.locator('text=/NO MOMENTS YET/i').count();
    if (emptyMsg === 0) add('memories', 'info', 'No empty state text on first-load Memories');
  }

  // ── DONE ────────────────────────────────────────────────────
  await browser.close();
  server.kill('SIGTERM');

  // Print report
  console.log('\n══════════════════════════════════════════════════');
  console.log('  NEW-USER AUDIT REPORT');
  console.log('══════════════════════════════════════════════════\n');
  const bySev = { error: [], warn: [], info: [] };
  for (const f of findings) bySev[f.severity].push(f);
  console.log(`Findings: ${findings.length} total — ${bySev.error.length} errors · ${bySev.warn.length} warnings · ${bySev.info.length} info\n`);
  for (const sev of ['error', 'warn', 'info']) {
    if (bySev[sev].length === 0) continue;
    const sym = sev === 'error' ? '✗' : sev === 'warn' ? '⚠' : 'ℹ';
    console.log(`── ${sev.toUpperCase()} (${bySev[sev].length}) ──`);
    for (const f of bySev[sev]) {
      console.log(`  ${sym} [${f.area}] ${f.note}`);
    }
    console.log('');
  }
  console.log('Screenshots in /tmp/audit-*.png\n');
  process.exit(bySev.error.length > 0 ? 1 : 0);
}

audit().catch(err => {
  console.error('AUDIT CRASHED:', err);
  process.exit(2);
});
