# SPEC — GPS anchor flip sessions (Lost Lands, EDC Orlando) + EDC poster crop

**Date:** 2026-08-27 · **Author lane:** Instinct · **For:** Claude Code lane
**Answers:** [`docs/reports/2026-08-27-pr3-official-map-layer.md`](../reports/2026-08-27-pr3-official-map-layer.md)
**Depends on:** PR #27 (official-map layer + anchor gate) merged. Everything
below assumes its `verify.mjs` anchor gate is on `main`.

---

## What PR 3 established (the ground this spec stands on)

- `verify.mjs` now enforces anchor self-consistency: push each stored
  `gpsAnchors` entry back through the affine defined by that festival's
  **first three anchors**; it must return the stage's `x/y` within
  **TOL = 1.5 grid units** (~20 m at EDC's scale). **Fatal for a live
  festival, warning for a gated one.**
- Re-derived and green: `edc-lv-2026` (0.09), `electric-forest-2026` (0.01),
  `acl-2026` (0.07).
- Left provisional, with measured residuals: `lost-lands-2026` (worst 39.91,
  `forest-stage`), `edc-orlando-2026` (worst 56.90, `stereo`).
- Stated limit, quoted from the report because this spec exists partly to
  close it: self-consistency "does **not** independently verify the
  calibration trio against satellite imagery. That remains the flip-session
  ritual."

Why it matters: `photo-tag.jsx` attributes a photo to a stage by matching
EXIF GPS against these anchors. A wrong anchor mis-tags real memories — the
founder-reported pain class, arriving from the data side.

---

## Scope A — `lost-lands-2026` flip session (fires ~Sep 15, on the W-3 watch)

Trigger: official 2026 patron map publishes (the W-3 watch in
`docs/qa/CLICKY-QUEUE.md` fires the session). Current state: all 7 anchors
provisional (spread around the centroid; config comment says so), mapImage is
a generated abstract placeholder, `setTimesProvisional: true`.

**A1. Replace the map asset.** Process the official 2026 patron map with the
`acl-park.webp` treatment: square canvas, the map art framed to fill it.
Square is not aesthetics — a square asset makes `_officialMapExtent()` return
the plain 0–100 box, which is the only case where the SVG cover crop is a
no-op and the grid registration is exact by construction. Drop in as
`lostlands-2026.jpg` (same filename; `_officialMapDims` measures natural
dimensions at runtime, so no code change follows the asset swap).

**A2. Place the calibration trio.** Pick three stages that (a) are printed
unambiguously on the official map, (b) span the venue (not collinear — the
gate skips `det ≈ 0`, but a near-collinear trio amplifies measurement error
into every derived anchor). Read their GPS off satellite imagery
(OSM/Google), not off the patron map's projection. These three define the
affine; they are the only anchors measured directly. **Order matters:** the
gate uses `gpsAnchors[0..2]` as the trio, so the calibrated three go first.

**A3. Derive the remaining anchors through the affine.** For each remaining
stage: its `x/y` from the SVG layout, pushed through the trio's affine
(`mapToGps`). Replace the provisional values. This is the step that makes the
config's long-standing "derived from the SVG layout via the <trio> affine"
comment true for the first time.

**A4. Verify the trio against satellite imagery independently.** Self-
consistency is not ground truth: a perfectly consistent trio can sit 50 m
off the venue. For each trio anchor, compare the GPS against the stage's
position on satellite imagery; eyeball tolerance ~15 m. If a trio anchor
moves, re-run A3.

**A5. Acceptance.**

- `node scripts/verify.mjs` anchor gate: `lost-lands-2026` goes from `!` to
  `ok`, worst residual ≤ 1.5 grid units.
- Mount probe green; visual check: every stage dot lands on its printed
  stage on the official map, in both TopDownMap and RealMap.
- Replace provisional set times/stages and delete the `setTimesProvisional`
  marker (existing flip-session instruction in `data.jsx`).
- Flip `available: true` as **its own PR**, per AGENTS.md §4. Never
  agent-merged.

## Scope B — `edc-orlando-2026` flip session (map expected closer to Nov 6–8)

Same procedure as Scope A, with the festival's own facts: 5 anchors
(`kinetic, circuit, neon, stereo, bacardi`), `edco-tinker-2026.jpg`
placeholder, venue = Tinker Field. One extra: the venue centroid itself is
provisional (Tinker Field Plaza, Nominatim) — re-derive `gps` from the
official map's center while the session is open. Acceptance identical:
warning to `ok`, ≤ 1.5, flip as its own PR.

## Scope C — EDC LV poster title-block crop (asset-only, any time after #27)

`edc-map-2026.jpg` (1320×1649) carries a title block above the map art. On
RealMap the block is placed geographically, so it sits over terrain north of
the venue. Fix is a cropped asset, not code — but the crop is constrained:

- The 0–100 grid maps to the image by CSS-cover math
  (`_officialMapExtent`): for a 1320×1649 asset the SVG-visible band is
  image rows ~205…1444 (y = −12.46…112.46 in grid space). Stage dots are
  registered to the art **through that band**.
- A lopsided crop re-registers everything: crop the title block off the top
  and the cover math re-centers, sliding every printed feature off its dot.
- **Therefore:** measure the title block height `t`, then crop rows
  `[t, natH − t]` — a symmetric crop preserves the cover-band center and the
  grid registration. If the title block intrudes into the visible band
  (t > 205), the art itself shifts and the anchors must be re-verified
  visually afterward regardless.
- Acceptance: extent maths re-run in the Node VM against the real config
  (the PR 3 harness pattern — no browser needed), plus a rendered visual of
  computed extent + stage dots for EDC LV, looked at. Anchor gate
  unaffected (anchors are GPS-space) but run it anyway — cheap.

## Explicitly out of scope

- **The More-menu "Official festival map" toggle** — founder veto pending in
  PR #27 review. This spec takes no position; default-on with the toggle is
  what #27 ships.
- **PR 4 (`photo-tag.jsx` cross-festival, v235)** and **PR 5 (EF/TML 2027
  roll, v236)** — already open as #28 and #30.
- **EF 2026 dead-entry retirement** — superseded by #30's roll-forward.

## Hard rules that bind every scope above

- PRs only; no direct pushes to `main` (AGENTS.md §0–§1).
- `verify.mjs` (parse gate + anchor gate + mount probe) must pass before
  any merge; a flip PR is its own PR, never agent-merged (AGENTS.md §4).
- Docs-only changes do not bump `vNNN`; any `.jsx`/asset change does, across
  `index.html` + `sw.js` + `app.jsx` via `scripts/bump.mjs`.
