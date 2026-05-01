# Plursky — To-Do List

## Needs External Setup (can't do in code alone)
- [ ] **Spotify Quota Extension Request** — App `2219c68606c54629a8799f467a996a81` is in Development Mode (25-user allowlist). Until Quota Extension is approved → Production Mode, only allowlisted emails can create playlists. v84 modify-existing-playlist workaround is the bridge; quota extension is the real fix (unblocks `POST /users/{id}/playlists` AND `/top-tracks`). Approval takes ~2–6 weeks. Respond to Spotify follow-up email within 7 days or they close the request.

  **Submission workflow:**
  1. Sign in at https://developer.spotify.com/dashboard with the dev account that owns the app
  2. Open Plursky app → click "Request Extension" / "Extend Quota" (top of page or under App Settings)
  3. Fill out form — see prepared answers below
  4. Record 1–2 min demo video, upload to YouTube unlisted
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
  GET    /v1/me/tracks (saved library)
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

  **Demo video script (1–2 min, QuickTime / Win+G):**
  1. Open `plursky.com` → tap Music tab
  2. Tap **Connect Spotify** → grant scopes
  3. Show top-artist matches lit up in lineup
  4. Save 5–10 sets in Lineup tab
  5. Tap **BUILD MY PLAYLIST** → success → open in Spotify
  6. Show resulting playlist with tracks

- [ ] **Apple Sign In — Supabase Dashboard config** — Enable Apple provider in Supabase Dashboard → Auth → Providers. Requires Apple Developer account with Sign in with Apple capability, Apple Service ID, and private key.
- [ ] **Apple Music dev token** — `APPLE_DEV_TOKEN` in `spotify.jsx` is empty. Get a MusicKit JWT from developer.apple.com → MusicKit identifier. Valid for 6 months then must be re-signed. Card shows "add your token" notice in-app already.
- [ ] **Real friend lookup backend** — The PING (1:1 pin drop) system is demo-only (LIME/FROG/NEON/PLUM codes). Real friend lookup needs a server-side code → user mapping. The CREW presence system IS real (Supabase Realtime). Consider deprecating PING in favor of CREW.

## Features
- [ ] Friend DMs (PING replacement) — extend the v98 `crew_messages` primitive to a 1:1 room id (`dm-${sortedPidA}-${sortedPidB}`) and swap out `_fakeReply()` in `map.jsx`. Reuses the same table, RLS, and subscribe helper.
- [x] Site-wide messaging service (v98) — `crew_messages` Postgres table + Realtime subscription, mounted as a chat thread inside expanded CrewCard.
- [ ] Smart chat / smart search bar — replace the removed BYOK Ask-Plursky with a single bar that handles natural-language lineup queries ("who's at Kinetic Friday at 11pm?", "build my Saturday") AND artist/stage search. Server-side LLM proxy (we hold the key, rate-limit per device) so it works for every user, not just key-pasters. Falls back to plain fuzzy search when offline.
- [x] Lineup highlight-on-arrival (v96).
- [x] Sticky top strip across all screens (v95).
- [ ] Setup banner smarter dismiss — currently gates on "no name AND no Spotify". Consider auto-dismissing once the user saves their first set (signal of engagement) so it doesn't keep nagging users who clearly figured the app out.
- [x] Post-festival state — after `FESTIVAL_CONFIG.endMs`, the app shows day 1 as default. Consider a "festival over" screen or recap mode.

## Data / Content
- [ ] Update GPS anchors in `FESTIVAL_CONFIG.gpsAnchors` once Insomniac releases the official 2026 stage map (~2 weeks before festival).
- [x] Verify shuttle times: unified to `05:45` in both `lastShuttleHHMM` and ESSENTIALS entry (v63).

## Done ✓
- [x] **v98** — Crew chat (site-wide messaging service v1). New `crew_messages` Postgres table + Realtime INSERT subscription, scoped by `crew_code`. Helpers in `supabase.jsx`: `sbCrewFetchMessages`, `sbCrewSendMessage`, `sbCrewSubscribeMessages`. New `CrewChat` component renders inside expanded `CrewCard` whenever the user is joined to a crew — scrollable thread (last 50 msgs, ascending), input + SEND, optimistic insert with realtime echo replacing the stub, failed-send marker, mine-vs-theirs alignment + bubble color. Trust model matches existing broadcast (the 6-char code is the secret; RLS is permissive read/insert with body-length + code-length checks). Same primitive will back friend DMs in a follow-up by using a sorted-pid-pair as the `crew_code`.
  - **Action required**: run the new SQL block at the top of `supabase.jsx` once in Supabase SQL Editor (creates table, index, RLS policies, and adds it to the realtime publication).
- [x] **v97** — Removed BYOK Ask-Plursky AI chat. Almost no real users have an Anthropic API key, so the FAB + Me-tab card + chat.jsx file were dead weight. Deleted `chat.jsx`, dropped its `<script>` from `index.html` and SW precache list, removed `chatOpen`/`hasAiKey` state, the storage listener, the `plurskyOpenChat` global, the corner ✦ FAB, the AskPlurskyChat modal mount in `app.jsx`, and the dashed "ASK PLURSKY AI" entry in `MeScreen` (`spotify.jsx`). Setup-wizard re-run link kept. Future replacement tracked in Features (smart chat/search bar with server-side proxy).
- [x] **v96** — Lineup highlight-on-arrival. ArtistScreen "SCHEDULE" now writes `state.lineupHighlight = artistId` alongside `lineupDay`. LineupScreen forces `day` to the highlighted artist's day on mount, queries `[data-lineup-highlight="true"]` after a 100ms render-settle, and `scrollIntoView({block:"center"})`s it. Both list cards (`lineup.jsx` ~810) and TimelineGrid blocks (~1010) tag the matching item with the data attribute and apply the new `lineupFlash` keyframe (added in `app.jsx`). Highlighted grid blocks override the dimmed-by-filter opacity so the flash is always visible. State is cleared after 2.4s so re-mounts don't replay.
- [x] **v95** — Sticky top strip across all screens. Thin 22px bar above every tab body showing local DAY · TIME, plus offline (real `navigator.onLine` listener) and battery-saver badges when active. Lives in `chrome.jsx` (`StatusStrip`, `useOnlineStatus`); mounted once in `app.jsx` between the iOS-frame top-pad and the screen body so it persists across tab switches. Modals (Search/Chat/Onboarding) cover it via existing `inset:0` overlays.
- [x] **v94** — Timeline grid view on LineupScreen. ☰ LIST / ⊞ GRID toggle (persisted in `plursky_lineup_view`). Grid: 9 stages × time (19:00→05:30) with hour rules, sticky stage header, NOW line on today's day, saved★ + Spotify♫ markers, conflict glow, tier-3 stronger fill. Filters dim non-matching blocks instead of hiding so empty space still reads as "no matching set on this stage."
- [x] **v93** — Strip placeholder data (no more Ava Torres / fake stats / fake crew / seeded saves / late-night battery flicker / pre-event LIVE+DAY badges). Hybrid-C onboarding (auto-fire welcome wizard, contextual empty states). Labeled SEARCH FAB. Configurable reminder lead-time (5/15/30/60 min) in NotificationsCard. Cloud auto-push on save when signed in (1s debounce) + one-time toast nudge after first save. Removed per-row `stage.vibeNote` clutter. Battery-saver `auto` now requires real <25% AND festival context (window OR saved set ≤24h). Marketing copy: "offline-first" → "online-first … works offline" (app.jsx welcome, manifest.json, og.svg).
- [x] **v92** — Flow cleanup: AI FAB hidden unless key stored, 5→4 tabs (Music folded into Me), onboarding modal → soft Setup banner, ArtistScreen SCHEDULE handoff, global toast on save with haptics.
- [x] **v91** — Drop iPhone frame on real phones / installed PWA. Naked full-bleed mode via `_useNakedFrame()` (max-width:500px || display-mode:standalone || navigator.standalone).
- [x] **v90** — Memories grid → tappable Your Headliners (saved tier-3 only), Discoveries reasons, Lineup filter collapse (3 rows → single ▼ FILTERS toggle with active-count badge + chips).
- [x] **v89** — Apple Music card hidden when `APPLE_DEV_TOKEN===""`. Home banner queue (one of install/notif/weather). Me tab CrewCard + AccountCard collapse with chevron.
- [x] **v88** — Crew deep-link (`?crew=CODE`) auto-join via `plursky_crew_autojoin` flag + Me-tab routing + broadcast echo on first-sight pid. Playlist build hardened with shared `fetchWithRetry` (searchOne + PUT/POST track writes); concurrency 6→4.
- [x] **v87** — `fetchPlaylistsWithRetry` for /me/playlists list + per-playlist tracks. Stops false "your playlists weren't scanned" banner during 429 throttle.
- [x] **v86** — `_findPlurskyPlaylist` discriminated return (`{playlist}` | `{error}`).
- [x] **v85** — Home masthead scrolls inside ScrollBody (was pinned).
- [x] **v84** — Modify-existing-playlist workaround for blocked POST /users/{id}/playlists. User creates "Plursky" playlist manually once; we PUT first batch, POST rest.
- [x] **v83** — Track-search playlist build (replaces blocked /top-tracks). Per-artist track-count voting for name-collision disambiguation.
- [x] **v81** — Pre-flight scope check, OAuth resume after reconnect, scope record from granted scopes.
- [x] **v79** — Crew-scoped presence via `?crew=CODE` deep link.
- [x] Dynamic NOW — home tab shows real clock-based "now playing" (v62)
- [x] Dynamic alerts — computed from saved sets during festival (v62)
- [x] Stage vibes in lineup tab (v62)
- [x] Crew multi-pin presence — real Supabase Realtime (v62)
- [x] Playlist bug fix — try/catch wrapping (v62)
- [x] Apple Sign In code (v62) — needs Supabase config above
