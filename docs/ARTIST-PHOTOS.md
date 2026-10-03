# Permanent artist artwork: first reviewed asset

Local review build only. No public rollout or new backend writes.

The permanent resolver reads a build-generated ledger, never localStorage. Each
asset needs an exact artist name, source, license, author, license link, review
receipt and SHA-256 matching its local bytes. Commons and an explicit permanent
storage/display grant in an artist press kit are the only sources. A public
artist website alone is not a license. Instagram remains embed-only.

Press grants (`source: press-kit`, `license: Press-Grant`) come in two forms:
- `grantType: press-page` (the default and the preferred form): the permission
  is published on the artist's, management's or label's press page. `grantUrl`
  is that page and `grantText` quotes the permission.
- `grantType: email`: a documented written grant by email. The ledger ships
  publicly, so the row records `grantFrom` (organisation and role, never a
  person's address), `grantDate`, `grantText` (the quoted permission) and
  `grantEvidenceSha256`, the SHA-256 of the archived `.eml`. The message itself
  is kept in private storage, never in this repo. No `grantUrl`: if the team
  also publishes the permission, record the row as `press-page` instead.
  `sourceUrl` and `licenseUrl` point at the granting party's official page.

Pilot: Skrillex. Michael Nusbaum / Weekly Dig, CC BY 2.0.
Source: https://commons.wikimedia.org/wiki/File:Skrillex.jpg
License: https://creativecommons.org/licenses/by/2.0/
The fetched original was inspected, resized and converted to WebP. The artist
page displays linked source/license credits and notes display cropping.

Run:
- node scripts/build-artist-photo-ledger.mjs
- node scripts/test-artist-photo-ledger.mjs
- node scripts/test-spotify-image-compliance.mjs
- npm run build
- node scripts/verify.mjs --parse-only
- node scripts/capture-artist-pilot.mjs

Spotify remains the 24-hour fallback. Unknown legacy caches stay refused. All
permanent-image recap/share exports remain off in this increment. Enabling them
requires preserving author/license/change attribution in the exported artifact,
plus a separate review of ShareAlike duties for any such asset.

This does NOT complete the artist-photo project. Remaining: broader sourced
coverage; exact-name alias policy for billed variants/B2Bs; LIST-row integration
with visible credit access; broken-image fallback; no-jump and offline device
proof; final 320/393 Dark/Light review; cache-version bump at the build lane's
next free slot. Do not merge before those delivery and review gates are closed.
Do not touch festival-card PR #273 or redesign the app-wide board in this patch.
