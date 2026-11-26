#!/usr/bin/env node
// Planted-site test for scripts/site-watchdog.mjs. No network: a local server
// serves a tiny site, first clean (positive control: the watchdog must pass),
// then with one defect at a time (each must be caught, named and counted).
import { createServer } from 'node:http';
import { spawn } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const SCRIPT = join(dirname(fileURLToPath(import.meta.url)), 'site-watchdog.mjs');
let site = {};
const server = createServer((req, res) => {
  const p = site[req.url.split('?')[0]];
  if (!p) { res.writeHead(404, { 'content-type': 'text/html' }); res.end('nope'); return; }
  res.writeHead(p.status || 200, { 'content-type': p.type || 'text/html', ...(p.location ? { location: p.location } : {}) });
  res.end(p.body || '');
});
await new Promise(r => server.listen(0, '127.0.0.1', r));
const O = `http://127.0.0.1:${server.address().port}`;

const page = (path, { head = '', body = '', noCanon, noDesc, noOg, noIcon, noTitle } = {}) => `<!doctype html><html><head>
${noTitle ? '' : `<title>Page ${path}</title>`}
${noDesc ? '' : '<meta name="description" content="A page.">'}
${noCanon ? '' : `<link rel="canonical" href="${O}${path}">`}
${noOg ? '' : '<meta property="og:image" content="/og.png">'}
${noIcon ? '' : '<link rel="icon" type="image/png" href="/icon.png">'}
${head}</head><body>${body}</body></html>`;

function clean() {
  return {
    '/robots.txt': { type: 'text/plain', body: `User-agent: *\nSitemap: ${O}/sitemap.xml\nSitemap: ${O}/sitemap-b.xml\n` },
    '/sitemap.xml': { type: 'application/xml', body: `<urlset><url><loc>${O}/</loc></url><url><loc>${O}/a/</loc></url></urlset>` },
    '/sitemap-b.xml': { type: 'application/xml', body: `<urlset><url><loc>${O}/b/</loc></url></urlset>` },
    '/': { body: page('/', { body: `<a href="/a/">a</a> <a href="/c.html#x">c</a> <img src="/img.png"> <a href="mailto:x@y.z">m</a> <a href="/cdn-cgi/l/email-protection#ab">cf</a>
      <script>const s = '<a href="' + editionHref(e.id) + '">';</script>` }) },
    '/a/': { body: page('/a/', { body: '<a href="/">home</a>' }) },
    '/b/': { body: page('/b/') },
    '/c.html': { body: page('/c.html') },
    '/img.png': { type: 'image/png', body: 'x' },
    '/icon.png': { type: 'image/png', body: 'x' },
    '/og.png': { type: 'image/png', body: 'x' },
  };
}

const run = () => new Promise(res => {
  const c = spawn(process.execPath, [SCRIPT, '--origin', O, '--concurrency', '4'], { stdio: ['ignore', 'pipe', 'pipe'] });
  let out = ''; c.stdout.on('data', d => out += d); c.stderr.on('data', d => out += d);
  c.on('close', code => res({ code, out }));
});

let checks = 0, failed = 0;
const check = (ok, msg, out = '') => { checks++; if (!ok) { failed++; console.log(`  ✗  ${msg}\n${out.split('\n').slice(0, 8).map(l => '       ' + l).join('\n')}`); } };

site = clean();
let r = await run();
check(r.code === 0 && /✓ site watchdog: 3 sitemap URL\(s\) from 2 sitemap\(s\)/.test(r.out), 'positive control: clean site passes, both sitemaps walked, script-string href and /cdn-cgi/ ignored', r.out);

const cases = [
  ['sitemap URL 404', s => { delete s['/b/']; }, /status: 1[\s\S]*\/b\/ 404/],
  ['sitemap URL redirects', s => { s['/b/'] = { status: 301, location: '/a/' }; }, /\/b\/ 301 -> \/a\//],
  ['broken internal link', s => { delete s['/c.html']; }, /\/c\.html 404 \(linked from/],
  ['broken asset', s => { delete s['/img.png']; }, /\/img\.png 404/],
  ['noindex in sitemap', s => { s['/a/'].body = page('/a/', { head: '<meta name="robots" content="noindex">' }); }, /noindex: 1/],
  ['missing canonical', s => { s['/a/'].body = page('/a/', { noCanon: true }); }, /canonical: 1[\s\S]*\/a\/ missing/],
  ['canonical elsewhere', s => { s['/a/'].body = page('/a/').replace(`href="${O}/a/"`, `href="${O}/b/"`); }, /canonical: 1[\s\S]*points to/],
  ['missing title', s => { s['/b/'].body = page('/b/', { noTitle: true }); }, /title: 1/],
  ['missing description', s => { s['/b/'].body = page('/b/', { noDesc: true }); }, /description: 1/],
  ['missing og:image', s => { s['/b/'].body = page('/b/', { noOg: true }); }, /og: 1/],
  ['no icon and no /favicon.ico', s => { s['/b/'].body = page('/b/', { noIcon: true }); }, /icon: 1[\s\S]*\/b\/ no <link rel="icon">/],
  ['robots names no sitemap', s => { s['/robots.txt'].body = 'User-agent: *\n'; }, /could not read any sitemap URL/],
];
for (const [name, mutate, re] of cases) {
  site = clean(); mutate(site);
  r = await run();
  check(r.code !== 0 && re.test(r.out), `${name} -> caught and named`, r.out);
}
// The icon rule only fires when /favicon.ico is missing: serve one and the
// same icon-less page is fine (a browser's implicit request is answered).
site = clean(); site['/b/'].body = page('/b/', { noIcon: true }); site['/favicon.ico'] = { type: 'image/x-icon', body: 'x' };
r = await run();
check(r.code === 0, 'icon-less page passes when /favicon.ico is served', r.out);

server.close();
if (failed) { console.log(`✗ site watchdog: ${failed} of ${checks} checks failed`); process.exit(1); }
console.log(`✓ site watchdog: ${checks} checks (clean site passes; ${cases.length}/${cases.length} planted defects caught and named; favicon rule conditional)`);
