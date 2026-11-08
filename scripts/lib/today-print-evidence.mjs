// Evidence for the Today print and the artist hero under the approved
// Sora + chalk/charcoal direction (spec claude-plur-sora-palette-20261012),
// read from a mounted page:
//   - fonts: the platform font Chrome actually rasterised each sampled node
//     with (CDP CSS.getPlatformFontsForNode) beside the computed family. A
//     declared face that failed to load shows up here as its fallback, which
//     a computed style alone would hide.
//   - faces: every act face on the sheet and where its image came from (the
//     reviewed ledger, a transient platform photo, or initials); b2b pairs.
//   - ledgerActs: every ledger portrait that a reachable lineup can show,
//     including each half of a b2b billing.
//   - heroEvidence: the artist hero's labels against the pixels really behind
//     them, plus the name's type, the backing's colour, the schedule line and
//     the visible credit.
// Shared by the gate (asserts) and the capture (writes evidence.json).

export const PRINT_FONT_SAMPLES = [
  // selector, the face it must render with
  ['.np-word > span:not(.np-roman), .np-strip-word', 'Sora'], // the Roman numeral is set in a serif by design
  ['.np-claim > span, .np-claim', 'Sora'],
  ['.np-jt > span', 'Sora'],
  ['.np-mono', 'Sora'],
  ['.np-j p', 'Sora'],
  ['[data-duo-stages] .duo-name, [data-duo-plan] .duo-name, [data-np-saved] .duo-name', 'Sora'],
  ['.np-link > *:first-child', 'Sora'],
  ['.np-act > span', 'Sora'],
  ['.np-cut > b, .np-cut', 'Sora'],
];
export const HERO_FONT_SAMPLES = [
  ['[data-artist-hero-name]', 'Sora'],
  ['[data-screen="artist"] .duo-clock', 'Sora'],
  ['[data-artist-hero-label="day"]', 'Sora'],
];

export async function fontEvidence(page, samplesWanted = PRINT_FONT_SAMPLES) {
  await page.evaluate(() => document.fonts.ready);
  const loaded = await page.evaluate(() => ({
    sora: document.fonts.check('600 20px Sora') && document.fonts.check('500 12px Sora') && document.fonts.check('400 14px Sora'),
    faces: [...document.fonts].filter(f => /Sora/.test(f.family)).map(f => `${f.family} ${f.weight} ${f.status}`),
  }));
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('DOM.enable'); await cdp.send('CSS.enable');
  const { root } = await cdp.send('DOM.getDocument', { depth: 0 });
  const samples = [];
  for (const [sel, want] of samplesWanted) {
    // The first visible match that carries a letter (an arrow glyph alone says nothing about the face).
    const idx = await page.evaluate(sel => [...document.querySelectorAll(sel)].findIndex(el => el.getClientRects().length > 0 && /[A-Za-z0-9]/.test(el.textContent)), sel);
    if (idx < 0) { samples.push({ sel, want, absent: true }); continue; }
    const { nodeIds } = await cdp.send('DOM.querySelectorAll', { nodeId: root.nodeId, selector: sel });
    const nodeId = nodeIds[idx];
    const { fonts } = await cdp.send('CSS.getPlatformFontsForNode', { nodeId });
    const computed = await page.evaluate(([sel, i]) => getComputedStyle(document.querySelectorAll(sel)[i]).fontFamily, [sel, idx]);
    const text = await page.evaluate(([sel, i]) => document.querySelectorAll(sel)[i].textContent.trim().slice(0, 24), [sel, idx]);
    const top = [...fonts].sort((a, b) => b.glyphCount - a.glyphCount)[0] || null;
    // A variable face reports its nearest named instance ("Sora SemiBold"): the family is the prefix.
    samples.push({ sel, want, text, computed, rendered: top ? top.familyName : null, ok: !!top && top.familyName.startsWith(want) && !!top.isCustomFont, custom: top ? !!top.isCustomFont : false,
      fonts: fonts.map(f => `${f.familyName}:${f.glyphCount}${f.isCustomFont ? '' : ' (system)'}`) });
  }
  await cdp.detach();
  return { loaded, samples };
}

export const faceEvidence = (page) => page.evaluate(() => {
  const ledger = window.PLURSKY_ARTIST_PHOTOS || {};
  const np = document.querySelector('[data-night-print]') || document;
  const vis = el => el.getClientRects().length > 0;
  const faces = [...np.querySelectorAll('.duo-av[data-face]')].filter(vis).map(el => {
    const img = el.querySelector('img'); const name = el.dataset.face; const row = ledger[window.PlurskyArtistKey.artistKey(name)] || null;
    const r = el.getBoundingClientRect(); const ir = img && img.getBoundingClientRect();
    const box = q => [Math.round(q.left), Math.round(q.top), Math.round(q.width), Math.round(q.height)];
    return { name, source: el.dataset.photoSource || '', src: img ? img.getAttribute('src') : null, rect: box(r), imgRect: ir ? box(ir) : null,
      // the portrait sits inside its face: same box within 1px (a face that loses its containing block lets the img spill over the pair)
      imgFits: !ir || ['left', 'top', 'width', 'height'].every(k => Math.abs(ir[k] - r[k]) <= 1),
      loaded: !!img && img.complete && img.naturalWidth > 0, ledger: row ? { asset: row.url, author: row.author, license: row.license, sourceUrl: row.sourceUrl } : null };
  });
  const pairs = [...np.querySelectorAll('.duo-avp[data-pair]')].filter(vis).map(p => {
    const [a, b] = [...p.querySelectorAll('.duo-av')].map(el => el.getBoundingClientRect());
    const row = p.closest('button, [data-duo-plan], .duo-hair') || p.parentElement;
    const nameEl = row && row.querySelector('.duo-name');
    const overlap = a && b ? Math.max(0, Math.min(a.right, b.right) - Math.max(a.left, b.left)) * Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top)) : 0;
    return { name: p.dataset.pair, a: a && [Math.round(a.left), Math.round(a.top), Math.round(a.width), Math.round(a.height)], b: b && [Math.round(b.left), Math.round(b.top), Math.round(b.width), Math.round(b.height)],
      overlap, offscreen: !!(a && b) && (a.left < -1 || b.right > innerWidth + 1),
      nameText: nameEl ? nameEl.textContent.trim() : null,
      nameClipped: !!nameEl && (nameEl.scrollWidth > nameEl.clientWidth + 1 || getComputedStyle(nameEl).textOverflow === 'ellipsis' && nameEl.scrollWidth > nameEl.clientWidth) };
  });
  return { faces, pairs };
});

// Every ledger portrait a reachable lineup can show: solo acts by name, and
// each half of a b2b billing (the artist screen shows one half at a time).
// Read from the data sets, not a hand list, so a new ledger row is measured
// the moment it lands.
export const ledgerActs = (page) => page.evaluate(() => {
  const sets = typeof _DATA_SETS !== 'undefined' ? _DATA_SETS : {};
  const led = window.PLURSKY_ARTIST_PHOTOS || {};
  const key = (n) => window.PlurskyArtistKey.artistKey(String(n || ''));   // the app's own lookup key (data/artist-key.js)
  // A gated festival refuses the artist deep link, so its hero is unreachable for a user too.
  const reg = window.FESTIVALS_REGISTRY || [];
  const reachable = (fid) => { const e = reg.find(x => x && x.config && x.config.id === fid); return !!e && typeof festivalCanBeActive === 'function' && festivalCanBeActive(e); };
  const out = [];
  for (const [fid, set] of Object.entries(sets)) {
    if (!reachable(fid)) continue;
    for (const a of (set.artists || [])) {
      if (!a || !a.name) continue;
      const parts = String(a.name).split(/\s+b2b\s+/i);
      parts.forEach((half, part) => { const row = led[key(half)]; if (row) out.push({ fid, id: a.id, billing: a.name, name: half.trim(), part, parts: parts.length, asset: row.asset }); });
    }
  }
  return { acts: out, ledgerNames: Object.values(led).map(r => r.artist) };
});

// The artist hero under the approved direction. The labels (back, day, genre,
// stage, name) are measured against what is really behind each one: the text
// is hidden, the viewport is shot, and the mean colour under the label's box
// is the ground, backings included. Alongside: the name's type (Sora 600,
// 40px solo / 32px b2b, no text shadow), the backing colour (the neutral
// shade, never a violet cast), the schedule range on one line at its size,
// and the visible photo credit. `cmp` is any page that can draw the shot on
// a canvas.
export async function heroEvidence(page, cmp) {
  const meta = await page.evaluate(() => {
    const hero = document.querySelector('[data-artist-hero]'); if (!hero) return null;
    const parse = (c) => { const m = String(c).match(/rgba?\(([^)]+)\)/); if (!m) return null; const p = m[1].split(/[\s,/]+/).filter(Boolean).map(Number); return [p[0], p[1], p[2], p.length > 3 ? p[3] : 1]; };
    const boxes = [];
    const name = hero.querySelector('[data-artist-hero-name]');
    const ncs = name && getComputedStyle(name);
    const back = hero.querySelector('[data-artist-hero-label="back"]');
    const bcs = back && getComputedStyle(back);
    const clock = document.querySelector('[data-screen="artist"] .duo-clock');
    const ccs = clock && getComputedStyle(clock);
    const credit = document.querySelector('[data-artist-photo-credit]');
    const type = {
      name: name ? { px: parseFloat(ncs.fontSize), weight: parseInt(ncs.fontWeight, 10), family: ncs.fontFamily, shadow: ncs.textShadow, color: ncs.color, lines: Math.round(name.getBoundingClientRect().height / parseFloat(ncs.lineHeight)), clipped: name.scrollWidth > name.clientWidth + 1, fitted: name.dataset.fitSet != null } : null,
      backing: back ? { bg: bcs.backgroundColor, rgba: parse(bcs.backgroundColor), ink: bcs.color } : null,
      shadeVar: getComputedStyle(hero).getPropertyValue('--shade-rgb').trim(),
      clock: clock ? { px: parseFloat(ccs.fontSize), family: ccs.fontFamily, text: clock.textContent.trim(), lines: Math.round(clock.getBoundingClientRect().height / (parseFloat(ccs.lineHeight) || parseFloat(ccs.fontSize) * 1.2)), clipped: clock.scrollWidth > clock.clientWidth + 1 } : null,
      credit: credit ? credit.textContent.replace(/\s+/g, ' ').trim() : null,
    };
    for (const el of hero.querySelectorAll('[data-artist-hero-label]')) {
      const r = el.getBoundingClientRect(); if (r.width < 2 || r.height < 2) continue;
      // getComputedStyle is live: read the colour BEFORE the text is hidden, or the ink measures transparent.
      const cs = getComputedStyle(el); const color = cs.color, op = +cs.opacity, px = parseFloat(cs.fontSize), bold = parseInt(cs.fontWeight, 10) >= 700;
      el.dataset.heroMedia = '1'; el.dataset.heroColor = el.style.color || ''; el.dataset.heroShadow = el.style.textShadow || '';
      el.style.setProperty('color', 'transparent', 'important'); el.style.setProperty('text-shadow', 'none', 'important');
      boxes.push({ label: el.dataset.artistHeroLabel, text: el.textContent.trim().slice(0, 30), x: r.left, y: r.top, w: r.width, h: r.height,
        color, op, px, floor: (px >= 24 || (px >= 18.66 && bold)) ? 3 : 4.5 });
    }
    return { kind: hero.dataset.artistHero, bgImage: getComputedStyle(hero.firstElementChild).backgroundImage, boxes, vw: innerWidth, type };
  });
  if (!meta) return null;
  const png = await page.screenshot({ animations: 'disabled' });
  await page.evaluate(() => { for (const el of document.querySelectorAll('[data-hero-media]')) {
    el.style.removeProperty('color'); el.style.removeProperty('text-shadow');
    if (el.dataset.heroColor) el.style.color = el.dataset.heroColor; if (el.dataset.heroShadow) el.style.textShadow = el.dataset.heroShadow;
    delete el.dataset.heroMedia; delete el.dataset.heroColor; delete el.dataset.heroShadow; } });
  const labels = await cmp.evaluate(async ([b64, boxes, vw]) => {
    const im = await new Promise(r => { const i = new Image(); i.onload = () => r(i); i.src = 'data:image/png;base64,' + b64; });
    const k = document.createElement('canvas'); k.width = im.width; k.height = im.height; const g = k.getContext('2d'); g.drawImage(im, 0, 0);
    const sx = im.width / vw;
    const lum = (c) => c.map(v => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }).reduce((t, v, j) => t + v * [0.2126, 0.7152, 0.0722][j], 0);
    return boxes.map(b => {
      const d = g.getImageData(Math.round(b.x * sx), Math.round(b.y * sx), Math.max(1, Math.round(b.w * sx)), Math.max(1, Math.round(b.h * sx))).data;
      let R = 0, G = 0, B = 0, n = 0; for (let q = 0; q < d.length; q += 4) { R += d[q]; G += d[q + 1]; B += d[q + 2]; n++; }
      const bg = [R / n, G / n, B / n];
      const m = b.color.match(/rgba?\(([^)]+)\)/); const p = m ? m[1].split(/[\s,/]+/).filter(Boolean).map(Number) : [255, 255, 255];
      const a = (p.length > 3 ? p[3] : 1) * b.op;
      const fg = [0, 1, 2].map(j => p[j] * a + bg[j] * (1 - a));
      const [x, y] = [lum(fg), lum(bg)].sort((u, v) => v - u);
      return { label: b.label, text: b.text, px: b.px, floor: b.floor, ratio: +(((x + 0.05) / (y + 0.05)).toFixed(2)), bg: bg.map(Math.round) };
    });
  }, [png.toString('base64'), meta.boxes, meta.vw]);
  return { kind: meta.kind, bgImage: meta.bgImage, labels, type: meta.type };
}
