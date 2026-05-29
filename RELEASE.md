# Plursky — Release Runbook

Plursky ships on **two independent trains**: the web app (plursky.com) and
the iOS app (App Store, via Capacitor). Web/JS fixes reach the web on push,
but only reach iOS on a native rebuild — the app bundles `dist/` locally
(no `server.url`).

---

## 1. Sync iOS with your latest web/JS changes

After editing any `.jsx` (or map images, etc.):

```bash
cd /Users/jaobo/Plursky
node scripts/build.mjs        # bundle web → dist/  (copies *.jsx + images + sw + index)
npx cap sync ios              # dist/ → ios/App/App/public  +  plugins + pod install
```

`cap sync` = **copy** (web → native) + **update** (plugins + `pod install`).

Variants:
```bash
npx cap copy ios              # web-only, faster (skips pod install) — no plugin changes
npx cap open ios              # open App.xcworkspace in Xcode
```

Notes:
- Native Swift files (e.g. `ios/App/App/ShazamPlugin.swift`) do **not** need
  `cap sync` — they're in the Xcode project and compile on archive.
- Verify the public bundle took the latest: `grep -o "v[0-9]*" ios/App/App/public/index.html | head -1`

---

## 2. Cache-bust bump (web app version `vNNN`)

Bump in lockstep across `index.html` + `sw.js` + `app.jsx` (never hand-edit one):
```bash
sed -i '' 's/v188/v189/g' /Users/jaobo/Plursky/index.html \
                          /Users/jaobo/Plursky/sw.js \
                          /Users/jaobo/Plursky/app.jsx
```
New JS files must also be added to **both** `index.html` `<script>` tags and
the `sw.js` LOCAL precache list (each with `?v=`).

---

## 3. Ship the web (plursky.com)

```bash
node scripts/build.mjs        # keep dist/ green
git add -A && git commit -m "…" && git push origin main   # push to main → plursky.com
```

---

## 4. Ship iOS (App Store)

```bash
# a) bump version — MARKETING_VERSION = marketing string, CURRENT_PROJECT_VERSION = build #
#    build # MUST be unique/higher than the last uploaded build.
#    edit ios/App/App.xcodeproj/project.pbxproj (both Debug + Release configs)
grep -m2 -E "MARKETING_VERSION|CURRENT_PROJECT_VERSION" ios/App/App.xcodeproj/project.pbxproj

# b) sync the latest web in
node scripts/build.mjs && npx cap sync ios

# c) archive + submit
npx cap open ios              # → Any iOS Device → Product ▸ Archive → Distribute ▸ App Store Connect ▸ Upload
```

Pure-CLI archive+upload (alternative to the GUI) lives in chat history /
`ios/App/ExportOptions.plist` if created. GUI is recommended (handles
signing/auth/provisioning).

Pre-submit on device: HEIC auto-tag · video poster not black · ACL map ·
Apple Music build playlist · Shazam a video · PHPicker (no photo-perm prompt).

---

## Source of truth
- **App Store Connect** is the source of truth for the iOS version, NOT the
  pbxproj (which historically drifted to 1.5/1.6). Current ASC: was `1.0.6`
  LIVE → `1.0.7 (17)` prepped for submit.
- **Apple keys/services**: App ID `com.plursky.app` + Media ID
  `media.com.plursky.app` both have MusicKit + ShazamKit enabled.
  MusicKit dev token expires ~6mo → `scripts/sign-musickit-token.mjs`.
