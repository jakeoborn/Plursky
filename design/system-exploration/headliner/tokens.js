// HEADLINER — the lineup poster and the riso flyer. Type is the image; two
// inks per night; your night is billed like a headliner.
window.TOKENS = {
  id: "headliner",
  name: "Headliner",
  scheme: "dark",
  fontsHref: "https://fonts.googleapis.com/css2?family=Archivo:wdth,wght@62..125,100..900&display=swap",
  color: [
    { group: "Night 2 inks (Saturday) — the screens below", items: [
      { token: "--ground", hex: "#1B24B8", role: "Ultramarine riso ink: the page itself" },
      { token: "--ground-2", hex: "#141B92", role: "Pressed / inset (a second pass of blue)" },
      { token: "--spot",   hex: "#FF4FB4", role: "Fluoro pink spot ink: your plan, live, the offset shadow" },
      { token: "--paper",  hex: "#F4F1EA", role: "Unprinted paper: primary type on the blue" },
      { token: "--paper-2", hex: "#B9BEF2", role: "Paper through a blue screen: secondary type" },
      { token: "--on-spot", hex: "#10157A", role: "Type on pink" },
    ]},
    { group: "Other nights — each night prints in its own two inks", items: [
      { token: "--n1-ground", hex: "#17161B", role: "Fri: riso black" },
      { token: "--n1-spot",   hex: "#FF6A2B", role: "Fri: fluoro orange" },
      { token: "--n3-ground", hex: "#0B5A43", role: "Sun: riso green" },
      { token: "--n3-spot",   hex: "#FFE14D", role: "Sun: yellow" },
    ]},
    { group: "Utility", items: [
      { token: "--ink",   hex: "#10157A", role: "Type on paper surfaces (sheets)" },
      { token: "--clash", hex: "#FFE14D", role: "Clash sticker (yellow on blue: loud on purpose)" },
    ]},
  ],
  contrastPairs: [
    ["--paper", "--ground", "Body on the blue"], ["--paper-2", "--ground", "Secondary on the blue"], ["--spot", "--ground", "Pink on blue: display sizes only (≥ 24px)"],
    ["--on-spot", "--spot", "Type on a pink button"], ["--ink", "--paper", "Type on a paper sheet"], ["--clash", "--ground", "Clash sticker"],
    ["--n1-spot", "--n1-ground", "Fri: orange on black"], ["--n3-spot", "--n3-ground", "Sun: yellow on green"],
  ],
  extraVars: [
    ["--page-bg", "#1B24B8"], ["--page-ink", "#F4F1EA"], ["--page-ink-2", "#B9BEF2"], ["--page-line", "rgba(244,241,234,.22)"], ["--page-accent", "#FF4FB4"], ["--page-card", "#F4F1EA"],
    ["--grain", "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='160' height='160'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='.9' numOctaves='2' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  0 0 0 .55 0'/></filter><rect width='160' height='160' filter='url(%23n)' opacity='.5'/></svg>\")"],
    ["--halftone", "radial-gradient(circle, rgba(16,21,122,.55) 1.1px, transparent 1.5px) 0 0 / 4px 4px"],
    ["--line", "rgba(244,241,234,.22)"],
  ],
  fonts: {
    billing: { name: "Archivo (wdth 62, 900)", stack: "Archivo, 'Arial Narrow', sans-serif", role: "Condensed black caps: billing, names, the NOW. One variable family flexes from poster-condensed to wide, which is how real lineup posters tier." },
    label:   { name: "Archivo (wdth 100–112, 700)", stack: "Archivo, 'Helvetica Neue', sans-serif", role: "Caps labels, stickers, times." },
    ui:      { name: "SF Pro", stack: "-apple-system, BlinkMacSystemFont, 'SF Pro Text', system-ui, sans-serif", role: "Anything longer than a line. Dynamic Type." },
  },
  type: [
    { token: "mega",    family: "billing", size: 104, lh: 86, weight: 900, track: -0.01, upper: true, extra: "font-stretch:62%;", sample: "John Summit" },
    { token: "tier1",   family: "billing", size: 44, lh: 40, weight: 900, track: 0, upper: true, extra: "font-stretch:62%;", sample: "Subtronics" },
    { token: "tier2",   family: "billing", size: 26, lh: 26, weight: 800, track: 0.005, upper: true, extra: "font-stretch:68%;", sample: "Peggy Gou b2b Ki/Ki" },
    { token: "tier3",   family: "billing", size: 16, lh: 19, weight: 700, track: 0.02, upper: true, extra: "font-stretch:75%;", sample: "Wax Motif • Getter • Maddix" },
    { token: "headline", family: "ui",     size: 18, lh: 23, weight: 700, track: -0.01, sample: "Kinetic Field" },
    { token: "body",    family: "ui",      size: 16, lh: 22, weight: 400, track: 0, sample: "Mainstage · headliners, sunrise sets" },
    { token: "label",   family: "label",   size: 12, lh: 14, weight: 700, track: 0.08, upper: true, extra: "font-stretch:108%;", sample: "Night 2 · Saturday" },
    { token: "time",    family: "billing", size: 22, lh: 22, weight: 800, track: 0.01, extra: "font-stretch:75%;font-variant-numeric:tabular-nums;", sample: "12:32–1:42" },
  ],
  space: [4, 8, 12, 16, 24, 32, 48],
  radius: [
    { token: "--r-0", value: "0px", use: "Everything printed: panels, rows, the poster" },
    { token: "--r-2", value: "3px", use: "Buttons, chips (a guillotine trim)" },
    { token: "--r-sticker", value: "999px", use: "Stickers and the live dot only" },
  ],
  elevation: [
    { token: "--mis", value: "4px 4px 0 #FF4FB4", use: "Misregistration: the pink pass lands 4px off — the ONE lift", demo: "background:#F4F1EA;border-radius:0;box-shadow:4px 4px 0 #FF4FB4" },
    { token: "--mis-sm", value: "2px 2px 0 #FF4FB4", use: "Small lifted items: stickers, selected chip", demo: "background:#F4F1EA;border-radius:0;box-shadow:2px 2px 0 #FF4FB4" },
    { token: "--flat", value: "none", use: "Everything else is ink on paper — no blur shadows, ever", demo: "background:#141B92;border-radius:0" },
  ],
  icons: {
    note: "2.5px stroke with square caps, drawn heavy like cut vinyl. Amenities use the same geometry, filled in paper ink. The active tab is inverted: a paper tile with blue ink.",
    samples: "",
  },
  motionNote: "Print, not physics. There are no eases: state changes cut in 3 steps over 120ms, like a registration jog. Adding a set stamps it (overshoot to 1.12 in one frame, then settle). Live acts crawl across a ticker at 40 px/s. Night changes reprint the whole app in the next night's two inks. Reduce Motion stops the ticker and keeps the cuts.",
  motion: [
    { token: "--cut", value: "steps(3, end) 120ms", use: "Every state change" },
    { token: "--stamp", value: "steps(2, end) 90ms", use: "Add to plan / collect" },
    { token: "--ticker", value: "40px/s linear", use: "Live-now crawl" },
    { token: "--reprint", value: "steps(4, end) 400ms", use: "Night 1 → 2 → 3 ink swap" },
  ],
};
