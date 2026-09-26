// ONE SYSTEM, TWO MODES. Dark and White share every layout, component, type
// style, radius and motion value; only the colour tokens and elevation change.
// dark/tokens.js and white/tokens.js each call DUO_TOKENS(mode).
window.DUO_TOKENS = function (mode) {
  const dark = mode === "dark";   // anything else is Light ("white" is the old name)
  const C = dark ? {
    bg: "#07060B", s1: "#100E17", s2: "#19161F", s3: "#241F2C", line: "#221E2B", line2: "#342E3F",
    ink: "#F3F0FA", ink2: "#ABA4BB", ink3: "#8A849A",
    acc: "#9474FF", onAcc: "#0B0816", accInk: "#B7A3FF", live: "#3DF5A0", clash: "#FF4574", sun: "#FFC545",
  } : {
    bg: "#F4F3F8", s1: "#FFFFFF", s2: "#FFFFFF", s3: "#EAE8F1", line: "#E6E3EE", line2: "#D3CEDF",
    ink: "#14121C", ink2: "#565266", ink3: "#6B6780",
    acc: "#4A2BFF", onAcc: "#FFFFFF", accInk: "#4A2BFF", live: "#007A53", clash: "#D81B57", sun: "#B84A00",
  };
  const rgba = (h, a) => { const n = parseInt(h.slice(1), 16); return `rgba(${n >> 16},${(n >> 8) & 255},${n & 255},${a})`; };
  return {
    id: dark ? "dark" : "light",
    name: dark ? "Dark" : "Light",
    scheme: dark ? "dark" : "light",
    fontsHref: "https://fonts.googleapis.com/css2?family=Michroma&family=Martian+Mono:wght@300;400;500;600&display=swap",
    color: [
      { group: dark ? "Ground — violet-black, not #000" : "Ground — cool pearl, not cream", items: [
        { token: "--bg", hex: C.bg, role: "App ground" },
        { token: "--s1", hex: C.s1, role: dark ? "Rows, sheets" : "Cards, sheets, rows" },
        { token: "--s2", hex: C.s2, role: "Cards, inputs" },
        { token: "--s3", hex: C.s3, role: "Wells, pressed, tracks" },
        { token: "--line", hex: C.line, role: "Hairline between rows" },
        { token: "--line-2", hex: C.line2, role: "Card edge, rings, dividers" },
      ]},
      { group: "Ink", items: [
        { token: "--ink", hex: C.ink, role: "Primary text" },
        { token: "--ink-2", hex: C.ink2, role: "Secondary text" },
        { token: "--ink-3", hex: C.ink3, role: "Metadata" },
      ]},
      { group: "Signal — one accent, three states", items: [
        { token: "--acc", hex: C.acc, role: "THE accent: your plan, selection, primary fill" },
        { token: "--on-acc", hex: C.onAcc, role: "Text and icons on an accent fill" },
        { token: "--acc-ink", hex: C.accInk, role: "Accent as text" },
        { token: "--live", hex: C.live, role: "LIVE only, never decoration" },
        { token: "--clash", hex: C.clash, role: "Clashes, errors" },
        { token: "--sun", hex: C.sun, role: "Sunrise" },
      ]},
    ],
    contrastPairs: [
      ["--ink", "--bg", "Body text"], ["--ink-2", "--bg", "Secondary text"], ["--ink-3", "--bg", "Metadata"],
      ["--ink-2", "--s2", "Secondary on a card"], ["--ink-3", "--s2", "Metadata on a card"], ["--acc-ink", "--bg", "Accent as text"],
      ["--live", "--bg", "LIVE label"], ["--clash", "--bg", "Clash label"], ["--sun", "--bg", "Sunrise label"],
      ["--on-acc", "--acc", "Primary button"], ["--live", "--s2", "LIVE on a card"], ["--clash", "--s2", "Clash on a card"],
    ],
    extraVars: [
      ["--page-bg", C.bg], ["--page-ink", C.ink], ["--page-ink-2", C.ink2], ["--page-line", C.line2], ["--page-accent", C.acc], ["--page-card", C.s2],
      ["--acc-08", rgba(C.acc, .08)], ["--acc-14", rgba(C.acc, dark ? .16 : .10)], ["--acc-30", rgba(C.acc, dark ? .3 : .22)], ["--acc-55", rgba(C.acc, .55)],
      ["--clash-40", rgba(C.clash, .45)],
      ["--scrim", dark ? "rgba(25,22,31,.92)" : "rgba(255,255,255,.96)"],
      ["--chip-bg", dark ? "rgba(7,6,11,.6)" : "rgba(255,255,255,.9)"],
      ["--map-filter", dark ? "saturate(.55) brightness(.5) contrast(1.15)" : "saturate(.9)"],
      ["--map-fade", dark ? "linear-gradient(180deg,#07060B 0,rgba(7,6,11,.55) 170px,rgba(40,24,90,.25) 50%,rgba(7,6,11,.7) 100%)" : "linear-gradient(180deg,#F4F3F8 0,rgba(244,243,248,.4) 170px,rgba(244,243,248,0) 45%,rgba(244,243,248,.35) 100%)"],
      ["--hero-fade", dark ? "linear-gradient(180deg,rgba(7,6,11,.55) 0,rgba(7,6,11,0) 24%,rgba(7,6,11,0) 50%,rgba(7,6,11,.85) 88%,#07060B 100%)" : "linear-gradient(180deg,rgba(0,0,0,.35) 0,rgba(0,0,0,0) 24%,rgba(0,0,0,0) 50%,rgba(0,0,0,.55) 90%,rgba(0,0,0,.6) 100%)"],
      ["--tab-bg", dark ? "linear-gradient(180deg,rgba(7,6,11,.6),#07060B 40%)" : "linear-gradient(180deg,rgba(244,243,248,.7),#F4F3F8 40%)"],
      ["--beam", `linear-gradient(90deg,${rgba(C.acc, 0)},${C.acc} 30%,${dark ? C.ink : C.acc})`],
    ],
    fonts: {
      display: { name: "Michroma", stack: "Michroma, 'Eurostile', 'Helvetica Neue', sans-serif", role: "Wide technical caps: eyebrows, stage codes. Never above 22px, never sentence case." },
      ui:      { name: "SF Pro", stack: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', system-ui, sans-serif", role: "Everything you read. Native Dynamic Type path." },
      data:    { name: "Martian Mono", stack: "'Martian Mono', ui-monospace, 'SF Mono', monospace", role: "Times, counts, countdowns. Tabular, so a live clock never jitters." },
    },
    type: [
      { token: "clock",    family: "data",    size: 56, lh: 56, weight: 300, track: -0.05, sample: "12:50" },
      { token: "hero",     family: "ui",      size: 44, lh: 44, weight: 800, track: -0.04, sample: "EDC Las Vegas" },
      { token: "display",  family: "ui",      size: 40, lh: 42, weight: 800, track: -0.035, sample: "John Summit" },
      { token: "title",    family: "ui",      size: 28, lh: 32, weight: 700, track: -0.025, sample: "Lineup" },
      { token: "headline", family: "ui",      size: 17, lh: 22, weight: 650, track: -0.012, sample: "Peggy Gou b2b Ki/Ki" },
      { token: "body",     family: "ui",      size: 16, lh: 22, weight: 400, track: -0.005, sample: "Mainstage · headliners, sunrise sets" },
      { token: "body-s",   family: "ui",      size: 14, lh: 19, weight: 500, track: 0, sample: "Kinetic Field" },
      { token: "label",    family: "display", size: 11, lh: 14, weight: 400, track: 0.14, upper: true, sample: "Night 2 · Saturday" },
      { token: "data",     family: "data",    size: 14, lh: 18, weight: 500, track: -0.02, sample: "12:32 → 1:42" },
      { token: "data-s",   family: "data",    size: 12, lh: 15, weight: 400, track: -0.01, sample: "55 MIN" },
    ],
    space: [4, 8, 12, 16, 20, 24, 32, 40, 56],
    radius: [
      { token: "--r-xs", value: "6px", use: "Codes, tiny chips" },
      { token: "--r-sm", value: "12px", use: "Rows, buttons" },
      { token: "--r-md", value: "20px", use: "Cards" },
      { token: "--r-lg", value: "28px", use: "Sheets, scoreboard" },
      { token: "--r-pill", value: "999px", use: "Chips, avatars" },
    ],
    elevation: dark ? [
      { token: "--e1", value: `inset 0 1px 0 rgba(243,240,250,.06), 0 0 0 1px ${C.line}`, use: "Lit edge: cards are lit from above", demo: `background:${C.s2};box-shadow:inset 0 1px 0 rgba(243,240,250,.06),0 0 0 1px ${C.line}` },
      { token: "--e2", value: "inset 0 1px 0 rgba(243,240,250,.08), 0 24px 48px -24px rgba(0,0,0,.9)", use: "Sheets over the map", demo: `background:${C.s2};box-shadow:inset 0 1px 0 rgba(243,240,250,.08),0 24px 48px -24px rgba(0,0,0,.9)` },
      { token: "--glow", value: `0 0 0 1px ${rgba(C.acc, .55)}, 0 0 32px ${rgba(C.acc, .35)}`, use: "The ONE lifted thing per screen", demo: `background:${C.s2};box-shadow:0 0 0 1px ${rgba(C.acc, .55)},0 0 32px ${rgba(C.acc, .35)}` },
    ] : [
      { token: "--e1", value: `0 0 0 1px ${C.line}, 0 1px 2px rgba(20,18,28,.04)`, use: "Cards sit on the pearl ground", demo: `background:#fff;box-shadow:0 0 0 1px ${C.line},0 1px 2px rgba(20,18,28,.04)` },
      { token: "--e2", value: "0 0 0 1px rgba(20,18,28,.06), 0 24px 48px -20px rgba(28,20,70,.35)", use: "Sheets over the map", demo: "background:#fff;box-shadow:0 0 0 1px rgba(20,18,28,.06),0 24px 48px -20px rgba(28,20,70,.35)" },
      { token: "--glow", value: `0 0 0 1.5px ${rgba(C.acc, .7)}, 0 14px 32px -14px ${rgba(C.acc, .55)}`, use: "The ONE lifted thing per screen", demo: `background:#fff;box-shadow:0 0 0 1.5px ${rgba(C.acc, .7)},0 14px 32px -14px ${rgba(C.acc, .55)}` },
    ],
    icons: { note: "1.6px stroke on a 24 grid, round caps, open forms. Icons take the text colour (currentColor), so one set serves both modes.", samples: "" },
    motionNote: "Shared by both modes. Timing is set in beats at 128 BPM. Transitions decay like light (fast attack, long tail). Strobe-safe: nothing flashes more than 3 times a second. Reduce Motion freezes the beams.",
    motion: [
      { token: "--beat", value: "469ms", use: "1 beat @128 BPM" },
      { token: "--bar", value: "1875ms", use: "Live-dot breath" },
      { token: "--t-tap", value: "140ms", use: "Press feedback" },
      { token: "--t-move", value: "280ms", use: "Sheet, push, tab change" },
      { token: "--ease-decay", value: "cubic-bezier(.16,.84,.24,1)", use: "Fast attack, long tail" },
    ],
  };
};
