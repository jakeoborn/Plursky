# Design system exploration

Three candidate visual identities for Plursky. They are concepts only: no
production UI changes. The recommendation, with its rationale, is in
[RECOMMENDATION.md](RECOMMENDATION.md).

| Direction | Page | Tokens |
|---|---|---|
| 01 · Laser (dark, recommended) | [laser/index.html](laser/index.html) | [laser/tokens.js](laser/tokens.js) |
| 02 · Holo (light + Blacklight) | [holo/index.html](holo/index.html) | [holo/tokens.js](holo/tokens.js) |
| 03 · Headliner (poster) | [headliner/index.html](headliner/index.html) | [headliner/tokens.js](headliner/tokens.js) |

Each page shows every screen, then the spec. The spec covers colour with computed
contrast, type, spacing, radii, elevation, iconography and motion. All of it is
generated from that direction's `tokens.js`, the same object the screens are
styled with, so the spec can't drift from the pixels.

## Files

- **`shared/sample.js`:** EDC LV 2026 stages and Saturday set times from
  `data.jsx`, plus sample plan data.
- **`shared/system.js`:** turns tokens into CSS variables, type classes and the
  spec sheet.
- **`shared/icons.js`:** one icon geometry that each direction renders in its
  own stroke style.
- **`render.mjs`:** renders every screen at App Store 6.9" size (1320×2868):
  `node design/system-exploration/render.mjs <outDir>`.
- **`gate.mjs`:** the design gate. It exits 0 only when every screen passes
  checks G1–G10: `node design/system-exploration/gate.mjs`.
- **`photos/`:** gitignored and never committed. It holds the founder's own
  EDC photos (Memories thumbnails) and the Spotify artist images the mocks
  display. Without it, the photo slots fall back to each direction's surface
  colour.

The maps use the repo's official `edc-map-2026.jpg`.
