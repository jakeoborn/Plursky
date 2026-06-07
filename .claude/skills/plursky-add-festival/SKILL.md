---
name: plursky-add-festival
description: Add a new festival to Plursky end-to-end (data set, registry, badges, map, verify gate). Use when asked to "add <festival>", build a festival data set, or flip a provisional festival live when its set times drop. Canonical checklist lives in docs/SPEC-add-festivals.md — this skill is the operational HOW with the gotchas that bit us building Electric Forest (v228).
---

# Add a festival to Plursky

Read `docs/SPEC-add-festivals.md` first (data checklist + verify gate + Radiate
priority order). This skill is the execution path. ACL (`data.jsx`, search
`ACL_STAGES`) and Electric Forest (`EF_STAGES`) are the templates.

## 0. GATE: are official set times published?

Go straight to `festivaldust.com/festivals/<slug>/set-times` (it says
explicitly "before set times drop" when TBA); fall back to the official app.
- **Times published** → build everything live, `available: true`.
- **Times NOT published** (typical until ~9 days out) → build the FULL
  scaffold anyway with `available: false` + `setTimesProvisional: true` in
  config + provisional times clearly commented. A later "flip session"
  replaces times/stages/map and flips `available`. Lineup-by-day is usually
  public months early — use real day assignments.

## 1. Data set (all in data.jsx)

Order matters only for readability; everything is wired by step 3.

1. **Registry config** — full FESTIVAL_CONFIG inline in `FESTIVALS_REGISTRY`
   (copy the `electric-forest-2026` entry shape): id (= localStorage prefix
   `${id}_saved_v1`), names, dates, startMs/endMs (Date.UTC), tz/tzAbbr/
   `utcOffsetHours`, `dayDates` w/ `midnightUtc` (= local midnight in UTC —
   EDT = +4h, PDT = +7h), sunTimes, gps + onSiteRadiusMi, gpsAnchors,
   mainStageId, mapImage/mapStyle/mapTheme, weatherEndpoint
   (api.weather.gov/points/LAT,LNG — US only).
   **Day count is free**: 4-day fests work (Forest is Thu–Sun); DAYS is
   re-derived from the active config via `_daysFor` at the window export.
2. **`<PREFIX>_STAGES`** — id/name/short/color/x/y/size + desc/vibe/vibeNote/
   peak. Colors distinct; x/y = percent on the map image (north-up).
3. **`_<prefix>Mk` helper + `<PREFIX>_ARTISTS`** — copy `_efMk` (tier from
   start hour, post-midnight `h<8 → +24`). Day-prefixed ids (`eft1`/`eff1`/…)
   make day audits greppable. One entry per artist PER DAY for repeat acts.
4. **`<PREFIX>_AMENITIES`** — 8-ish water/food/med/toilet/info entries.
5. **`_DATA_SETS`** — add one line:
   `"<id>": { stages, artists, amenities, config: _regConfig("<id>") }`.
   That's the ONLY wiring; window.STAGES/ARTISTS/AMENITIES/FESTIVAL_CONFIG/
   DAYS all resolve through it.

## 2. Cross-file additions

- **Badge pack** (`spotify.jsx`, `_FESTIVAL_BADGE_PACKS`): 5–7 badges with
  REAL stage ids + one auto-earn freebie. Without a pack the generic
  main-stage fallback renders (fine but flat).
- **`_artistsForFestival`** (spotify.jsx) already reads `window._DATA_SETS`
  — nothing to do. (Do NOT re-introduce bare `ARTISTS` fallthroughs: data.jsx's
  window export OVERWRITES bare globals with the active set, so archives
  resolved the wrong lineup until v228.)
- **Map image**: process the official patron map like `acl-park.webp` (crop
  legend, pad square) → `mapStyle: "image-overlay"`. NEVER trace festival art
  into SVG. If the official map isn't out (rides with set times), generate an
  original abstract overlay placeholder (see `ef-forest-2026.jpg`,
  /tmp recipe: HTML gradients → Playwright screenshot). build.mjs auto-copies
  images; map images are NOT in the sw.js precache (correct — leave it).
- **GPS anchors**: 3 satellite-calibrated at landmarks + rest derived via the
  3-point Cramer affine (map.jsx ACL comments). Pre-official-map, centroid-
  derived provisional anchors are OK ONLY behind `available: false`.

## 3. Verify gate (every step measured, not assumed)

Serve the repo (`python3 -m http.server 8765`) and use Playwright
(`node_modules/playwright`, see plursky-agent-browser skill for seeding:
`onboarded='v1'`, `active_festival_id`, `${id}_saved_v1`).

1. **plursky-verify**: Babel parse changed files + mount probe.
2. **Switch matrix**: boot with each festival id; assert
   `window.FESTIVAL_CONFIG.id`, `DAYS` (labels AND dates — they were stale
   EDC values until v228), stage/artist counts, no pageerrors.
3. **Cross-festival lookups**: `_artistsForFestival('<other-id>')[0].name`
   must return the OTHER festival's artist from every active mode.
4. **Render pass**: if `available:false`, temp-flip
   (`perl -0pi -e 's/available: false,\n    accent: .../available: true,...'`,
   tagged `// TEMP-FLIP-FOR-TEST`), screenshot Today/Lineup/Map at 430×932,
   LOOK at them (day chips count + dates, stage names, no foreign-festival
   bleed), then revert the flip and `grep -c TEMP-FLIP` = 0.
5. **Badges**: `_computeBadges(savedIds)` → pack names appear, regex for
   foreign strings (Quantum|Amex|Zilker|…) returns null.
6. **Festival Year**: seed `plursky_festival_archive_v1` with REAL artist ids
   from another festival → `_computeFestivalYear().topArtists` resolves names.
7. **Auto-tag harness**: `_matchArtistForPhoto({date,lat,lng}, saved, attended)`
   — `date` is an EXIF wall-clock STRUCT `{yr,mo,dy,hh,mm}` in festival-local
   time (mo is 1-based), NOT a JS Date. Globals can be runtime-swapped from
   `_DATA_SETS` to test a non-active festival. Cover: attended wins, saved
   wins, last-day set, post-midnight set (h<8 math), DAYTIME set (the
   `_photoFestivalNight` window is 11:00→06:00 local since v228 — was 19:00
   and silently discarded all afternoon photos at daytime fests), outside
   window. Plus an EDC regression row.
8. **Cache-bust**: read live vNNN first (broad regex), bump lockstep across
   index.html + sw.js + app.jsx ONLY (not spotify.jsx historical comments),
   `node scripts/build.mjs`. NEW .jsx files (rare) also go in index.html
   script tags + sw.js LOCAL precache, before spotify.jsx.

## 4. Ship (§0 approval gate)

Propose → Jake approves → commit to main (deploy) with the standard
Co-Authored-By trailer. `cap sync ios` rides the next archive — note it in
the session memory. If shipped `available:false`, record the flip-session
trigger (set times drop ~9 days before gates; 2025 Forest = Jun 16).
