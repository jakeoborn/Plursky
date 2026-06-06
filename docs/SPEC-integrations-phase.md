# Plursky — Integrations Phase Spec (2026-06-06)

> **STATUS 2026-06-06 (end of day):** #1 ✅ v223 · #2 ✅ v224 (was already
> built — audit below missed it; only the OPEN↗ link was added) · #3 ✅ no
> code (already wired AND live: `proxy-setlist` Edge Function deployed with
> SETLISTFM_KEY — the "free key" dep below is stale) · #5 ✅ v225 (export
> existed in NightWizard; added native share path + Lineup toolbar chip).
> **Remaining: #4 (native Live Activity) and #6 (festival year, builds on #1).**
> Lesson for #4/#6: grep before building — items 2/3/5 all partially existed.

Source: agent-browser (Playwright) gap audit of the live app, screen by screen.
Plursky's core loop is solid (capture → auto-tag to artist → relive). The
biggest *strategic* gaps are **distribution** (the app makes memories but can't
push them out) and a few high-value **connectors**. Ordered by leverage.

Each item: **What · Why · How · Deps · Effort · Verify**. Build one per session
(Jake prefers a fresh chat per feature). Web items ship on push to main +
`cap sync ios`; native items need an Xcode device build to verify.

---

## 1. 9:16 story-format recap export  ⭐ HIGHEST LEVERAGE
- **What:** Export the recap as a vertical 1080×1920 video/image with the
  artist name + caught song overlaid, into the iOS share sheet (→ Instagram
  Stories / TikTok / Messages).
- **Why:** The app makes memories but they never leave it. Apple/Google Photos
  and Snap auto-make shareable reels — that's the organic growth loop, and the
  concrete artifact for the Insomniac pitch.
- **How:** Reuse `recap-engine.jsx` (the in-app reel already composes frames).
  Add a 9:16 render target → canvas/MediaRecorder (web) or a native share of
  the rendered file via `@capacitor/share`. Overlay: artist + "♫ song" +
  Plursky watermark (the free-tier differentiator — keep the watermark).
- **Deps:** none (no API key). `@capacitor/share` already in the project.
- **Effort:** Medium. **Verify:** render → open the file → confirm 9:16, overlay
  legible, share sheet lists IG/TikTok. Device build for the real share sheet.

## 2. Apple Music weekend playlist
- **What:** "Create your weekend soundtrack" in Apple Music, mirroring the
  existing Spotify playlist path.
- **Why:** Spotify is wired but ~half of users are Apple Music; the MusicKit
  **dev token is already in the code** (`APPLE_DEV_TOKEN`), so this is low-hanging.
- **How:** MusicKit JS / Capacitor MusicKit: auth → create playlist → add the
  Shazam-confirmed + tracklist-estimated songs (same source list
  `createEdcPlaylist` already builds for Spotify in `spotify-api.jsx`).
- **Deps:** MusicKit token (present); user Apple Music auth at runtime.
- **Effort:** Low–Medium. **Verify:** create on a real Apple Music account →
  playlist appears with the right tracks.

## 3. Setlist.fm integration
- **What:** Pull the *actual* played setlist for a set the user attended →
  show "the real songs you heard" instead of (or alongside) the estimate.
- **Why:** Deepens the core differentiator — turns the song tag from an
  estimate into ground truth, complementing Shazam.
- **How:** Setlist.fm REST API (free key) — match by artist + festival + date.
  Feed results into `SetSongTimeline` / `useSetlistSong`. Cache per set.
- **Deps:** Setlist.fm API key (free, Jake registers). Coverage varies by
  artist — fall back to the current estimate when no setlist exists.
- **Effort:** Medium. **Verify:** a known set with a published setlist shows
  the real songs; a set without one falls back cleanly.

## 4. iOS Live Activity / Lock-Screen widget
- **What:** "Next set: Kinetic · 20 min" on the Lock Screen / Dynamic Island
  during the festival, from saved sets + current time.
- **Why:** The live-event use-case competitors do poorly — high daily-active
  value on-site.
- **How:** Native (ActivityKit / WidgetKit) Swift target; feed it the saved
  set schedule. Capacitor passes the data; the Live Activity is native.
- **Deps:** Native target + entitlement. Device-only.
- **Effort:** High (native). **Verify:** device build → start an activity →
  confirm Lock Screen/Dynamic Island updates as the next set approaches.

## 5. Calendar (.ics) export of saved sets
- **What:** "Add my schedule to Calendar" → an .ics with each saved set
  (conflict-aware times), pre-festival.
- **Why:** Pre-festival utility + a reason to plan in Plursky early.
- **How:** Generate .ics from saved artists (`edc_saved` + lineup times,
  `toNightMin` for post-midnight) → `@capacitor/share` / data-URL download.
- **Deps:** none.
- **Effort:** Low. **Verify:** export → opens in Apple/Google Calendar with
  correct times across midnight.

## 6. "Your festival year" — cross-festival recap
- **What:** A Spotify-Wrapped-style annual recap across all festivals attended
  (sets caught, top artists, total moments, a shareable card).
- **Why:** You already store multi-festival data; an annual shareable is a
  natural growth + retention artifact and strong pitch material.
- **How:** Aggregate across `_activeMoments` per festival + attended sets;
  reuse the recap/share engine; export via item #1's 9:16 pipeline.
- **Deps:** builds on #1 (share export).
- **Effort:** Medium. **Verify:** populated multi-festival account renders a
  correct aggregate card.

---

## Recommended order
**#1 (story export) → #2 (Apple Music) → #5 (calendar)** are all
no-new-dependency, high-value, web-shippable — do those first. **#3 (Setlist.fm)**
needs a free key. **#4 (Live Activity)** and **#6 (festival year)** are bigger
(native / depends on #1) — schedule after.

## Not in scope (separate tracks, already in TODO)
- Ship v222 (spine + 4 visual fixes) — pending Jake's go.
- Owed on-device QA (auto-tag/Shazam/backup/Plus/GPS) — Jake on device.
- Map discoverability tweak — low-pri design.
