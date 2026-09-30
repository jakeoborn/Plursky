// Static half of the appearance gate: every inline style object that pairs a
// fill token (`background: "var(--x)"`) with a text token (`color: "var(--y)"`)
// must meet WCAG AA in BOTH modes. The live gate only measures what a screen
// shows by default; this also covers sheets, banners and toasts that open on
// a tap or a condition (the Map's signal buttons, the install banner).
import { readFileSync } from 'node:fs';

export function modeTokens(html) {
  const block = (m) => {
    const i = html.indexOf(`:root[data-mode="${m}"]`), j = html.indexOf('}', i), t = {};
    for (const [, k, v] of html.slice(i, j).matchAll(/--([a-z0-9-]+):\s*([^;]+);/g)) t[k] = v.trim();
    return t;
  };
  return { dark: block('dark'), light: block('light') };
}

const lum = (h) => {
  const c = [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16) / 255).map(v => v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
};
export const contrast = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };

// Every `style={{ … }}` object in a file, with its line, fill token and text token.
export function stylePairs(file, src = readFileSync(file, 'utf8')) {
  const out = [], re = /style=\{\{/g; let m;
  while ((m = re.exec(src))) {
    let i = m.index + 8, d = 1;
    for (; i < src.length && d; i++) { if (src[i] === '{') d++; else if (src[i] === '}') d--; }
    const obj = src.slice(m.index + 8, i - 1);
    const fg = obj.match(/(?:^|[\s,{])color:\s*"var\(--([a-z0-9-]+)\)"/);
    const bg = obj.match(/(?:^|[\s,{])background(?:Color)?:\s*"var\(--([a-z0-9-]+)\)"/);
    // A gradient is judged by every token stop: text has to read on each end.
    const gr = obj.match(/(?:^|[\s,{])background(?:Image)?:\s*"(?:linear|radial)-gradient\(([^"]*)\)"/);
    const stops = bg ? [bg[1]] : gr ? [...gr[1].matchAll(/var\(--([a-z0-9-]+)\)/g)].map(x => x[1]).filter(k => !/-rgb$/.test(k)) : [];
    const line = src.slice(0, m.index).split('\n').length;
    if (fg) for (const k of new Set(stops)) out.push({ at: `${file}:${line}`, bg: k, fg: fg[1] });
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
