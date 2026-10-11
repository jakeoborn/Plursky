// Evidence the Night Print review asks for, read from a mounted page:
//   - fonts: the platform font Chrome actually rasterised each sampled node with
//     (CDP CSS.getPlatformFontsForNode), beside the computed family. A declared
//     face that failed to load shows up here as the fallback, which a computed
//     style alone would hide.
//   - faces: every act face on the sheet, with where its image came from
//     (the reviewed ledger, a transient platform photo, or initials).
//   - pairs: every b2b pair on the sheet, with the two faces' boxes.
// Shared by the gate (asserts) and the capture (writes evidence.json).

export const FONT_SAMPLES = [
  // selector, the face it must render with
  ['.np-word > span:not(.np-roman), .np-strip-word', 'Anton'], // the Roman numeral is set in a serif by design
  ['.np-claim > span, .np-claim', 'Anton'],
  ['.np-jt > span', 'Anton'],
  ['.np-mono', 'Space Grotesk'],
  ['.np-j p', 'Space Grotesk'],
  ['[data-duo-stages] .duo-name, [data-duo-plan] .duo-name, [data-np-saved] .duo-name', 'Space Grotesk'],
  ['.np-link > *:first-child', 'Space Grotesk'],
  ['.np-act > span', 'Space Grotesk'],
  ['.np-cut > b, .np-cut', 'Space Grotesk'],
];

export async function fontEvidence(page) {
  await page.evaluate(() => document.fonts.ready);
  const loaded = await page.evaluate(() => ({
    anton: document.fonts.check('400 20px Anton'),
    grotesk: document.fonts.check('500 12px "Space Grotesk"'),
    faces: [...document.fonts].filter(f => /Anton|Space Grotesk/.test(f.family)).map(f => `${f.family} ${f.weight} ${f.status}`),
  }));
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('DOM.enable'); await cdp.send('CSS.enable');
  const { root } = await cdp.send('DOM.getDocument', { depth: 0 });
  const samples = [];
  for (const [sel, want] of FONT_SAMPLES) {
    // The first visible match that carries a letter (an arrow glyph alone says nothing about the face).
    const idx = await page.evaluate(sel => [...document.querySelectorAll(sel)].findIndex(el => el.getClientRects().length > 0 && /[A-Za-z0-9]/.test(el.textContent)), sel);
    if (idx < 0) { samples.push({ sel, want, absent: true }); continue; }
    const { nodeIds } = await cdp.send('DOM.querySelectorAll', { nodeId: root.nodeId, selector: sel });
    const nodeId = nodeIds[idx];
    const { fonts } = await cdp.send('CSS.getPlatformFontsForNode', { nodeId });
    const computed = await page.evaluate(([sel, i]) => getComputedStyle(document.querySelectorAll(sel)[i]).fontFamily, [sel, idx]);
    const text = await page.evaluate(([sel, i]) => document.querySelectorAll(sel)[i].textContent.trim().slice(0, 24), [sel, idx]);
    const top = [...fonts].sort((a, b) => b.glyphCount - a.glyphCount)[0] || null;
    // A variable face reports its nearest named instance ("Space Grotesk Light"): the family is the prefix.
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
    const img = el.querySelector('img'); const name = el.dataset.face; const row = ledger[name.trim().toLowerCase()] || null;
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
