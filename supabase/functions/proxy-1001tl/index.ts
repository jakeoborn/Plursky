// supabase/functions/proxy-1001tl/index.ts
//
// Fetches tracklist data from 1001tracklists.com for a given artist +
// event source, parses timestamped tracks from the HTML, and returns
// clean JSON. Caches results in-memory for 7 days.
//
// Deploy:  supabase functions deploy proxy-1001tl

const EXACT_ORIGINS = new Set([
  "https://plursky.com",
  "https://www.plursky.com",
  "capacitor://localhost",
]);
const ORIGIN_PATTERNS = [
  /^http:\/\/localhost(:\d+)?$/,
  /^http:\/\/127\.0\.0\.1(:\d+)?$/,
];

function isAllowedOrigin(origin: string | null): boolean {
  if (!origin) return false;
  if (EXACT_ORIGINS.has(origin)) return true;
  return ORIGIN_PATTERNS.some((re) => re.test(origin));
}

function corsHeaders(origin: string | null): Record<string, string> {
  const allowed = isAllowedOrigin(origin) ? origin! : "";
  return {
    "Access-Control-Allow-Origin": allowed,
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Accept",
    "Content-Type": "application/json",
  };
}

const cache = new Map<string, { data: unknown; ts: number }>();
const CACHE_TTL = 7 * 24 * 3600000;

function parseTracklist(html: string): {
  tracks: { num: number; time: string; timeMs: number; artist: string; title: string }[];
  dj: string;
  stage: string;
  date: string;
  duration: string;
} {
  const tracks: { num: number; time: string; timeMs: number; artist: string; title: string }[] = [];

  // Extract DJ name from title
  const titleMatch = html.match(/<title>\s*(.+?)\s*@\s*(.+?),\s*EDC Las Vegas/i) ||
                     html.match(/<title>\s*(.+?)\s*@\s*(.+?),/i);
  const dj = titleMatch?.[1]?.trim() || "";
  const stage = titleMatch?.[2]?.trim() || "";

  // Extract date
  const dateMatch = html.match(/(\d{4}-\d{2}-\d{2})/);
  const date = dateMatch?.[1] || "";

  // Extract track entries: look for timestamp + track info patterns
  // 1001tracklists uses various formats. Common pattern in the HTML:
  // data-content with timestamp info, track names in specific elements
  const trackPattern = /class="[^"]*tlpItem[^"]*"[\s\S]*?(?:data-content="(\d+:\d+(?::\d+)?)"[\s\S]*?)?class="[^"]*trackFormat[^"]*"[^>]*>([\s\S]*?)<\/span>/gi;

  // Simpler approach: extract from the text content we already have
  // The fetched page has tracks in format: "NN. HH:MM Artist - Title"
  const lines = html.replace(/<[^>]+>/g, '\n').split('\n').map(l => l.trim()).filter(Boolean);

  let trackNum = 0;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    // Match timestamp patterns like "0:00", "5:30", "1:04:15"
    const timeMatch = line.match(/^(\d{1,2}:\d{2}(?::\d{2})?)$/);
    if (timeMatch) {
      const time = timeMatch[1];
      // Parse to milliseconds
      const parts = time.split(':').map(Number);
      let ms = 0;
      if (parts.length === 3) ms = parts[0] * 3600000 + parts[1] * 60000 + parts[2] * 1000;
      else if (parts.length === 2) ms = parts[0] * 60000 + parts[1] * 1000;

      // Look ahead for artist - title
      for (let j = i + 1; j < Math.min(i + 5, lines.length); j++) {
        const trackLine = lines[j];
        const trackMatch = trackLine.match(/^(.+?)\s*[-–—]\s*(.+)$/);
        if (trackMatch) {
          trackNum++;
          tracks.push({
            num: trackNum,
            time,
            timeMs: ms,
            artist: trackMatch[1].trim(),
            title: trackMatch[2].trim(),
          });
          break;
        }
        // Also try lines that look like "Artist ft. Someone - Title (Remix)"
        if (trackLine.length > 5 && !trackLine.match(/^\d/) && !trackLine.match(/^(w\/|ID$|vs\.|&)/i)) {
          trackNum++;
          tracks.push({
            num: trackNum,
            time,
            timeMs: ms,
            artist: "",
            title: trackLine,
          });
          break;
        }
      }
    }
  }

  // Estimate duration from last track timestamp
  const duration = tracks.length > 0 ? tracks[tracks.length - 1].time : "";

  return { tracks, dj, stage, date, duration };
}

Deno.serve(async (req) => {
  const origin = req.headers.get("origin");
  const headers = corsHeaders(origin);

  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers });
  }

  if (req.method !== "GET") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405, headers });
  }

  const url = new URL(req.url);
  const artistName = url.searchParams.get("artist");
  const event = url.searchParams.get("event") || "edc-las-vegas";

  if (!artistName) {
    return new Response(JSON.stringify({ error: "artist param required" }), { status: 400, headers });
  }

  const cacheKey = `${artistName.toLowerCase()}_${event}`;
  const cached = cache.get(cacheKey);
  if (cached && Date.now() - cached.ts < CACHE_TTL) {
    return new Response(JSON.stringify(cached.data), { headers });
  }

  try {
    // Search 1001tracklists for the artist at EDC
    const searchQuery = encodeURIComponent(`${artistName} EDC Las Vegas`);
    const searchUrl = `https://www.1001tracklists.com/search/result.php?search_selection=2&main_search=${searchQuery}`;

    const searchRes = await fetch(searchUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; Plursky/1.5; +https://plursky.com)",
        "Accept": "text/html",
      },
    });

    if (!searchRes.ok) {
      return new Response(JSON.stringify({ tracks: [], error: "search failed" }), { headers });
    }

    const searchHtml = await searchRes.text();

    // Extract first tracklist URL from search results
    const linkMatch = searchHtml.match(/href="(\/tracklist\/[^"]+edc[^"]*\.html)"/i) ||
                      searchHtml.match(/href="(\/tracklist\/[^"]+\.html)"/i);

    if (!linkMatch) {
      const result = { tracks: [], dj: artistName, stage: "", date: "", duration: "", source: "1001tracklists", notFound: true };
      cache.set(cacheKey, { data: result, ts: Date.now() });
      return new Response(JSON.stringify(result), { headers });
    }

    const tracklistUrl = `https://www.1001tracklists.com${linkMatch[1]}`;
    const tlRes = await fetch(tracklistUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; Plursky/1.5; +https://plursky.com)",
        "Accept": "text/html",
      },
    });

    if (!tlRes.ok) {
      return new Response(JSON.stringify({ tracks: [], error: "tracklist fetch failed" }), { headers });
    }

    const tlHtml = await tlRes.text();
    const parsed = parseTracklist(tlHtml);
    const result = { ...parsed, source: "1001tracklists", url: tracklistUrl };

    cache.set(cacheKey, { data: result, ts: Date.now() });
    return new Response(JSON.stringify(result), { headers });
  } catch (e) {
    return new Response(JSON.stringify({ tracks: [], error: (e as Error).message }), { headers });
  }
});
