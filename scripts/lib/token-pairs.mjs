// Static half of the appearance gate: every inline style object that pairs a
// fill token (`background: "var(--x)"`) with a text token (`color: "var(--y)"`)
// must meet WCAG AA in BOTH modes. The live gate only measures what a screen
// shows by default; this also covers sheets, banners and toasts that open on
// a tap or a condition (the Map's signal buttons, the install banner).
import { readFileSync } from 'node:fs';

// A mode's tokens are the plain `:root{…}` blocks (where the board's role
// names alias the legacy ones: --s2:var(--paper-2), --ink-2:var(--text-2),
// --acc:var(--signal)) overlaid by EVERY `:root[data-mode="…"]` block, in
// source order. Reading only the first mode block, as this did, resolved no
// board token at all, so every pair written in board tokens was skipped as
// "not a flat colour" and the static check never saw it.
export function modeTokens(html) {
  const blocks = (sel) => {
    const t = {}; let i = 0;
    while ((i = html.indexOf(sel, i)) !== -1) {
      const o = html.indexOf('{', i), j = html.indexOf('}', o);
      for (const [, k, v] of html.slice(o + 1, j).matchAll(/--([a-z0-9-]+):\s*([^;]+);/g)) t[k] = v.trim();
      i = j;
    }
    return t;
  };
  const base = blocks(':root{');
  return { dark: { ...base, ...blocks(':root[data-mode="dark"]') }, light: { ...base, ...blocks(':root[data-mode="light"]') } };
}

// The board's classes carry a fill or a text colour of their own, so an
// element written `className="duo-card"` with a colour, or
// `className="duo-card duo-ink2"`, is a fill/text pair the style object alone
// does not show. (Order matters only for fills: the first fill class wins.)
const CLASS_FILL = { 'duo-card': 's2', 'duo-well': 's3', 'duo-input': 's2' };
const CLASS_TEXT = { 'duo-ink2': 'ink-2', 'duo-ink3': 'ink-3', 'duo-acc': 'acc-ink', 'duo-clash': 'clash', 'duo-sun': 'sun' };
const PRI = { bg: 'acc', fg: 'on-acc' };   // .duo-btn.pri

const lum = (h) => {
  const c = [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16) / 255).map(v => v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
};
export const contrast = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };

// The static className on the element that owns a style object at `at`
// (searched back to the tag's opening `<`), or "".
function classesBefore(src, at) {
  const lt = src.lastIndexOf('<', at);
  const m = src.slice(lt, at).match(/className="([^"]*)"/);
  return m ? m[1].split(/\s+/) : [];
}

// Every `style={{ … }}` object in a file, with its line, fill token and text
// token; plus every board-class element whose classes alone make a pair.
export function stylePairs(file, src = readFileSync(file, 'utf8')) {
  const out = [], re = /style=\{\{/g; let m;
  while ((m = re.exec(src))) {
    let i = m.index + 8, d = 1;
    for (; i < src.length && d; i++) { if (src[i] === '{') d++; else if (src[i] === '}') d--; }
    const obj = src.slice(m.index + 8, i - 1);
    const cls = classesBefore(src, m.index);
    const cFill = cls.includes('pri') && cls.includes('duo-btn') ? PRI.bg : cls.map(c => CLASS_FILL[c]).find(Boolean);
    const cText = cls.includes('pri') && cls.includes('duo-btn') ? PRI.fg : cls.map(c => CLASS_TEXT[c]).find(Boolean);
    const fgM = obj.match(/(?:^|[\s,{])color:\s*"var\(--([a-z0-9-]+)\)"/);
    const bgM = obj.match(/(?:^|[\s,{])background(?:Color)?:\s*"var\(--([a-z0-9-]+)\)"/);
    const fg = fgM || (cText ? [null, cText] : null);
    const hasOwnBg = /(?:^|[\s,{])background(?:Color|Image)?:/.test(obj);
    const bg = bgM || (!hasOwnBg && cFill ? [null, cFill] : null);
    // A gradient is judged by every token stop: text has to read on each end.
    const gr = obj.match(/(?:^|[\s,{])background(?:Image)?:\s*"(?:linear|radial)-gradient\(([^"]*)\)"/);
    const stops = bg ? [bg[1]] : gr ? [...gr[1].matchAll(/var\(--([a-z0-9-]+)\)/g)].map(x => x[1]).filter(k => !/-rgb$/.test(k)) : [];
    const line = src.slice(0, m.index).split('\n').length;
    if (fg) for (const k of new Set(stops)) out.push({ at: `${file}:${line}`, bg: k, fg: fg[1] });
  }
  // Elements with no style object at all: the classes are the whole pair.
  const ce = /className="([^"]*)"/g; let c;
  while ((c = ce.exec(src))) {
    const gt = src.indexOf('>', c.index), tagEnd = src.slice(c.index, gt);
    if (/style=\{\{/.test(tagEnd)) continue;
    const cls = c[1].split(/\s+/);
    const pri = cls.includes('pri') && cls.includes('duo-btn');
    const bgK = pri ? PRI.bg : cls.map(x => CLASS_FILL[x]).find(Boolean);
    const fgK = pri ? PRI.fg : cls.map(x => CLASS_TEXT[x]).find(Boolean);
    if (bgK && fgK) out.push({ at: `${file}:${src.slice(0, c.index).split('\n').length}`, bg: bgK, fg: fgK });
  }
  return out;
}

export function tokenPairFailures(files, html = readFileSync('index.html', 'utf8')) {
  const T = modeTokens(html), fails = [];
  const hex = (mode, k, n = 0) => {
    const v = T[mode][k]; if (!v || n > 5) return null;
    const r = v.match(/^var\(--([a-z0-9-]+)\)$/); if (r) return hex(mode, r[1], n + 1);
    return /^#[0-9a-f]{6}$/i.test(v) ? v : null;
  };
  let pairs = 0;
  for (const f of files) for (const p of stylePairs(f)) {
    for (const mode of ['dark', 'light']) {
      const b = hex(mode, p.bg), c = hex(mode, p.fg);
      if (!b || !c) continue;   // not a flat colour token (a gradient, a brand colour set elsewhere)
      pairs++;
      const r = contrast(b, c);
      if (r < 4.5) fails.push(`${p.at} ${mode}: --${p.fg} on --${p.bg} is ${r.toFixed(2)}:1 (${c} on ${b})`);
    }
  }
  return { pairs, fails };
}

// Text on a stage colour (map-only, not a mode token) must come from the one
// AA policy, _inkOnHex / _inkOn, never a mode token that ignores the fill.
export function stageFillFailures(files) {
  const fails = []; let fills = 0;
  for (const file of files) {
    const src = readFileSync(file, 'utf8'), re = /style=\{\{/g; let m;
    while ((m = re.exec(src))) {
      let i = m.index + 8, d = 1;
      for (; i < src.length && d; i++) { if (src[i] === '{') d++; else if (src[i] === '}') d--; }
      const obj = src.slice(m.index + 8, i - 1);
      const bg = obj.match(/(?:^|[\s,{])background:\s*([^,\n]*?\b(?:s|st|stage)\.color\b[^,\n]*)/);
      const fg = obj.match(/(?:^|[\s,{])color:\s*([^,\n]+)/);
      if (!bg || !fg || /\$\{|rgba\(|gradient/.test(bg[1])) continue;
      fills++;
      const id = fg[1].trim().match(/^[A-Za-z_$][\w$]*$/);   // e.g. heroInk, assigned from _inkOn once
      const ok = /_inkOn(Hex)?\(/.test(fg[1]) || (id && new RegExp(`\\b(?:const|let)\\s+${id[0]}\\s*=\\s*_inkOn(?:Hex)?\\(`).test(src));
      if (!ok) fails.push(`${file}:${src.slice(0, m.index).split('\n').length}: text ${fg[1].trim()} on a stage-colour fill (${bg[1].trim()}); use _inkOnHex(…)`);
    }
  }
  return { fills, fails };
}
