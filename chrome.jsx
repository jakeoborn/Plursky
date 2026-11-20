// Screen shell + bottom tab nav + shared atoms

function Screen({ children, bg = "var(--paper)", pad = true, ink = "var(--ink)", scope }) {
  return (
    <div data-screen={scope} style={{
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
    <div ref={fwdRef} data-scroll-body="" {...rest} style={{
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
        {sub && <div className="duo-label duo-ink3" style={{ marginBottom: 6 }}>{sub}</div>}
        {/* A real <h1>: VoiceOver's heading rotor had nothing to land on
            anywhere in Memories before this. */}
        <h1 className="duo-title" data-fit-words data-fit-min="20" style={{ margin: 0 }}>
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
  // The duo board's bar: quiet chrome, the selected tab in full ink on a
  // soft accent pill that glides between tabs (one element, moved by
  // transform, so a switch reads as motion rather than a jump). Stage colour
  // never tints it. The bar clears the iPhone home indicator.
  const idx = Math.max(0, tabs.findIndex(t => t.id === active));
  const lit = tabs.some(t => t.id === active);
  return (
    <div className="ps-tabbar" style={{
      position: "relative",
      background: "var(--chrome)",
      backdropFilter: "blur(20px) saturate(160%)",
      WebkitBackdropFilter: "blur(20px) saturate(160%)",
      borderTop: "1px solid var(--line)",
      padding: "0 10px max(10px, env(safe-area-inset-bottom, 0px))",
      display: "flex",
      justifyContent: "space-around",
    }}>
      {lit && <span aria-hidden="true" className="ps-tab-ind" style={{
        position: "absolute", top: 0, left: 10, height: 53,
        width: `calc((100% - 20px) / ${tabs.length})`,
        transform: `translateX(${idx * 100}%)`,
        transition: "transform var(--t-move) var(--ease-spring)",
        pointerEvents: "none", display: "flex", justifyContent: "center",
      }}>
        <span style={{
          marginTop: 6, width: 58, height: 30, borderRadius: 999,
          background: "var(--acc-14)", boxShadow: "inset 0 0 0 1px var(--acc-30)",
        }} />
      </span>}
      {tabs.map(t => {
        const Icon = t.icon;
        const on = active === t.id;
        return (
          <button key={t.id}
            onClick={() => {
              haptic.light();
              // Tapping the tab you are on takes its page back to the top,
              // as on iOS. It still reports the tap: Me is lit on its own
              // sub-screens (Past, Artists), where the tap leads back to Me.
              if (on) document.querySelectorAll(".ps-view [data-scroll-body]").forEach(sc => { if (sc.scrollTop > 0) sc.scrollTo({ top: 0, behavior: "smooth" }); });
              onChange(t.id);
            }}
            aria-current={on ? "page" : undefined}
            className="ps-tab"
            style={{
              position: "relative",
              background: "transparent", border: "none", cursor: "pointer",
              display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 5,
              padding: "10px 4px 4px",
              color: on ? "var(--ink)" : "var(--ink-3)",
              // Equal shares of the bar, so a label's box is known before its
              // text is: the fit below needs a width that does not depend on
              // the label it is fitting.
              flex: "1 1 0", minWidth: 0, minHeight: 53,
              transition: "color var(--t-tap) var(--ease-decay)",
            }}>
            <span className="ps-tab-icon" style={{ display: "flex", transition: "transform var(--t-move) var(--ease-spring)", transform: on ? "translateY(-1px)" : "none" }}>
              <Icon on={on} />
            </span>
            {/* The label must be able to shrink, and its line box must scale
                with it. At 200% text "Memories" ran past its own button, then
                broke inside the word ("Toda / y"); it now steps down to fit. */}
            <span data-fit-words data-fit-group="tab" data-fit-min="9" style={{
              display: "block", width: "100%",
              fontSize: 11, lineHeight: 1.17, letterSpacing: ".01em",
              fontWeight: on ? 600 : 500, textAlign: "center",
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
// Returns a ref to attach to a container. The [data-animate] children that
// are ON SCREEN when it mounts fade up in a short stagger; nothing below the
// fold is ever hidden. It used to hide every row and reveal each one from an
// IntersectionObserver as it scrolled in: on a phone the observer fires after
// the scroll paints, so rows arrived blank and popped in, and the first one
// past the fold waited ~280ms then slid up 8px (Jake, Nov 10, Lineup: "When I
// scroll down it's weird"). A row you scroll to is simply there.
function useStaggerFade(depKey, skip = false) {
  const ref = React.useRef(null);
  React.useEffect(() => {
    const el = ref.current;
    // skip: a list that opens somewhere other than its top (Lineup at the
    // current hour) shows its rows as they are; sliding rows in under a jump
    // reads as the list moving twice.
    if (!el || skip) return;
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches) return;
    const box = el.getBoundingClientRect();
    const visible = [...el.querySelectorAll("[data-animate]")].filter(t => {
      const r = t.getBoundingClientRect();
      return r.bottom > box.top && r.top < box.bottom;
    }).slice(0, 8);
    if (!visible.length) return;
    visible.forEach(t => { t.style.transition = "none"; t.style.opacity = "0"; t.style.transform = "translateY(8px)"; });
    const timers = visible.map((t, i) => setTimeout(() => {
      t.style.transition = "opacity 0.3s ease, transform 0.3s var(--ease-spring)";
      t.style.opacity = "1";
      t.style.transform = "translateY(0)";
    }, i * 40));
    return () => {
      timers.forEach(clearTimeout);
      visible.forEach(t => { t.style.transition = ""; t.style.opacity = ""; t.style.transform = ""; });
    };
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

// Reviewed self-hosted artwork wins over temporary platform images. It is
// keyed by artist key (data/artist-key.js), so "Lorde", "LORDE" and a set-tag
// billing all find the one reviewed photo. The build
// validates source, license, attribution and asset hash; localStorage cannot
// promote an arbitrary URL to permanent artwork.
function getPermanentArtistImage(name) {
  const rec = window.PLURSKY_ARTIST_PHOTOS?.[window.PlurskyArtistKey.artistKey(name || "")];
  if (!rec || !["commons", "press-kit"].includes(rec.source) ||
      !/^\.\/artist-photos\/[a-z0-9][a-z0-9_-]*\.(webp|png|jpg)$/.test(rec.url || "") ||
      !rec.author || !rec.license || !rec.sourceUrl || !rec.licenseUrl) return null;
  return rec;
}

// The entry to SHOW for an artist, or null (missing, expired, or unknown).
function getArtistImage(name, now = Date.now()) {
  if (!name) return null;
  const permanent = getPermanentArtistImage(name);
  if (permanent) return permanent;
  const rec = _artistImageRecord(_readArtistImageStore()[String(name).toLowerCase()]);
  return _artistImageShowable(rec, now) ? rec : null;
}

// The entry a share/recap EXPORT may draw: never Spotify, never unknown.
function getShareableArtistImage(name) {
  const rec = getArtistImage(name);
  return rec && rec.source !== "spotify" && rec.allowExport === true ? rec : null;
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

// Tells mounted readers (the hero, useArtistPhoto) which names were just
// written: the strip's photo queue can cache an artist after they mounted.
const ARTIST_IMAGES_WRITTEN = "plursky:artist-images-written";
// entries: [{ name, url, source, spotifyId? }]. ifAbsent: keep a showable
// entry already there.
function putArtistImages(entries, { ifAbsent = false } = {}) {
  try {
    const store = _readArtistImageStore();
    let changed = _pruneArtistImageStore(store);
    const now = Date.now();
    const written = [];
    for (const e of entries || []) {
      if (!e || !e.name || typeof e.url !== "string" || !e.url) continue;
      if (!_ARTIST_IMAGE_SOURCES.includes(e.source)) continue;
      const ln = String(e.name).toLowerCase();
      if (ifAbsent && store[ln]) continue;
      store[ln] = { url: e.url, source: e.source, fetchedAt: now };
      if (e.source === "spotify" && e.spotifyId) store[ln].spotifyId = e.spotifyId;
      written.push(ln);
      changed = true;
    }
    if (changed) localStorage.setItem(ARTIST_IMAGES_KEY, JSON.stringify(store));
    if (written.length) try { window.dispatchEvent(new CustomEvent(ARTIST_IMAGES_WRITTEN, { detail: written })); } catch {}
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

// The credit under a list of faces: Spotify's policy wants its photos
// attributed with its logo, and a 34 px face has no room for one, so a list
// that shows any Spotify photo ends with this line (the artist hero carries
// its own logo). Re-checks when a photo for one of the names is written.
function SpotifyPhotoCredit({ names }) {
  const list = (names || []).filter(Boolean);
  const has = () => list.some(n => getArtistImage(n)?.source === "spotify");
  const [show, setShow] = React.useState(has);
  const sig = list.join("|");
  React.useEffect(() => {
    setShow(has());
    const on = () => setShow(has());
    window.addEventListener(ARTIST_IMAGES_WRITTEN, on);
    window.addEventListener(ARTIST_IMAGES_EXPIRED, on);
    return () => { window.removeEventListener(ARTIST_IMAGES_WRITTEN, on); window.removeEventListener(ARTIST_IMAGES_EXPIRED, on); };
  }, [sig]);
  if (!show) return null;
  return (
    <a href="https://open.spotify.com" target="_blank" rel="noopener noreferrer" data-spotify-attribution="list"
      aria-label="Artist photos from Spotify" style={{
        display: "flex", alignItems: "center", gap: 8, padding: "14px 0 6px", color: "var(--ink-2)",
        fontSize: 12, textDecoration: "none",
      }}>
      <span>Artist photos from</span><SpotifyFullLogo height={21} />
    </a>
  );
}

// ── Artist photo cache + rate-limited Spotify fetch ──────────
// One fetch at a time, 150 ms apart — avoids Spotify 429s when
// the full lineup loads. Reads localStorage cache first (instant).
// A connected listener searches with their own token; everyone else asks
// Plursky's spotify-artist-image function, which searches with the app's own
// key (supabase/functions/spotify-artist-image). Both keep only an exact name
// match, so a near name never borrows another act's face, and both store the
// URL under the same 24 h Spotify rule.
const _photoQueue = [];
let   _photoActive = false;

const SPOTIFY_PHOTO_PROXY_URL = "https://pzoijbqsbbwyuyjinjtj.functions.supabase.co/spotify-artist-image";
// Off for the rest of the session once the function says it is not set up
// (or is not deployed), and paused after a rate limit, so a full lineup does
// not knock on a closed door a hundred times.
let _photoProxyOff = false;
let _photoProxyPausedUntil = 0;
function _photoProxyUsable() {
  // A browser test (navigator.webdriver) never reaches the live function, so
  // no real photo lands in a test's page; a test that drives the function
  // stubs it and opts in with window.__plurskyPhotoProxyInTests.
  if (typeof navigator !== "undefined" && navigator.webdriver && !window.__plurskyPhotoProxyInTests) return false;
  return !_photoProxyOff && Date.now() >= _photoProxyPausedUntil
    && (typeof navigator === "undefined" || navigator.onLine !== false);
}
function _spotifyNameKey(s) {
  return String(s || "").normalize("NFKD").replace(/[̀-ͯ]/g, "")
    .toLowerCase().replace(/&/g, " and ").replace(/[^a-z0-9]+/g, "");
}
// Spotify's first artist whose name is this act's name, accents, case and
// punctuation aside. No partial or first-result fallback.
function _spotifyExactArtist(items, name) {
  const k = _spotifyNameKey(name);
  return k ? (items || []).find(x => x && _spotifyNameKey(x.name) === k) || null : null;
}
// The proxy's answer for one name: { url, spotifyId } or null. Stores the URL
// (24 h) so every face of this act picks it up.
function _fetchProxyPhoto(name) {
  if (!_photoProxyUsable()) return Promise.resolve(null);
  return fetch(SPOTIFY_PHOTO_PROXY_URL + "?name=" + encodeURIComponent(name)).then(r => {
    if (r.status === 429) { _photoProxyPausedUntil = Date.now() + 1000 * Math.min(600, parseInt(r.headers.get("Retry-After")) || 60); return null; }
    if (r.status === 404 || r.status === 503) { _photoProxyOff = true; return null; }
    return r.ok ? r.json() : null;
  }).then(d => {
    if (!d || !d.url) return null;
    putArtistImage(name, d.url, "spotify", { spotifyId: d.spotifyId });
    return { url: d.url, spotifyId: d.spotifyId || null };
  }).catch(() => null);
}

function _drainPhotoQueue() {
  if (_photoActive || !_photoQueue.length) return;
  _photoActive = true;
  const { name, resolve } = _photoQueue.shift();
  const next = () => { _photoActive = false; setTimeout(_drainPhotoQueue, 150); };
  if (!_spotifyTokenValid()) {
    if (!_photoProxyUsable()) { _photoActive = false; resolve(null); _drainPhotoQueue(); return; }
    _fetchProxyPhoto(name).then(hit => resolve(hit ? hit.url : null)).finally(next);
    return;
  }
  fetch(
    `https://api.spotify.com/v1/search?q=${encodeURIComponent(name)}&type=artist&limit=10`,
    { headers: { Authorization: "Bearer " + localStorage.getItem("spotify_token") } }
  ).then(r => r.ok ? r.json() : null).then(d => {
    const match = _spotifyExactArtist(d?.artists?.items, name);
    const img = match?.images?.[0]?.url || null;
    if (img) putArtistImage(name, img, "spotify", { spotifyId: match.id });
    resolve(img);
  }).catch(() => resolve(null)).finally(next);
}

function _queuePhoto(name) {
  return new Promise(resolve => { _photoQueue.push({ name, resolve }); _drainPhotoQueue(); });
}

// ── Artist photo machine ─────────────────────────────────────────────────────
// One table for the swatch/strip hook and the artist hero, in useMomentMedia's
// vocabulary (spotify.jsx):
//   none        no photo asked for: no name, or no way to look one up (no
//               Spotify token, or a consumer that only looks up on mount).
//               Settled with no photo; not a recovery.
//   loading     the store is being read, or a lookup is in flight.
//   ready       a showable URL is held (ctx.url / ctx.source / ctx.rec).
//   unavailable asked and answered: nothing to show. Not retried on its own;
//               the source said it lacks the photo, so don't ask it again.
//   offline     the lookup was REJECTED (not navigator.onLine). Retries on
//               the browser's online event. The hero's search reaches it when
//               the request itself fails; a missing token is not offline, it
//               is none. The photo queue resolves null on a failed request,
//               so the swatch ends in unavailable.
//   error       the store itself threw. Leaves on RETRY or a param change.
// The machine subscribes to the cache's own events (ARTIST_IMAGES_WRITTEN for
// this name, ARTIST_IMAGES_EXPIRED); a consumer never wires them. A lookup
// result carries the request number it answers, so a late answer for an old
// name or an old request is dropped by the table, not by a closure flag.
const ARTIST_PHOTO_EVENTS = ["MOUNT", "PARAM_CHANGE", "CACHE_HIT", "CACHE_MISS", "FETCH_RESOLVE", "FETCH_MISS",
  "FETCH_REJECT", "CACHE_WRITTEN", "CACHE_EXPIRED", "RETRY", "ONLINE", "UNMOUNT"];
const _apEmpty = ctx => ({ ...ctx, url: null, source: null, rec: null });
const _apReady = (ctx, rec) => ["ready", { ...ctx, url: rec.url, source: rec.source, rec }];
// MOUNT and PARAM_CHANGE: read the store first ("read" runs synchronously).
const _apAsk = (ctx, p) => {
  const next = _apEmpty({ ...ctx, key: p.key ?? ctx.key, name: p.name ?? ctx.name, ask: "mount" });
  return next.name ? ["loading", next, "read"] : ["none", next];
};
// RETRY and ONLINE: read again. ctx.ask carries why, so canFetch can refuse a
// lookup the consumer cannot run (the hero searches on mount only) and the
// machine settles in none instead of waiting in loading for no one.
const _apReread = ask => ctx => ["loading", { ..._apEmpty(ctx), ask }, "read"];
// A write for this artist is new information in any state: show it.
const _apWritten = (ctx, p) => (p.rec ? _apReady(ctx, p.rec) : null);
const _apAnswer = kind => (ctx, p) => {
  if (p.req !== ctx.req) return null;
  if (kind === "resolve") return p.url ? ["ready", { ...ctx, url: p.url, source: p.source || "spotify", rec: null }] : ["unavailable", _apEmpty(ctx)];
  // A lookup that could not be made at all (no token) is none, not offline.
  if (kind === "offline" && p.noLookup) return ["none", _apEmpty(ctx)];
  return [kind, _apEmpty(ctx)];
};
const _apStop = () => MACHINE_STOP;
const ARTIST_PHOTO_MACHINE = createMachine({
  id: "artist-photo",
  initial: "none",
  events: ARTIST_PHOTO_EVENTS,
  states: {
    none: {
      MOUNT: _apAsk, PARAM_CHANGE: _apAsk, CACHE_HIT: null, CACHE_MISS: null,
      FETCH_RESOLVE: null, FETCH_MISS: null, FETCH_REJECT: null,
      CACHE_WRITTEN: _apWritten, CACHE_EXPIRED: null, RETRY: (ctx, p) => (ctx.name ? _apReread("retry")(ctx, p) : null), ONLINE: null, UNMOUNT: _apStop,
    },
    loading: {
      MOUNT: null, PARAM_CHANGE: _apAsk,
      CACHE_HIT: (ctx, p) => _apReady(ctx, p.rec),
      CACHE_MISS: (ctx, p) => p.error ? ["error", ctx]
        : p.canFetch ? ["loading", { ...ctx, req: ctx.req + 1 }, "fetch"] : ["none", ctx],
      FETCH_RESOLVE: _apAnswer("resolve"), FETCH_MISS: _apAnswer("unavailable"), FETCH_REJECT: _apAnswer("offline"),
      CACHE_WRITTEN: _apWritten,
      // Already asking: an expiry elsewhere changes nothing here.
      CACHE_EXPIRED: null, RETRY: null, ONLINE: null, UNMOUNT: _apStop,
    },
    ready: {
      MOUNT: null, PARAM_CHANGE: _apAsk, CACHE_HIT: null, CACHE_MISS: null,
      // A late answer to a request this state already outran (f24: the
      // queue wrote first) is dropped.
      FETCH_RESOLVE: null, FETCH_MISS: null, FETCH_REJECT: null,
      // Same artist, new entry: re-read, without re-entering loading. The held
      // URL stays if the store gives nothing showable back.
      CACHE_WRITTEN: _apWritten,
      // A Spotify URL held here expires with its entry (24 h): re-read, and
      // look the artist up again when nothing showable is left.
      CACHE_EXPIRED: (ctx, p) => p.rec ? _apReady(ctx, p.rec)
        : p.canFetch ? ["loading", { ..._apEmpty(ctx), req: ctx.req + 1 }, "fetch"] : ["none", _apEmpty(ctx)],
      RETRY: null, ONLINE: null, UNMOUNT: _apStop,
    },
    unavailable: {
      MOUNT: null, PARAM_CHANGE: _apAsk, CACHE_HIT: null, CACHE_MISS: null,
      FETCH_RESOLVE: null, FETCH_MISS: null, FETCH_REJECT: null,
      CACHE_WRITTEN: _apWritten, CACHE_EXPIRED: null, RETRY: _apReread("retry"),
      // Not a network problem: the answer was no.
      ONLINE: null, UNMOUNT: _apStop,
    },
    offline: {
      MOUNT: null, PARAM_CHANGE: _apAsk, CACHE_HIT: null, CACHE_MISS: null,
      FETCH_RESOLVE: null, FETCH_MISS: null, FETCH_REJECT: null,
      CACHE_WRITTEN: _apWritten, CACHE_EXPIRED: null, RETRY: _apReread("retry"), ONLINE: _apReread("online"), UNMOUNT: _apStop,
    },
    error: {
      MOUNT: null, PARAM_CHANGE: _apAsk, CACHE_HIT: null, CACHE_MISS: null,
      FETCH_RESOLVE: null, FETCH_MISS: null, FETCH_REJECT: null,
      CACHE_WRITTEN: _apWritten, CACHE_EXPIRED: null, RETRY: _apReread("retry"),
      // The store threw; the network coming back does not fix that.
      ONLINE: null, UNMOUNT: _apStop,
    },
  },
});

function _readArtistPhoto(name) {
  try { return { rec: getArtistImage(name) }; } catch (error) { return { rec: null, error }; }
}
// Steps the synchronous "read" effect: the store answers CACHE_HIT or
// CACHE_MISS on the spot, so the first paint for a name already has its photo.
function _settleArtistPhoto(snap, canFetch) {
  if (snap.effect !== "read") return snap;
  const { rec, error } = _readArtistPhoto(snap.ctx.name);
  return ARTIST_PHOTO_MACHINE.step(snap, rec ? "CACHE_HIT" : "CACHE_MISS",
    rec ? { rec } : { error, canFetch: !error && canFetch(snap.ctx.ask || "mount") });
}
function _spotifyTokenValid() {
  const token   = localStorage.getItem("spotify_token");
  const expires = localStorage.getItem("spotify_expires");
  return !!(token && expires && Date.now() < parseInt(expires));
}

// The machine-backed photo for one artist name. lookup(name) -> Promise of a
// URL or null runs on "fetch"; a consumer that looks the photo up itself
// passes no lookup and calls report(url | null), fail() when its request
// failed, or noLookup() when it could not make one (no token). canFetch(reason) says whether to look up at all ("mount",
// "expired", "retry", "online"). key re-asks when it changes (the hero keys
// on the act and the B2B tab, not only the name).
// Returns { url, status, retry, rec, source, report, fail, noLookup }.
function useArtistPhotoMachine(name, { key = name, lookup = null, canFetch = () => false } = {}) {
  const canFetchRef = React.useRef(canFetch);
  canFetchRef.current = canFetch;
  const can = reason => !!canFetchRef.current(reason);
  const [snap, send] = useMachine(ARTIST_PHOTO_MACHINE, key, prev => _settleArtistPhoto(
    ARTIST_PHOTO_MACHINE.step(prev || ARTIST_PHOTO_MACHINE.start({ key, name, url: null, source: null, rec: null, req: 0 }),
      prev ? "PARAM_CHANGE" : "MOUNT", { key, name }), can),
  (effect, s, send) => {
    if (effect === "read") {
      const { rec, error } = _readArtistPhoto(s.ctx.name);
      send(rec ? "CACHE_HIT" : "CACHE_MISS", rec ? { rec } : { error, canFetch: !error && can(s.ctx.ask || "mount") });
    } else if (effect === "fetch" && lookup) {
      const req = s.ctx.req;
      lookup(s.ctx.name).then(url => send(url ? "FETCH_RESOLVE" : "FETCH_MISS", { req, url, source: "spotify" }),
        () => send("FETCH_REJECT", { req }));
    }
  });
  const ln = String(name || "").toLowerCase();
  React.useEffect(() => {
    const onExpired = () => send("CACHE_EXPIRED", { rec: _readArtistPhoto(name).rec, canFetch: can("expired") });
    const onWritten = e => { if (ln && Array.isArray(e.detail) && e.detail.includes(ln)) send("CACHE_WRITTEN", { rec: _readArtistPhoto(name).rec }); };
    const onOnline = () => send("ONLINE");
    window.addEventListener(ARTIST_IMAGES_EXPIRED, onExpired);
    window.addEventListener(ARTIST_IMAGES_WRITTEN, onWritten);
    window.addEventListener("online", onOnline);
    return () => {
      window.removeEventListener(ARTIST_IMAGES_EXPIRED, onExpired);
      window.removeEventListener(ARTIST_IMAGES_WRITTEN, onWritten);
      window.removeEventListener("online", onOnline);
    };
  }, [key, send]);
  const req = snap.ctx.req;
  const report = React.useCallback(url => send(url ? "FETCH_RESOLVE" : "FETCH_MISS", { req, url, source: "spotify" }), [req, send]);
  const fail = React.useCallback(() => send("FETCH_REJECT", { req }), [req, send]);
  const noLookup = React.useCallback(() => send("FETCH_REJECT", { req, noLookup: true }), [req, send]);
  const retry = React.useCallback(() => send("RETRY"), [send]);
  return { url: snap.ctx.url, status: snap.state, retry, rec: snap.ctx.rec, source: snap.ctx.source, report, fail, noLookup };
}

// The swatch/strip photo: a URL string or null, as its four callers expect.
// Spotify (24 h rule) is the only lookup, through the photo queue: the
// listener's own token when connected, Plursky's photo function otherwise.
// With no photo the swatch keeps its gradient and initials.
function useArtistPhoto(name) {
  return useArtistPhotoMachine(name, { lookup: _queuePhoto, canFetch: () => _spotifyTokenValid() || _photoProxyUsable() }).url;
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
// Escape closes the sheet that is open. One policy for every door: the
// field sheet, the alerts drawer and the first-timer guide all call this.
function useEscapeToClose(onClose) {
  React.useEffect(() => {
    const onKey = (e) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
}

// eyebrow: a label over the title. footer: pinned under the scrolling body (actions
// that must stay whole and reachable, like the guide's quick jumps).
function FieldSheet({ title, eyebrow, footer, onClose, children }) {
  useDeclareModal(true);
  useEscapeToClose(onClose);
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
          <div style={{ minWidth: 0 }}>
            {eyebrow && <div className="duo-label duo-ink3" style={{ marginBottom: 3 }}>{eyebrow}</div>}
            <h2 style={{ margin: 0, font: "700 22px/1.25 var(--f-ui)", letterSpacing: "-0.02em" }}>{title}</h2>
          </div>
          <button onClick={onClose} aria-label="Close" style={fieldIconBtn}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M6 6 L18 18 M18 6 L6 18"/></svg>
          </button>
        </div>
        <div style={{ flex: 1, minHeight: 0, overflowY: "auto", WebkitOverflowScrolling: "touch", padding: "4px 20px 24px" }}>
          {children}
        </div>
        {footer && <div style={{ flex: "none", padding: "10px 20px 16px", borderTop: "1px solid var(--line)" }}>{footer}</div>}
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
// Billings join members with "b2b", "with" or a spaced "+" ("Allen Watts +
// Talla 2XLC"). A split member drops its project or set note ("Will Rees pres
// Parallel Worlds" is Will Rees; "Aly & Fila (Live)" is Aly & Fila) so its
// face looks up the person, not the billing. "&" stays inside one act
// ("Above & Beyond"), and an unsplit name is looked up exactly as billed.
function _duoMembers(name) {
  const parts = String(name || "").split(/\s+b\d+b\s+|\s+with\s+|\s+\+\s+/i).map(s => s.trim()).filter(Boolean);
  if (parts.length < 2) return parts;
  return parts.map(p => p.replace(/\s+pres\.?\s+.*$/i, "").replace(/\s*\([^)]*\)\s*$/, "").trim() || p);
}
// Initials from the act's name, not its billing note: "(Live)", "(Classics
// Set)" and "pres ..." are dropped, and words that start with a letter win
// over a number after the first word ("John 00 Fleming" is JF, not J0).
function _duoInitials(name) {
  const clean = String(name || "").replace(/\([^)]*\)/g, " ").replace(/\s+pres\.?\s+.*$/i, "");
  const words = clean.split(/\s+/).filter(w => /[A-Za-z0-9]/.test(w));
  const kept = words.filter((w, i) => i === 0 || /^[^A-Za-z0-9]*[A-Za-z]/.test(w));
  const pick = kept.slice(0, 2);
  return pick.map(w => w.match(/[A-Za-z0-9]/)[0].toUpperCase()).join("") || "?";
}
// The current festival's identity colour (registry accent), for initials.
function _duoFaceAccent() {
  try {
    const id = typeof FESTIVAL_CONFIG !== "undefined" && FESTIVAL_CONFIG && FESTIVAL_CONFIG.id;
    const e = id && (typeof FESTIVALS_REGISTRY !== "undefined" ? FESTIVALS_REGISTRY : []).find(f => f && f.config && f.config.id === id);
    return e && /^#[0-9a-f]{6}$/i.test(e.accent || "") ? e.accent : null;
  } catch { return null; }
}
function DuoFace({ name, size, ring = "", style, className = "" }) {
  const resolved = useArtistPhoto(name);
  const rec = getArtistImage(name);
  // A URL is not bytes: offline, a ledger portrait the SW never cached (or a
  // Spotify URL, which it never persists) fails to load. Remember the src that
  // failed and show initials for it, never a broken image (#329 review).
  const [failed, setFailed] = React.useState(null);
  const photo = resolved && resolved !== failed ? resolved : null;
  return (
    <span className={`duo-av ${ring} ${className}`.trim()} aria-hidden="true" data-face={name}
      data-photo-source={photo ? (rec?.source || "") : "initials"}
      style={{ ...(!photo && _duoFaceAccent() ? { "--face-acc": _duoFaceAccent() } : {}), ...(size ? { width: size, height: size, fontSize: Math.round(size * 0.32) } : {}), ...style }}>
      {photo ? <img src={photo} alt="" onError={() => setFailed(photo)} /> : _duoInitials(name)}
    </span>
  );
}
// A pair's layout lives in CSS (.duo-avp / .duo-avp-a / .duo-avp-b with --av as the slot):
// the board overlaps the two faces in one slot; the print sets them side by side, whole.
function DuoAvatar({ name, size = 40, ring = "" }) {
  const ms = _duoMembers(name);
  if (ms.length < 2) return <DuoFace name={name} size={size} ring={ring} />;
  return (
    <span className="duo-avp" aria-hidden="true" data-pair={name} style={{ "--av": size + "px" }}>
      <DuoFace name={ms[0]} ring={ring} className="duo-avp-a" />
      <DuoFace name={ms[1]} ring={ring} className="duo-avp-b" />
    </span>
  );
}

// LIVE is green and only ever means live.
function DuoLive({ children = "Live", className = "duo-label" }) {
  return <span className={`${className} duo-live`}><i aria-hidden="true" />{children}</span>;
}

// The board's section eyebrow: Space Grotesk caps, with an optional right slot.
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
    <div className="duo-card" style={{
      margin: "8px 16px 0",
      padding: "8px 4px 8px 12px",
      color: "var(--ink)",
      display: "flex", alignItems: "center", gap: 12,
    }}>
      <img src="./apple-touch-icon.png" alt=""
        width="36" height="36"
        style={{ borderRadius: 9, display: "block", flexShrink: 0 }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div className="duo-label duo-acc">
          Install Plursky
        </div>
        <div className="duo-body-s duo-ink2" style={{ marginTop: 3, fontWeight: 400 }}>
          {ip.isIOS
            ? <>Tap <span style={{ display: "inline-flex", verticalAlign: "middle", padding: "0 2px" }}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--ink)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 3 L12 16"/><path d="M7 8 L12 3 L17 8"/><rect x="5" y="13" width="14" height="8" rx="1.5"/>
                </svg></span> then <strong style={{ color: "var(--ink)" }}>Add to Home Screen</strong> for offline + full-screen.</>
            : <>Add to home screen for offline lineup + full-screen map.</>}
        </div>
      </div>
      {!ip.isIOS && (
        <button onClick={ip.install} className="duo-btn pri" style={{
          minHeight: 40, padding: "0 14px", fontSize: 14, flexShrink: 0,
        }}>Install</button>
      )}
      <button onClick={ip.dismiss} aria-label="Dismiss" style={{
        background: "transparent", border: "none", cursor: "pointer",
        color: "var(--ink-2)", minWidth: 44, minHeight: 44, flexShrink: 0,
        fontSize: 20, lineHeight: 1,
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
//   (a) Live GPS auto-detect — if a fix the stage fix gate trusts puts
//       the user at a measured stage while one of its artists is mid-set, we mark
//       attendance immediately. No history needed; just current GPS
//       + current time. See `detectCurrentArtist`.
//   (b) Manual review in the Memories tab — checkbox list per night
//       so the user can backfill anything we missed the next morning.

// Festival-scoped since v408. Night keys are bare day numbers ("1", "2"), so
// the old single map (plursky_attended_v1) put EDC's night-1 sets and ACL's
// night-1 sets in one bucket, and every reader that flattened it counted other
// festivals' attendance as the current one's. The store is now
// { festivalId: { night: artistId[] } }; readers default to the ACTIVE
// festival, writers to the festival that bills the artist.
//
// Legacy rows migrate by artist id: ids are unique across every data set
// (measured 2026-10-07: 2584 ids, 19 sets, 0 shared), so each row has exactly
// one owner. A row no loaded set bills goes to "_unattributed" — kept, never
// shown, never guessed onto the active festival. The v1 key is left in place.
const ATTENDED_KEY = "plursky_attended_v2";
const ATTENDED_LEGACY_KEY = "plursky_attended_v1";
const ATTENDED_UNATTRIBUTED = "_unattributed";
function _attendedDataSets() {
  try { return (typeof _DATA_SETS !== "undefined" ? _DATA_SETS : window._DATA_SETS) || {}; } catch { return {}; }
}
let _attendedOwnerIndex = null;
function _attendedOwnerOf(artistId) {
  const sets = _attendedDataSets();
  if (!_attendedOwnerIndex || _attendedOwnerIndex._n !== Object.keys(sets).length) {
    const idx = { _n: Object.keys(sets).length, map: {} };
    for (const [fid, ds] of Object.entries(sets)) {
      for (const a of ds?.artists || []) {
        // An id two sets bill has no single owner: it stays null for good.
        idx.map[a.id] = a.id in idx.map && idx.map[a.id] !== fid ? null : fid;
      }
    }
    _attendedOwnerIndex = idx;
  }
  return _attendedOwnerIndex.map[artistId] || null;
}
function _normAttendedNights(obj) {
  const out = {};
  if (!obj || typeof obj !== "object") return out;
  Object.keys(obj).forEach(k => {
    out[k] = Array.isArray(obj[k]) ? obj[k].filter(x => typeof x === "string") : [];
  });
  return out;
}
function _migrateLegacyAttended() {
  let legacy = {};
  try { legacy = JSON.parse(localStorage.getItem(ATTENDED_LEGACY_KEY) || "{}") || {}; } catch {}
  const store = {};
  for (const [night, ids] of Object.entries(_normAttendedNights(legacy))) {
    for (const id of ids) {
      const fid = _attendedOwnerOf(id) || ATTENDED_UNATTRIBUTED;
      const nights = (store[fid] = store[fid] || {});
      const list = (nights[night] = nights[night] || []);
      if (!list.includes(id)) list.push(id);
    }
  }
  // Persist only once data sets are loaded; before that every row would be
  // stranded as unattributed.
  if (Object.keys(_attendedDataSets()).length) {
    try { localStorage.setItem(ATTENDED_KEY, JSON.stringify(store)); } catch {}
  }
  return store;
}
function _readAttendedStore() {
  try {
    const raw = localStorage.getItem(ATTENDED_KEY);
    if (raw) { const s = JSON.parse(raw); if (s && typeof s === "object") return s; }
  } catch {}
  return _migrateLegacyAttended();
}
// Every festival's attendance: { festivalId: { night: artistId[] } }.
function getAttendedStore() {
  const s = _readAttendedStore(), out = {};
  Object.keys(s).forEach(fid => { out[fid] = _normAttendedNights(s[fid]); });
  return out;
}
// One festival's attendance (the active one by default): { night: artistId[] }.
function getAllAttended(festivalId) {
  const fid = festivalId || window.FESTIVAL_CONFIG?.id;
  if (!fid) return {};
  return _normAttendedNights(_readAttendedStore()[fid]);
}
function _writeAttended(map, festivalId) {
  const fid = festivalId || window.FESTIVAL_CONFIG?.id;
  if (!fid) return;
  const store = _readAttendedStore();
  store[fid] = map;
  try { localStorage.setItem(ATTENDED_KEY, JSON.stringify(store)); } catch {}
  try { window.dispatchEvent(new CustomEvent("plursky-attended-change")); } catch {}
}
function getAttendedForNight(night, festivalId) {
  return new Set(getAllAttended(festivalId)[night] || []);
}
function getAttendedCount(festivalId) {
  const all = getAllAttended(festivalId);
  return Object.values(all).reduce((s, arr) => s + (Array.isArray(arr) ? arr.length : 0), 0);
}
function markAttended(night, artistId, source = "manual") {
  if (!night || !artistId) return false;
  const fid = _attendedOwnerOf(artistId) || window.FESTIVAL_CONFIG?.id;
  const all = getAllAttended(fid);
  const list = all[night] || [];
  if (list.includes(artistId)) return false;
  all[night] = [...list, artistId];
  _writeAttended(all, fid);
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
  const fid = _attendedOwnerOf(artistId) || window.FESTIVAL_CONFIG?.id;
  const all = getAllAttended(fid);
  const list = (all[night] || []).filter(x => x !== artistId);
  if (list.length === (all[night] || []).length) return false;
  all[night] = list;
  _writeAttended(all, fid);
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

// Given one GPS fix + current festival time, return the artist the user is
// most likely watching right now — or null if none matches.
//
// "At a set" = the shared stage fix gate (data.jsx stageFixGate) trusts the
// fix for a MEASURED stage — fresh, ±100 m, within 140 m of the anchor and
// ≥35 m clearer than the runner-up, Live Set Check-in's rule — AND that stage
// has an artist whose set window contains NOW. A coarse fix, a fix with no
// accuracy, or one between two stages marks nothing. opts: { accuracy,
// timestamp, atMs, saver } from the position; saver uses the 120 s LIVE window.
function detectCurrentArtist(lat, lng, opts = {}) {
  if (typeof lat !== "number" || typeof lng !== "number") return null;
  const cfg = window.FESTIVAL_CONFIG;
  if (!cfg) return null;
  // Crowd anchors where measured (resolvedStageAnchors): kinetic's poster pin
  // sat 438 m from its crowd, so live detection was dead at the main stage.
  // Evidence only (osm / crowd): this is a geofence, and a hit auto-marks a
  // set attended with no tap. EDC Orlando 2026 ships five poster reads off
  // 2025 art (founder, 2026-10-20); a guess must not fire it.
  const anchors = attendEvidenceAnchors(cfg);
  if (anchors.length === 0) return null;
  const now = window.NOW;
  if (!now || !now.day || !now.time) return null;
  const gate = stageFixGate(anchors, { lat, lng, accuracy: opts.accuracy, timestamp: opts.timestamp },
    typeof opts.atMs === "number" ? opts.atMs : Date.now(), opts.saver ? STAGE_FIX_ATTEND_SAVER : STAGE_FIX_ATTEND);
  if (gate.status !== "trusted") return null;
  // Artist on stage at that anchor right now, by real date (isSetLive). The
  // old clock-of-day match against now.day auto-attended a set a week early.
  const playing = activeLineup().find(a => a.stage === gate.stageId && isSetLive(a));
  if (!playing) return null;
  return { artistId: playing.id, stageId: gate.stageId, night: now.day, distM: Math.round(gate.distM) };
}

// Called from the GPS effect in MapScreen on every successful sample.
// Idempotent + cheap — silently no-ops when the user is between stages,
// outside the festival, or it's not set time.
function recordAttendanceFromGps(lat, lng, opts) {
  const hit = detectCurrentArtist(lat, lng, opts);
  if (!hit) return null;
  const added = markAttended(hit.night, hit.artistId, "gps");
  return added ? hit : null;
}

// ── Set tracking (set-attendance spec PR 3): the opt-in app-level watcher ──
// While the user has turned it on, the app is open and the active festival
// is live with measured stages, a GPS watch feeds trusted fixes (the one
// stageFixGate, measured anchors only) into presence runs per stage. What is
// stored is { stageId, from, to, src } and the last fix's stage and time:
// never a coordinate, never synced, never in a backup. The verdict is not
// stored here; surfaces ask attendanceVerdict (PR 4). Default off: nothing
// watches until the user accepts the sheet in Me. Foreground only: no
// background mode, no new permission, so a locked screen pauses the count.
// The opt-in is PER FESTIVAL (SPEC-212 W3): a yes for one festival is not a
// yes for the next. v2 holds { [festivalId]: "on" | "off" }; absent = never
// asked. v1 was one global answer: on first read it moves to the festival
// active right then, and only that one, then v1 is deleted.
const SET_TRACK_PREF_KEY = "plursky_set_tracking_v2";
const SET_TRACK_PREF_V1_KEY = "plursky_set_tracking_v1";
const SET_TRACK_STORE_KEY = "plursky_set_intervals_v1";  // { [festivalId]: { last, runs } }
const SET_TRACK_EVENT = "plursky-set-tracking-change";
function _setTrackActiveId() { return (window.FESTIVAL_CONFIG && window.FESTIVAL_CONFIG.id) || null; }
function _readSetTrackPrefs() {
  let prefs = {};
  try { const p = JSON.parse(localStorage.getItem(SET_TRACK_PREF_KEY) || "{}"); if (p && typeof p === "object" && !Array.isArray(p)) prefs = p; } catch {}
  try {
    const v1 = localStorage.getItem(SET_TRACK_PREF_V1_KEY);
    const fid = _setTrackActiveId();
    if (v1 != null && fid) {
      if ((v1 === "on" || v1 === "off") && !Object.prototype.hasOwnProperty.call(prefs, fid)) prefs[fid] = v1;
      localStorage.setItem(SET_TRACK_PREF_KEY, JSON.stringify(prefs));
      localStorage.removeItem(SET_TRACK_PREF_V1_KEY);
    }
  } catch {}
  return prefs;
}
function getSetTracking(festivalId = _setTrackActiveId()) {
  if (!festivalId) return null;
  const v = _readSetTrackPrefs()[festivalId];
  return v === "on" || v === "off" ? v : null;
}
function setSetTracking(on, festivalId = _setTrackActiveId()) {
  if (!festivalId) return;
  const prefs = _readSetTrackPrefs();
  prefs[festivalId] = on ? "on" : "off";
  try { localStorage.setItem(SET_TRACK_PREF_KEY, JSON.stringify(prefs)); } catch {}
  try { window.dispatchEvent(new CustomEvent(SET_TRACK_EVENT)); } catch {}
}
function _readSetTrackStore() {
  try { const s = JSON.parse(localStorage.getItem(SET_TRACK_STORE_KEY) || "{}"); return s && typeof s === "object" ? s : {}; } catch { return {}; }
}
function setTrackRecord(festivalId, fix) {
  if (!festivalId) return false;
  const all = _readSetTrackStore();
  all[festivalId] = setTrackAppend(all[festivalId], { ms: fix && fix.ms, stageId: fix && fix.stageId });
  try { localStorage.setItem(SET_TRACK_STORE_KEY, JSON.stringify(all)); } catch { return false; }
  try { window.dispatchEvent(new CustomEvent(SET_TRACK_EVENT)); } catch {}
  return true;
}
// { [stageId]: [{ from, to, src }] }: the shape attendanceVerdict takes.
function getSetTrackIntervals(festivalId) {
  const e = _readSetTrackStore()[festivalId];
  return (e && e.runs) || {};
}
// Clear removes this festival's runs and "Still here" taps. Corrections the
// user typed stay: they are answers, not location.
function clearSetTrack(festivalId) {
  const all = _readSetTrackStore();
  const taps = _readJsonStore(SET_TAP_STORE_KEY);
  const had = festivalId in all, hadTaps = festivalId in taps;
  if (!had && !hadTaps) return false;
  delete all[festivalId]; delete taps[festivalId];
  try { localStorage.setItem(SET_TRACK_STORE_KEY, JSON.stringify(all)); } catch {}
  try { localStorage.setItem(SET_TAP_STORE_KEY, JSON.stringify(taps)); } catch {}
  try { window.dispatchEvent(new CustomEvent(SET_TRACK_EVENT)); } catch {}
  return true;
}

// ── SPEC-200 Build 2: taps, corrections, and moments as evidence ──
// Same rules as the runs above: on this phone only, a stage id and a time,
// never a coordinate, never synced, never in a backup.
const SET_TAP_STORE_KEY = "plursky_set_taps_v1";        // { [festivalId]: [{ ms, stageId }] }
const SET_MANUAL_STORE_KEY = "plursky_set_manual_v1";   // { [festivalId]: { [artistId]: "full" | "partial" | "absent" } }
const SET_MANUAL_VALUES = ["full", "partial", "absent"];
function _readJsonStore(key) {
  try { const s = JSON.parse(localStorage.getItem(key) || "{}"); return s && typeof s === "object" && !Array.isArray(s) ? s : {}; } catch { return {}; }
}
// A tap's points per stage, in the engine's point shape.
function getSetTapPoints(festivalId) {
  const out = {};
  for (const t of (_readJsonStore(SET_TAP_STORE_KEY)[festivalId] || [])) {
    if (!t || typeof t.ms !== "number" || t.stageId == null) continue;
    (out[t.stageId] = out[t.stageId] || []).push({ from: t.ms, to: t.ms, src: "photo", via: t.hand ? "hand" : "tap" });
  }
  return out;
}
function _recordSetTap(festivalId, ms, stageId, hand = false) {
  const all = _readJsonStore(SET_TAP_STORE_KEY);
  const list = Array.isArray(all[festivalId]) ? all[festivalId] : [];
  if (!list.some(t => t.ms === ms && t.stageId === stageId)) list.push(hand ? { ms, stageId, hand: true } : { ms, stageId });
  all[festivalId] = list;
  try { localStorage.setItem(SET_TAP_STORE_KEY, JSON.stringify(all)); } catch { return false; }
  try { window.dispatchEvent(new CustomEvent(SET_TRACK_EVENT)); } catch {}
  return true;
}
// Foreground only, across the await: a fix that resolves after the app was
// hidden is dropped, never stored. Every hide bumps the epoch, so a pending
// tap or calibration from before the hide can tell it was interrupted even if
// the app is visible again by the time its fix arrives. Same rule as Live
// check-in, which cancels its attempt on hide.
let _fgEpoch = 0;
try { document.addEventListener("visibilitychange", () => { if (document.visibilityState === "hidden") _fgEpoch++; }); } catch {}
const _appHidden = () => { try { return document.visibilityState === "hidden"; } catch { return false; } };
// Reads one fix while the app stays in front. { hidden: true } when the app
// was or went to the background at any point before the fix came back.
async function _foregroundFix() {
  if (_appHidden()) return { hidden: true };
  const epoch = _fgEpoch;
  const fix = typeof _checkinFix === "function" ? await _checkinFix() : null;
  if (epoch !== _fgEpoch || _appHidden()) return { hidden: true };
  return fix;
}
// "Still here": one foreground fix on the user's tap, through the one stage
// fix gate on attendance rules and measured stages only. It asks for nothing
// new: the same location permission Check-in and the map already use, read
// once, while the app is open. Returns the gate's answer either way.
async function setTrackStillHere(cfg = window.FESTIVAL_CONFIG) {
  if (setTrackEligibility(cfg, Date.now()) !== "live") return { status: "not-live" };
  const fix = await _foregroundFix();
  if (fix && fix.hidden) return { status: "hidden" };
  if (!fix) return { status: "none" };
  if (fix.denied) return { status: "denied" };
  const now = Date.now();
  const g = stageFixGate(attendEvidenceAnchors(cfg), fix, now, STAGE_FIX_ATTEND);
  if (g.status !== "trusted") return { status: g.status };
  const ms = typeof fix.timestamp === "number" ? fix.timestamp : now;
  _recordSetTap(cfg.id, ms, g.stageId);
  return { status: "trusted", stageId: g.stageId, ms };
}
// "Still here" at an art car: no fix is read (a moving stage has no position
// to match), so the tap is the user's own mark at that stage, labelled as one.
function setTrackStillHereHand(cfg, a, nowMs = Date.now()) {
  if (!cfg || !cfg.id || !a || !a.stage) return { status: "none" };
  const phase = typeof _festivalPhase === "function" ? _festivalPhase({ config: cfg }, nowMs) : "upcoming";
  if (phase !== "live") return { status: "not-live" };
  _recordSetTap(cfg.id, nowMs, a.stage, true);
  return { status: "hand", stageId: a.stage, ms: nowMs };
}
// The user's own answer for one set, or null. "absent" means "I was not there".
function getSetManual(festivalId, artistId) {
  const v = (_readJsonStore(SET_MANUAL_STORE_KEY)[festivalId] || {})[artistId];
  return SET_MANUAL_VALUES.includes(v) ? v : null;
}
// value null clears the correction, so the evidence speaks again.
function setSetManual(festivalId, artistId, value) {
  if (!festivalId || !artistId) return false;
  if (value != null && !SET_MANUAL_VALUES.includes(value)) return false;
  const all = _readJsonStore(SET_MANUAL_STORE_KEY);
  const fest = { ...(all[festivalId] || {}) };
  if (value == null) delete fest[artistId]; else fest[artistId] = value;
  all[festivalId] = fest;
  try { localStorage.setItem(SET_MANUAL_STORE_KEY, JSON.stringify(all)); } catch { return false; }
  try { window.dispatchEvent(new CustomEvent(SET_TRACK_EVENT)); } catch {}
  return true;
}
// Moments are parsed once per change of the stored string, not once per row.
let _setMomentMemo = { raw: null, fid: null, out: {} };
function _setMomentPoints(cfg) {
  let raw = null;
  try { raw = localStorage.getItem(typeof MOMENTS_KEY !== "undefined" ? MOMENTS_KEY : "plursky_moments_v1"); } catch {}
  if (_setMomentMemo.raw === raw && _setMomentMemo.fid === cfg.id) return _setMomentMemo.out;
  let moments = {};
  try { moments = JSON.parse(raw || "{}") || {}; } catch {}
  const ds = (_attendedDataSets()[cfg.id]) || {};
  const out = attendMomentPoints(moments, cfg, ds.artists || window.ARTISTS || []);
  _setMomentMemo = { raw, fid: cfg.id, out };
  return out;
}
// Every kind of evidence for a festival, in the shape attendanceVerdict takes.
function setTrackEvidence(cfg = window.FESTIVAL_CONFIG) {
  if (!cfg || !cfg.id) return {};
  return attendMergeEvidence(getSetTrackIntervals(cfg.id), getSetTapPoints(cfg.id), _setMomentPoints(cfg));
}

// ── Calibrate stages: a stage position measured on this phone ──
// For a festival whose stages have no measured position. While the festival
// is on, the user stands at a stage and taps "I'm at" it. A tap counts only
// with a fix of 30 m or better inside the venue. Two taps at the same stage at
// least 10 minutes apart that land within 30 m of each other store the stage
// at their midpoint. A position the user stood at, never a poster read. It
// stays on this phone: no sync, no backup, no other user. Clear removes it.
const SET_CALIB_STORE_KEY = "plursky_stage_calib_v1";   // { [festivalId]: { pending: { [stageId]: { ms, lat, lng } }, anchors: { [stageId]: { lat, lng, ms } } } }
const STAGE_CALIB = { maxAccM: 30, minGapMs: 10 * 60000, agreeM: 30, venuePadM: 300 };
function _readCalib(festivalId) {
  const e = _readJsonStore(SET_CALIB_STORE_KEY)[festivalId] || {};
  return { pending: (e.pending && typeof e.pending === "object") ? e.pending : {}, anchors: (e.anchors && typeof e.anchors === "object") ? e.anchors : {} };
}
function _writeCalib(festivalId, e) {
  const all = _readJsonStore(SET_CALIB_STORE_KEY);
  all[festivalId] = e;
  try { localStorage.setItem(SET_CALIB_STORE_KEY, JSON.stringify(all)); } catch { return false; }
  try { window.dispatchEvent(new CustomEvent(SET_TRACK_EVENT)); } catch {}
  return true;
}
// An art car moves, so it has no fixed position to calibrate or to match a
// fix against. Its sets take a hand "Still here" mark and a correction only
// (Jake 2026-11-15).
function _stageIsMobile(stageId, stages) {
  const st = (stages || []).find(x => x && x.id === stageId);
  return /art[- ]car/i.test(String(stageId || "")) || !!(st && /art[- ]car/i.test(st.name || ""));
}
// Stages that host a set in this festival's lineup (all stages when the
// lineup has no stage yet), minus art cars. These are the ones a calibration
// must cover.
function _calibStages(cfg) {
  const ds = (_attendedDataSets()[cfg.id]) || {};
  const active = window.FESTIVAL_CONFIG && window.FESTIVAL_CONFIG.id === cfg.id;
  const stages = ds.stages || (active ? window.STAGES : null) || [];
  const artists = ds.artists || (active ? window.ARTISTS : null) || [];
  const used = new Set(artists.map(a => a && a.stage).filter(Boolean));
  return (used.size ? stages.filter(st => used.has(st.id)) : stages).filter(st => !_stageIsMobile(st.id, stages));
}
// The calibrated stages, as anchors, for stages without a measured one. Empty
// until every stage with a set has a position (measured or calibrated).
function stageCalibrationAnchors(cfg, measuredIds = new Set()) {
  if (!cfg || !cfg.id) return [];
  const anchors = _readCalib(cfg.id).anchors;
  const need = _calibStages(cfg).map(st => st.id).filter(id => !measuredIds.has(id));
  if (!need.length || need.some(id => !anchors[id])) return [];
  return need.map(id => ({ stageId: id, lat: anchors[id].lat, lng: anchors[id].lng, anchorSource: "device" }));
}
// Is the fix inside the festival's mapped venue (with a margin)? Without a
// mapped venue, being inside the live festival window is the only check.
function _calibOnSite(cfg, fix) {
  const b = cfg && cfg.mapGeoref && cfg.mapGeoref.bounds;
  if (!Array.isArray(b) || b.length !== 4) return true;
  const padLat = STAGE_CALIB.venuePadM / 111320, padLng = STAGE_CALIB.venuePadM / (111320 * Math.cos(fix.lat * Math.PI / 180));
  return fix.lng >= b[0] - padLng && fix.lng <= b[2] + padLng && fix.lat >= b[1] - padLat && fix.lat <= b[3] + padLat;
}
// One "I'm at" tap. Pure apart from the store; the fix is passed in.
// status: not-live | none | denied | coarse | off-site | first | too-soon | moved | set
function calibrateStageTap(cfg, stageId, fix, nowMs = Date.now()) {
  if (!cfg || !cfg.id || !stageId) return { status: "none" };
  const phase = typeof _festivalPhase === "function" ? _festivalPhase({ config: cfg }, nowMs) : "upcoming";
  if (phase !== "live") return { status: "not-live" };
  if (!fix) return { status: "none" };
  if (fix.denied) return { status: "denied" };
  if (!Number.isFinite(fix.lat) || !Number.isFinite(fix.lng)) return { status: "none" };
  if (!Number.isFinite(fix.accuracy) || fix.accuracy > STAGE_CALIB.maxAccM) return { status: "coarse", accM: Number.isFinite(fix.accuracy) ? fix.accuracy : null };
  if (!_calibOnSite(cfg, fix)) return { status: "off-site" };
  const ms = typeof fix.timestamp === "number" ? fix.timestamp : nowMs;
  const e = _readCalib(cfg.id);
  const p = e.pending[stageId];
  if (p && ms - p.ms < STAGE_CALIB.minGapMs) return { status: "too-soon", waitMs: STAGE_CALIB.minGapMs - (ms - p.ms) };
  if (p && _haversineMeters(p.lat, p.lng, fix.lat, fix.lng) <= STAGE_CALIB.agreeM) {
    e.anchors[stageId] = { lat: (p.lat + fix.lat) / 2, lng: (p.lng + fix.lng) / 2, ms };
    delete e.pending[stageId];
    _writeCalib(cfg.id, e);
    return { status: "set" };
  }
  // A first tap, or a second one that landed somewhere else: start over here.
  e.pending[stageId] = { ms, lat: fix.lat, lng: fix.lng };
  _writeCalib(cfg.id, e);
  return { status: p ? "moved" : "first" };
}
async function stageCalibrateNow(cfg, stageId) {
  const fix = await _foregroundFix();
  if (fix && fix.hidden) return { status: "hidden" };
  return calibrateStageTap(cfg, stageId, fix, Date.now());
}
function clearStageCalibration(festivalId) {
  const all = _readJsonStore(SET_CALIB_STORE_KEY);
  if (!(festivalId in all)) return false;
  delete all[festivalId];
  try { localStorage.setItem(SET_CALIB_STORE_KEY, JSON.stringify(all)); } catch {}
  try { window.dispatchEvent(new CustomEvent(SET_TRACK_EVENT)); } catch {}
  return true;
}

// The one read of a tracked set (spec PR 4): attendanceVerdict over the
// stored runs, taps and moments, with its label ("Full set" / "≈ 30 of 60
// min"). Null when nothing puts you at this set's stage, or when you said you
// were not there. A correction is shown as yours, never as a sensor reading.
// Every surface asks this; none restates a threshold.
function setTrackVerdict(a, cfg = window.FESTIVAL_CONFIG) {
  if (!a || !cfg || !cfg.id) return null;
  const manual = getSetManual(cfg.id, a.id);
  if (manual === "absent") return null;
  const iv = setTrackEvidence(cfg);
  if (!manual && (!iv[a.stage] || !iv[a.stage].length)) return null;
  const v = attendanceVerdict(a, iv, cfg, manual ? { manual } : {});
  if (v.verdict === "none") return null;
  const label = attendanceVerdictLabel(v);
  return { ...v, manual, label: manual && label ? `${label} · your edit` : label };
}
// Full and part sets set tracking timed across a lineup (the recap line).
function setTrackSummary(artists, cfg = window.FESTIVAL_CONFIG) {
  const out = { full: 0, partial: 0 };
  for (const a of artists || []) {
    const v = setTrackVerdict(a, cfg);
    if (v && v.verdict === "full") out.full++;
    else if (v && v.verdict === "partial") out.partial++;
  }
  return out;
}

// Mounted once at app level. Watches only while ALL hold: the user turned it
// on, the page is visible, and the active festival is live with measured
// stages. The fix's lat/lng live only inside the callback.
function SetTrackingWatcher() {
  const [, bump] = React.useReducer(x => x + 1, 0);
  const { active: bsActive } = useBatterySaver();
  React.useEffect(() => {
    const on = () => bump();
    window.addEventListener(SET_TRACK_EVENT, on);
    document.addEventListener("visibilitychange", on);
    const t = setInterval(on, 60000);   // a festival day opening or closing
    return () => { window.removeEventListener(SET_TRACK_EVENT, on); document.removeEventListener("visibilitychange", on); clearInterval(t); };
  }, []);
  const cfg = window.FESTIVAL_CONFIG;
  const fid = cfg && cfg.id;
  const run = !!fid && getSetTracking(fid) === "on" && document.visibilityState !== "hidden"
    && setTrackEligibility(cfg, Date.now()) === "live";
  React.useEffect(() => {
    if (!run || !navigator.geolocation) return;
    const anchors = attendEvidenceAnchors(cfg);
    const rules = bsActive ? STAGE_FIX_ATTEND_SAVER : STAGE_FIX_ATTEND;
    const opts = bsActive
      ? { enableHighAccuracy: false, maximumAge: 30000, timeout: 30000 }
      : { enableHighAccuracy: true,  maximumAge: 4000,  timeout: 15000 };
    let alive = true;
    const id = navigator.geolocation.watchPosition((p) => {
      if (!alive || !p || !p.coords) return;
      const q = attendQualifyFixes([{ lat: p.coords.latitude, lng: p.coords.longitude, accuracy: p.coords.accuracy,
        timestamp: p.timestamp, atMs: Date.now() }], anchors, rules);
      if (q.length) setTrackRecord(fid, q[0]);
    }, () => {}, opts);
    return () => { alive = false; try { navigator.geolocation.clearWatch(id); } catch {} };
  }, [run, fid, bsActive]);
  return null;
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
// One wording for every reminder path (native, web, rehydrate). A split that
// moves the arrival past the published start is an arrival, not a start
// (Codex P2 on #335), as the in-app reminder already says.
function _reminderText(p) {
  const lead = p.leadMin || 15;
  return p.late
    ? { title: `${p.name}: you arrive in ${lead} min`, body: `${p.stageName} · you arrive ${fmt12(p.start)}` }
    : { title: `${p.name} starts in ${lead} min`, body: `${p.stageName} · ${fmt12(p.start)}` };
}
function scheduleReminders(state, showLocal) {
  const ln = _capLocalNotifications();
  const now = Date.now();
  const leadMin = getReminderLeadMin();
  const pending = [];

  // activeLineup, not ARTISTS: a saved W1-only act is not in the lineup the
  // user is on, so it simply does not resolve and no notification is built.
  // A push for a set nobody is playing was the failure this closes.
  const lineup = activeLineup(state.saved);

  // L5: saved sets plus the unsaved sets the user kept alerts for, one list
  // (reminderSetIds). Same lead, same ids, same cancel-and-replace slate.
  const ids = typeof reminderSetIds === "function" ? reminderSetIds(state.saved) : state.saved;
  ids.forEach(id => {
    const found = lineup.find(x => x.id === id);
    if (!found) return;
    // L3: after a split the reminder is for when you ARRIVE (the switch time),
    // not the set's published start you are deliberately skipping. A set kept
    // for alerts only is not in a split you hold: the whole set.
    const win = typeof attendWindow === "function" && state.saved.includes(id) ? attendWindow(found, undefined, state.saved) : null;
    const a = win && win.partial ? { ...found, start: win.start } : found;
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
      late: a.start !== found.start,
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
          title: _reminderText(p).title,
          body:  _reminderText(p).body,
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
  // Every entry here is a timeout handle (the native branch above returned).
  // A browser's setTimeout handle IS a number, so the old `typeof h !==
  // "number"` guard cleared nothing: an unsaved set's reminder still fired
  // until a reload (found by the L5 cancel gate).
  _SCHEDULED.forEach(h => clearTimeout(h));
  _SCHEDULED.clear();
  pending.forEach(p => {
    const handle = setTimeout(() => {
      showLocal(_reminderText(p).title, {
        body: _reminderText(p).body,
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
      const handle = setTimeout(() => {
        showLocal(_reminderText(r).title, {
          body: _reminderText(r).body,
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
        padding: "14px 16px", borderRadius: "var(--rad-md)",
        background: "var(--s2)", boxShadow: "var(--e1)", border: "none",
        marginBottom: 12,
      }}>
        <div className="duo-label" style={{ color: "var(--ink-3)", }}>
          NOTIFICATIONS · UNSUPPORTED
        </div>
        <div style={{ fontSize: 14, color: "var(--ink-2)", marginTop: 4, lineHeight: 1.43 }}>
          {window.Capacitor?.isNativePlatform?.()
            ? "Notifications aren't wired in this build yet — set-time reminders will land in a future update."
            : "Your browser doesn't support web notifications. Install Plursky to your home screen for the full experience."}
        </div>
      </div>
    );
  }

  const label = perm === "granted" ? "ENABLED" : perm === "denied" ? "BLOCKED" : "OFF";
  const labelColor = perm === "granted" ? "var(--acc-ink)" : perm === "denied" ? "var(--alert)" : "var(--ink-2)";

  return (
    <div style={{
      padding: 16, borderRadius: "var(--rad-md)",
      background: "var(--s2)", boxShadow: "var(--e1)", border: "none",
      marginBottom: 12,
    }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
        <div className="duo-label" style={{ color: "var(--ink-3)", }}>
          REMINDERS
        </div>
        <span className="duo-label" style={{ color: labelColor }}>
          {flash === "enabled" ? "✓ ENABLED" : flash === "tested" ? "✓ TEST SENT" : label}
        </span>
      </div>
      <div className="duo-headline" style={{ marginBottom: 4 }}>
        {leadMin}-min head-up before each set
      </div>
      <div style={{ fontSize: 14, color: "var(--ink-2)", lineHeight: 1.43, marginBottom: perm === "denied" ? 8 : 12 }}>
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
        <span className="duo-label" style={{ color: "var(--ink-3)", }}>
          LEAD TIME
        </span>
        <div style={{ display: "flex", gap: 5 }}>
          {_REMINDER_LEAD_OPTIONS.map(m => {
            const on = m === leadMin;
            return (
              <button key={m} onClick={() => onPickLead(m)} className="mono" style={{
                padding: "4px 9px", borderRadius: 999, cursor: "pointer",
                background: on ? "var(--s1)" : "transparent", boxShadow: on ? "var(--e1)" : "none",
                color: on ? "var(--ink)" : "var(--ink-2)",
                border: on ? "none" : "1px solid var(--line-2)",
                fontSize: 10, letterSpacing: 1.1, fontWeight: on ? 700 : 500,
              }}>{m}M</button>
            );
          })}
        </div>
      </div>
      {perm === "denied" && (
        <div style={{
          background: "var(--s3)", border: "none",
          borderRadius: "var(--rad-sm)", padding: "10px 12px", marginBottom: 12,
        }}>
          <div className="duo-label" style={{ color: "var(--ink-3)", marginBottom: 6 }}>
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

// Festival art comes from ONE door: the festival-art ledger
// (data/festival-art.js), official key art and logos only. Map art never
// reaches a tile: an official map at 56 px read as a tiny screenshot, and the
// tile is an identifier, not a map (Item 6, Oct 16 spec).
function festivalArtFor(id) {
  const rec = id && window.PLURSKY_FESTIVAL_ART?.[id];
  return rec && /^festival-art\/tiles\/[a-z0-9-]+\.webp$/.test(rec.tile || "") && rec.sourcePage ? rec : null;
}
function FestivalThumb({ entry, size = 56, editorial = false }) {
  // editorial: the switcher's grid card, the ledger's full frame when it has
  // one. Compact (list rows): the ledger's 168 px tile, cover-fit on a
  // charcoal well so light or transparent art never floats on the page.
  const rec = festivalArtFor(entry?.config?.id);
  // A festival with no full card still shows its tile in the grid, cover-fit,
  // so no grid cell ever falls back to initials while the ledger has art.
  const art = editorial ? (rec?.card || rec?.tile || null) : (rec?.tile || null);
  const name = entry?.config?.shortName || entry?.config?.brand || entry?.config?.name || "Plur";
  // The brand when it is already a code (EDC, ACL, CRSSD); else the
  // initials of the name's words, the year left out.
  const brand = String(entry?.config?.brand || "").trim();
  const mark = (/^[A-Za-z0-9]{2,6}$/.test(brand) ? brand
    : String(entry?.config?.name || name).split(/\s+/).filter(w => w && !/^\d+$/.test(w)).slice(0, 3).map(x => x[0]).join("")).toUpperCase();
  // No art: the festival's initials on a well tinted with its OWN registry
  // accent (never another palette); the letters stay ink so they read in
  // both modes.
  const accent = /^#[0-9a-f]{6}$/i.test(entry?.accent || "") ? entry.accent : null;
  return (
    <div aria-hidden="true" data-festival-thumb={entry?.config?.id || ""} data-art={art ? "ledger" : accent ? "tinted" : "plain"} style={{
      width: size, height: size, borderRadius: editorial ? "var(--rad-sm)" : 12, overflow: "hidden", flexShrink: 0,
      background: art ? "#1C1B19" : accent ? `color-mix(in srgb, ${accent} 26%, var(--s3))` : "var(--s3)",
      boxShadow: !art && accent ? `inset 0 0 0 1px color-mix(in srgb, ${accent} 45%, transparent)` : undefined,
      display: "flex", alignItems: "center", justifyContent: "center",
      fontFamily: "var(--f-display)", fontSize: Math.max(13, Math.round(size * (editorial ? 0.16 : 0.22))), fontWeight: 400, letterSpacing: "0.12em",
      color: "var(--ink)",
      // lineHeight 1 keeps the wordmark fallback inside its box: the default
      // ~1.2 line box grows past the tile at 200% text and is clipped.
      lineHeight: 1,
    }}>
      {art ? <img src={`./${art}`} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : mark}
    </div>
  );
}
// ── Photo credits (one path for every licensed photo) ──
// A Commons or press-kit photo is shown with its credit: the author linked to
// the source page, the licence linked to its deed, and what was changed.
// Artist heroes, onboarding portraits and festival art all call this, so the
// credit reads the same everywhere. Share cards export plain (no credit line).
// "CC-BY-SA-3.0" → "CC BY-SA 3.0": the ledger's SPDX-style id, as printed.
function photoLicenseLabel(id) {
  return String(id || "").replace(/^CC-/, "CC ").replace(/-(\d)/, " $1").replace(/-DE$/, " DE").replace(/^(Public|Press)-/, "$1 ");
}
const _photoCreditLink = { color: "inherit", textDecoration: "underline", textUnderlineOffset: 2 };
// credit: { author, sourceUrl, license (id), licenseUrl, changes }
function PhotoCredit({ credit, style, ...rest }) {
  if (!credit || !credit.author || !credit.sourceUrl || !credit.license || !credit.licenseUrl) return null;
  const lic = photoLicenseLabel(credit.license), changes = credit.changes || "";
  return (
    <div aria-label={"Photo credit: " + credit.author + ", " + lic + (changes ? ", " + changes.toLowerCase() : "")} {...rest} style={{
      fontSize: "var(--fs-label)", lineHeight: "16px", color: "var(--text-3)", ...style,
    }}>
      <a href={credit.sourceUrl} target="_blank" rel="noopener noreferrer" style={_photoCreditLink}>{credit.author}</a>
      {" · "}<a href={credit.licenseUrl} target="_blank" rel="noopener noreferrer" style={_photoCreditLink}>{lic}</a>
      {changes ? " · " + changes : ""}
    </div>
  );
}
// Festival art that carries a licence (the ledger's Commons photos), as credits.
function festivalPhotoCredits() {
  const art = window.PLURSKY_FESTIVAL_ART || {};
  const sets = window._DATA_SETS || {};
  // Gated previews (Sónar, Time Warp...) are in the registry but have no data set.
  const reg = window.FESTIVALS_REGISTRY || [];
  return Object.keys(art).filter(id => art[id].author && art[id].licenseId && art[id].licenseUrl).map(id => {
    const r = art[id], cfg = sets[id]?.config || reg.find(f => f.config?.id === id)?.config;
    return { id, name: cfg?.name || id, credit: { author: r.author, sourceUrl: r.sourcePage, license: r.licenseId, licenseUrl: r.licenseUrl, changes: r.changes } };
  }).sort((a, b) => a.name.localeCompare(b.name));
}
function PhotoCreditsSheet({ onClose }) {
  const rows = festivalPhotoCredits();
  return (
    <FieldSheet title="Photo credits" eyebrow="FESTIVAL PHOTOS" onClose={onClose}>
      <p style={{ margin: "-4px 0 14px", color: "var(--ink-2)", font: "400 15px/1.4 var(--f-ui)" }}>
        These festival photos are shared under open licences. Each links to its source and its licence. Each cropped CC BY-SA photo is distributed under the same linked licence.
      </p>
      <div data-photo-credits="1">
        {rows.map(r => (
          <div key={r.id} data-photo-credit-row={r.id} style={{ padding: "10px 0", borderTop: "1px solid var(--line)" }}>
            <div style={{ fontSize: 15, lineHeight: "20px", fontWeight: 600, marginBottom: 2 }}>{r.name}</div>
            <PhotoCredit credit={r.credit} />
          </div>
        ))}
      </div>
    </FieldSheet>
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
      if (arts[i].day === arts[j].day && sameWeekend(arts[i], arts[j]) && typeof setsClash === "function" && setsClash(arts[i], arts[j], id, ids)) conflicts++;
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
  const [creditsOpen, setCreditsOpen] = React.useState(false);
  // Past editions (historical.jsx): a gated entry whose earlier edition is in
  // the library opens that look-back instead of sitting disabled. It never
  // switches festival and never flips the entry.
  const pastIndex = usePastEditionIndex();
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
    const lookBack = !f.available && !f.previewOnly && !isActive ? pastEditionsOf(pastIndex, f.config.id)[0] : null;
    const locked = !f.available && !f.previewOnly && !isActive && !lookBack;
    const st = _festivalPlanStatus(f.config.id);
    const parts = [];
    if (st.saved) parts.push(<span key="s">{st.saved} saved</span>);
    if (st.conflicts) parts.push(<span key="c" style={{ color: "var(--clash)", fontWeight: 600 }}>{st.conflicts} {st.conflicts === 1 ? "clash" : "clashes"}</span>);
    if (isActive) parts.push(<span key="a" style={{ color: "var(--acc-ink)", fontWeight: 650 }}>Active</span>);
    else if (phase(f) === "ended") parts.push(<span key="e">Ended</span>);
    else if (!f.available) {
      parts.push(<span key="l">{f.previewOnly ? "Early access" : "Soon"}</span>);
      if (lookBack) parts.push(<span key="lb" style={{ color: "var(--signal-ink)", fontWeight: 600 }}>Look back: {lookBack.year}</span>);
    }
    // Open, lineup in, schedule still to come — say so BEFORE the switch, so
    // nobody taps in expecting a timetable and finds a list of dashes.
    else if (f.scheduleTBA) parts.push(<span key="tba">Set times TBA</span>);
    else if (st.saved && !st.conflicts) parts.push(<span key="r" style={{ color: "var(--acc-ink)", fontWeight: 650 }}>Ready</span>);
    return (
      <button key={f.config.id} onClick={() => lookBack ? (onClose(), openPastEdition(lookBack.id)) : onPick(f.config.id, f)} disabled={locked}
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
        {festivalPhotoCredits().length > 0 && <> <button data-photo-credits-open="1" onClick={() => setCreditsOpen(true)} style={{ background: "none", border: 0, padding: 0, font: "inherit", color: "inherit", textDecoration: "underline", textUnderlineOffset: 2, cursor: "pointer" }}>Photo credits</button></>}
      </p>
      {creditsOpen && <PhotoCreditsSheet onClose={() => setCreditsOpen(false)} />}
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
  // What the radio looks like: navigator.connection where the browser has
  // it (Chrome/Android; iOS WebKit does not), plus crew sends that had to
  // queue, which works everywhere.
  net: { effectiveType: null, saveData: false, failTs: [] },
  active: false,
  listeners: new Set(),  // (active) => void
});

// Weak signal: the browser says 2G or Data Saver, or 2 crew sends queued in
// the last 5 minutes. Offline is its own state (OFFLINE), not weak signal.
const _BS_FAIL_WINDOW_MS = 5 * 60 * 1000;
function _bsLowSignal(now = Date.now()) {
  if (typeof navigator !== "undefined" && navigator.onLine === false) return false;
  const n = _BS.net;
  if (n.saveData || n.effectiveType === "slow-2g" || n.effectiveType === "2g") return true;
  return n.failTs.filter(t => now - t < _BS_FAIL_WINDOW_MS).length >= 2;
}
// The one question for anything that talks to the network on a timer:
// battery saver on, or a weak signal, means go easy on the radio.
function plurskyNetSaver() { return !!_BS.active || _bsLowSignal(); }
// supabase.jsx reports each crew send: queued (true) or delivered (false).
function plurskyNoteNetQueued(queued) {
  const now = Date.now();
  _BS.net.failTs = queued ? [..._BS.net.failTs.filter(t => now - t < _BS_FAIL_WINDOW_MS), now] : [];
  _BS.listeners.forEach(fn => { try { fn(_BS.active); } catch {} });
}

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

  try {
    const c = navigator.connection;
    const syncNet = () => {
      _BS.net.effectiveType = (c && c.effectiveType) || null;
      _BS.net.saveData = !!(c && c.saveData);
      _BS.listeners.forEach(fn => { try { fn(_BS.active); } catch {} });
    };
    if (c) { syncNet(); c.addEventListener?.("change", syncNet); }
    window.addEventListener("online", () => { _BS.net.failTs = []; syncNet(); });
  } catch {}

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
    lowSignal: _bsLowSignal(),
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
      padding: "8px 4px 8px 16px", borderRadius: "var(--rad-md)",
      background: "var(--s1)", color: "var(--ink)",
      display: "flex", alignItems: "center", gap: 10,
      boxShadow: "var(--e2)",
    }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div className="duo-label duo-acc">
          Battery saver on
        </div>
        <div className="duo-body-s duo-ink2" style={{ marginTop: 3, fontWeight: 400 }}>
          {reason}
        </div>
      </div>
      <button onClick={() => setDismissed(true)} aria-label="Dismiss" style={{
        background: "transparent", border: "none", cursor: "pointer",
        color: "var(--ink-2)", fontSize: 20, lineHeight: 1, minWidth: 44, minHeight: 44,
      }}>×</button>
    </div>
  );
}

// Settings card for MeScreen — segmented control + live battery readout.
function BatterySaverCard() {
  const { active, mode, battery, lowSignal, setMode } = useBatterySaver();
  const segs = [
    { id: "off",  label: "Off" },
    { id: "auto", label: "Auto" },
    { id: "on",   label: "On" },
  ];
  const battPct = battery ? Math.round(battery.level * 100) : null;
  const battColor = battPct == null ? "var(--ink-2)"
    : battPct > 50 ? "var(--acc-ink)"
    : battPct > 20 ? "var(--flare)"
    : "var(--alert)";

  return (
    <div style={{
      padding: 16, borderRadius: "var(--rad-md)",
      background: "var(--s2)", boxShadow: "var(--e1)", border: "none",
      marginBottom: 12,
    }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
        <div className="duo-label" style={{ color: "var(--ink-3)", }}>
          BATTERY SAVER
        </div>
        <span className="duo-label" style={{ color: active ? "var(--acc-ink)" : "var(--ink-2)" }}>
          {active ? "✓ ACTIVE" : "STANDBY"}
        </span>
      </div>
      <div className="duo-headline" style={{ marginBottom: 4 }}>
        Stretch the phone past sunrise
      </div>
      <div style={{ fontSize: 14, color: "var(--ink-2)", lineHeight: 1.43, marginBottom: 12 }}>
        Dims the screen, freezes animations, and slows GPS polling.
        Auto kicks in under 25% battery during the festival.
      </div>
      <div data-bs-signal-note style={{ fontSize: 14, color: "var(--ink-2)", lineHeight: 1.43, marginBottom: 12 }}>
        {lowSignal ? "Weak signal now: " : "On a weak signal, "}crew location updates slow to once a minute and auto-backup waits.
      </div>

      <div style={{
        display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 4,
        background: "var(--s3)", borderRadius: 999, padding: 3,
      }}>
        {segs.map(s => {
          const on = mode === s.id;
          return (
            <button key={s.id} onClick={() => setMode(s.id)} style={{
              background: on ? "var(--s1)" : "transparent", boxShadow: on ? "var(--e1)" : "none",
              color: on ? "var(--ink)" : "var(--ink-2)",
              border: "none", borderRadius: 999, padding: "0 10px", minHeight: 36,
              fontFamily: "var(--f-ui)", fontSize: 14, fontWeight: 650,
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

// Settings card for MeScreen: the opt-in for set tracking and its off switch.
// Turning it on goes through one plain consent panel (what is recorded, what
// is not). The limit is always on screen: it counts only while Plursky is
// open, so nothing here may imply a whole night was measured.
function SetTrackingCard() {
  const [, bump] = React.useReducer(x => x + 1, 0);
  const [asking, setAsking] = React.useState(false);
  React.useEffect(() => {
    window.addEventListener(SET_TRACK_EVENT, bump);
    return () => window.removeEventListener(SET_TRACK_EVENT, bump);
  }, []);
  const cfg = window.FESTIVAL_CONFIG;
  const name = (cfg && (cfg.shortName || cfg.name)) || "this festival";
  const on = !!cfg && getSetTracking(cfg.id) === "on";
  const elig = setTrackEligibility(cfg, Date.now());
  const hasData = !!(cfg && (Object.keys(getSetTrackIntervals(cfg.id)).length || Object.keys(getSetTapPoints(cfg.id)).length));
  const canReview = !!(cfg && setReviewRows(cfg).length);
  const [reviewing, setReviewing] = React.useState(false);
  const [weekend, setWeekend] = React.useState(false);
  const btn = (primary) => ({
    background: primary ? "var(--acc)" : "var(--s3)", color: primary ? "var(--on-acc)" : "var(--ink)",
    border: "none", borderRadius: 999, padding: "0 16px", minHeight: 44,
    fontFamily: "var(--f-ui)", fontSize: 14, fontWeight: 650, cursor: "pointer",
  });
  const body = { fontSize: 14, color: "var(--ink-2)", lineHeight: 1.43, marginBottom: 12 };
  const phase = cfg && typeof _festivalPhase === "function" ? _festivalPhase({ config: cfg }, Date.now()) : "upcoming";
  const calib = cfg ? stageCalibrationStatus(cfg) : null;
  const canCalibrate = !!(calib && calib.needed && phase === "live");
  const [calibrating, setCalibrating] = React.useState(false);
  const status = elig === "no-stages" ? (canCalibrate
      ? `${name}'s stages aren't measured yet. Calibrate them on site (${calib.done} of ${calib.needed} done) and sets can be timed on this phone.`
      : `${name}'s stages aren't measured yet, so sets can't be timed here.`)
    : !on ? `Off for ${name}. Plursky can note how long you stay at a stage during a set, to tell a full set from part of one.`
    : elig === "live" ? `On for ${name}. Counting while Plursky is open. Lock the screen and the count pauses.`
    : elig === "ended" ? `On for ${name}. ${name} is over, so nothing is counting.`
    : `On for ${name}. It starts on ${name}'s festival days, and counts only while Plursky is open.`;
  return (
    <div data-set-tracking-card data-set-tracking-state={on ? "on" : "off"} data-set-tracking-elig={elig} style={{
      padding: 16, borderRadius: "var(--rad-md)",
      background: "var(--s2)", boxShadow: "var(--e1)", border: "none",
      marginBottom: 12,
    }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
        <div className="duo-label" style={{ color: "var(--ink-3)" }}>SET TRACKING</div>
        <span className="duo-label" style={{ color: on ? "var(--acc-ink)" : "var(--ink-2)" }}>{on ? "ON" : "OFF"}</span>
      </div>
      <div className="duo-headline" style={{ marginBottom: 4 }}>Time the sets you catch</div>
      <div data-set-tracking-status style={body}>{status}</div>
      {asking && !on ? (
        <div data-set-tracking-consent>
          <div style={body}>
            <b style={{ color: "var(--ink)" }}>Recorded:</b> which stage you were at and when, during sets.<br/>
            <b style={{ color: "var(--ink)" }}>Not recorded:</b> your exact location. Nothing leaves this phone.<br/>
            This is for {name} only; another festival asks again. It counts only while Plursky is open, and you can turn it off here any time.
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button data-set-tracking-accept onClick={() => { setSetTracking(true, cfg && cfg.id); setAsking(false); }} style={btn(true)}>Turn on</button>
            <button onClick={() => { setSetTracking(false, cfg && cfg.id); setAsking(false); }} style={btn(false)}>Not now</button>
          </div>
        </div>
      ) : (
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {on ? (
            <button data-set-tracking-off onClick={() => setSetTracking(false, cfg && cfg.id)} style={btn(false)}>Turn off</button>
          ) : elig !== "no-stages" && (
            <button data-set-tracking-setup onClick={() => setAsking(true)} style={btn(false)}>Set up</button>
          )}
          {canCalibrate && (
            <button data-stage-calibrate-open onClick={() => setCalibrating(true)} style={btn(false)}>Calibrate stages</button>
          )}
          {canReview && (
            <button data-set-review-open onClick={() => setReviewing(true)} style={btn(false)}>Review your sets</button>
          )}
          {canReview && yourWeekendEnabled() && (
            <button data-your-weekend-open onClick={() => setWeekend(true)} style={btn(false)}>Your weekend</button>
          )}
          {hasData && (
            <button data-set-tracking-clear onClick={() => clearSetTrack(cfg.id)} style={btn(false)}>Clear {name} times</button>
          )}
          {calib && calib.done > 0 && (
            <button data-stage-calibrate-clear onClick={() => clearStageCalibration(cfg.id)} style={btn(false)}>Clear stage calibration</button>
          )}
        </div>
      )}
      {reviewing && <SetReviewSheet cfg={cfg} onClose={() => setReviewing(false)} />}
      {weekend && <YourWeekendSheet cfg={cfg} onClose={() => setWeekend(false)} />}
      {calibrating && <StageCalibrateSheet cfg={cfg} onClose={() => setCalibrating(false)} />}
    </div>
  );
}

// How far calibration has got: stages that still need a position on this
// phone (no measured one), how many are done, and which tap is pending.
function stageCalibrationStatus(cfg) {
  if (!cfg || !cfg.id) return null;
  const measured = new Set(((typeof resolvedStageAnchors === "function") ? resolvedStageAnchors(cfg) : [])
    .filter(a => a.anchorSource === "osm" || a.anchorSource === "crowd").map(a => a.stageId));
  const e = _readCalib(cfg.id);
  const stages = _calibStages(cfg).filter(st => !measured.has(st.id));
  return {
    stages: stages.map(st => ({ id: st.id, name: st.name || st.short || st.id, done: !!e.anchors[st.id], pendingMs: e.pending[st.id] ? e.pending[st.id].ms : null })),
    needed: stages.length,
    done: stages.filter(st => e.anchors[st.id]).length,
  };
}
const _CALIB_NOTE = {
  first: "First tap noted. Tap again from the same spot in 10 minutes or more to confirm.",
  "too-soon": "Wait a little: the second tap needs 10 minutes after the first.",
  moved: "That tap landed more than 30 m from the first one, so this one counts as a new first tap.",
  set: "Stage calibrated on this phone.",
  coarse: "Location is too rough here (needs 30 m or better). Nothing was noted.",
  "off-site": "You don't seem to be at the venue, so nothing was noted.",
  denied: "Location is off for Plursky, so nothing was noted.",
  "not-live": "Calibration works only while the festival is on.",
  hidden: "You left Plursky before your location came in, so nothing was noted.",
  none: "Couldn't get a location, so nothing was noted.",
};
// The Calibrate stages sheet: one row per stage that needs a position.
function StageCalibrateSheet({ cfg = window.FESTIVAL_CONFIG, onClose }) {
  const [, bump] = React.useReducer(x => x + 1, 0);
  const [busy, setBusy] = React.useState(null);
  const [note, setNote] = React.useState(null);   // { stageId, status }
  React.useEffect(() => {
    window.addEventListener(SET_TRACK_EVENT, bump);
    return () => window.removeEventListener(SET_TRACK_EVENT, bump);
  }, []);
  const st = stageCalibrationStatus(cfg) || { stages: [], needed: 0, done: 0 };
  const tap = async (id) => {
    setBusy(id); setNote(null);
    const r = await stageCalibrateNow(cfg, id);
    setBusy(null); setNote({ stageId: id, status: r.status });
  };
  return (
    <FieldSheet title="Calibrate stages" eyebrow={(cfg.shortName || cfg.name || "").toUpperCase()} onClose={onClose}>
      <div data-stage-calibrate style={{ fontSize: 14, color: "var(--ink-2)", lineHeight: 1.43, marginBottom: 12 }}>
        Stand at a stage and tap "I'm here". Tap again from the same spot 10 minutes later to confirm. The stage's position stays on this phone and is never shared. Sets are timed once every stage below is done ({st.done} of {st.needed}).
      </div>
      {st.stages.map(s => (
        <div key={s.id} data-stage-calibrate-row={s.id} style={{ display: "flex", alignItems: "center", gap: 12, minHeight: 56, borderBottom: "1px solid var(--line)" }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 15, fontWeight: 650, overflowWrap: "anywhere" }}>{s.name}</div>
            <div data-stage-calibrate-state className="duo-data-s duo-ink3">
              {s.done ? "Calibrated" : s.pendingMs ? `First tap at ${_setClock(s.pendingMs, cfg)}` : "Not calibrated"}
            </div>
            {note && note.stageId === s.id && <div data-stage-calibrate-note role="status" style={{ fontSize: 13, color: "var(--ink-2)", marginTop: 4 }}>{_CALIB_NOTE[note.status] || _CALIB_NOTE.none}</div>}
          </div>
          <button className="duo-chip" data-stage-calibrate-tap={s.id} disabled={!!busy} onClick={() => tap(s.id)}>
            <span>{busy === s.id ? "Checking…" : s.done ? "Redo" : "I'm here"}</span>
          </button>
        </div>
      ))}
    </FieldSheet>
  );
}

// ── SPEC-200 Build 2: the correction screens ──
// Festival-local clock for an evidence time ("9:42 PM"). Times only: the why
// list never shows a place.
function _setClock(ms, cfg) {
  try {
    return new Intl.DateTimeFormat("en-US", { timeZone: (cfg && cfg.tz) || undefined, hour: "numeric", minute: "2-digit" }).format(new Date(ms));
  } catch { return ""; }
}
// The sets this user saved for a festival (the lineup's star), read-only.
function _savedSetIds(festivalId) {
  try { const v = JSON.parse(localStorage.getItem(`${festivalId}_saved_v1`) || "[]"); return Array.isArray(v) ? v : []; } catch { return []; }
}
const _SET_EVIDENCE_WORD = { gps: "Set tracking", checkin: "Check-in", photo: "Photo", tap: "Still here tap", hand: "Still here · your mark" };
// The sets worth reviewing: anything with evidence at its stage in its window,
// a correction, or a set you marked as caught. Time order.
function setReviewRows(cfg = window.FESTIVAL_CONFIG) {
  if (!cfg || !cfg.id) return [];
  const ds = (_attendedDataSets()[cfg.id]) || {};
  const artists = ds.artists || (window.FESTIVAL_CONFIG && window.FESTIVAL_CONFIG.id === cfg.id ? window.ARTISTS : []) || [];
  const iv = setTrackEvidence(cfg);
  const attended = new Set(Object.values(getAllAttended(cfg.id)).flat());
  const saved = new Set(_savedSetIds(cfg.id));
  const now = Date.now();
  const rows = [];
  for (const a of artists) {
    const manual = getSetManual(cfg.id, a.id);
    const ev = attendEvidenceList(a, iv, cfg);
    // A saved set counts here only once it is over: before that, no record
    // just means "not yet".
    const w = saved.has(a.id) && attendTimeClass(a) !== "blank" ? attendSetWindowMs(a, cfg, []) : null;
    const savedOver = !!w && w.endMs < now;
    if (!manual && !ev.length && !attended.has(a.id) && !savedOver) continue;
    rows.push({ a, manual, ev, verdict: setTrackVerdict(a, cfg) });
  }
  const key = r => (r.ev[0] && r.ev[0].from) || 0;
  const min = a => { const n = toNightMin(a.start); return Number.isFinite(n) ? n : 9999; };
  const day = a => (typeof a.day === "number" ? a.day : 99);
  return rows.sort((x, y) => day(x.a) - day(y.a) || min(x.a) - min(y.a) || key(x) - key(y) || String(x.a.id).localeCompare(String(y.a.id)));
}

// ── SPEC-200 Build 3: Your weekend (behind a flag, default off) ──
// Turned on per phone with localStorage plursky_flag_your_weekend = "on"
// until it has been field-tested. Free, like the rest of set tracking.
const YOUR_WEEKEND_FLAG_KEY = "plursky_flag_your_weekend";
function yourWeekendEnabled() {
  try { return localStorage.getItem(YOUR_WEEKEND_FLAG_KEY) === "on"; } catch { return false; }
}
// The timeline's model, pure over setReviewRows' rows: one entry per night,
// each set you caught (the engine says caught, or you answered Full / Part)
// with its evidence laid over the set's published window as shares of it,
// and your own first and last time at its stage.
// Left out: brief passes, "I wasn't there", and saved sets with nothing on
// this phone. Whether those last show as a miss is an open founder call
// (set-attendance spec, open decision 4), so nothing here marks a miss.
// Times and kinds only, never a place.
function yourWeekendNights(rows, cfg) {
  const nights = new Map();
  const tz = (cfg && cfg.tz) || undefined;
  const nightOf = ms => {
    // The 08:00 rule every surface uses: a 01:00 set belongs to the night before.
    try { return new Intl.DateTimeFormat("en-US", { timeZone: tz, weekday: "short", month: "short", day: "numeric" }).format(new Date(ms - 8 * 3600000)); } catch { return ""; }
  };
  for (const r of rows || []) {
    const { a, manual, verdict } = r || {};
    if (!a || manual === "absent") continue;
    if (!(manual === "full" || manual === "partial" || (verdict && verdict.caught))) continue;
    const ev = r.ev || [];
    const runs = ev.map(e => ({ from: e.from, to: e.to, src: e.kind === "gps" ? "gps" : "photo" }));
    const w = attendTimeClass(a) === "blank" ? null : attendSetWindowMs(a, cfg, runs);
    const marks = [];
    if (w) {
      const L = w.endMs - w.startMs;
      const share = ms => Math.min(1, Math.max(0, (ms - w.startMs) / L));
      for (const e of ev) {
        if (e.kind === "gps") {
          const l = share(e.from), rr = share(e.to);
          if (rr > l) marks.push({ kind: "run", l, w: rr - l });
        } else marks.push({ kind: "point", via: e.kind, l: share(e.from) });
      }
    }
    // Your own times at this set: the first and last moment anything on this
    // phone put you at its stage (a GPS run, a photo, a check-in, a tap),
    // inside the set's window like the track and the verdict. A run that goes
    // on past the end is the next act's, and one from before the start is the
    // last act's, so neither moves these times.
    const inSet = e => !w || (e.kind === "gps" ? Math.min(e.to, w.endMs) > Math.max(e.from, w.startMs) : e.from >= w.startMs && e.from <= w.endMs);
    const youTimes = ev.filter(e => Number.isFinite(e.from) && inSet(e)).map(e => {
      const to = Number.isFinite(e.to) && e.to > e.from ? e.to : e.from;
      return w ? [Math.max(e.from, w.startMs), Math.min(to, w.endMs)] : [e.from, to];
    });
    const you = youTimes.length ? { fromMs: Math.min(...youTimes.map(t => t[0])), toMs: Math.max(...youTimes.map(t => t[1])) } : null;
    const youText = you
      ? (you.toMs > you.fromMs ? `You: ${_setClock(you.fromMs, cfg)} to ${_setClock(you.toMs, cfg)}` : `You: ${_setClock(you.fromMs, cfg)}`)
      : "Your times: nothing on this phone";
    const dd = cfg && cfg.dayDates && cfg.dayDates[a.day];
    const label = w ? nightOf(w.startMs) : (dd && dd.short) || (a.day != null ? `Day ${a.day}` : "");
    const key = w ? `n:${label}` : `d:${a.day}`;
    if (!nights.has(key)) nights.set(key, { key, label, sortMs: Infinity, day: typeof a.day === "number" ? a.day : 99, sets: [] });
    const n = nights.get(key);
    if (w && w.startMs < n.sortMs) n.sortMs = w.startMs;
    n.sets.push({
      id: a.id, name: a.name, stage: a.stage, start: a.start || "", end: a.end || "",
      startMs: w ? w.startMs : null, mine: !!manual,
      tag: manual ? (verdict && verdict.label) || (manual === "full" ? "Full set · your edit" : "Part of it · your edit")
        : (verdict && verdict.label) || "Length unknown",
      marks, you, youText,
    });
  }
  const out = [...nights.values()];
  for (const n of out) n.sets.sort((x, y) => (x.startMs ?? Infinity) - (y.startMs ?? Infinity) || String(x.id).localeCompare(String(y.id)));
  return out.sort((x, y) => x.sortMs - y.sortMs || x.day - y.day);
}

// The timeline: a night per section, a row per caught set, and under its name
// a track the length of the set with the minutes you were there filled in.
// The track is decoration (aria-hidden); the tag says the same thing in words.
function YourWeekendSheet({ cfg = window.FESTIVAL_CONFIG, onClose }) {
  const [, bump] = React.useReducer(x => x + 1, 0);
  const [open, setOpen] = React.useState(null);
  React.useEffect(() => {
    window.addEventListener(SET_TRACK_EVENT, bump);
    return () => window.removeEventListener(SET_TRACK_EVENT, bump);
  }, []);
  const rows = setReviewRows(cfg);
  const nights = yourWeekendNights(rows, cfg);
  const stages = ((_attendedDataSets()[cfg.id] || {}).stages) || window.STAGES || [];
  if (open) {
    const a = rows.find(r => r.a.id === open)?.a;
    if (a) return <SetCorrectionSheet a={a} cfg={cfg} onClose={() => setOpen(null)} />;
  }
  const count = nights.reduce((s, n) => s + n.sets.length, 0);
  return (
    <FieldSheet title="Your weekend" eyebrow={(cfg.shortName || cfg.name || "").toUpperCase()} onClose={onClose}>
      <div data-your-weekend-summary className="duo-data-s duo-ink3" style={{ marginBottom: 12 }}>
        {count ? `${count} set${count === 1 ? "" : "s"} caught on this phone` : "No sets caught on this phone yet."}
      </div>
      {nights.map(n => (
        <section key={n.key} data-your-weekend-night={n.label} style={{ marginBottom: 16 }}>
          <div className="duo-label duo-ink3" style={{ marginBottom: 4 }}>{n.label.toUpperCase()}</div>
          {n.sets.map(s => {
            const stage = stages.find(st => st.id === s.stage);
            return (
              <button key={s.id} data-your-weekend-set={s.id} onClick={() => setOpen(s.id)} style={{
                display: "block", width: "100%", padding: "10px 0", background: "transparent", border: "none",
                borderBottom: "1px solid var(--line)", textAlign: "left", cursor: "pointer", color: "var(--ink)",
              }}>
                <div style={{ display: "flex", alignItems: "baseline", gap: 12, flexWrap: "wrap" }}>
                  <div style={{ flex: "1 1 160px", minWidth: 0, fontSize: 15, fontWeight: 650, overflowWrap: "anywhere" }}>{s.name}</div>
                  <span data-your-weekend-tag className="duo-data-s" style={{ color: s.mine ? "var(--acc-ink)" : "var(--ink)" }}>{s.tag}</span>
                </div>
                <div className="duo-data-s duo-ink3" style={{ marginBottom: 6 }}>
                  {[stage && (stage.short || stage.name), s.start && s.end ? `Set ${fmt12(s.start)} to ${fmt12(s.end)}` : "Set time not published"].filter(Boolean).join(" · ")}
                </div>
                <div data-your-weekend-you className={s.you ? "duo-data-s" : "duo-data-s duo-ink3"} style={{ marginBottom: 6, color: s.you ? "var(--ink)" : undefined }}>{s.youText}</div>
                {/* No evidence (your own answer alone) draws no track: an empty one reads as zero minutes. */}
                {s.startMs != null && s.marks.length > 0 && (
                  <div data-your-weekend-track aria-hidden="true" style={{ position: "relative", height: 8, borderRadius: 4, background: "var(--s3)" }}>
                    {s.marks.map((m, i) => m.kind === "run" ? (
                      <span key={i} data-your-weekend-run style={{ position: "absolute", top: 0, bottom: 0, left: `${(m.l * 100).toFixed(2)}%`, width: `${Math.max(1, m.w * 100).toFixed(2)}%`, borderRadius: 4, background: "var(--acc)" }} />
                    ) : (
                      <span key={i} data-your-weekend-point style={{ position: "absolute", top: -2, width: 12, height: 12, marginLeft: -6, left: `${(m.l * 100).toFixed(2)}%`, borderRadius: 6, background: "var(--acc)", boxShadow: "0 0 0 2px var(--s2)" }} />
                    ))}
                  </div>
                )}
              </button>
            );
          })}
        </section>
      ))}
    </FieldSheet>
  );
}

// One set: what the evidence says, why, and your answer. A correction wins
// over the evidence and is labelled as yours; "Use the evidence" removes it.
function SetCorrectionPanel({ a, cfg }) {
  const [, bump] = React.useReducer(x => x + 1, 0);
  React.useEffect(() => {
    window.addEventListener(SET_TRACK_EVENT, bump);
    return () => window.removeEventListener(SET_TRACK_EVENT, bump);
  }, []);
  const manual = getSetManual(cfg.id, a.id);
  const v = setTrackVerdict(a, cfg);
  const ev = attendEvidenceList(a, setTrackEvidence(cfg), cfg);
  const said = manual === "absent" ? "You said you weren't there"
    : v && v.label ? v.label
    : ev.length ? "You were there, length unknown" : "No record";
  const opt = (value, text) => {
    const on = manual === value;
    return (
      <button key={text} data-set-manual={value || "clear"} aria-pressed={on}
        onClick={() => setSetManual(cfg.id, a.id, value)} style={{
          minHeight: 44, padding: "0 14px", borderRadius: 999, cursor: "pointer",
          border: on ? "none" : "1px solid var(--line-2)",
          background: on ? "var(--acc)" : "transparent", color: on ? "var(--on-acc)" : "var(--ink)",
          fontFamily: "var(--f-ui)", fontSize: 14, fontWeight: 650,
        }}>{text}</button>
    );
  };
  return (
    <div data-set-correction={a.id}>
      <div data-set-correction-said className="duo-headline" style={{ marginBottom: 4 }}>{said}</div>
      <div className="duo-data-s duo-ink3" style={{ marginBottom: 12 }}>
        {a.start && a.end ? `${fmt12(a.start)} to ${fmt12(a.end)}` : "Set time not published"}
      </div>
      <div className="duo-label duo-ink3" style={{ marginBottom: 6 }}>WHY</div>
      {ev.length ? (
        <ul data-set-why style={{ listStyle: "none", margin: "0 0 14px", padding: 0 }}>
          {ev.map((e, i) => (
            <li key={i} style={{ fontSize: 14, color: "var(--ink-2)", lineHeight: 1.6 }}>
              {_SET_EVIDENCE_WORD[e.kind] || "Evidence"} · {_setClock(e.from, cfg)}{e.to > e.from ? ` to ${_setClock(e.to, cfg)}` : ""}
            </li>
          ))}
        </ul>
      ) : (
        <div style={{ fontSize: 14, color: "var(--ink-2)", marginBottom: 14 }}>Nothing on this phone places you at this stage during the set.</div>
      )}
      <div className="duo-label duo-ink3" style={{ marginBottom: 6 }}>YOUR ANSWER</div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        {opt("full", "Full set")}
        {opt("partial", "Part of it")}
        {opt("absent", "I wasn't there")}
        {manual && opt(null, "Use the evidence")}
      </div>
    </div>
  );
}

function SetCorrectionSheet({ a, cfg = window.FESTIVAL_CONFIG, onClose }) {
  return (
    <FieldSheet title={a.name} eyebrow="YOUR SET" onClose={onClose}>
      <SetCorrectionPanel a={a} cfg={cfg} />
    </FieldSheet>
  );
}

// Every set worth a look, one row each; a row opens its correction.
function SetReviewSheet({ cfg = window.FESTIVAL_CONFIG, onClose }) {
  const [, bump] = React.useReducer(x => x + 1, 0);
  const [open, setOpen] = React.useState(null);
  React.useEffect(() => {
    window.addEventListener(SET_TRACK_EVENT, bump);
    return () => window.removeEventListener(SET_TRACK_EVENT, bump);
  }, []);
  const rows = setReviewRows(cfg);
  const stages = ((_attendedDataSets()[cfg.id] || {}).stages) || window.STAGES || [];
  if (open) {
    const a = rows.find(r => r.a.id === open)?.a;
    if (a) return <SetCorrectionSheet a={a} cfg={cfg} onClose={() => setOpen(null)} />;
  }
  return (
    <FieldSheet title="Your sets" eyebrow={(cfg.shortName || cfg.name || "").toUpperCase()} onClose={onClose}>
      {rows.length ? rows.map(({ a, manual, verdict, ev }) => {
        const stage = stages.find(s => s.id === a.stage);
        // No evidence and no answer is "No record", never a miss: a gap in
        // what this phone saw is not proof you weren't there.
        const tag = manual === "absent" ? "Not there · your edit" : verdict && verdict.label ? verdict.label
          : ev.length ? "Length unknown" : "No record";
        return (
          <button key={a.id} data-set-review-row={a.id} onClick={() => setOpen(a.id)} style={{
            display: "flex", alignItems: "center", gap: 12, width: "100%", minHeight: 56, padding: "8px 0",
            background: "transparent", border: "none", borderBottom: "1px solid var(--line)",
            textAlign: "left", cursor: "pointer", color: "var(--ink)",
          }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 15, fontWeight: 650, overflowWrap: "anywhere" }}>{a.name}</div>
              <div className="duo-data-s duo-ink3">{[stage && (stage.short || stage.name), a.start && fmt12(a.start)].filter(Boolean).join(" · ")}</div>
            </div>
            <span data-set-review-tag className="duo-data-s" style={{
              flex: "none", padding: "2px 8px", borderRadius: 999, background: "var(--s3)",
              color: manual ? "var(--acc-ink)" : verdict && verdict.label ? "var(--ink)" : "var(--ink-3)",
              fontStyle: verdict && verdict.label || manual ? "normal" : "italic",
            }}>{tag}</span>
          </button>
        );
      }) : <div style={{ fontSize: 14, color: "var(--ink-2)" }}>No sets to review yet.</div>}
    </FieldSheet>
  );
}

// On an artist's set card: "Still here" while the set is on (one tap, one
// foreground fix), and the way into this set's correction.
function SetAttendanceRow({ a }) {
  const [, bump] = React.useReducer(x => x + 1, 0);
  const [tap, setTap] = React.useState(null);   // null | "busy" | gate status
  const [fixing, setFixing] = React.useState(false);
  React.useEffect(() => {
    window.addEventListener(SET_TRACK_EVENT, bump);
    return () => window.removeEventListener(SET_TRACK_EVENT, bump);
  }, []);
  const cfg = window.FESTIVAL_CONFIG;
  if (!a || !cfg || !cfg.id || !a.stage) return null;
  const stages = ((_attendedDataSets()[cfg.id] || {}).stages) || window.STAGES || [];
  const mobile = _stageIsMobile(a.stage, stages);
  const phase = typeof _festivalPhase === "function" ? _festivalPhase({ config: cfg }, Date.now()) : "upcoming";
  const elig = mobile ? (phase === "live" || phase === "ended" ? phase : "not-live") : setTrackEligibility(cfg, Date.now());
  if (elig !== "live" && elig !== "ended") return null;
  const live = elig === "live" && typeof isSetLive === "function" && isSetLive(a);
  const v = setTrackVerdict(a, cfg);
  const manual = getSetManual(cfg.id, a.id);
  // Asking "were you here?" before a set starts makes no sense.
  const w = attendTimeClass(a) === "blank" ? null : attendSetWindowMs(a, cfg, []);
  const started = !!w && w.startMs <= Date.now();
  if (!live && !v && !manual && !started) return null;
  const onTap = async () => {
    setTap("busy");
    const r = mobile ? setTrackStillHereHand(cfg, a) : await setTrackStillHere(cfg);
    setTap(r.status === "trusted" || r.status === "hand" ? (r.stageId === a.stage ? "here" : "other") : r.status);
  };
  const note = tap === "here" ? "Noted: you're here."
    : tap === "other" ? "Noted, at a different stage than this set."
    : tap === "denied" ? "Location is off for Plursky, so nothing was noted."
    : tap === "hidden" ? "You left Plursky before your location came in, so nothing was noted."
    : tap && tap !== "busy" ? "Couldn't place you at a stage, so nothing was noted."
    : null;
  return (
    <div data-set-attendance style={{ marginTop: 10 }}>
      {(v && v.label || manual === "absent") && (
        <div data-set-attendance-label className="duo-data-s" style={{ marginBottom: 6 }}>
          {manual === "absent" ? "Not there · your edit" : v.label}
        </div>
      )}
      <div style={{ display: "flex", columnGap: 8, flexWrap: "wrap" }}>
        {live && (
          <button className="duo-chip" data-set-still-here disabled={tap === "busy"} onClick={onTap}>
            <span>{tap === "busy" ? "Checking…" : "Still here"}</span>
          </button>
        )}
        <button className="duo-chip" data-set-fix onClick={() => setFixing(true)}><span>{v || manual ? "Fix" : "Were you here?"}</span></button>
      </div>
      {note && <div data-set-still-here-note role="status" style={{ fontSize: 13, color: "var(--ink-2)", marginTop: 6 }}>{note}</div>}
      {fixing && <SetCorrectionSheet a={a} cfg={cfg} onClose={() => setFixing(false)} />}
    </div>
  );
}


// ─────────────────────────────────────────────────────────────
// Appearance: System / Dark / Light. The policy is window.PlurskyAppearance,
// defined inline in index.html so it runs before first paint; this file only
// subscribes to it and draws the Me row. Never restate the rules here.
// On iOS the native layer (sheets, pickers, status bar) follows the resolved
// mode through the Appearance plugin when the build has it. On System it is
// handed "system", never the resolved mode: pinning the window to Dark also
// pins WebKit's prefers-color-scheme, so the page could never see the iPhone
// switch to Light again until a relaunch.
function _syncNativeAppearance(mode, choice) {
  const style = choice === "dark" || choice === "light" ? mode : "system";
  try { window.Capacitor?.Plugins?.Appearance?.setStyle?.({ style }); } catch {}
}
if (!window._appearanceNativeInited && window.PlurskyAppearance) {
  window._appearanceNativeInited = true;
  _syncNativeAppearance(window.PlurskyAppearance.mode(), window.PlurskyAppearance.choice());
  window.PlurskyAppearance.onChange((m, c) => _syncNativeAppearance(m, c));
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

// The same policy for text that may wrap (a name, a screen title, a tab
// label, a card title): it wraps BETWEEN words, never inside one. When a word
// cannot fit its box, the text steps down until it does, to data-fit-min px,
// and only a word that still cannot fit breaks. #275's QA read "Memorie / s",
// "Impor / t" and "Toda / y" at 200% text on wide fonts.
// It works from the size the text has NOW (an enlarged text size is the
// input, not something to undo). It only READS unless a word breaks, so the
// hundreds of names on a lineup cost one layout, not one each.
//
// The size is written inline with !important, the last word on that slot,
// and the element's own inline value is kept so a skip restores it exactly.
// One path only: a stylesheet rule lost to any inline !important (the 200%
// text proxy pins every element), and mixing the two left labels unfitted.
// An inline `font:` shorthand holding a var() cannot be resized at all in
// Chromium (it beats every font-size, even !important); fitWords probes one
// step and leaves such text exactly as it renders.
const _FIT_WORDS = "[data-fit-words], .duo-name";
function _fitSize(el, px) {
  if (el.dataset.fitOrig == null) el.dataset.fitOrig = (el.style.getPropertyValue("font-size") || "") + "|" + el.style.getPropertyPriority("font-size");
  if (px == null) {
    const [v, pr] = el.dataset.fitOrig.split("|");
    if (v) el.style.setProperty("font-size", v, pr); else el.style.removeProperty("font-size");
    delete el.dataset.fitOrig; delete el.dataset.fitSet; return;
  }
  el.style.setProperty("font-size", px + "px", "important");
  el.dataset.fitSet = String(px);
}
function fitWords(el) {
  // No transition while measuring. Reduced motion gives every element a
  // 0.01ms `transition: all`, and while one is in flight a new font-size is
  // neither computed nor laid out: each step measured the OLD size, so the
  // fit ran to its floor or gave up depending on timing (CI's runner: one
  // name 11px on a fresh load, 14px after a mode switch). It goes off BEFORE
  // the first read: settle() puts a name back to its real size and then fits
  // it, and a read through the transition took the previous FITTED size as
  // the real one, so "Interplanetary Criminal" (14px) stepped 13 → 12 → 13 on
  // successive settles and a mode switch kept whichever it was on.
  // ...and on every element INSIDE it: a child (a word on its own line, a
  // b2b half) inherits the new font-size through its OWN transition, so with
  // only the parent's off the child's text still measured at the old size
  // and the fit ran to its floor (Summerfest's poster word printed at 32px
  // where 53px fits, under Reduce Motion only).
  const nodes = [el, ...el.querySelectorAll("*")];
  const trs = nodes.map(n => [n.style.getPropertyValue("transition"), n.style.getPropertyPriority("transition")]);
  for (const n of nodes) n.style.setProperty("transition", "none", "important");
  const done = () => { nodes.forEach((n, i) => { if (trs[i][0]) n.style.setProperty("transition", trs[i][0], trs[i][1]); else n.style.removeProperty("transition"); }); };
  const cs = getComputedStyle(el);
  const cur = parseFloat(cs.fontSize);
  if (el.dataset.fitSet == null || Math.abs(cur - parseFloat(el.dataset.fitSet)) > 0.1) el.dataset.fitBase = String(cur);
  const base = parseFloat(el.dataset.fitBase);
  // The face is part of the key: a family swap (a fallback replaced) changes
  // every word's width without moving the box.
  const key = el.textContent + "|" + el.clientWidth + "|" + base + "|" + getComputedStyle(el).fontFamily;
  if (el.dataset.fitKey === key) { done(); return; }
  // Words split on space, hyphen, dash, slash and the middot: a break AFTER
  // "Auto-" is a hyphen doing its job, not a word broken inside itself.
  const words = [];
  const tw = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
  while (tw.nextNode()) { const n = tw.currentNode; const re = /[^\s\-‐-—\/·]+/g; let m; while ((m = re.exec(n.data))) words.push([n, m.index, m.index + m[0].length]); }
  const pad = parseFloat(cs.paddingLeft) + parseFloat(cs.paddingRight);
  // A word is broken when its letters sit on two lines (the box allows a
  // break) or when it is wider than the box (the box does not).
  const broken = () => {
    const box = el.getBoundingClientRect().width - pad + 0.5;
    return words.some(([n, a, b]) => {
      const rg = document.createRange(); rg.setStart(n, a); rg.setEnd(n, b);
      const rs = rg.getClientRects();
      return (rs.length > 1 && rs[rs.length - 1].top > rs[0].top + 1) || rg.getBoundingClientRect().width > box;
    });
  };
  const set = (px) => _fitSize(el, px);
  let size = cur;
  if (size < base) { size = base; set(size); }   // a wider box: start again from the real size
  const min = parseFloat(el.dataset.fitMin || "11");
  if (broken()) {
    el.style.overflowWrap = "normal";
    // Only a box that does not depend on its own text can be fitted. A
    // shrink-wrapped one (a flex item sized by its content, like a clash
    // card's side) narrows as the font does, so the word never fits and the
    // loop ran to the floor: CI's runner showed one name at 14px on one load
    // and 11px on the next. Such a box keeps its real size and wraps as before.
    // Probe one step first. Two kinds of text cannot be fitted, and both are
    // left exactly as they render (same answer on every load):
    //  · a size that does not take: an inline `font:` shorthand holding a
    //    var() overrides every font-size, even an !important rule;
    //  · a shrink-wrapped box (a flex item sized by its content) that narrows
    //    with its font, so the word never fits and the loop would hit the floor.
    const w0 = el.getBoundingClientRect().width;
    if (size > min) {
      set(size - 1);
      const took = Math.abs(parseFloat(getComputedStyle(el).fontSize) - (size - 1)) < 0.1;
      if (!took || el.getBoundingClientRect().width < w0 - 0.5) {
        _fitSize(el, null); el.style.overflowWrap = "";
        el.dataset.fitKey = el.textContent + "|" + el.clientWidth + "|" + base + "|" + getComputedStyle(el).fontFamily; done(); return;
      }
      size -= 1;
    }
    while (broken() && size > min) { size -= 1; set(size); }
    if (broken()) el.style.overflowWrap = "anywhere";
  }
  el.dataset.fitKey = el.textContent + "|" + el.clientWidth + "|" + base + "|" + getComputedStyle(el).fontFamily;
  done();
}
// Siblings sharing a data-fit-group (the tab labels) then all take the
// smallest fitted size, so one long label does not leave its row uneven.
function fitWordGroups(r) {
  const groups = {};
  for (const n of r.querySelectorAll("[data-fit-group]")) (groups[n.dataset.fitGroup] ||= []).push(n);
  for (const g of Object.values(groups)) {
    const size = Math.min(...g.map(n => parseFloat(getComputedStyle(n).fontSize)));
    for (const n of g) if (Math.abs(parseFloat(getComputedStyle(n).fontSize) - size) > 0.1) _fitSize(n, size);
  }
}
// One observer for the whole app, so no screen can forget to fit: new text is
// fitted as it mounts (before paint), resized boxes are refitted (a rotation,
// a larger text size), and everything is refitted when a late font face
// lands, which changes word widths without a resize.
if (typeof window !== "undefined" && !window._fitWordsInited && typeof MutationObserver !== "undefined") {
  window._fitWordsInited = true;
  const ro = typeof ResizeObserver !== "undefined"
    ? new ResizeObserver((entries) => { for (const { target } of entries) if (target.isConnected) fitWords(target); fitWordGroups(document); })
    : null;
  const fitIn = (node, all) => {
    const list = node.matches && node.matches(_FIT_WORDS) ? [node] : [];
    if (node.querySelectorAll) list.push(...node.querySelectorAll(_FIT_WORDS));
    for (const n of list) { if (all) n.dataset.fitKey = ""; fitWords(n); ro && ro.observe(n); }
  };
  // The SETTLED pass decides the final sizes. Two fitted names can share one
  // row (a clash card's two sides), so each one's room depends on the other's
  // size, and fitting them one at a time as they mount gives a result that
  // depends on the order. CI's runner fitted "Interplanetary Criminal" at
  // 11px on a Dark load and 14px on a Light one, and a mode switch kept
  // whichever it had. So: put EVERY fitted element back to its real size
  // first, then fit them all in document order. Same layout in, same sizes out,
  // whether the page was just loaded or just switched modes.
  const settle = () => {
    const all = [...document.body.querySelectorAll(_FIT_WORDS)];
    for (const n of all) {
      n.dataset.fitKey = "";
      if (n.dataset.fitSet != null && n.dataset.fitBase != null && parseFloat(n.dataset.fitSet) !== parseFloat(n.dataset.fitBase)) _fitSize(n, parseFloat(n.dataset.fitBase));
      if (n.style.overflowWrap) n.style.overflowWrap = "";
    }
    for (const n of all) { fitWords(n); ro && ro.observe(n); }
    fitWordGroups(document);
  };
  let settleTimer = null;
  const settleSoon = () => { clearTimeout(settleTimer); settleTimer = setTimeout(settle, 200); };
  const start = () => {
    fitIn(document.body); fitWordGroups(document); settleSoon();
    new MutationObserver((records) => {
      const touched = new Set();
      for (const r of records) {
        for (const n of r.addedNodes) if (n.nodeType === 1) touched.add(n);
        const host = (r.target.nodeType === 1 ? r.target : r.target.parentElement);
        const fit = host && host.closest && host.closest(_FIT_WORDS);
        if (fit) touched.add(fit);
      }
      // Fit new text at once (no flash of broken words), then settle.
      for (const n of touched) if (n.isConnected) fitIn(n);
      if (touched.size) { fitWordGroups(document); settleSoon(); }
    }).observe(document.body, { childList: true, subtree: true, characterData: true });
    try {
      if (document.fonts) {
        document.fonts.addEventListener("loadingdone", settle);
        document.fonts.ready.then(settle);
      }
    } catch {}
    // A mode switch re-renders without moving a box, so nothing above fires:
    // settle now, so the switched page matches a fresh load in that mode.
    try { window.PlurskyAppearance && window.PlurskyAppearance.onChange(() => { settle(); settleSoon(); }); } catch {}
  };
  if (document.body) start(); else document.addEventListener("DOMContentLoaded", start);
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
      padding: "8px 8px 8px 16px", borderRadius: "var(--rad-md)", marginBottom: 12,
      background: "var(--s2)", boxShadow: "var(--e1)", border: "none",
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
  const { active: bsActive, lowSignal } = useBatterySaver();

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
        {online && lowSignal && (
          <span data-status-weak-signal style={{ display: "inline-flex", alignItems: "center", gap: 4, color: "var(--flare)" }}>
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M6 13 Q12 8 18 13" opacity="0.55"/>
              <path d="M9 16 Q12 13.5 15 16"/>
              <circle cx="12" cy="19" r="0.9" fill="currentColor"/>
            </svg>
            WEAK SIGNAL
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
  useArtistPhoto, useArtistPhotoMachine, ARTIST_PHOTO_MACHINE, getArtistImage, getShareableArtistImage, putArtistImage, putArtistImages,
  SpotifyFullLogo, SpotifyPhotoCredit, SPOTIFY_IMAGE_TTL_MS, _fetchProxyPhoto, _photoProxyUsable, _spotifyExactArtist,
  useInstallPrompt, InstallBanner,
  useNotifications, NotificationsCard, scheduleReminders,
  getAllAttended, getAttendedStore, getAttendedForNight, getAttendedCount, markAttended, unmarkAttended,
  isAttended, getAttendanceSource, detectCurrentArtist, recordAttendanceFromGps,
  FestivalChip, FestivalSwitcher,
  useBatterySaver, BatterySaverCard, BatterySaverToast, setBatterySaverMode,
  useAppearance, AppearanceRow, fitNames, useFitNames, fitWords,
  useOnlineStatus, StatusStrip,
  plurskyHaptic,
});
