// One source of truth per direction: <dir>/tokens.js sets window.TOKENS.
// This file (1) writes those tokens into CSS custom properties and type
// classes the mock screens use, and (2) renders the spec sheet from the same
// object, so a documented token can never drift from the one on screen.
// Contrast ratios are computed (WCAG 2.x relative luminance), not typed.
(function () {
  let T = window.TOKENS;

  // ── colour math ──
  const hexToRgb = (h) => { h = h.replace("#", ""); if (h.length === 3) h = h.split("").map((c) => c + c).join(""); return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16)); };
  const lum = (h) => hexToRgb(h).map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }).reduce((a, v, i) => a + v * [0.2126, 0.7152, 0.0722][i], 0);
  const contrast = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };
  let colorMap = {};
  window.contrastOf = (a, b) => contrast(colorMap[a] || a, colorMap[b] || b);

  // ── CSS from tokens ──
  // applyTokens can run again at runtime (the appearance toggle swaps Dark and
  // Light in place): it rewrites the same <style>, so nothing is re-rendered
  // and a screen that hardcodes a colour instead of a var() shows up as a leak.
  const style = document.createElement("style");
  style.id = "tokens";
  document.head.appendChild(style);
  window.applyTokens = function (next) {
    T = window.TOKENS = next;
    colorMap = {};
    T.color.forEach((g) => g.items.forEach((c) => (colorMap[c.token] = c.hex)));
    const css = [];
    const root = [];
    T.color.forEach((g) => g.items.forEach((c) => root.push(`${c.token}:${c.hex}`)));
    (T.extraVars || []).forEach(([k, v]) => root.push(`${k}:${v}`));
    Object.entries(T.fonts).forEach(([k, f]) => root.push(`--f-${k}:${f.stack}`));
    T.space.forEach((s) => root.push(`--sp-${s}:${s}px`));
    T.radius.forEach((r) => root.push(`${r.token}:${r.value}`));
    T.elevation.forEach((e) => root.push(`${e.token}:${e.value}`));
    T.motion.forEach((m) => root.push(`${m.token}:${m.value}`));
    css.push(`:root{color-scheme:${T.scheme || "dark"};${root.join(";")}}`);
    T.type.forEach((t) => {
      css.push(`.t-${t.token}{font-family:var(--f-${t.family});font-size:${t.size}px;line-height:${t.lh}px;font-weight:${t.weight};letter-spacing:${t.track || 0}em;${t.upper ? "text-transform:uppercase;" : ""}${t.extra || ""}}`);
    });
    style.textContent = css.join("\n");
    document.documentElement.dataset.mode = T.id;
    if (T.fontsHref && !document.querySelector(`link[href="${T.fontsHref}"]`)) { const l = document.createElement("link"); l.rel = "stylesheet"; l.href = T.fontsHref; document.head.appendChild(l); }
  };
  window.applyTokens(T);

  // ── spec sheet ──
  const esc = (s) => String(s).replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]));
  window.renderSpec = function (el) {
    const sw = T.color.map((g) => `
      <div class="spec-group"><h4 class="spec-h4">${esc(g.group)}</h4><div class="swatches">
      ${g.items.map((c) => `<div class="sw"><div class="sw-chip" style="background:${c.hex}"></div>
        <div class="sw-meta"><code>${esc(c.token)}</code><b>${c.hex.toUpperCase()}</b><span>${esc(c.role)}</span></div></div>`).join("")}
      </div></div>`).join("");
    const pairs = (T.contrastPairs || []).map(([fg, bg, use]) => {
      const r = contrast(colorMap[fg], colorMap[bg]);
      const grade = r >= 7 ? "AAA" : r >= 4.5 ? "AA" : r >= 3 ? "AA large" : "FAIL";
      return `<tr><td><span class="pair" style="background:${colorMap[bg]};color:${colorMap[fg]}">Aa</span></td><td><code>${esc(fg)}</code> on <code>${esc(bg)}</code></td><td class="num">${r.toFixed(2)}:1</td><td class="grade g-${grade.replace(" ", "")}">${grade}</td><td>${esc(use || "")}</td></tr>`;
    }).join("");
    const fonts = Object.entries(T.fonts).map(([k, f]) => `<tr><td><code>--f-${k}</code></td><td style="font-family:${f.stack};font-size:18px">${esc(f.name)}</td><td>${esc(f.role)}</td></tr>`).join("");
    const type = T.type.map((t) => `<tr><td><code>${esc(t.token)}</code></td><td class="num">${t.size}/${t.lh} · ${t.weight}${t.track ? " · " + t.track + "em" : ""}${t.upper ? " · caps" : ""}</td><td><div class="t-${t.token} type-sample">${esc(t.sample)}</div></td></tr>`).join("");
    const space = `<div class="space-row">${T.space.map((s) => `<div class="space-i"><div class="space-bar" style="width:${s}px;height:${s}px"></div><code>${s}</code></div>`).join("")}</div>`;
    const radius = `<div class="radius-row">${T.radius.map((r) => `<div class="radius-i"><div class="radius-box" style="border-radius:${r.value}"></div><code>${esc(r.token)}</code><b>${esc(r.value)}</b><span>${esc(r.use)}</span></div>`).join("")}</div>`;
    const elev = `<div class="elev-row">${T.elevation.map((e) => `<div class="elev-i"><div class="elev-box" style="${e.demo || "box-shadow:" + e.value}"></div><code>${esc(e.token)}</code><span>${esc(e.use)}</span></div>`).join("")}</div>`;
    const motion = T.motion.map((m) => `<tr><td><code>${esc(m.token)}</code></td><td class="num">${esc(m.value)}</td><td>${esc(m.use)}</td></tr>`).join("");
    el.innerHTML = `
      <section class="spec-sec"><h3 class="spec-h3">Colour</h3>${sw}
        <h4 class="spec-h4">Contrast, computed</h4><div class="tbl"><table class="spec-tbl">${pairs}</table></div></section>
      <section class="spec-sec"><h3 class="spec-h3">Type</h3><div class="tbl"><table class="spec-tbl">${fonts}</table></div>
        <div class="tbl"><table class="spec-tbl type-tbl">${type}</table></div></section>
      <section class="spec-sec"><h3 class="spec-h3">Spacing <small>4-pt base</small></h3>${space}</section>
      <section class="spec-sec"><h3 class="spec-h3">Radii</h3>${radius}</section>
      <section class="spec-sec"><h3 class="spec-h3">Elevation</h3>${elev}</section>
      <section class="spec-sec"><h3 class="spec-h3">Iconography</h3><div class="icon-note">${T.icons.note}</div><div class="icon-row">${T.icons.samples}</div></section>
      <section class="spec-sec"><h3 class="spec-h3">Motion</h3><div class="motion-note">${T.motionNote}</div><div class="tbl"><table class="spec-tbl">${motion}</table></div></section>`;
  };

  // Photo slot: the real image when design/system-exploration/photos/ holds
  // it (private, gitignored), else the direction's own fallback surface.
  window.photo = (name) => `url(../photos/${name}.jpg)`;
})();
