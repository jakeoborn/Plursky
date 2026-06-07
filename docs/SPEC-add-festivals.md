# SPEC — Multi-festival expansion wave (2026-06-06)

**Goal:** add the festivals that make the Radiate partnership pitch land.
The pitch email (drafted, **HOLDING — not sent**; copy in Jake's Mail drafts to
radtherhino@radiatetheworld.com) claims Plursky feeds Radiate's event
communities with post-festival content. Today Plursky covers EDC LV (passed)
+ ACL (Oct). Radiate's communities ranked by members (probed 2026-06-06):

| Rank | Festival | Joined | Dates | Plursky |
|---|---|---|---|---|
| 1 | EDC Las Vegas | 205,639 | May (passed) | ✅ full |
| 2 | **Lost Lands** | 103,356 | Sept 2026 | ❌ **P1** |
| 3 | **Electric Forest** | 93,621 | **Jun 25–28** | ❌ **P0 — time-critical** |
| 4 | **EDC Orlando** | 91,376 | Nov 13–15 | preview stub → **P2** |
| 5 | Bonnaroo | 63,108 | Jun 11–14 | only if set times already public |
| 7 | Hard Summer | 62,104 | Aug | backlog |
| 8 | Nocturnal Wonderland | 44,042 | Sept | backlog |

Build **one festival per session** (Jake's preference). Order: Electric
Forest → Lost Lands → EDC Orlando. After Forest ships, the email can send
("live for EDC, Electric Forest, ACL — Lost Lands next").

---

## 0. PREREQUISITE REFACTOR (do once, first session of the wave)

`data.jsx:994-1001` hardcodes a two-festival ternary:

```js
const _isACL = _activeId === "acl-2026";
const _STAGES = _isACL ? ACL_STAGES : STAGES;   // etc.
```

Generalize to a registry-keyed lookup — contract unchanged
(`window.STAGES/ARTISTS/AMENITIES/FESTIVAL_CONFIG` resolve to the active set):

```js
const _DATA_SETS = {
  "edc-lv-2026": { stages: STAGES, artists: ARTISTS, amenities: AMENITIES, config: FESTIVAL_CONFIG },
  "acl-2026":    { stages: ACL_STAGES, artists: ACL_ARTISTS, amenities: ACL_AMENITIES, config: <acl config from registry> },
  // new festivals append here
};
```

Also generalize `_artistsForFestival(festId)` in **spotify.jsx** (added v226,
currently hardcodes acl-2026/EDC) to read the same `_DATA_SETS` map — it
resolves ARCHIVED festivals' artist IDs for the cross-festival "Festival
Year" recap, so every new lineup must be reachable there too.
⚠️ CLAUDE.md §5: everything is global across `<script type=text/babel>` —
top-level consts in data.jsx are visible in spotify.jsx by bare name.

## 1. PER-FESTIVAL DATA CHECKLIST (~500 lines each; ACL is the template)

Copy the ACL pattern (`data.jsx` ~line 236-302 config; `ACL_STAGES` ~816;
`ACL_ARTISTS` ~837 with the `_aclMk` helper):

- [ ] **FESTIVAL_CONFIG**: `id` (must match the localStorage saved-key prefix
      `${id}_saved_v1`), name/shortName/brand/tagline/location/locationShort,
      dates string, year, `startMs`/`endMs` (Date.UTC), `tz`/`tzAbbr`/
      `utcOffsetHours`, `dayDates` {n: {y,m,d,name,short,midnightUtc}},
      `sunTimes`, `gps` {lat,lng,onSiteRadiusMi}, `mainStageId`,
      `weatherEndpoint` (api.weather.gov/points/LAT,LNG — US only).
- [ ] **STAGES**: id/name/short/color/x/y/size. Colors distinct; x/y are
      percent positions on the map image.
- [ ] **ARTISTS**: `mk`-style helper (id, name, genre, stageId, day, start,
      end) — **real set times are load-bearing** (auto-tag matches capture
      time vs set windows). Tier: derive like `_aclMk` (start-hour bands) or
      assign manually. Use post-midnight times consistent with `toNightMin`
      (<6h = next day at EDC-style overnight fests; daytime fests like Forest
      end ~2 AM — verify the cutoff fits).
- [ ] **Map**: official patron map processed like `acl-park.webp` (legend
      cropped, padded square) + `mapStyle: "image-overlay"`,
      `mapTheme`. **Never trace Insomniac/festival art into SVG**
      ([[feedback_map_session_lessons]]) — image-overlay only.
- [ ] **gpsAnchors**: 3 calibrated anchors at known landmarks (satellite
      imagery), rest derived via the 3-point Cramer affine (see map.jsx ACL
      comments). Build the diagnostic overlay early, don't iterate blind.
- [ ] **Badge pack**: add an entry to `_FESTIVAL_BADGE_PACKS` (spotify.jsx,
      v227) — 4-6 festival-flavored badges using REAL stage ids/names + one
      auto-earn freebie. Without a pack the generic fallback kicks in (fine
      but flat).
- [ ] **Registry entry**: `available: true` in FESTIVALS_REGISTRY (EDC Orlando
      already has a preview stub — fill it in, flip available).

**Gate on real set times:** if a festival's set times aren't published yet,
keep `available: false` (or previewOnly) — a lineup without times can't
auto-tag and breaks the core promise. Forest/Bonnaroo times typically land
days before the event; check edmtrain/official app/Reddit before scheduling
the session.

## 2. VERIFY GATE (per festival)

1. Babel parse + mount probe (plursky-verify) — data.jsx is in the chain.
2. Playwright real-app: seed `active_festival_id=<new-id>` + `onboarded='v1'`
   + `${id}_saved_v1`; screenshot Today/Lineup/Map; LOOK (stages placed
   right, lineup renders, no EDC bleed).
3. Auto-tag harness: load the real lineup in Node, derive timestamps from
   actual set-window midpoints, assert `_matchArtistForPhoto` picks the
   right artist (the v211 lesson — attended/saved+time wins, GPS gate is
   fallback).
4. Badges: `_computeBadges` on the new festival shows its pack, zero
   foreign-festival strings (the v227 ACL lesson).
5. Festival Year: archive an old festival snapshot + switch → aggregate
   resolves the new lineup's names via `_artistsForFestival`.
6. Cache-bust lockstep bump (read live vNNN first) + push to main;
   `cap sync ios` rides the next archive.

## 3. NOT IN SCOPE

- Radiate deep-link chip (revisit after partnership reply; Jake wants
  Radiate→Plursky flow, not link-out).
- Sending the partnership email (Jake sends from his Mail; copy is drafted).
- CMS/remote festival data (the data.jsx comment says re-evaluate at #5 —
  the _DATA_SETS refactor above is the stepping stone, not the CMS).
