// Design gate for the exploration mocks. A direction passes only when every
// check below is 0 on every screen. It measures the RENDERED pages (headless
// Chrome at the App Store 6.9" point size), not the source.
//   node design/system-exploration/gate.mjs [dir...]
// Checks, per screen:
//   G1 page errors          none, and the page decodes as UTF-8
//   G2 fonts                every declared family actually loaded
//   G3 images               every <img> and photo background decoded
//   G4 clipped text         no text box cut off by its container, or running past its own border/fill (ellipsis is allowed)
//   G5 escaped text         no text past the phone's edges (data-bleed opts out)
//   G6 colliding text       no two text boxes overlap
//   G7 min type             HTML text ≥ 11px; SVG diagram labels ≥ 9px
//   G8 tap targets          buttons and tabs ≥ 44px tall, chips ≥ 32px
//   G9 token contrast       every declared pair meets its floor (4.5, or 3 when marked large)
//   G10 broken labels       a short label (≤ 24 chars, no <br>) never wraps, and no text leaves a widow
// With no arguments it runs THE APPEARANCE GATE on live/: G1–G10 on every
// screen in Dark and in Light (each loaded in one mode, then toggled in place
// to the other), plus
//   G11 appearance rules    Dark by default; no choice follows the iPhone; a pick in Me wins, sticks, and System hands back
//   G12 mode leak           a screen toggled into a mode is pixel-identical to the same screen loaded in it
// Named directions (node gate.mjs laser holo) run G1–G10 on those pages only.
import { chromium } from "playwright";
import { fileURLToPath } from "node:url";
import path from "node:path";
import fs from "node:fs";
const here = path.dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const browser = await chromium.launch({ channel: "chrome" });
let total = 0;
const report = (name, fails, n, unit = "screens") => { total += fails.length; console.log(`${fails.length ? "✗" : "✓"} ${name}: ${n} ${unit}, ${fails.length} failures`); fails.forEach((x) => console.log("   " + x)); };

// G1–G10 on every .screen-wrap of an already-loaded page.
async function measure(page, errors) {
  const res = await page.evaluate(async () => {
    const out = { fonts: [], screens: [], contrast: [] };
    // G2 — every family the tokens declare (first name in the stack) must load
    for (const [k, f] of Object.entries(TOKENS.fonts)) {
      const fam = f.stack.split(",")[0].trim().replace(/['"]/g, "");
      if (/apple-system|SF Pro/.test(fam)) continue;
      const ok = document.fonts.check(`16px "${fam}"`) && [...document.fonts].some((ff) => ff.family.replace(/['"]/g, "") === fam && ff.status === "loaded");
      if (!ok) out.fonts.push(fam);
    }
    // G9 — declared contrast pairs
    for (const [fg, bg, use] of TOKENS.contrastPairs || []) {
      const r = contrastOf(fg, bg), floor = /display|large|≥ ?24/i.test(use || "") ? 3 : 4.5;
      if (r < floor) out.contrast.push(`${fg} on ${bg} = ${r.toFixed(2)} < ${floor} (${use})`);
    }
    const bgUrls = (el) => { const m = getComputedStyle(el).backgroundImage.match(/url\("?([^")]+)"?\)/g) || []; return m.map((u) => u.replace(/^url\("?|"?\)$/g, "")); };
    const load = (src) => new Promise((r) => { const i = new Image(); i.onload = () => r(i.naturalWidth > 0); i.onerror = () => r(false); i.src = src; });
    for (const wrap of document.querySelectorAll(".screen-wrap")) {
      // elementFromPoint only sees the viewport: measure each phone in view,
      // or every check below silently skips whatever is off-screen.
      wrap.querySelector(".phone").scrollIntoView({ block: "start" });
      const key = wrap.dataset.screen, ph = wrap.querySelector(".phone"), P = ph.getBoundingClientRect();
      const f = { key, images: [], clipped: [], escaped: [], collide: [], small: [], targets: [], wraps: [] };
      // G3
      for (const img of ph.querySelectorAll("img")) if (!(img.complete && img.naturalWidth > 0)) f.images.push(img.getAttribute("src"));
      for (const el of ph.querySelectorAll("*")) for (const u of bgUrls(el)) if (!u.startsWith("data:") && !(await load(u))) f.images.push(u);
      // text leaves: elements with their own non-empty text node
      const leaves = [...ph.querySelectorAll("*")].filter((el) => !el.closest("svg") && [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim()) && getComputedStyle(el).visibility !== "hidden");
      const inStatus = (el) => el.getBoundingClientRect().top < P.top + 54;
      const isScroll = (a) => a.classList.contains("body") || a.hasAttribute("data-scroll");
      const isScrollX = (a) => a.hasAttribute("data-scroll-x");   // horizontal scroller: side cuts just scroll
      const label = (el) => (el.textContent || "").trim().replace(/\s+/g, " ").slice(0, 36);
      // Per-line INK boxes: a line box is taller than its glyphs (tight display
      // leading makes line boxes overlap while the letters don't), so keep the
      // cap-height band (±0.36em around each line's centre).
      const inkLines = (el, fsz) => { const rg = document.createRange(); rg.selectNodeContents(el); return [...rg.getClientRects()].filter((r) => r.width > 0.5 && r.height > 0.5).map((r) => { const c = (r.top + r.bottom) / 2, h = 0.36 * fsz; return { left: r.left, right: r.right, top: c - h, bottom: c + h }; }); };
      const inter = (a, b) => ({ left: Math.max(a.left, b.left), right: Math.min(a.right, b.right), top: Math.max(a.top, b.top), bottom: Math.min(a.bottom, b.bottom) });
      const empty = (r) => r.right - r.left <= 0.5 || r.bottom - r.top <= 0.5;
      // On top at this point, i.e. not under a sheet or the tab bar?
      const onTop = (el, x, y) => { const hit = document.elementFromPoint(x, y); return !!hit && (hit === el || el.contains(hit) || hit.contains(el)); };
      const rects = [];
      for (const el of leaves) {
        const cs = getComputedStyle(el), fsz = parseFloat(cs.fontSize);
        let lines = inkLines(el, fsz);
        if (!lines.length) continue;
        const ellipsis = cs.textOverflow === "ellipsis";
        let clipBox = { left: -1e9, right: 1e9, top: -1e9, bottom: 1e9 }, a = el, cut = false, ownsX = false;   // el itself can be the clipper
        const u = lines.reduce((m, r) => ({ left: Math.min(m.left, r.left), right: Math.max(m.right, r.right), top: Math.min(m.top, r.top), bottom: Math.max(m.bottom, r.bottom) }), { left: 1e9, right: -1e9, top: 1e9, bottom: -1e9 });
        while (a && a !== ph) {
          const acs = getComputedStyle(a);
          if (/(hidden|clip)/.test(acs.overflow + acs.overflowX + acs.overflowY)) {
            const R = a.getBoundingClientRect();
            // A scroll view scrolls VERTICALLY: text cut at its top/bottom just
            // scrolls, but text cut at its sides is a real defect.
            if (isScrollX(a)) { clipBox = inter(clipBox, { left: R.left, right: R.right, top: -1e9, bottom: 1e9 }); ownsX = true; }   // horizontal is now the scroller's job
            else if (isScroll(a)) { clipBox = inter(clipBox, { left: -1e9, right: 1e9, top: R.top, bottom: R.bottom }); if (!ownsX && !ellipsis && !el.closest("[data-bleed]") && (u.left < R.left - 1 || u.right > R.right + 1)) cut = true; }
            else if (!ellipsis && !el.closest("[data-bleed]") && ((!ownsX && (u.left < R.left - 1 || u.right > R.right + 1)) || u.top < R.top - 1 || u.bottom > R.bottom + 1)) cut = true;
          }
          a = a.parentElement;
        }
        // An ellipsised element shows only its own box: the Range still reports
        // the full un-truncated run, which is text nobody can see.
        if (ellipsis && /(hidden|clip)/.test(cs.overflow + cs.overflowX)) { const R = el.getBoundingClientRect(); clipBox = inter(clipBox, { left: R.left, right: R.right, top: -1e9, bottom: 1e9 }); }
        lines = lines.map((r) => inter(r, clipBox)).filter((r) => !empty(r));
        if (!lines.length) continue;                               // scrolled out of view
        const vis = lines.filter((r) => onTop(el, (r.left + r.right) / 2, (r.top + r.bottom) / 2));
        if (!vis.length) continue;                                 // covered by a sheet / bar
        if (cut) f.clipped.push(label(el));                        // G4
        // …or runs past its OWN drawn frame (a border or fill) without being clipped
        { const R = el.getBoundingClientRect(), framed = parseFloat(cs.borderLeftWidth) > 0 || !/rgba\(0, 0, 0, 0\)|transparent/.test(cs.backgroundColor);
          if (framed && !ellipsis && (u.right > R.right - parseFloat(cs.borderRightWidth) + 1 || u.left < R.left + parseFloat(cs.borderLeftWidth) - 1)) f.clipped.push(`${label(el)} (past its own frame)`); }
        if (!el.closest("[data-bleed]") && vis.some((r) => r.left < P.left - 1 || r.right > P.right + 1)) f.escaped.push(label(el)); // G5
        if (!inStatus(el) && fsz < 11) f.small.push(`${label(el)} (${cs.fontSize})`);          // G7
        // G10 — distinct line tops = rendered lines
        // count rendered lines: rects that overlap vertically are the same line
        const rawR = (() => { const rg = document.createRange(); rg.selectNodeContents(el); return [...rg.getClientRects()].filter((r) => r.width > 0.5 && r.height > 0.5).sort((x, y) => x.top - y.top); })();
        const groups = []; for (const r of rawR) { const g = groups[groups.length - 1]; if (g && r.top < g.bottom - 0.3 * Math.min(r.height, g.bottom - g.top)) { g.bottom = Math.max(g.bottom, r.bottom); g.left = Math.min(g.left, r.left); g.right = Math.max(g.right, r.right); } else groups.push({ top: r.top, bottom: r.bottom, left: r.left, right: r.right }); }
        const tops = { size: el.closest("[data-wrap]") ? 1 : groups.length };
        const txt = (el.textContent || "").trim();
        if (tops.size > 1 && txt.length <= 24 && !el.querySelector("br")) f.wraps.push(`"${label(el)}" on ${tops.size} lines`);
        // …and no widow: a wrapped last line that is a stub of the first
        const ln = groups; if (tops.size > 1 && !el.querySelector("br")) { const last = ln[ln.length - 1], wmax = Math.max(...ln.map((r) => r.right - r.left)); if (last.right - last.left < 0.2 * wmax && last.right - last.left < 60) f.wraps.push(`widow in "${label(el)}"`); }
        if (!el.closest("[data-bleed]")) rects.push({ el, lines: vis, t: label(el) });
      }
      for (const t of ph.querySelectorAll("svg text")) { const fs = parseFloat(t.getAttribute("font-size") || getComputedStyle(t).fontSize); if (fs < 9) f.small.push(`svg "${t.textContent.trim()}" (${fs}px)`); }
      // G6
      for (let i = 0; i < rects.length; i++) for (let j = i + 1; j < rects.length; j++) {
        const A = rects[i], B = rects[j];
        if (A.el.contains(B.el) || B.el.contains(A.el)) continue;
        if (A.lines.some((ra) => B.lines.some((rb) => { const x = inter(ra, rb); return x.right - x.left > 1.5 && x.bottom - x.top > 1.5; }))) f.collide.push(`"${A.t}" × "${B.t}"`);
      }
      // G8
      for (const el of ph.querySelectorAll(".btn,.tab")) { const h = el.getBoundingClientRect().height; if (h < 44) f.targets.push(`${el.className} "${label(el)}" ${h.toFixed(0)}px`); }
      for (const el of ph.querySelectorAll(".chip,.bead,.toggle")) { const h = el.getBoundingClientRect().height; if (h < 32) f.targets.push(`${el.className} "${label(el)}" ${h.toFixed(0)}px`); }
      out.screens.push(f);
    }
    return out;
  });
  const fails = [];
  if (errors.length) fails.push(`G1 page errors: ${errors.join(" | ")}`);
  // Declared, not sniffed: without <meta charset> Chrome guesses per load, so
  // the same file passes one run and shows "TiÃ«sto" the next.
  const cs = await page.evaluate(() => (document.querySelector("meta[charset]") ? document.characterSet : "an undeclared charset"));
  if (cs !== "UTF-8") fails.push(`G1 page decoded as ${cs}, not UTF-8: every "·" and accented name becomes mojibake (add <meta charset="utf-8">)`);
  if (res.fonts.length) fails.push(`G2 fonts not loaded: ${res.fonts.join(", ")}`);
  res.contrast.forEach((c) => fails.push(`G9 ${c}`));
  for (const s of res.screens) {
    const add = (g, arr) => [...new Set(arr)].forEach((x) => fails.push(`${g} [${s.key}] ${x}`));
    add("G3 image", s.images); add("G4 clipped", s.clipped); add("G5 escaped", s.escaped); add("G6 collide", s.collide); add("G7 small", s.small); add("G8 target", s.targets); add("G10 wraps", s.wraps);
  }
  return { fails, n: res.screens.length };
}
async function open(ctx, url) {
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(url);
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(700);
  return { page, errors };
}
// Pixels that differ by more than 96/255 on any channel. Two renders of the
// same screen differ only by antialiasing (measured ≤ 37/255); a colour left
// over from the other mode differs by 150+.
let cmpPage;
async function diffPx(a, b) {
  cmpPage ||= await browser.newPage();
  return cmpPage.evaluate(async ([a, b]) => {
    const im = (s) => new Promise((r) => { const i = new Image(); i.onload = () => r(i); i.src = "data:image/png;base64," + s; });
    const px = (i) => { const k = document.createElement("canvas"); k.width = i.width; k.height = i.height; const g = k.getContext("2d"); g.drawImage(i, 0, 0); return g.getImageData(0, 0, i.width, i.height).data; };
    const [i1, i2] = [await im(a), await im(b)];
    if (i1.width !== i2.width || i1.height !== i2.height) return 1e9;
    const [d1, d2] = [px(i1), px(i2)]; let n = 0;
    for (let p = 0; p < d1.length; p += 4) if (Math.max(Math.abs(d1[p] - d2[p]), Math.abs(d1[p + 1] - d2[p + 1]), Math.abs(d1[p + 2] - d2[p + 2])) > 96) n++;
    return n;
  }, [a.toString("base64"), b.toString("base64")]);
}
const file = (d, q = "") => "file://" + path.join(here, d, "index.html") + q + "#render";

if (args.length) {   // named direction pages, as before
  const ctx = await browser.newContext({ viewport: { width: 560, height: 1040 } });
  for (const d of args) { const { page, errors } = await open(ctx, file(d)); const r = await measure(page, errors); report(d, r.fails, r.n); await page.close(); }
} else {
  // THE APPEARANCE GATE: every screen in BOTH modes, reached the way a user
  // reaches them — the page loads in one mode and the toggle switches it in
  // place — so a mode-specific break fails here.
  for (const [first, second] of [["dark", "light"], ["light", "dark"]]) {
    const ctx = await browser.newContext({ viewport: { width: 560, height: 1040 }, colorScheme: first });
    const { page, errors } = await open(ctx, file("live", "?board"));
    const on = await page.evaluate(() => document.documentElement.dataset.mode);
    if (on !== first) report(`load ${first}`, [`G11 iPhone ${first} with no choice opened ${on}`], 0);
    let r = await measure(page, errors); report(`${first} (loaded)`, r.fails, r.n);
    await page.evaluate((m) => APPEARANCE.set(m), second);
    await page.waitForTimeout(300);
    r = await measure(page, errors); report(`${second} (toggled from ${first})`, r.fails, r.n);
    // G12 mode leak: a screen toggled into a mode must be pixel-identical to
    // the same screen loaded fresh in that mode. Anything drawn with a
    // literal colour instead of a token stays behind and shows up here.
    const fresh = await open(ctx, file("live", `?board&mode=${second}`));
    const leak = [];
    for (const key of await page.$$eval(".screen-wrap", (w) => w.map((x) => x.dataset.screen))) {
      const shot = async (pg) => { const el = await pg.$(`.screen-wrap[data-screen="${key}"] .phone`); await el.scrollIntoViewIfNeeded(); return el.screenshot({ animations: "disabled" }); };
      const [x, y] = [await shot(page), await shot(fresh.page)];
      const n = await diffPx(x, y);
      if (n >= 20) leak.push(`G12 leak [${key}] toggled into ${second}: ${n} px differ by >96/255 from a fresh ${second} load`);
    }
    report(`${second} leak check`, leak, 7);
    await ctx.close();
  }
  // G11 appearance rules, on the interactive page.
  const g11 = [];
  const scen = async (scheme, pre, expect, why) => {
    const ctx = await browser.newContext({ viewport: { width: 1000, height: 1100 }, colorScheme: scheme });
    if (pre) await ctx.addInitScript((v) => { try { localStorage.setItem("plursky.appearance", v); } catch {} }, pre);
    const { page } = await open(ctx, "file://" + path.join(here, "live", "index.html"));
    const got = await page.evaluate(() => document.documentElement.dataset.mode);
    if (got !== expect) g11.push(`G11 ${why}: expected ${expect}, got ${got}`);
    return { ctx, page };
  };
  (await scen("no-preference", null, "dark", "no choice, no iPhone signal → Dark default")).ctx.close();
  (await scen("dark", null, "dark", "no choice, iPhone Dark")).ctx.close();
  (await scen("light", null, "light", "no choice, iPhone Light")).ctx.close();
  (await scen("light", "dark", "dark", "picked Dark, iPhone Light")).ctx.close();
  (await scen("dark", "light", "light", "picked Light, iPhone Dark")).ctx.close();
  { // the pick is made in Me, survives a reload, and ignores later iPhone changes
    const { ctx, page } = await scen("dark", null, "dark", "fresh install on a dark iPhone");
    await page.click("#go [data-k=me]"); await page.click("#one .toggle[data-v=light]");
    if (await page.evaluate(() => document.documentElement.dataset.mode) !== "light") g11.push("G11 tapping Light in Me did not switch");
    await page.emulateMedia({ colorScheme: "dark" }); await page.reload(); await page.waitForTimeout(400);
    if (await page.evaluate(() => document.documentElement.dataset.mode) !== "light") g11.push("G11 the Light pick did not survive a reload on a dark iPhone");
    await page.emulateMedia({ colorScheme: "light" }); await page.emulateMedia({ colorScheme: "dark" }); await page.waitForTimeout(200);
    if (await page.evaluate(() => document.documentElement.dataset.mode) !== "light") g11.push("G11 an iPhone change overrode the stored pick");
    await page.click("#go [data-k=me]"); await page.click("#one .toggle[data-v=system]");
    if (await page.evaluate(() => document.documentElement.dataset.mode) !== "dark") g11.push("G11 choosing System did not hand control back to the iPhone");
    await page.emulateMedia({ colorScheme: "light" }); await page.waitForTimeout(200);
    if (await page.evaluate(() => document.documentElement.dataset.mode) !== "light") g11.push("G11 on System, flipping the iPhone to Light did not follow live");
    await ctx.close();
  }
  report("appearance rules (G11)", g11, 11, "checks");
}
await browser.close();
process.exit(total ? 1 : 0);
