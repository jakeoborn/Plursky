# Mac queue: past set times that exist only as pictures

These past years' official set times survive only as schedule graphics. They
can be read only on a Mac: OCR uses macOS's Vision framework, and the cloud
sessions cannot download from web.archive.org. Nothing here is data until
every row has been checked against the graphic.

## Run

From the repo root, on the Mac:

    node scripts/historical/ocr-queue.mjs

That fetches the official graphic for each day of every edition below
(`resolve-graphics.mjs`, which writes each ledger), reads each one with
`ocr-vision.swift`, and prints where each day's OCR lines went
(`~/Plursky-private/review/<id>/<id>-dN.jsonl`). One edition at a time:

    node scripts/historical/ocr-queue.mjs movement-2017

Then, per day, as in README.md ("Adding an edition"): `assemble-ocr.mjs` for
candidate rows, a check of every row against the pixels into
`<id>-dN.final.tsv`, the printed header in `<id>-dN.note`, and
`finalize-review.mjs`. The edition then needs its `editions.mjs` entry and
its `expected-counts.json` line before `build-editions.mjs`.

## Queued (graphic files known)

| edition | days | what to check |
|---|---|---|
| governors-ball-2023 | Fri to Sun, one grid each | The Bacardi Backyard stage has its own graphic (`bl-backyard-settimes.png`), not queued. |
| movement-2016 | Sat to Mon, one graphic for all days | The last issue is `…_FINAL-5.jpg`; earlier issues stay in the ledger. |
| movement-2017 | Sat to Mon, one graphic | `…_new-orientation_FINAL.jpg`; a printable PDF is also linked. |
| movement-2018 | Sat to Mon, one graphic | `…_WEB.png`; a PDF is also linked. |
| electric-forest-2025 | Thu to Sun, one grid each | |
| electric-forest-2024 | Thu to Sun, one grid each | The only capture is from June 16, before the festival. The census has 2024 as scheduled, not confirmed held. |
| ultra-europe-2024 | three numbered posts | The numbers 01 to 03 are taken as Friday to Sunday: confirm each post's printed day. |

## Still waiting for a source

Each of these needs its official graphic found first, then an entry in
`GRAPHIC_EDITIONS` (resolve-graphics.mjs) and in `MAC_QUEUE`.

- **Coachella 2018 and 2019:** 2018's grids were five JPGs on the festival's
  S3 bucket, linked from /lineup/set-times/. 2019's /set-times/ captures
  (April and May 2019) embed no graphic the cloud scan recognised.
- **Ultra Miami 2010:** /set-times-revealed (March and April 2010 captures)
  embeds four GIFs, a GA and a VIP grid for each day (`friga.gif`,
  `frivip.gif`, `satga.gif`, `satvip.gif`). Two graphics a day need a
  per-area day entry. 2011, 2012 and 2015 have set-times pages that were not
  read from the cloud. 2013 has start times in an API feed but no stage names.
- **Ultra Europe 2017 to 2019, 2023 and 2025:** not found yet.
- **Electric Forest 2016 to 2019, 2022 and 2023:** day graphics; 2016 also
  has a PDF that loses the stage columns.
- **Shambhala 2017 to 2019, 2022 and 2023:** graphics and the festival app.
- **Governors Ball 2016:** the lineup subdomain redirects to an unknown page.
- **Movement 2010 to 2015, 2019 and 2022 on:** not looked for yet. 2013's
  /lineup is an A to Z list with no days.
- **Lollapalooza 2010:** a PDF schedule (`2010_Lolla_Schedule.pdf`); the
  capture after the festival is 20101227020206.

Insomniac festivals (EDC, Beyond Wonderland, HARD, Nocturnal, Escape) are
handled separately and are not listed here.
