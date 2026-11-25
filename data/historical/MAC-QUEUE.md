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
(`<id>/<id>-dN.jsonl` in the private review folder, set by `PLURSKY_REVIEW_ROOT`). One edition at a time:

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
| movement-2019 | Sat to Mon, one graphic | On Shopify's CDN; the page links it with a `?1021` query, so if the plain address is not archived the day shows as blocked. |
| electric-forest-2025 | Thu to Sun, one grid each | |
| electric-forest-2024 | Thu to Sun, one grid each | The only capture is from June 16, before the festival. The census has 2024 as scheduled, not confirmed held. |
| electric-forest-2022 | Thu to Sun, one grid each | Friday and Saturday were first issued as `…Friday2…` and `…Saturday2…`; the latest capture's files are read. |
| electric-forest-2019 | Thu to Sun, one grid each | Only the 1000x1294 copies are embedded; check they are legible. |
| electric-forest-2017 | Weekend 2 only, days 5 to 8 | No Weekend 1 grid was archived. |
| ultra-europe-2025 | one graphic for all days | |
| ultra-europe-2024 | three numbered posts | The numbers 01 to 03 are taken as Friday to Sunday: confirm each post's printed day. |
| ultra-europe-2023 | three numbered posts | Same as 2024. |
| ultra-europe-2019 | one graphic for all days | The lineup graphic carries the times, as Ultra Miami 2019's does. |
| coachella-2019 | both weekends, one grid per day | The Do LaB and Heineken House grids are separate files, not queued. |
| coachella-2018 | both weekends, one grid per day | Weekend 2's files are numbered 4201 to 4203, taken as Friday to Sunday: confirm each grid's printed day. Do LaB and Heineken House not queued. |
| ultra-miami-2012 | Fri to Sun, one grid each | |
| ultra-miami-2011 | one graphic for all days | |

## Still waiting for a source

Each of these needs its official graphic found first, then an entry in
`GRAPHIC_EDITIONS` (resolve-graphics.mjs) and in `MAC_QUEUE`.

- **Ultra Miami 2010:** /set-times-revealed (March and April 2010 captures)
  embeds four GIFs, a GA and a VIP grid for each day (`friga.gif`,
  `frivip.gif`, `satga.gif`, `satvip.gif`). Two graphics a day need a
  per-area day entry. 2015's set-times page is a script shell with no
  graphic. 2013 has start times in an API feed but no stage names. 2018 not
  found.
- **Ultra Europe 2017 and 2018:** `europe-lineup-set-times.jpg` (captured
  November 2017) may be 2017's; the page that showed it was not found.
- **Electric Forest 2016, 2018 and 2023:** 2016 and 2018 (Weekend 1) are
  PDFs, which OCR does not read yet; 2016's loses the stage columns. 2023's
  site has no archived schedule page.
- **Shambhala 2017 to 2019, 2022 and 2023:** 2019's full schedule
  (`SMF-2019-full-schedule-1.png`) is archived, but the page that showed it
  was not found.
- **Governors Ball 2016:** the lineup subdomain redirects to an unknown page.
- **Movement 2010 to 2015 and 2022 on:** not found yet. 2013's /lineup is an
  A to Z list with no days.
- **Lollapalooza 2010:** a PDF schedule (`2010_Lolla_Schedule.pdf`); the
  capture after the festival is 20101227020206.

Insomniac festivals (EDC, Beyond Wonderland, HARD, Nocturnal, Escape) are
handled separately and are not listed here.
