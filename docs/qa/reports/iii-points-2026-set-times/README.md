# III Points 2026 set-time receipt, October 5

The source is an attendee-supplied screenshot of III Points-branded grids, printing Friday October 16 and Saturday October 17, 2026. The private original includes phone/mail UI and is not published into this repository. Original SHA256: `8922970c92df78dccafa6cf8288adfef9253efac3f66944a248043fccb7257b9`.

`official.tsv` is the 231-row transcription checked against enlarged pixels of all 26 stage/day columns. All clocks were legible; no interval is filled from popularity, presumed duration, or geometry. The schedule, unlike a map, supplies no stage coordinates.

At receipt, https://www.iiipoints.com/experience/ still supplied running order and six 444 start times. https://www.iiipoints.com/set-times/ returned 404. The publisher link is not represented as a publicly available full-clock receipt. Reconcile against the first-party public grids/app if these become available before release.

Cross-check only: https://festiplannr.com/festival/iii-points-2026/lineup. Its structured schedule omitted Homicide Jenny (Saturday Grand Central 19:00-19:30), and ended Loukeman at 18:15 instead of the source's 18:05. The supplied grid controls those corrections and B2B ordering. No third-party photos or data-only rows were copied.

Current source differences versus the September 30 app lineup:
- Nettspend, solo Nick Leon and Homicide Jenny appear in this timetable; new acts get distinct IDs; surviving acts retain theirs.
- The grid does not bill fakemink or Nick Leon B2B Safety Trance; not in this timetable; recorded in the removal ledger, with saved IDs retained in storage.
- Dude Skywalker is Friday; Jeremy Ismael is Saturday.
- The timetable prints Villu; the earlier Santiago Villu ID is retained.
- The timetable prints NXTEL; it is newly billed compared with the September 30 snapshot.
- All 19 previously DAY TBA billings now have printed day/stage/intervals.
- Existing July/September reconciliation files remain historical snapshots, not current schedule expectations.

October 6 app clarification: the app and website share all 231 intervals. Surviving act IDs remain stable; distinct new acts get new IDs. Removed saved IDs stay in storage but are not shown as live picks. No stage geometry is invented. Overnight clocks belong to their originating festival night (Friday midnight is Saturday October 17; Saturday midnight is Sunday October 18). Club Space satellite events are not included.

Website implementation requested October 5, clarified to include app set times October 6. This remains branch-only until the normal merge gate. Source checks do not prove installed native behavior, owner merge approval, or full device QA.

Generator note: template-source fingerprinting intentionally updates all 25 generated page dates; the ACL status moves from Happening now to This weekend on October 5. No other festival dataset changes.

October 6 public-source reconciliation: https://www.iiipoints.com/experience/ now bills Homicide Jenny and no longer bills fakemink, but has no Nettspend billing or full clocks. The supplied screenshot controls the complete timetable; do not silently swap in this still-different running order.

October 15 official-page reconciliation: https://www.iiipoints.com/set-times/ now resolves (HTTP 200) with the first-party grid. Its static HTML carries Friday only (111 sets); Saturday renders client-side and was not read here. Three Friday billings in `official.tsv` now follow that page instead of the screenshot: Malóne Morez B2B Miluhska (was Malóne B2B Miluhska), Miguelle & Tons (was Miguelle & Tons B2B Saraga; the page no longer bills Saraga), MACCABIII B2B Pezlo MD (was Maccabi B2B Pezlo MD). IDs are unchanged. The page's "ITBSP" stays 1tbsp (the act's own spelling), and the app's "(Live)" and "presents" enrichments stay. Jump Source (Live) is billed on that page at S3QUENC3 Friday 19:15-20:45, as in the screenshot and the app; an earlier read that showed the cell empty was an extraction artifact (a nested LIVE tag inside the name span), not the page. With that, Friday matches set for set (112 of 112, every start and end), and the receipt (`scheduleSource` and `data/programming/iii-points-2026.json` `source`) now cites https://www.iiipoints.com/set-times/ as official, observed October 15. The screenshot's SHA256 stays recorded as the original transcription source.

## First-party update, received October 18

On October 16 the festival published "UPDATED SET TIMES FOR THE WEEKEND" as an Instagram carousel from the official @iiipoints account (https://www.instagram.com/iiipoints/p/Dej7LGMlHyZ/). The README above asked for exactly this reconciliation once first-party public grids became available.

Every cell of both Saturday grid slides (slide 3: Mind Melt, Sector 3, Isotropic, RC95, 444, S3QU3NCE, Grand Central; slide 4: Vertex, Sector IV, Halo 88, Unforeseen, III Points Radio, Players Club) was re-read against the record. All 231 intervals are unchanged except one Saturday RC95 swap:

- Charlotte de Witte: 02:45-04:00 -> 01:30-02:45
- 999999999: 01:30-02:45 -> 02:45-04:00 (now closes RC95)

`official.tsv`, the programming payload, and the dataset scheduleSource now track this first-party source. Slide 3 (carries the RC95 swap) SHA256: `f79e20292fd017cb4e83a86fae8bba5f7b8efa84eb68f1441dbd687f5fd1b7d4`. Slide 4 SHA256: `67828ad7b5c7b6f8f938ee96199271c03f28d2e00b476829fb41e26386a0941a`. The October 5 attendee screenshot (sha `8922970c...`) is superseded as the live source and stays in this file as history. The festival website's /set-times/ bundle still printed the pre-swap RC95 order when last checked October 18; the Instagram post is the newer first-party word.

Friday rows: verified 2026-10-18 against the same carousel's slides 1-2 (slide 1 sha256 9c1bc394b8f27bf3ff85e10a7f4025a3e4bf95abac219062292aa7f9d9b2f4e0, slide 2 sha256 71019d4ee3c104abeceebe692b8e4efb5f31be87c83367e823517f1e284b66de): all 112 Friday intervals match this record on artist, start and end times. Seven rows differ in name presentation: five are stylization only (Malone Morez, B0YG1RL, iiry?, Maccabiii, Tech G1rls); two are billing detail the grid omits and this record keeps - Miguelle & Tons B2B Saraga (grid: Miguelle & Tons) and Rental Snakes (Live) (grid: Rental Snakes). No schedule changes; the record's fuller billings stand.
