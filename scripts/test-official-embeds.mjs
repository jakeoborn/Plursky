#!/usr/bin/env node
// Official embeds on /f/ pages. Offline: the verifier runs against a stubbed
// fetch, and the page checks read the committed pages.
//   · provenance: no embed without platform/url/officialAccount/
//     accountSourceUrl/observedAt/kind
//   · official only: the festival's own site must link the account, and the
//     platform must name that account as the post's author (IG, X, YouTube)
//   · dead URL dropped: an oEmbed failure never reaches a page; a request
//     that cannot complete (network, 429, 5xx) is "could not confirm", never
//     dead, and never flips an embed verified before
//   · a verification result counts only for the record it verified
//   · the weekly job re-checks what the committed pages carry and never
//     posts the list (no issue, count only)
//   · caps: 1 YouTube, 3 social (Instagram + X combined), 1 Spotify
//   · an earlier edition's post is dropped
//   · players: youtube-nocookie only, no autoplay, lazy iframes; embed.js /
//     widgets.js injected once by the loader, never as a static <script src>
//   · no Spotify API image on any /f/ page
//   · Watch & listen sits right after the quick answers; absent with no embeds
//   · for humans: the lineup shows 20 rows and folds the rest into "Show all"
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as L from './lib/official-embeds.mjs';
import { loadRegistry } from './lib/load-registry.mjs';
import { fingerprintInput } from './lib/sitemap-fingerprint.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const problems = []; let checks = 0;
const check = (ok, msg) => { checks++; if (!ok) problems.push(msg); };

// ── 1. Static validation ────────────────────────────────────────────────────
const base = {
  platform: 'instagram', url: 'https://www.instagram.com/p/DVeP_fKEeNA/',
  officialAccount: 'https://www.instagram.com/iiipoints/', accountSourceUrl: 'https://www.iiipoints.com/',
  observedAt: '2026-09-24', kind: 'lineup',
};
check(L.validateEmbed(base) === null, `control: a complete Instagram embed is rejected (${L.validateEmbed(base)})`);
for (const k of ['platform', 'url', 'officialAccount', 'accountSourceUrl', 'observedAt', 'kind']) {
  const e = { ...base }; delete e[k];
  check(L.validateEmbed(e) !== null, `an embed with no ${k} passes validation`);
}
check(L.validateEmbed({ ...base, observedAt: 'Sep 24' }) !== null, 'a non-ISO observedAt passes');
const xOk = { platform: 'x', url: 'https://x.com/EDC_LasVegas/status/2022007805209702830', officialAccount: 'https://twitter.com/EDC_LasVegas', accountSourceUrl: 'https://lasvegas.edc.com/', observedAt: '2026-09-24', kind: 'lineup' };
check(L.validateEmbed(xOk) === null, `control: a complete X embed is rejected (${L.validateEmbed(xOk)})`);
check(L.validateEmbed({ ...xOk, url: 'https://x.com/somefan/status/2022007805209702830' }) !== null, 'an X post by another account passes validation');
check(L.validateEmbed({ ...xOk, officialAccount: undefined }) !== null, 'an X embed with no officialAccount passes');
check(L.validateEmbed({ platform: 'youtube', url: 'https://www.youtube.com/watch?v=XX2XMvp6EL0', officialAccount: 'https://www.youtube.com/user/Hardfest', accountSourceUrl: 'https://www.hardsummer.com/', observedAt: '2026-09-24', kind: 'lineup' }) !== null, 'a YouTube embed that is not an aftermovie/trailer passes');
check(L.validateEmbed({ platform: 'spotify', url: 'https://open.spotify.com/playlist/37i9dQZF1DX5LFAujdafjI', officialAccount: 'https://open.spotify.com/playlist/37i9dQZF1DX5LFAujdafjI', accountSourceUrl: 'https://portolamusicfestival.com/', observedAt: '2026-09-24', kind: 'playlist' }) !== null, "a Spotify editorial playlist passes as the festival's own");

// ── 2. Verification against a stubbed web ───────────────────────────────────
const site = (links) => ({ status: 200, text: `<footer>${links.map(h => `<a href="${h}">x</a>`).join('')}</footer>` });
const oe = (obj) => ({ status: 200, text: JSON.stringify({ html: '<blockquote></blockquote>', ...obj }) });
const igEmbed = (who) => ({ status: 200, text: `<span class="UsernameText">${who}</span>` });
const web = (routes) => async (url) => {
  for (const [re, res] of routes) if (re.test(url)) return typeof res === 'function' ? res(url) : res;
  return { status: 404, text: '' };
};
const run = (e, routes, opts = { youtubePlayable: async () => true }) => L.verifyEmbed(e, web(routes), opts);
const officialSite = [/^https:\/\/www\.iiipoints\.com\/$/, site(['https://www.instagram.com/IIIPoints/', 'https://twitter.com/IIIPoints'])];
{
  const good = await run(base, [officialSite, [/instagram_oembed/, oe({})], [/instagram\.com\/p\/.*\/embed\//, igEmbed('iiipoints')]]);
  check(good.ok, `control: an official, live Instagram post is rejected (${good.reason})`);
  check(good.publishedAt === '2026-03-04', `Instagram publish date decoded as ${good.publishedAt}, expected 2026-03-04`);
  const dead = await run(base, [officialSite, [/instagram_oembed/, { status: 400, text: '{"error":{}}' }], [/embed\//, igEmbed('iiipoints')]]);
  check(!dead.ok, 'a dead Instagram URL (oEmbed 400) passes');
  check(!dead.unknown, 'a definitive oEmbed 400 is reported as "could not confirm" instead of dead');
  const boom = () => { throw new Error('ECONNRESET'); };
  for (const [what, routes] of [
    ['official site unreachable', [[/iiipoints\.com/, boom], [/instagram_oembed/, oe({})], [/embed\//, igEmbed('iiipoints')]]],
    ['official site 503', [[/iiipoints\.com/, { status: 503, text: '' }], [/instagram_oembed/, oe({})], [/embed\//, igEmbed('iiipoints')]]],
    ['oEmbed 429', [officialSite, [/instagram_oembed/, { status: 429, text: '' }], [/embed\//, igEmbed('iiipoints')]]],
    ['oEmbed unreachable', [officialSite, [/instagram_oembed/, boom], [/embed\//, igEmbed('iiipoints')]]],
    ['Instagram embed page 502', [officialSite, [/instagram_oembed/, oe({})], [/embed\//, { status: 502, text: '' }]]],
  ]) {
    const r = await run(base, routes);
    check(!r.ok && r.unknown === true, `${what}: counted as ${r.ok ? 'verified' : 'dead'}, expected "could not confirm" (${r.reason})`);
  }
  const notLinked = await run(base, [[/iiipoints\.com/, site(['https://www.instagram.com/someoneelse/'])], [/instagram_oembed/, oe({})], [/embed\//, igEmbed('iiipoints')]]);
  check(!notLinked.ok && /does not link/.test(notLinked.reason), `an account the official site does not link passes (${notLinked.reason})`);
  const fan = await run(base, [officialSite, [/instagram_oembed/, oe({})], [/embed\//, igEmbed('brittany.gillies')]]);
  check(!fan.ok && /not by the official/.test(fan.reason), `an Instagram post by another account passes (${fan.reason})`);
  const noAuthor = await run(base, [officialSite, [/instagram_oembed/, oe({})], [/embed\//, { status: 200, text: '<div></div>' }]]);
  check(!noAuthor.ok, 'an Instagram post whose author cannot be read passes');
  const siteDown = await run(base, [[/iiipoints\.com/, { status: 403, text: '' }], [/instagram_oembed/, oe({})], [/embed\//, igEmbed('iiipoints')]]);
  check(!siteDown.ok, 'an embed whose official site cannot be read passes');
}
{
  const edc = [/^https:\/\/lasvegas\.edc\.com\/$/, site(['https://twitter.com/EDC_LasVegas'])];
  const good = await run(xOk, [edc, [/publish\.x\.com\/oembed/, oe({ author_url: 'https://twitter.com/EDC_LasVegas' })]]);
  check(good.ok, `control: an official, live X post is rejected (${good.reason})`);
  check(good.publishedAt === '2026-02-12', `X publish date decoded as ${good.publishedAt}, expected 2026-02-12`);
  const dead = await run(xOk, [edc, [/publish\.x\.com\/oembed/, { status: 404, text: '' }]]);
  check(!dead.ok, 'a dead or deleted X post passes');
  const other = await run(xOk, [edc, [/publish\.x\.com\/oembed/, oe({ author_url: 'https://twitter.com/somefan' })]]);
  check(!other.ok, 'an X post the oEmbed attributes to another account passes');
  const unlinked = await run(xOk, [[/lasvegas\.edc\.com/, site(['https://www.instagram.com/edc_lasvegas/'])], [/publish\.x\.com\/oembed/, oe({ author_url: 'https://twitter.com/EDC_LasVegas' })]]);
  check(!unlinked.ok, 'an X account the official site does not link passes');
}
{
  const yt = { platform: 'youtube', url: 'https://www.youtube.com/watch?v=XX2XMvp6EL0', officialAccount: 'https://www.youtube.com/user/Hardfest', accountSourceUrl: 'https://www.hardsummer.com/', observedAt: '2026-09-24', kind: 'aftermovie' };
  const chan = (id) => ({ status: 200, text: `<link rel="canonical" href="https://www.youtube.com/channel/${id}">` });
  const routes = (authorId) => [[/hardsummer\.com/, site(['https://www.youtube.com/user/Hardfest'])], [/youtube\.com\/oembed/, oe({ author_url: 'https://www.youtube.com/@Hardfest' })],
    [/youtube\.com\/user\/Hardfest/, chan('UCZVJbgloLghAYhH2uyaKIOQ')], [/youtube\.com\/@Hardfest/, chan(authorId)],
    [/watch\?v=/, { status: 200, text: '<meta itemprop="uploadDate" content="2026-08-11T20:34:33-07:00">' }]];
  const good = await run(yt, routes('UCZVJbgloLghAYhH2uyaKIOQ'));
  check(good.ok && good.publishedAt === '2026-08-11', `control: an official YouTube recap is rejected or undated (${good.reason}, ${good.publishedAt})`);
  const other = await run(yt, routes('UCaaaaaaaaaaaaaaaaaaaaaa'));
  check(!other.ok, 'a YouTube video from a different channel passes');
  // oEmbed says 200 for videos the player then refuses ("This video is
  // unavailable"): HARD Summer's own 2026 recap did exactly that.
  const refused = await run(yt, routes('UCZVJbgloLghAYhH2uyaKIOQ'), { youtubePlayable: async () => false });
  check(!refused.ok && /refuses embedded playback/.test(refused.reason), `a video the embedded player refuses passes (${refused.reason})`);
  const unknown = await run(yt, routes('UCZVJbgloLghAYhH2uyaKIOQ'), { youtubePlayable: async () => null });
  check(!unknown.ok, 'a video whose embedded playback could not be confirmed passes');
  const watchDown = await run(yt, routes('UCZVJbgloLghAYhH2uyaKIOQ').map(([re, res]) => [re, /watch/.test(String(re)) ? { status: 503, text: '' } : res]));
  check(!watchDown.ok && watchDown.unknown === true, `YouTube watch page 503: counted as ${watchDown.ok ? 'verified' : 'dead'}, expected "could not confirm" (${watchDown.reason})`);
  const chanDown = await run(yt, routes('UCZVJbgloLghAYhH2uyaKIOQ').map(([re, res]) => [re, /Hardfest/.test(String(re)) && /user/.test(String(re)) ? { status: 500, text: '' } : res]));
  check(!chanDown.ok && chanDown.unknown === true, `YouTube channel page 500: counted as ${chanDown.ok ? 'verified' : 'dead'}, expected "could not confirm" (${chanDown.reason})`);
  const noProbe = await run(yt, routes('UCZVJbgloLghAYhH2uyaKIOQ'), {});
  check(!noProbe.ok, 'a YouTube video passes with no player probe at all');
}
{
  const sp = { platform: 'spotify', url: 'https://open.spotify.com/playlist/69NIxGSDXjmdUGSqM32IEA', officialAccount: 'https://open.spotify.com/playlist/69NIxGSDXjmdUGSqM32IEA', accountSourceUrl: 'https://www.hardsummer.com/', observedAt: '2026-09-24', kind: 'playlist' };
  const linked = await run(sp, [[/hardsummer\.com/, site(['https://open.spotify.com/playlist/69NIxGSDXjmdUGSqM32IEA?si=abc'])], [/open\.spotify\.com\/oembed/, oe({})]]);
  check(linked.ok, `control: the playlist the official site links is rejected (${linked.reason})`);
  const embedLinked = await run(sp, [[/hardsummer\.com/, { status: 200, text: '<iframe src="https://open.spotify.com/embed/playlist/69NIxGSDXjmdUGSqM32IEA"></iframe>' }], [/open\.spotify\.com\/oembed/, oe({})]]);
  check(embedLinked.ok, `the playlist the official site embeds as a player is rejected (${embedLinked.reason})`);
  const unlinked = await run(sp, [[/hardsummer\.com/, site(['https://open.spotify.com/playlist/0000000000000000000000'])], [/open\.spotify\.com\/oembed/, oe({})]]);
  check(!unlinked.ok, 'a playlist the official site does not link passes');
}

// ── 3. Selection: verified only, caps, edition window ───────────────────────
{
  const mk = (platform, i, kind, extra = {}) => ({
    platform, kind, observedAt: '2026-09-24', accountSourceUrl: 'https://f.test/',
    url: { youtube: `https://www.youtube.com/watch?v=${String(i).padStart(11, 'a')}`, instagram: `https://www.instagram.com/p/Code${i}/`, x: `https://x.com/fest/status/${2022007805209702830n + BigInt(i)}`, spotify: `https://open.spotify.com/playlist/${String(i).padStart(22, 'b')}` }[platform],
    officialAccount: { youtube: 'https://www.youtube.com/@fest', instagram: 'https://www.instagram.com/fest/', x: 'https://x.com/fest', spotify: 'https://open.spotify.com/user/fest' }[platform], ...extra,
  });
  const curated = { f: [
    mk('youtube', 1, 'aftermovie'), mk('youtube', 2, 'trailer'), mk('youtube', 3, 'aftermovie'),
    mk('instagram', 1, 'photo'), mk('instagram', 2, 'photo'), mk('instagram', 3, 'lineup'), mk('instagram', 4, 'carousel'), mk('instagram', 5, 'photo'),
    mk('x', 1, 'announcement'), mk('x', 2, 'lineup'),
    mk('spotify', 1, 'playlist'), mk('spotify', 2, 'playlist'),
    mk('instagram', 9, 'lineup'), // verified DEAD below
    mk('instagram', 8, 'lineup'), // an earlier edition's post
  ] };
  const results = {};
  for (const e of curated.f) results[e.url] = { ok: true, publishedAt: '2026-05-01', sig: L.embedSig('f', e) };
  results[mk('instagram', 9, 'lineup').url] = { ok: false, reason: 'oEmbed returned 400', sig: L.embedSig('f', mk('instagram', 9, 'lineup')) };
  results[mk('instagram', 8, 'lineup').url] = { ok: true, publishedAt: '2024-02-27', sig: L.embedSig('f', mk('instagram', 8, 'lineup')) };
  const sel = L.selectEmbeds('f', { curated, verified: { results } }, '2025-04-01');
  check(sel.youtube.length === 1, `YouTube cap: ${sel.youtube.length} shown, cap 1`);
  check(sel.social.length === 3, `social cap: ${sel.social.length} shown, cap 3 (Instagram + X combined)`);
  check(sel.spotify.length === 1, `Spotify cap: ${sel.spotify.length} shown, cap 1`);
  check(sel.social.some(e => e.platform === 'x'), 'X posts never make the combined social budget (a lineup post should)');
  check(['lineup', 'lineup'].every((k, i) => sel.social[i].kind === k), `lineup posts do not lead the social budget: ${sel.social.map(e => e.kind).join(',')}`);
  const all = [...sel.youtube, ...sel.social, ...sel.spotify].map(e => e.url);
  check(!all.includes(mk('instagram', 9, 'lineup').url), 'a dead (verified not-ok) embed is selected');
  check(!all.includes(mk('instagram', 8, 'lineup').url), "an earlier edition's post is selected");
  const none = L.selectEmbeds('f', { curated, verified: { results: {} } }, '2025-04-01');
  check(L.embedCount(none) === 0, 'embeds with no verification record are selected');
  check(L.embedsSection('X', none) === '', 'a festival with no embeds renders a Watch & listen section');
  check(L.embedWindowStart({ id: 'x-2027' }, null) === '2026-01-01', 'TBA-dated edition window is not the start of the prior year');
  // A result counts only for the record it verified.
  const one = mk('spotify', 1, 'playlist');
  const shown = (cur, fid = 'f') => L.embedCount(L.selectEmbeds(fid, { curated: cur, verified: { results } }, '2025-04-01'));
  check(shown({ f: [one] }) === 1, 'control: a verified playlist is not selected');
  check(shown({ g: [one] }, 'g') === 0, 'a URL verified for one festival is shown on another festival\'s page');
  check(shown({ f: [{ ...one, officialAccount: 'https://open.spotify.com/user/someoneelse' }] }) === 0, "an embed whose officialAccount changed after verification is still shown");
  check(shown({ f: [{ ...one, accountSourceUrl: 'https://elsewhere.test/' }] }) === 0, "an embed whose accountSourceUrl changed after verification is still shown");
  check(L.embedCount(L.selectEmbeds('f', { curated: { f: [one] }, verified: { results: { [one.url]: { ok: true } } } })) === 0, 'a verification result with no record signature is trusted');
  // A could-not-confirm run keeps an embed verified before; a dead one does not.
  const prior = { ok: true, sig: L.embedSig('f', one), publishedAt: null, checkedAt: '2026-09-01' };
  check(L.resultRecord('f', one, { ok: false, unknown: true, reason: 'x' }, prior, '2026-09-28').ok === true, 'a transient failure flipped a verified embed off the page');
  check(L.resultRecord('f', one, { ok: false, reason: 'oEmbed returned 404' }, prior, '2026-09-28').ok === false, 'a dead embed kept its old verified result');
  check(L.resultRecord('g', one, { ok: false, unknown: true, reason: 'x' }, prior, '2026-09-28').ok === false, 'a transient failure kept a result verified for a different record');
  check(L.resultRecord('f', one, { ok: true, reason: null }, null, '2026-09-28').sig === L.embedSig('f', one), 'the checker writes a result without its record signature');
}

// ── 3b. The weekly job: what it checks and what it posts ────────────────────
{
  const html = '<iframe src="https://www.youtube-nocookie.com/embed/XX2XMvp6EL0"></iframe><blockquote class="instagram-media" data-instgrm-permalink="https://www.instagram.com/p/DVeP_fKEeNA/"></blockquote>';
  check(L.embedShownOn(html, { platform: 'youtube', url: 'https://www.youtube.com/watch?v=XX2XMvp6EL0' }), 'control: a nocookie YouTube iframe is not recognised on a page');
  check(L.embedShownOn(html, base), 'control: an Instagram blockquote is not recognised on a page');
  check(!L.embedShownOn(html, xOk), 'an X post absent from the page counts as shown');
  const wf = readFileSync(path.join(root, '.github/workflows/embeds-weekly.yml'), 'utf8');
  check(!/gh issue|issues:\s*write/.test(wf), 'the weekly embeds job posts dead embeds in a public issue (report privately)');
  check(/head -n 1 embeds-report\.md/.test(wf) && !/cat embeds-report\.md/.test(wf), 'the weekly embeds job prints the dead-embed list to its public log');
}

// ── 4. The committed pages ──────────────────────────────────────────────────
const { curated, verified } = L.loadEmbedData(root);
const pages = readdirSync(path.join(root, 'f')).filter(d => existsSync(path.join(root, 'f', d, 'index.html')));
check(pages.length >= 20, `only ${pages.length} /f/ pages found`);
let withEmbeds = 0, without = 0, totalEmbeds = 0;
const okUrls = new Set(Object.entries(verified.results || {}).filter(([, r]) => r.ok).map(([u]) => u));
const curatedFor = id => (curated[id] || []);
for (const id of pages) {
  const html = readFileSync(path.join(root, 'f', id, 'index.html'), 'utf8');
  const at = `[${id}]`;
  check(!/https?:\/\/(?:i|mosaic|seeded-session-images)\.scdn\.co|image-cdn-[a-z]+\.spotifycdn\.com|lineup-images\.scdn\.co/.test(html), `${at} carries a Spotify API image`);
  check(!/<script[^>]+src=["'][^"']*(instagram\.com\/embed\.js|platform\.twitter\.com\/widgets\.js)/.test(html), `${at} loads embed.js/widgets.js eagerly as a <script src>`);
  const m = html.match(/<section id="watch"[\s\S]*?<\/section>/);
  if (!m) { without++; check(!/instagram-media|twitter-tweet|youtube-nocookie|open\.spotify\.com\/embed/.test(html), `${at} shows an embed outside Watch & listen`); continue; }
  withEmbeds++;
  const sec = m[0];
  const iframes = [...sec.matchAll(/<iframe\b[^>]*>/g)].map(x => x[0]);
  for (const f of iframes) {
    const src = (f.match(/src="([^"]+)"/) || [])[1] || '';
    check(/^https:\/\/www\.youtube-nocookie\.com\/embed\/[A-Za-z0-9_-]{11}$|^https:\/\/open\.spotify\.com\/embed\/playlist\/[A-Za-z0-9]{22}$/.test(src), `${at} iframe from an unexpected source or with parameters: ${src}`);
    check(/loading="lazy"/.test(f), `${at} iframe is not lazy: ${src}`);
  }
  check(!/autoplay=1|\bautoplay\b(?!;)/i.test(sec.replace(/allow="[^"]*"/g, '')), `${at} Watch & listen autoplays`);
  check(!/youtube\.com\/embed/.test(sec), `${at} uses youtube.com instead of youtube-nocookie.com`);
  check(!/referrerpolicy="no-referrer"/.test(sec), `${at} suppresses the Referer on a player`);
  const yt = (sec.match(/embed-yt/g) || []).length, sp = (sec.match(/embed-sp/g) || []).length;
  const social = (sec.match(/class="instagram-media"|class="twitter-tweet"/g) || []).length;
  check(yt <= 1 && sp <= 1 && social <= 3, `${at} over the caps: ${yt} YouTube, ${social} social, ${sp} Spotify`);
  totalEmbeds += yt + sp + social;
  // Every rendered embed is a curated, provenance-complete, verified one.
  const shown = [
    ...[...sec.matchAll(/youtube-nocookie\.com\/embed\/([A-Za-z0-9_-]{11})/g)].map(x => e => e.platform === 'youtube' && L.youtubeId(e.url) === x[1]),
    ...[...sec.matchAll(/data-instgrm-permalink="https:\/\/www\.instagram\.com\/(?:p|reel)\/([A-Za-z0-9_-]+)\/"/g)].map(x => e => e.platform === 'instagram' && L.instagramCode(e.url)?.code === x[1]),
    ...[...sec.matchAll(/twitter\.com\/[A-Za-z0-9_]+\/status\/(\d+)/g)].map(x => e => e.platform === 'x' && L.xStatus(e.url)?.id === x[1]),
    ...[...sec.matchAll(/open\.spotify\.com\/embed\/playlist\/([A-Za-z0-9]{22})/g)].map(x => e => e.platform === 'spotify' && L.spotifyPlaylist(e.url) === x[1]),
  ];
  // The weekly job re-checks exactly what this page renders.
  const weekly = curatedFor(id).filter(e => L.embedShownOn(html, e)).length;
  check(weekly === shown.length, `${at} the weekly job would check ${weekly} embeds; the page renders ${shown.length}`);
  for (const match of shown) {
    const e = curatedFor(id).find(match);
    check(!!e && L.validateEmbed(e) === null && okUrls.has(e.url), `${at} shows an embed that is not curated, complete and verified`);
  }
  // No post content persisted: the social blockquotes hold only the link.
  for (const bq of sec.match(/<blockquote[\s\S]*?<\/blockquote>/g) || []) {
    check(/^<blockquote[^>]*><a href="[^"]+" rel="noopener">View this post on (Instagram|X)<\/a><\/blockquote>$/.test(bq), `${at} a social blockquote carries more than its permalink: ${bq.slice(0, 120)}`);
  }
  check((sec.match(/<figure class="embed/g) || []).length === (sec.match(/class="embed-cap"/g) || []).length, `${at} an embed has no caption naming its account`);
  const loaders = (html.match(/document\.getElementById\('watch'\)/g) || []).length;
  check(loaders === 1, `${at} the embed loader appears ${loaders} times`);
  // Placement: right after the quick answers, before the map/schedule/lineup.
  const iWatch = html.indexOf('<section id="watch"'), iAns = html.indexOf('aria-labelledby="answers-h"');
  const later = ['aria-labelledby="map-h"', 'aria-labelledby="schedule-h"', 'aria-labelledby="lineup-h"'].map(s => html.indexOf(s)).filter(i => i >= 0);
  check(iAns >= 0 && iAns < iWatch && later.every(i => i > iWatch), `${at} Watch & listen is not directly after the quick answers`);
  // Instagram's 326px minimum must never widen a 320px page.
  check(/section\.watch \{ overflow-x:clip; \}/.test(html) && /section\.watch \.embed-ig \{ overflow-x:auto;/.test(html), `${at} Watch & listen can widen the page (no overflow containment)`);
  // X embeds opt out of X's tailoring (developer policy's do-not-track).
  for (const bq of sec.match(/<blockquote class="twitter-tweet"[^>]*>/g) || []) check(/data-dnt="true"/.test(bq), `${at} an X embed does not set data-dnt="true"`);
}
check(withEmbeds >= 5, `only ${withEmbeds} pages carry embeds; the sourced set should give more`);
check(without >= 1, 'every page has embeds; the section-absent case is untested');

// ── 4b. lastmod moves with the embeds ────────────────────────────────────────
// The sitemap fingerprint must hash exactly the embeds the page shows, so a
// verification that drops or restores one moves that page's lastmod only.
{
  const { REG, DS, scheduleActs, eventDates } = loadRegistry(root);
  const TODAY = new Date().toISOString().slice(0, 10);
  for (const entry of REG) {
    const id = entry.config.id;
    const html = readFileSync(path.join(root, 'f', id, 'index.html'), 'utf8');
    const sec = (html.match(/<section id="watch"[\s\S]*?<\/section>/) || [''])[0];
    const fpEmbeds = fingerprintInput(entry, { DS, scheduleActs, eventDates, TODAY }).embeds || [];
    const onPage = (sec.match(/<figure class="embed/g) || []).length;
    check(Array.isArray(fpEmbeds) && fpEmbeds.length === onPage, `[${id}] sitemap fingerprint hashes ${fpEmbeds.length} embeds, the page shows ${onPage}`);
  }
}

// ── 5. For humans: long lists fold ──────────────────────────────────────────
for (const id of pages) {
  const html = readFileSync(path.join(root, 'f', id, 'index.html'), 'utf8');
  const sec = (html.match(/<section aria-labelledby="lineup-h">[\s\S]*?<\/section>/) || [''])[0];
  const lists = sec.split('<details');
  const visible = (lists[0].match(/<li>/g) || []).length;
  const total = (sec.match(/<li>/g) || []).length;
  check(visible <= 20, `[${id}] ${visible} lineup rows shown before "Show all" (max 20)`);
  if (total > 20) check(/<summary>Show all \d+ artists<\/summary>/.test(sec) && new RegExp(`Show all ${total} artists`).test(sec), `[${id}] lineup of ${total} has no "Show all ${total} artists"`);
  const ld = (html.match(/"performer": \[[\s\S]*?\n  \]/) || [''])[0];
  const ldCount = (ld.match(/"MusicGroup"/g) || []).length;
  if (ldCount) check(ldCount === total, `[${id}] JSON-LD lists ${ldCount} performers, the page ${total}: folding hid names from the HTML`);
}

if (problems.length) {
  console.log(`  ✗ official embeds: ${problems.length} of ${checks} checks failed`);
  for (const p of problems) console.log('    ✗ ' + p);
  process.exit(1);
}
console.log(`  ✓ official embeds: ${checks} checks (${withEmbeds} pages with embeds, ${totalEmbeds} embeds, ${without} without)`);
