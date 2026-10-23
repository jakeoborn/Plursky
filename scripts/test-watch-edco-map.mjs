#!/usr/bin/env node
// test-watch-edco-map.mjs: runs the EDC Orlando map watcher's ENTRYPOINT
// against a local server and asserts its exit code AND what it prints.
//   1  a candidate: absolute, root-relative, path-relative, protocol-relative,
//      uppercase, query-string, <base href>, image <meta>, srcset, and a
//      relative link resolved against the page's final URL after a redirect
//   0  every page read, none of: plain page, sitemap, unrelated image,
//      javascript:/data:/mailto: schemes, map words in prose and descriptions
//   2  a page unreadable and no candidate (HTTP 500, timeout, a body cut off
//      mid-read, connection refused): UNKNOWN, never green
// Codex P1 on #337: the absolute-only scan exited 0 on relative map links.
// WATCHER=<path> runs another implementation (the pre-fix one, for the proof).
import { createServer } from "node:http";
import { spawn } from "node:child_process";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const WATCHER = process.env.WATCHER || join(ROOT, "scripts/watch-edco-map.mjs");
let checks = 0, failed = 0;
const check = (ok, msg) => { checks++; if (!ok) { failed++; console.log(`  ✗  ${msg}`); } };

const page = body => `<!doctype html><html><head><title>EDC Orlando</title></head><body>${body}</body></html>`;
const ROUTES = {
  "/abs": page(`<img src="https://cdn.example/edco-map.jpg" alt="">`),
  "/root-rel": page(`<a href="/uploads/edco-map.pdf">Festival map</a>`),
  "/path-rel/": page(`<img src="uploads/edco-map.png">`),
  "/proto-rel": page(`<img src='//cdn.example/edco-map.webp'>`),
  "/upper": page(`<a href=/img/EDCO-MAP.JPG>map</a>`),
  "/query": page(`<a href="/a/edco-map.png?v=3&amp;w=2#top">map</a>`),
  "/based": `<html><head><base href="https://assets.example/2026/"></head><body><img src="festival-map.png"></body></html>`,
  "/meta": `<html><head><meta property="og:image" content="/share/edco-map-2026.jpg"></head><body></body></html>`,
  "/srcset": page(`<img srcset="/s/small.png 1x, /s/edco-map@2x.webp 2x">`),
  "/landing/deep/": page(`<img src="map-2026.png">`),
  // Negatives: readable pages with nothing to find.
  "/plain": page(`<h1>Info</h1><p>Doors at 4pm.</p>`),
  "/sitemap": page(`<a href="/sitemap.xml">Sitemap</a> <a href="/sitemap-map.png">x</a>`),
  "/unrelated": page(`<img src="/img/hero.jpg"><img src="/img/stage-lineup.png">`),
  "/schemes": page(`<a href="javascript:open('edco-map.png')">x</a><img src="data:image/png;base64,map.png"><a href="mailto:map.pdf">m</a>`),
  "/markup": `<html><head><meta name="description" content="the festival map.pdf drops soon"></head><body><p>See map.png on the day.</p><span data-label="edco-map.png"></span></body></html>`,
};
const server = createServer((req, res) => {
  const path = req.url.split("?")[0];
  if (path === "/redirect") { res.writeHead(302, { location: "/landing/deep/" }); return res.end(); }
  if (path === "/500") { res.writeHead(500); return res.end("boom"); }
  if (path === "/hang") return;                       // never answers
  if (path === "/broken") {                            // headers, then the body is cut off
    res.writeHead(200, { "content-type": "text/html", "content-length": "5000" });
    res.write(`<html><body><img src="/x`); return setTimeout(() => res.socket.destroy(), 50);
  }
  if (!(path in ROUTES)) { res.writeHead(404); return res.end("nope"); }
  res.writeHead(200, { "content-type": "text/html" }); res.end(ROUTES[path]);
});
await new Promise(r => server.listen(0, "127.0.0.1", r));
const B = `http://127.0.0.1:${server.address().port}`;
const dead = await new Promise(r => { const s = createServer(); s.listen(0, "127.0.0.1", () => { const p = s.address().port; s.close(() => r(p)); }); });

const run = pages => new Promise(res => {
  const ch = spawn(process.execPath, [WATCHER], { env: { ...process.env, EDCO_WATCH_PAGES: pages.join(","), EDCO_WATCH_TIMEOUT_MS: "500" } });
  let out = ""; ch.stdout.on("data", d => out += d); ch.stderr.on("data", d => out += d);
  const kill = setTimeout(() => ch.kill("SIGKILL"), 8000);
  ch.on("close", code => { clearTimeout(kill); res({ code, out }); });
});

try {
  const POS = [
    ["absolute URL", "/abs", "https://cdn.example/edco-map.jpg"],
    ["root-relative href", "/root-rel", `${B}/uploads/edco-map.pdf`],
    ["path-relative src", "/path-rel/", `${B}/path-rel/uploads/edco-map.png`],
    ["protocol-relative src", "/proto-rel", "http://cdn.example/edco-map.webp"],
    ["uppercase extension, unquoted href", "/upper", `${B}/img/EDCO-MAP.JPG`],
    ["query-string asset, entity-encoded", "/query", `${B}/a/edco-map.png?v=3&w=2#top`],
    ["<base href>", "/based", "https://assets.example/2026/festival-map.png"],
    ["og:image meta", "/meta", `${B}/share/edco-map-2026.jpg`],
    ["srcset", "/srcset", `${B}/s/edco-map@2x.webp`],
    ["relative link after a redirect resolves against the final URL", "/redirect", `${B}/landing/deep/map-2026.png`],
  ];
  for (const [what, path, want] of POS) {
    const r = await run([B + path]);
    check(r.code === 1 && r.out.includes(want) && /inspect each source by hand/.test(r.out), `${what}: exit 1 printing ${want} (exit ${r.code}; ${r.out.trim().split("\n").pop()})`);
  }
  const NEG = ["/plain", "/sitemap", "/unrelated", "/schemes", "/markup"].map(p => B + p);
  let r = await run(NEG);
  check(r.code === 0 && /all 5 page\(s\) read; the scan found no map candidate \(not proof/.test(r.out), `negatives (plain, sitemap, unrelated image, schemes, prose): exit 0, worded as what the scan saw (exit ${r.code}; ${r.out.trim().split("\n").pop()})`);
  for (const p of NEG) { const one = await run([p]); check(one.code === 0, `negative ${p.slice(B.length)} alone: exit 0 (got ${one.code})`); }

  const UNK = [["HTTP 500", `${B}/500`, /HTTP 500/], ["timeout", `${B}/hang`, /timed out after 500 ms/], ["body cut off mid-read", `${B}/broken`, /\/broken → /], ["connection refused", `http://127.0.0.1:${dead}/`, /ECONNREFUSED|fetch failed/]];
  for (const [what, url, why] of UNK) {
    r = await run([url]);
    check(r.code === 2 && /UNKNOWN/.test(r.out) && r.out.includes(url) && why.test(r.out), `${what}: exit 2, UNKNOWN with the URL and reason (exit ${r.code}; ${r.out.trim().split("\n").pop()})`);
  }
  r = await run([...NEG, `${B}/500`]);
  check(r.code === 2 && /1 of 6 page\(s\) could not be read/.test(r.out), `readable negatives plus one failed page: exit 2, not green (exit ${r.code})`);
  r = await run([`${B}/root-rel`, `${B}/500`]);
  check(r.code === 1 && r.out.includes(`${B}/uploads/edco-map.pdf`) && /could not be read, so this list may be incomplete/.test(r.out) && r.out.includes(`${B}/500 → HTTP 500`), `a candidate plus a failed page: exit 1, and the failure is disclosed (exit ${r.code})`);
} finally { server.close(); server.closeAllConnections?.(); }

if (failed) { console.log(`✗ EDC Orlando map watch: ${failed} of ${checks} checks failed`); process.exit(1); }
console.log(`✓ EDC Orlando map watch: ${checks} checks (10 candidate forms exit 1, 5 negatives exit 0, 4 unreadable kinds exit 2, mixed runs disclosed)`);
