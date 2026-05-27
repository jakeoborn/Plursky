# Session 8 — Spec for remaining work

All changes below are already implemented in the working tree (14 files, ~360 lines changed). This spec documents what was done and what remains for the next session.

---

## What changed this session

### 1. Today tab (`home.jsx`)
- **DayStrip hidden during pre-festival.** The Yesterday/Today/Upcoming segmented control is meaningless 128 days out. Now only renders when `!countdown`.
- **Artist of the Day spotlight.** Pre-festival hero card now shows a daily-rotating headliner with photo background, stage color accent, name, stage, set time, and tap-to-view. Rotation is deterministic (`Math.floor(Date.now() / 86400000) % headliners.length`).
- **Empty state redesigned.** "No saved sets" is now a tappable card: *"Build your lineup — TAP TO BROWSE 125 ARTISTS"* that navigates to the Lineup tab.

### 2. Lineup grid (`lineup.jsx`)
- **Critical bug fix: grid time range.** Was hardcoded to EDC nighttime (19:00–05:30). ACL sets (11:00–22:00) all piled up at position 0. Now computes `GRID_START_MIN`/`GRID_END_MIN` dynamically from actual ARTISTS data at module load.
- **12-hour time gutter.** Labels now read `11 AM`, `12 PM`, `1 PM` etc. instead of `19:00`, `20:00`.
- **Wider columns.** `COL_W` 76 → 94px. `GUTTER_W` 38 → 44px.
- **Headliner treatment.** Tier-3 artists get `fontSize: 12.5` in Instrument Serif, regular artists 11.5 in Geist sans-serif. Headliner blocks get a subtle `box-shadow` glow in the stage color.
- **Multi-line names.** Blocks taller than 60px allow 2-line wrapping via `-webkit-line-clamp: 2`.
- **Stage-colored header bar.** Each column header has a `borderBottom: 2.5px solid ${stage.color}` accent and subtle tinted background.
- **Alternating column tint.** Odd columns get `rgba(26,18,13,0.018)` background for visual rhythm.
- **Hidden empty SavedSidebar.** When the user has no saved sets for the current day, the 100px sidebar is hidden entirely.
- **Day selection persists.** Tapping a day now writes `state.lineupDay` so switching tabs and coming back remembers your selection.
- **Grid header height.** `GRID_HEADER_H` adjusted from 36 → 30px to match the new compact header.

### 3. Map (`map.jsx`)
- **Left-side gradient fade.** A `linearGradient` rect (15% width, warm beige, 0.92→0 opacity) overlays the left edge of the background map image to mute the baked-in ACL legend.
- **Background dim + vignette.** `mapImage` opacity dropped to 0.85. A `radialGradient` vignette darkens the edges (0.22 opacity at r=55%) to draw focus to the festival grounds center.
- **Amenity dots hidden by default.** The 8 ACL amenity markers only render when `showAmenities` prop is true (wired to `searchSheetExpanded`), keeping the default map clean. Accessible via Find Nearby chips.
- **Controls consolidated.** The separate Layers button is merged into the zoom capsule as a top button (Layers → + → − → RESET). Reduces top-right from 3 separate floating controls to 2 (GPS pill + combined capsule).
- **GPS label enlarged.** 7.5px → 9px for sunlight readability.
- **Rideshare FAB removed.** The floating 🚗 button is gone. Rideshare is now a row inside the ⋯ more-actions menu ("Rideshare · UBER / LYFT").
- **Friends row hides when ⋯ menu is open.** Reduces bottom clutter — only MEET UP + ⋯ visible while the menu is expanded.
- **OFF-SITE pill improved.** Now reads "185 MI AWAY · DEMO" or "OUTSIDE VENUE · DEMO" instead of the confusing "185MI OFF · DEMO MODE". Slightly larger (10px), with shadow.
- **Search sheet reduced.** `maxHeight` 62vh → 48vh. Transition easing updated to `ease-out`.
- **Wellness pill subtler.** Background 0.96 → 0.88 opacity, font 9.5 → 9px, softer shadow.

### 4. Artist detail (`artist.jsx`)
- **Hero enlarged.** 260px → 300px. Stage-color gradient blend in the overlay when photo is available.
- **Genre + stage in hero.** Below the genre label, a colored dot + stage name (e.g., `● AMERICAN EXPRESS`) in the stage color.
- **Larger artist name.** 48px → 52px (B2B: 32 → 34px) with `textShadow` for depth.
- **YouTube scoring upgraded.** Now fetches video stats (viewCount, duration) via the `videos` endpoint. Scoring: `relevance * 3 + durationBonus + log10(views)`. Prefers full sets (>50min = +6, >20min = +4). Cache key bumped to `_v2`. Fetches 8 results instead of 5.
- **YouTube card shows metadata.** Duration ("1H 23M" or "45 MIN") and view count ("2.4M VIEWS") displayed below the title.
- **YouTube card visual upgrade.** Rounded to 16px, deeper shadow, gradient overlay (top-to-bottom instead of flat), red play button with glow shadow.
- **YouTube loading skeleton.** Replaced plain "Loading…" text with a 16:9 skeleton card containing a spinning indicator.
- **Mixcloud search** uses `FESTIVAL_CONFIG.brand` instead of hardcoded "EDC".
- **YouTube fallback text** uses `FESTIVAL_CONFIG.brand` instead of hardcoded "EDC".

### 5. Tab bar (`chrome.jsx`)
- **Active indicator.** A 20×2.5px ember-colored bar appears above the active tab icon.
- **Smooth transitions.** `color` and `font-weight` transition over 0.15s.
- **Tighter padding.** Horizontal padding 8 → 12px, vertical gap 3 → 2px.

### 6. Search modal (`app.jsx`)
- **Slide-up entrance.** `animation: "slideUp 0.2s ease-out"` — fades in + translates up 12px.
- **Better quick-search chips.** Padding 5/12 → 6/14px, `fontWeight: 600`, background/border transitions.
- **New keyframes.** `slideUp` and `sheetUp` added to the global style tag.
- **Global button feedback.** `button:active { opacity: 0.75 }` for tap feedback.

### 7. Me tab (`spotify.jsx`)
- **Section dividers.** `borderTop` dividers between identity, history/badges, music, and friends/crew sections.
- **"Friends & crew" header.** Serif section title + mono subtitle before FriendsCard and CrewCard.
- **Recap card** uses `_cfg.brand` instead of hardcoded "EDC".

### 8. Global copy update
All EDC-specific copy updated to be multi-festival:
- `manifest.json` → "Plursky — Festival Companion"
- `package.json` → "Festival companion app — EDC, ACL, and more"
- `README.md`, `DESIGN.md` → generic descriptions
- `privacy.html` → "EDC, ACL, and more" / "18+ or 21+"
- `data.jsx` → artist bio fallback uses `FESTIVAL_CONFIG.name`
- `app.jsx` → onboarding body uses dynamic festival name

### 9. CSS (`index.html`)
- `button { transition: opacity 0.1s ease; }` — global press feedback.

---

## What remains (next session)

### Map — A++ architecture (the bottom-sheet unification)
The map currently has 4 competing bottom surfaces (search sheet, friends bar, meet-mode banner, stage place card). An Apple Maps–grade map would use a **single unified bottom sheet** with sections:

1. **Collapsed state:** Search input pill + mini heads-up (next set countdown, weather alert). Friends as small avatar dots along the bottom edge, not a separate bar.
2. **Half-expanded state:** Find Nearby chips, NextSet/Sunrise/Weather strips. Friends row appears here.
3. **Full-expanded state:** Search results when typing.
4. **Place card state:** When a stage is tapped, the sheet transforms to show the stage card (hero + lineup). No separate BottomSheet component — it's the same surface.

This is a structural refactor of the MapScreen bottom UI. Estimate: ~200 lines rewritten.

### Map — Meet mode clarity
- Add a brief toast/banner on enter: "Meet mode — tap the map to drop a pin"
- Stronger visual affordance: dim the map slightly, show a crosshair cursor
- "× CANCEL" should be more prominent (full-width bar, not a small button)

### Map — Stage place card density
- Split into two layers: **Summary card** (hero + walk time + now playing) and **Detail sheet** (full lineup, photos, vibe). Summary is the default; swipe up or tap "See full lineup" to expand.
- Day tabs should be sticky when scrolling the lineup.

### Grid — Polish
- Consider showing full stage names in header when only 8 stages visible (ACL has room at 94px × 8 = 752px + 44px gutter = 796px).
- Add a smooth scroll-snap on the day selector so swiping between days feels native.

### Typography system
- Audit and normalize to 4 tiers: Display (serif 28-52px), Title (serif 18-24px), Body (sans 13-15px), Label (mono 8-10px). Currently 12+ different sizes scattered across files.

### Loading states
- Artist detail sections (tracklist, setlists, similar artists) still use plain text loading. Replace with skeleton cards matching the final layout.

### Interaction polish
- Bottom sheets should use spring-physics `transform: translateY()` animation instead of `max-height` transitions.
- Save/unsave should show a brief visual confirmation (checkmark animation or color flash).
- Grid blocks should animate on filter changes (fade/scale transition, not instant opacity snap).
- DayStrip pill selector needs spring/bounce on the active segment.
- Stage place card needs a sheet-up entrance animation.

### Pre-festival Today tab
- Sparse beyond hero + countdown + empty lineup CTA. Add more hype content: lineup highlights, "X days until [headliner]" rotating cards, festival tips/essentials preview.

### Me tab progressive disclosure
- 8+ sections in a long scroll. Group into 2–3 collapsible zones: Identity & Stats (always open), Festival (history, badges, recap), Settings (notifications, battery, crew, account).

### Custom ACL map
- The official ACL background image is visually noisy even with dim + fade + vignette. Commission or build a clean custom illustrated map for ACL (similar to the EDC night-sky SVG). This is the single biggest visual upgrade remaining for the map.

### Android / small device testing
- Stress-test on Android Chrome, iPhone SE (375px), and landscape. The 48vh search sheet may obscure too much map on short devices.

---

## Expert judging panel (post-session 8)

1. **Design (typography, layout, hierarchy) — A-.** Instrument Serif + Geist Mono is a strong pairing. The desert-dawn palette is distinctive and cohesive. Grid header with stage-color accents is clean. Knocked down from A because there's no formal type scale — 12+ font sizes scattered across files. Padding varies between 14px, 16px, 18px, 20px on similar cards with no rhythm.

2. **Festival domain (does it actually help someone at ACL in October?) — A.** Countdown hero with Artist of the Day builds hype. Grid now correctly maps 11 AM–10 PM daytime sets. Day selection persists across tabs. Weekend 1/2 toggle, conflict detection, walking ETAs between stages, Spotify matching — these are features competing apps don't have. Knocked from A+ because the pre-festival Today tab is sparse beyond the hero + countdown + empty lineup CTA.

3. **Visual polish (the "feel it" factor) — B+.** The artist hero at 300px with stage-color gradient is cinematic. YouTube card with glow play button and metadata is premium. Tab bar ember indicator is a nice touch. But: no spring-physics on bottom sheets (uses `max-height` transitions which feel janky). Save/unsave is silent — no visual confirmation. Loading states are still plain text in 4 of 6 sections on the artist page. No skeleton screens.

4. **Map (the headline feature) — B+.** Background fade + vignette + consolidated controls are real improvements. Stage label pills are readable and well-anchored. But: 4 competing bottom surfaces (search sheet, friends bar, meet banner, place card) is not Apple-grade. Meet mode entry is implicit — just a button color change. The official ACL map background is still visually noisy despite the dim + fade. A custom illustrated map would be A++.

5. **Information architecture (flow, discoverability) — A.** Today → Lineup → Map → Me is a clean 4-tab structure. Artist detail page tells a complete story: hero → stats → bio → stage card → tracklist → live set → setlists → similar. The festival switcher pill in the nav is discoverable. Search covers artists, stages, genres, days. Knocked from A+ because the Me tab is a long scroll with 8+ sections — needs progressive disclosure.

6. **Interactivity (does tapping things feel alive?) — B.** Global `button:active` opacity is the bare minimum. Search modal slides up smoothly. But: no haptic patterns beyond `navigator.vibrate([30])` on save. No micro-animations on card appearances. The grid blocks don't animate on filter changes — they just snap to new opacity. Stage place card appears without a sheet-up animation. The DayStrip pill selector has no spring or bounce.

7. **Mobile / real-device readiness — A-.** Layout works on 390px iPhone. Grid scrolls horizontally. Safe area insets are handled. GPS label bumped to 9px for sunlight. But: hasn't been stress-tested on Android Chrome, small SE screens, or landscape. The 48vh search sheet might still obscure too much map on short devices.

8. **Code quality / multi-festival readiness — A.** All EDC-specific copy is now dynamic via `FESTIVAL_CONFIG`. Grid time range auto-detects from artist data. Stage colors, names, and counts adapt per festival. YouTube/Mixcloud searches use the active festival brand. Knocked from A+ because the EDC-specific SVG night-sky map (LVMS track, starfield, Daisy Lane plaza) still renders if someone switches back to EDC — that code path is solid but the ACL path relies on a busy background image that needs replacing with a cleaner custom map.

**Overall: A- / B+** — Strong product with real utility. The festival domain knowledge is genuinely impressive.

---

## Path to A++ across all 8 judges

### Design → A → A++ (current: A-)
- [ ] Establish a formal type scale: 4 tiers max (Display 28-52px serif, Title 18-24px serif, Body 13-15px sans, Label 8-10px mono). Grep every `fontSize` and normalize.
- [ ] Lock padding to a 4px grid: 8, 12, 16, 20, 24px only. Audit every card and section.
- [ ] Standardize border-radius to 3 values: 8px (small chips), 14px (cards), 999px (pills).

### Festival domain → A → A++ (current: A)
- [ ] Pre-festival Today tab needs more hype content: "X days until [headliner]" rotating cards, festival essentials checklist, weather forecast preview, travel tips.
- [ ] "What's changed since you last opened" — show new artists added, schedule changes, friend activity.
- [ ] Festival countdown should show the specific day/gate time the user cares about (Weekend 2 users see Oct 9, not Oct 2).

### Visual polish → A → A++ (current: B+)
- [ ] Spring-physics `transform: translateY()` on ALL bottom sheets and modals (replace every `max-height` transition).
- [ ] Skeleton loading screens for artist tracklist, setlists, similar artists, YouTube, Mixcloud sections.
- [ ] Save/unsave: checkmark burst animation + brief color flash on the card.
- [ ] Grid filter changes: blocks fade/scale with `transition: opacity 0.2s, transform 0.2s` instead of instant snap.
- [ ] Ambient touch: subtle parallax on the artist hero photo when scrolling.

### Map → A → A++ (current: B+)
- [ ] **Unify the bottom sheet.** Single surface with 4 states (collapsed → half → full → place card). Friends become avatar dots inside the sheet, not a separate bar. This is the single biggest UX upgrade.
- [ ] **Custom ACL map illustration.** Replace the busy official map image with a clean, Plursky-styled SVG or illustrated map. Stage areas as colored zones, paths as clean lines, no baked-in vendor logos.
- [ ] Meet mode entry: confirmation toast ("Tap the map to drop a pin"), map dims slightly, crosshair cursor.
- [ ] Stage place card: split into Summary (hero + walk + now playing) and Detail (swipe up for full lineup + photos). Sticky day tabs.

### Information architecture → A → A++ (current: A)
- [ ] Me tab: collapse 8+ sections into 3 disclosure groups (Identity & Stats, Festival, Settings).
- [ ] Artist page section-jump chips should highlight the active section as you scroll (scroll-spy).
- [ ] Add breadcrumb context: when navigating Artist → Schedule → back, show where you came from.

### Interactivity → A → A++ (current: B)
- [ ] Haptic vocabulary: light tap on navigation, medium on save/unsave, heavy on conflict detected.
- [ ] Card entrance animations: stagger-fade cards as they scroll into view (IntersectionObserver + CSS animation).
- [ ] DayStrip active pill: spring animation on segment change (translate + scale overshoot).
- [ ] Pull-to-refresh on Today tab and Lineup list.
- [ ] Long-press on artist grid block → quick-save without opening detail page.

### Mobile / real-device → A → A++ (current: A-)
- [ ] Test on Android Chrome (Samsung Galaxy S series), iPhone SE (375px), iPhone 15 Pro Max (430px), iPad.
- [ ] Search sheet: cap at 44vh on devices shorter than 700px.
- [ ] Grid: test horizontal scroll smoothness at 10 stages × 94px.
- [ ] Offline: verify every screen renders from cache when airplane mode is on mid-festival.

### Code quality / multi-festival → A → A++ (current: A)
- [ ] Build a clean ACL SVG map (or commission one) so ACL doesn't depend on a noisy background image.
- [ ] The EDC SVG night-sky code path (LVMS track, starfield, Daisy Lane plaza) should be behind a festival-specific renderer, not inline conditionals.
- [ ] Add a `FESTIVAL_CONFIG.mapStyle` field ("svg-custom" | "image-overlay") so the map component picks the right rendering path cleanly.
