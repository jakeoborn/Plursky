# Work report — PR 3 (official-map layer, v234) + the gpsAnchors finding

**Date:** 2026-08-27 · **Lane:** Claude Code · **Audience:** Instinct
**Branch state:** `main` = `690bb34` (v233) · PR **#27** open, CI green, `CLEAN`

---

## Queue status

| item | state |
|---|---|
| #23 RevenueCat pin (v233) | **merged** `723a760` |
| #24 verify gate + `bump.mjs` | **merged** `690bb34` |
| **#27 PR 3 — official-map layer (v234)** | **open, green, awaiting merge** |
| PR 4 — `photo-tag.jsx` cross-festival (v235) | next, stacked on #27 |
| PR 5 — EF/TML 2026 → 2027 roll (v236) | queued |

`#24` did **not** auto-retarget when `#23` merged — the stacked base branch was
deleted first, so the retarget had nothing to follow. It was pointed at `main`
explicitly, rebased `--onto`, re-gated and merged. Worth knowing for any lane
that stacks: **deleting the base branch on merge can strand the child PR.**

---

## PR 3 — what shipped

The RealMap render-order comment has described a **"poster" layer** since the
day it landed — *"clip first → poster on top → 3D buildings extrude from
poster"* — but the layer **was never built**. Turning on Real map (BETA) gave
satellite imagery with dots on it and none of the festival's own cartography.

Three things landed:

1. **`official-map` raster layer**, anchored through the existing 3-point
   Cramer affine.
2. **`showLabels` now reaches RealMap.** It was never passed, so the More
   menu's "Landmark labels" moved the SVG map and did nothing on the real one.
3. **Landmarks became per-festival data.** The 14 EDC landmarks were hardcoded
   *twice* in `map.jsx` — once in `TopDownMap` behind the toggle, once in
   `RealMap` always-on — with **no festival gate**. Switching to ACL or Lost
   Lands drew `KINETIC TRAIL` and `DAISY FIELDS` across Zilker Park and Legend
   Valley. Now `FESTIVAL_CONFIG.landmarks`.

### The non-obvious bit: two of the five map assets are not square

`TopDownMap` draws the poster with `preserveAspectRatio="xMidYMid slice"` —
CSS `cover`. **MapLibre never crops**; it stretches the image into whatever
quad it is handed. So the plain 0-100 corners would have squashed EDC's poster
**25% vertically** and slid every printed feature off the stage dots.

| asset | dimensions | true extent in 0-100 space |
|---|---|---|
| `edc-map-2026.jpg` | 1320×1649 | y **−12.46 … 112.46** |
| `edco-tinker-2026.jpg` | 960×1200 | y **−12.50 … 112.50** |
| `acl-park.webp` / `ef-forest-2026.jpg` / `lostlands-2026.jpg` | square | 0 … 100 |

The layer is also placed with an explicit `beforeId` rather than by call order,
because natural image dimensions arrive **async** — a late append would draw
the poster *over* the stage dots, routes and presence dots.

---

## The finding worth propagating: `gpsAnchors` never satisfied their own affine

Every festival's config comment claims the non-calibration anchors were
*"derived from the SVG layout via the &lt;trio&gt; affine"*. **None of the five
actually satisfied it.** Push a stored anchor back through its own affine and
it must return that stage's `x/y`:

| festival | worst residual (grid units) | scale |
|---|---|---|
| `edc-lv-2026` | **6.85** (`neon`) | ~85 m |
| `acl-2026` | **28.72** (`tmobile`), 17.86 (`honda`) | ~190 m across Zilker · **live** |
| `electric-forest-2026` | **8.14** (`honeybee`) | |
| `lost-lands-2026` | **39.91** (`forest-stage`) | |
| `edc-orlando-2026` | **56.90** (`stereo`) | over half the footprint |

**These are not decorative.** `photo-tag.jsx` attributes a photo to a stage by
matching **EXIF GPS against these anchors**. A stage sitting 85 m from where the
app thinks it is **mis-tags the memories shot there** — the same founder-reported
pain class PR 4 is scoped for, arriving from the data side instead of the code
side. `acl-2026` is `available: true`, so that one was live.

**Re-derived:** EDC LV, Electric Forest, ACL — max residual now **0.09**.
**Left provisional per the work order:** Lost Lands, EDC Orlando — with their
measured residuals written into the config so each flip session knows exactly
what it owes.

> Stated precisely: this makes each anchor set self-consistent **with its own
> stated derivation**. It does **not** independently verify the calibration trio
> against satellite imagery. That remains the flip-session ritual.

### The detector, not just the instance

`scripts/verify.mjs` now enforces it — **fatal** for a live festival, a
**warning** for a gated one:

```
▸ GPS anchor gate — anchors must satisfy their own affine
  ok edc-lv-2026            worst 0.09 (quantum)
  ok electric-forest-2026   worst 0.01 (honeybee)
  !  lost-lands-2026        worst 39.91 (forest-stage)
  !  edc-orlando-2026       worst 56.90 (stereo)
  ok acl-2026               worst 0.07 (ladybird)
  2 gated festival(s) inconsistent — re-derive at the flip session
  ✓ 5 festival(s) checked, live ones consistent within 1.5 grid units
```

Any lane touching a festival's stage layout or anchors now gets told
immediately, instead of the error surfacing months later as a mis-tagged photo.

---

## Receipts

Per the PR 2 lesson that **`root=1` proves nothing on its own** — declarations
hoist, so a file containing a bare `throw` still mounts — the gate is the floor
here, not the evidence.

| check | result |
|---|---|
| `bump.mjs --next` | v233 → v234, 20 replacements, three files agree |
| parse gate | 13/13 |
| anchor gate | 5 festivals, live ones ≤ 0.09 |
| mount probe | `root=1`, 19376 chars, **14/14 globals**, 0 console errors |
| **anchor gate fails when it should** | exit **1** on the historical `neon` value, exit **0** on the fix |
| extent maths vs real config (VM) | **15/15**, incl. `mapToGps`/`gpsToMap` round-trip at **2.3e-10** |
| visual | computed extent + stage dots rendered for EDC LV, ACL, Lost Lands — and looked at |
| CI on #27 | `sanity` SUCCESS, `CLEAN` |

The visual is what actually proves the anchoring: **every EDC dot lands on its
printed stage**, ACL's dots land on the park map, and Lost Lands' dots correctly
float on abstract art — which is what a provisional generated asset *should*
look like.

### A harness note for other lanes

The first attempt at a behavioural probe reused the `verify.mjs` iframe pattern
and produced **no result at all** — the in-page timer never fired inside the
virtual-time budget. Rather than re-run it with bigger numbers, the maths was
lifted out and tested directly in a Node VM against the **real `data.jsx`**.
Faster, deterministic, and it tests the shipped source text rather than a
re-typed copy. **A browser is not required to test a pure function.**

MapLibre also **cannot** be screenshotted in headless Chrome with `--disable-gpu`
— it needs WebGL, and the render comes back blank. The extent proof was built
as plain DOM instead, consuming the identical numbers the quad is built from.

---

## Open, unactioned

- **`electric-forest-2026` / `tomorrowland-2026` roll to 2027** is PR 5. Both
  2027 editions have **no official dates** — Wikipedia has no 2027 entry for
  either. Aggregator sites quote some, but Tomorrowland's "2027" dates are
  byte-identical to 2026, which is the tell that they are pattern-guessed. Plan
  is `dates: "… 2027 · dates TBA"`, which the generator's date parser
  deliberately fails to match, so the JSON-LD emits **no** `startDate`/`endDate`
  rather than a fabricated one.
- **EDC's poster carries a title block** above the map art, so on the real map
  it now sits over terrain north of the venue. Correct geometry, odd framing —
  the fix is a cropped asset, not code.
- The More-menu **"Official festival map" toggle** is an addition beyond the
  literal ask, flagged in the PR for veto.
