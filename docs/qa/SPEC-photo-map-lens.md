# SPEC — GPS Photo-Overlay Map Lens (Plursky Memories)

**Authored:** 2026-06-03 (Claude Code) · **For:** a fresh session/window · **Status:** queued

**One-liner:** Scatter the user's actual photo/video **thumbnails at their real GPS
coordinates** on the EDC map — "here's *where* on the field each moment happened" —
instead of today's count-bubbles-grouped-by-stage.

**Target version:** web **v212** → iOS **1.10 (21)**.

---

## Mobbin design references (pulled 2026-06-03, ios — search Mobbin again to re-view)
- **Placify "On this day"** — `https://mobbin.com/screens/a32b6b5c-3da9-4d88-ae47-b795c5f510a9`
  ★ closest match: rounded photo cards fanned/overlapping around a single map pin,
  slight rotation, soft shadow. **Model the pin cards on this.**
- **Instagram map** — `https://mobbin.com/screens/acd2d60c-9bff-473b-9617-3da9ff41a19e`
  circular photo bubbles clustered at a place, one ringed "active" bubble + "+2 more".
  **Model declustering / overlap collapse on this.**
- **Snapchat Snap Map** — `https://mobbin.com/screens/bddd627d-7a62-433b-a5de-d4577f15620f`
  circular thumbnail pins + scrollable place list below the map. **Model map+list split.**
- **Google Photos map** — `https://mobbin.com/screens/5fe49bd8-fe48-4be3-be24-3717e74ea574`
  map header + "N photos" + grid below (simplest fallback layout).

## Reuse — do NOT rebuild (CLAUDE.md §6)
- `gpsToMap(lat, lng) → {x, y}` (0–100 map space) — `map.jsx`, global.
- `m.parsedGps = {lat, lng}` stamped on each moment at import (`spotify.jsx` ~4246).
- `FESTIVAL_CONFIG.mapImage` — EDC SVG background (see `MemoriesMapLens` ~4042).
- `useMomentPhoto(photoId, enabled)` — blob URL + cloud restore-on-view.
- `MemoriesMapLens` (`spotify.jsx` ~4008) — existing stage-bucket bubble view to extend.
- `STAGES[].color` (pin ring) · `_nearestStageId(x,y)` (fallback label).

## Build
1. **New component `MemoriesPhotoMapLens({ moments, onPinTap })`** in `spotify.jsx`,
   beside `MemoriesMapLens`.
2. **Placement:** each moment w/ `parsedGps` → `gpsToMap()` → `{x,y}`; render an
   absolutely-positioned rounded thumbnail (HTML `<img>` over the map container —
   easier than SVG for blob URLs). Stage-color ring via nearest stage. No GPS →
   fall back to its tagged artist's stage `{x,y}` with a small deterministic jitter
   (hash the moment id → ±2–3 map units) so same-stage moments don't perfectly stack.
3. **Declustering (Instagram model):** group thumbnails whose `{x,y}` are within
   ~6 map units; render the newest as the face + a "+N" badge; tap expands the
   cluster (lightbox of the group). Cap visible (~24) for perf; "+N more" for the rest.
4. **Card style (Placify model):** ~44–52px rounded thumbnail, 2px stage-color
   border, soft drop shadow, tiny per-pin rotation for the scattered-polaroid feel;
   ▶ badge on videos (reuse existing duration-badge pattern).
5. **Toggle, don't replace:** in the MAP lens add a segmented control
   **CLUSTERS ⇄ PHOTOS** (default CLUSTERS to preserve current behavior). Wire
   alongside the existing `view === "map"` branch (~4698).
6. **Interactions:** tap thumbnail → `openLightbox([moment], 0)`; tap cluster →
   lightbox of the group. Pinch/zoom out of scope for v1.

## Edge cases
- Few/no GPS moments → graceful empty state ("Import GPS photos or tag sets to map
  them"); reuse the `unplaced` counter.
- GPS drift in crowds (±20–50m) is expected — jitter + declustering hides it; don't
  promise pixel accuracy.
- Many moments → windowing/cap; revoke off-screen blob URLs (use `useMomentPhoto(enabled)`).

## Verify before ship (mandatory — see plursky-verify skill)
- Babel-parse `spotify.jsx`; headless mount probe (`root=1`, `MemoriesPhotoMapLens`
  is a function).
- **Rendered screenshot visual review** with ~8 sample GPS moments on the EDC map —
  actually look at it; iterate scatter/ring/shadow until it matches the Placify ref.
- Bump cache-bust **v211→v212** lockstep (index.html + sw.js + app.jsx); commit;
  `node scripts/build.mjs && npx cap sync ios` for the 1.10 (21) build.

## Out of scope (v1)
Heatmap · time-scrub animation across the map · per-stage filtering · web/native
divergence. One clean lens.

---
**Context when this was written:** auto-tag off-stage-preemption + live-Shazam mic
bugs fixed in v211 (web live; iOS gets them on 1.10/21). This map lens is the next
feature, not a bug.
