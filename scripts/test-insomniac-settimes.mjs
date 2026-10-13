#!/usr/bin/env node
// Fixture test for fetch-insomniac-settimes.mjs's page parser. The markup is
// the shape of the live Nocturnal 2026 set-times pages (#125), trimmed: a
// "By Stage" tab, then a "Full Schedule" tab that repeats every set.
import { parseDay } from "./fetch-insomniac-settimes.mjs";

const block = (id, name, s, e) =>
  `<li><a href="#modal-settime-artists" class="js-wp-template-Modal no-barba set-block " data-settime-id="${id}" data-settime-large-img="x.jpg" aria-label="view artist details for ${name}">
     <img src="data:image/svg+xml,x" alt=""/><div class="set-block__text"> <span>${name}</span> <span data-timestamp-start="${s}" data-timestamp-end="${e}"></span> </div> </a></li>`;
const html = `<div class="tabs__content tabs__content--active"><ul class="set-list">
  <li class="set-list__stage"> <h2>Mystic Wild</h2> </li>
  ${block(1, "deadmau5", 1789858800, 1789862400)}
  ${block(2, "Abana B2B Juliet Mendoza", 1789862400, 1789866000)}
  <li class="set-list__stage"> <h2>Dawn Mountain</h2> </li>
  ${block(3, "Chlo&eacute; Caillet &amp; Friends", 1789855200, 1789858800)}
</ul></div>
<div class="tabs__content"><ul class="set-list">
  ${block(3, "Chlo&eacute; Caillet &amp; Friends", 1789855200, 1789858800)}
  ${block(1, "deadmau5", 1789858800, 1789862400)}
  ${block(2, "Abana B2B Juliet Mendoza", 1789862400, 1789866000)}
</ul></div>`;

const got = parseDay(html);
const want = [
  { id: "1", stage: "Mystic Wild",   artist: "deadmau5",                 start: "23:00", end: "00:00" },
  { id: "2", stage: "Mystic Wild",   artist: "Abana B2B Juliet Mendoza", start: "00:00", end: "01:00" },
  { id: "3", stage: "Dawn Mountain", artist: "Chloé Caillet & Friends",  start: "22:00", end: "23:00" },
];
const fails = [];
if (got.length !== want.length) fails.push(`expected ${want.length} sets (Full Schedule repeats dropped), got ${got.length}`);
want.forEach((w, i) => {
  for (const k of Object.keys(w)) if (got[i]?.[k] !== w[k]) fails.push(`set ${i + 1} ${k}: expected ${JSON.stringify(w[k])}, got ${JSON.stringify(got[i]?.[k])}`);
});
// No stage heading above the first set → stage null, which the CLI refuses.
if (parseDay(block(9, "Orphan", 1789858800, 1789862400))[0]?.stage !== null) fails.push("a set with no stage heading must parse with stage null");

if (fails.length) { fails.forEach(f => console.error(`  ✗ ${f}`)); process.exit(1); }
console.log(`✓ fetch-insomniac-settimes: ${want.length} sets from ${want.length * 2} blocks (repeats dropped), wall clock read in UTC, B2B and entities kept, orphan set flagged`);
