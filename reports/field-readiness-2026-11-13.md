# Field readiness — 2026-11-13

SPEC-193 Phase 1. Built from `main` at `3108066f`. Runtime 50.0 min. Command: `node scripts/field/field-readiness.mjs`.

**Matrix pass rate: 75.0%** (243/324 cells; 0 flaky = passed on the one retry). 27 festivals × 3 viewports × 4 networks.
Per-festival flows: 25 pass, 2 fail, 0 flaky. Global scenarios: 15 pass, 0 fail, 0 flaky.

Conditions: `online` (no service worker); `offline` (first load online with the service worker, then offline + reload); `slow3g` (warm service worker, then 4.4 s latency at 400 kbit/s + reload); `tiles-blocked` (map tile hosts dead). Every gate run blocks all outside hosts except the vendored CDN copies, so artist photos from outside, weather and music APIs fail the way they do with no signal.

## Failures by user impact

1. **cell ran** — 1 cell(s). crssd-fall-2026 430x932 slow3g
   - page.goto: Timeout 180000ms exceeded.
   - screenshot: [field/crssd-fall-2026-430x932-slow3g.jpg](field/crssd-fall-2026-430x932-slow3g.jpg)
2. **2 usable within 20 s on slow 3G (warm cache)** — 80 cell(s). edc-lv-2026 320x568 slow3g; edc-lv-2026 390x844 slow3g; edc-lv-2026 430x932 slow3g; lost-lands-2026 320x568 slow3g; lost-lands-2026 390x844 slow3g; lost-lands-2026 430x932 slow3g; …
   - 90437 ms to the first readable set row (root mounted at 89811 ms; 3949 KB over the 400 kbit/s link)
   - 90402 ms to the first readable set row (root mounted at 89781 ms; 3949 KB over the 400 kbit/s link)
   - 90390 ms to the first readable set row (root mounted at 89771 ms; 3949 KB over the 400 kbit/s link)
   - screenshot: [field/edc-lv-2026-320x568-slow3g.jpg](field/edc-lv-2026-320x568-slow3g.jpg)
   - screenshot: [field/edc-lv-2026-390x844-slow3g.jpg](field/edc-lv-2026-390x844-slow3g.jpg)
   - screenshot: [field/edc-lv-2026-430x932-slow3g.jpg](field/edc-lv-2026-430x932-slow3g.jpg)
3. **3 set times monotonic within a stage (no same-stage overlap)** — 2 cell(s). summerfest-2026 (flows); outside-lands-2026 (flows)
   - 1: aurora day 6: DJ Andres 14:45-15:20 × Jazzteca 15:15-16:10
   - 2: dolores day 2: OASIS DJ Set: Beverly Chills 13:30-14:15 × Pink Stiletto 14:00-14:30; dolores day 2: Pink Stiletto 14:00-14:30 × REPARATIO
   - screenshot: [field/summerfest-2026-flow-overlap-day6.jpg](field/summerfest-2026-flow-overlap-day6.jpg)
   - screenshot: [field/outside-lands-2026-flow-overlap-day2.jpg](field/outside-lands-2026-flow-overlap-day2.jpg)

## Matrix

✓ pass · ✗ fail · ~ flaky (passed on retry) · columns are viewport/network.

| Festival | 320 online | 320 offline | 320 slow3g | 320 tiles-blocked | 390 online | 390 offline | 390 slow3g | 390 tiles-blocked | 430 online | 430 offline | 430 slow3g | 430 tiles-blocked |
|---|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|
| edc-lv-2026 | ✓ | ✓ | ✗ | ✓ | ✓ | ✓ | ✗ | ✓ | ✓ | ✓ | ✗ | ✓ |
| lost-lands-2026 | ✓ | ✓ | ✗ | ✓ | ✓ | ✓ | ✗ | ✓ | ✓ | ✓ | ✗ | ✓ |
| edc-orlando-2026 | ✓ | ✓ | ✗ | ✓ | ✓ | ✓ | ✗ | ✓ | ✓ | ✓ | ✗ | ✓ |
| acl-2026 | ✓ | ✓ | ✗ | ✓ | ✓ | ✓ | ✗ | ✓ | ✓ | ✓ | ✗ | ✓ |
| ultra-miami-2026 | ✓ | ✓ | ✗ | ✓ | ✓ | ✓ | ✗ | ✓ | ✓ | ✓ | ✗ | ✓ |
| governors-ball-2026 | ✓ | ✓ | ✗ | ✓ | ✓ | ✓ | ✗ | ✓ | ✓ | ✓ | ✗ | ✓ |
| summerfest-2026 | ✓ | ✓ | ✗ | ✓ | ✓ | ✓ | ✗ | ✓ | ✓ | ✓ | ✗ | ✓ |
| lollapalooza-2026 | ✓ | ✓ | ✗ | ✓ | ✓ | ✓ | ✗ | ✓ | ✓ | ✓ | ✗ | ✓ |
| outside-lands-2026 | ✓ | ✓ | ✗ | ✓ | ✓ | ✓ | ✗ | ✓ | ✓ | ✓ | ✗ | ✓ |
| iii-points-2026 | ✓ | ✓ | ✗ | ✓ | ✓ | ✓ | ✗ | ✓ | ✓ | ✓ | ✗ | ✓ |
| nocturnal-wonderland-2026 | ✓ | ✓ | ✗ | ✓ | ✓ | ✓ | ✗ | ✓ | ✓ | ✓ | ✗ | ✓ |
| crssd-fall-2026 | ✓ | ✓ | ✗ | ✓ | ✓ | ✓ | ✗ | ✓ | ✓ | ✓ | ✗ | ✓ |
| portola-2026 | ✓ | ✓ | ✗ | ✓ | ✓ | ✓ | ✗ | ✓ | ✓ | ✓ | ✗ | ✓ |
| hard-summer-2026 | ✓ | ✓ | ✗ | ✓ | ✓ | ✓ | ✗ | ✓ | ✓ | ✓ | ✗ | ✓ |
| arc-2026 | ✓ | ✓ | ✗ | ✓ | ✓ | ✓ | ✗ | ✓ | ✓ | ✓ | ✗ | ✓ |
| escape-halloween-2026 | ✓ | ✓ | ✗ | ✓ | ✓ | ✓ | ✗ | ✓ | ✓ | ✓ | ✗ | ✓ |
| dreamstate-socal-2026 | ✓ | ✓ | ✗ | ✓ | ✓ | ✓ | ✗ | ✓ | ✓ | ✓ | ✗ | ✓ |
| decadence-colorado-2026 | ✓ | ✓ | ✗ | ✓ | ✓ | ✓ | ✗ | ✓ | ✓ | ✓ | ✗ | ✓ |
| countdown-nye-2026 | ✓ | ✓ | ✗ | ✓ | ✓ | ✓ | ✗ | ✓ | ✓ | ✓ | ✗ | ✓ |
| lights-all-night-2026 | ✓ | ✓ | ✗ | ✓ | ✓ | ✓ | ✗ | ✓ | ✓ | ✓ | ✗ | ✓ |
| decadence-arizona-2026 | ✓ | ✓ | ✗ | ✓ | ✓ | ✓ | ✗ | ✓ | ✓ | ✓ | ✗ | ✓ |
| sunset-on-the-river-2027 | ✓ | ✓ | ✗ | ✓ | ✓ | ✓ | ✗ | ✓ | ✓ | ✓ | ✗ | ✓ |
| dwp-2026 | ✓ | ✓ | ✗ | ✓ | ✓ | ✓ | ✗ | ✓ | ✓ | ✓ | ✗ | ✓ |
| edc-thailand-2026 | ✓ | ✓ | ✗ | ✓ | ✓ | ✓ | ✗ | ✓ | ✓ | ✓ | ✗ | ✓ |
| tomorrowland-thailand-2026 | ✓ | ✓ | ✗ | ✓ | ✓ | ✓ | ✗ | ✓ | ✓ | ✓ | ✗ | ✓ |
| groove-cruise-2027 | ✓ | ✓ | ✗ | ✓ | ✓ | ✓ | ✗ | ✓ | ✓ | ✓ | ✗ | ✓ |
| day-zero-tulum-2027 | ✓ | ✓ | ✗ | ✓ | ✓ | ✓ | ✗ | ✓ | ✓ | ✓ | ✗ | ✓ |

## Per-festival flows (390x844, online)

| Festival | Status | Failing checks |
|---|:-:|---|
| edc-lv-2026 | ✓ |  |
| lost-lands-2026 | ✓ |  |
| edc-orlando-2026 | ✓ |  |
| acl-2026 | ✓ |  |
| ultra-miami-2026 | ✓ |  |
| governors-ball-2026 | ✓ |  |
| summerfest-2026 | ✗ | 3 set times monotonic within a stage (no same-stage overlap) (1: aurora day 6: DJ Andres 14:45-15:20 × Jazzteca 15:15-16:10) |
| lollapalooza-2026 | ✓ |  |
| outside-lands-2026 | ✗ | 3 set times monotonic within a stage (no same-stage overlap) (2: dolores day 2: OASIS DJ Set: Beverly Chills 13:30-14:15 × Pink Stiletto 14:00) |
| iii-points-2026 | ✓ |  |
| nocturnal-wonderland-2026 | ✓ |  |
| crssd-fall-2026 | ✓ |  |
| portola-2026 | ✓ |  |
| hard-summer-2026 | ✓ |  |
| arc-2026 | ✓ |  |
| escape-halloween-2026 | ✓ |  |
| dreamstate-socal-2026 | ✓ |  |
| decadence-colorado-2026 | ✓ |  |
| countdown-nye-2026 | ✓ |  |
| lights-all-night-2026 | ✓ |  |
| decadence-arizona-2026 | ✓ |  |
| sunset-on-the-river-2027 | ✓ |  |
| dwp-2026 | ✓ |  |
| edc-thailand-2026 | ✓ |  |
| tomorrowland-thailand-2026 | ✓ |  |
| groove-cruise-2027 | ✓ |  |
| day-zero-tulum-2027 | ✓ |  |

## Global scenarios

| Scenario | Viewport | Status | Notes |
|---|---|:-:|---|
| fresh install cold open | 320x568 | ✓ | 1 default vs nearest upcoming (info): default edc-orlando-2026; nearest upcoming dreamstate-socal-2026 (set times TBA); nearest  |
| stored selection on a festival that ended > 7 days ago | 320x568 | ✓ |  |
| stale service worker from the previous build | 320x568 | ✓ | stale SW: reload 1 serves v593 |
| light colour scheme | 320x568 | ✓ |  |
| dark colour scheme | 320x568 | ✓ |  |
| fresh install cold open | 390x844 | ✓ | 1 default vs nearest upcoming (info): default edc-orlando-2026; nearest upcoming dreamstate-socal-2026 (set times TBA); nearest  |
| stored selection on a festival that ended > 7 days ago | 390x844 | ✓ |  |
| stale service worker from the previous build | 390x844 | ✓ | stale SW: reload 1 serves v593 |
| light colour scheme | 390x844 | ✓ |  |
| dark colour scheme | 390x844 | ✓ |  |
| fresh install cold open | 430x932 | ✓ | 1 default vs nearest upcoming (info): default edc-orlando-2026; nearest upcoming dreamstate-socal-2026 (set times TBA); nearest  |
| stored selection on a festival that ended > 7 days ago | 430x932 | ✓ |  |
| stale service worker from the previous build | 430x932 | ✓ | stale SW: reload 1 serves v593 |
| light colour scheme | 430x932 | ✓ |  |
| dark colour scheme | 430x932 | ✓ |  |

## Not covered

- Real device radio, real iOS WKWebView and native plugins: this is Chromium headless with the web build. Locked-screen behaviour is out of scope.
- Pin count vs stage count on the real (MapLibre) map: tiles are blocked in every gate run, so the real map is never drawn here. The tiles-blocked cell checks the fallback instead.
- Share sheet export (native share): the Music, Memories, Me and Home screens are opened for errors; producing an image is not.
