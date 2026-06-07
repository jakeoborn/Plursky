# CLAUDE.md — Plursky hard rules

Read this first. These are the rules that cause real breakage if ignored.
Full ship flow: **[RELEASE.md](RELEASE.md)**. Open work: **[TODO.md](TODO.md)**.

## 1. iOS version train is `1.x`, NOT `1.0.x`
Apple compares versions numerically, so `1.0.7 < 1.6` and gets REJECTED
(err 90062/90478). Last approved & LIVE = **`1.7 (18)`**. The next build
MUST be a numerically higher marketing string (→ `1.8`) with a unique,
higher build number. Never write `1.0.x`. (This mistake has bitten twice.)

## 2. `scripts/build.mjs` does NOT validate — it only copies
A green `[build] dist/ ready` means files were copied, nothing more. There
is no transpile/lint step. **Validate JSX yourself** before claiming done:
- Babel-transform changed files with the `react` preset (Babel-standalone
  served + headless Chrome), AND
- a headless mount probe: load the full `index.html` script chain and assert
  `#root` has children (`root_children=1`) + key fns are `typeof function`.
- For UI changes, render to a screenshot and actually look.

## 3. Web and iOS are separate trains
Native bundles `dist/` locally (no `server.url`). Web/JS fixes reach
plursky.com on **push to main**, but reach iOS only on a rebuild
(`node scripts/build.mjs && npx cap sync ios`). Don't assume a web fix is on
iOS. See RELEASE.md.

## 4. Cache-bust `vNNN` moves in lockstep
Bump across `index.html` + `sw.js` + `app.jsx` together (sed one-liner in
RELEASE.md) on any shipped JS change. A NEW `.jsx` file must be added to
**both** the `index.html` `<script>` tags **and** the `sw.js` LOCAL precache
list (each with `?v=`), and must load **before `spotify.jsx`**.

## 5. No bundler — everything is global across `<script type=text/babel>`
Each `.jsx` is loaded as a separate Babel script. Top-level `function`/`const`
declarations become **global**, so cross-file calls work by bare name
(e.g. `useMomentPhoto`, `markAttended`, `createEdcPlaylist`). Load order only
matters for **eval-time** references (e.g. a top-level `Object.assign(window,…)`);
runtime calls resolve regardless of order. When splitting files, the consumer's
`window`-exports must not name a symbol that moved out, unless that file loads first.
⚠️ **Bare names resolve through WINDOW props** (empirically proven v228), so a
later `Object.assign(window, …)` OVERWRITES them: data.jsx's festival switch
replaces `ARTISTS`/`FESTIVAL_CONFIG`/`STAGES`/`AMENITIES`/`DAYS` with the
ACTIVE festival's values everywhere. Bare `ARTISTS` ≠ "the EDC base lineup" —
non-active-festival data MUST go through `_DATA_SETS` (this exact mistake made
v226's Festival Year resolve archived EDC ids against the ACL lineup).

## 6. Don't rebuild what exists
There's a full recap/share engine (`recap-engine.jsx`), Spotify/Apple API
(`spotify-api.jsx`), EXIF/auto-tag (`photo-tag.jsx`), meetup/crew (map.jsx +
supabase.jsx). Grep before building; integrate, don't duplicate.

## 7. Secrets vs public tokens
NEVER commit private keys (`.p8` MusicKit key, service-role keys). But the
**Spotify client ID** and the **MusicKit developer token** (`APPLE_DEV_TOKEN`)
are client-side-public by design and live in the code. Don't ask the user to
paste the `.p8` or a Spotify *secret* into chat.

## 8. Ship discipline
- Push direct to `main` (it's the deploy) once validated.
- End commit messages with: `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`
- Verify visually / on intent before claiming a feature works (web vs device).

## Gotchas
- Supabase: app uses `pzoijbqsbbwyuyjinjtj`; the MCP may point at a different
  project — confirm before DB ops.
- `recognize-song` Edge Function (web Shazam fallback) is NOT deployed (404);
  iOS uses native ShazamKit instead.
