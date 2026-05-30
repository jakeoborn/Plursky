# Plursky — To-Do List

> **Shipping?** See **[RELEASE.md](RELEASE.md)** — sync iOS, cache-bust, web
> deploy, and App Store submit commands.

## 🧪 REPORT-CARD ROADMAP — judge panel, 2026-05-30 (overall **B+**)

25-agent panel (UX/Visual/Value/Festival-goer/Perf+A11y) graded Map B+,
Lineup B+, Memories B+, Profile B (+ self-graded Home B+, Music B). Recurring
defects: weak search · WCAG-failing daylight contrast on key moments ·
unmemoized/unvirtualized renders. Prioritized:

1. ✅ **Memories metadata → Supabase backup** (97a8f01).
2. ✅ **Daylight contrast** (b35151b) — raised --muted across all 4 themes (AA). (Per-surface Recap-hero/place-card pixel polish still optional.)
3. ✅ **Lineup artist search** (3b… v196) — sticky search bar (artist/stage/genre) in LIST + GRID, clearable.
4. ✅ **Redesign Map place card** (v197→v198) — Apple-Maps-style metadata grid (WALK/DISTANCE/SETS cells). GO HERE now collapses the card to a purpose-built slim `StageNavBar` ("ROUTING TO <stage>") revealing the already-drawn walking route (v198 de-seam — no longer reuses the meet card). ♥ SAVE persists to localStorage + surfaces as a "SAVED SPOTS" chip row in the search sheet (v198 reachability). Modeled on Apple Maps "Foothills Park" + Zenly per Mobbin. Verified live (Playwright/ACL).
5. ✅ **Hardcoded `my-edc-2026.png` export → dynamic** (b35151b). (Stale tier cache still open.)
6. ✅ **Persistent 'SHARING · TAP TO STOP' badge** (b35151b).
7. ✅ **Rank + enrich Map search** (v196) — relevance ranking (exact>prefix>word-start>substring + tier tiebreak), rows show set time/day/★saved, STAGES/ARTISTS headers, friendly empty state; stagger dropped.
8. ✅ **Memoize Lineup filter chain + kill O(n²) conflict loop** (v196) — dayArtists/dayStats/savedToday/conflicts all useMemo'd over a Set-based saved lookup.
9. ✅ **Virtualize Memories** (v197→v198) — GRID view uses `_LazyMount` IntersectionObserver windowing (off-screen tiles unmount → free decoded media + revoke object-URLs = leaked-video-URL fix). NIGHT/GROUP `MomentCard` views now defer the photo via `useMomentPhoto(id, enabled)` + `useNearViewport` — off-screen cards drop their decoded image/URL but stay mounted (preserves in-progress retag state) (v198). MemoryReel clamps RAF dt + pauses on `visibilitychange`.
10. ✅ **Crew cell alert() → smooth scroll** (b35151b). (Dead Badges anchor already worked.)
11. ✅ **Lineup save UX** (v197) — 3s UNDO toast (reverts saved set + cloud tombstone) via upgraded `plurskyToast(text, {actionLabel,onAction,duration})`; grid long-press-to-save now shows live feedback (stage-color fill bar + block dip + haptic) and guards the trailing artist-nav click.
12. ✅ **A11y sweep** (v197→v199) — icon/emoji/SVG-only buttons + unlabeled `<img>` across all screens carry `aria-label`/`alt` (~35), icon toggles `aria-pressed`, bottom nav `aria-current`, toast `role=status aria-live`, global `:focus-visible` ring (2.4.7). v199 WCAG-finish: map stage hit-areas (SVG `<g>` + label divs) now `role=button`+`aria-label`+`tabIndex`+Enter/Space; place-card hero/GO HERE/nav-icon auto-flip ink dark-vs-white by luminance (`_inkOn`) so light stages (yellow/cyan/green) stay readable; metadata-cell note → `--muted` (was failing stage.color on light); Esc-to-close on place card + nav bar. Residual (minor, pre-existing long-tail): inherited stage-color content cards (vibe / "ON STAGE NOW") still use white-on-color for light stages; full SR walkthrough + focus-trap depth not yet audited.
- Phase B (later): photo/video BLOB backup to Supabase Storage (cost/Plus/wifi policy).

> **⏳ iOS 1.8 (19) PREPPED — awaiting archive.** Web @ **v198** with the full
> report-card cluster (#2/#3/#4/#5/#6/#7/#8/#9/#10/#11/#12). `dist/` rebuilt +
> `npx cap sync ios` done; pbxproj bumped to **MARKETING_VERSION 1.8 /
> CURRENT_PROJECT_VERSION 19** (both configs); native bundle re-synced + verified @ v198.
> **Remaining (Jake, interactive):** `npx cap open ios` → Any iOS Device →
> Product ▸ Archive → Distribute ▸ App Store Connect ▸ Upload. Last on-device
> build is still **1.7 (18)** until that lands. On-device smoke tests owed on
> 1.8: Apple Music BUILD PLAYLIST · Shazam-a-video · 2-device rally · ACL map.

## ⭐ MASTER OPEN ITEMS — updated 2026-05-30 (web @ **v199**; **iOS 1.7 (18) LIVE**, **1.8 (19) prepped — awaiting archive** 🎉)

_Session 13 shipped + LIVE on iOS 1.7: reel/recap audit, ACL map (real
artwork), spotify.jsx split ×3, recap-ready nudge, Spotify auto-create,
rally + crew-cluster meetup, Apple Music, native ShazamKit video-ID, the 4
music synergies._

### A. Ship-gate — on-device smoke tests, now owed on **1.8 (19)** (prepped @ v199, awaiting archive)
1. ✅ **iOS 1.7 (18) shipped & live.** Next archive = **1.8 (19)** (pbxproj bumped, dist/ synced @ v199).
2. **Test Apple Music "BUILD PLAYLIST"** + **Shazam a video** on the 1.8 build (on-device smoke test).
3. **2-device test** — rally-point + crew-cluster broadcast round-trip.
4. **In-app verify ACL map** renders on device.

### B. Music synergy (Spotify × Apple Music × Shazam) — ✅ ALL SHIPPED v188
5. ✅ **Your Weekend Soundtrack** — playlist from Shazam-confirmed moment songs + saved top tracks → Spotify OR Apple Music. (45e9151)
6. ✅ **Service-agnostic framing** — caption: saved sets → either service; beats Spotify's cap. (bd7848c)
7. ✅ **Shazam → attendance** — recognized song = proof of attendance, auto-markAttended. (bd7848c)
8. ✅ **Recap-video soundtrack from your songs** — exporter prefers a Shazam'd song's preview. (bd7848c)
   _All four need an on-device build (now 1.8 (19)) for Shazam to populate confirmed songs._

### C. Jake's manual / external actions
9. **Spotify Extended Quota Mode** application (unblocks playlist creation for >5 users).
10. **RevenueCat products + entitlements in ASC** — `plursky_plus_festival` $2.99, `plursky_plus_annual` $7.99/yr.
11. **Refresh Apple MusicKit token** before ~Nov 2026 (6-mo expiry) — `scripts/sign-musickit-token.mjs`.
12. ✅ **og-card.png** (1200×630) — present + referenced in index.html, live on plursky.com.

### D. Optional / deferred build
13. **recognize-song Edge Function** (web Shazam fallback; needs AudD/ACRCloud key) — low priority given iOS focus.
14. **Plus/RevenueCat monolith extraction** (last spotify.jsx split).
15. **YouTube server-side proxy** (protect 10k/day quota).
16. **Lineup virtualization** (300+ artists render perf).
17. **Native push notifications** — set-time reminders during festival.
18. **Smart search bar** (NL lineup queries) · **Friend-lookup backend** (PING codes) · **AR stage finder** · **Voice queries**.
19. **Account data export** (Apple compliance) · **Onboarding flow bump** · **Memory storage soft cap** · **Attendance edge cases**.
20. **Update ACL stage assignments + set times** when the official 2026 schedule drops (currently estimated from 2025).
21. **Re-enable RealMap (BETA)** post-festival.

### E. Ops / security (before scale)
22. **Supabase backups / PITR** · 23. **Uptime monitoring** · 24. **Supabase refresh-token rotation** · 25. **Rotate public API keys** (setlist.fm / YouTube / Last.fm / TM).

### F. Strategic
26. **Insomniac partnership pitch** (post-EDC evidence: Recap + memories + meetup).
27. **Multi-festival platform** expansion (registry exists; Coachella next).

---

_Older sweep: 2026-05-27. v1.4 (14) LIVE. A++ polish session done (stagger
animations, parallax hero, VFX onboarding, skeletons, haptics, keyboard
avoidance, arm64 fix)._

## ✅ v1.4 APPROVED & LIVE

**Status (2026-05-25):** Plursky Live `1.4 (14)` **APPROVED & LIVE**.
APP_STORE_ID = 6768888507. Cache-bust v164.

### What to watch for

- Email from `appstoreconnect@apple.com`:
  - "**Your app status is now In Review**" — picked up by a reviewer
  - "**Ready for Sale / Distribution**" — approved, can release
  - "**Rejected**" — see "If rejected" below

### If approved

- Hit **Release this Version** in App Store Connect (unless you set
  auto-release).
- Grab the numeric App Store ID from the listing URL and paste into
  `APP_STORE_ID` at `spotify.jsx:4693` (currently `null`). Bump
  cache-bust and push. Unblocks the rating-prompt web fallback.
- Move attention to the 🍿 v1.5 EPIC section below.

### If rejected — most likely reasons (in order of probability)

1. **NSPhotoLibraryUsageDescription wording** — already user-friendly
   in Info.plist ("attach photos and videos to the sets you caught
   at the festival"). If they push back, point at the App Review
   answer below.
2. **UGC moderation pushback on CrewChat** — already solved (v131 ships
   in-app Report + Block + Unblock).
3. **plursky:// URL scheme purpose** — they sometimes ask what custom
   schemes are for. Answer: round-trips the Spotify OAuth callback
   into the app from SafariViewController. Used only by `@capacitor/browser`
   's redirect handler.

### ✓ Completed submission steps

- [x] **`npx cap sync ios`** — done 2026-05-22
- [x] **Bumped to 1.3 (13)** in `project.pbxproj` — done 2026-05-22
      (commit `f7d8440`)
- [x] **Archived + submitted via Xcode** — done 2026-05-22

### What ships in v1.3 (build 13)

  - **v131** — UGC report + block on CrewChat (Apple G1.2 safety)
  - **v131** — Native local notifications via `@capacitor/local-notifications`
  - **v132** — Persisted 1:1 friend DMs via `crew_messages`
  - **v133** — iOS scroll fix (`contentInset: 'always' → 'never'`),
    native Spotify OAuth via `@capacitor/browser` + `plursky://callback`
  - **v134** — SVG TopDownMap pinch-zoom + pan + zoom buttons
  - **v135** — Memories with EXIF auto-tag, batch import, video support
  - **v137** — Attendance tracking (live GPS auto-detect + manual review),
    real "SETS CAUGHT" stat
  - **v138-v141** — Lineup grid restructure: 1-page all-3-days + saved
    sets sidebar + un-save × + scroll-position restore + day-picker sync
  - **v141** — Tappable Me-tab History rows; Keep Both on conflicts;
    photos never silently skip
  - **v142** — Spotify pill goes to artist page (cached `spotifyId`)
  - **v143-v144** — Setlist proxy (Edge Function) + venue-only setlists
  - **v145-v149** — Festival Recap screen with shareable image card,
    stages visited, walking distance, B2B, attended-sets Spotify
    playlist, hero photo, discovery, crew highlights
  - **v146** — Photo set-detection bug fix (was matching by time-only,
    ignoring date — Saturday photos could land on Friday artists)

### What's-New copy for App Store Connect (v1.5)

```
What song was playing when you took that photo?

NOW PLAYING
A floating bar shows what's playing at your stage in real
time — artist, song, and how many people are around you.
Tap the music note to Shazam-identify the exact track.

YOUR SOUNDTRACK
Every photo you import now shows the song that was playing
when you took it, matched from real DJ tracklists. Your
Festival Wrapped includes a "Your Soundtrack" card with your
top songs across the weekend.

CAPTURE THE MOMENT
Tap "Capture" on the Now Playing bar to save a timestamped
memory — the artist, the song, the stage — without even
opening the camera.

HAPTIC FEEDBACK
Subtle taps on save, share, and capture actions. Feels native.
```

### What's-New copy for App Store Connect (v1.4)

```
Built for the morning after the festival.

YOUR WEEKEND, RECAPPED
A new RECAP screen that wraps the festival into a single shareable
card — sets caught, top stage, top genre, walking distance, hidden
gem, headliners caught, your weekend playlist built from what you
actually saw.

MEMORIES, AUTO-TAGGED
Drop in photos and videos from your camera roll. Each one auto-tags
to the right night and artist by EXIF time + GPS.

NATIVE FIXES
Scroll snappier on iPhone. Spotify connect now opens in an in-app
Safari sheet and lands you straight back in Plursky. Set-time
reminders fire even when the app is killed.

CREW + CHAT
Persistent 1-on-1 DMs with crew. Report / Block on any message.
Crew chat highlights in your weekend recap.

PLUS
Pinch + zoom on the festival map. Lineup grid shows all three nights
on one page with your picks pinned in a vertical sidebar.
```

---

## 🔧 MANUAL STEPS YOU MUST RUN

One-time setup steps Claude can't do via tooling.

- [ ] **Spotify Quota Extension Request** (still pending — start now
      since approval takes 2–6 weeks). App
      `2219c68606c54629a8799f467a996a81` is in Development Mode
      (25-user allowlist). Until Quota Extension is approved →
      Production Mode, only allowlisted emails can create playlists.
      v84 modify-existing-playlist workaround is the bridge. Full
      submission workflow + paste-ready form answers in the
      "Spotify Quota Extension" appendix at the bottom of this file.

### 🔴 Manual steps from Session 10 (2026-05-27)

- [ ] **Finish RevenueCat product setup** — RevenueCat project "Plursky
      Live" exists, Apple app added (`com.plursky.app`), API key wired
      (`appl_...` in spotify.jsx:5578). Remaining steps:
      1. **App Store Connect → In-App Purchases** — create two products:
         - `plursky_plus_festival` — non-consumable, $2.99
         - `plursky_plus_annual` — auto-renewable subscription, $7.99/yr
      2. **RevenueCat → Products** — add both product IDs
      3. **RevenueCat → Entitlements** — create "plursky_plus" entitlement,
         attach both products to it
      4. **RevenueCat → Offerings** — create a "default" offering with
         both products
      5. **Test in Xcode sandbox** — sandbox Apple ID, purchase flow,
         verify entitlement check works

- [x] **Build & submit iOS 1.0.5** — submitted 2026-05-27.

- [x] **ShazamKit entitlement** — added to App.entitlements directly
      (com.apple.developer.shazamkit). Xcode UI search didn't find it
      but the entitlement is in the plist.

- [ ] **Deploy `og-card.png`** — file created (1200×630, desert-dawn
      palette). Upload to plursky.com static hosting. Already referenced
      by OG meta tags in index.html.

- [ ] **Deploy `recognize-song` Edge Function** — Supabase Edge Function
      that proxies mic audio to ACRCloud or AudD for web song recognition.
      Client code in spotify.jsx sends FormData with audio blob to:
      `https://pzoijbqsbbwyuyjinjtj.functions.supabase.co/recognize-song`
      Needs: ACRCloud account + API key stored as Supabase secret.

- [ ] **Real-device testing** — Android Chrome (Samsung Galaxy S series),
      iPhone SE (375px width), iPhone 15 Pro Max (430px), landscape mode.
      Check: VFX particle performance, night theme contrast, search sheet
      heights on short screens, grid horizontal scroll smoothness.

- [ ] **Spotify Quota Extension** — still pending from previous session.
      App `2219c68606c54629a8799f467a996a81` is in Development Mode.

### ✓ Completed from Session 9/10

- [x] **Bump cache-bust to v165** — done 2026-05-27 (commit `2162403`)
- [x] **Paste RC_API_KEY** — wired `appl_...` key from RevenueCat
      (commit `7a2c812`)
- [x] **arm64 in Info.plist** — was armv7 (would fail submission),
      fixed 2026-05-27
- [x] **A++ visual polish** — 10 items: IntersectionObserver stagger,
      skeleton grids, VFX onboarding, FESTIVAL_CONFIG types, stage-color
      search dots, parallax hero, conflict haptic, entrance animations,
      Spotify spring, CSS custom properties
- [x] **iOS keyboard avoidance** — visualViewport resize listener
- [x] **Debug console gating** — map.jsx + spotify.jsx console.log
      behind dev flag
- [x] **Full code audit** — 0 open items. Fixed: 7 reversed ACL times,
      duplicate stage coords, all hardcoded EDC strings, null guards,
      ICS timezone dynamic, TabBar refresh, attendance boundary, aria
      labels, toggleSave stale closure, SearchModal crash guard
- [x] **ACL schedule fixes** — DAYS dynamic, stage names expanded,
      duplicate IDs fixed, times shifted to 12 PM start
- [x] **iTunes photo fallback** — useArtistPhoto falls back to iTunes
      API when Spotify not connected
- [x] **Cinematic artist VFX** — breathing color wash (Spotify-inspired)
- [x] **OG card created** — og-card.png + og-card.svg in repo

### ✓ Completed manual steps

- [x] **2026-05-15** — `crew_message_reports` DDL applied
      (`v131_crew_message_reports_ugc_moderation`)
- [x] **2026-05-15** — `crew_messages` policy widened 12 → 40
      (`v132_widen_crew_messages_code_bound`)
- [x] **2026-05-15** — `plursky://callback` added to Spotify dashboard
      Redirect URIs
- [x] **2026-05-17** — `proxy-setlist` Edge Function deployed (CORS
      fix for setlist.fm)

---

## 🍿 v1.5 EPIC — RECAP VIDEO + COLLAGE EXTENSIONS

Phase 1 of the recap video story already shipped in v1.4 — the static
photo collage (`_renderCollage` in `spotify.jsx` plus per-artist /
per-stage / per-night / weekend share buttons across the app). Phase 2
is the video upgrade.

### Already shipped in v1.4

- ✅ Per-artist collage on Artist screen
- ✅ Per-stage collage on Map place card
- ✅ Per-night collage on Memories tab night header
- ✅ Weekend collage on Recap screen

### ✅ Phase 1 — SHIPPED (2026-05-25)

- [x] **Crew collage** — `_shareCrewCollage`, overlap-priority photo
      selection, crew avatar circles in footer, crew totem photo picker
- [x] **Animated GIF** — gif.js lazy-loaded, Ken Burns + crossfade,
      🎬 GIF button on all 5 entry points, gradient progress banner
- [x] **Crew totem** — photo picker for physical festival totem,
      renders on collage header, breathing pulse animation

### ✅ Phase 2 — SHIPPED (2026-05-25)

- [x] **Recap video engine** — Canvas frame sequencer → MediaRecorder
      WebM at 30fps/4Mbps. `_renderRecapVideo` + `_shareRecapVideo`.
- [x] **Beat detection** — Web Audio `decodeAudioData` → RMS energy
      windowing → peak extraction with 250ms debounce.
- [x] **3 templates** — Highlight Reel (fast zoom cuts on beats),
      Festival Diary (slow crossfades, Plus-only), Day-in-the-Life
      (slides, chronological, Plus-only).
- [x] **Plursky+ paywall** — `_isPlusSub()`, diagonal watermark on all
      free-tier exports, `PlusGate` component, rate limit (5 shares/day
      free, unlimited Plus).
- [x] **Custom music import** — Spotify track search + iTunes fallback,
      inline preview playback (Plus-only).

### ✅ Wow features — SHIPPED (2026-05-25)

- [x] 🧬 **Festival DNA** — unique color barcode from photo dominants
- [x] 🛂 **Festival Passport** — stamped stage card with badge
- [x] 🎞️ **Film Strip** — retro Kodak negative with sprocket holes
- [x] ⚔️ **Crew Showdown** — head-to-head stats comparison card
- [x] 🎵 **Spotify overlay** — "You've played this X×" on video
- [x] 🎥 **3D parallax** — depth layers on video frames (Plus-only)
- [x] 🎨 **Custom accent** — color picker in Recap (Plus-only)
- [x] 📂 **Festival archive** — past recap snapshots (Plus-only)
- [x] 🔓 **Priority preview** — early access to new festivals (Plus)
- [x] 💬 **Crew promo** — subtle upsell every 15 messages (free only)
- [x] 📊 **Genre breakdown** — bar chart RecapCard from caught artists
- [x] ⚡ **Festival Vibe Score** — energy ring (0-100) RecapCard

### ✅ Multi-festival — SHIPPED (2026-05-25, enhanced 2026-05-26)

- [x] **ACL 2026** — 10 stages at Zilker Park, 131 artists (W1/W2),
      GPS anchors, official 2025 map as background, weekend toggle
- [x] **Multi-festival data switching** — STAGES/ARTISTS/AMENITIES
      resolve per active festival via conditional at bottom of data.jsx
- [x] **Official maps** — EDC 2026 + ACL 2025 patron maps as SVG
      backgrounds with interactive stage markers overlaid
- [x] **GPS anchors for ACL** — 3 calibrated + 8 derived for Zilker Park
- [x] **Weekend 1/2 toggle** — W1/W2/BOTH filter + badge pills on cards
- [x] **Honda stage** — ACL sub-headliner stage added (was missing)
- [x] **6 missing ACL artists** — The Marias, Role Model, Rilo Kiley,
      Djo, Pierce The Veil, Sabrina Claudio

### Monetization — LIVE (code-side, IAP not wired)

- Free: 1080p collages (watermarked), 5 shares/day, Highlight Reel
  template, auto-selected soundtrack, all features accessible
- **Plursky+ ($2.99/festival or $7.99/yr)**: no watermark, unlimited
  shares, 3 templates, custom soundtrack, 3D parallax, Spotify overlay,
  custom accent, festival archive, priority preview, no crew promo
- Test at 5% conversion of 10k users × $3 = $1.5k/festival baseline

### What's left for v1.5

- [x] **Bump cache-bust** v163 → v164 — done 2026-05-25
- [x] **NowPlayingBar debug toggle** — `localStorage.setItem("plursky-debug-live", "true")`
- [x] **iOS deployment target** 13.0 → 15.0 (RevenueCat requires it)
- [x] **iOS version bump** to 1.5 (15) — ready to submit
- [x] **5 new tracklists** — Sub Focus, Peggy Gou b2b Ki/Ki, Vintage Culture, MEDUZA, The Prodigy
- [x] **handleCapture storage fix** — was writing to wrong key + format
- [x] **Wire RevenueCat API key** — `appl_...` key pasted (2026-05-27)
- [ ] **Set up RevenueCat products + entitlements** — see Manual Steps

### What's new in v1.6 (submitted 2026-05-27)

- [x] All v1.5 A++ visual polish (stagger, parallax, VFX onboarding, etc.)
- [x] iTunes photo fallback (artist photos without Spotify)
- [x] Cinematic breathing VFX on artist cards
- [x] ACL schedule: headliner times matched to 2025 pattern, zero conflicts
- [x] Full stage names in filters (HONDA, TITO'S, LADY BIRD, etc.)
- [x] Dynamic DAYS from FESTIVAL_CONFIG (no more hardcoded EDC dates)
- [x] Full code audit: all critical + high + low items fixed
- [x] ShazamKit entitlement + App Service enabled

### v1.7 Roadmap — API Integration A++

**Shipped (web, pending next iOS build):**
- [x] Last.fm label fix (LISTENERS not MONTHLY)
- [x] Preview URL caching in localStorage
- [x] ShazamKit 10s timeout + progress
- [x] Web audio recording progress counter
- [x] Spotify scan streaming progress ("PLAYLIST 6/12")
- [x] Preview audio 300ms fade-out on card close
- [x] Auto-sync saved sets to cloud (3s debounce)
- [x] Presence heartbeat every 60s

**Still to build:**
- [ ] **Activate Apple Music** — all code written, just needs MusicKit JWT
- [x] **Error vs empty state** — retry buttons on Setlists, YouTube, Ticketmaster
- [x] **Playlist rebuild progress** — "BUILDING · 12/40 ARTISTS"
- [ ] **YouTube server-side proxy** — protect 10k/day quota (needs Supabase deploy)
- [x] **Uber/Lyft deep links** — already existed in RideshareSheet
- [x] **Weather loading skeleton** — skeleton card while NWS loads
- [x] **Hourly weather** — NWS forecastHourly, 12h temp sparkline on Tonight card
- [x] **Cloud sync conflict resolution** — removal tombstones with timestamps
- [x] **Per-festival recap archive** — auto-archive on festival switch + archive list
- [x] **Storage 80% warning** — banner in StorageManager
- [ ] **Zilker Park map** — needs SVG asset from Jake
- [ ] **Hourly weather** — OpenWeatherMap for festival-day granularity
- [ ] **Conflict resolution for cloud sync** — removed_ids or timestamps
- [ ] **Track recognize-song edge function** — source not in repo
- [ ] **Test ShazamKit** on physical device
- [ ] **Submit iOS 1.5 (15)** to App Store
- [ ] **ACL stage assignments** — update when official schedule drops
- [ ] **ACL set times** — update with real times (currently estimated)
- [ ] **Zilker Park map** — TopDownMap SVG or MapLibre for ACL
- [ ] **AI cut detection** — deferred (needs CoreML or server-side)

---

## 🟠 PRODUCT GAPS — sessions, not one-liners

Ordered by impact-per-engineering-hour.

- [x] **v1.4 native photo picker** — SHIPPED in v1.4 (submitted
      2026-05-25). `@capacitor/camera@^6.1.3` in Podfile;
      `NSPhotoLibraryUsageDescription` set; `__USE_NATIVE_PICKER__`
      flag flipped on for native platforms in `index.html`.
- [x] **Manage storage UI** — StorageManager component at bottom of
      Memories screen with per-night purge + clear all. v150.
- [ ] **Re-enable RealMap post-festival** — both implementations are
      in the binary; `MapScreen` calls `TopDownMap` at `map.jsx:2269`.
      Swap to `<RealMap …>` (or a runtime toggle) to bring back the
      MapLibre + heatmap + Apple-Maps-style chrome. ⚠️ Do NOT purge
      `TopDownMap` — it's the live map.
- [ ] **Apple Music dev token** — code side is done (v152). All that's
      left is YOUR steps on Apple Developer:
      1. developer.apple.com → Certificates, Identifiers & Profiles →
         **Keys** → "+" → name it "Plursky MusicKit" → enable **MusicKit**
         → pick or create a MusicKit identifier (bundle-form like
         `music.com.plursky.app`).
      2. Download the `AuthKey_XXXXXXXXXX.p8` (Apple lets you download
         ONCE — save it).
      3. Edit `KEY_ID` in `scripts/gen-musickit-jwt.mjs` to the 10-char
         ID from the filename.
      4. Run `node scripts/gen-musickit-jwt.mjs | pbcopy`
      5. Paste the JWT into `APPLE_DEV_TOKEN` (top of `spotify.jsx`).
      6. The card auto-unhides; commit + push + sync iOS.
      JWTs expire every ~6 months — recurring task.
- [x] **Capacitor Share for recap card + data export** — DONE 2026-05-20
      (v152). Both `_shareRecapCard` (spotify.jsx) and `sbExportUserData`
      (supabase.jsx) now branch on `Capacitor.isNativePlatform()` and
      use `Capacitor.Plugins.Share.share({ files: [dataUrl] })` first.
      Falls back to `navigator.share` then blob-URL download. Reads the
      blob as a base64 data URL before handing to the plugin — Capacitor
      Share accepts data URLs but not raw File objects.
- [x] **Paste the App Store ID into `APP_STORE_ID`** (`spotify.jsx`)
      — done 2026-05-25 (APP_STORE_ID = 6768888507).
- [ ] **Lineup virtualization** — list view renders all 300+ artists
      at once. Fine on a fast phone, sluggish on older ones. Wrap in
      a windowing strategy (intersection-observer-based render
      windowing — no library needed).
- [ ] **Per-festival recap archive** — Recap is wired to
      `FESTIVAL_CONFIG` (the current festival). Future festivals will
      overwrite stats unless we snapshot attendance + memories +
      moments per `FESTIVAL_CONFIG.id` and let users tap back to past
      recaps. Right now the recap only ever represents "this
      festival."
- [ ] **Account data export** — Apple is starting to ask. JSON dump
      of `state.saved`, `plursky_attended_v1`, `plursky_moments_v1`
      (metadata only, not blobs), Memories photo IDs, and any cloud
      pull. Trigger from Me → Cloud account card → "Export my data".
- [ ] **Smart search bar** — natural-language lineup queries
      ("something like Lane 8 but darker"). Replaces the removed v97
      BYOK chat. Needs a server-side LLM proxy Edge Function +
      `@anthropic-ai/sdk` (or OpenAI / Cohere); ranks
      lineup artists by similarity to the user's query.
- [ ] **Friend lookup backend** — PING (LIME/FROG/NEON/PLUM codes) is
      demo-only; CREW presence is real. Either: (a) deprecate PING
      entirely so users only see crew code joins, OR (b) build a real
      pid↔code server-side mapping in Supabase (table:
      `friend_codes(code text primary key, pid text)`).

---

## 🟡 POLISH + RISK REDUCTION

- [x] **Wire `@capacitor/haptics` into primary CTAs** — Dim Hour shipped
      this 2026-05-21 (commit on main; see Dim Hour memory
      `feedback_check_skills_catalog_first.md` for the broader skill-
      catalog directive that motivated it). Same pattern fits Plursky:
      `_haptic('light')` on save-set toggle, crew-message send, recap
      share; `_haptic('medium')` on the more weighty CTAs (Spotify
      connect, save full lineup, generate playlist). Install:
      `npm i @capacitor/haptics && npx cap sync ios`. Helper pattern:
      ```js
      window._haptic = function(kind){
        try {
          var H = window.Capacitor?.Plugins?.Haptics;
          if (!H) return;
          H.impact({ style: kind === 'medium' ? 'MEDIUM' : 'LIGHT' });
        } catch(e){}
      };
      ```
      Founder direction 2026-05-21: micro-interactions are the
      difference between "feels native" and "feels like a webview."
- [ ] **Native push notifications** — set-time reminders fire (local
      notifications, v131), but no remote push for "your crew just
      sent a message" or "your saved set starts in 5 min — check the
      map." Lower priority post-festival; bigger value in pre-show
      hype next year.
- [ ] **Notification UX during festival** — Plursky is silent during
      sets you saved unless you've set reminders. Could nudge "Tiësto
      starts in 5 min · Kinetic Field" as a passive bottom-of-screen
      banner.
- [ ] **Onboarding flow bump** — `OnboardingModal` is pinned to
      `ONBOARD_VERSION = "v1"`. Bump if/when the welcome flow changes
      substantively; everyone re-onboards once.
- [ ] **Memory storage soft cap** — once we have storage UI, surface
      a soft warning when IndexedDB exceeds e.g. 80% of
      `storage.estimate().quota`.
- [ ] **Attendance edge cases** — GPS auto-detect only ADDS, never
      removes. If a user walks past a stage briefly, they get marked
      as attending. Need a "Mark not attended" path on the GPS toast.

---

## ⚙️ OPERATIONAL HARDENING (no code change)

Risk-reduction items that don't touch the bundle.

- [ ] **Enable Supabase backups / PITR** — Supabase Dashboard →
      Database → Backups. Free tier gives daily 7-day-retention; Pro
      adds Point-in-Time Recovery.
- [ ] **Set up uptime monitoring** — UptimeRobot (free) on
      `https://plursky.com/`, `proxy-setlist` Edge Function (OPTIONS),
      and `https://pzoijbqsbbwyuyjinjtj.supabase.co/rest/v1/`. Alert
      email → phone.
- [ ] **Enable Supabase refresh-token rotation** — Dashboard → Auth
      → Sessions → "Rotate refresh tokens on use".
- [ ] **Rotate the public setlist.fm + YouTube + Last.fm + TM API
      keys** if any have been heavily used by random visitors. Keys
      are currently HTTP-referrer-restricted in their providers'
      dashboards.

---

## 🟢 SPECULATIVE — 2027 territory

- [ ] **Multi-festival platform** — `FESTIVAL_CONFIG` registry exists
      but only EDC LV 2026 is selectable. EDC Orlando 2027 / Coachella
      / NYE could plug in once the per-festival recap-archive lands.
- [ ] **IRL meetup mechanic — Plursky tests this first per founder
      direction 2026-05-21.** Group meetup pins on the festival map
      (leverages existing map + crew/DMs from v132/v134) likely the
      lowest-cost first ship. Pre/post-festival hangs + carpool/hotel-
      share are the broader meetup surface. See memory
      `project_irl_meetup_moat.md` for sequencing. Open prereqs: cold-
      start mechanic per festival, trust/safety layer, RSVP cap,
      cancellation flow, liability framing.
- [ ] **browse.sh skill catalog for event discovery + meetups** —
      `meetup.com/search-events` and `ticketmaster.com/find-ticket`
      from the browse.sh skill catalog (already wired into Dim Hour
      session) could feed the multi-festival expansion + meetup
      discovery features. Prereqs: `BROWSERBASE_API_KEY` set; per-skill
      SKILL.md recipes fetched. Catalog lives at https://browse.sh.
- [ ] **Insomniac partnership pitch** — post-EDC attendance + memory
      data is real evidence. Use the Recap screen as the demo.
- [ ] **Real-time friends-on-map** — CREW presence broadcast already
      runs; could surface live pins on the festival map.
- [ ] **AR stage finder** — point phone camera, identify stage by
      silhouette, drop a "you are here" pin.
- [ ] **Voice queries / Apple Intelligence** — "when does Tiësto
      play" via Siri shortcut.

---

## 📚 LISTING TEXT — paste-ready for App Store updates

Kept for future version submissions; the first submission used these
verbatim.

### Name
```
Plursky Live
```

### Subtitle (30 chars max)
```
Festival companion - EDC 2026
```

### Promotional Text (170 chars max — editable any time without resubmit)
```
Built for EDC Las Vegas 2026 - 250 artists, 9 stages, 3 nights. Spotify match, playlist builder, stage map, crew chat. Free, no ads, works offline at the festival.
```

### Description
```
Your last festival was chaos.

Plursky fixes it. Built for EDC Las Vegas 2026, it turns 250 artists, nine stages, and three sleepless nights into a single clean plan you can hold in your hand.

MATCH THE LINEUP TO YOUR TASTE
Connect Spotify (PKCE - your token never leaves your device) and Plursky lights up every artist you already love across all three nights. Discovers deep cuts you didn't know you needed.

BUILD YOUR PERSONAL PLAYLIST
One tap turns your saved sets into a Spotify playlist sorted FRI to SAT to SUN by stage time. Walk in already knowing the songs.

STAGE MAP + LIVE FRIENDS
See your position, all nine stages, sunrise sets, last shuttle times - and your crew's pins in real time, scoped to a 6-character code only you share.

CREW CHAT
Group thread for whoever's holding the same code. Persistent (late joiners see the history), real-time, zero phone numbers required.

WEEKEND RECAP
Spotify-Wrapped-style summary of your festival — sets caught, top stage, top genre, hidden gem, walking distance, headliners. Sharable as a single image.

OFFLINE-FIRST
The Vegas desert eats LTE. Plursky precaches the full lineup, stage map, and your saved sets on first load - works fully offline once you're inside the festival.

NO ADS, NO TRACKING, NO RESALE
Plursky is free and stays free. We do not run ads, do not sell your data, and do not store your location anywhere - your GPS is used for the in-app map only.

Privacy policy: plursky.com/privacy
```

### Keywords (100 chars max)
```
lineup,vegas,rave,edm,schedule,dj sets,playlist,set times,plur,kandi,stage map,discover
```

### App Review reviewer notes (v1.5)
```
Plursky is a free festival-companion app. No ads, no analytics, no
third-party tracking. Works offline once content is precached.

NEW IN v1.5:
  - NOW PLAYING BAR — floating widget during festival hours showing
    the user's current stage (via GPS), the artist playing, and the
    estimated song (matched from 1001tracklists data). Includes:
    · ShazamKit integration for real-time song identification (new
      NSMicrophoneUsageDescription — mic used ONLY when user taps
      the "What's playing?" button, never in background)
    · "Capture This Moment" button to save a timestamped text-only
      memory of the current artist + song without taking a photo
    · Supabase Realtime presence counter ("47 HERE") per stage
  - SHAZAMKIT PLUGIN — native Swift plugin using SHSession for
    music identification. 12s auto-timeout, stops on first match.
    Gracefully falls back to estimated song if no match.
  - SONG-TO-PHOTO MATCHING — 23 artist tracklists (558 tracks)
    from 1001tracklists.com. Each imported photo gets a "♫ playing"
    chip showing the estimated song at the moment the photo was taken.
  - SET PROGRESS BAR — "35min into 70min set" with stage-colored fill
    on photo cards.
  - WRAPPED SOUNDTRACK — "Your Soundtrack" card in Festival Wrapped
    with top songs aggregated from photo timestamps. "Find on Spotify"
    button for each song.
  - HAPTIC FEEDBACK — @capacitor/haptics on save-set, share, capture,
    and Spotify connect actions.

ALL v1.4 FEATURES UNCHANGED.

NSPhotoLibraryUsageDescription string:
  "Plursky uses your photo library so you can attach photos and
  videos to the sets you caught at the festival."

ALL PRIOR v1.3 FEATURES UNCHANGED.

CORE FEATURES (no account required):
  - Lineup: 250 artists, 9 stages, 3 nights
  - Map: stage map with live GPS (in-browser only, never sent to server)
  - Save sets, mark attended, build Spotify playlist of what you saw
  - Optional Spotify PKCE OAuth to match the lineup. Read-only; tokens
    stay on device.

TO TEST SIGN IN WITH APPLE (Guideline 4.8):
  1. Welcome wizard → "ME" tab → "Cloud account" → "Sign in with Apple"

TO TEST ACCOUNT DELETION (Guideline 5.1.1(v)):
  After signing in, scroll to bottom of Cloud account → "DELETE
  ACCOUNT" → two-step confirm. Calls a Supabase Edge Function that
  hard-deletes both the auth.users row and the user_data row.

UGC SAFETY (Guideline 1.2):
  CrewChat is a closed-group thread restricted to users sharing a
  6-character invite code. NO public discovery, NO direct messaging
  between strangers, NO user profiles. Every non-mine message has a
  "⋯" menu with Report and Block. Reports persist a snapshot of the
  body + sender so deletion can't destroy evidence. Plursky commits
  to 24h response to reports at hello@plursky.com.

LOCATION USAGE:
  Map tab uses CLLocationManager via WebView
  (NSLocationWhenInUseUsageDescription set). Coordinates are used
  in-browser for the map dot AND for attendance auto-detect (matches
  the user's stage anchor distance against current playing set).
  Never transmitted to any server. See privacy policy.
```

---

## 📅 APPENDIX — Spotify Quota Extension Request workflow

**Submission workflow:**
1. Sign in at https://developer.spotify.com/dashboard with the dev
   account that owns app `2219c68606c54629a8799f467a996a81`
2. Open Plursky app → click "Request Extension" / "Extend Quota"
3. Fill out the form (answers below)
4. Record a 1–2 min demo video, upload to YouTube unlisted
5. Take 3–5 screenshots
6. Submit; check email for follow-up questions

**Form answers (copy/paste):**
- Commercial use? → **No** (free PWA, no monetization)
- App URL → `https://plursky.com`
- User estimates → "~5,000 in first festival year, growing"
- App description:
  > Plursky is a free Progressive Web App for attendees of EDC Las Vegas 2026 (~150K attendees). It uses Spotify to (1) match the user's top + followed artists against the festival's 250+ artist lineup so they discover sets they'll like, (2) build a personalized Spotify playlist of their saved sets sorted FRI→SAT→SUN by stage time. No commercial use. No data resold or stored — all listening data stays in-browser via PKCE.
- Integration description:
  > User connects Spotify via PKCE OAuth. We call /me/top/artists, /me/following, /me/tracks, /me/recently-played to derive their music taste, then match against our hand-curated EDC lineup data. Optional second flow: user taps "Build My Playlist" which calls POST /users/{id}/playlists to create a "My EDC Lineup" playlist, then /search?type=track + POST /playlists/{id}/tracks to fill it with each saved artist's top tracks. All listening insights are surfaced read-only — the playlist write is the only mutation.

**Endpoints used:**
```
GET    /v1/me
GET    /v1/me/top/artists
GET    /v1/me/top/tracks
GET    /v1/me/following?type=artist
GET    /v1/me/player/recently-played
GET    /v1/me/tracks
GET    /v1/me/playlists
GET    /v1/search?type=artist,track
GET    /v1/artists/{id}
POST   /v1/users/{id}/playlists          ← blocked currently, key ask
POST   /v1/playlists/{id}/tracks
PUT    /v1/playlists/{id}
PUT    /v1/playlists/{id}/tracks
DELETE /v1/playlists/{id}/tracks
```

**Scopes requested:**
```
user-top-read user-read-recently-played user-library-read
user-read-private user-read-email user-follow-read
playlist-read-private playlist-modify-public playlist-modify-private
```

**Demo video script (1–2 min):**
1. Open `plursky.com` → tap Music tab
2. Tap **Connect Spotify** → grant scopes
3. Show top-artist matches lit up in lineup
4. Save 5–10 sets in Lineup tab
5. Tap **BUILD MY PLAYLIST** → success → open in Spotify
6. Show resulting playlist with tracks
