# Plursky — Visual Design System

A multi-festival companion app (EDC, ACL, and more).

> **This file is not the source of truth.** It was written on 2026-05-26, before
> the dark/light rollout, and its palette and non-goals no longer describe the
> app. Use these three sources, in this order:
>
> | What | Where | Role |
> |---|---|---|
> | **Design guide** | [`docs/design/duo-rollout-ledger.md`](docs/design/duo-rollout-ledger.md) | The source of truth: token map (dark and light), contrast rulings, gap ledger. |
> | **Implemented tokens and components** | [`index.html`](index.html) (`:root[data-mode="dark"]`, `:root[data-mode="light"]`, `.theme-field` rules) | What the app actually renders. If it disagrees with the guide, the code ships; fix one of them. |
> | **Historical board** | [`design/system-exploration` @ `6524ccb`](https://github.com/jakeoborn/Plursky/tree/6524ccbdb5aebc7069081d09df910c527ed3a219/design/system-exploration) (`shared/duo-tokens.js`, `shared/duo.css`, `shared/duo.js`) | The selected dark/light exploration board the guide was mapped from. Reference only; do not copy values from it over the guide. |
>
> Dark is the default mode and Light is a full mode of the same system; both are
> gated by `scripts/test-appearance.mjs`. The sections below (typography,
> spacing, radii, components, motion, iOS chrome) are pre-rollout observations
> kept for history; where they disagree with the three sources above, those win.

---

## Palette

Moved. See the design guide's token map in
[`docs/design/duo-rollout-ledger.md`](docs/design/duo-rollout-ledger.md) and the
implemented values in [`index.html`](index.html). The May desert-dawn palette
(paper, ink, ember) is retired; its legacy token names (`--paper`, `--ember`,
`--dune` ...) survive only as aliases that follow the active mode.

---

## Typography

Three families, loaded from Google Fonts in `index.html`:

| Family | Use | Apply via |
|---|---|---|
| **Instrument Serif** (400, italic 400) | Display, card titles, "voice" — italic for emphasis | `className="serif"` |
| **Geist** (300–700) | Body, paragraphs, inputs | Default (`body { font-family: 'Geist' … }`) |
| **Geist Mono** (400, 500) | Labels, badges, all-caps metadata | `className="mono"` |

### Type scale (observed frequencies)

| Size | Font | Use |
|---|---|---|
| 36–42 | Serif | Page hero (`privacy.html`, error boundary) |
| 22    | Serif | Section heading ("Friends at EDC", "Crew Mode") |
| 17–18 | Serif | Card title |
| 13–15 | Geist | Body copy, inputs |
| 11–12 | Geist | Secondary body, button labels |
| 9–10  | **Mono caps** | Labels, "TAP TO CONNECT", "● 4 LIVE" — the dominant atom |
| 7.5–8.5 | Mono caps | Tiny metadata under avatars |

Mono caps always carry `letterSpacing: 1.1–1.4`. They are *written* in uppercase
in JSX (not transformed via CSS) so the source reads like the screen.

---

## Spacing

Even integers, mostly 2px increments. No formal scale token — just observed
defaults that feel right.

| Px | Use |
|---|---|
| 4   | Hairline gaps inside chips |
| 6–8 | Gap between adjacent controls |
| 10–12 | Card inner padding (compact) |
| 14–16 | Card inner padding (normal) |
| 20    | Card-to-card vertical rhythm |
| 22–28 | Section break |

Top-pad respects iOS safe area via `var(--top-pad)` → `env(safe-area-inset-top)`.
Always add `viewport-fit=cover` to consume this.

---

## Border radii (by frequency, n = grep)

| px | Count | Use |
|---|---|---|
| **999** | 100× | Pill buttons, avatars, chips |
| **10**  | 40×  | Buttons, inputs |
| **12**  | 35×  | Cards |
| **14**  | 27×  | Larger cards / containers |
| **8**   | 22×  | Small chips |
| **16**  | 12×  | Hero cards, modals |

Avoid 4–6 unless intentional (they read as "Material" / Android).

---

## Components

### Primary CTA button
```jsx
<button style={{
  background: "var(--ember)", color: "#fff",
  border: "none", borderRadius: 999, padding: "9px 14px",
  fontFamily: "Geist Mono, monospace",
  fontSize: 10, letterSpacing: 1.2, fontWeight: 700,
}}>GO LIVE</button>
```

### Secondary / outline button
```jsx
<button style={{
  background: "transparent", border: "1px solid var(--line-2)",
  borderRadius: 10, padding: "10px 14px",
  fontFamily: "Geist Mono, monospace",
  fontSize: 10, letterSpacing: 1.2, color: "var(--muted)",
}}>SIGN OUT</button>
```

### Card
```jsx
<div style={{
  background: "var(--paper-2)",     // or var(--paper) over paper-2 contexts
  border: "1px solid var(--line)",  // omit when on paper-2
  borderRadius: 14, padding: 16,
}}>…</div>
```

### Mono label
```jsx
<div className="mono" style={{
  fontSize: 9, letterSpacing: 1.3, color: "var(--muted)",
}}>TAP TO PERSONALIZE</div>
```

### Status dot prefix
Convention: a leading `●` in mono caps signals a real-time/live state.
Color encodes the state — `var(--success)` for OK, `var(--ember)` for warning.

---

## Motion

- Transitions: `.15s` is the house default for hovers/state changes; `.2s` for
  larger layout shifts; `.3s` for cross-screen.
- Easing: browser default `ease` (no custom curves) — keeps things calm.
- Animations: subtle bobs (`isoBob`, `lineupFlash`); never bouncy.
- The frame **does not** use page transitions — tab switches are instant.

---

## iOS chrome

- On installed PWA / phone viewports (`<= 500px` or `display-mode: standalone`),
  the iPhone bezel is **dropped** (v91) via `_useNakedFrame()`. Don't design
  anything that depends on a visible frame.
- A 22px sticky `StatusStrip` (v95) sits above every tab body showing local
  day/time + offline + battery-saver badges. Stays out of modal overlays via
  inset:0 covers.

---

## Non-goals

Moved to the design guide,
[`docs/design/duo-rollout-ledger.md`](docs/design/duo-rollout-ledger.md). The
May non-goals list is retired: dark mode is now the default.

---

## When in doubt

Grep first:
```
grep -h "fontSize:" *.jsx | sort | uniq -c | sort -rn | head
grep -h "borderRadius:" *.jsx | sort | uniq -c | sort -rn | head
```
Match the modal frequency. If you genuinely need a new value, leave a comment
explaining why this case warrants breaking the pattern.
