# Photo-album replay: what real albums will measure

`scripts/replay-photo-albums.mjs` runs a camera roll through the app's own attendance path and scores it against the sets you say you were at. Status: implemented, but no real album has been replayed yet.

## The path it runs

Each step is the same code the app ships, run from the compiled `build/` files:

1. `_matchArtistForPhoto` (photo-tag.jsx) takes each photo's wall-clock time, GPS fix and accuracy. It works out the festival night, applies the one fix gate (accuracy 100 m or better, within 140 m of a stage, and 35 m nearer to it than to the next stage), then applies the set window (5 minutes early to 10 minutes late).
2. `attendMomentPoints` (data.jsx) keeps a photo only if all of these hold:
   - it was tagged by a trusted stage fix;
   - the tag is not ambiguous;
   - the stage has a **measured** position (osm or crowd).
3. `attendanceVerdict` (data.jsx) gives what the set-attendance card would say. A photo on its own can make a set *caught*, but never *full*.

A set **resolves** when it is caught and its evidence sits within 10 minutes of the set's window. A **false set** is one the engine marks caught that you were not at. The SPEC-212 W3 gate is **17 of 20 (85%)**. Below that, attendance stays TestFlight-only.

## Run it on an album

```
exiftool -json -n -DateTimeOriginal -GPSLatitude -GPSLongitude -GPSHPositioningError <album dir> > photos.json
echo '{ "fid": "edc-lv-2026", "sets": ["<artist id>", "..."] }' > truth.json
node scripts/replay-photo-albums.mjs --album photos.json --truth truth.json
```

Keep albums and truth files outside the repo, because they hold locations. The report prints names, stages and verdicts, never a coordinate. The command exits 0 only at or above 85%.

## The reference corpus (synthetic, in CI)

`--self-test` builds a corpus modelled on the EDC 2026 ground truth:

- the empirical kinetic anchor 36.27399, -115.00718;
- 15 real kinetic and circuit sets from the shipped timetable;
- 2 to 6 photos per set, inside a 40 m crowd, at 5 to 35 m accuracy.

Two misses are built in, one for each failure mode the gate is meant to refuse:

- **coarse:** every photo at 150 m accuracy;
- **back:** every photo 170 m behind the stage.

The corpus must give exactly **13/15** with 0 false sets. Five broken fixtures must each move that score:

- photos moved 200 m;
- photos with no time;
- a truth set nobody shot;
- a shot set missing from truth;
- a camera clock two hours off.

## What real albums will tell us that the synthetic corpus cannot

1. **Coverage is capped by measured stages.** Today EDC Las Vegas has measured positions only for kinetic and circuit. A photo at any other EDC stage can never mark a set, however good its GPS. On a real EDC album, the share of sets at unmeasured stages is a ceiling on the score, and it is the first number to read. Comparing ACL and III Points shows the same thing on festivals with different anchor coverage.
2. **The accuracy the phone really writes.** The corpus assumes 5 to 35 m. Real `GPSHPositioningError` values, especially in a packed crowd at night, show how many photos the 100 m gate drops. In the report this is the tagger line's `off_stage` count.
3. **Where people actually stand.** The kinetic crowd anchor took 85 m of spread across 11 fixes. Photos from the back of a big stage can fall past 140 m, which is the "back" miss above.
4. **Changeover and overlap.** The tagger flags `several_playing` and `tagged_ambiguous` when two sets share a window or a stage has no pin. Those photos do not count. The report shows how often that happens.
5. **Camera clock drift.** EXIF time is a wall clock with no zone. A phone left on home time moves every photo by hours, and in the corpus that turns 13/15 into 4/15 with 7 false sets. Expect real albums to need a per-album clock check before scoring.
6. **Sets with no photos.** People do not shoot every set. A truth set with no photo is unresolved by design, so truth should list only sets that were photographed, or the report should be read with that in mind.

What it does **not** measure: live GPS runs and *full* verdicts (photos alone cannot give those), check-ins, and Still here taps. `scripts/replay-attendance.mjs` covers the GPS-trace side on synthetic traces.
