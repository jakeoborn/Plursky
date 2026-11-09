# III Points 2026: set times reconciled to the official grid (2026-10-07)

**Official source:** the @iiipoints Instagram post
https://www.instagram.com/p/DeHtxkalDzN/ ("Time to plan your Trip"), pinned on
the profile. It has four slides: Friday Oct 16 (two slides) and Saturday Oct 17
(two slides), covering all 13 stages. Slide SHA-256 values are recorded in
`data/programming/iii-points-2026.json` under `source.officialSlidesSha256`.
Read 2026-10-07.

**Checked against:** `official.tsv`, the 231 intervals the app and the website
ship (transcribed from the III Points-branded screenshot received 2026-10-05).

## Result: 231 of 231 intervals match, 0 corrections

Each stage column on each slide was compared row by row: start, end, day and
stage.

| Day | Stages | Rows | Time mismatches |
|---|---|---|---|
| Fri Oct 16 | Mind Melt, Sector 3, Isotropic, RC95, 444, S3QU3NC3, Grand Central, Vertex, Door IV, Halo 88, Unforeseen, III Points Radio, Players Club | 112 | 0 |
| Sat Oct 17 | same 13 | 119 | 0 |

A second official post, "Choose Your Trip" (DeMibQAINZB, 2026-10-07, four
curated paths), prints 40 of the same intervals. All 40 match.

## Billing text differences (no change made)

| Grid prints | App bills | Why unchanged |
|---|---|---|
| MALÓNE MOREZ B2B MILUHSKA | Malóne B2B Miluhska | The official lineup page bills "Malóne"; #287 kept that identity (`docs/qa/reports/iii-points-2026-day-split/reconciliation.tsv`). |
| MACCABIII B2B PEZLO MD | Maccabi B2B Pezlo MD | Same: the official lineup page bills "Maccabi". |
| ¥ØU$UK€ ¥UKIMAT$U, PINO B2B TRIPPIE HIPPIE | ¥ØU$UK€ ¥UK1MAT$U, P1no B2B Trippie Hippie | The grid's typeface draws "I" and "1" almost alike; not changed on an ambiguous glyph. |

## What changed

- `scheduleSource` is now the official post: `official: true`, observed 2026-10-07.
- The app's Lineup source line reads "Official schedule". The website reads
  "Official set times, confirmed 2026-10-07" and cites the post.
- Placeholder bios say "official set-time grid" (was "supplied").
- No interval, stage, day or artist ID changed. No map coordinates or
  amenities were added; the 13 stages stay unpositioned.
