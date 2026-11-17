// A real-map festival dims everything outside venue.footprint only when that
// footprint is the festival grounds. Portola's footprint is the Pier 80 cargo
// shed and the festival also uses the pier apron, so it must not mask.
import fs from "node:fs";
import vm from "node:vm";
import assert from "node:assert/strict";

const map = fs.readFileSync("map.jsx", "utf8");
assert.match(map, /mapMode === "real" && !\(_footprintRing\(\) && FESTIVAL_CONFIG\.venue\?\.footprintIsGrounds === true\)\) return;/,
  "map.jsx: a real map masks only a footprint marked footprintIsGrounds");

const load = id => {
  const sb = { window: {} }; sb.window.window = sb.window; sb.globalThis = sb.window;
  vm.runInNewContext(fs.readFileSync(`data/festivals/${id}.js`, "utf8"), sb);
  const all = Object.values(sb.window).filter(v => v && typeof v === "object");
  return all.find(v => v.venue) || all.flatMap(v => Object.values(v)).find(v => v && v.venue);
};
let checks = 1;
const portola = load("portola-2026");
if (portola) { assert.notEqual(portola.venue.footprintIsGrounds, true, "Portola's footprint is a building, not the grounds"); checks++; }
for (const id of ["arc-2026", "countdown-nye-2026", "crssd-fall-2026", "decadence-colorado-2026"]) {
  const src = fs.readFileSync(`data/festivals/${id}.js`, "utf8");
  assert.match(src, /footprintIsGrounds: true/, `${id}: footprint marked as the grounds`); checks++;
}
assert.doesNotMatch(fs.readFileSync("data/festivals/portola-2026.js", "utf8"), /footprintIsGrounds: true/, "Portola not marked"); checks++;
console.log(`map-mask-grounds: ${checks} checks`);
