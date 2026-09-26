// Writes photos/have.js: the artist photo slugs present in the private,
// gitignored photos/ folder, so the mocks only reference files that exist.
import fs from "node:fs"; import path from "node:path"; import { fileURLToPath } from "node:url";
const dir = path.join(path.dirname(fileURLToPath(import.meta.url)), "photos");
const have = fs.readdirSync(dir).filter((f) => /^artist-.+\.jpg$/.test(f) && fs.statSync(path.join(dir, f)).size > 2000).map((f) => f.slice(7, -4)).sort();
fs.writeFileSync(path.join(dir, "have.js"), `window.HAVE_PHOTOS=${JSON.stringify(have)};\n`);
console.log(have.length, "artist photos");
