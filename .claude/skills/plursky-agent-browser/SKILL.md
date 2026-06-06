---
name: plursky-agent-browser
description: >
  Drive the REAL Plursky app in a headless browser (Playwright) to verify a
  change end-to-end, audit screens, or screenshot the running UI — not just
  mount a component in isolation. Use for: "agent browser test", "tour the
  app", "screenshot Memories/Lineup/Me", "verify the redesign in the real
  app", "navigate to the X tab and check", visual/nav/feel audits. Complements
  plursky-verify (which does Babel-parse + component mount probe); this one
  boots index.html and navigates the real nav.
---

# Plursky agent-browser (Playwright)

Playwright 1.60 + chromium are installed (`node_modules/playwright`). Use this
to boot the **real** app (full `index.html` script chain), navigate via the
real bottom nav, and screenshot / assert `innerText`.

## Gotchas that cost iterations (do these from the start)
1. **Suppress the onboarding chain by SEEDING flags, never by clicking.**
   Clicking dismiss buttons is whack-a-mole — each modal reveals the next
   (CONTINUE → SKIP → MAYBE LATER → …). Instead seed localStorage in
   `addInitScript` BEFORE load:
   - `onboarded` = **`'v1'`** — must EXACTLY equal `ONBOARD_VERSION` (app.jsx).
     Seeding `'1'` does NOT work (gate is `!== ONBOARD_VERSION`).
   - also: `cloud_nudge_seen`, `ft_guide_seen`, `notif_nudge_dismissed`,
     `plursky_recap_seen_v1` = `'1'`; `plursky_display_name` = a name.
2. **DOM text ≠ visible text.** Bottom-nav labels are CSS-uppercased: the DOM
   says `"Memories"`, not `"MEMORIES"`. `getByText('MEMORIES')` fails.
3. **Navigate with a JS-dispatched click**, robust to any residual overlay:
   `page.evaluate(l => [...document.querySelectorAll('button')].find(b => b.textContent.trim()===l)?.click(), 'Memories')`.
4. **Assert `innerText`** for correctness (covers DOM behind overlays);
   the **screenshot must be of the running app** — a welcome-modal or lock-screen
   shot proves nothing. Resolve ambiguous counts by eyeballing the screenshot.
5. `serviceWorkers: 'block'` in the context, or a stale SW serves an old build.
6. Seed app data via localStorage keys: moments `plursky_moments_v1`
   (`{night:[{id,night,artistId,takenAt:"YYYY-MM-DD HH:MM",createdAt,photoId,kind}]}`),
   attendance `plursky_attended_v1` (`{night:[artistId,…]}`), saved `edc_saved`
   (`[artistId,…]`). Real photo blobs aren't in localStorage, so thumbnails show
   "LOADING…" — fine for layout/nav; NOT proof of real-media rendering.

## Ready-to-run template (`node /tmp/pw.cjs` from the repo, with `python3 -m http.server 8899` running)
```js
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport:{width:414,height:896}, deviceScaleFactor:2, serviceWorkers:'block' });
  const p = await ctx.newPage();
  const errs=[]; p.on('pageerror',e=>errs.push(e.message));
  await p.addInitScript(() => {
    localStorage.setItem('plursky_moments_v1', JSON.stringify({1:[
      {id:'m1',night:1,artistId:'k1',takenAt:'2026-05-16 20:30',createdAt:1,photoId:'p1',kind:'photo'},
      {id:'m3',night:1,artistId:'k6',takenAt:'2026-05-17 00:40',createdAt:3,photoId:'p3',kind:'photo'}]}));
    localStorage.setItem('plursky_attended_v1', JSON.stringify({1:['k1','k6','k2']}));
    localStorage.setItem('edc_saved', JSON.stringify(['k1','k2','k6']));
    localStorage.setItem('onboarded','v1');                 // MUST equal ONBOARD_VERSION
    localStorage.setItem('plursky_display_name','Jake');
    ['cloud_nudge_seen','ft_guide_seen','notif_nudge_dismissed','plursky_recap_seen_v1'].forEach(k=>localStorage.setItem(k,'1'));
  });
  await p.goto('http://localhost:8899/index.html',{waitUntil:'domcontentloaded'});
  await p.waitForFunction(()=>document.getElementById('root')?.childElementCount>0,{timeout:15000});
  await p.waitForTimeout(800);
  const nav = l => p.evaluate(l=>[...document.querySelectorAll('button')].find(b=>(b.textContent||'').trim()===l)?.click(), l);
  await nav('Memories'); await p.waitForTimeout(1200);
  await p.evaluate(()=>[...document.querySelectorAll('button')].find(b=>b.textContent.trim()==='TIMELINE')?.click()); // sub-tab labels ARE uppercase literals
  await p.waitForTimeout(900);
  const txt = await p.evaluate(()=>document.body.innerText);
  console.log('SETS YOU WATCHED present:', /SETS YOU WATCHED/.test(txt), '| errors:', errs.length);
  await p.screenshot({path:'/tmp/pw.png'});  // then Read /tmp/pw.png and LOOK
  await b.close();
})().catch(e=>{console.error('HARNESS ERR:',e.message);process.exit(1);});
```
Note: in-Memories lens tabs (`WALL`/`TIMELINE`) are literal-uppercase strings in
source, so they match exact-case; only the bottom-nav labels are CSS-uppercased.
