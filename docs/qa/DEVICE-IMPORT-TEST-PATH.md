# Real-iPhone photo import: step-by-step test path

CI already covers the matcher: the weekend photo-tag gate runs 94 photos per ACL
weekend, both-weekend acts, and wrong-weekend saved or attended sets being
rejected. The video GPS gate reads iPhone `mdta` GPS and accuracy, and blinds a
coarse fix for stage matching. The import-toast gate checks one landed file and
one failed file in a batch, plus the import log. This page covers what CI
cannot: Apple's photo picker, iCloud downloads, HEIC/HEVC, and real capture
metadata on a device.

Every step names what you should see and the import-log row that proves it. A
failure is diagnosed from that row, with no screen recording needed.

## Reading the log

Each imported file writes one row, tagged `[plursky:import]`. The rows cover
`batch_start`, `file`, `file_duplicate`, `file_failed` and `batch_end`. The
last 400 rows stay on the device. Rows never contain coordinates, only
`gps: true/false` and `gpsAccM`.

- **TestFlight or App Store build.** The WebView is not inspectable. Sign in
  to Plursky cloud, go to **Me → account → ↓ EXPORT MY DATA**, and share the
  JSON. The rows are in `importLog`. Each moment's own record in `moments`
  also carries `tagSource`, `gpsAccM`, `gpsRejected`, `dateUnverified` and
  `festivalStampSource`.
- **Xcode debug run.** Filter the device console on `[plursky:import]`. Or open
  Safari → Develop → *iPhone* → Plursky and run `plurskyImportLog()`.

## Fields in a `file` row

| field | meaning | healthy value for an on-site photo |
|---|---|---|
| `takenAtSource` | where the capture time came from | `exif` (photo) or `video-…` (clip); `file-lastModified` = guess |
| `dateUnverified` | capture time equals the file mtime | `false` |
| `gps`, `gpsAccM` | GPS present, accuracy in metres | `true`, 200 m or better for stage matching |
| `gpsRejected` | fix too coarse for stage matching | `false` (`true` is correct behaviour for a coarse fix) |
| `festivalId`, `stamp` | festival the capture time places it in | `acl-2026`, `capture-time` |
| `night`, `nightFromCapture` | festival night bucket | the real night, `true` |
| `artistId`, `reason`, `tagSource` | the act and why | an act on the photo's own weekend |
| `ambiguous` | two overlapping sets GPS could not separate | `true` shows the "fix tag" chip |

## Steps

Set up first: install the build, make ACL 2026 the active festival, and save
2–3 sets you actually watched. Use photos and one video shot at Zilker. Weekend 1
(Oct 2–4) is fine if you have it; otherwise run this during Weekend 2.

1. **One on-site photo, downloaded to the phone.** In Memories, tap import and
   pick the photo.
   *See:* the photo lands on its real night, tagged to the set playing at its
   capture time.
   *Log:* the `file` row has `takenAtSource: "exif"`, `stamp: "capture-time"`,
   `nightFromCapture: true`, `artistId` set, and `tagSource: "exif"`.
2. **The same photo again.**
   *See:* the "Already imported — 1 duplicate skipped" toast.
   *Log:* one `file_duplicate` row.
3. **One on-site video (HEVC).**
   *See:* a poster frame and the right night. If the clip has a fine GPS fix,
   it gets a stage-level tag.
   *Log:* `takenAtSource` starts with `video-`, `kind: "video"`, and `gps:
   true` with `gpsAccM`. If `gpsAccM` is above 200, expect `gpsRejected: true`
   and no stage-level tag. That is correct.
4. **A photo still in iCloud** (Optimize Storage on, never opened).
   *See:* either it lands like step 1, or the toast says it failed.
   *Log:* `file` or `file_failed` with `error`. A `takenAtSource:
   "file-lastModified"` row with `dateUnverified: true` means iOS handed over
   a stripped file. Open it in Photos first, then retry.
5. **A Weekend 2 photo of a Weekend 1-only act's time slot** (or the reverse).
   *See:* it is not tagged to the other weekend's act.
   *Log:* `artistId` is null or a same-weekend act, and `night` is the photo's
   own weekend's night.
6. **A photo from a different festival** (an EDC LV 2026 shot, for example).
   *See:* the "Filed by capture date — 1 to EDC LV 2026" toast. It is not visible
   on ACL.
   *Log:* `festivalId: "edc-lv-2026"`, `stamp: "capture-time"`.
7. **A screenshot or a photo with no capture date.**
   *See:* it lands on the fallback night with a retag chip and no artist.
   *Log:* `reason: "no_date"` or `outside_festival_window`, `tagSource:
   "fallback"`, and `artistId: null`.
8. **A batch of 20 or more mixed items.**
   *See:* the grid fills while the import runs, and the toast count matches.
   *Log:* `batch_end` has `landed + failed + duplicates = files`.

Pass when every step matches. Send the exported JSON (`importLog` plus the
moments) with any step that does not.
