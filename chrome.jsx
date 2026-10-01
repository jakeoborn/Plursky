// Screen shell + bottom tab nav + shared atoms

function Screen({ children, bg = "var(--paper)", pad = true, ink = "var(--ink)" }) {
  return (
    <div style={{
      position: "absolute", inset: 0,
      background: bg,
      color: ink,
      display: "flex", flexDirection: "column",
      overflow: "hidden",
    }}>
      {children}
    </div>
  );
}

const ScrollBody = React.forwardRef(function ScrollBody({ children, style, ...rest }, fwdRef) {
  return (
    <div ref={fwdRef} {...rest} style={{
      flex: 1, overflowY: "auto", overflowX: "hidden",
      WebkitOverflowScrolling: "touch",
      ...style,
    }}>
      {children}
    </div>
  );
});

function TopBar({ title, right, sub, tight }) {
  return (
    <div style={{
      padding: tight ? "6px 20px 10px" : "10px 20px 14px",
      display: "flex", alignItems: "flex-end", justifyContent: "space-between",
      gap: 12,
    }}>
      {/* minWidth 0: a flex child defaults to min-width:auto and cannot shrink
          below its content, so at 200% text the eyebrow ("105 MOMENTS · EDC LV
          2026") pushed this row 170px wider than the screen and the whole
          header panned sideways. */}
      <div style={{ minWidth: 0, overflowWrap: "anywhere" }}>
        {/* Field Mode: 11/14 status eyebrow over a 28/34 bold screen title.
            UNITLESS line-heights: a px line-height does not scale with the
            font, so at 200% text a 22px eyebrow was still laying out on a 14px
            line and the title printed straight through it. */}
        {sub && <div style={{
          fontSize: 11, lineHeight: 1.27, fontWeight: 600, letterSpacing: "0.04em",
          textTransform: "uppercase", color: "var(--text-2)", marginBottom: 4,
        }}>{sub}</div>}
        {/* A real <h1>: VoiceOver's heading rotor had nothing to land on
            anywhere in Memories before this. */}
        <h1 style={{ margin: 0, fontSize: 28, lineHeight: 1.21, fontWeight: 700, letterSpacing: "-0.01em" }}>
          {title}
        </h1>
      </div>
      {right}
    </div>
  );
}

// Bottom tab nav — 4 tabs after v92 collapse (Music folded into Me).
// SpotifyScreen still routes via state.tab="spotify" but Me lights up in the bar.
function TabBar({ active, onChange }) {
  // Post-festival, the Map loses utility (you're not navigating stages
  // anymore) while Memories becomes the reason to keep the app. Swap the
  // Map tab for Memories once the festival ends — the lifecycle pivot from
  // live wayfinding to the rewatch loop.
  const isPostFestival = (() => {
    try { return Date.now() > (window.FESTIVAL_CONFIG?.endMs || Infinity); } catch { return false; }
  })();
  const tabs = isPostFestival ? [
    { id: "home",     label: "Today",    icon: HomeIcon },
    { id: "lineup",   label: "Lineup",   icon: LineupIcon },
    { id: "memories", label: "Memories", icon: MemoriesIcon },
    { id: "me",       label: "Me",       icon: MeIcon },
  ] : [
    { id: "home",    label: "Today",  icon: HomeIcon },
    { id: "lineup",  label: "Lineup", icon: LineupIcon },
    { id: "map",     label: "Map",    icon: MapIcon },
    { id: "me",      label: "Me",     icon: MeIcon },
  ];
  // The duo board's bar: quiet chrome, the selected tab in full ink with a
  // short accent bar along its top edge. Stage colour never tints it.
  return (
    <div style={{
      background: "var(--chrome)",
      backdropFilter: "blur(20px) saturate(160%)",
      WebkitBackdropFilter: "blur(20px) saturate(160%)",
      borderTop: "1px solid var(--line)",
      padding: "0 10px 10px",
      display: "flex",
      justifyContent: "space-around",
    }}>
      {tabs.map(t => {
        const Icon = t.icon;
        const on = active === t.id;
        return (
          <button key={t.id}
            onClick={() => { haptic.light(); onChange(t.id); }}
            aria-current={on ? "page" : undefined}
            style={{
              position: "relative",
              background: "transparent", border: "none", cursor: "pointer",
              display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 5,
              padding: "10px 12px 4px",
              color: on ? "var(--ink)" : "var(--ink-3)",
              minWidth: 64, minHeight: 53, maxWidth: "100%",
              transition: "color var(--t-tap) var(--ease-decay)",
            }}>
            {on && <span aria-hidden="true" style={{
              position: "absolute", top: -1, left: "28%", right: "28%", height: 2, borderRadius: 2,
              background: "var(--acc)", boxShadow: "0 0 12px var(--acc-55)",
            }} />}
            <Icon on={on} />
            {/* The label must be able to shrink, and its line box must scale
                with it. At 200% text "Memories" ran past its own button. */}
            <span style={{
              fontSize: 11, lineHeight: 1.17, letterSpacing: ".01em",
              fontWeight: 500,
              minWidth: 0, maxWidth: "100%", overflowWrap: "anywhere", textAlign: "center",
            }}>
              {t.label}
            </span>
          </button>
        );
      })}
    </div>
  );
}

// Tab icons: the board's one geometry (design/system-exploration
// shared/icons.js), 1.6px stroke on a 24 grid, round caps, currentColor.
const stroke = (on) => ({
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.6,
  strokeLinecap: "round",
  strokeLinejoin: "round",
});
const _tabIcon = (d) => function TabIcon({ on }) {
  return <svg width="24" height="24" viewBox="0 0 24 24" aria-hidden="true" style={stroke(on)}><path d={d} /></svg>;
};
const HomeIcon = _tabIcon("M12 20 3.5 9 M12 20 8.5 5 M12 20 15.5 5 M12 20 20.5 9 M9 20h6");
const LineupIcon = _tabIcon("M4 6h16 M4 12h11 M4 18h14");
const MapIcon = _tabIcon("M9 4 3 6.2v13.8l6-2.2 6 2.2 6-2.2V4l-6 2.2L9 4z M9 4v13.8 M15 6.2V20");
const MeIcon = _tabIcon("M12 12.5a4.25 4.25 0 1 0 0-8.5 4.25 4.25 0 0 0 0 8.5z M4.5 20.5c1.4-3.7 4.3-5.6 7.5-5.6s6.1 1.9 7.5 5.6");
const MemoriesIcon = _tabIcon("M4 6.5h16v12H4z M4 15.5l4.5-4 3.5 3 2.5-2 5.5 4.5 M15.5 10.5a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3z");
function MusicIcon({ on }) {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" aria-hidden="true" style={stroke(on)}>
      <circle cx="7" cy="17" r="2.5" />
      <circle cx="17" cy="15" r="2.5" />
      <path d="M9.5 17 L9.5 5 L19.5 3 L19.5 15" />
    </svg>
  );
}

// Generic pill
function Pill({ children, tone = "ink", style }) {
  const tones = {
    ink:    { bg: "var(--ink)", fg: "var(--paper)" },
    outline:{ bg: "transparent", fg: "var(--ink)", border: "1px solid var(--line-2)" },
    ember:  { bg: "var(--ember)", fg: "#fff" },
    paper:  { bg: "var(--paper)", fg: "var(--ink)", border: "1px solid var(--line)" },
    night:  { bg: "var(--night)", fg: "var(--paper)" },
  };
  const t = tones[tone];
  return (
    <span className="mono" style={{
      display: "inline-flex", alignItems: "center", gap: 6,
      padding: "4px 9px", borderRadius: 999,
      background: t.bg, color: t.fg, border: t.border || "none",
      fontSize: 10, letterSpacing: 1.2, textTransform: "uppercase", fontWeight: 500,
      whiteSpace: "nowrap",
      ...style,
    }}>{children}</span>
  );
}

// ── Haptic vocabulary ─────────────────────────────────────────
// Light: navigation, tab switch. Medium: save/unsave. Heavy: conflict.
const haptic = {
  light:  () => navigator.vibrate?.([10]),
  medium: () => navigator.vibrate?.([30]),
  heavy:  () => navigator.vibrate?.([50, 30, 50]),
};

// ── Modal presence, so app chrome can get out of the way ─────
// The search FAB is position:absolute zIndex:30 inside the screen wrapper; the
// paywall overlays are position:fixed zIndex:260. By the cascade the overlay
// should win, and MEASURED IN THE WEBVIEW IT DOES NOT: elementFromPoint at the
// FAB's centre, with the paywall open, returns the FAB. Neither element has a
// stacking-context ancestor (checked for transform, filter, backdrop-filter,
// opacity, isolation, mix-blend-mode, perspective, will-change, contain and
// positioned z-index), so raising 260 higher is not a fix you can trust — it is
// the same bet that already lost. On 2026-09-07 the FAB covered the right third
// of RESTORE PURCHASE, the required restore control for a non-consumable
// (Guideline 3.1.1), on the device family that had just rejected 1.12.
//
// So: don't out-stack the modal, get out of its way. A modal declares itself
// while it is mounted and the chrome hides. Correct whatever the stacking rules
// turn out to be doing.
const _modalSubs = new Set();
let _modalCount = 0;

// Call from any component that renders a full-screen overlay: useDeclareModal(isOpen).
function useDeclareModal(open) {
  React.useEffect(() => {
    if (!open) return undefined;
    _modalCount += 1;
    _modalSubs.forEach(fn => fn(_modalCount));
    return () => {
      _modalCount = Math.max(0, _modalCount - 1);
      _modalSubs.forEach(fn => fn(_modalCount));
    };
  }, [open]);
}

// Call from chrome that must yield to a modal: const covered = useModalOpen().
function useModalOpen() {
  const [n, setN] = React.useState(_modalCount);
  React.useEffect(() => {
    _modalSubs.add(setN);
    setN(_modalCount);            // a modal may have opened before we subscribed
    return () => { _modalSubs.delete(setN); };
  }, []);
  return n > 0;
}

// ── Stagger-fade entrance for scrollable cards ───────────────
// Returns a ref to attach to a container. Children with
// [data-animate] get an intersection-triggered fade-in.
function useStaggerFade(depKey) {
  const ref = React.useRef(null);
  React.useEffect(() => {
    const el = ref.current;
    if (!el || !window.IntersectionObserver) return;
    const targets = el.querySelectorAll("[data-animate]");
    if (!targets.length) return;
    targets.forEach(t => { t.style.opacity = "0"; t.style.transform = "translateY(8px)"; });
    let idx = 0;
    const obs = new IntersectionObserver((entries) => {
      entries.forEach(e => {
        if (!e.isIntersecting) return;
        const t = e.target;
        if (idx < 8) {
          const delay = idx * 40;
          setTimeout(() => {
            t.style.transition = "opacity 0.3s ease, transform 0.3s var(--ease-spring)";
            t.style.opacity = "1";
            t.style.transform = "translateY(0)";
          }, delay);
        } else {
          t.style.transition = "none";
          t.style.opacity = "1";
          t.style.transform = "translateY(0)";
        }
        idx++;
        obs.unobserve(t);
      });
    }, { threshold: 0.05 });
    targets.forEach(t => obs.observe(t));
    return () => obs.disconnect();
  }, [depKey]);
  return ref;
}

// ── artist_images_v1: the one door ──────────────────────────
// Every reader and writer of the shared artist-image cache goes through these
// helpers. Each entry records WHERE the image came from and WHEN it was
// fetched, because Spotify's Developer Terms (IV.3.2) allow only TEMPORARY
// caching of Spotify cover art and say "Do not store Spotify Content
// indefinitely", and the Design Guidelines require a Spotify image to carry
// the Spotify logo and never be cropped or overlaid. Neither rule can be kept
// for an image whose source nobody wrote down.
//   spotify        shown for SPOTIFY_IMAGE_TTL_MS after the fetch, then dropped
//                  and refetched. Never drawn into a share or recap export.
//   unknown        a pre-v360 bare-string entry, or an old "itunes"/"tadb"
//                  one. Never shown or exported, and pruned at boot and on
//                  every write. TheAudioDB (its free-API terms) and the iTunes
//                  Search API (artwork only "to promote store content", beside
//                  a store badge) are not sources: lane ruling 2026-09-24.
// 24 h keeps one festival day's scrolling to one Spotify search per artist and
// is the longest window we can call temporary. With nothing else allowed, a
// share or recap export draws no cached artist image at all.
const ARTIST_IMAGES_KEY = "artist_images_v1";
const SPOTIFY_IMAGE_TTL_MS = 24 * 60 * 60 * 1000;
const _ARTIST_IMAGE_SOURCES = ["spotify"];

function _readArtistImageStore() {
  try {
    const o = JSON.parse(localStorage.getItem(ARTIST_IMAGES_KEY) || "{}");
    return o && typeof o === "object" && !Array.isArray(o) ? o : {};
  } catch { return {}; }
}

function _artistImageRecord(v) {
  if (typeof v === "string") return v ? { url: v, source: "unknown", fetchedAt: null, spotifyId: null } : null;
  if (!v || typeof v !== "object" || typeof v.url !== "string" || !v.url) return null;
  return {
    url: v.url,
    source: _ARTIST_IMAGE_SOURCES.includes(v.source) ? v.source : "unknown",
    fetchedAt: Number.isFinite(v.fetchedAt) ? v.fetchedAt : null,
    spotifyId: typeof v.spotifyId === "string" && v.spotifyId ? v.spotifyId : null,
  };
}

function _artistImageShowable(rec, now = Date.now()) {
  if (!rec) return false;
  if (rec.source === "spotify") {
    const age = now - rec.fetchedAt;
    return rec.fetchedAt != null && age >= 0 && age < SPOTIFY_IMAGE_TTL_MS;
  }
  return false;
}

// The entry to SHOW for an artist, or null (missing, expired, or unknown).
function getArtistImage(name, now = Date.now()) {
  if (!name) return null;
  const rec = _artistImageRecord(_readArtistImageStore()[String(name).toLowerCase()]);
  return _artistImageShowable(rec, now) ? rec : null;
}

// The entry a share/recap EXPORT may draw: never Spotify, never unknown.
function getShareableArtistImage(name) {
  const rec = getArtistImage(name);
  return rec && rec.source !== "spotify" ? rec : null;
}

// Drops expired Spotify entries and unknown legacy ones. Runs on every write
// and once at boot, so nothing Spotify outlives its TTL just because the user
// stopped opening artist pages.
function _pruneArtistImageStore(store, now = Date.now()) {
  let changed = false;
  for (const k of Object.keys(store)) {
    if (!_artistImageShowable(_artistImageRecord(store[k]), now)) { delete store[k]; changed = true; }
  }
  return changed;
}

// entries: [{ name, url, source, spotifyId? }]. ifAbsent: keep a showable
// entry already there.
function putArtistImages(entries, { ifAbsent = false } = {}) {
  try {
    const store = _readArtistImageStore();
    let changed = _pruneArtistImageStore(store);
    const now = Date.now();
    for (const e of entries || []) {
      if (!e || !e.name || typeof e.url !== "string" || !e.url) continue;
      if (!_ARTIST_IMAGE_SOURCES.includes(e.source)) continue;
      const ln = String(e.name).toLowerCase();
      if (ifAbsent && store[ln]) continue;
      store[ln] = { url: e.url, source: e.source, fetchedAt: now };
      if (e.source === "spotify" && e.spotifyId) store[ln].spotifyId = e.spotifyId;
      changed = true;
    }
    if (changed) localStorage.setItem(ARTIST_IMAGES_KEY, JSON.stringify(store));
  } catch {}
  _scheduleArtistImageExpiry();
}
function putArtistImage(name, url, source, opts = {}) {
  putArtistImages([{ name, url, source, spotifyId: opts.spotifyId }], opts);
}

// Expiry while the app stays open: a timer fires when the oldest Spotify
// entry turns 24 h, prunes storage, and tells mounted consumers (the hero,
// useArtistPhoto) to drop what they hold, so a session left running for days
// never keeps showing a Spotify image past its TTL. iOS suspends timers in the
// background, so a return to the foreground re-checks too.
const ARTIST_IMAGES_EXPIRED = "plursky:artist-images-expired";
let _artistImageTimer = null;
function _expireArtistImagesNow(now = Date.now()) {
  let changed = false;
  try {
    const s = _readArtistImageStore();
    changed = _pruneArtistImageStore(s, now);
    if (changed) localStorage.setItem(ARTIST_IMAGES_KEY, JSON.stringify(s));
  } catch {}
  if (changed) try { window.dispatchEvent(new Event(ARTIST_IMAGES_EXPIRED)); } catch {}
  _scheduleArtistImageExpiry(now);
  return changed;
}
function _scheduleArtistImageExpiry(now = Date.now()) {
  try { clearTimeout(_artistImageTimer); } catch {}
  _artistImageTimer = null;
  let next = Infinity;
  try {
    for (const v of Object.values(_readArtistImageStore())) {
      const rec = _artistImageRecord(v);
      if (rec && rec.source === "spotify" && rec.fetchedAt != null) next = Math.min(next, rec.fetchedAt + SPOTIFY_IMAGE_TTL_MS);
    }
  } catch {}
  if (next === Infinity) return;
  _artistImageTimer = setTimeout(() => _expireArtistImagesNow(), Math.max(0, next - now) + 50);
}
// Re-renders a component when Spotify entries expire; returns a counter to
// key memos and effects on.
function useArtistImageExpiry() {
  const [n, setN] = React.useState(0);
  React.useEffect(() => {
    const on = () => setN(x => x + 1);
    window.addEventListener(ARTIST_IMAGES_EXPIRED, on);
    return () => window.removeEventListener(ARTIST_IMAGES_EXPIRED, on);
  }, []);
  return n;
}
try {
  _expireArtistImagesNow();
  document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible") _expireArtistImagesNow(); });
} catch {}
// TheAudioDB's per-artist lookups (bio, image URLs) were cached under
// tadb_<name>_v2. It is not a source any more, so its data does not stay.
try {
  for (let i = localStorage.length - 1; i >= 0; i--) {
    const k = localStorage.key(i);
    if (k && /^tadb_.+_v\d+$/.test(k)) localStorage.removeItem(k);
  }
} catch {}
// Song previews play from Spotify only. The iTunes Search API's 30-sec
// previews are licensed only to promote store content next to a store badge,
// which no Plursky screen has, so an old "itunes" entry in preview_urls_v1
// is dropped at boot and never played (fetchPreviewUrl uses this too).
function _previewPlayable(e) {
  return !!e && e.source === "spotify" && typeof e.url === "string" && /^https:\/\//.test(e.url);
}
function _prunePreviewCache() {
  try {
    const raw = localStorage.getItem("preview_urls_v1");
    if (!raw) return {};
    const all = JSON.parse(raw) || {};
    const kept = {};
    for (const k of Object.keys(all)) if (_previewPlayable(all[k])) kept[k] = all[k];
    if (Object.keys(kept).length !== Object.keys(all).length) localStorage.setItem("preview_urls_v1", JSON.stringify(kept));
    return kept;
  } catch {
    try { localStorage.removeItem("preview_urls_v1"); } catch {}
    return {};
  }
}
_prunePreviewCache();

// Spotify's full logo (icon + wordmark), the 2024 RGB artwork from
// developer.spotify.com/documentation/design, paths unmodified. Monochrome via
// currentColor: the guidelines allow the green logo only on pure black or
// white, and a monochrome logo on anything else. Keep height >= 20 so the
// logo stays over the 70px digital minimum (the artwork is 3.66:1).
function SpotifyFullLogo({ height = 21, title = "Spotify" }) {
  return (
    <svg viewBox="0 0 823.46 225.25" height={height} width={Math.round(height * 823.46 / 225.25)}
      role="img" aria-label={title} style={{ display: "block", fill: "currentColor" }}>
      <path d="m125.52,3.31C65.14.91,14.26,47.91,11.86,108.29c-2.4,60.38,44.61,111.26,104.98,113.66,60.38,2.4,111.26-44.6,113.66-104.98C232.89,56.59,185.89,5.7,125.52,3.31Zm46.18,160.28c-1.36,2.4-4.01,3.6-6.59,3.24-.79-.11-1.58-.37-2.32-.79-14.46-8.23-30.22-13.59-46.84-15.93-16.62-2.34-33.25-1.53-49.42,2.4-3.51.85-7.04-1.3-7.89-4.81-.85-3.51,1.3-7.04,4.81-7.89,17.78-4.32,36.06-5.21,54.32-2.64,18.26,2.57,35.58,8.46,51.49,17.51,3.13,1.79,4.23,5.77,2.45,8.91Zm14.38-28.72c-2.23,4.12-7.39,5.66-11.51,3.43-16.92-9.15-35.24-15.16-54.45-17.86-19.21-2.7-38.47-1.97-57.26,2.16-1.02.22-2.03.26-3.01.12-3.41-.48-6.33-3.02-7.11-6.59-1.01-4.58,1.89-9.11,6.47-10.12,20.77-4.57,42.06-5.38,63.28-2.4,21.21,2.98,41.46,9.62,60.16,19.74,4.13,2.23,5.66,7.38,3.43,11.51Zm15.94-32.38c-2.1,4.04-6.47,6.13-10.73,5.53-1.15-.16-2.28-.52-3.37-1.08-19.7-10.25-40.92-17.02-63.07-20.13-22.15-3.11-44.42-2.45-66.18,1.97-5.66,1.15-11.17-2.51-12.32-8.16-1.15-5.66,2.51-11.17,8.16-12.32,24.1-4.89,48.74-5.62,73.25-2.18,24.51,3.44,47.99,10.94,69.81,22.29,5.12,2.66,7.11,8.97,4.45,14.09Z"/>
      <path d="m318.54,169.81c-18.87,0-35.07-6.53-41.84-13.95-.64-.73-.73-1.13-.73-2.02v-22.09c0-1.05.89-1.45,1.61-.56,8.14,10.16,25.48,18.46,39.67,18.46,11.29,0,18.87-3.06,18.87-13.06,0-5.97-2.82-9.84-18.22-14.19l-8.87-2.5c-20.56-5.8-33.06-12.66-33.06-32.33,0-17.41,16.12-32.73,43.05-32.73,13.22,0,26.36,4.11,33.94,9.76.64.48.89.97.89,1.85v20.08c0,1.37-1.13,1.77-2.18.89-6.13-5.08-17.98-11.93-32.01-11.93s-20.64,6.29-20.64,12.09c0,6.13,4.27,7.82,19.51,12.34l7.58,2.26c23.46,7.01,33.06,16.85,33.06,33.14,0,20.96-17.41,34.51-40.63,34.51Zm164.39-42.09c0-12.82,8.87-22.33,21.37-22.33s21.28,9.51,21.28,22.33-8.87,22.33-21.28,22.33-21.37-9.51-21.37-22.33Zm21.28,42.09c26.04,0,44.18-18.62,44.18-42.09s-18.14-42.09-44.18-42.09-44.1,18.46-44.1,42.09,17.98,42.09,44.1,42.09Zm157.22-89.01v6.77h-13.71c-.73,0-1.13.4-1.13,1.13v16.12c0,.73.4,1.13,1.13,1.13h13.71v60.79c0,.73.4,1.13,1.13,1.13h20.64c.73,0,1.13-.4,1.13-1.13v-60.79h17.66l25.64,55.71-13.79,30.31c-.4.89.08,1.29.89,1.29h22.01c.73,0,1.05-.16,1.37-.89l45.55-103.52c.32-.73-.08-1.29-.89-1.29h-20.64c-.73,0-1.05.16-1.37.89l-20.8,49.99-20.88-49.99c-.32-.73-.64-.89-1.37-.89h-33.38v-5.32c0-8.71,5.89-12.74,13.46-12.74,4.51,0,9.43,2.34,12.9,4.43.81.48,1.37-.08,1.05-.81l-7.26-17.33c-.24-.56-.56-.89-1.13-1.21-3.55-1.85-9.35-3.47-15-3.47-17.09,0-26.93,13.06-26.93,29.67Zm-243,88.52c20.64,0,35.47-17.82,35.47-41.76s-15-41.44-35.64-41.44c-15.32,0-24.19,9.35-29.35,18.7v-16.12c0-.73-.4-1.13-1.13-1.13h-20.24c-.73,0-1.13.4-1.13,1.13v103.44c0,.73.4,1.13,1.13,1.13h20.24c.73,0,1.13-.4,1.13-1.13v-41.36c5.16,9.35,13.87,18.54,29.51,18.54Zm172.21-.32c6.77,0,13.3-1.77,17.17-4.03.56-.32.64-.64.64-1.21v-15.32c0-.81-.4-1.05-1.13-.64-2.34,1.29-5.4,2.34-9.59,2.34-6.61,0-10.8-3.87-10.8-12.42v-31.77h20.16c.73,0,1.13-.4,1.13-1.13v-16.12c0-.73-.4-1.13-1.13-1.13h-20.16v-21.04c0-.89-.56-1.37-1.37-.73l-36.04,28.38c-.48.4-.64.81-.64,1.45v9.19c0,.73.4,1.13,1.13,1.13h14.03v35.15c0,19.03,10.96,27.9,26.61,27.9Zm23.3-105.29c0,7.26,5.64,12.74,13.38,12.74s13.54-5.48,13.54-12.74-5.64-12.74-13.54-12.74-13.38,5.48-13.38,12.74Zm3.14,104.17h20.64c.73,0,1.13-.4,1.13-1.13v-78.04c0-.73-.4-1.13-1.13-1.13h-20.64c-.73,0-1.13.4-1.13,1.13v78.04c0,.73.4,1.13,1.13,1.13Zm-228.65-40.47c3.71-12.42,12.25-21.93,23.86-21.93s18.7,8.38,18.7,22.09-7.66,22.25-18.7,22.25-20.16-10.64-23.86-22.41Z"/>
      <path d="m810.1,92.31c-1.06-1.83-2.53-3.26-4.41-4.3-1.88-1.03-3.98-1.55-6.32-1.55s-4.44.52-6.32,1.55c-1.88,1.04-3.35,2.47-4.41,4.3-1.06,1.83-1.59,3.9-1.59,6.21s.53,4.34,1.59,6.17c1.06,1.83,2.53,3.26,4.41,4.3,1.88,1.04,3.98,1.55,6.32,1.55s4.44-.52,6.32-1.55,3.35-2.47,4.41-4.3c1.06-1.83,1.59-3.88,1.59-6.17s-.53-4.38-1.59-6.21Zm-1.93,11.36c-.86,1.52-2.06,2.7-3.59,3.56-1.53.85-3.27,1.28-5.2,1.28s-3.72-.43-5.25-1.28c-1.53-.85-2.72-2.04-3.57-3.56-.85-1.51-1.27-3.23-1.27-5.15s.42-3.63,1.27-5.13c.85-1.5,2.04-2.68,3.57-3.53,1.53-.85,3.28-1.28,5.25-1.28s3.67.43,5.2,1.28c1.53.85,2.73,2.04,3.59,3.56.86,1.52,1.29,3.23,1.29,5.15s-.43,3.59-1.29,5.11Z"/>
      <path d="m803.56,98.29c.82-.6,1.23-1.4,1.23-2.39s-.4-1.83-1.2-2.43c-.8-.6-1.96-.9-3.48-.9h-5.36v11.2h2.59v-4.45h1.41l3.41,4.45h3.18l-3.73-4.72c.79-.15,1.46-.4,1.96-.77Zm-3.86-.99h-2.36v-2.74h2.45c.73,0,1.29.11,1.68.34.39.23.59.58.59,1.06,0,.45-.21.79-.61,1.01-.41.23-.99.34-1.75.34Z"/>
    </svg>
  );
}

// ── Artist photo cache + rate-limited Spotify fetch ──────────
// One fetch at a time, 150 ms apart — avoids Spotify 429s when
// the full lineup loads. Reads localStorage cache first (instant).
const _photoQueue = [];
let   _photoActive = false;

function _drainPhotoQueue() {
  if (_photoActive || !_photoQueue.length) return;
  _photoActive = true;
  const { name, resolve } = _photoQueue.shift();
  const token   = localStorage.getItem("spotify_token");
  const expires = localStorage.getItem("spotify_expires");
  if (!token || !expires || Date.now() >= parseInt(expires)) {
    _photoActive = false; resolve(null); _drainPhotoQueue(); return;
  }
  fetch(
    `https://api.spotify.com/v1/search?q=${encodeURIComponent(name)}&type=artist&limit=3`,
    { headers: { Authorization: "Bearer " + token } }
  ).then(r => r.ok ? r.json() : null).then(d => {
    const ln = name.toLowerCase();
    const items = d?.artists?.items || [];
    const match = items.find(x => x.name.toLowerCase() === ln)
      || items.find(x => ln.includes(x.name.toLowerCase()))
      || items[0];
    const img = match?.images?.[0]?.url || null;
    if (img) putArtistImage(name, img, "spotify", { spotifyId: match.id });
    resolve(img);
  }).catch(() => resolve(null)).finally(() => {
    _photoActive = false;
    setTimeout(_drainPhotoQueue, 150);
  });
}

function _queuePhoto(name) {
  return new Promise(resolve => { _photoQueue.push({ name, resolve }); _drainPhotoQueue(); });
}

function useArtistPhoto(name) {
  const [photo, setPhoto] = React.useState(() => {
    return getArtistImage(name)?.url || null;
  });
  // A Spotify URL held in state expires with its cache entry: re-read, and
  // the effect below refetches when nothing showable is left.
  const expiry = useArtistImageExpiry();
  React.useEffect(() => {
    if (expiry) setPhoto(getArtistImage(name)?.url || null);
  }, [expiry]);
  React.useEffect(() => {
    if (photo) return;
    let live = true;
    const token   = localStorage.getItem("spotify_token");
    const expires = localStorage.getItem("spotify_expires");
    // Spotify (connected users, 24 h rule) is the only photo source; with no
    // photo the swatch keeps its gradient and initials.
    if (token && expires && Date.now() < parseInt(expires)) {
      _queuePhoto(name).then(img => { if (live && img) setPhoto(img); });
    }
    return () => { live = false; };
  }, [name.toLowerCase(), photo]);
  return photo;
}

// Artist color swatch — shows Spotify headshot when available,
// falls back to gradient + initials.
function ArtistSwatch({ artist, size = 44 }) {
  const photo = useArtistPhoto(artist.name);
  // Letters and digits only: "Wooli (Sunset Set)" is "WS", not "W(".
  const initials = artist.name.split(/\s+/).map(w => (w.match(/[A-Za-z0-9]/) || [""])[0]).filter(Boolean).slice(0, 2).join("").toUpperCase();
  return (
    <div style={{
      width: size, height: size, borderRadius: size,
      // Field Mode: a real photo, or a plain surface with initials. Never the
      // generated gradient in artist.img.
      background: "var(--paper-3)",
      color: "var(--text-2)",
      display: "flex", alignItems: "center", justifyContent: "center",
      fontSize: Math.max(12, size * 0.36), fontWeight: 600,
      flexShrink: 0,
      boxShadow: "inset 0 0 0 1px var(--line)",
      overflow: "hidden", position: "relative",
    }}>
      {photo
        ? <img src={photo} alt={artist.name} style={{
            position: "absolute", inset: 0, width: "100%", height: "100%",
            objectFit: "cover", objectPosition: "center 15%",
          }}/>
        : initials}
    </div>
  );
}

// Plursky logo mark — uses the same yellow P icon as the home-screen / app icon
// so the brand is uniform between the website masthead and the installed PWA.
function Wordmark({ size = 18, color = "var(--ink)" }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, color }}>
      <img src="./apple-touch-icon.png" alt=""
        width={size} height={size}
        style={{ borderRadius: size * 0.22, display: "block", flexShrink: 0 }} />
      <span className="mono" style={{ fontSize: size * 0.72, letterSpacing: 3, fontWeight: 500 }}>PLURSKY</span>
    </div>
  );
}

// ── Field Mode shared components ──────────────────────────────
// Every restyled surface builds from these, so the rules live in one place:
// one sheet radius (14) with one grabber, a 52pt primary button, 44pt icon
// targets, a 22/28 section title and a flat horizontal row.
const fieldIconBtn = {
  width: 44, height: 44, flexShrink: 0, padding: 0,
  display: "flex", alignItems: "center", justifyContent: "center",
  background: "transparent", border: "none", borderRadius: 14,
  color: "var(--ink)", cursor: "pointer",
};

// The one dominant action on a screen is kind="primary" (the purple fill).
function FieldButton({ children, onClick, kind = "primary", style, ...rest }) {
  const primary = kind === "primary";
  return (
    <button onClick={onClick} {...rest} style={{
      width: "100%", minHeight: 52, padding: "0 20px",
      display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
      background: primary ? "var(--acc)" : "transparent",
      color: primary ? "var(--on-acc)" : "var(--ink)",
      // Secondary is outlined so it reads as a button on a raised sheet too.
      border: primary ? "none" : "1px solid var(--line-2)", borderRadius: "var(--rad-sm)", cursor: rest.disabled ? "default" : "pointer",
      boxShadow: primary && !rest.disabled ? "0 10px 28px -12px var(--acc-55)" : "none",
      font: "650 17px/1.3 var(--f-ui)", letterSpacing: "-0.01em",
      opacity: rest.disabled ? 0.45 : 1,
      ...style,
    }}>{children}</button>
  );
}

function FieldSectionHeader({ title, action, onAction }) {
  return (
    <div style={{
      display: "flex", alignItems: "center", justifyContent: "space-between",
      padding: "0 20px", minHeight: 44,
    }}>
      <h2 style={{ margin: 0, fontSize: 22, lineHeight: "28px", fontWeight: 700, letterSpacing: "-0.01em" }}>{title}</h2>
      {action && (typeof action === "string"
        ? <button onClick={onAction} style={{ ...fieldIconBtn, width: "auto", padding: "0 4px", color: "var(--text-2)", fontSize: 15, fontWeight: 500 }}>{action}</button>
        : action)}
    </div>
  );
}

// Flat horizontal row that bleeds to the screen edge with a 20pt inset.
function FieldMediaRow({ children }) {
  return (
    <div className="no-scrollbar" style={{
      display: "flex", gap: 12, overflowX: "auto", scrollbarWidth: "none",
      padding: "4px 20px 0", scrollPaddingInline: 20, scrollSnapType: "x proximity",
    }}>
      {children}
    </div>
  );
}

// One bottom sheet: one grabber, one radius, a title and a 44pt close.
function FieldSheet({ title, onClose, children }) {
  useDeclareModal(true);
  React.useEffect(() => {
    const onKey = (e) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  return (
    <div onClick={onClose} style={{
      position: "fixed", inset: 0, zIndex: 80, background: "var(--scrim)",
      display: "flex", alignItems: "flex-end",
    }}>
      <div role="dialog" aria-modal="true" aria-label={title} onClick={e => e.stopPropagation()} style={{
        width: "100%", maxHeight: "88%", display: "flex", flexDirection: "column",
        background: "var(--s1)", borderRadius: "var(--rad-lg) var(--rad-lg) 0 0", boxShadow: "var(--e2)",
        paddingBottom: "env(safe-area-inset-bottom, 0px)",
      }}>
        <div aria-hidden="true" style={{ display: "flex", justifyContent: "center", paddingTop: 8 }}>
          <div style={{ width: 36, height: 5, borderRadius: 3, background: "var(--line-2)" }}/>
        </div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "4px 8px 4px 20px" }}>
          <h2 style={{ margin: 0, font: "700 22px/1.25 var(--f-ui)", letterSpacing: "-0.02em" }}>{title}</h2>
          <button onClick={onClose} aria-label="Close" style={fieldIconBtn}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M6 6 L18 18 M18 6 L6 18"/></svg>
          </button>
        </div>
        <div style={{ overflowY: "auto", WebkitOverflowScrolling: "touch", padding: "4px 20px 24px" }}>
          {children}
        </div>
      </div>
    </div>
  );
}

// ── Duo board components ─────────────────────────────────────
// The selected dark/light board (design/system-exploration @ 6524ccb) as
// shared pieces. Styles are the duo-* classes in index.html; every colour is
// a mode token, so nothing here reads the mode.

// An act's face: the artist's Spotify photo (transient, 24 h, via
// useArtistPhoto) or their initials. A b2b is two whole faces overlapped in
// the same footprint; a 3+ chain shows its first two. ring: "on" = on your
// plan, "cl" = in a clash.
function _duoMembers(name) {
  return String(name || "").split(/\s+b\d+b\s+|\s+with\s+/i).map(s => s.trim()).filter(Boolean);
}
function _duoInitials(name) {
  return String(name || "").split(/\s+/).filter(w => /[A-Za-z0-9]/.test(w)).slice(0, 2)
    .map(w => w.match(/[A-Za-z0-9]/)[0].toUpperCase()).join("") || "?";
}
function DuoFace({ name, size, ring = "", style }) {
  const photo = useArtistPhoto(name);
  return (
    <span className={`duo-av ${ring}`} aria-hidden="true"
      style={{ width: size, height: size, fontSize: Math.round(size * 0.32), ...style }}>
      {photo ? <img src={photo} alt="" /> : _duoInitials(name)}
    </span>
  );
}
function DuoAvatar({ name, size = 40, ring = "" }) {
  const ms = _duoMembers(name);
  if (ms.length < 2) return <DuoFace name={name} size={size} ring={ring} />;
  const d = Math.round(size * 0.66);
  return (
    <span className="duo-avp" aria-hidden="true" style={{ width: size, height: size }}>
      <DuoFace name={ms[0]} size={d} ring={ring} style={{ left: 0, top: 0 }} />
      <DuoFace name={ms[1]} size={d} ring={ring} style={{ right: 0, bottom: 0 }} />
    </span>
  );
}

// LIVE is green and only ever means live.
function DuoLive({ children = "Live", className = "duo-label" }) {
  return <span className={`${className} duo-live`}><i aria-hidden="true" />{children}</span>;
}

// The board's section eyebrow: Michroma caps, with an optional right slot.
function DuoSect({ title, right, style }) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, minHeight: 24, ...style }}>
      <h2 className="duo-sect">{title}</h2>
      {right}
    </div>
  );
}

// ── PWA install prompt ────────────────────────────────────────
// Android (Chrome/Edge): captures beforeinstallprompt and exposes prompt().
// iOS (Safari): no native install prompt — show "Add to Home Screen" hint.
// Standalone (already installed): suppress everything.
function useInstallPrompt() {
  const [deferred, setDeferred] = React.useState(null);
  const [dismissed, setDismissed] = React.useState(
    () => typeof localStorage !== "undefined" && localStorage.getItem("install_dismissed") === "1"
  );

  React.useEffect(() => {
    const handler = (e) => { e.preventDefault(); setDeferred(e); };
    const installed = () => {
      setDeferred(null);
      try { localStorage.setItem("install_dismissed", "1"); } catch {}
    };
    window.addEventListener("beforeinstallprompt", handler);
    window.addEventListener("appinstalled", installed);
    return () => {
      window.removeEventListener("beforeinstallprompt", handler);
      window.removeEventListener("appinstalled", installed);
    };
  }, []);

  const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent) && !window.MSStream;
  const isStandalone =
    (typeof window !== "undefined" && window.matchMedia?.("(display-mode: standalone)").matches) ||
    window.navigator.standalone === true;
  // We ARE the native app — Capacitor doesn't set navigator.standalone or the
  // display-mode media query, so without this guard the "Add to Home Screen"
  // banner pitches users to install the app they're already inside.
  const isNativeApp = !!window.Capacitor?.isNativePlatform?.();

  const canInstall = !dismissed && !isStandalone && !isNativeApp && (deferred || isIOS);

  return {
    canInstall,
    isIOS,
    install: async () => {
      if (!deferred) return;
      deferred.prompt();
      try {
        const { outcome } = await deferred.userChoice;
        if (outcome === "accepted") setDeferred(null);
      } catch {}
    },
    dismiss: () => {
      try { localStorage.setItem("install_dismissed", "1"); } catch {}
      setDismissed(true);
    },
  };
}

function InstallBanner() {
  const ip = useInstallPrompt();
  if (!ip.canInstall) return null;

  return (
    <div style={{
      margin: "8px 16px 0",
      padding: "10px 12px",
      borderRadius: 14,
      background: "var(--ink)",
      color: "var(--on-ink)",
      display: "flex", alignItems: "center", gap: 11,
    }}>
      <img src="./apple-touch-icon.png" alt=""
        width="36" height="36"
        style={{ borderRadius: 9, display: "block", flexShrink: 0 }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div className="mono" style={{ fontSize: 9, letterSpacing: 1.4, color: "var(--on-ink-flare)", fontWeight: 700 }}>
          INSTALL PLURSKY
        </div>
        <div style={{ fontSize: 12, lineHeight: 1.35, marginTop: 2, color: "var(--on-ink-2)" }}>
          {ip.isIOS
            ? <>Tap <span style={{ display: "inline-flex", verticalAlign: "middle", padding: "0 2px" }}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--on-ink)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 3 L12 16"/><path d="M7 8 L12 3 L17 8"/><rect x="5" y="13" width="14" height="8" rx="1.5"/>
                </svg></span> then <strong style={{ color: "var(--on-ink)" }}>Add to Home Screen</strong> for offline + full-screen.</>
            : <>Add to home screen for offline lineup + full-screen map.</>}
        </div>
      </div>
      {!ip.isIOS && (
        <button onClick={ip.install} style={{
          background: "var(--ember)", color: "var(--on-ember)", border: "none",
          borderRadius: 999, padding: "7px 12px", cursor: "pointer",
          fontFamily: "Geist Mono, monospace", fontSize: 10, letterSpacing: 1.2, fontWeight: 700,
          flexShrink: 0,
        }}>INSTALL</button>
      )}
      <button onClick={ip.dismiss} aria-label="Dismiss" style={{
        background: "transparent", border: "none", cursor: "pointer",
        color: "var(--on-ink-3)", padding: 4, flexShrink: 0,
        fontSize: 18, lineHeight: 1,
      }}>×</button>
    </div>
  );
}

// ── Notifications (v131: native + web hybrid) ──────────────────
// Two paths sharing the same { supported, perm, enable, showLocal } API:
//
//   • Native iOS (Capacitor): @capacitor/local-notifications schedules
//     reminders at the OS level so they fire when the app is killed.
//     This is the only way set-time reminders actually work on iOS —
//     web Notification doesn't exist inside WKWebView, and setTimeout
//     stops when the app is backgrounded.
//
//   • Web (plursky.com): real wall-clock setTimeout(showNotification)
//     via the service-worker registration. Persisted to localStorage so
//     a reload re-registers any reminders that haven't fired yet.
//
// SW push handler (sw.js) is also live for future server-sent VAPID
// pushes, but Plursky has no backend for that today — only locally
// scheduled set-time reminders.

function _capLocalNotifications() {
  const cap = window.Capacitor;
  if (!cap?.isNativePlatform?.()) return null;
  return cap.Plugins?.LocalNotifications || null;
}

// Map a string artist id to a deterministic int32-safe positive integer.
// LocalNotifications.schedule requires numeric ids; reusing the same id
// for the same artist makes cancel/replace trivial.
function _notifIdForArtist(id) {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = ((h * 31) + id.charCodeAt(i)) | 0;
  return (Math.abs(h) % 1_999_999_999) + 1; // 1..~2e9, never 0
}
// Distinct id for the test ping so it doesn't collide with any artist's
// reminder slot.
const _TEST_NOTIF_ID = 9_999_001;

function useNotifications() {
  const ln = _capLocalNotifications();
  const webSupported = typeof Notification !== "undefined";
  const supported = !!ln || webSupported;

  const [perm, setPerm] = React.useState(() => {
    if (ln)            return "checking";   // resolved by the effect below
    if (webSupported)  return Notification.permission;
    return "unsupported";
  });

  // On native: resolve the current permission state once on mount so the
  // UI can show ENABLED / OFF / BLOCKED accurately.
  React.useEffect(() => {
    if (!ln) return;
    let cancelled = false;
    ln.checkPermissions().then(res => {
      if (cancelled) return;
      setPerm(_mapDisplayPerm(res?.display));
    }).catch(() => { if (!cancelled) setPerm("default"); });
    return () => { cancelled = true; };
  }, []);

  const enable = async () => {
    if (ln) {
      try {
        const res = await ln.requestPermissions();
        const next = _mapDisplayPerm(res?.display);
        setPerm(next);
        return next;
      } catch {
        setPerm("denied");
        return "denied";
      }
    }
    if (!webSupported) return "unsupported";
    if (perm === "granted") return "granted";
    const result = await Notification.requestPermission();
    setPerm(result);
    return result;
  };

  const showLocal = async (title, opts = {}) => {
    if (perm !== "granted") return false;
    if (ln) {
      // Native path: schedule one second from now so the OS still treats
      // this as a real scheduled notification (firing immediately can be
      // dropped on some iOS versions when the app is foreground).
      try {
        await ln.schedule({
          notifications: [{
            id: _TEST_NOTIF_ID,
            title,
            body: opts.body || "",
            schedule: { at: new Date(Date.now() + 1000) },
            sound: undefined,
            smallIcon: "ic_stat_icon_config_sample",
            extra: opts.data || {},
          }],
        });
        return true;
      } catch { return false; }
    }
    if (!webSupported) return false;
    try {
      const reg = await navigator.serviceWorker?.ready;
      if (reg) {
        await reg.showNotification(title, {
          icon: "/og.svg", badge: "/og.svg",
          vibrate: [80, 40, 80],
          ...opts,
        });
      } else {
        new Notification(title, opts);
      }
      return true;
    } catch { return false; }
  };

  return { supported, perm, enable, showLocal };
}

// LocalNotifications.{check,request}Permissions returns
// { display: 'granted' | 'denied' | 'prompt' | 'prompt-with-rationale' }
// We collapse the two prompt-ish states into web's "default" so the rest
// of the UI can use a single shape.
function _mapDisplayPerm(display) {
  if (display === "granted") return "granted";
  if (display === "denied")  return "denied";
  return "default";
}

// ── Attendance tracking (v137) ────────────────────────────────
// Real "SETS CAUGHT" stat — replaces the previous hardcoded heuristic
// (set.day <= NOW.day, which lit up every saved set whether attended
// or not). Two ways a set ends up here:
//   (a) Live GPS auto-detect — if the user is within ~140 m of a
//       stage anchor while one of its artists is mid-set, we mark
//       attendance immediately. No history needed; just current GPS
//       + current time. See `detectCurrentArtist`.
//   (b) Manual review in the Memories tab — checkbox list per night
//       so the user can backfill anything we missed the next morning.

const ATTENDED_KEY = "plursky_attended_v1";
function getAllAttended() {
  try {
    const raw = localStorage.getItem(ATTENDED_KEY);
    const obj = raw ? JSON.parse(raw) : {};
    // Normalize legacy/empty values into arrays of strings.
    Object.keys(obj).forEach(k => {
      obj[k] = Array.isArray(obj[k]) ? obj[k].filter(x => typeof x === "string") : [];
    });
    return obj;
  } catch { return {}; }
}
function _writeAttended(map) {
  try { localStorage.setItem(ATTENDED_KEY, JSON.stringify(map)); } catch {}
  try { window.dispatchEvent(new CustomEvent("plursky-attended-change")); } catch {}
}
function getAttendedForNight(night) {
  return new Set(getAllAttended()[night] || []);
}
function getAttendedCount() {
  const all = getAllAttended();
  return Object.values(all).reduce((s, arr) => s + (Array.isArray(arr) ? arr.length : 0), 0);
}
function markAttended(night, artistId, source = "manual") {
  if (!night || !artistId) return false;
  const all = getAllAttended();
  const list = all[night] || [];
  if (list.includes(artistId)) return false;
  all[night] = [...list, artistId];
  _writeAttended(all);
  if (source === "gps") {
    // Lightweight crumb so we can show a "marked by GPS" badge later
    try {
      const log = JSON.parse(localStorage.getItem("plursky_attended_source_v1") || "{}");
      log[artistId] = { source, ts: Date.now() };
      localStorage.setItem("plursky_attended_source_v1", JSON.stringify(log));
    } catch {}
  }
  return true;
}
function unmarkAttended(night, artistId) {
  if (!night || !artistId) return false;
  const all = getAllAttended();
  const list = (all[night] || []).filter(x => x !== artistId);
  if (list.length === (all[night] || []).length) return false;
  all[night] = list;
  _writeAttended(all);
  return true;
}
function isAttended(night, artistId) {
  return getAttendedForNight(night).has(artistId);
}
function getAttendanceSource(artistId) {
  try {
    const log = JSON.parse(localStorage.getItem("plursky_attended_source_v1") || "{}");
    return log[artistId]?.source || "manual";
  } catch { return "manual"; }
}

// Quick equirectangular distance — accurate enough at festival scale.
function _gpsDistMeters(latA, lngA, latB, lngB) {
  const toRad = (d) => d * Math.PI / 180;
  const cosLat = Math.cos(toRad((latA + latB) / 2));
  const dLat = toRad(latB - latA) * 6371000;
  const dLng = toRad(lngB - lngA) * 6371000 * cosLat;
  return Math.hypot(dLat, dLng);
}

// Given current GPS + current festival time, return the artist the user is
// most likely watching right now — or null if none matches.
//
// "At a set" = within `radiusM` of a stage anchor AND the stage has an
// artist whose set window contains NOW.time. We use 140 m as the default
// radius which roughly matches the audible/visible footprint of a stage
// at LVMS without bleeding into neighbours.
function detectCurrentArtist(lat, lng, opts = {}) {
  if (typeof lat !== "number" || typeof lng !== "number") return null;
  const cfg = window.FESTIVAL_CONFIG;
  if (!cfg) return null;
  // Crowd anchors where measured. This function compares the USER'S live
  // position against stage pins at a 140 m radius — with kinetic's poster pin
  // 438 m from its crowd, a user standing at the main stage was 279 m from the
  // NEAREST anchor and this returned null every time. Live stage detection was
  // silently dead at the biggest stage on site.
  const anchors = (typeof resolvedStageAnchors === "function")
    ? resolvedStageAnchors(cfg) : (cfg.gpsAnchors || []);
  if (anchors.length === 0) return null;
  const radius = opts.radiusM || 140;
  const now = window.NOW;
  if (!now || !now.day || !now.time) return null;
  // Closest stage anchor within radius
  let best = null;
  for (const a of anchors) {
    const d = _gpsDistMeters(lat, lng, a.lat, a.lng);
    if (d > radius) continue;
    if (!best || d < best.d) best = { ...a, d };
  }
  if (!best) return null;
  // Artist on stage at that anchor right now, by real date (isSetLive). The
  // old clock-of-day match against now.day auto-attended a set a week early.
  const playing = activeLineup().find(a => a.stage === best.stageId && isSetLive(a));
  if (!playing) return null;
  return { artistId: playing.id, stageId: best.stageId, night: now.day, distM: Math.round(best.d) };
}

// Called from the GPS effect in MapScreen on every successful sample.
// Idempotent + cheap — silently no-ops when the user is between stages,
// outside the festival, or it's not set time.
function recordAttendanceFromGps(lat, lng) {
  const hit = detectCurrentArtist(lat, lng);
  if (!hit) return null;
  const added = markAttended(hit.night, hit.artistId, "gps");
  return added ? hit : null;
}

// Convert an artist's set start to a real UTC timestamp.
function _artistStartMs(artist) {
  // artistDayDate stamps the weekend THIS act plays (see data.jsx). Reading
  // dayDates directly fires every W2 reminder a week early. _wallMs owns the
  // post-midnight rule: this used "before 06:00" where every other surface
  // uses 08:00, so a 06:00-07:59 closing set was reminded a day early.
  return _wallMs(artistDayDate(artist), artist && artist.start, FESTIVAL_CONFIG && FESTIVAL_CONFIG.tz);
}

const _REMINDERS_KEY = "reminders_v1";
const _REMINDER_LEAD_KEY = "plursky_reminder_lead_min";
const _REMINDER_LEAD_OPTIONS = [5, 15, 30, 60];
const _SCHEDULED = new Map(); // artistId → timeout handle

function getReminderLeadMin() {
  try {
    const raw = parseInt(localStorage.getItem(_REMINDER_LEAD_KEY) || "", 10);
    if (_REMINDER_LEAD_OPTIONS.includes(raw)) return raw;
  } catch {}
  return 15;
}
function setReminderLeadMin(mins) {
  if (!_REMINDER_LEAD_OPTIONS.includes(mins)) return;
  try { localStorage.setItem(_REMINDER_LEAD_KEY, String(mins)); } catch {}
}

// Schedule reminders for all upcoming saved sets using real wall-clock time.
// Lead-time is configurable (5/15/30/60 min, default 15).
//
// Native path: hand the full list to LocalNotifications.schedule with
// `at: new Date(fireMs)`. The OS owns the schedule from there — the app
// can die, the user can hard-quit, the phone can reboot, and the alert
// still fires. Cancels prior plursky-owned notifications first so the
// list is always a fresh mirror of the saved set.
//
// Web path: setTimeout each pending reminder and persist to localStorage
// so a reload can rehydrate any that haven't fired yet.
function scheduleReminders(state, showLocal) {
  const ln = _capLocalNotifications();
  const now = Date.now();
  const leadMin = getReminderLeadMin();
  const pending = [];

  // activeLineup, not ARTISTS: a saved W1-only act is not in the lineup the
  // user is on, so it simply does not resolve and no notification is built.
  // A push for a set nobody is playing was the failure this closes.
  const lineup = activeLineup(state.saved);

  state.saved.forEach(id => {
    const a = lineup.find(x => x.id === id);
    if (!a) return;
    const startMs = _artistStartMs(a);
    if (!startMs) return;
    const fireMs = startMs - leadMin * 60000;
    const delayMs = fireMs - now;
    if (delayMs <= 0 || delayMs > 24 * 3600000) return; // upcoming within 24 h only
    const stage = STAGES.find(s => s.id === a.stage);
    pending.push({
      id: a.id,
      notifId: _notifIdForArtist(a.id),
      name: a.name,
      stageName: stage?.name || "",
      start: a.start,
      fireMs, leadMin,
    });
  });

  if (ln) {
    // Native: cancel the previous slate, then schedule fresh. We cancel by
    // explicit id list so we don't blow away third-party Capacitor plugins'
    // notifications (none exist today, but cheap insurance).
    // _SCHEDULED is empty after a relaunch, so the persisted slate counts as
    // "previous" too — otherwise a set unsaved, cancelled by a schedule
    // update, or moved to TBA across a relaunch kept its old alert, and the
    // OS fired it for a set nobody was playing.
    let persisted = [];
    try { persisted = JSON.parse(localStorage.getItem(_REMINDERS_KEY) || "[]").map(p => p && p.notifId); } catch {}
    const prevIds = [...Array.from(_SCHEDULED.values()), ...persisted].filter(v => typeof v === "number");
    const allIds  = new Set([...prevIds, ...pending.map(p => p.notifId)]);
    _SCHEDULED.clear();
    ln.cancel({ notifications: [...allIds].map(id => ({ id })) }).catch(() => {});
    if (pending.length > 0) {
      ln.schedule({
        notifications: pending.map(p => ({
          id:    p.notifId,
          title: `${p.name} starts in ${p.leadMin} min`,
          body:  `${p.stageName} · ${fmt12(p.start)}`,
          schedule: { at: new Date(p.fireMs), allowWhileIdle: true },
          extra: { artistId: p.id, url: "/" },
        })),
      }).catch(() => {});
    }
    pending.forEach(p => _SCHEDULED.set(p.id, p.notifId));
    try { localStorage.setItem(_REMINDERS_KEY, JSON.stringify(pending)); } catch {}
    return _SCHEDULED.size;
  }

  // Web fallback: setTimeout per reminder.
  _SCHEDULED.forEach(h => { if (typeof h !== "number") clearTimeout(h); });
  _SCHEDULED.clear();
  pending.forEach(p => {
    const handle = setTimeout(() => {
      showLocal(`${p.name} starts in ${p.leadMin} min`, {
        body: `${p.stageName} · ${fmt12(p.start)}`,
        tag: `set-${p.id}`,
        data: { url: "/" },
      });
      _SCHEDULED.delete(p.id);
    }, p.fireMs - now);
    _SCHEDULED.set(p.id, handle);
  });
  try { localStorage.setItem(_REMINDERS_KEY, JSON.stringify(pending)); } catch {}
  return _SCHEDULED.size;
}

// On mount: reload any reminders that were persisted before the page
// refreshed and haven't fired yet.
//
// Native: a no-op — the OS holds the schedule across app lifecycle.
// (NotificationsCard's effect still calls scheduleReminders when the
// saved-set list changes, so any drift gets reconciled.)
function loadAndReschedule(showLocal) {
  if (_capLocalNotifications()) return 0;
  let count = 0;
  try {
    const saved = JSON.parse(localStorage.getItem(_REMINDERS_KEY) || "[]");
    const now = Date.now();
    const live = saved.filter(r => r.fireMs > now && r.fireMs - now <= 24 * 3600000);
    live.forEach(r => {
      if (_SCHEDULED.has(r.id)) return;
      const lead = r.leadMin || 15;
      const handle = setTimeout(() => {
        showLocal(`${r.name} starts in ${lead} min`, {
          body: `${r.stageName} · ${fmt12(r.start)}`,
          tag: `set-${r.id}`,
          data: { url: "/" },
        });
        _SCHEDULED.delete(r.id);
      }, r.fireMs - now);
      _SCHEDULED.set(r.id, handle);
      count++;
    });
    if (live.length !== saved.length)
      localStorage.setItem(_REMINDERS_KEY, JSON.stringify(live));
  } catch {}
  return count;
}

function NotificationsCard({ state }) {
  const { supported, perm, enable, showLocal } = useNotifications();
  const [scheduled, setScheduled] = React.useState(0);
  const [flash, setFlash] = React.useState(null); // 'enabled' | 'tested'
  const [leadMin, setLeadMinState] = React.useState(getReminderLeadMin);
  const onPickLead = (mins) => {
    setReminderLeadMin(mins);
    setLeadMinState(mins);
    if (perm === "granted") setScheduled(scheduleReminders(state, showLocal));
  };

  // On mount: restore reminders that survived a page reload
  React.useEffect(() => {
    if (perm === "granted") {
      const n = loadAndReschedule(showLocal);
      if (n > 0) setScheduled(n);
    }
  }, []);

  // Re-schedule whenever the save list changes
  React.useEffect(() => {
    if (perm === "granted") setScheduled(scheduleReminders(state, showLocal));
  }, [perm, state.saved.join(",")]);

  const onEnable = async () => {
    const r = await enable();
    if (r === "granted") {
      const n = scheduleReminders(state, showLocal);
      setScheduled(n);
      setFlash("enabled"); setTimeout(() => setFlash(null), 2000);
    }
  };

  const onTest = async () => {
    const ok = await showLocal("Plursky reminder · TEST", {
      body: "This is what set-start alerts will look like.",
      tag: "plursky-test",
    });
    if (ok) { setFlash("tested"); setTimeout(() => setFlash(null), 1800); }
  };

  if (!supported) {
    return (
      <div style={{
        padding: "12px 14px", borderRadius: 12,
        background: "var(--paper)", border: "1px solid var(--line)",
        marginBottom: 12,
      }}>
        <div className="mono" style={{ fontSize: 9, letterSpacing: 1.4, color: "var(--muted)", fontWeight: 700 }}>
          NOTIFICATIONS · UNSUPPORTED
        </div>
        <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 4, lineHeight: 1.4 }}>
          {window.Capacitor?.isNativePlatform?.()
            ? "Notifications aren't wired in this build yet — set-time reminders will land in a future update."
            : "Your browser doesn't support web notifications. Install Plursky to your home screen for the full experience."}
        </div>
      </div>
    );
  }

  const label = perm === "granted" ? "ENABLED" : perm === "denied" ? "BLOCKED" : "OFF";
  const labelColor = perm === "granted" ? "var(--success)" : perm === "denied" ? "var(--alert)" : "var(--muted)";

  return (
    <div style={{
      padding: 14, borderRadius: 14,
      background: "var(--paper)", border: "1px solid var(--line)",
      marginBottom: 12,
    }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
        <div className="mono" style={{ fontSize: 10, letterSpacing: 1.5, color: "var(--muted)", fontWeight: 700 }}>
          REMINDERS
        </div>
        <span className="mono" style={{ fontSize: 9, letterSpacing: 1.3, color: labelColor, fontWeight: 700 }}>
          {flash === "enabled" ? "✓ ENABLED" : flash === "tested" ? "✓ TEST SENT" : label}
        </span>
      </div>
      <div className="serif" style={{ fontSize: 20, lineHeight: 1.1, marginBottom: 4 }}>
        {leadMin}-min head-up before each set
      </div>
      <div style={{ fontSize: 13, color: "var(--muted)", lineHeight: 1.5, marginBottom: perm === "denied" ? 8 : 12 }}>
        {perm === "granted"
          ? scheduled > 0
            ? `${scheduled} reminder${scheduled === 1 ? "" : "s"} set · alerts fire even when Plursky is in the background.`
            : "No sets starting in the next 24 hours — reminders will activate automatically during the festival."
          : perm === "denied"
            ? (window.Capacitor?.isNativePlatform?.()
                ? "Notifications are blocked in iOS Settings."
                : "Notifications are blocked for this site.")
            : `Get a notification ${leadMin} minutes before each saved set so you don't miss a thing.`}
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
        <span className="mono" style={{ fontSize: 9, letterSpacing: 1.4, color: "var(--muted)", fontWeight: 700 }}>
          LEAD TIME
        </span>
        <div style={{ display: "flex", gap: 5 }}>
          {_REMINDER_LEAD_OPTIONS.map(m => {
            const on = m === leadMin;
            return (
              <button key={m} onClick={() => onPickLead(m)} className="mono" style={{
                padding: "4px 9px", borderRadius: 999, cursor: "pointer",
                background: on ? "var(--ink)" : "transparent",
                color: on ? "var(--paper)" : "var(--ink)",
                border: on ? "none" : "1px solid var(--line-2)",
                fontSize: 10, letterSpacing: 1.1, fontWeight: on ? 700 : 500,
              }}>{m}M</button>
            );
          })}
        </div>
      </div>
      {perm === "denied" && (
        <div style={{
          background: "var(--paper-2)", border: "1px solid var(--line-2)",
          borderRadius: 10, padding: "10px 12px", marginBottom: 12,
        }}>
          <div className="mono" style={{ fontSize: 9, letterSpacing: 1.3, color: "var(--muted)", fontWeight: 700, marginBottom: 6 }}>
            HOW TO RE-ENABLE
          </div>
          {window.Capacitor?.isNativePlatform?.() ? (
            <div style={{ fontSize: 13, color: "var(--ink)", lineHeight: 1.55 }}>
              iPhone: <strong>Settings</strong> → <strong>Plursky</strong> → <strong>Notifications</strong> → set <em>Allow Notifications</em> ON.
            </div>
          ) : /iPhone|iPad|iPod/.test(navigator.userAgent) ? (
            <div style={{ fontSize: 13, color: "var(--ink)", lineHeight: 1.55 }}>
              iPhone: <strong>Settings</strong> → <strong>Apps</strong> → <strong>Safari</strong> → <strong>Notifications</strong> → find <em>plursky.com</em> → Allow
            </div>
          ) : (
            <div style={{ fontSize: 13, color: "var(--ink)", lineHeight: 1.55 }}>
              Tap the <strong>lock icon</strong> (or <strong>ⓘ</strong>) in your browser's address bar → <strong>Site settings</strong> → <strong>Notifications</strong> → set to <strong>Allow</strong>, then reload.
            </div>
          )}
        </div>
      )}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        {perm !== "granted" && perm !== "denied" && (
          <button onClick={onEnable} style={{
            background: "var(--ember)", color: "var(--on-ember)", border: "none",
            borderRadius: 999, padding: "8px 14px", cursor: "pointer",
            fontFamily: "Geist Mono, monospace", fontSize: 10, letterSpacing: 1.2, fontWeight: 700,
          }}>ENABLE</button>
        )}
        {perm === "granted" && (
          <button onClick={onTest} style={{
            background: "transparent", color: "var(--ink)", border: "1px solid var(--line-2)",
            borderRadius: 999, padding: "8px 14px", cursor: "pointer",
            fontFamily: "Geist Mono, monospace", fontSize: 10, letterSpacing: 1.2, fontWeight: 600,
          }}>SEND A TEST</button>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Festival switcher (Phase 2)
// ─────────────────────────────────────────────────────────────
// Small "EDC LV 2026 ▾" pill that opens a sheet listing every
// festival in FESTIVALS_REGISTRY. Selectable festivals reload the
// page with their config; "coming soon" festivals are visible as
// a roadmap preview but not selectable.
function FestivalChip({ compact = false, accent = "var(--ink)", title = null }) {
  const [open, setOpen] = React.useState(false);
  const canSwitch = FESTIVALS_REGISTRY.filter(f => f.available).length > 1;
  // title: the duo Today header, where the festival's own name IS the
  // switcher (Apple Sports' title menu). Same button, same label.
  if (title) return (
    <>
      <button type="button" className="duo-press"
        onClick={canSwitch ? () => setOpen(true) : undefined}
        disabled={!canSwitch}
        aria-label={canSwitch ? `${FESTIVAL_CONFIG.shortName.toUpperCase()}, switch festival` : undefined}
        style={{ display: "inline-flex", alignItems: "flex-end", gap: 8, width: "auto", maxWidth: "100%", color: "var(--ink)", cursor: canSwitch ? "pointer" : "default" }}>
        {title}
        {canSwitch && (
          <span aria-hidden="true" style={{ flex: "none", marginBottom: "0.32em", width: 28, height: 28, borderRadius: 14, display: "grid", placeItems: "center", background: "var(--s2)", boxShadow: "var(--e1)", color: "var(--ink-2)" }}>
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M3 4.5 L6 7.5 L9 4.5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"/></svg>
          </span>
        )}
      </button>
      {open && <FestivalSwitcher onClose={() => setOpen(false)} />}
    </>
  );
  return (
    <>
      {/* Field Mode: a 44pt target around an 18pt-radius status pill. The
          label stays the upper-case shortName (QA harnesses match on it). No
          emoji: colour in chrome belongs to the one accent. */}
      <div
        onClick={canSwitch ? () => setOpen(true) : undefined}
        role={canSwitch ? "button" : undefined}
        tabIndex={canSwitch ? 0 : undefined}
        aria-label={canSwitch ? `${FESTIVAL_CONFIG.shortName.toUpperCase()}, switch festival` : undefined}
        onKeyDown={canSwitch ? (e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setOpen(true); } }) : undefined}
        style={{
          display: "inline-flex", alignItems: "center", minHeight: 44,
          color: accent, cursor: canSwitch ? "pointer" : "default",
          whiteSpace: "nowrap", userSelect: "none",
        }}>
        <span style={{
          display: "inline-flex", alignItems: "center", gap: 6, height: 32,
          padding: "0 12px", borderRadius: 18,
          background: "var(--chrome)", border: "1px solid var(--line)",
          fontSize: 11, lineHeight: "14px", fontWeight: 600, letterSpacing: "0.04em",
        }}>
          <span>{FESTIVAL_CONFIG.shortName.toUpperCase()}</span>
          {canSwitch && (
            <svg width="10" height="10" viewBox="0 0 12 12" fill="none">
              <path d="M3 4.5 L6 7.5 L9 4.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          )}
        </span>
      </div>
      {open && <FestivalSwitcher onClose={() => setOpen(false)} />}
    </>
  );
}

// Real festival art only: raster official maps. SVG plates and the one raster
// placeholder (edco-tinker-2026.jpg) are generated, so those festivals show
// their emoji on a plain surface instead.
const _GENERATED_ART = new Set(["edco-tinker-2026.jpg"]);
function _festivalArt(cfg) {
  const img = cfg && cfg.mapImage;
  return img && /\.(webp|jpe?g|png)$/i.test(img) && !_GENERATED_ART.has(img) ? img : null;
}
const _FESTIVAL_EDITORIAL_ART = Object.freeze({
  "acl-2026": "festival-art/acl-2026.webp",
  "crssd-fall-2026": "festival-art/crssd-fall-2026.webp",
  "portola-2026": "festival-art/portola-2026.webp",
  "iii-points-2026": "festival-art/iii-points-2026.webp",
  "edc-lv-2026": "festival-art/edc-lv-2026.webp",
  "countdown-nye-2026": "festival-art/countdown-nye-2026.webp",
});
function FestivalThumb({ entry, size = 56, editorial = false }) {
  // The switcher's cards are discovery surfaces, not maps. Festival map art
  // looked like a tiny screenshot and generated/no-art festivals fell back to
  // platform-dependent emoji (empty boxes on iOS/headless Chrome). Until each
  // festival has licensed editorial photography, use a deterministic film
  // gradient + wordmark. Compact list rows still use real raster art where it
  // exists because there it reads as a useful identifier, not a hero photo.
  const editorialArt = editorial && entry ? _FESTIVAL_EDITORIAL_ART[entry.config?.id] : null;
  const art = editorialArt || (!editorial && entry ? _festivalArt(entry.config) : null);
  const name = entry?.config?.shortName || entry?.config?.brand || entry?.config?.name || "Plur";
  // The brand when it is already a code (EDC, ACL, CRSSD); else the
  // initials of the name's words, the year left out.
  const brand = String(entry?.config?.brand || "").trim();
  const mark = (/^[A-Za-z0-9]{2,6}$/.test(brand) ? brand
    : String(entry?.config?.name || name).split(/\s+/).filter(w => w && !/^\d+$/.test(w)).slice(0, 3).map(x => x[0]).join("")).toUpperCase();
  // No art: the festival's initials as a board code on a well, in both
  // modes (the old pink film gradient was a Dark-only look).
  return (
    <div aria-hidden="true" style={{
      width: size, height: size, borderRadius: "var(--rad-sm)", overflow: "hidden", flexShrink: 0,
      background: "var(--s3)", display: "flex", alignItems: "center", justifyContent: "center",
      fontFamily: "var(--f-display)", fontSize: Math.max(13, Math.round(size * (editorial ? 0.16 : 0.22))), fontWeight: 400, letterSpacing: "0.12em",
      color: "var(--ink-2)",
      // lineHeight 1 keeps the wordmark fallback inside its box: the default
      // ~1.2 line box grows past the tile at 200% text and is clipped.
      lineHeight: 1,
    }}>
      {art ? <img src={`./${art}`} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : mark}
    </div>
  );
}
// Saved sets and same-day clashes for any festival, from its own saved key.
function _festivalPlanStatus(id) {
  let ids = [];
  try { ids = JSON.parse(localStorage.getItem(`${id}_saved_v1`) || "[]"); } catch {}
  if (!Array.isArray(ids) || !ids.length) return { saved: 0, conflicts: 0 };
  const set = new Set(ids);
  const arts = ((window._DATA_SETS || {})[id]?.artists || []).filter(a => set.has(a.id));
  // _DATA_SETS holds every weekend of a festival, so a W1 set and a W2 set on
  // the same day number are a week apart, never a clash ("both" plays both).
  const sameWeekend = (a, b) => !a.weekend || !b.weekend || a.weekend === "both" || b.weekend === "both" || a.weekend === b.weekend;
  let conflicts = 0;
  for (let i = 0; i < arts.length; i++)
    for (let j = i + 1; j < arts.length; j++)
      if (arts[i].day === arts[j].day && sameWeekend(arts[i], arts[j]) && typeof overlaps === "function" && overlaps(arts[i], arts[j])) conflicts++;
  return { saved: arts.length, conflicts };
}

// Plans: every festival as one grouped list, ordered by date. Now, then
// upcoming by month; past festivals fold into a Memories group that still
// expands to switchable rows. QA harnesses match the "Where are you
// raving?" heading and the config.name row labels, so keep both.
function FestivalSwitcher({ onClose }) {
  const activeId = FESTIVAL_CONFIG.id;
  const [plusOpen, setPlusOpen] = React.useState(false);
  const [pastOpen, setPastOpen] = React.useState(false);
  const [viewMode, setViewMode] = React.useState(() => {
    try { return localStorage.getItem("plursky_switcher_view_v1") || "grid"; } catch { return "grid"; }
  });
  const chooseView = mode => { setViewMode(mode); try { localStorage.setItem("plursky_switcher_view_v1", mode); } catch {} };
  const onPick = (id, entry) => {
    if (id === activeId) { onClose(); return; }
    if (entry.available) { setActiveFestivalAndReload(id); return; }
    if (entry.previewOnly && festivalCanBeActive(entry)) { setActiveFestivalAndReload(id); return; }
    // A locked early-access row sells the offer instead of closing on the
    // user (#115). Only previewOnly rows are enabled, so this is the one path.
    if (entry.previewOnly) { setPlusOpen(true); return; }
    onClose();
  };
  if (plusOpen) return <PlusSheet feature="early festival access" onClose={() => setPlusOpen(false)} />;

  // Phase order from data.jsx: live, upcoming by printed date, dates TBA,
  // ended most recent first. "Now" is an event day, not the startMs..endMs
  // envelope, so ACL between weekends and Summerfest between blocks read as
  // upcoming, and a stub with no dates lands in TBA instead of Past.
  const now = Date.now();
  const ordered = _sortFestivalsForSwitcher(FESTIVALS_REGISTRY, now);
  const phase = f => _festivalPhase(f, now);
  const live = ordered.filter(f => phase(f) === "live");
  const tba = ordered.filter(f => phase(f) === "tba");
  const past = ordered.filter(f => phase(f) === "ended");
  const months = [];
  ordered.filter(f => phase(f) === "upcoming").forEach(f => {
    // Month of the printed start date: Decadence opens Dec 30 local, which is
    // already Dec 31 in UTC, and must still file under December.
    const ev = _festivalEventDates(f.config);
    const ymd = ev ? ev.start : f.config.startMs ? new Date(f.config.startMs).toISOString().slice(0, 10) : null;
    let label = "Upcoming";
    if (ymd) { try { label = new Date(Date.UTC(+ymd.slice(0, 4), +ymd.slice(5, 7) - 1, 15)).toLocaleDateString(undefined, { month: "long", year: "numeric", timeZone: "UTC" }); } catch {} }
    let g = months.find(x => x.label === label);
    if (!g) { g = { label, fests: [] }; months.push(g); }
    g.fests.push(f);
  });
  let archive = [];
  // archiveFestival() stores an object keyed by festival id; read its values.
  try {
    const raw = JSON.parse(localStorage.getItem("plursky_festival_archive_v1") || "{}");
    archive = (Array.isArray(raw) ? raw : Object.values(raw || {})).filter(a => a && typeof a === "object");
  } catch {}
  const caught = archive.reduce((n, a) => n + (a.totalAttended || 0), 0);

  const eyebrow = { margin: "0 0 4px" };
  const rowStyle = (dim) => ({
    width: "100%", display: "flex", alignItems: "center", gap: 12, minHeight: 72, padding: "8px 0",
    background: "transparent", border: "none", borderBottom: "1px solid var(--line)",
    color: "var(--ink)", textAlign: "left", fontFamily: "inherit", opacity: dim ? 0.55 : 1,
  });
  const chevron = <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--text-3)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 6 L15 12 L9 18"/></svg>;
  const row = (f) => {
    const isActive = f.config.id === activeId;
    const locked = !f.available && !f.previewOnly && !isActive;
    const st = _festivalPlanStatus(f.config.id);
    const parts = [];
    if (st.saved) parts.push(<span key="s">{st.saved} saved</span>);
    if (st.conflicts) parts.push(<span key="c" style={{ color: "var(--clash)", fontWeight: 600 }}>{st.conflicts} {st.conflicts === 1 ? "clash" : "clashes"}</span>);
    if (isActive) parts.push(<span key="a" style={{ color: "var(--acc-ink)", fontWeight: 650 }}>Active</span>);
    else if (phase(f) === "ended") parts.push(<span key="e">Ended</span>);
    else if (!f.available) parts.push(<span key="l">{f.previewOnly ? "Early access" : "Soon"}</span>);
    // Open, lineup in, schedule still to come — say so BEFORE the switch, so
    // nobody taps in expecting a timetable and finds a list of dashes.
    else if (f.scheduleTBA) parts.push(<span key="tba">Set times TBA</span>);
    else if (st.saved && !st.conflicts) parts.push(<span key="r" style={{ color: "var(--acc-ink)", fontWeight: 650 }}>Ready</span>);
    return (
      <button key={f.config.id} onClick={() => onPick(f.config.id, f)} disabled={locked}
        aria-current={isActive ? "true" : undefined}
        style={{ ...rowStyle(locked), cursor: locked ? "default" : "pointer" }}>
        <FestivalThumb entry={f} editorial={viewMode === "grid"} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="duo-headline">{f.config.name}</div>
          <div style={{ font: "400 13px/1.385 var(--f-ui)", color: "var(--ink-2)" }}>{f.config.location} · <span style={{ overflowWrap: "normal" }}>{f.config.dates}</span></div>
          {parts.length > 0 && (
            <div style={{ marginTop: 2, font: "500 13px/1.385 var(--f-ui)", color: "var(--ink-2)" }}>
              {parts.map((x, i) => <React.Fragment key={i}>{i ? " · " : ""}{x}</React.Fragment>)}
            </div>
          )}
        </div>
        {!locked && chevron}
      </button>
    );
  };
  const group = (label, kids) => (
    <section key={label} style={{ marginTop: 16 }}>
      <h3 className="duo-sect" style={eyebrow}>{label}</h3>
      {kids}
    </section>
  );
  return (
    <FieldSheet title="Choose your sky." onClose={onClose}>
      <p style={{ margin: "-4px 0 14px", color: "var(--ink-2)", font: "400 15px/1.4 var(--f-ui)" }}>Live, next and remembered.</p>
      <div role="group" aria-label="Festival view" className="duo-seg" style={{ marginBottom: 12, background: "var(--s2)" }}>
        {["grid", "list"].map(mode => <button key={mode} onClick={() => chooseView(mode)} aria-pressed={viewMode === mode} style={{ textTransform: "capitalize" }}>{mode}</button>)}
      </div>
      <div className={viewMode === "grid" ? "midnight-festival-grid" : undefined}>
        {live.map(row)}
        {months.flatMap(g => g.fests.map(row))}
        {tba.map(row)}
      </div>
      {viewMode === "list" && <div className="duo-data-s duo-ink3" style={{ marginTop: 8 }}>ORDERED BY FESTIVAL DATE</div>}
      {(past.length > 0 || archive.length > 0) && group("Past", <>
        <button onClick={() => setPastOpen(o => !o)} aria-expanded={pastOpen} style={{ ...rowStyle(false), cursor: "pointer" }}>
          <FestivalThumb entry={past[0] || null} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 17, lineHeight: "22px", fontWeight: 600 }}>Memories</div>
            <div style={{ fontSize: 13, lineHeight: "18px", color: "var(--text-2)", fontVariantNumeric: "tabular-nums" }}>
              {Math.max(past.length, archive.length)} past {Math.max(past.length, archive.length) === 1 ? "festival" : "festivals"}{caught ? ` · ${caught} sets caught` : ""}
            </div>
          </div>
          <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--text-3)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ transform: pastOpen ? "rotate(90deg)" : "none", transition: "transform 180ms ease" }}><path d="M9 6 L15 12 L9 18"/></svg>
        </button>
        {pastOpen && <>
          {past.map(row)}
          <button onClick={() => { onClose(); (window._pushNav || (() => {}))({ tab: "recap", artist: null }); }} style={{ ...fieldIconBtn, width: "auto", padding: "0 4px", color: "var(--text-2)", fontSize: 15, fontWeight: 500 }}>Open recap</button>
        </>}
      </>)}
      {/* The public library of past editions (historical.jsx). Not a switch:
          it opens a read-only screen and never changes the active festival. */}
      <button onClick={() => { onClose(); (window._pushNav || (() => {}))({ tab: "past", pastEdition: null, artist: null }); }} style={{ ...rowStyle(false), cursor: "pointer", marginTop: 8 }}>
        <div aria-hidden="true" style={{ width: 44, height: 44, flexShrink: 0, borderRadius: 12, background: "var(--paper-3)", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--text-2)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="4" y="5" width="16" height="15" rx="2"/><path d="M4 10 H20 M8 3 V7 M16 3 V7"/></svg>
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 17, lineHeight: "22px", fontWeight: 600 }}>Past festivals</div>
          <div style={{ fontSize: 13, lineHeight: "18px", color: "var(--text-2)" }}>Official lineups and set times, archived</div>
        </div>
        {chevron}
      </button>
      <p style={{ margin: "16px 0", fontSize: 13, lineHeight: "18px", color: "var(--text-2)" }}>
        Switching reloads the app with that festival's lineup and map.
      </p>
      <FieldButton onClick={() => { onClose(); (window._pushNav || (() => {}))({ tab: "lineup", artist: null }); }}>Build plan</FieldButton>
    </FieldSheet>
  );
}

// ─────────────────────────────────────────────────────────────
// Battery-saver mode
// ─────────────────────────────────────────────────────────────
// Three modes: "off" | "on" | "auto" (default).
//   auto = (battery <25% on a non-charging device) AND
//          (we're inside the festival window — i.e. user has a saved set within 24h
//           OR right now is between FESTIVAL_START_MS and FESTIVAL_END_MS).
// Pre-event there's no point dimming the UI; the late-night clock trigger fired
// inappropriately when the user was just opening the app at 3 AM weeks before.
// When active, body.bs-on disables all keyframe animations, transitions,
// and backdrop-filter blurs, then dims via brightness/saturate. Geolocation
// (map.jsx) and the demo-wander tick read window._BS.active to throttle.
const BATTERY_SAVER_KEY = "battery_saver_mode";
const _BS = (window._BS = window._BS || {
  mode: (() => {
    try { return localStorage.getItem(BATTERY_SAVER_KEY) || "auto"; }
    catch { return "auto"; }
  })(),
  battery: null,         // { level: 0..1, charging: bool } when supported
  active: false,
  listeners: new Set(),  // (active) => void
});

function _bsHasFestivalContext() {
  // Active during the festival window itself, OR when the user has a saved set
  // starting within the next 24h. Outside that window the auto-trigger is off.
  try {
    const now = Date.now();
    const cfg = (typeof window !== "undefined" && window.FESTIVAL_CONFIG) || null;
    if (cfg && typeof cfg.startMs === "number" && typeof cfg.endMs === "number") {
      if (now >= cfg.startMs && now <= cfg.endMs) return true;
    }
    const artists = (typeof activeLineup === "function") ? activeLineup() : null;
    const dayDates = cfg && cfg.dayDates;
    if (!artists || !dayDates) return false;
    let raw = "[]";
    try {
      const fid = cfg && cfg.id;
      raw = (fid && localStorage.getItem(`${fid}_saved_v1`)) || "[]";
    } catch {}
    const saved = JSON.parse(raw);
    if (Array.isArray(saved) && saved.length) {
      const horizon = now + 24 * 3600 * 1000;
      for (const id of saved) {
        const a = artists.find(x => x.id === id);
        if (!a || !a.start) continue;
        const dm = artistDayDate(a, now) || dayDates[a.day];
        if (!dm || typeof dm.midnightUtc !== "number") continue;
        const [h, m] = String(a.start).split(":").map(Number);
        const isOvernight = h < 12;
        const startMs = dm.midnightUtc + (isOvernight ? 86400000 : 0) + (h || 0) * 3600000 + (m || 0) * 60000;
        if (startMs >= now && startMs <= horizon) return true;
      }
    }
  } catch {}
  return false;
}

function _bsCompute() {
  if (_BS.mode === "on")  return true;
  if (_BS.mode === "off") return false;
  // auto: real low-battery only, gated by festival context
  const lowBatt = _BS.battery && !_BS.battery.charging && _BS.battery.level < 0.25;
  if (!lowBatt) return false;
  return _bsHasFestivalContext();
}
function _bsApply() {
  const next = _bsCompute();
  if (next === _BS.active && document.body.classList.contains("bs-on") === next) {
    return; // idempotent fast-path
  }
  _BS.active = next;
  if (typeof document !== "undefined") {
    document.body.classList.toggle("bs-on", next);
  }
  _BS.listeners.forEach(fn => { try { fn(next); } catch {} });
}
function setBatterySaverMode(mode) {
  if (!["off", "on", "auto"].includes(mode)) return;
  _BS.mode = mode;
  try { localStorage.setItem(BATTERY_SAVER_KEY, mode); } catch {}
  _bsApply();
}

// One-time init: hook the Battery Status API when available, recompute on
// the hour for the auto night-window, and inject the CSS overrides.
if (!window._bsInited) {
  window._bsInited = true;

  (async () => {
    try {
      if (navigator.getBattery) {
        const b = await navigator.getBattery();
        const sync = () => {
          _BS.battery = { level: b.level, charging: b.charging };
          _bsApply();
        };
        b.addEventListener("levelchange", sync);
        b.addEventListener("chargingchange", sync);
        sync();
      } else {
        _bsApply();
      }
    } catch { _bsApply(); }
  })();

  // Re-evaluate the night-window every 5 min (cheap, lets auto-mode flip on
  // at 02:00 without waiting for an unrelated battery event).
  setInterval(_bsApply, 5 * 60 * 1000);

  const tag = document.createElement("style");
  tag.id = "bs-css";
  tag.textContent = `
    body.bs-on, body.bs-on * {
      animation: none !important;
      transition: none !important;
      backdrop-filter: none !important;
      -webkit-backdrop-filter: none !important;
    }
    body.bs-on .ios-frame, body.bs-on .stage {
      filter: brightness(0.72) saturate(0.85);
    }
    body.bs-on .bs-hide { display: none !important; }
  `;
  document.head.appendChild(tag);
}

function useBatterySaver() {
  const [, force] = React.useReducer(x => x + 1, 0);
  React.useEffect(() => {
    _BS.listeners.add(force);
    return () => _BS.listeners.delete(force);
  }, []);
  return {
    active:  _BS.active,
    mode:    _BS.mode,
    battery: _BS.battery,    // { level, charging } | null
    setMode: setBatterySaverMode,
  };
}

// One-shot toast that appears when auto-mode flips ON. Once the user has
// seen it for this session, we suppress until a fresh page load.
function BatterySaverToast() {
  const { active, mode, battery } = useBatterySaver();
  const [shown, setShown] = React.useState(false);
  const [dismissed, setDismissed] = React.useState(false);

  React.useEffect(() => {
    if (active && mode === "auto" && !shown && !dismissed) {
      setShown(true);
      const t = setTimeout(() => setDismissed(true), 6000);
      return () => clearTimeout(t);
    }
  }, [active, mode, shown, dismissed]);

  if (!shown || dismissed) return null;
  const reason = (battery && !battery.charging && battery.level < 0.25)
    ? `${Math.round(battery.level * 100)}% battery — dimmed for the long stretch.`
    : "Late-night mode — dimmed and animations paused.";
  return (
    <div className="bs-hide" style={{
      position: "absolute", left: 16, right: 16, top: 60, zIndex: 80,
      padding: "10px 14px", borderRadius: 14,
      background: "var(--ink)", color: "var(--on-ink)",
      display: "flex", alignItems: "center", gap: 10,
      boxShadow: "0 8px 24px rgba(var(--shade-rgb),0.35)",
    }}>
      <span style={{ fontSize: 16 }}>🔋</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div className="mono" style={{ fontSize: 9, letterSpacing: 1.4, color: "var(--on-ink-flare)", fontWeight: 700 }}>
          BATTERY SAVER ON
        </div>
        <div style={{ fontSize: 13, lineHeight: 1.35, marginTop: 2, color: "var(--on-ink-2)" }}>
          {reason}
        </div>
      </div>
      <button onClick={() => setDismissed(true)} aria-label="Dismiss" style={{
        background: "transparent", border: "none", cursor: "pointer",
        color: "var(--on-ink-3)", fontSize: 18, lineHeight: 1, padding: 4,
      }}>×</button>
    </div>
  );
}

// Settings card for MeScreen — segmented control + live battery readout.
function BatterySaverCard() {
  const { active, mode, battery, setMode } = useBatterySaver();
  const segs = [
    { id: "off",  label: "OFF" },
    { id: "auto", label: "AUTO" },
    { id: "on",   label: "ON" },
  ];
  const battPct = battery ? Math.round(battery.level * 100) : null;
  const battColor = battPct == null ? "var(--muted)"
    : battPct > 50 ? "var(--success)"
    : battPct > 20 ? "var(--flare)"
    : "var(--alert)";

  return (
    <div style={{
      padding: 14, borderRadius: 14,
      background: "var(--paper)", border: "1px solid var(--line)",
      marginBottom: 12,
    }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
        <div className="mono" style={{ fontSize: 10, letterSpacing: 1.5, color: "var(--muted)", fontWeight: 700 }}>
          BATTERY SAVER
        </div>
        <span className="mono" style={{ fontSize: 9, letterSpacing: 1.3, color: active ? "var(--success)" : "var(--muted)", fontWeight: 700 }}>
          {active ? "✓ ACTIVE" : "STANDBY"}
        </span>
      </div>
      <div className="serif" style={{ fontSize: 20, lineHeight: 1.1, marginBottom: 4 }}>
        Stretch the phone past sunrise
      </div>
      <div style={{ fontSize: 13, color: "var(--muted)", lineHeight: 1.5, marginBottom: 12 }}>
        Dims the screen, freezes animations, and slows GPS polling.
        Auto kicks in at 2 AM or when battery drops under 25%.
      </div>

      <div style={{
        display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 4,
        background: "var(--paper-2)", borderRadius: 999, padding: 3,
        border: "1px solid var(--line)",
      }}>
        {segs.map(s => {
          const on = mode === s.id;
          return (
            <button key={s.id} onClick={() => setMode(s.id)} style={{
              background: on ? "var(--ink)" : "transparent",
              color: on ? "var(--paper)" : "var(--ink)",
              border: "none", borderRadius: 999, padding: "7px 10px",
              fontFamily: "Geist Mono, monospace", fontSize: 10, letterSpacing: 1.2, fontWeight: 700,
              cursor: "pointer",
            }}>{s.label}</button>
          );
        })}
      </div>

      {battPct != null && (
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 10 }}>
          <div style={{
            position: "relative", width: 28, height: 13,
            border: "1.4px solid var(--ink)", borderRadius: 3,
          }}>
            <div style={{
              position: "absolute", top: 1, left: 1, bottom: 1,
              width: `${Math.max(0, Math.min(100, battPct)) * 0.24}px`,
              background: battColor, borderRadius: 1,
            }}/>
            <div style={{
              position: "absolute", right: -3, top: 3, bottom: 3, width: 2,
              background: "var(--ink)", borderRadius: 1,
            }}/>
          </div>
          <span className="mono" style={{ fontSize: 10, letterSpacing: 1.2, color: "var(--ink)", fontWeight: 600 }}>
            {battPct}% {battery.charging ? "· CHARGING" : ""}
          </span>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Appearance: System / Dark / Light. The policy is window.PlurskyAppearance,
// defined inline in index.html so it runs before first paint; this file only
// subscribes to it and draws the Me row. Never restate the rules here.
// On iOS the native layer (sheets, pickers, status bar) follows the resolved
// mode through the Appearance plugin when the build has it.
function _syncNativeAppearance(mode) {
  try { window.Capacitor?.Plugins?.Appearance?.setStyle?.({ style: mode }); } catch {}
}
if (!window._appearanceNativeInited && window.PlurskyAppearance) {
  window._appearanceNativeInited = true;
  _syncNativeAppearance(window.PlurskyAppearance.mode());
  window.PlurskyAppearance.onChange((m) => _syncNativeAppearance(m));
}

// Artist names are never truncated (lane ruling 2026-09-26) and one-line rows
// stay one line where they can (#236). Every [data-fit-name] inside `root`
// starts at its own size on one line; if it overflows it steps down to
// data-fit-min px, and only a name that still cannot fit wraps.
// A fit is keyed on the name and its width: an ordinary re-render (a colour
// mode switch, a fold of the header) must not re-measure a name that sits on
// the borderline, or it can land a pixel the other way and reflow the list.
function fitName(el, force) {
  const key = el.textContent + "|" + el.clientWidth;
  if (!force && el.dataset.fitKey === key) return;
  const base = parseFloat(el.dataset.fitBase || getComputedStyle(el).fontSize);
  if (!el.dataset.fitBase) el.dataset.fitBase = String(base);
  const min = parseFloat(el.dataset.fitMin || "14");
  el.style.whiteSpace = "nowrap"; el.style.fontSize = base + "px";
  // Compare the text's own width (a Range: the glyph advances) with the box's,
  // not scrollWidth, which rounds by where the box sits on the pixel grid: a
  // name within a pixel of its box fitted at 17px on one load and 16px on the
  // next. Both are rendered rects, so a transform on the row scales both.
  const rg = document.createRange(); rg.selectNodeContents(el);
  const over = () => rg.getBoundingClientRect().width > el.getBoundingClientRect().width + 0.5;
  let size = base;
  while (over() && size > min) { size -= 1; el.style.fontSize = size + "px"; }
  if (over()) el.style.whiteSpace = "normal";
  el.dataset.fitKey = el.textContent + "|" + el.clientWidth;
}
function fitNames(root, force) {
  if (!root) return;
  for (const el of root.querySelectorAll("[data-fit-name]")) fitName(el, force);
}
// `root` is a ref or a function returning the element. Fits new or resized
// names after every render and when a name's width changes (a rotation), and
// refits all of them when the list's font metrics change. A fit taken before the page settled otherwise sticks: CI's runner
// wrapped "Eptic b2b Space Laces" at 16px where it fits on one line at 17px.
function useFitNames(root) {
  const el = () => (typeof root === "function" ? root() : root && root.current);
  const ro = React.useRef(null);
  const probe = React.useRef(null);
  React.useLayoutEffect(() => {
    const r = el(); fitNames(r);
    if (!r || typeof ResizeObserver === "undefined") return;
    if (!ro.current) ro.current = new ResizeObserver((entries) => {
      for (const { target } of entries) {
        if (!target.isConnected) continue;
        if (target === probe.current) fitNames(el(), true); else fitName(target);
      }
    });
    for (const n of r.querySelectorAll("[data-fit-name]")) ro.current.observe(n);
    // Text metrics change with no render and no width change when a font
    // activates late (a system face on first use, a runner's fontconfig): a
    // name measured at 136px became 200px a second later. A hidden one-line
    // sample in the list's own font is as wide as its text, so its resize is
    // the signal to refit every name.
    if (!probe.current || !r.contains(probe.current)) {
      const p = document.createElement("span");
      p.setAttribute("aria-hidden", "true");
      p.textContent = "Eptic b2b Space Laces";
      p.style.cssText = "position:absolute;left:0;top:0;visibility:hidden;pointer-events:none;white-space:nowrap;font-size:17px;font-weight:700";
      r.appendChild(p); probe.current = p; ro.current.observe(p);
    }
  });
  React.useEffect(() => () => { ro.current && ro.current.disconnect(); if (probe.current) probe.current.remove(); }, []);
}

function useAppearance() {
  const A = window.PlurskyAppearance;
  const [, force] = React.useReducer(x => x + 1, 0);
  React.useEffect(() => (A ? A.onChange(force) : undefined), []);
  return { choice: A ? A.choice() : "system", mode: A ? A.mode() : "dark", set: (c) => A && A.set(c) };
}

// The Me row, as approved on the boards: one tap, no sub-page (Opera's and
// Cosmos's inline System/Dark/Light control on Mobbin).
function AppearanceRow() {
  const { choice, set } = useAppearance();
  const opts = [["system", "System"], ["dark", "Dark"], ["light", "Light"]];
  return (
    <div data-appearance-row style={{
      display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12,
      flexWrap: "wrap",   // 320px: the selector drops under the label, never off-screen
      padding: "8px 8px 8px 16px", borderRadius: 14, marginBottom: 12,
      background: "var(--paper-2)", border: "1px solid var(--line)",
    }}>
      <div style={{ fontSize: 15, fontWeight: 600, color: "var(--ink)" }}>Appearance</div>
      <div role="radiogroup" aria-label="Appearance" style={{
        display: "grid", gridTemplateColumns: "repeat(3, 1fr)", padding: 3, borderRadius: 999,
        background: "var(--paper-3)", flex: "1 1 196px", maxWidth: 222,
      }}>
        {opts.map(([v, l]) => {
          const on = choice === v;
          return (
            <button key={v} role="radio" aria-checked={on} data-appearance={v} onClick={() => set(v)} style={{
              minHeight: 38, border: 0, borderRadius: 999, cursor: "pointer",
              font: "600 14px/1 var(--font-ui)",
              background: on ? "var(--paper)" : "transparent",
              color: on ? "var(--ink)" : "var(--text-2)",
              boxShadow: on ? "0 0 0 1px var(--line-2), 0 2px 6px -2px rgba(var(--shade-rgb),0.25)" : "none",
            }}>{l}</button>
          );
        })}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
function _useTickMs(intervalMs) {
  const [, force] = React.useReducer(x => x + 1, 0);
  React.useEffect(() => {
    const id = setInterval(force, intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
}

function useOnlineStatus() {
  const [online, setOnline] = React.useState(
    typeof navigator !== "undefined" ? navigator.onLine : true
  );
  React.useEffect(() => {
    const on  = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
  }, []);
  return online;
}

const _STATUS_DAYS = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];

function StatusStrip() {
  _useTickMs(30000);
  const online = useOnlineStatus();
  const { active: bsActive } = useBatterySaver();

  const now = new Date();
  const day = _STATUS_DAYS[now.getDay()];
  const hh = String(now.getHours()).padStart(2, "0");
  const mm = String(now.getMinutes()).padStart(2, "0");

  return (
    // Field Mode: quiet 12pt status in tabular figures, on the shell colour.
    <div style={{
      flexShrink: 0,
      // minHeight, not height: a fixed 24px box let a scaled clock spill out
      // of the strip and print over the screen title underneath it.
      minHeight: 24,
      display: "flex", alignItems: "center", justifyContent: "space-between",
      padding: "0 20px",
      background: "var(--paper)",
      borderBottom: "1px solid var(--line)",
      // Unitless so the clock's line box scales with its own type.
      fontSize: 12, lineHeight: 1.33, fontWeight: 500, fontVariantNumeric: "tabular-nums",
      color: "var(--text-2)",
    }}>
      <span>{day} · {hh}:{mm}</span>
      <span style={{ display: "flex", alignItems: "center", gap: 10 }}>
        {bsActive && (
          <span style={{ display: "inline-flex", alignItems: "center", gap: 4, color: "var(--flare)" }}>
            <svg width="9" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="6" y="4" width="12" height="17" rx="1.5"/>
              <path d="M10 1 L14 1"/>
              <path d="M11 9 L13 9 L11 13 L14 13 L10 18"/>
            </svg>
            SAVER
          </span>
        )}
        {!online && (
          <span style={{ display: "inline-flex", alignItems: "center", gap: 4, color: "var(--alert)" }}>
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M4 4 L20 20"/>
              <path d="M2 9 Q6 5 10 5.4 M22 9 Q18 5 14 5.4"/>
              <path d="M6 13 Q12 8 18 13" opacity="0.55"/>
              <circle cx="12" cy="19" r="0.9" fill="currentColor"/>
            </svg>
            OFFLINE
          </span>
        )}
      </span>
    </div>
  );
}

// Tactile feedback. No-op on web (plugin silently skips); fires a short
// haptic bump on iOS via @capacitor/haptics. Use sparingly — every save,
// send, retag, and toggle taps this; high-frequency UI like scroll
// shouldn't. Style is one of: LIGHT / MEDIUM / HEAVY (default light).
function plurskyHaptic(style = "LIGHT") {
  try {
    const cap = window.Capacitor;
    if (!cap?.isNativePlatform?.()) return;
    const H = cap.Plugins?.Haptics;
    H?.impact?.({ style });
  } catch {}
}

// iOS keyboard avoidance — when the virtual keyboard opens on iOS,
// scroll the focused input into view so it isn't hidden. Uses the
// visualViewport API which fires reliably in WKWebView/Safari.
(function _initKbAvoidance() {
  if (typeof window === "undefined") return;
  const vv = window.visualViewport;
  if (!vv) return;
  let prev = vv.height;
  vv.addEventListener("resize", () => {
    const shrunk = vv.height < prev - 60;
    prev = vv.height;
    if (!shrunk) return;
    const el = document.activeElement;
    if (el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA")) {
      requestAnimationFrame(() => {
        el.scrollIntoView({ behavior: "smooth", block: "center" });
      });
    }
  });
})();

Object.assign(window, {
  Screen, ScrollBody, TopBar, TabBar, Pill, ArtistSwatch, Wordmark,
  useArtistPhoto, useArtistImageExpiry, getArtistImage, getShareableArtistImage, putArtistImage, putArtistImages,
  SpotifyFullLogo, SPOTIFY_IMAGE_TTL_MS,
  useInstallPrompt, InstallBanner,
  useNotifications, NotificationsCard, scheduleReminders,
  getAllAttended, getAttendedForNight, getAttendedCount, markAttended, unmarkAttended,
  isAttended, getAttendanceSource, detectCurrentArtist, recordAttendanceFromGps,
  FestivalChip, FestivalSwitcher,
  useBatterySaver, BatterySaverCard, BatterySaverToast, setBatterySaverMode,
  useAppearance, AppearanceRow, fitNames, useFitNames,
  useOnlineStatus, StatusStrip,
  plurskyHaptic,
});
