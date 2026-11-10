// supabase/functions/spotify-artist-image/index.ts
//
// An artist's Spotify photo for a listener who has not connected Spotify.
// The browser cannot hold Plursky's Spotify client secret, so this function
// takes an artist name, searches Spotify's catalog with the app's own
// client-credentials token, and returns the image URL of the artist whose
// name matches exactly (accents, case and punctuation folded). No fuzzy
// fallback: a near name is a different act, and initials beat a wrong face.
//
// The app shows the image from Spotify's CDN with a Spotify credit and keeps
// the URL 24 h, the same rule as images fetched with a listener's own token
// (SPOTIFY_IMAGE_TTL_MS in chrome.jsx). Nothing is stored here beyond a
// per-isolate memo of the same 24 h.
//
// Deploy:
//   supabase secrets set SPOTIFY_CLIENT_SECRET=...   (from the Spotify dashboard)
//   supabase functions deploy spotify-artist-image
// `verify_jwt = false` in supabase/config.toml, like proxy-setlist.

const CLIENT_ID = Deno.env.get("SPOTIFY_CLIENT_ID") || "2219c68606c54629a8799f467a996a81";
const DAY_MS = 24 * 60 * 60 * 1000;

const EXACT_ORIGINS = new Set([
  "https://plursky.com",
  "https://www.plursky.com",
  "capacitor://localhost",
]);
const ORIGIN_PATTERNS = [/^http:\/\/localhost(:\d+)?$/, /^http:\/\/127\.0\.0\.1(:\d+)?$/];
const allowed = (o: string | null) => !!o && (EXACT_ORIGINS.has(o) || ORIGIN_PATTERNS.some(re => re.test(o)));
const corsFor = (o: string | null) => ({
  "Access-Control-Allow-Origin": allowed(o) ? o! : "https://plursky.com",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, apikey",
  "Vary": "Origin",
});

// Same folding as data/artist-key.js for the cases that matter to a match.
export function foldName(s: string): string {
  return String(s || "").normalize("NFKD").replace(/[̀-ͯ]/g, "")
    .toLowerCase().replace(/&/g, " and ").replace(/[^a-z0-9]+/g, "");
}

let token: { value: string; until: number } | null = null;
async function appToken(secret: string): Promise<string> {
  if (token && Date.now() < token.until) return token.value;
  const res = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: {
      "Authorization": "Basic " + btoa(`${CLIENT_ID}:${secret}`),
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
  });
  if (!res.ok) throw new Error("token " + res.status);
  const j = await res.json();
  token = { value: j.access_token, until: Date.now() + (Number(j.expires_in) - 60) * 1000 };
  return token.value;
}

const memo = new Map<string, { at: number; body: Record<string, unknown> }>();

Deno.serve(async (req) => {
  const cors = corsFor(req.headers.get("Origin"));
  const json = (body: unknown, status = 200, extra: Record<string, string> = {}) =>
    new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json", ...extra } });
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
  if (req.method !== "GET") return json({ error: "method_not_allowed" }, 405);

  const secret = Deno.env.get("SPOTIFY_CLIENT_SECRET");
  if (!secret) return json({ error: "not_configured" }, 503);

  const name = (new URL(req.url).searchParams.get("name") || "").trim().slice(0, 120);
  const key = foldName(name);
  if (!key) return json({ error: "missing_name" }, 400);

  const hit = memo.get(key);
  if (hit && Date.now() - hit.at < DAY_MS) return json(hit.body, 200, { "Cache-Control": "public, max-age=86400" });

  try {
    const q = new URLSearchParams({ q: name, type: "artist", limit: "10" });
    let res = await fetch("https://api.spotify.com/v1/search?" + q, { headers: { Authorization: "Bearer " + await appToken(secret) } });
    if (res.status === 401) { token = null; res = await fetch("https://api.spotify.com/v1/search?" + q, { headers: { Authorization: "Bearer " + await appToken(secret) } }); }
    if (res.status === 429) return json({ error: "rate_limited" }, 429, { "Retry-After": res.headers.get("Retry-After") || "30" });
    if (!res.ok) return json({ error: "upstream_" + res.status }, 502);
    const items: any[] = (await res.json())?.artists?.items || [];
    // Spotify ranks by relevance; the first exact-name artist with a photo.
    const m = items.find(a => a && foldName(a.name) === key && Array.isArray(a.images) && a.images.length);
    const img = m ? [...m.images].sort((a, b) => (a.width || 0) - (b.width || 0)).find(i => (i.width || 0) >= 300) || m.images[0] : null;
    const body = m && img
      ? { url: img.url, spotifyId: m.id, spotifyUrl: m.external_urls?.spotify || `https://open.spotify.com/artist/${m.id}` }
      : { url: null };
    memo.set(key, { at: Date.now(), body });
    return json(body, 200, { "Cache-Control": "public, max-age=86400" });
  } catch (err) {
    return json({ error: "upstream_failed", detail: String(err).slice(0, 120) }, 502);
  }
});
