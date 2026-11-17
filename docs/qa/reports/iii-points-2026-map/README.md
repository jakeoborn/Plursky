# III Points 2026 map flip — QA receipt (2026-10-15)

## What changed
The festival's official 2026 map is pinned and measured; `iii-points-2026`
moves from `mapMode: "real"` (no art, no pins) to a poster-class registered
overlay: 13 stage x/y reads + 13 gpsAnchors, all `src: "poster"`.

## Source
- URL: https://www.iiipoints.com/assets/campaign/festival-map-2026-1080.webp
  (only 600w/1080w variants exist; 1080w pinned)
- Observed: 2026-10-15 (published the day before gates; event Oct 16–17)
- Pinned: `map-sources/iiip-map-2026-source.webp`, 1080×1350,
  sha256 `049fd21c23e5a341d2c8654fdca7496d8a0ef66c4e102ec7f1d7f6d640d3312b`
- Rights: official festival map, shipped as registered map art per the
  repo-wide ruling (Jake, 2026-10-15).

## Derivative (scripts/build-iiip-map-2026.mjs --check)
- Crop y 0–1116 (legend box starts at y=1117; title/logo kept as art), full width.
- Pad 18px left (249,179,230) / 18px right (255,215,255) — edge-matched, per-side.
- `iiip-map-2026.webp` 1116×1116, sha256 `4d8f043dbd2f8c173e00430c4983158cad1c88452de8c90ada8fbe3e278269fa`
- Built with python3 + PIL (quality 86, method 6): the ACL/EDCO sips+cwebp
  path needs macOS; --check verifies bytes, not encoders.

## Georeferencing
The art is an oblique illustration: NW 22nd–25th St run vertically (left =
north), NW 5th/6th Ave horizontally (up = east), and the street family
CONVERGES (22nd/23rd parallel, 24th converging) — no affine can register it.

Control points (street corners only, never stages), OSM-surveyed via Overpass
2026-10-15 (all 0 m node gaps except 25th×6th, dropped):
NW 24th×5th, NW 23rd×5th, NW 22nd×5th, NW 24th×6th, NW 23rd×6th, NW 22nd×6th,
plus both ends of the NW 22nd Lane segment (OSM way: lat 25.7989,
lng −80.1990→−80.2007 — it brackets the venue's east end where the streets
give no intersections).

Fits (least squares, metres):
- affine over the 6 street corners: RMS 18.3, worst 31.1 — perspective error, confirmed
  by tracing 22nd St's full course (the corner reads were right; the model was wrong)
- homography over all 8: RMS 12.6, worst 20.6 — shipped
- cross-check: affine-8 and homography-8 agree on the extrapolated main-stage
  area within ~10 m (mind-melt −80.20065 vs −80.20056)

Stage lat/lng = homography-8 reads at the measured pin pixels. Stage x/y =
`round(100·px/1116, 1)` on the derivative (ACL convention).

## Registration honesty (by design)
All 13 anchors are `src: "poster"` — an art read is not a measurement.
Consequences, owned by map.jsx `geometryVerifiedFor`:
- provenance/corroboration FAIL → tier "unchecked" → overlay draws at 0.35,
  real-map stage pins suppressed, distance readouts suppressed.
- `anchor-residuals.mjs`: non-basis anchors sit 10–30 m from the basis affine
  (the art's own distortion; ACL's shipped class is 5.8–11.3 m/unit).
Promotion path: any osm/crowd anchor (e.g. on-site measurement during the
event) re-runs the same gates.

## Basis triple (do not reorder)
mind-melt (east end), isotropic (NW 25th St side), grand-central (south-west
end) — largest well-read triangle; map.jsx reads only the first three.

## Pin provenance (derivative pixels, measured 2026-10-15)
Sign-centre pins where the art signs the stage; structure centre for
mind-melt. Second-pass zoom verification on 444, player's-club, door-iv,
sec3, vertex, grand-central after the first tile pass (z3/z4/trace22/top
crops; ±3–8 px).
- mind-melt (703,305) · players-club (538,400) · 444 (848,435) · unforeseen (810,478)
- door-iv (570,580) · s3qu3nce (358,510) · iii-points-radio (353,675) · isotropic (143,715)
- halo-88 (273,775) · sec3 (648,702) · vertex (818,682) · grand-central (843,855) · rc95 (373,918)

## Gates run on this branch
- test-georef-map ✓ 38/38 (9 mutations)
- test-map-overlay-registration ✓ 50/50
- test-poster-over-real-map ✓ 45 (23/23 mutations) — fleet expectation moved
  iii-points-2026 to the unchecked tier (was "none" in its mapMode:"real" era)
- test-iii-points-days ✓ — assertions updated for the flip (stages carry x/y,
  13 poster anchors, no mapMode); schedule/clock assertions untouched
- test-iii-points-stage-programming ✓
- test-acl-map-2026 ✓ 105 (ACL plate untouched)
- build-iiip-map-2026.mjs --check ✓
- Full verify: see this directory's verify log when attached.
