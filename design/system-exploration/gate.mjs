// Design gate for the exploration mocks. A direction passes only when every
// check below is 0 on every screen. It measures the RENDERED pages (headless
// Chrome at the App Store 6.9" point size), not the source.
//   node design/system-exploration/gate.mjs [dir...]
// Checks, per screen:
//   G1 page errors          none
//   G2 fonts                every declared family actually loaded
//   G3 images               every <img> and photo background decoded
//   G4 clipped text         no text box cut off by its container (ellipsis is allowed)
//   G5 escaped text         no text past the phone's edges (data-bleed opts out)
//   G6 colliding text       no two text boxes overlap
//   G7 min type             HTML text ≥ 11px; SVG diagram labels ≥ 9px
//   G8 tap targets          buttons and tabs ≥ 44px tall, chips ≥ 32px
//   G9 token contrast       every declared pair meets its floor (4.5, or 3 when marked large)
//   G10 broken labels       a short label (≤ 24 chars, no <br>) never wraps, and no text leaves a widow
import { chromium } from "playwright";
import { fileURLToPath } from "node:url";
import path from "node:path";
import fs from "node:fs";
const here = path.dirname(fileURLToPath(import.meta.url));
const dirs = process.argv.slice(2).length ? process.argv.slice(2) : ["laser", "holo", "headliner"];
const browser = await chromium.launch({ channel: "chrome" });
let total = 0;
for (const d of dirs) {
  const page = await browser.newPage({ viewport: { width: 560, height: 1040 } });
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("file://" + path.join(here, d, "index.html") + "#render");
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(700);
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
  if (res.fonts.length) fails.push(`G2 fonts not loaded: ${res.fonts.join(", ")}`);
  res.contrast.forEach((c) => fails.push(`G9 ${c}`));
  for (const s of res.screens) {
    const add = (g, arr) => [...new Set(arr)].forEach((x) => fails.push(`${g} [${s.key}] ${x}`));
    add("G3 image", s.images); add("G4 clipped", s.clipped); add("G5 escaped", s.escaped); add("G6 collide", s.collide); add("G7 small", s.small); add("G8 target", s.targets); add("G10 wraps", s.wraps);
  }
  total += fails.length;
  console.log(`${fails.length ? "✗" : "✓"} ${d}: ${res.screens.length} screens, ${fails.length} failures`);
  fails.forEach((x) => console.log("   " + x));
  await page.close();
}
await browser.close();
process.exit(total ? 1 : 0);
