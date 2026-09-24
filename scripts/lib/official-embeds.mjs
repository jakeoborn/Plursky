// Official embeds on /f/ pages: the festival's OWN posts, shown through each
// platform's own embed mechanism. Nothing is downloaded, re-hosted or stored
// but the post's permalink: Instagram and X render from a permalink-only
// blockquote that the platform's script fills in live, YouTube and Spotify
// from their players. So no post text or media ever lands in our HTML, which
// is what Meta's oEmbed terms ask ("front-end view", no persisting) and what
// keeps a deleted post from outliving its deletion on our pages.
//
// Two files:
//   data/official-embeds.json           hand-curated, with provenance per embed
//   data/official-embeds.verified.json  written by check-official-embeds.mjs;
//                                       the generator shows ONLY embeds it
//                                       marks ok, so gen --check needs no network
import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

export const CAPS = { youtube: 1, social: 3, spotify: 1 };
export const PLATFORMS = ['youtube', 'instagram', 'x', 'spotify'];
export const KINDS = ['aftermovie', 'trailer', 'lineup', 'announcement', 'photo', 'carousel', 'video', 'playlist'];
const REQUIRED = ['platform', 'url', 'officialAccount', 'accountSourceUrl', 'observedAt', 'kind'];
// Lineup/announcement lead the social budget; then the edition's photos.
const KIND_RANK = { aftermovie: 0, trailer: 1, lineup: 0, announcement: 1, photo: 2, carousel: 2, video: 3, playlist: 0 };

// ── Parsing ───────────────────────────────────────────────────────────────
export function youtubeId(url) {
  const m = String(url).match(/^https:\/\/(?:www\.)?(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/shorts\/)([A-Za-z0-9_-]{11})(?:[&?#].*)?$/);
  return m ? m[1] : null;
}
export function instagramCode(url) {
  const m = String(url).match(/^https:\/\/(?:www\.)?instagram\.com\/(?:[A-Za-z0-9_.]+\/)?(p|reel)\/([A-Za-z0-9_-]+)\/?(?:\?.*)?$/);
  return m ? { type: m[1], code: m[2] } : null;
}
export function xStatus(url) {
  const m = String(url).match(/^https:\/\/(?:www\.)?(?:x|twitter)\.com\/([A-Za-z0-9_]{1,15})\/status\/(\d{5,25})(?:[/?#].*)?$/);
  return m ? { handle: m[1].toLowerCase(), id: m[2] } : null;
}
export function spotifyPlaylist(url) {
  const m = String(url).match(/^https:\/\/open\.spotify\.com\/(?:embed\/)?playlist\/([A-Za-z0-9]{22})(?:[?#].*)?$/);
  return m ? m[1] : null;
}

// The account an officialAccount URL names, normalised per platform:
// instagram/x → lowercase handle; youtube → "@handle" or "channel/<id>";
// spotify → "user/<id>".
export function accountKey(platform, url) {
  const u = String(url || '').trim();
  if (platform === 'instagram') { const m = u.match(/^https?:\/\/(?:www\.)?instagram\.com\/([A-Za-z0-9_.]+)\/?(?:\?.*)?$/i); return m ? m[1].toLowerCase() : null; }
  if (platform === 'x') { const m = u.match(/^https?:\/\/(?:www\.)?(?:x|twitter)\.com\/([A-Za-z0-9_]{1,15})\/?(?:\?.*)?$/i); return m ? m[1].toLowerCase() : null; }
  if (platform === 'youtube') {
    const h = u.match(/^https?:\/\/(?:www\.)?youtube\.com\/(@[A-Za-z0-9_.-]+)\/?/i); if (h) return h[1].toLowerCase();
    const c = u.match(/^https?:\/\/(?:www\.)?youtube\.com\/(channel\/UC[A-Za-z0-9_-]{22}|user\/[A-Za-z0-9_-]+|c\/[A-Za-z0-9_-]+)\/?/i); if (c) return c[1].toLowerCase();
    // Legacy vanity URL: youtube.com/<name> (umftv, govballnyc).
    const v = u.match(/^https?:\/\/(?:www\.)?youtube\.com\/([A-Za-z0-9_-]+)\/?(?:[?#].*)?$/i);
    return v && !/^(watch|embed|shorts|playlist|results|feed|live|redirect|about|t|s)$/i.test(v[1]) ? v[1].toLowerCase() : null;
  }
  if (platform === 'spotify') {
    // Festival sites link either their Spotify user or the playlist itself;
    // a playlist the official site links IS the official playlist.
    const pl = spotifyPlaylist(u.replace(/\?.*$/, '')); if (pl) return 'playlist/' + pl;
    const m = u.match(/^https?:\/\/open\.spotify\.com\/user\/([A-Za-z0-9._-]+)\/?(?:\?.*)?$/i); return m ? 'user/' + m[1].toLowerCase() : null;
  }
  return null;
}

// ── Static validation: provenance + shape ─────────────────────────────────
export function validateEmbed(e) {
  if (!e || typeof e !== 'object') return 'not an object';
  for (const k of REQUIRED) if (!e[k] || typeof e[k] !== 'string') return `missing ${k}`;
  if (!PLATFORMS.includes(e.platform)) return `unknown platform ${e.platform}`;
  if (!KINDS.includes(e.kind)) return `unknown kind ${e.kind}`;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(e.observedAt)) return 'observedAt is not YYYY-MM-DD';
  if (!/^https:\/\//.test(e.accountSourceUrl)) return 'accountSourceUrl is not https';
  if (!accountKey(e.platform, e.officialAccount)) return `officialAccount is not a ${e.platform} account URL`;
  const shape = { youtube: youtubeId, instagram: instagramCode, x: xStatus, spotify: spotifyPlaylist }[e.platform](e.url);
  if (!shape) return `url is not a ${e.platform} post/video/playlist URL`;
  // An X status URL carries its author: it must be the official handle.
  if (e.platform === 'x' && shape.handle !== accountKey('x', e.officialAccount) && shape.handle !== 'i') return 'X post URL names a different account';
  if (e.platform === 'youtube' && !['aftermovie', 'trailer'].includes(e.kind)) return 'YouTube embeds are an aftermovie or trailer only';
  if (e.platform === 'spotify' && e.kind !== 'playlist') return 'Spotify embeds are an official playlist only';
  // 37i9dQZF1… ids are Spotify's own editorial playlists: not the festival's,
  // even when the festival's site links one.
  if (e.platform === 'spotify' && /^37i9dQZF1/.test(spotifyPlaylist(e.url))) return 'Spotify editorial playlist, not the festival\'s own';
  return null;
}

// Does this official page link the account? Matches hrefs, not prose.
export function pageLinksAccount(html, platform, officialAccount) {
  const want = accountKey(platform, officialAccount);
  if (!want || !html) return false;
  // hrefs, plus iframe srcs: a site that embeds its playlist player links it.
  const hrefs = [...String(html).matchAll(/(?:href|src)\s*=\s*["']([^"']+)["']/gi)].map(m => m[1].replace(/&amp;/g, '&'));
  return hrefs.some(h => accountKey(platform, h.split('#')[0]) === want);
}

// ── Publish dates ─────────────────────────────────────────────────────────
// Instagram shortcodes and X status ids both encode the post's creation time
// in their high bits, so neither needs a scrape. YouTube's comes from the
// watch page's uploadDate. A playlist has no edition, so it has no date.
const IG_ALPHA = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
export function instagramPublishedAt(url) {
  const c = instagramCode(url); if (!c) return null;
  let n = 0n; for (const ch of c.code.slice(0, 11)) { const i = IG_ALPHA.indexOf(ch); if (i < 0) return null; n = n * 64n + BigInt(i); }
  const ms = Number(n >> 23n) + 1314220021721;
  return new Date(ms).toISOString().slice(0, 10);
}
export function xPublishedAt(url) {
  const s = xStatus(url); if (!s) return null;
  return new Date(Number((BigInt(s.id) >> 22n) + 1288834974657n)).toISOString().slice(0, 10);
}
async function youtubePublishedAt(url, fetcher) {
  try {
    const r = await fetcher(`https://www.youtube.com/watch?v=${youtubeId(url)}`);
    const m = r && r.status === 200 && r.text.match(/itemprop="uploadDate" content="(\d{4}-\d{2}-\d{2})/);
    return m ? m[1] : null;
  } catch { return null; }
}
// Posts older than this belong to an earlier edition: roughly 13 months
// before the edition starts, or the start of the prior year when dates are TBA.
export function embedWindowStart(cfg, dates) {
  if (dates && dates.start) return new Date(Date.parse(dates.start) - 400 * 86400000).toISOString().slice(0, 10);
  const y = Number(cfg && cfg.year) || Number(String(cfg && cfg.id).match(/(\d{4})$/)?.[1]);
  return y ? `${y - 1}-01-01` : null;
}

// The handle Instagram's embed page (instagram.com/p/<code>/embed/) prints
// for the post's author.
export function instagramEmbedAuthor(html) {
  const m = String(html || '').match(/class="UsernameText"[^>]*>\s*([A-Za-z0-9_.]+)\s*</);
  return m ? m[1] : null;
}

export async function youtubeChannelId(url, fetcher) {
  if (!url) return null;
  const direct = String(url).match(/youtube\.com\/channel\/(UC[A-Za-z0-9_-]{22})/);
  if (direct) return direct[1];
  try {
    const r = await fetcher(url);
    if (!r || r.status !== 200) return null;
    const m = r.text.match(/<link rel="canonical" href="https:\/\/www\.youtube\.com\/channel\/(UC[A-Za-z0-9_-]{22})"/);
    return m ? m[1] : null;
  } catch { return null; }
}

// ── Network verification (injected fetch, so tests run offline) ───────────
const OEMBED = {
  youtube: u => `https://www.youtube.com/oembed?format=json&url=${encodeURIComponent(u)}`,
  instagram: u => `https://graph.facebook.com/v23.0/instagram_oembed?url=${encodeURIComponent(u)}`,
  x: u => `https://publish.x.com/oembed?omit_script=1&dnt=true&url=${encodeURIComponent(u)}`,
  spotify: u => `https://open.spotify.com/oembed?url=${encodeURIComponent(u)}`,
};

// The oEmbed author must be the official account. Spotify's oEmbed names no
// owner, so a playlist is checked against its page's owner link instead.
function authorMatches(platform, officialAccount, body, pageHtml, url, ctx = {}) {
  const want = accountKey(platform, officialAccount);
  // A channel has several URL forms (/@handle, /user/x, /channel/UC…), so
  // both sides are resolved to the channel id their own pages declare.
  if (platform === 'youtube') return !!ctx.ytOfficial && ctx.ytOfficial === ctx.ytAuthor;
  if (platform === 'x') return accountKey('x', body.author_url) === want;
  if (platform === 'instagram') {
    // Tokenless oEmbed (2026-06) returns no author_name, so authorship comes
    // from Instagram's own embed page for the post, which prints the handle.
    const who = body.author_name || instagramEmbedAuthor(pageHtml);
    return !!who && String(who).toLowerCase() === want;
  }
  if (platform === 'spotify') {
    if (want.startsWith('playlist/')) return want === 'playlist/' + spotifyPlaylist(url);
    // The playlist page declares its owner: <meta name="music:creator">.
    const owner = (String(pageHtml || '').match(/<meta name="music:creator" content="([^"]+)"/) || [])[1];
    return !!owner && accountKey('spotify', owner) === want;
  }
  return false;
}

// opts.youtubePlayable(id) → true | false | null (null = could not tell).
// oEmbed answers 200 for videos whose owner or rights holder blocks embedded
// playback, so the player itself is asked (see check-official-embeds.mjs).
export async function verifyEmbed(e, fetcher, opts = {}) {
  const bad = validateEmbed(e);
  if (bad) return { ok: false, reason: bad };
  let src;
  try { src = await fetcher(e.accountSourceUrl); } catch (err) { return { ok: false, reason: `accountSourceUrl unreachable: ${err.message}` }; }
  if (!src || src.status !== 200) return { ok: false, reason: `accountSourceUrl returned ${src && src.status}` };
  if (!pageLinksAccount(src.text, e.platform, e.officialAccount)) return { ok: false, reason: 'accountSourceUrl does not link the official account' };
  let oe;
  try { oe = await fetcher(OEMBED[e.platform](e.url)); } catch (err) { return { ok: false, reason: `oEmbed unreachable: ${err.message}` }; }
  if (!oe || oe.status !== 200) return { ok: false, reason: `oEmbed returned ${oe && oe.status} (dead, private or not embeddable)` };
  let body; try { body = JSON.parse(oe.text); } catch { return { ok: false, reason: 'oEmbed returned non-JSON' }; }
  if (!body || body.error || !body.html) return { ok: false, reason: 'oEmbed returned no embed' };
  let pageHtml = null;
  const ctx = {};
  if (e.platform === 'youtube') {
    ctx.ytOfficial = await youtubeChannelId(e.officialAccount, fetcher);
    ctx.ytAuthor = await youtubeChannelId(body.author_url, fetcher);
  }
  if (e.platform === 'instagram') {
    const { type, code } = instagramCode(e.url);
    try { const p = await fetcher(`https://www.instagram.com/${type}/${code}/embed/`); pageHtml = p && p.status === 200 ? p.text : null; } catch {}
  }
  if (e.platform === 'spotify' && accountKey('spotify', e.officialAccount).startsWith('user/')) {
    try { const p = await fetcher(e.url); pageHtml = p && p.status === 200 ? p.text : null; } catch {}
  }
  if (!authorMatches(e.platform, e.officialAccount, body, pageHtml, e.url, ctx)) return { ok: false, reason: 'post is not by the official account' };
  const publishedAt = e.platform === 'instagram' ? instagramPublishedAt(e.url)
    : e.platform === 'x' ? xPublishedAt(e.url)
    : e.platform === 'youtube' ? await youtubePublishedAt(e.url, fetcher) : null;
  if (e.platform === 'youtube' && !publishedAt) return { ok: false, reason: 'YouTube upload date unreadable' };
  if (e.platform === 'youtube') {
    const playable = opts.youtubePlayable ? await opts.youtubePlayable(youtubeId(e.url)) : null;
    if (playable === false) return { ok: false, reason: 'YouTube player refuses embedded playback ("This video is unavailable")' };
    if (playable !== true) return { ok: false, unknown: true, reason: 'YouTube embedded playback could not be confirmed' };
  }
  // The account's display name for the caption; a name, never post content.
  const accountName = e.platform === 'youtube' ? (body.author_name || null) : null;
  return { ok: true, reason: null, publishedAt, accountName };
}

// ── Selection + caps ──────────────────────────────────────────────────────
export function loadEmbedData(root = REPO) {
  const read = f => { const p = path.join(root, 'data', f); return existsSync(p) ? JSON.parse(readFileSync(p, 'utf8')) : null; };
  return { curated: read('official-embeds.json') || {}, verified: read('official-embeds.verified.json') || { results: {} } };
}

// What a page shows: statically valid, verified ok, then capped by platform.
export function selectEmbeds(festivalId, { curated, verified }, notBefore = null) {
  const res = u => verified.results?.[u];
  const list = (curated[festivalId] || []).filter(e => !validateEmbed(e) && res(e.url)?.ok === true
    // An earlier edition's post is not this page's; playlists carry no date.
    && (e.platform === 'spotify' || !notBefore || (res(e.url).publishedAt && res(e.url).publishedAt >= notBefore)))
    .map(e => res(e.url).accountName ? { ...e, accountName: res(e.url).accountName } : e);
  const by = p => list.filter(e => e.platform === p);
  const rank = arr => arr.map((e, i) => ({ e, i })).sort((a, b) => (KIND_RANK[a.e.kind] ?? 9) - (KIND_RANK[b.e.kind] ?? 9) || a.i - b.i).map(x => x.e);
  return {
    youtube: rank(by('youtube')).slice(0, CAPS.youtube),
    social: rank(list.filter(e => e.platform === 'instagram' || e.platform === 'x')).slice(0, CAPS.social),
    spotify: rank(by('spotify')).slice(0, CAPS.spotify),
  };
}
export const embedCount = s => s.youtube.length + s.social.length + s.spotify.length;

// ── Rendering ─────────────────────────────────────────────────────────────
const esc = s => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const PLATFORM_NAME = { youtube: 'YouTube', instagram: 'Instagram', x: 'X', spotify: 'Spotify' };
function accountLabel(e) {
  const k = accountKey(e.platform, e.officialAccount);
  // The handle as the festival's own site writes it (@EDC_LasVegas), not the
  // lowercased key used for matching.
  if (e.platform === 'instagram' || e.platform === 'x') {
    const raw = String(e.officialAccount).replace(/[?#].*$/, '').replace(/\/+$/, '').split('/').pop();
    return '@' + (raw && raw.toLowerCase() === k ? raw : k);
  }
  if (e.platform === 'youtube') return k.startsWith('@') ? k : (e.accountName || 'the official channel');
  return e.accountName || 'the official account';
}
const caption = (e, festivalName) => {
  const who = e.platform === 'spotify' ? `${festivalName}'s official playlist` : accountLabel(e);
  return `      <p class="embed-cap">${esc(who)} on ${PLATFORM_NAME[e.platform]} · <a href="${esc(e.url)}" rel="noopener">View the original</a></p>`;
};

function renderOne(e, festivalName) {
  if (e.platform === 'youtube') {
    const id = youtubeId(e.url);
    return `    <figure class="embed embed-yt">
      <div class="yt"><iframe src="https://www.youtube-nocookie.com/embed/${id}" title="${esc(festivalName)} ${esc(e.kind)} on YouTube" loading="lazy" allow="accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" referrerpolicy="strict-origin-when-cross-origin" allowfullscreen></iframe></div>
${caption(e, festivalName)}
    </figure>`;
  }
  if (e.platform === 'instagram') {
    const { type, code } = instagramCode(e.url);
    const permalink = `https://www.instagram.com/${type}/${code}/`;
    return `    <figure class="embed embed-ig">
      <blockquote class="instagram-media" data-instgrm-permalink="${permalink}" data-instgrm-version="14"><a href="${permalink}" rel="noopener">View this post on Instagram</a></blockquote>
${caption(e, festivalName)}
    </figure>`;
  }
  if (e.platform === 'x') {
    const { handle, id } = xStatus(e.url);
    const permalink = `https://twitter.com/${handle}/status/${id}`;
    return `    <figure class="embed embed-x">
      <blockquote class="twitter-tweet" data-dnt="true" data-theme="dark"><a href="${permalink}" rel="noopener">View this post on X</a></blockquote>
${caption(e, festivalName)}
    </figure>`;
  }
  const id = spotifyPlaylist(e.url);
  return `    <figure class="embed embed-sp">
      <iframe src="https://open.spotify.com/embed/playlist/${id}" title="${esc(festivalName)} playlist on Spotify" width="100%" height="352" loading="lazy" allow="clipboard-write; encrypted-media; fullscreen; picture-in-picture"></iframe>
${caption(e, festivalName)}
    </figure>`;
}

// The loader injects embed.js / widgets.js ONCE, and only when the section
// nears the viewport, so first paint and the text sections never wait on a
// third party.
const LOADER = `    <script>
(function () {
  var sec = document.getElementById('watch');
  if (!sec) return;
  var urls = [];
  if (sec.querySelector('.instagram-media')) urls.push('https://www.instagram.com/embed.js');
  if (sec.querySelector('.twitter-tweet')) urls.push('https://platform.twitter.com/widgets.js');
  if (!urls.length) return;
  var done = false;
  function load() {
    if (done) return; done = true;
    urls.forEach(function (u) { var s = document.createElement('script'); s.async = true; s.src = u; document.body.appendChild(s); });
  }
  if (!('IntersectionObserver' in window)) return load();
  var io = new IntersectionObserver(function (es) {
    if (es.some(function (x) { return x.isIntersecting; })) { io.disconnect(); load(); }
  }, { rootMargin: '600px 0px' });
  io.observe(sec);
})();
    </script>`;

export function embedsSection(festivalName, sel) {
  if (!embedCount(sel)) return '';
  const items = [...sel.youtube, ...sel.social, ...sel.spotify].map(e => renderOne(e, festivalName)).join('\n');
  return `
  <section id="watch" class="watch" aria-labelledby="watch-h">
    <h2 id="watch-h">Watch &amp; listen</h2>
    <p class="note">From ${esc(festivalName)}'s official accounts.</p>
${items}
${LOADER}
  </section>`;
}

// The sitemap fingerprint includes exactly what the page shows.
export const embedFingerprintInput = sel => [...sel.youtube, ...sel.social, ...sel.spotify].map(e => `${e.platform}:${e.url}`);
