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
