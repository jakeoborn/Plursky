function Screen({
  children,
  bg = "var(--paper)",
  pad = true,
  ink = "var(--ink)",
  scope
}) {
  return React.createElement("div", {
    "data-screen": scope,
    style: {
      position: "absolute",
      inset: 0,
      background: bg,
      color: ink,
      display: "flex",
      flexDirection: "column",
      overflow: "hidden"
    }
  }, children);
}
var ScrollBody = React.forwardRef(function ScrollBody({
  children,
  style,
  ...rest
}, fwdRef) {
  return React.createElement("div", {
    ref: fwdRef,
    "data-scroll-body": "",
    ...rest,
    style: {
      flex: 1,
      overflowY: "auto",
      overflowX: "hidden",
      WebkitOverflowScrolling: "touch",
      ...style
    }
  }, children);
});
function TopBar({
  title,
  right,
  sub,
  tight
}) {
  return React.createElement("div", {
    style: {
      padding: tight ? "6px 20px 10px" : "10px 20px 14px",
      display: "flex",
      alignItems: "flex-end",
      justifyContent: "space-between",
      gap: 12
    }
  }, React.createElement("div", {
    style: {
      minWidth: 0,
      overflowWrap: "anywhere"
    }
  }, sub && React.createElement("div", {
    className: "duo-label duo-ink3",
    style: {
      marginBottom: 6
    }
  }, sub), React.createElement("h1", {
    className: "duo-title",
    "data-fit-words": true,
    "data-fit-min": "20",
    style: {
      margin: 0
    }
  }, title)), right);
}
function TabBar({
  active,
  onChange
}) {
  var isPostFestival = (() => {
    try {
      return Date.now() > (window.FESTIVAL_CONFIG?.endMs || Infinity);
    } catch {
      return false;
    }
  })();
  var tabs = isPostFestival ? [{
    id: "home",
    label: "Today",
    icon: HomeIcon
  }, {
    id: "lineup",
    label: "Lineup",
    icon: LineupIcon
  }, {
    id: "memories",
    label: "Memories",
    icon: MemoriesIcon
  }, {
    id: "me",
    label: "Me",
    icon: MeIcon
  }] : [{
    id: "home",
    label: "Today",
    icon: HomeIcon
  }, {
    id: "lineup",
    label: "Lineup",
    icon: LineupIcon
  }, {
    id: "map",
    label: "Map",
    icon: MapIcon
  }, {
    id: "me",
    label: "Me",
    icon: MeIcon
  }];
  var idx = Math.max(0, tabs.findIndex(t => t.id === active));
  var lit = tabs.some(t => t.id === active);
  return React.createElement("div", {
    className: "ps-tabbar",
    style: {
      position: "relative",
      background: "var(--chrome)",
      backdropFilter: "blur(20px) saturate(160%)",
      WebkitBackdropFilter: "blur(20px) saturate(160%)",
      borderTop: "1px solid var(--line)",
      padding: "0 10px max(10px, env(safe-area-inset-bottom, 0px))",
      display: "flex",
      justifyContent: "space-around"
    }
  }, lit && React.createElement("span", {
    "aria-hidden": "true",
    className: "ps-tab-ind",
    style: {
      position: "absolute",
      top: 0,
      left: 10,
      height: 53,
      width: `calc((100% - 20px) / ${tabs.length})`,
      transform: `translateX(${idx * 100}%)`,
      transition: "transform var(--t-move) var(--ease-spring)",
      pointerEvents: "none",
      display: "flex",
      justifyContent: "center"
    }
  }, React.createElement("span", {
    style: {
      marginTop: 6,
      width: 58,
      height: 30,
      borderRadius: 999,
      background: "var(--acc-14)",
      boxShadow: "inset 0 0 0 1px var(--acc-30)"
    }
  })), tabs.map(t => {
    var Icon = t.icon;
    var on = active === t.id;
    return React.createElement("button", {
      key: t.id,
      onClick: () => {
        haptic.light();
        if (on) document.querySelectorAll(".ps-view [data-scroll-body]").forEach(sc => {
          if (sc.scrollTop > 0) sc.scrollTo({
            top: 0,
            behavior: "smooth"
          });
        });
        onChange(t.id);
      },
      "aria-current": on ? "page" : undefined,
      className: "ps-tab",
      style: {
        position: "relative",
        background: "transparent",
        border: "none",
        cursor: "pointer",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 5,
        padding: "10px 4px 4px",
        color: on ? "var(--ink)" : "var(--ink-3)",
        flex: "1 1 0",
        minWidth: 0,
        minHeight: 53,
        transition: "color var(--t-tap) var(--ease-decay)"
      }
    }, React.createElement("span", {
      className: "ps-tab-icon",
      style: {
        display: "flex",
        transition: "transform var(--t-move) var(--ease-spring)",
        transform: on ? "translateY(-1px)" : "none"
      }
    }, React.createElement(Icon, {
      on: on
    })), React.createElement("span", {
      "data-fit-words": true,
      "data-fit-group": "tab",
      "data-fit-min": "9",
      style: {
        display: "block",
        width: "100%",
        fontSize: 11,
        lineHeight: 1.17,
        letterSpacing: ".01em",
        fontWeight: on ? 600 : 500,
        textAlign: "center"
      }
    }, t.label));
  }));
}
var stroke = on => ({
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.6,
  strokeLinecap: "round",
  strokeLinejoin: "round"
});
var _tabIcon = d => function TabIcon({
  on
}) {
  return React.createElement("svg", {
    width: "24",
    height: "24",
    viewBox: "0 0 24 24",
    "aria-hidden": "true",
    style: stroke(on)
  }, React.createElement("path", {
    d: d
  }));
};
var HomeIcon = _tabIcon("M12 20 3.5 9 M12 20 8.5 5 M12 20 15.5 5 M12 20 20.5 9 M9 20h6");
var LineupIcon = _tabIcon("M4 6h16 M4 12h11 M4 18h14");
var MapIcon = _tabIcon("M9 4 3 6.2v13.8l6-2.2 6 2.2 6-2.2V4l-6 2.2L9 4z M9 4v13.8 M15 6.2V20");
var MeIcon = _tabIcon("M12 12.5a4.25 4.25 0 1 0 0-8.5 4.25 4.25 0 0 0 0 8.5z M4.5 20.5c1.4-3.7 4.3-5.6 7.5-5.6s6.1 1.9 7.5 5.6");
var MemoriesIcon = _tabIcon("M4 6.5h16v12H4z M4 15.5l4.5-4 3.5 3 2.5-2 5.5 4.5 M15.5 10.5a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3z");
function MusicIcon({
  on
}) {
  return React.createElement("svg", {
    width: "24",
    height: "24",
    viewBox: "0 0 24 24",
    "aria-hidden": "true",
    style: stroke(on)
  }, React.createElement("circle", {
    cx: "7",
    cy: "17",
    r: "2.5"
  }), React.createElement("circle", {
    cx: "17",
    cy: "15",
    r: "2.5"
  }), React.createElement("path", {
    d: "M9.5 17 L9.5 5 L19.5 3 L19.5 15"
  }));
}
function Pill({
  children,
  tone = "ink",
  style
}) {
  var tones = {
    ink: {
      bg: "var(--ink)",
      fg: "var(--paper)"
    },
    outline: {
      bg: "transparent",
      fg: "var(--ink)",
      border: "1px solid var(--line-2)"
    },
    ember: {
      bg: "var(--ember)",
      fg: "#fff"
    },
    paper: {
      bg: "var(--paper)",
      fg: "var(--ink)",
      border: "1px solid var(--line)"
    },
    night: {
      bg: "var(--night)",
      fg: "var(--paper)"
    }
  };
  var t = tones[tone];
  return React.createElement("span", {
    className: "mono",
    style: {
      display: "inline-flex",
      alignItems: "center",
      gap: 6,
      padding: "4px 9px",
      borderRadius: 999,
      background: t.bg,
      color: t.fg,
      border: t.border || "none",
      fontSize: 10,
      letterSpacing: 1.2,
      textTransform: "uppercase",
      fontWeight: 500,
      whiteSpace: "nowrap",
      ...style
    }
  }, children);
}
var haptic = {
  light: () => navigator.vibrate?.([10]),
  medium: () => navigator.vibrate?.([30]),
  heavy: () => navigator.vibrate?.([50, 30, 50])
};
var _modalSubs = new Set();
var _modalCount = 0;
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
function useModalOpen() {
  var [n, setN] = React.useState(_modalCount);
  React.useEffect(() => {
    _modalSubs.add(setN);
    setN(_modalCount);
    return () => {
      _modalSubs.delete(setN);
    };
  }, []);
  return n > 0;
}
function useStaggerFade(depKey, skip = false) {
  var ref = React.useRef(null);
  React.useEffect(() => {
    var el = ref.current;
    if (!el || skip) return;
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches) return;
    var box = el.getBoundingClientRect();
    var visible = [...el.querySelectorAll("[data-animate]")].filter(t => {
      var r = t.getBoundingClientRect();
      return r.bottom > box.top && r.top < box.bottom;
    }).slice(0, 8);
    if (!visible.length) return;
    visible.forEach(t => {
      t.style.transition = "none";
      t.style.opacity = "0";
      t.style.transform = "translateY(8px)";
    });
    var timers = visible.map((t, i) => setTimeout(() => {
      t.style.transition = "opacity 0.3s ease, transform 0.3s var(--ease-spring)";
      t.style.opacity = "1";
      t.style.transform = "translateY(0)";
    }, i * 40));
    return () => {
      timers.forEach(clearTimeout);
      visible.forEach(t => {
        t.style.transition = "";
        t.style.opacity = "";
        t.style.transform = "";
      });
    };
  }, [depKey]);
  return ref;
}
var ARTIST_IMAGES_KEY = "artist_images_v1";
var SPOTIFY_IMAGE_TTL_MS = 24 * 60 * 60 * 1000;
var _ARTIST_IMAGE_SOURCES = ["spotify"];
function _readArtistImageStore() {
  try {
    var o = JSON.parse(localStorage.getItem(ARTIST_IMAGES_KEY) || "{}");
    return o && typeof o === "object" && !Array.isArray(o) ? o : {};
  } catch {
    return {};
  }
}
function _artistImageRecord(v) {
  if (typeof v === "string") return v ? {
    url: v,
    source: "unknown",
    fetchedAt: null,
    spotifyId: null
  } : null;
  if (!v || typeof v !== "object" || typeof v.url !== "string" || !v.url) return null;
  return {
    url: v.url,
    source: _ARTIST_IMAGE_SOURCES.includes(v.source) ? v.source : "unknown",
    fetchedAt: Number.isFinite(v.fetchedAt) ? v.fetchedAt : null,
    spotifyId: typeof v.spotifyId === "string" && v.spotifyId ? v.spotifyId : null
  };
}
function _artistImageShowable(rec, now = Date.now()) {
  if (!rec) return false;
  if (rec.source === "spotify") {
    var age = now - rec.fetchedAt;
    return rec.fetchedAt != null && age >= 0 && age < SPOTIFY_IMAGE_TTL_MS;
  }
  return false;
}
function getPermanentArtistImage(name) {
  var rec = window.PLURSKY_ARTIST_PHOTOS?.[window.PlurskyArtistKey.artistKey(name || "")];
  if (!rec || !["commons", "press-kit"].includes(rec.source) || !/^\.\/artist-photos\/[a-z0-9][a-z0-9_-]*\.(webp|png|jpg)$/.test(rec.url || "") || !rec.author || !rec.license || !rec.sourceUrl || !rec.licenseUrl) return null;
  return rec;
}
function getArtistImage(name, now = Date.now()) {
  if (!name) return null;
  var permanent = getPermanentArtistImage(name);
  if (permanent) return permanent;
  var rec = _artistImageRecord(_readArtistImageStore()[String(name).toLowerCase()]);
  return _artistImageShowable(rec, now) ? rec : null;
}
function getShareableArtistImage(name) {
  var rec = getArtistImage(name);
  return rec && rec.source !== "spotify" && rec.allowExport === true ? rec : null;
}
function _pruneArtistImageStore(store, now = Date.now()) {
  var changed = false;
  for (var k of Object.keys(store)) {
    if (!_artistImageShowable(_artistImageRecord(store[k]), now)) {
      delete store[k];
      changed = true;
    }
  }
  return changed;
}
var ARTIST_IMAGES_WRITTEN = "plursky:artist-images-written";
function putArtistImages(entries, {
  ifAbsent = false
} = {}) {
  try {
    var store = _readArtistImageStore();
    var changed = _pruneArtistImageStore(store);
    var now = Date.now();
    var written = [];
    for (var e of entries || []) {
      if (!e || !e.name || typeof e.url !== "string" || !e.url) continue;
      if (!_ARTIST_IMAGE_SOURCES.includes(e.source)) continue;
      var ln = String(e.name).toLowerCase();
      if (ifAbsent && store[ln]) continue;
      store[ln] = {
        url: e.url,
        source: e.source,
        fetchedAt: now
      };
      if (e.source === "spotify" && e.spotifyId) store[ln].spotifyId = e.spotifyId;
      written.push(ln);
      changed = true;
    }
    if (changed) localStorage.setItem(ARTIST_IMAGES_KEY, JSON.stringify(store));
    if (written.length) try {
      window.dispatchEvent(new CustomEvent(ARTIST_IMAGES_WRITTEN, {
        detail: written
      }));
    } catch {}
  } catch {}
  _scheduleArtistImageExpiry();
}
function putArtistImage(name, url, source, opts = {}) {
  putArtistImages([{
    name,
    url,
    source,
    spotifyId: opts.spotifyId
  }], opts);
}
var ARTIST_IMAGES_EXPIRED = "plursky:artist-images-expired";
var _artistImageTimer = null;
function _expireArtistImagesNow(now = Date.now()) {
  var changed = false;
  try {
    var s = _readArtistImageStore();
    changed = _pruneArtistImageStore(s, now);
    if (changed) localStorage.setItem(ARTIST_IMAGES_KEY, JSON.stringify(s));
  } catch {}
  if (changed) try {
    window.dispatchEvent(new Event(ARTIST_IMAGES_EXPIRED));
  } catch {}
  _scheduleArtistImageExpiry(now);
  return changed;
}
function _scheduleArtistImageExpiry(now = Date.now()) {
  try {
    clearTimeout(_artistImageTimer);
  } catch {}
  _artistImageTimer = null;
  var next = Infinity;
  try {
    for (var v of Object.values(_readArtistImageStore())) {
      var rec = _artistImageRecord(v);
      if (rec && rec.source === "spotify" && rec.fetchedAt != null) next = Math.min(next, rec.fetchedAt + SPOTIFY_IMAGE_TTL_MS);
    }
  } catch {}
  if (next === Infinity) return;
  _artistImageTimer = setTimeout(() => _expireArtistImagesNow(), Math.max(0, next - now) + 50);
}
try {
  _expireArtistImagesNow();
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") _expireArtistImagesNow();
  });
} catch {}
try {
  for (var i = localStorage.length - 1; i >= 0; i--) {
    var k = localStorage.key(i);
    if (k && /^tadb_.+_v\d+$/.test(k)) localStorage.removeItem(k);
  }
} catch {}
function _previewPlayable(e) {
  return !!e && e.source === "spotify" && typeof e.url === "string" && /^https:\/\//.test(e.url);
}
function _prunePreviewCache() {
  try {
    var raw = localStorage.getItem("preview_urls_v1");
    if (!raw) return {};
    var all = JSON.parse(raw) || {};
    var kept = {};
    for (var _k of Object.keys(all)) if (_previewPlayable(all[_k])) kept[_k] = all[_k];
    if (Object.keys(kept).length !== Object.keys(all).length) localStorage.setItem("preview_urls_v1", JSON.stringify(kept));
    return kept;
  } catch {
    try {
      localStorage.removeItem("preview_urls_v1");
    } catch {}
    return {};
  }
}
_prunePreviewCache();
function SpotifyFullLogo({
  height = 21,
  title = "Spotify"
}) {
  return React.createElement("svg", {
    viewBox: "0 0 823.46 225.25",
    height: height,
    width: Math.round(height * 823.46 / 225.25),
    role: "img",
    "aria-label": title,
    style: {
      display: "block",
      fill: "currentColor"
    }
  }, React.createElement("path", {
    d: "m125.52,3.31C65.14.91,14.26,47.91,11.86,108.29c-2.4,60.38,44.61,111.26,104.98,113.66,60.38,2.4,111.26-44.6,113.66-104.98C232.89,56.59,185.89,5.7,125.52,3.31Zm46.18,160.28c-1.36,2.4-4.01,3.6-6.59,3.24-.79-.11-1.58-.37-2.32-.79-14.46-8.23-30.22-13.59-46.84-15.93-16.62-2.34-33.25-1.53-49.42,2.4-3.51.85-7.04-1.3-7.89-4.81-.85-3.51,1.3-7.04,4.81-7.89,17.78-4.32,36.06-5.21,54.32-2.64,18.26,2.57,35.58,8.46,51.49,17.51,3.13,1.79,4.23,5.77,2.45,8.91Zm14.38-28.72c-2.23,4.12-7.39,5.66-11.51,3.43-16.92-9.15-35.24-15.16-54.45-17.86-19.21-2.7-38.47-1.97-57.26,2.16-1.02.22-2.03.26-3.01.12-3.41-.48-6.33-3.02-7.11-6.59-1.01-4.58,1.89-9.11,6.47-10.12,20.77-4.57,42.06-5.38,63.28-2.4,21.21,2.98,41.46,9.62,60.16,19.74,4.13,2.23,5.66,7.38,3.43,11.51Zm15.94-32.38c-2.1,4.04-6.47,6.13-10.73,5.53-1.15-.16-2.28-.52-3.37-1.08-19.7-10.25-40.92-17.02-63.07-20.13-22.15-3.11-44.42-2.45-66.18,1.97-5.66,1.15-11.17-2.51-12.32-8.16-1.15-5.66,2.51-11.17,8.16-12.32,24.1-4.89,48.74-5.62,73.25-2.18,24.51,3.44,47.99,10.94,69.81,22.29,5.12,2.66,7.11,8.97,4.45,14.09Z"
  }), React.createElement("path", {
    d: "m318.54,169.81c-18.87,0-35.07-6.53-41.84-13.95-.64-.73-.73-1.13-.73-2.02v-22.09c0-1.05.89-1.45,1.61-.56,8.14,10.16,25.48,18.46,39.67,18.46,11.29,0,18.87-3.06,18.87-13.06,0-5.97-2.82-9.84-18.22-14.19l-8.87-2.5c-20.56-5.8-33.06-12.66-33.06-32.33,0-17.41,16.12-32.73,43.05-32.73,13.22,0,26.36,4.11,33.94,9.76.64.48.89.97.89,1.85v20.08c0,1.37-1.13,1.77-2.18.89-6.13-5.08-17.98-11.93-32.01-11.93s-20.64,6.29-20.64,12.09c0,6.13,4.27,7.82,19.51,12.34l7.58,2.26c23.46,7.01,33.06,16.85,33.06,33.14,0,20.96-17.41,34.51-40.63,34.51Zm164.39-42.09c0-12.82,8.87-22.33,21.37-22.33s21.28,9.51,21.28,22.33-8.87,22.33-21.28,22.33-21.37-9.51-21.37-22.33Zm21.28,42.09c26.04,0,44.18-18.62,44.18-42.09s-18.14-42.09-44.18-42.09-44.1,18.46-44.1,42.09,17.98,42.09,44.1,42.09Zm157.22-89.01v6.77h-13.71c-.73,0-1.13.4-1.13,1.13v16.12c0,.73.4,1.13,1.13,1.13h13.71v60.79c0,.73.4,1.13,1.13,1.13h20.64c.73,0,1.13-.4,1.13-1.13v-60.79h17.66l25.64,55.71-13.79,30.31c-.4.89.08,1.29.89,1.29h22.01c.73,0,1.05-.16,1.37-.89l45.55-103.52c.32-.73-.08-1.29-.89-1.29h-20.64c-.73,0-1.05.16-1.37.89l-20.8,49.99-20.88-49.99c-.32-.73-.64-.89-1.37-.89h-33.38v-5.32c0-8.71,5.89-12.74,13.46-12.74,4.51,0,9.43,2.34,12.9,4.43.81.48,1.37-.08,1.05-.81l-7.26-17.33c-.24-.56-.56-.89-1.13-1.21-3.55-1.85-9.35-3.47-15-3.47-17.09,0-26.93,13.06-26.93,29.67Zm-243,88.52c20.64,0,35.47-17.82,35.47-41.76s-15-41.44-35.64-41.44c-15.32,0-24.19,9.35-29.35,18.7v-16.12c0-.73-.4-1.13-1.13-1.13h-20.24c-.73,0-1.13.4-1.13,1.13v103.44c0,.73.4,1.13,1.13,1.13h20.24c.73,0,1.13-.4,1.13-1.13v-41.36c5.16,9.35,13.87,18.54,29.51,18.54Zm172.21-.32c6.77,0,13.3-1.77,17.17-4.03.56-.32.64-.64.64-1.21v-15.32c0-.81-.4-1.05-1.13-.64-2.34,1.29-5.4,2.34-9.59,2.34-6.61,0-10.8-3.87-10.8-12.42v-31.77h20.16c.73,0,1.13-.4,1.13-1.13v-16.12c0-.73-.4-1.13-1.13-1.13h-20.16v-21.04c0-.89-.56-1.37-1.37-.73l-36.04,28.38c-.48.4-.64.81-.64,1.45v9.19c0,.73.4,1.13,1.13,1.13h14.03v35.15c0,19.03,10.96,27.9,26.61,27.9Zm23.3-105.29c0,7.26,5.64,12.74,13.38,12.74s13.54-5.48,13.54-12.74-5.64-12.74-13.54-12.74-13.38,5.48-13.38,12.74Zm3.14,104.17h20.64c.73,0,1.13-.4,1.13-1.13v-78.04c0-.73-.4-1.13-1.13-1.13h-20.64c-.73,0-1.13.4-1.13,1.13v78.04c0,.73.4,1.13,1.13,1.13Zm-228.65-40.47c3.71-12.42,12.25-21.93,23.86-21.93s18.7,8.38,18.7,22.09-7.66,22.25-18.7,22.25-20.16-10.64-23.86-22.41Z"
  }), React.createElement("path", {
    d: "m810.1,92.31c-1.06-1.83-2.53-3.26-4.41-4.3-1.88-1.03-3.98-1.55-6.32-1.55s-4.44.52-6.32,1.55c-1.88,1.04-3.35,2.47-4.41,4.3-1.06,1.83-1.59,3.9-1.59,6.21s.53,4.34,1.59,6.17c1.06,1.83,2.53,3.26,4.41,4.3,1.88,1.04,3.98,1.55,6.32,1.55s4.44-.52,6.32-1.55,3.35-2.47,4.41-4.3c1.06-1.83,1.59-3.88,1.59-6.17s-.53-4.38-1.59-6.21Zm-1.93,11.36c-.86,1.52-2.06,2.7-3.59,3.56-1.53.85-3.27,1.28-5.2,1.28s-3.72-.43-5.25-1.28c-1.53-.85-2.72-2.04-3.57-3.56-.85-1.51-1.27-3.23-1.27-5.15s.42-3.63,1.27-5.13c.85-1.5,2.04-2.68,3.57-3.53,1.53-.85,3.28-1.28,5.25-1.28s3.67.43,5.2,1.28c1.53.85,2.73,2.04,3.59,3.56.86,1.52,1.29,3.23,1.29,5.15s-.43,3.59-1.29,5.11Z"
  }), React.createElement("path", {
    d: "m803.56,98.29c.82-.6,1.23-1.4,1.23-2.39s-.4-1.83-1.2-2.43c-.8-.6-1.96-.9-3.48-.9h-5.36v11.2h2.59v-4.45h1.41l3.41,4.45h3.18l-3.73-4.72c.79-.15,1.46-.4,1.96-.77Zm-3.86-.99h-2.36v-2.74h2.45c.73,0,1.29.11,1.68.34.39.23.59.58.59,1.06,0,.45-.21.79-.61,1.01-.41.23-.99.34-1.75.34Z"
  }));
}
function SpotifyPhotoCredit({
  names
}) {
  var list = (names || []).filter(Boolean);
  var has = () => list.some(n => getArtistImage(n)?.source === "spotify");
  var [show, setShow] = React.useState(has);
  var sig = list.join("|");
  React.useEffect(() => {
    setShow(has());
    var on = () => setShow(has());
    window.addEventListener(ARTIST_IMAGES_WRITTEN, on);
    window.addEventListener(ARTIST_IMAGES_EXPIRED, on);
    return () => {
      window.removeEventListener(ARTIST_IMAGES_WRITTEN, on);
      window.removeEventListener(ARTIST_IMAGES_EXPIRED, on);
    };
  }, [sig]);
  if (!show) return null;
  return React.createElement("a", {
    href: "https://open.spotify.com",
    target: "_blank",
    rel: "noopener noreferrer",
    "data-spotify-attribution": "list",
    "aria-label": "Artist photos from Spotify",
    style: {
      display: "flex",
      alignItems: "center",
      gap: 8,
      padding: "14px 0 6px",
      color: "var(--ink-2)",
      fontSize: 12,
      textDecoration: "none"
    }
  }, React.createElement("span", null, "Artist photos from"), React.createElement(SpotifyFullLogo, {
    height: 21
  }));
}
var _photoQueue = [];
var _photoActive = false;
var SPOTIFY_PHOTO_PROXY_URL = "https://pzoijbqsbbwyuyjinjtj.functions.supabase.co/spotify-artist-image";
var _photoProxyOff = false;
var _photoProxyPausedUntil = 0;
function _photoProxyUsable() {
  if (typeof navigator !== "undefined" && navigator.webdriver && !window.__plurskyPhotoProxyInTests) return false;
  return !_photoProxyOff && Date.now() >= _photoProxyPausedUntil && (typeof navigator === "undefined" || navigator.onLine !== false);
}
function _spotifyNameKey(s) {
  return String(s || "").normalize("NFKD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/&/g, " and ").replace(/[^a-z0-9]+/g, "");
}
function _spotifyExactArtist(items, name) {
  var k = _spotifyNameKey(name);
  return k ? (items || []).find(x => x && _spotifyNameKey(x.name) === k) || null : null;
}
function _fetchProxyPhoto(name) {
  if (!_photoProxyUsable()) return Promise.resolve(null);
  return fetch(SPOTIFY_PHOTO_PROXY_URL + "?name=" + encodeURIComponent(name)).then(r => {
    if (r.status === 429) {
      _photoProxyPausedUntil = Date.now() + 1000 * Math.min(600, parseInt(r.headers.get("Retry-After")) || 60);
      return null;
    }
    if (r.status === 404 || r.status === 503) {
      _photoProxyOff = true;
      return null;
    }
    return r.ok ? r.json() : null;
  }).then(d => {
    if (!d || !d.url) return null;
    putArtistImage(name, d.url, "spotify", {
      spotifyId: d.spotifyId
    });
    return {
      url: d.url,
      spotifyId: d.spotifyId || null
    };
  }).catch(() => null);
}
function _drainPhotoQueue() {
  if (_photoActive || !_photoQueue.length) return;
  _photoActive = true;
  var {
    name,
    resolve
  } = _photoQueue.shift();
  var next = () => {
    _photoActive = false;
    setTimeout(_drainPhotoQueue, 150);
  };
  if (!_spotifyTokenValid()) {
    if (!_photoProxyUsable()) {
      _photoActive = false;
      resolve(null);
      _drainPhotoQueue();
      return;
    }
    _fetchProxyPhoto(name).then(hit => resolve(hit ? hit.url : null)).finally(next);
    return;
  }
  fetch(`https://api.spotify.com/v1/search?q=${encodeURIComponent(name)}&type=artist&limit=10`, {
    headers: {
      Authorization: "Bearer " + localStorage.getItem("spotify_token")
    }
  }).then(r => r.ok ? r.json() : null).then(d => {
    var match = _spotifyExactArtist(d?.artists?.items, name);
    var img = match?.images?.[0]?.url || null;
    if (img) putArtistImage(name, img, "spotify", {
      spotifyId: match.id
    });
    resolve(img);
  }).catch(() => resolve(null)).finally(next);
}
function _queuePhoto(name) {
  return new Promise(resolve => {
    _photoQueue.push({
      name,
      resolve
    });
    _drainPhotoQueue();
  });
}
var ARTIST_PHOTO_EVENTS = ["MOUNT", "PARAM_CHANGE", "CACHE_HIT", "CACHE_MISS", "FETCH_RESOLVE", "FETCH_MISS", "FETCH_REJECT", "CACHE_WRITTEN", "CACHE_EXPIRED", "RETRY", "ONLINE", "UNMOUNT"];
var _apEmpty = ctx => ({
  ...ctx,
  url: null,
  source: null,
  rec: null
});
var _apReady = (ctx, rec) => ["ready", {
  ...ctx,
  url: rec.url,
  source: rec.source,
  rec
}];
var _apAsk = (ctx, p) => {
  var next = _apEmpty({
    ...ctx,
    key: p.key ?? ctx.key,
    name: p.name ?? ctx.name,
    ask: "mount"
  });
  return next.name ? ["loading", next, "read"] : ["none", next];
};
var _apReread = ask => ctx => ["loading", {
  ..._apEmpty(ctx),
  ask
}, "read"];
var _apWritten = (ctx, p) => p.rec ? _apReady(ctx, p.rec) : null;
var _apAnswer = kind => (ctx, p) => {
  if (p.req !== ctx.req) return null;
  if (kind === "resolve") return p.url ? ["ready", {
    ...ctx,
    url: p.url,
    source: p.source || "spotify",
    rec: null
  }] : ["unavailable", _apEmpty(ctx)];
  if (kind === "offline" && p.noLookup) return ["none", _apEmpty(ctx)];
  return [kind, _apEmpty(ctx)];
};
var _apStop = () => MACHINE_STOP;
var ARTIST_PHOTO_MACHINE = createMachine({
  id: "artist-photo",
  initial: "none",
  events: ARTIST_PHOTO_EVENTS,
  states: {
    none: {
      MOUNT: _apAsk,
      PARAM_CHANGE: _apAsk,
      CACHE_HIT: null,
      CACHE_MISS: null,
      FETCH_RESOLVE: null,
      FETCH_MISS: null,
      FETCH_REJECT: null,
      CACHE_WRITTEN: _apWritten,
      CACHE_EXPIRED: null,
      RETRY: (ctx, p) => ctx.name ? _apReread("retry")(ctx, p) : null,
      ONLINE: null,
      UNMOUNT: _apStop
    },
    loading: {
      MOUNT: null,
      PARAM_CHANGE: _apAsk,
      CACHE_HIT: (ctx, p) => _apReady(ctx, p.rec),
      CACHE_MISS: (ctx, p) => p.error ? ["error", ctx] : p.canFetch ? ["loading", {
        ...ctx,
        req: ctx.req + 1
      }, "fetch"] : ["none", ctx],
      FETCH_RESOLVE: _apAnswer("resolve"),
      FETCH_MISS: _apAnswer("unavailable"),
      FETCH_REJECT: _apAnswer("offline"),
      CACHE_WRITTEN: _apWritten,
      CACHE_EXPIRED: null,
      RETRY: null,
      ONLINE: null,
      UNMOUNT: _apStop
    },
    ready: {
      MOUNT: null,
      PARAM_CHANGE: _apAsk,
      CACHE_HIT: null,
      CACHE_MISS: null,
      FETCH_RESOLVE: null,
      FETCH_MISS: null,
      FETCH_REJECT: null,
      CACHE_WRITTEN: _apWritten,
      CACHE_EXPIRED: (ctx, p) => p.rec ? _apReady(ctx, p.rec) : p.canFetch ? ["loading", {
        ..._apEmpty(ctx),
        req: ctx.req + 1
      }, "fetch"] : ["none", _apEmpty(ctx)],
      RETRY: null,
      ONLINE: null,
      UNMOUNT: _apStop
    },
    unavailable: {
      MOUNT: null,
      PARAM_CHANGE: _apAsk,
      CACHE_HIT: null,
      CACHE_MISS: null,
      FETCH_RESOLVE: null,
      FETCH_MISS: null,
      FETCH_REJECT: null,
      CACHE_WRITTEN: _apWritten,
      CACHE_EXPIRED: null,
      RETRY: _apReread("retry"),
      ONLINE: null,
      UNMOUNT: _apStop
    },
    offline: {
      MOUNT: null,
      PARAM_CHANGE: _apAsk,
      CACHE_HIT: null,
      CACHE_MISS: null,
      FETCH_RESOLVE: null,
      FETCH_MISS: null,
      FETCH_REJECT: null,
      CACHE_WRITTEN: _apWritten,
      CACHE_EXPIRED: null,
      RETRY: _apReread("retry"),
      ONLINE: _apReread("online"),
      UNMOUNT: _apStop
    },
    error: {
      MOUNT: null,
      PARAM_CHANGE: _apAsk,
      CACHE_HIT: null,
      CACHE_MISS: null,
      FETCH_RESOLVE: null,
      FETCH_MISS: null,
      FETCH_REJECT: null,
      CACHE_WRITTEN: _apWritten,
      CACHE_EXPIRED: null,
      RETRY: _apReread("retry"),
      ONLINE: null,
      UNMOUNT: _apStop
    }
  }
});
function _readArtistPhoto(name) {
  try {
    return {
      rec: getArtistImage(name)
    };
  } catch (error) {
    return {
      rec: null,
      error
    };
  }
}
function _settleArtistPhoto(snap, canFetch) {
  if (snap.effect !== "read") return snap;
  var {
    rec,
    error
  } = _readArtistPhoto(snap.ctx.name);
  return ARTIST_PHOTO_MACHINE.step(snap, rec ? "CACHE_HIT" : "CACHE_MISS", rec ? {
    rec
  } : {
    error,
    canFetch: !error && canFetch(snap.ctx.ask || "mount")
  });
}
function _spotifyTokenValid() {
  var token = localStorage.getItem("spotify_token");
  var expires = localStorage.getItem("spotify_expires");
  return !!(token && expires && Date.now() < parseInt(expires));
}
function useArtistPhotoMachine(name, {
  key = name,
  lookup = null,
  canFetch = () => false
} = {}) {
  var canFetchRef = React.useRef(canFetch);
  canFetchRef.current = canFetch;
  var can = reason => !!canFetchRef.current(reason);
  var [snap, send] = useMachine(ARTIST_PHOTO_MACHINE, key, prev => _settleArtistPhoto(ARTIST_PHOTO_MACHINE.step(prev || ARTIST_PHOTO_MACHINE.start({
    key,
    name,
    url: null,
    source: null,
    rec: null,
    req: 0
  }), prev ? "PARAM_CHANGE" : "MOUNT", {
    key,
    name
  }), can), (effect, s, send) => {
    if (effect === "read") {
      var {
        rec,
        error
      } = _readArtistPhoto(s.ctx.name);
      send(rec ? "CACHE_HIT" : "CACHE_MISS", rec ? {
        rec
      } : {
        error,
        canFetch: !error && can(s.ctx.ask || "mount")
      });
    } else if (effect === "fetch" && lookup) {
      var _req = s.ctx.req;
      lookup(s.ctx.name).then(url => send(url ? "FETCH_RESOLVE" : "FETCH_MISS", {
        req: _req,
        url,
        source: "spotify"
      }), () => send("FETCH_REJECT", {
        req: _req
      }));
    }
  });
  var ln = String(name || "").toLowerCase();
  React.useEffect(() => {
    var onExpired = () => send("CACHE_EXPIRED", {
      rec: _readArtistPhoto(name).rec,
      canFetch: can("expired")
    });
    var onWritten = e => {
      if (ln && Array.isArray(e.detail) && e.detail.includes(ln)) send("CACHE_WRITTEN", {
        rec: _readArtistPhoto(name).rec
      });
    };
    var onOnline = () => send("ONLINE");
    window.addEventListener(ARTIST_IMAGES_EXPIRED, onExpired);
    window.addEventListener(ARTIST_IMAGES_WRITTEN, onWritten);
    window.addEventListener("online", onOnline);
    return () => {
      window.removeEventListener(ARTIST_IMAGES_EXPIRED, onExpired);
      window.removeEventListener(ARTIST_IMAGES_WRITTEN, onWritten);
      window.removeEventListener("online", onOnline);
    };
  }, [key, send]);
  var req = snap.ctx.req;
  var report = React.useCallback(url => send(url ? "FETCH_RESOLVE" : "FETCH_MISS", {
    req,
    url,
    source: "spotify"
  }), [req, send]);
  var fail = React.useCallback(() => send("FETCH_REJECT", {
    req
  }), [req, send]);
  var noLookup = React.useCallback(() => send("FETCH_REJECT", {
    req,
    noLookup: true
  }), [req, send]);
  var retry = React.useCallback(() => send("RETRY"), [send]);
  return {
    url: snap.ctx.url,
    status: snap.state,
    retry,
    rec: snap.ctx.rec,
    source: snap.ctx.source,
    report,
    fail,
    noLookup
  };
}
function useArtistPhoto(name) {
  return useArtistPhotoMachine(name, {
    lookup: _queuePhoto,
    canFetch: () => _spotifyTokenValid() || _photoProxyUsable()
  }).url;
}
function ArtistSwatch({
  artist,
  size = 44
}) {
  var photo = useArtistPhoto(artist.name);
  var initials = artist.name.split(/\s+/).map(w => (w.match(/[A-Za-z0-9]/) || [""])[0]).filter(Boolean).slice(0, 2).join("").toUpperCase();
  return React.createElement("div", {
    style: {
      width: size,
      height: size,
      borderRadius: size,
      background: "var(--paper-3)",
      color: "var(--text-2)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      fontSize: Math.max(12, size * 0.36),
      fontWeight: 600,
      flexShrink: 0,
      boxShadow: "inset 0 0 0 1px var(--line)",
      overflow: "hidden",
      position: "relative"
    }
  }, photo ? React.createElement("img", {
    src: photo,
    alt: artist.name,
    style: {
      position: "absolute",
      inset: 0,
      width: "100%",
      height: "100%",
      objectFit: "cover",
      objectPosition: "center 15%"
    }
  }) : initials);
}
function Wordmark({
  size = 18,
  color = "var(--ink)"
}) {
  return React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      gap: 8,
      color
    }
  }, React.createElement("img", {
    src: "./apple-touch-icon.png",
    alt: "",
    width: size,
    height: size,
    style: {
      borderRadius: size * 0.22,
      display: "block",
      flexShrink: 0
    }
  }), React.createElement("span", {
    className: "mono",
    style: {
      fontSize: size * 0.72,
      letterSpacing: 3,
      fontWeight: 500
    }
  }, "PLURSKY"));
}
var fieldIconBtn = {
  width: 44,
  height: 44,
  flexShrink: 0,
  padding: 0,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  background: "transparent",
  border: "none",
  borderRadius: 14,
  color: "var(--ink)",
  cursor: "pointer"
};
function FieldButton({
  children,
  onClick,
  kind = "primary",
  style,
  ...rest
}) {
  var primary = kind === "primary";
  return React.createElement("button", {
    onClick: onClick,
    ...rest,
    style: {
      width: "100%",
      minHeight: 52,
      padding: "0 20px",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      gap: 8,
      background: primary ? "var(--acc)" : "transparent",
      color: primary ? "var(--on-acc)" : "var(--ink)",
      border: primary ? "none" : "1px solid var(--line-2)",
      borderRadius: "var(--rad-sm)",
      cursor: rest.disabled ? "default" : "pointer",
      boxShadow: primary && !rest.disabled ? "0 10px 28px -12px var(--acc-55)" : "none",
      font: "650 17px/1.3 var(--f-ui)",
      letterSpacing: "-0.01em",
      opacity: rest.disabled ? 0.45 : 1,
      ...style
    }
  }, children);
}
function FieldSectionHeader({
  title,
  action,
  onAction
}) {
  return React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      padding: "0 20px",
      minHeight: 44
    }
  }, React.createElement("h2", {
    style: {
      margin: 0,
      fontSize: 22,
      lineHeight: "28px",
      fontWeight: 700,
      letterSpacing: "-0.01em"
    }
  }, title), action && (typeof action === "string" ? React.createElement("button", {
    onClick: onAction,
    style: {
      ...fieldIconBtn,
      width: "auto",
      padding: "0 4px",
      color: "var(--text-2)",
      fontSize: 15,
      fontWeight: 500
    }
  }, action) : action));
}
function FieldMediaRow({
  children
}) {
  return React.createElement("div", {
    className: "no-scrollbar",
    style: {
      display: "flex",
      gap: 12,
      overflowX: "auto",
      scrollbarWidth: "none",
      padding: "4px 20px 0",
      scrollPaddingInline: 20,
      scrollSnapType: "x proximity"
    }
  }, children);
}
function useEscapeToClose(onClose) {
  React.useEffect(() => {
    var onKey = e => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
}
function FieldSheet({
  title,
  eyebrow,
  footer,
  onClose,
  children
}) {
  useDeclareModal(true);
  useEscapeToClose(onClose);
  return React.createElement("div", {
    onClick: onClose,
    style: {
      position: "fixed",
      inset: 0,
      zIndex: 80,
      background: "var(--scrim)",
      display: "flex",
      alignItems: "flex-end"
    }
  }, React.createElement("div", {
    role: "dialog",
    "aria-modal": "true",
    "aria-label": title,
    onClick: e => e.stopPropagation(),
    style: {
      width: "100%",
      maxHeight: "88%",
      display: "flex",
      flexDirection: "column",
      background: "var(--s1)",
      borderRadius: "var(--rad-lg) var(--rad-lg) 0 0",
      boxShadow: "var(--e2)",
      paddingBottom: "env(safe-area-inset-bottom, 0px)"
    }
  }, React.createElement("div", {
    "aria-hidden": "true",
    style: {
      display: "flex",
      justifyContent: "center",
      paddingTop: 8
    }
  }, React.createElement("div", {
    style: {
      width: 36,
      height: 5,
      borderRadius: 3,
      background: "var(--line-2)"
    }
  })), React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      padding: "4px 8px 4px 20px"
    }
  }, React.createElement("div", {
    style: {
      minWidth: 0
    }
  }, eyebrow && React.createElement("div", {
    className: "duo-label duo-ink3",
    style: {
      marginBottom: 3
    }
  }, eyebrow), React.createElement("h2", {
    style: {
      margin: 0,
      font: "700 22px/1.25 var(--f-ui)",
      letterSpacing: "-0.02em"
    }
  }, title)), React.createElement("button", {
    onClick: onClose,
    "aria-label": "Close",
    style: fieldIconBtn
  }, React.createElement("svg", {
    width: "18",
    height: "18",
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: "2",
    strokeLinecap: "round"
  }, React.createElement("path", {
    d: "M6 6 L18 18 M18 6 L6 18"
  })))), React.createElement("div", {
    style: {
      flex: 1,
      minHeight: 0,
      overflowY: "auto",
      WebkitOverflowScrolling: "touch",
      padding: "4px 20px 24px"
    }
  }, children), footer && React.createElement("div", {
    style: {
      flex: "none",
      padding: "10px 20px 16px",
      borderTop: "1px solid var(--line)"
    }
  }, footer)));
}
function _duoMembers(name) {
  var parts = String(name || "").split(/\s+b\d+b\s+|\s+with\s+|\s+\+\s+/i).map(s => s.trim()).filter(Boolean);
  if (parts.length < 2) return parts;
  return parts.map(p => p.replace(/\s+pres\.?\s+.*$/i, "").replace(/\s*\([^)]*\)\s*$/, "").trim() || p);
}
function _duoInitials(name) {
  var clean = String(name || "").replace(/\([^)]*\)/g, " ").replace(/\s+pres\.?\s+.*$/i, "");
  var words = clean.split(/\s+/).filter(w => /[A-Za-z0-9]/.test(w));
  var kept = words.filter((w, i) => i === 0 || /^[^A-Za-z0-9]*[A-Za-z]/.test(w));
  var pick = kept.slice(0, 2);
  return pick.map(w => w.match(/[A-Za-z0-9]/)[0].toUpperCase()).join("") || "?";
}
function _duoFaceAccent() {
  try {
    var id = typeof FESTIVAL_CONFIG !== "undefined" && FESTIVAL_CONFIG && FESTIVAL_CONFIG.id;
    var e = id && (typeof FESTIVALS_REGISTRY !== "undefined" ? FESTIVALS_REGISTRY : []).find(f => f && f.config && f.config.id === id);
    return e && /^#[0-9a-f]{6}$/i.test(e.accent || "") ? e.accent : null;
  } catch {
    return null;
  }
}
function DuoFace({
  name,
  size,
  ring = "",
  style,
  className = ""
}) {
  var resolved = useArtistPhoto(name);
  var rec = getArtistImage(name);
  var [failed, setFailed] = React.useState(null);
  var photo = resolved && resolved !== failed ? resolved : null;
  return React.createElement("span", {
    className: `duo-av ${ring} ${className}`.trim(),
    "aria-hidden": "true",
    "data-face": name,
    "data-photo-source": photo ? rec?.source || "" : "initials",
    style: {
      ...(!photo && _duoFaceAccent() ? {
        "--face-acc": _duoFaceAccent()
      } : {}),
      ...(size ? {
        width: size,
        height: size,
        fontSize: Math.round(size * 0.32)
      } : {}),
      ...style
    }
  }, photo ? React.createElement("img", {
    src: photo,
    alt: "",
    onError: () => setFailed(photo)
  }) : _duoInitials(name));
}
function DuoAvatar({
  name,
  size = 40,
  ring = ""
}) {
  var ms = _duoMembers(name);
  if (ms.length < 2) return React.createElement(DuoFace, {
    name: name,
    size: size,
    ring: ring
  });
  return React.createElement("span", {
    className: "duo-avp",
    "aria-hidden": "true",
    "data-pair": name,
    style: {
      "--av": size + "px"
    }
  }, React.createElement(DuoFace, {
    name: ms[0],
    ring: ring,
    className: "duo-avp-a"
  }), React.createElement(DuoFace, {
    name: ms[1],
    ring: ring,
    className: "duo-avp-b"
  }));
}
function DuoLive({
  children = "Live",
  className = "duo-label"
}) {
  return React.createElement("span", {
    className: `${className} duo-live`
  }, React.createElement("i", {
    "aria-hidden": "true"
  }), children);
}
function DuoSect({
  title,
  right,
  style
}) {
  return React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 12,
      minHeight: 24,
      ...style
    }
  }, React.createElement("h2", {
    className: "duo-sect"
  }, title), right);
}
function useInstallPrompt() {
  var [deferred, setDeferred] = React.useState(null);
  var [dismissed, setDismissed] = React.useState(() => typeof localStorage !== "undefined" && localStorage.getItem("install_dismissed") === "1");
  React.useEffect(() => {
    var handler = e => {
      e.preventDefault();
      setDeferred(e);
    };
    var installed = () => {
      setDeferred(null);
      try {
        localStorage.setItem("install_dismissed", "1");
      } catch {}
    };
    window.addEventListener("beforeinstallprompt", handler);
    window.addEventListener("appinstalled", installed);
    return () => {
      window.removeEventListener("beforeinstallprompt", handler);
      window.removeEventListener("appinstalled", installed);
    };
  }, []);
  var isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent) && !window.MSStream;
  var isStandalone = typeof window !== "undefined" && window.matchMedia?.("(display-mode: standalone)").matches || window.navigator.standalone === true;
  var isNativeApp = !!window.Capacitor?.isNativePlatform?.();
  var canInstall = !dismissed && !isStandalone && !isNativeApp && (deferred || isIOS);
  return {
    canInstall,
    isIOS,
    install: async () => {
      if (!deferred) return;
      deferred.prompt();
      try {
        var {
          outcome
        } = await deferred.userChoice;
        if (outcome === "accepted") setDeferred(null);
      } catch {}
    },
    dismiss: () => {
      try {
        localStorage.setItem("install_dismissed", "1");
      } catch {}
      setDismissed(true);
    }
  };
}
function InstallBanner() {
  var ip = useInstallPrompt();
  if (!ip.canInstall) return null;
  return React.createElement("div", {
    className: "duo-card",
    style: {
      margin: "8px 16px 0",
      padding: "8px 4px 8px 12px",
      color: "var(--ink)",
      display: "flex",
      alignItems: "center",
      gap: 12
    }
  }, React.createElement("img", {
    src: "./apple-touch-icon.png",
    alt: "",
    width: "36",
    height: "36",
    style: {
      borderRadius: 9,
      display: "block",
      flexShrink: 0
    }
  }), React.createElement("div", {
    style: {
      flex: 1,
      minWidth: 0
    }
  }, React.createElement("div", {
    className: "duo-label duo-acc"
  }, "Install Plursky"), React.createElement("div", {
    className: "duo-body-s duo-ink2",
    style: {
      marginTop: 3,
      fontWeight: 400
    }
  }, ip.isIOS ? React.createElement(React.Fragment, null, "Tap ", React.createElement("span", {
    style: {
      display: "inline-flex",
      verticalAlign: "middle",
      padding: "0 2px"
    }
  }, React.createElement("svg", {
    width: "13",
    height: "13",
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "var(--ink)",
    strokeWidth: "1.8",
    strokeLinecap: "round",
    strokeLinejoin: "round"
  }, React.createElement("path", {
    d: "M12 3 L12 16"
  }), React.createElement("path", {
    d: "M7 8 L12 3 L17 8"
  }), React.createElement("rect", {
    x: "5",
    y: "13",
    width: "14",
    height: "8",
    rx: "1.5"
  }))), " then ", React.createElement("strong", {
    style: {
      color: "var(--ink)"
    }
  }, "Add to Home Screen"), " for offline + full-screen.") : React.createElement(React.Fragment, null, "Add to home screen for offline lineup + full-screen map."))), !ip.isIOS && React.createElement("button", {
    onClick: ip.install,
    className: "duo-btn pri",
    style: {
      minHeight: 40,
      padding: "0 14px",
      fontSize: 14,
      flexShrink: 0
    }
  }, "Install"), React.createElement("button", {
    onClick: ip.dismiss,
    "aria-label": "Dismiss",
    style: {
      background: "transparent",
      border: "none",
      cursor: "pointer",
      color: "var(--ink-2)",
      minWidth: 44,
      minHeight: 44,
      flexShrink: 0,
      fontSize: 20,
      lineHeight: 1
    }
  }, "×"));
}
function _capLocalNotifications() {
  var cap = window.Capacitor;
  if (!cap?.isNativePlatform?.()) return null;
  return cap.Plugins?.LocalNotifications || null;
}
function _notifIdForArtist(id) {
  var h = 0;
  for (var _i = 0; _i < id.length; _i++) h = h * 31 + id.charCodeAt(_i) | 0;
  return Math.abs(h) % 1_999_999_999 + 1;
}
var _TEST_NOTIF_ID = 9_999_001;
function useNotifications() {
  var ln = _capLocalNotifications();
  var webSupported = typeof Notification !== "undefined";
  var supported = !!ln || webSupported;
  var [perm, setPerm] = React.useState(() => {
    if (ln) return "checking";
    if (webSupported) return Notification.permission;
    return "unsupported";
  });
  React.useEffect(() => {
    if (!ln) return;
    var cancelled = false;
    ln.checkPermissions().then(res => {
      if (cancelled) return;
      setPerm(_mapDisplayPerm(res?.display));
    }).catch(() => {
      if (!cancelled) setPerm("default");
    });
    return () => {
      cancelled = true;
    };
  }, []);
  var enable = async () => {
    if (ln) {
      try {
        var res = await ln.requestPermissions();
        var next = _mapDisplayPerm(res?.display);
        setPerm(next);
        return next;
      } catch {
        setPerm("denied");
        return "denied";
      }
    }
    if (!webSupported) return "unsupported";
    if (perm === "granted") return "granted";
    var result = await Notification.requestPermission();
    setPerm(result);
    return result;
  };
  var showLocal = async (title, opts = {}) => {
    if (perm !== "granted") return false;
    if (ln) {
      try {
        await ln.schedule({
          notifications: [{
            id: _TEST_NOTIF_ID,
            title,
            body: opts.body || "",
            schedule: {
              at: new Date(Date.now() + 1000)
            },
            sound: undefined,
            smallIcon: "ic_stat_icon_config_sample",
            extra: opts.data || {}
          }]
        });
        return true;
      } catch {
        return false;
      }
    }
    if (!webSupported) return false;
    try {
      var reg = await navigator.serviceWorker?.ready;
      if (reg) {
        await reg.showNotification(title, {
          icon: "/og.svg",
          badge: "/og.svg",
          vibrate: [80, 40, 80],
          ...opts
        });
      } else {
        new Notification(title, opts);
      }
      return true;
    } catch {
      return false;
    }
  };
  return {
    supported,
    perm,
    enable,
    showLocal
  };
}
function _mapDisplayPerm(display) {
  if (display === "granted") return "granted";
  if (display === "denied") return "denied";
  return "default";
}
var ATTENDED_KEY = "plursky_attended_v2";
var ATTENDED_LEGACY_KEY = "plursky_attended_v1";
var ATTENDED_UNATTRIBUTED = "_unattributed";
function _attendedDataSets() {
  try {
    return (typeof _DATA_SETS !== "undefined" ? _DATA_SETS : window._DATA_SETS) || {};
  } catch {
    return {};
  }
}
var _attendedOwnerIndex = null;
function _attendedOwnerOf(artistId) {
  var sets = _attendedDataSets();
  if (!_attendedOwnerIndex || _attendedOwnerIndex._n !== Object.keys(sets).length) {
    var idx = {
      _n: Object.keys(sets).length,
      map: {}
    };
    for (var [fid, ds] of Object.entries(sets)) {
      for (var a of ds?.artists || []) {
        idx.map[a.id] = a.id in idx.map && idx.map[a.id] !== fid ? null : fid;
      }
    }
    _attendedOwnerIndex = idx;
  }
  return _attendedOwnerIndex.map[artistId] || null;
}
function _normAttendedNights(obj) {
  var out = {};
  if (!obj || typeof obj !== "object") return out;
  Object.keys(obj).forEach(k => {
    out[k] = Array.isArray(obj[k]) ? obj[k].filter(x => typeof x === "string") : [];
  });
  return out;
}
function _migrateLegacyAttended() {
  var legacy = {};
  try {
    legacy = JSON.parse(localStorage.getItem(ATTENDED_LEGACY_KEY) || "{}") || {};
  } catch {}
  var store = {};
  for (var [night, ids] of Object.entries(_normAttendedNights(legacy))) {
    for (var id of ids) {
      var fid = _attendedOwnerOf(id) || ATTENDED_UNATTRIBUTED;
      var nights = store[fid] = store[fid] || {};
      var list = nights[night] = nights[night] || [];
      if (!list.includes(id)) list.push(id);
    }
  }
  if (Object.keys(_attendedDataSets()).length) {
    try {
      localStorage.setItem(ATTENDED_KEY, JSON.stringify(store));
    } catch {}
  }
  return store;
}
function _readAttendedStore() {
  try {
    var raw = localStorage.getItem(ATTENDED_KEY);
    if (raw) {
      var s = JSON.parse(raw);
      if (s && typeof s === "object") return s;
    }
  } catch {}
  return _migrateLegacyAttended();
}
function getAttendedStore() {
  var s = _readAttendedStore(),
    out = {};
  Object.keys(s).forEach(fid => {
    out[fid] = _normAttendedNights(s[fid]);
  });
  return out;
}
function getAllAttended(festivalId) {
  var fid = festivalId || window.FESTIVAL_CONFIG?.id;
  if (!fid) return {};
  return _normAttendedNights(_readAttendedStore()[fid]);
}
function _writeAttended(map, festivalId) {
  var fid = festivalId || window.FESTIVAL_CONFIG?.id;
  if (!fid) return;
  var store = _readAttendedStore();
  store[fid] = map;
  try {
    localStorage.setItem(ATTENDED_KEY, JSON.stringify(store));
  } catch {}
  try {
    window.dispatchEvent(new CustomEvent("plursky-attended-change"));
  } catch {}
}
function getAttendedForNight(night, festivalId) {
  return new Set(getAllAttended(festivalId)[night] || []);
}
function getAttendedCount(festivalId) {
  var all = getAllAttended(festivalId);
  return Object.values(all).reduce((s, arr) => s + (Array.isArray(arr) ? arr.length : 0), 0);
}
function markAttended(night, artistId, source = "manual") {
  if (!night || !artistId) return false;
  var fid = _attendedOwnerOf(artistId) || window.FESTIVAL_CONFIG?.id;
  var all = getAllAttended(fid);
  var list = all[night] || [];
  if (list.includes(artistId)) return false;
  all[night] = [...list, artistId];
  _writeAttended(all, fid);
  if (source === "gps") {
    try {
      var log = JSON.parse(localStorage.getItem("plursky_attended_source_v1") || "{}");
      log[artistId] = {
        source,
        ts: Date.now()
      };
      localStorage.setItem("plursky_attended_source_v1", JSON.stringify(log));
    } catch {}
  }
  return true;
}
function unmarkAttended(night, artistId) {
  if (!night || !artistId) return false;
  var fid = _attendedOwnerOf(artistId) || window.FESTIVAL_CONFIG?.id;
  var all = getAllAttended(fid);
  var list = (all[night] || []).filter(x => x !== artistId);
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
    var log = JSON.parse(localStorage.getItem("plursky_attended_source_v1") || "{}");
    return log[artistId]?.source || "manual";
  } catch {
    return "manual";
  }
}
function detectCurrentArtist(lat, lng, opts = {}) {
  if (typeof lat !== "number" || typeof lng !== "number") return null;
  var cfg = window.FESTIVAL_CONFIG;
  if (!cfg) return null;
  var anchors = attendEvidenceAnchors(cfg);
  if (anchors.length === 0) return null;
  var now = window.NOW;
  if (!now || !now.day || !now.time) return null;
  var gate = stageFixGate(anchors, {
    lat,
    lng,
    accuracy: opts.accuracy,
    timestamp: opts.timestamp
  }, typeof opts.atMs === "number" ? opts.atMs : Date.now(), opts.saver ? STAGE_FIX_ATTEND_SAVER : STAGE_FIX_ATTEND);
  if (gate.status !== "trusted") return null;
  var playing = activeLineup().find(a => a.stage === gate.stageId && isSetLive(a));
  if (!playing) return null;
  return {
    artistId: playing.id,
    stageId: gate.stageId,
    night: now.day,
    distM: Math.round(gate.distM)
  };
}
function recordAttendanceFromGps(lat, lng, opts) {
  var hit = detectCurrentArtist(lat, lng, opts);
  if (!hit) return null;
  var added = markAttended(hit.night, hit.artistId, "gps");
  return added ? hit : null;
}
var SET_TRACK_PREF_KEY = "plursky_set_tracking_v1";
var SET_TRACK_STORE_KEY = "plursky_set_intervals_v1";
var SET_TRACK_EVENT = "plursky-set-tracking-change";
function getSetTracking() {
  try {
    var v = localStorage.getItem(SET_TRACK_PREF_KEY);
    return v === "on" || v === "off" ? v : null;
  } catch {
    return null;
  }
}
function setSetTracking(on) {
  try {
    localStorage.setItem(SET_TRACK_PREF_KEY, on ? "on" : "off");
  } catch {}
  try {
    window.dispatchEvent(new CustomEvent(SET_TRACK_EVENT));
  } catch {}
}
function _readSetTrackStore() {
  try {
    var s = JSON.parse(localStorage.getItem(SET_TRACK_STORE_KEY) || "{}");
    return s && typeof s === "object" ? s : {};
  } catch {
    return {};
  }
}
function setTrackRecord(festivalId, fix) {
  if (!festivalId) return false;
  var all = _readSetTrackStore();
  all[festivalId] = setTrackAppend(all[festivalId], {
    ms: fix && fix.ms,
    stageId: fix && fix.stageId
  });
  try {
    localStorage.setItem(SET_TRACK_STORE_KEY, JSON.stringify(all));
  } catch {
    return false;
  }
  try {
    window.dispatchEvent(new CustomEvent(SET_TRACK_EVENT));
  } catch {}
  return true;
}
function getSetTrackIntervals(festivalId) {
  var e = _readSetTrackStore()[festivalId];
  return e && e.runs || {};
}
function clearSetTrack(festivalId) {
  var all = _readSetTrackStore();
  var taps = _readJsonStore(SET_TAP_STORE_KEY);
  var had = festivalId in all,
    hadTaps = festivalId in taps;
  if (!had && !hadTaps) return false;
  delete all[festivalId];
  delete taps[festivalId];
  _setTrackNativeClear();
  try {
    localStorage.setItem(SET_TRACK_STORE_KEY, JSON.stringify(all));
  } catch {}
  try {
    localStorage.setItem(SET_TAP_STORE_KEY, JSON.stringify(taps));
  } catch {}
  try {
    window.dispatchEvent(new CustomEvent(SET_TRACK_EVENT));
  } catch {}
  return true;
}
function clearAllSetTrack() {
  try {
    localStorage.removeItem(SET_TRACK_STORE_KEY);
  } catch {}
  try {
    localStorage.removeItem(SET_TAP_STORE_KEY);
  } catch {}
  _setTrackNativeClear();
  try {
    window.dispatchEvent(new CustomEvent(SET_TRACK_EVENT));
  } catch {}
}
function _setTrackHasAny() {
  return Object.keys(_readSetTrackStore()).length > 0 || Object.keys(_readJsonStore(SET_TAP_STORE_KEY)).length > 0;
}
function _setTrackNative() {
  var P = window.Capacitor?.isNativePlatform?.() && window.Capacitor?.Plugins?.SetTrack;
  return P && typeof P.drain === "function" ? P : null;
}
function _setTrackNativeClear() {
  var P = _setTrackNative();
  if (P) {
    try {
      P.clear().catch(() => {});
    } catch {}
  }
}
var _setTrackNativeOn = false;
var _setTrackInternal = false;
function _setTrackNativeSet(r) {
  if (!r) return;
  var on = !!r.tracking,
    internal = r.internal === undefined ? _setTrackInternal : !!r.internal;
  if (on === _setTrackNativeOn && internal === _setTrackInternal) return;
  _setTrackNativeOn = on;
  _setTrackInternal = internal;
  try {
    window.dispatchEvent(new CustomEvent(SET_TRACK_EVENT));
  } catch {}
}
function setTrackIngest(festivalId, fixes, cfg) {
  var c = cfg || window._DATA_SETS && window._DATA_SETS[festivalId] && window._DATA_SETS[festivalId].config;
  if (!festivalId || !c || !Array.isArray(fixes) || !fixes.length) return 0;
  var samples = fixes.filter(f => f && typeof f.timestamp === "number" && (!f.festivalId || f.festivalId === festivalId)).slice().sort((x, y) => x.timestamp - y.timestamp);
  var q = attendQualifyFixes(samples, attendEvidenceAnchors(c), STAGE_FIX_ATTEND);
  if (!q.length) return 0;
  var all = _readSetTrackStore();
  var e = all[festivalId];
  for (var f of q) e = setTrackAppend(e, f);
  all[festivalId] = e;
  try {
    localStorage.setItem(SET_TRACK_STORE_KEY, JSON.stringify(all));
  } catch {
    return 0;
  }
  try {
    window.dispatchEvent(new CustomEvent(SET_TRACK_EVENT));
  } catch {}
  return q.length;
}
var _setTrackDraining = null;
function setTrackDrainNative() {
  var P = _setTrackNative();
  if (!P) return Promise.resolve(0);
  if (_setTrackDraining) return _setTrackDraining;
  _setTrackDraining = P.drain().then(r => setTrackIngest(r && r.festivalId, r && r.fixes || [])).catch(() => 0).finally(() => {
    _setTrackDraining = null;
  });
  return _setTrackDraining;
}
var SET_TAP_STORE_KEY = "plursky_set_taps_v1";
var SET_MANUAL_STORE_KEY = "plursky_set_manual_v1";
var SET_MANUAL_VALUES = ["full", "partial", "absent"];
function _readJsonStore(key) {
  try {
    var s = JSON.parse(localStorage.getItem(key) || "{}");
    return s && typeof s === "object" && !Array.isArray(s) ? s : {};
  } catch {
    return {};
  }
}
function getSetTapPoints(festivalId) {
  var out = {};
  for (var t of _readJsonStore(SET_TAP_STORE_KEY)[festivalId] || []) {
    if (!t || typeof t.ms !== "number" || t.stageId == null) continue;
    (out[t.stageId] = out[t.stageId] || []).push({
      from: t.ms,
      to: t.ms,
      src: "photo",
      via: t.hand ? "hand" : "tap"
    });
  }
  return out;
}
function _recordSetTap(festivalId, ms, stageId, hand = false) {
  var all = _readJsonStore(SET_TAP_STORE_KEY);
  var list = Array.isArray(all[festivalId]) ? all[festivalId] : [];
  if (!list.some(t => t.ms === ms && t.stageId === stageId)) list.push(hand ? {
    ms,
    stageId,
    hand: true
  } : {
    ms,
    stageId
  });
  all[festivalId] = list;
  try {
    localStorage.setItem(SET_TAP_STORE_KEY, JSON.stringify(all));
  } catch {
    return false;
  }
  try {
    window.dispatchEvent(new CustomEvent(SET_TRACK_EVENT));
  } catch {}
  return true;
}
var _fgEpoch = 0;
try {
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") _fgEpoch++;
  });
} catch {}
var _appHidden = () => {
  try {
    return document.visibilityState === "hidden";
  } catch {
    return false;
  }
};
async function _foregroundFix() {
  if (_appHidden()) return {
    hidden: true
  };
  var epoch = _fgEpoch;
  var fix = typeof _checkinFix === "function" ? await _checkinFix() : null;
  if (epoch !== _fgEpoch || _appHidden()) return {
    hidden: true
  };
  return fix;
}
async function setTrackStillHere(cfg = window.FESTIVAL_CONFIG) {
  if (setTrackEligibility(cfg, Date.now()) !== "live") return {
    status: "not-live"
  };
  var fix = await _foregroundFix();
  if (fix && fix.hidden) return {
    status: "hidden"
  };
  if (!fix) return {
    status: "none"
  };
  if (fix.denied) return {
    status: "denied"
  };
  var now = Date.now();
  var g = stageFixGate(attendEvidenceAnchors(cfg), fix, now, STAGE_FIX_ATTEND);
  if (g.status !== "trusted") return {
    status: g.status
  };
  var ms = typeof fix.timestamp === "number" ? fix.timestamp : now;
  _recordSetTap(cfg.id, ms, g.stageId);
  return {
    status: "trusted",
    stageId: g.stageId,
    ms
  };
}
function setTrackStillHereHand(cfg, a, nowMs = Date.now()) {
  if (!cfg || !cfg.id || !a || !a.stage) return {
    status: "none"
  };
  var phase = typeof _festivalPhase === "function" ? _festivalPhase({
    config: cfg
  }, nowMs) : "upcoming";
  if (phase !== "live") return {
    status: "not-live"
  };
  _recordSetTap(cfg.id, nowMs, a.stage, true);
  return {
    status: "hand",
    stageId: a.stage,
    ms: nowMs
  };
}
function getSetManual(festivalId, artistId) {
  var v = (_readJsonStore(SET_MANUAL_STORE_KEY)[festivalId] || {})[artistId];
  return SET_MANUAL_VALUES.includes(v) ? v : null;
}
function setSetManual(festivalId, artistId, value) {
  if (!festivalId || !artistId) return false;
  if (value != null && !SET_MANUAL_VALUES.includes(value)) return false;
  var all = _readJsonStore(SET_MANUAL_STORE_KEY);
  var fest = {
    ...(all[festivalId] || {})
  };
  if (value == null) delete fest[artistId];else fest[artistId] = value;
  all[festivalId] = fest;
  try {
    localStorage.setItem(SET_MANUAL_STORE_KEY, JSON.stringify(all));
  } catch {
    return false;
  }
  try {
    window.dispatchEvent(new CustomEvent(SET_TRACK_EVENT));
  } catch {}
  return true;
}
var _setMomentMemo = {
  raw: null,
  fid: null,
  out: {}
};
function _setMomentPoints(cfg) {
  var raw = null;
  try {
    raw = localStorage.getItem(typeof MOMENTS_KEY !== "undefined" ? MOMENTS_KEY : "plursky_moments_v1");
  } catch {}
  if (_setMomentMemo.raw === raw && _setMomentMemo.fid === cfg.id) return _setMomentMemo.out;
  var moments = {};
  try {
    moments = JSON.parse(raw || "{}") || {};
  } catch {}
  var ds = _attendedDataSets()[cfg.id] || {};
  var out = attendMomentPoints(moments, cfg, ds.artists || window.ARTISTS || []);
  _setMomentMemo = {
    raw,
    fid: cfg.id,
    out
  };
  return out;
}
function setTrackEvidence(cfg = window.FESTIVAL_CONFIG) {
  if (!cfg || !cfg.id) return {};
  return attendMergeEvidence(getSetTrackIntervals(cfg.id), getSetTapPoints(cfg.id), _setMomentPoints(cfg));
}
var SET_CALIB_STORE_KEY = "plursky_stage_calib_v1";
var STAGE_CALIB = {
  maxAccM: 30,
  minGapMs: 10 * 60000,
  agreeM: 30,
  venuePadM: 300
};
function _readCalib(festivalId) {
  var e = _readJsonStore(SET_CALIB_STORE_KEY)[festivalId] || {};
  return {
    pending: e.pending && typeof e.pending === "object" ? e.pending : {},
    anchors: e.anchors && typeof e.anchors === "object" ? e.anchors : {}
  };
}
function _writeCalib(festivalId, e) {
  var all = _readJsonStore(SET_CALIB_STORE_KEY);
  all[festivalId] = e;
  try {
    localStorage.setItem(SET_CALIB_STORE_KEY, JSON.stringify(all));
  } catch {
    return false;
  }
  try {
    window.dispatchEvent(new CustomEvent(SET_TRACK_EVENT));
  } catch {}
  return true;
}
function _stageIsMobile(stageId, stages) {
  var st = (stages || []).find(x => x && x.id === stageId);
  return /art[- ]car/i.test(String(stageId || "")) || !!(st && /art[- ]car/i.test(st.name || ""));
}
function _calibStages(cfg) {
  var ds = _attendedDataSets()[cfg.id] || {};
  var active = window.FESTIVAL_CONFIG && window.FESTIVAL_CONFIG.id === cfg.id;
  var stages = ds.stages || (active ? window.STAGES : null) || [];
  var artists = ds.artists || (active ? window.ARTISTS : null) || [];
  var used = new Set(artists.map(a => a && a.stage).filter(Boolean));
  return (used.size ? stages.filter(st => used.has(st.id)) : stages).filter(st => !_stageIsMobile(st.id, stages));
}
function stageCalibrationAnchors(cfg, measuredIds = new Set()) {
  if (!cfg || !cfg.id) return [];
  var anchors = _readCalib(cfg.id).anchors;
  var need = _calibStages(cfg).map(st => st.id).filter(id => !measuredIds.has(id));
  if (!need.length || need.some(id => !anchors[id])) return [];
  return need.map(id => ({
    stageId: id,
    lat: anchors[id].lat,
    lng: anchors[id].lng,
    anchorSource: "device"
  }));
}
function _calibOnSite(cfg, fix) {
  var b = cfg && cfg.mapGeoref && cfg.mapGeoref.bounds;
  if (!Array.isArray(b) || b.length !== 4) return true;
  var padLat = STAGE_CALIB.venuePadM / 111320,
    padLng = STAGE_CALIB.venuePadM / (111320 * Math.cos(fix.lat * Math.PI / 180));
  return fix.lng >= b[0] - padLng && fix.lng <= b[2] + padLng && fix.lat >= b[1] - padLat && fix.lat <= b[3] + padLat;
}
function calibrateStageTap(cfg, stageId, fix, nowMs = Date.now()) {
  if (!cfg || !cfg.id || !stageId) return {
    status: "none"
  };
  var phase = typeof _festivalPhase === "function" ? _festivalPhase({
    config: cfg
  }, nowMs) : "upcoming";
  if (phase !== "live") return {
    status: "not-live"
  };
  if (!fix) return {
    status: "none"
  };
  if (fix.denied) return {
    status: "denied"
  };
  if (!Number.isFinite(fix.lat) || !Number.isFinite(fix.lng)) return {
    status: "none"
  };
  if (!Number.isFinite(fix.accuracy) || fix.accuracy > STAGE_CALIB.maxAccM) return {
    status: "coarse",
    accM: Number.isFinite(fix.accuracy) ? fix.accuracy : null
  };
  if (!_calibOnSite(cfg, fix)) return {
    status: "off-site"
  };
  var ms = typeof fix.timestamp === "number" ? fix.timestamp : nowMs;
  var e = _readCalib(cfg.id);
  var p = e.pending[stageId];
  if (p && ms - p.ms < STAGE_CALIB.minGapMs) return {
    status: "too-soon",
    waitMs: STAGE_CALIB.minGapMs - (ms - p.ms)
  };
  if (p && _haversineMeters(p.lat, p.lng, fix.lat, fix.lng) <= STAGE_CALIB.agreeM) {
    e.anchors[stageId] = {
      lat: (p.lat + fix.lat) / 2,
      lng: (p.lng + fix.lng) / 2,
      ms
    };
    delete e.pending[stageId];
    _writeCalib(cfg.id, e);
    return {
      status: "set"
    };
  }
  e.pending[stageId] = {
    ms,
    lat: fix.lat,
    lng: fix.lng
  };
  _writeCalib(cfg.id, e);
  return {
    status: p ? "moved" : "first"
  };
}
async function stageCalibrateNow(cfg, stageId) {
  var fix = await _foregroundFix();
  if (fix && fix.hidden) return {
    status: "hidden"
  };
  return calibrateStageTap(cfg, stageId, fix, Date.now());
}
function clearStageCalibration(festivalId) {
  var all = _readJsonStore(SET_CALIB_STORE_KEY);
  if (!(festivalId in all)) return false;
  delete all[festivalId];
  try {
    localStorage.setItem(SET_CALIB_STORE_KEY, JSON.stringify(all));
  } catch {}
  try {
    window.dispatchEvent(new CustomEvent(SET_TRACK_EVENT));
  } catch {}
  return true;
}
function setTrackVerdict(a, cfg = window.FESTIVAL_CONFIG) {
  if (!a || !cfg || !cfg.id) return null;
  var manual = getSetManual(cfg.id, a.id);
  if (manual === "absent") return null;
  var iv = setTrackEvidence(cfg);
  if (!manual && (!iv[a.stage] || !iv[a.stage].length)) return null;
  var v = attendanceVerdict(a, iv, cfg, manual ? {
    manual
  } : {});
  if (v.verdict === "none") return null;
  var label = attendanceVerdictLabel(v);
  return {
    ...v,
    manual,
    label: manual && label ? `${label} · your edit` : label
  };
}
function setTrackSummary(artists, cfg = window.FESTIVAL_CONFIG) {
  var out = {
    full: 0,
    partial: 0
  };
  for (var a of artists || []) {
    var v = setTrackVerdict(a, cfg);
    if (v && v.verdict === "full") out.full++;else if (v && v.verdict === "partial") out.partial++;
  }
  return out;
}
function SetTrackingWatcher() {
  var [, bump] = React.useReducer(x => x + 1, 0);
  var native = !!_setTrackNative();
  var {
    active: bsActive
  } = useBatterySaver();
  React.useEffect(() => {
    var on = () => bump();
    window.addEventListener(SET_TRACK_EVENT, on);
    document.addEventListener("visibilitychange", on);
    var t = setInterval(on, 60000);
    return () => {
      window.removeEventListener(SET_TRACK_EVENT, on);
      document.removeEventListener("visibilitychange", on);
      clearInterval(t);
    };
  }, []);
  var cfg = window.FESTIVAL_CONFIG;
  var fid = cfg && cfg.id;
  var pref = getSetTracking() === "on";
  var visible = document.visibilityState !== "hidden";
  var elig = setTrackEligibility(cfg, Date.now());
  React.useEffect(() => {
    var P = _setTrackNative();
    if (!P || !visible) return;
    var alive = true;
    try {
      P.status().then(r => alive && _setTrackNativeSet(r)).catch(() => {});
    } catch {}
    setTrackDrainNative().then(() => {
      if (!alive) return;
      if (pref && fid && elig === "live") {
        var ds = window._DATA_SETS && window._DATA_SETS[fid];
        P.arm({
          festivalId: fid,
          windows: setTrackWindows(cfg, ds && ds.artists || window.ARTISTS || [], Date.now()),
          saver: !!bsActive
        }).then(r => alive && _setTrackNativeSet(r)).catch(() => {});
      } else {
        P.disarm().then(() => alive && _setTrackNativeSet({
          tracking: false
        })).catch(() => {});
      }
    });
    var t = setInterval(() => {
      setTrackDrainNative();
      try {
        P.status().then(r => alive && _setTrackNativeSet(r)).catch(() => {});
      } catch {}
    }, 60000);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, [native, visible, pref, fid, elig, bsActive]);
  var run = getSetTracking() === "on" && document.visibilityState !== "hidden" && setTrackEligibility(cfg, Date.now()) === "live" && !(native && _setTrackNativeOn);
  React.useEffect(() => {
    if (!run || !navigator.geolocation) return;
    var anchors = attendEvidenceAnchors(cfg);
    var rules = bsActive ? STAGE_FIX_ATTEND_SAVER : STAGE_FIX_ATTEND;
    var opts = bsActive ? {
      enableHighAccuracy: false,
      maximumAge: 30000,
      timeout: 30000
    } : {
      enableHighAccuracy: true,
      maximumAge: 4000,
      timeout: 15000
    };
    var alive = true;
    var id = navigator.geolocation.watchPosition(p => {
      if (!alive || !p || !p.coords) return;
      var q = attendQualifyFixes([{
        lat: p.coords.latitude,
        lng: p.coords.longitude,
        accuracy: p.coords.accuracy,
        timestamp: p.timestamp,
        atMs: Date.now()
      }], anchors, rules);
      if (q.length) setTrackRecord(fid, q[0]);
    }, () => {}, opts);
    return () => {
      alive = false;
      try {
        navigator.geolocation.clearWatch(id);
      } catch {}
    };
  }, [run, fid, bsActive]);
  return null;
}
function _artistStartMs(artist) {
  return _wallMs(artistDayDate(artist), artist && artist.start, FESTIVAL_CONFIG && FESTIVAL_CONFIG.tz);
}
var _REMINDERS_KEY = "reminders_v1";
var _REMINDER_LEAD_KEY = "plursky_reminder_lead_min";
var _REMINDER_LEAD_OPTIONS = [5, 15, 30, 60];
var _SCHEDULED = new Map();
function getReminderLeadMin() {
  try {
    var raw = parseInt(localStorage.getItem(_REMINDER_LEAD_KEY) || "", 10);
    if (_REMINDER_LEAD_OPTIONS.includes(raw)) return raw;
  } catch {}
  return 15;
}
function setReminderLeadMin(mins) {
  if (!_REMINDER_LEAD_OPTIONS.includes(mins)) return;
  try {
    localStorage.setItem(_REMINDER_LEAD_KEY, String(mins));
  } catch {}
}
function _reminderText(p) {
  var lead = p.leadMin || 15;
  return p.late ? {
    title: `${p.name}: you arrive in ${lead} min`,
    body: `${p.stageName} · you arrive ${fmt12(p.start)}`
  } : {
    title: `${p.name} starts in ${lead} min`,
    body: `${p.stageName} · ${fmt12(p.start)}`
  };
}
function scheduleReminders(state, showLocal) {
  var ln = _capLocalNotifications();
  var now = Date.now();
  var leadMin = getReminderLeadMin();
  var pending = [];
  var lineup = activeLineup(state.saved);
  var ids = typeof reminderSetIds === "function" ? reminderSetIds(state.saved) : state.saved;
  ids.forEach(id => {
    var found = lineup.find(x => x.id === id);
    if (!found) return;
    var win = typeof attendWindow === "function" && state.saved.includes(id) ? attendWindow(found, undefined, state.saved) : null;
    var a = win && win.partial ? {
      ...found,
      start: win.start
    } : found;
    var startMs = _artistStartMs(a);
    if (!startMs) return;
    var fireMs = startMs - leadMin * 60000;
    var delayMs = fireMs - now;
    if (delayMs <= 0 || delayMs > 24 * 3600000) return;
    var stage = STAGES.find(s => s.id === a.stage);
    pending.push({
      id: a.id,
      notifId: _notifIdForArtist(a.id),
      name: a.name,
      stageName: stage?.name || "",
      start: a.start,
      late: a.start !== found.start,
      fireMs,
      leadMin
    });
  });
  if (ln) {
    var persisted = [];
    try {
      persisted = JSON.parse(localStorage.getItem(_REMINDERS_KEY) || "[]").map(p => p && p.notifId);
    } catch {}
    var prevIds = [...Array.from(_SCHEDULED.values()), ...persisted].filter(v => typeof v === "number");
    var allIds = new Set([...prevIds, ...pending.map(p => p.notifId)]);
    _SCHEDULED.clear();
    ln.cancel({
      notifications: [...allIds].map(id => ({
        id
      }))
    }).catch(() => {});
    if (pending.length > 0) {
      ln.schedule({
        notifications: pending.map(p => ({
          id: p.notifId,
          title: _reminderText(p).title,
          body: _reminderText(p).body,
          schedule: {
            at: new Date(p.fireMs),
            allowWhileIdle: true
          },
          extra: {
            artistId: p.id,
            url: "/"
          }
        }))
      }).catch(() => {});
    }
    pending.forEach(p => _SCHEDULED.set(p.id, p.notifId));
    try {
      localStorage.setItem(_REMINDERS_KEY, JSON.stringify(pending));
    } catch {}
    return _SCHEDULED.size;
  }
  _SCHEDULED.forEach(h => clearTimeout(h));
  _SCHEDULED.clear();
  pending.forEach(p => {
    var handle = setTimeout(() => {
      showLocal(_reminderText(p).title, {
        body: _reminderText(p).body,
        tag: `set-${p.id}`,
        data: {
          url: "/"
        }
      });
      _SCHEDULED.delete(p.id);
    }, p.fireMs - now);
    _SCHEDULED.set(p.id, handle);
  });
  try {
    localStorage.setItem(_REMINDERS_KEY, JSON.stringify(pending));
  } catch {}
  return _SCHEDULED.size;
}
function loadAndReschedule(showLocal) {
  if (_capLocalNotifications()) return 0;
  var count = 0;
  try {
    var saved = JSON.parse(localStorage.getItem(_REMINDERS_KEY) || "[]");
    var now = Date.now();
    var live = saved.filter(r => r.fireMs > now && r.fireMs - now <= 24 * 3600000);
    live.forEach(r => {
      if (_SCHEDULED.has(r.id)) return;
      var handle = setTimeout(() => {
        showLocal(_reminderText(r).title, {
          body: _reminderText(r).body,
          tag: `set-${r.id}`,
          data: {
            url: "/"
          }
        });
        _SCHEDULED.delete(r.id);
      }, r.fireMs - now);
      _SCHEDULED.set(r.id, handle);
      count++;
    });
    if (live.length !== saved.length) localStorage.setItem(_REMINDERS_KEY, JSON.stringify(live));
  } catch {}
  return count;
}
function NotificationsCard({
  state
}) {
  var {
    supported,
    perm,
    enable,
    showLocal
  } = useNotifications();
  var [scheduled, setScheduled] = React.useState(0);
  var [flash, setFlash] = React.useState(null);
  var [leadMin, setLeadMinState] = React.useState(getReminderLeadMin);
  var onPickLead = mins => {
    setReminderLeadMin(mins);
    setLeadMinState(mins);
    if (perm === "granted") setScheduled(scheduleReminders(state, showLocal));
  };
  React.useEffect(() => {
    if (perm === "granted") {
      var n = loadAndReschedule(showLocal);
      if (n > 0) setScheduled(n);
    }
  }, []);
  React.useEffect(() => {
    if (perm === "granted") setScheduled(scheduleReminders(state, showLocal));
  }, [perm, state.saved.join(",")]);
  var onEnable = async () => {
    var r = await enable();
    if (r === "granted") {
      var n = scheduleReminders(state, showLocal);
      setScheduled(n);
      setFlash("enabled");
      setTimeout(() => setFlash(null), 2000);
    }
  };
  var onTest = async () => {
    var ok = await showLocal("Plursky reminder · TEST", {
      body: "This is what set-start alerts will look like.",
      tag: "plursky-test"
    });
    if (ok) {
      setFlash("tested");
      setTimeout(() => setFlash(null), 1800);
    }
  };
  if (!supported) {
    return React.createElement("div", {
      style: {
        padding: "14px 16px",
        borderRadius: "var(--rad-md)",
        background: "var(--s2)",
        boxShadow: "var(--e1)",
        border: "none",
        marginBottom: 12
      }
    }, React.createElement("div", {
      className: "duo-label",
      style: {
        color: "var(--ink-3)"
      }
    }, "NOTIFICATIONS · UNSUPPORTED"), React.createElement("div", {
      style: {
        fontSize: 14,
        color: "var(--ink-2)",
        marginTop: 4,
        lineHeight: 1.43
      }
    }, window.Capacitor?.isNativePlatform?.() ? "Notifications aren't wired in this build yet — set-time reminders will land in a future update." : "Your browser doesn't support web notifications. Install Plursky to your home screen for the full experience."));
  }
  var label = perm === "granted" ? "ENABLED" : perm === "denied" ? "BLOCKED" : "OFF";
  var labelColor = perm === "granted" ? "var(--acc-ink)" : perm === "denied" ? "var(--alert)" : "var(--ink-2)";
  return React.createElement("div", {
    style: {
      padding: 16,
      borderRadius: "var(--rad-md)",
      background: "var(--s2)",
      boxShadow: "var(--e1)",
      border: "none",
      marginBottom: 12
    }
  }, React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      marginBottom: 6
    }
  }, React.createElement("div", {
    className: "duo-label",
    style: {
      color: "var(--ink-3)"
    }
  }, "REMINDERS"), React.createElement("span", {
    className: "duo-label",
    style: {
      color: labelColor
    }
  }, flash === "enabled" ? "✓ ENABLED" : flash === "tested" ? "✓ TEST SENT" : label)), React.createElement("div", {
    className: "duo-headline",
    style: {
      marginBottom: 4
    }
  }, leadMin, "-min head-up before each set"), React.createElement("div", {
    style: {
      fontSize: 14,
      color: "var(--ink-2)",
      lineHeight: 1.43,
      marginBottom: perm === "denied" ? 8 : 12
    }
  }, perm === "granted" ? scheduled > 0 ? `${scheduled} reminder${scheduled === 1 ? "" : "s"} set · alerts fire even when Plursky is in the background.` : "No sets starting in the next 24 hours — reminders will activate automatically during the festival." : perm === "denied" ? window.Capacitor?.isNativePlatform?.() ? "Notifications are blocked in iOS Settings." : "Notifications are blocked for this site." : `Get a notification ${leadMin} minutes before each saved set so you don't miss a thing.`), React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      gap: 8,
      marginBottom: 12,
      flexWrap: "wrap"
    }
  }, React.createElement("span", {
    className: "duo-label",
    style: {
      color: "var(--ink-3)"
    }
  }, "LEAD TIME"), React.createElement("div", {
    style: {
      display: "flex",
      gap: 5
    }
  }, _REMINDER_LEAD_OPTIONS.map(m => {
    var on = m === leadMin;
    return React.createElement("button", {
      key: m,
      onClick: () => onPickLead(m),
      className: "mono",
      style: {
        padding: "4px 9px",
        borderRadius: 999,
        cursor: "pointer",
        background: on ? "var(--s1)" : "transparent",
        boxShadow: on ? "var(--e1)" : "none",
        color: on ? "var(--ink)" : "var(--ink-2)",
        border: on ? "none" : "1px solid var(--line-2)",
        fontSize: 10,
        letterSpacing: 1.1,
        fontWeight: on ? 700 : 500
      }
    }, m, "M");
  }))), perm === "denied" && React.createElement("div", {
    style: {
      background: "var(--s3)",
      border: "none",
      borderRadius: "var(--rad-sm)",
      padding: "10px 12px",
      marginBottom: 12
    }
  }, React.createElement("div", {
    className: "duo-label",
    style: {
      color: "var(--ink-3)",
      marginBottom: 6
    }
  }, "HOW TO RE-ENABLE"), window.Capacitor?.isNativePlatform?.() ? React.createElement("div", {
    style: {
      fontSize: 13,
      color: "var(--ink)",
      lineHeight: 1.55
    }
  }, "iPhone: ", React.createElement("strong", null, "Settings"), " → ", React.createElement("strong", null, "Plursky"), " → ", React.createElement("strong", null, "Notifications"), " → set ", React.createElement("em", null, "Allow Notifications"), " ON.") : /iPhone|iPad|iPod/.test(navigator.userAgent) ? React.createElement("div", {
    style: {
      fontSize: 13,
      color: "var(--ink)",
      lineHeight: 1.55
    }
  }, "iPhone: ", React.createElement("strong", null, "Settings"), " → ", React.createElement("strong", null, "Apps"), " → ", React.createElement("strong", null, "Safari"), " → ", React.createElement("strong", null, "Notifications"), " → find ", React.createElement("em", null, "plursky.com"), " → Allow") : React.createElement("div", {
    style: {
      fontSize: 13,
      color: "var(--ink)",
      lineHeight: 1.55
    }
  }, "Tap the ", React.createElement("strong", null, "lock icon"), " (or ", React.createElement("strong", null, "ⓘ"), ") in your browser's address bar → ", React.createElement("strong", null, "Site settings"), " → ", React.createElement("strong", null, "Notifications"), " → set to ", React.createElement("strong", null, "Allow"), ", then reload.")), React.createElement("div", {
    style: {
      display: "flex",
      gap: 8,
      flexWrap: "wrap"
    }
  }, perm !== "granted" && perm !== "denied" && React.createElement("button", {
    onClick: onEnable,
    style: {
      background: "var(--ember)",
      color: "var(--on-ember)",
      border: "none",
      borderRadius: 999,
      padding: "8px 14px",
      cursor: "pointer",
      fontFamily: "Geist Mono, monospace",
      fontSize: 10,
      letterSpacing: 1.2,
      fontWeight: 700
    }
  }, "ENABLE"), perm === "granted" && React.createElement("button", {
    onClick: onTest,
    style: {
      background: "transparent",
      color: "var(--ink)",
      border: "1px solid var(--line-2)",
      borderRadius: 999,
      padding: "8px 14px",
      cursor: "pointer",
      fontFamily: "Geist Mono, monospace",
      fontSize: 10,
      letterSpacing: 1.2,
      fontWeight: 600
    }
  }, "SEND A TEST")));
}
function FestivalChip({
  compact = false,
  accent = "var(--ink)",
  title = null
}) {
  var [open, setOpen] = React.useState(false);
  var canSwitch = FESTIVALS_REGISTRY.filter(f => f.available).length > 1;
  if (title) return React.createElement(React.Fragment, null, React.createElement("button", {
    type: "button",
    className: "duo-press",
    onClick: canSwitch ? () => setOpen(true) : undefined,
    disabled: !canSwitch,
    "aria-label": canSwitch ? `${FESTIVAL_CONFIG.shortName.toUpperCase()}, switch festival` : undefined,
    style: {
      display: "inline-flex",
      alignItems: "flex-end",
      gap: 8,
      width: "auto",
      maxWidth: "100%",
      color: "var(--ink)",
      cursor: canSwitch ? "pointer" : "default"
    }
  }, title, canSwitch && React.createElement("span", {
    "aria-hidden": "true",
    style: {
      flex: "none",
      marginBottom: "0.32em",
      width: 28,
      height: 28,
      borderRadius: 14,
      display: "grid",
      placeItems: "center",
      background: "var(--s2)",
      boxShadow: "var(--e1)",
      color: "var(--ink-2)"
    }
  }, React.createElement("svg", {
    width: "12",
    height: "12",
    viewBox: "0 0 12 12",
    fill: "none"
  }, React.createElement("path", {
    d: "M3 4.5 L6 7.5 L9 4.5",
    stroke: "currentColor",
    strokeWidth: "1.7",
    strokeLinecap: "round",
    strokeLinejoin: "round"
  })))), open && React.createElement(FestivalSwitcher, {
    onClose: () => setOpen(false)
  }));
  return React.createElement(React.Fragment, null, React.createElement("div", {
    onClick: canSwitch ? () => setOpen(true) : undefined,
    role: canSwitch ? "button" : undefined,
    tabIndex: canSwitch ? 0 : undefined,
    "aria-label": canSwitch ? `${FESTIVAL_CONFIG.shortName.toUpperCase()}, switch festival` : undefined,
    onKeyDown: canSwitch ? e => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        setOpen(true);
      }
    } : undefined,
    style: {
      display: "inline-flex",
      alignItems: "center",
      minHeight: 44,
      color: accent,
      cursor: canSwitch ? "pointer" : "default",
      whiteSpace: "nowrap",
      userSelect: "none"
    }
  }, React.createElement("span", {
    style: {
      display: "inline-flex",
      alignItems: "center",
      gap: 6,
      height: 32,
      padding: "0 12px",
      borderRadius: 18,
      background: "var(--chrome)",
      border: "1px solid var(--line)",
      fontSize: 11,
      lineHeight: "14px",
      fontWeight: 600,
      letterSpacing: "0.04em"
    }
  }, React.createElement("span", null, FESTIVAL_CONFIG.shortName.toUpperCase()), canSwitch && React.createElement("svg", {
    width: "10",
    height: "10",
    viewBox: "0 0 12 12",
    fill: "none"
  }, React.createElement("path", {
    d: "M3 4.5 L6 7.5 L9 4.5",
    stroke: "currentColor",
    strokeWidth: "1.6",
    strokeLinecap: "round",
    strokeLinejoin: "round"
  })))), open && React.createElement(FestivalSwitcher, {
    onClose: () => setOpen(false)
  }));
}
function festivalArtFor(id) {
  var rec = id && window.PLURSKY_FESTIVAL_ART?.[id];
  return rec && /^festival-art\/tiles\/[a-z0-9-]+\.webp$/.test(rec.tile || "") && rec.sourcePage ? rec : null;
}
function FestivalThumb({
  entry,
  size = 56,
  editorial = false
}) {
  var rec = festivalArtFor(entry?.config?.id);
  var art = editorial ? rec?.card || rec?.tile || null : rec?.tile || null;
  var name = entry?.config?.shortName || entry?.config?.brand || entry?.config?.name || "Plur";
  var brand = String(entry?.config?.brand || "").trim();
  var mark = (/^[A-Za-z0-9]{2,6}$/.test(brand) ? brand : String(entry?.config?.name || name).split(/\s+/).filter(w => w && !/^\d+$/.test(w)).slice(0, 3).map(x => x[0]).join("")).toUpperCase();
  var accent = /^#[0-9a-f]{6}$/i.test(entry?.accent || "") ? entry.accent : null;
  return React.createElement("div", {
    "aria-hidden": "true",
    "data-festival-thumb": entry?.config?.id || "",
    "data-art": art ? "ledger" : accent ? "tinted" : "plain",
    style: {
      width: size,
      height: size,
      borderRadius: editorial ? "var(--rad-sm)" : 12,
      overflow: "hidden",
      flexShrink: 0,
      background: art ? "#1C1B19" : accent ? `color-mix(in srgb, ${accent} 26%, var(--s3))` : "var(--s3)",
      boxShadow: !art && accent ? `inset 0 0 0 1px color-mix(in srgb, ${accent} 45%, transparent)` : undefined,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      fontFamily: "var(--f-display)",
      fontSize: Math.max(13, Math.round(size * (editorial ? 0.16 : 0.22))),
      fontWeight: 400,
      letterSpacing: "0.12em",
      color: "var(--ink)",
      lineHeight: 1
    }
  }, art ? React.createElement("img", {
    src: `./${art}`,
    alt: "",
    style: {
      width: "100%",
      height: "100%",
      objectFit: "cover"
    }
  }) : mark);
}
function photoLicenseLabel(id) {
  return String(id || "").replace(/^CC-/, "CC ").replace(/-(\d)/, " $1").replace(/-DE$/, " DE").replace(/^(Public|Press)-/, "$1 ");
}
var _photoCreditLink = {
  color: "inherit",
  textDecoration: "underline",
  textUnderlineOffset: 2
};
function PhotoCredit({
  credit,
  style,
  ...rest
}) {
  if (!credit || !credit.author || !credit.sourceUrl || !credit.license || !credit.licenseUrl) return null;
  var lic = photoLicenseLabel(credit.license),
    changes = credit.changes || "";
  return React.createElement("div", {
    "aria-label": "Photo credit: " + credit.author + ", " + lic + (changes ? ", " + changes.toLowerCase() : ""),
    ...rest,
    style: {
      fontSize: "var(--fs-label)",
      lineHeight: "16px",
      color: "var(--text-3)",
      ...style
    }
  }, React.createElement("a", {
    href: credit.sourceUrl,
    target: "_blank",
    rel: "noopener noreferrer",
    style: _photoCreditLink
  }, credit.author), " · ", React.createElement("a", {
    href: credit.licenseUrl,
    target: "_blank",
    rel: "noopener noreferrer",
    style: _photoCreditLink
  }, lic), changes ? " · " + changes : "");
}
function festivalPhotoCredits() {
  var art = window.PLURSKY_FESTIVAL_ART || {};
  var sets = window._DATA_SETS || {};
  var reg = window.FESTIVALS_REGISTRY || [];
  return Object.keys(art).filter(id => art[id].author && art[id].licenseId && art[id].licenseUrl).map(id => {
    var r = art[id],
      cfg = sets[id]?.config || reg.find(f => f.config?.id === id)?.config;
    return {
      id,
      name: cfg?.name || id,
      credit: {
        author: r.author,
        sourceUrl: r.sourcePage,
        license: r.licenseId,
        licenseUrl: r.licenseUrl,
        changes: r.changes
      }
    };
  }).sort((a, b) => a.name.localeCompare(b.name));
}
function PhotoCreditsSheet({
  onClose
}) {
  var rows = festivalPhotoCredits();
  return React.createElement(FieldSheet, {
    title: "Photo credits",
    eyebrow: "FESTIVAL PHOTOS",
    onClose: onClose
  }, React.createElement("p", {
    style: {
      margin: "-4px 0 14px",
      color: "var(--ink-2)",
      font: "400 15px/1.4 var(--f-ui)"
    }
  }, "These festival photos are shared under open licences. Each links to its source and its licence. Each cropped CC BY-SA photo is distributed under the same linked licence."), React.createElement("div", {
    "data-photo-credits": "1"
  }, rows.map(r => React.createElement("div", {
    key: r.id,
    "data-photo-credit-row": r.id,
    style: {
      padding: "10px 0",
      borderTop: "1px solid var(--line)"
    }
  }, React.createElement("div", {
    style: {
      fontSize: 15,
      lineHeight: "20px",
      fontWeight: 600,
      marginBottom: 2
    }
  }, r.name), React.createElement(PhotoCredit, {
    credit: r.credit
  })))));
}
function _festivalPlanStatus(id) {
  var ids = [];
  try {
    ids = JSON.parse(localStorage.getItem(`${id}_saved_v1`) || "[]");
  } catch {}
  if (!Array.isArray(ids) || !ids.length) return {
    saved: 0,
    conflicts: 0
  };
  var set = new Set(ids);
  var arts = ((window._DATA_SETS || {})[id]?.artists || []).filter(a => set.has(a.id));
  var sameWeekend = (a, b) => !a.weekend || !b.weekend || a.weekend === "both" || b.weekend === "both" || a.weekend === b.weekend;
  var conflicts = 0;
  for (var _i2 = 0; _i2 < arts.length; _i2++) for (var j = _i2 + 1; j < arts.length; j++) if (arts[_i2].day === arts[j].day && sameWeekend(arts[_i2], arts[j]) && typeof setsClash === "function" && setsClash(arts[_i2], arts[j], id, ids)) conflicts++;
  return {
    saved: arts.length,
    conflicts
  };
}
function FestivalSwitcher({
  onClose
}) {
  var activeId = FESTIVAL_CONFIG.id;
  var [plusOpen, setPlusOpen] = React.useState(false);
  var [pastOpen, setPastOpen] = React.useState(false);
  var [creditsOpen, setCreditsOpen] = React.useState(false);
  var pastIndex = usePastEditionIndex();
  var [viewMode, setViewMode] = React.useState(() => {
    try {
      return localStorage.getItem("plursky_switcher_view_v1") || "grid";
    } catch {
      return "grid";
    }
  });
  var chooseView = mode => {
    setViewMode(mode);
    try {
      localStorage.setItem("plursky_switcher_view_v1", mode);
    } catch {}
  };
  var onPick = (id, entry) => {
    if (id === activeId) {
      onClose();
      return;
    }
    if (entry.available) {
      setActiveFestivalAndReload(id);
      return;
    }
    if (entry.previewOnly && festivalCanBeActive(entry)) {
      setActiveFestivalAndReload(id);
      return;
    }
    if (entry.previewOnly) {
      setPlusOpen(true);
      return;
    }
    onClose();
  };
  if (plusOpen) return React.createElement(PlusSheet, {
    feature: "early festival access",
    onClose: () => setPlusOpen(false)
  });
  var now = Date.now();
  var ordered = _sortFestivalsForSwitcher(FESTIVALS_REGISTRY, now);
  var phase = f => _festivalPhase(f, now);
  var live = ordered.filter(f => phase(f) === "live");
  var tba = ordered.filter(f => phase(f) === "tba");
  var past = ordered.filter(f => phase(f) === "ended");
  var months = [];
  ordered.filter(f => phase(f) === "upcoming").forEach(f => {
    var ev = _festivalEventDates(f.config);
    var ymd = ev ? ev.start : f.config.startMs ? new Date(f.config.startMs).toISOString().slice(0, 10) : null;
    var label = "Upcoming";
    if (ymd) {
      try {
        label = new Date(Date.UTC(+ymd.slice(0, 4), +ymd.slice(5, 7) - 1, 15)).toLocaleDateString(undefined, {
          month: "long",
          year: "numeric",
          timeZone: "UTC"
        });
      } catch {}
    }
    var g = months.find(x => x.label === label);
    if (!g) {
      g = {
        label,
        fests: []
      };
      months.push(g);
    }
    g.fests.push(f);
  });
  var archive = [];
  try {
    var raw = JSON.parse(localStorage.getItem("plursky_festival_archive_v1") || "{}");
    archive = (Array.isArray(raw) ? raw : Object.values(raw || {})).filter(a => a && typeof a === "object");
  } catch {}
  var caught = archive.reduce((n, a) => n + (a.totalAttended || 0), 0);
  var eyebrow = {
    margin: "0 0 4px"
  };
  var rowStyle = dim => ({
    width: "100%",
    display: "flex",
    alignItems: "center",
    gap: 12,
    minHeight: 72,
    padding: "8px 0",
    background: "transparent",
    border: "none",
    borderBottom: "1px solid var(--line)",
    color: "var(--ink)",
    textAlign: "left",
    fontFamily: "inherit",
    opacity: dim ? 0.55 : 1
  });
  var chevron = React.createElement("svg", {
    "aria-hidden": "true",
    width: "16",
    height: "16",
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "var(--text-3)",
    strokeWidth: "2",
    strokeLinecap: "round",
    strokeLinejoin: "round"
  }, React.createElement("path", {
    d: "M9 6 L15 12 L9 18"
  }));
  var row = f => {
    var isActive = f.config.id === activeId;
    var lookBack = !f.available && !f.previewOnly && !isActive ? pastEditionsOf(pastIndex, f.config.id)[0] : null;
    var locked = !f.available && !f.previewOnly && !isActive && !lookBack;
    var st = _festivalPlanStatus(f.config.id);
    var parts = [];
    if (st.saved) parts.push(React.createElement("span", {
      key: "s"
    }, st.saved, " saved"));
    if (st.conflicts) parts.push(React.createElement("span", {
      key: "c",
      style: {
        color: "var(--clash)",
        fontWeight: 600
      }
    }, st.conflicts, " ", st.conflicts === 1 ? "clash" : "clashes"));
    if (isActive) parts.push(React.createElement("span", {
      key: "a",
      style: {
        color: "var(--acc-ink)",
        fontWeight: 650
      }
    }, "Active"));else if (phase(f) === "ended") parts.push(React.createElement("span", {
      key: "e"
    }, "Ended"));else if (!f.available) {
      parts.push(React.createElement("span", {
        key: "l"
      }, f.previewOnly ? "Early access" : "Soon"));
      if (lookBack) parts.push(React.createElement("span", {
        key: "lb",
        style: {
          color: "var(--signal-ink)",
          fontWeight: 600
        }
      }, "Look back: ", lookBack.year));
    } else if (f.scheduleTBA) parts.push(React.createElement("span", {
      key: "tba"
    }, "Set times TBA"));else if (st.saved && !st.conflicts) parts.push(React.createElement("span", {
      key: "r",
      style: {
        color: "var(--acc-ink)",
        fontWeight: 650
      }
    }, "Ready"));
    return React.createElement("button", {
      key: f.config.id,
      onClick: () => lookBack ? (onClose(), openPastEdition(lookBack.id)) : onPick(f.config.id, f),
      disabled: locked,
      "aria-current": isActive ? "true" : undefined,
      style: {
        ...rowStyle(locked),
        cursor: locked ? "default" : "pointer"
      }
    }, React.createElement(FestivalThumb, {
      entry: f,
      editorial: viewMode === "grid"
    }), React.createElement("div", {
      style: {
        flex: 1,
        minWidth: 0
      }
    }, React.createElement("div", {
      className: "duo-headline"
    }, f.config.name), React.createElement("div", {
      style: {
        font: "400 13px/1.385 var(--f-ui)",
        color: "var(--ink-2)"
      }
    }, f.config.location, " · ", React.createElement("span", {
      style: {
        overflowWrap: "normal"
      }
    }, f.config.dates)), parts.length > 0 && React.createElement("div", {
      style: {
        marginTop: 2,
        font: "500 13px/1.385 var(--f-ui)",
        color: "var(--ink-2)"
      }
    }, parts.map((x, i) => React.createElement(React.Fragment, {
      key: i
    }, i ? " · " : "", x)))), !locked && chevron);
  };
  var group = (label, kids) => React.createElement("section", {
    key: label,
    style: {
      marginTop: 16
    }
  }, React.createElement("h3", {
    className: "duo-sect",
    style: eyebrow
  }, label), kids);
  return React.createElement(FieldSheet, {
    title: "Choose your sky.",
    onClose: onClose
  }, React.createElement("p", {
    style: {
      margin: "-4px 0 14px",
      color: "var(--ink-2)",
      font: "400 15px/1.4 var(--f-ui)"
    }
  }, "Live, next and remembered."), React.createElement("div", {
    role: "group",
    "aria-label": "Festival view",
    className: "duo-seg",
    style: {
      marginBottom: 12,
      background: "var(--s2)"
    }
  }, ["grid", "list"].map(mode => React.createElement("button", {
    key: mode,
    onClick: () => chooseView(mode),
    "aria-pressed": viewMode === mode,
    style: {
      textTransform: "capitalize"
    }
  }, mode))), React.createElement("div", {
    className: viewMode === "grid" ? "midnight-festival-grid" : undefined
  }, live.map(row), months.flatMap(g => g.fests.map(row)), tba.map(row)), viewMode === "list" && React.createElement("div", {
    className: "duo-data-s duo-ink3",
    style: {
      marginTop: 8
    }
  }, "ORDERED BY FESTIVAL DATE"), (past.length > 0 || archive.length > 0) && group("Past", React.createElement(React.Fragment, null, React.createElement("button", {
    onClick: () => setPastOpen(o => !o),
    "aria-expanded": pastOpen,
    style: {
      ...rowStyle(false),
      cursor: "pointer"
    }
  }, React.createElement(FestivalThumb, {
    entry: past[0] || null
  }), React.createElement("div", {
    style: {
      flex: 1,
      minWidth: 0
    }
  }, React.createElement("div", {
    style: {
      fontSize: 17,
      lineHeight: "22px",
      fontWeight: 600
    }
  }, "Memories"), React.createElement("div", {
    style: {
      fontSize: 13,
      lineHeight: "18px",
      color: "var(--text-2)",
      fontVariantNumeric: "tabular-nums"
    }
  }, Math.max(past.length, archive.length), " past ", Math.max(past.length, archive.length) === 1 ? "festival" : "festivals", caught ? ` · ${caught} sets caught` : "")), React.createElement("svg", {
    "aria-hidden": "true",
    width: "16",
    height: "16",
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "var(--text-3)",
    strokeWidth: "2",
    strokeLinecap: "round",
    strokeLinejoin: "round",
    style: {
      transform: pastOpen ? "rotate(90deg)" : "none",
      transition: "transform 180ms ease"
    }
  }, React.createElement("path", {
    d: "M9 6 L15 12 L9 18"
  }))), pastOpen && React.createElement(React.Fragment, null, past.map(row), React.createElement("button", {
    onClick: () => {
      onClose();
      (window._pushNav || (() => {}))({
        tab: "recap",
        artist: null
      });
    },
    style: {
      ...fieldIconBtn,
      width: "auto",
      padding: "0 4px",
      color: "var(--text-2)",
      fontSize: 15,
      fontWeight: 500
    }
  }, "Open recap")))), React.createElement("button", {
    onClick: () => {
      onClose();
      (window._pushNav || (() => {}))({
        tab: "past",
        pastEdition: null,
        artist: null
      });
    },
    style: {
      ...rowStyle(false),
      cursor: "pointer",
      marginTop: 8
    }
  }, React.createElement("div", {
    "aria-hidden": "true",
    style: {
      width: 44,
      height: 44,
      flexShrink: 0,
      borderRadius: 12,
      background: "var(--paper-3)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center"
    }
  }, React.createElement("svg", {
    width: "22",
    height: "22",
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "var(--text-2)",
    strokeWidth: "1.8",
    strokeLinecap: "round",
    strokeLinejoin: "round"
  }, React.createElement("rect", {
    x: "4",
    y: "5",
    width: "16",
    height: "15",
    rx: "2"
  }), React.createElement("path", {
    d: "M4 10 H20 M8 3 V7 M16 3 V7"
  }))), React.createElement("div", {
    style: {
      flex: 1,
      minWidth: 0
    }
  }, React.createElement("div", {
    style: {
      fontSize: 17,
      lineHeight: "22px",
      fontWeight: 600
    }
  }, "Past festivals"), React.createElement("div", {
    style: {
      fontSize: 13,
      lineHeight: "18px",
      color: "var(--text-2)"
    }
  }, "Official lineups and set times, archived")), chevron), React.createElement("p", {
    style: {
      margin: "16px 0",
      fontSize: 13,
      lineHeight: "18px",
      color: "var(--text-2)"
    }
  }, "Switching reloads the app with that festival's lineup and map.", festivalPhotoCredits().length > 0 && React.createElement(React.Fragment, null, " ", React.createElement("button", {
    "data-photo-credits-open": "1",
    onClick: () => setCreditsOpen(true),
    style: {
      background: "none",
      border: 0,
      padding: 0,
      font: "inherit",
      color: "inherit",
      textDecoration: "underline",
      textUnderlineOffset: 2,
      cursor: "pointer"
    }
  }, "Photo credits"))), creditsOpen && React.createElement(PhotoCreditsSheet, {
    onClose: () => setCreditsOpen(false)
  }), React.createElement(FieldButton, {
    onClick: () => {
      onClose();
      (window._pushNav || (() => {}))({
        tab: "lineup",
        artist: null
      });
    }
  }, "Build plan"));
}
var BATTERY_SAVER_KEY = "battery_saver_mode";
var _BS = window._BS = window._BS || {
  mode: (() => {
    try {
      return localStorage.getItem(BATTERY_SAVER_KEY) || "auto";
    } catch {
      return "auto";
    }
  })(),
  battery: null,
  net: {
    effectiveType: null,
    saveData: false,
    failTs: []
  },
  active: false,
  listeners: new Set()
};
var _BS_FAIL_WINDOW_MS = 5 * 60 * 1000;
function _bsLowSignal(now = Date.now()) {
  if (typeof navigator !== "undefined" && navigator.onLine === false) return false;
  var n = _BS.net;
  if (n.saveData || n.effectiveType === "slow-2g" || n.effectiveType === "2g") return true;
  return n.failTs.filter(t => now - t < _BS_FAIL_WINDOW_MS).length >= 2;
}
function plurskyNetSaver() {
  return !!_BS.active || _bsLowSignal();
}
function plurskyNoteNetQueued(queued) {
  var now = Date.now();
  _BS.net.failTs = queued ? [..._BS.net.failTs.filter(t => now - t < _BS_FAIL_WINDOW_MS), now] : [];
  _BS.listeners.forEach(fn => {
    try {
      fn(_BS.active);
    } catch {}
  });
}
function _bsHasFestivalContext() {
  try {
    var now = Date.now();
    var cfg = typeof window !== "undefined" && window.FESTIVAL_CONFIG || null;
    if (cfg && typeof cfg.startMs === "number" && typeof cfg.endMs === "number") {
      if (now >= cfg.startMs && now <= cfg.endMs) return true;
    }
    var artists = typeof activeLineup === "function" ? activeLineup() : null;
    var dayDates = cfg && cfg.dayDates;
    if (!artists || !dayDates) return false;
    var raw = "[]";
    try {
      var fid = cfg && cfg.id;
      raw = fid && localStorage.getItem(`${fid}_saved_v1`) || "[]";
    } catch {}
    var saved = JSON.parse(raw);
    if (Array.isArray(saved) && saved.length) {
      var horizon = now + 24 * 3600 * 1000;
      var _loop = function (id) {
          var a = artists.find(x => x.id === id);
          if (!a || !a.start) return 0;
          var dm = artistDayDate(a, now) || dayDates[a.day];
          if (!dm || typeof dm.midnightUtc !== "number") return 0;
          var [h, m] = String(a.start).split(":").map(Number);
          var isOvernight = h < 12;
          var startMs = dm.midnightUtc + (isOvernight ? 86400000 : 0) + (h || 0) * 3600000 + (m || 0) * 60000;
          if (startMs >= now && startMs <= horizon) return {
            v: true
          };
        },
        _ret;
      for (var id of saved) {
        _ret = _loop(id);
        if (_ret === 0) continue;
        if (_ret) return _ret.v;
      }
    }
  } catch {}
  return false;
}
function _bsCompute() {
  if (_BS.mode === "on") return true;
  if (_BS.mode === "off") return false;
  var lowBatt = _BS.battery && !_BS.battery.charging && _BS.battery.level < 0.25;
  if (!lowBatt) return false;
  return _bsHasFestivalContext();
}
function _bsApply() {
  var next = _bsCompute();
  if (next === _BS.active && document.body.classList.contains("bs-on") === next) {
    return;
  }
  _BS.active = next;
  if (typeof document !== "undefined") {
    document.body.classList.toggle("bs-on", next);
  }
  _BS.listeners.forEach(fn => {
    try {
      fn(next);
    } catch {}
  });
}
function setBatterySaverMode(mode) {
  if (!["off", "on", "auto"].includes(mode)) return;
  _BS.mode = mode;
  try {
    localStorage.setItem(BATTERY_SAVER_KEY, mode);
  } catch {}
  _bsApply();
}
if (!window._bsInited) {
  window._bsInited = true;
  (async () => {
    try {
      if (navigator.getBattery) {
        var b = await navigator.getBattery();
        var sync = () => {
          _BS.battery = {
            level: b.level,
            charging: b.charging
          };
          _bsApply();
        };
        b.addEventListener("levelchange", sync);
        b.addEventListener("chargingchange", sync);
        sync();
      } else {
        _bsApply();
      }
    } catch {
      _bsApply();
    }
  })();
  try {
    var c = navigator.connection;
    var syncNet = () => {
      _BS.net.effectiveType = c && c.effectiveType || null;
      _BS.net.saveData = !!(c && c.saveData);
      _BS.listeners.forEach(fn => {
        try {
          fn(_BS.active);
        } catch {}
      });
    };
    if (c) {
      syncNet();
      c.addEventListener?.("change", syncNet);
    }
    window.addEventListener("online", () => {
      _BS.net.failTs = [];
      syncNet();
    });
  } catch {}
  setInterval(_bsApply, 5 * 60 * 1000);
  var tag = document.createElement("style");
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
  var [, force] = React.useReducer(x => x + 1, 0);
  React.useEffect(() => {
    _BS.listeners.add(force);
    return () => _BS.listeners.delete(force);
  }, []);
  return {
    active: _BS.active,
    mode: _BS.mode,
    battery: _BS.battery,
    lowSignal: _bsLowSignal(),
    setMode: setBatterySaverMode
  };
}
function BatterySaverToast() {
  var {
    active,
    mode,
    battery
  } = useBatterySaver();
  var [shown, setShown] = React.useState(false);
  var [dismissed, setDismissed] = React.useState(false);
  React.useEffect(() => {
    if (active && mode === "auto" && !shown && !dismissed) {
      setShown(true);
      var t = setTimeout(() => setDismissed(true), 6000);
      return () => clearTimeout(t);
    }
  }, [active, mode, shown, dismissed]);
  if (!shown || dismissed) return null;
  var reason = battery && !battery.charging && battery.level < 0.25 ? `${Math.round(battery.level * 100)}% battery — dimmed for the long stretch.` : "Late-night mode — dimmed and animations paused.";
  return React.createElement("div", {
    className: "bs-hide",
    style: {
      position: "absolute",
      left: 16,
      right: 16,
      top: 60,
      zIndex: 80,
      padding: "8px 4px 8px 16px",
      borderRadius: "var(--rad-md)",
      background: "var(--s1)",
      color: "var(--ink)",
      display: "flex",
      alignItems: "center",
      gap: 10,
      boxShadow: "var(--e2)"
    }
  }, React.createElement("div", {
    style: {
      flex: 1,
      minWidth: 0
    }
  }, React.createElement("div", {
    className: "duo-label duo-acc"
  }, "Battery saver on"), React.createElement("div", {
    className: "duo-body-s duo-ink2",
    style: {
      marginTop: 3,
      fontWeight: 400
    }
  }, reason)), React.createElement("button", {
    onClick: () => setDismissed(true),
    "aria-label": "Dismiss",
    style: {
      background: "transparent",
      border: "none",
      cursor: "pointer",
      color: "var(--ink-2)",
      fontSize: 20,
      lineHeight: 1,
      minWidth: 44,
      minHeight: 44
    }
  }, "×"));
}
function BatterySaverCard() {
  var {
    active,
    mode,
    battery,
    lowSignal,
    setMode
  } = useBatterySaver();
  var segs = [{
    id: "off",
    label: "Off"
  }, {
    id: "auto",
    label: "Auto"
  }, {
    id: "on",
    label: "On"
  }];
  var battPct = battery ? Math.round(battery.level * 100) : null;
  var battColor = battPct == null ? "var(--ink-2)" : battPct > 50 ? "var(--acc-ink)" : battPct > 20 ? "var(--flare)" : "var(--alert)";
  return React.createElement("div", {
    style: {
      padding: 16,
      borderRadius: "var(--rad-md)",
      background: "var(--s2)",
      boxShadow: "var(--e1)",
      border: "none",
      marginBottom: 12
    }
  }, React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      marginBottom: 6
    }
  }, React.createElement("div", {
    className: "duo-label",
    style: {
      color: "var(--ink-3)"
    }
  }, "BATTERY SAVER"), React.createElement("span", {
    className: "duo-label",
    style: {
      color: active ? "var(--acc-ink)" : "var(--ink-2)"
    }
  }, active ? "✓ ACTIVE" : "STANDBY")), React.createElement("div", {
    className: "duo-headline",
    style: {
      marginBottom: 4
    }
  }, "Stretch the phone past sunrise"), React.createElement("div", {
    style: {
      fontSize: 14,
      color: "var(--ink-2)",
      lineHeight: 1.43,
      marginBottom: 12
    }
  }, "Dims the screen, freezes animations, and slows GPS polling. Auto kicks in under 25% battery during the festival."), React.createElement("div", {
    "data-bs-signal-note": true,
    style: {
      fontSize: 14,
      color: "var(--ink-2)",
      lineHeight: 1.43,
      marginBottom: 12
    }
  }, lowSignal ? "Weak signal now: " : "On a weak signal, ", "crew location updates slow to once a minute and auto-backup waits."), React.createElement("div", {
    style: {
      display: "grid",
      gridTemplateColumns: "repeat(3, 1fr)",
      gap: 4,
      background: "var(--s3)",
      borderRadius: 999,
      padding: 3
    }
  }, segs.map(s => {
    var on = mode === s.id;
    return React.createElement("button", {
      key: s.id,
      onClick: () => setMode(s.id),
      style: {
        background: on ? "var(--s1)" : "transparent",
        boxShadow: on ? "var(--e1)" : "none",
        color: on ? "var(--ink)" : "var(--ink-2)",
        border: "none",
        borderRadius: 999,
        padding: "0 10px",
        minHeight: 36,
        fontFamily: "var(--f-ui)",
        fontSize: 14,
        fontWeight: 650,
        cursor: "pointer"
      }
    }, s.label);
  })), battPct != null && React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      gap: 8,
      marginTop: 10
    }
  }, React.createElement("div", {
    style: {
      position: "relative",
      width: 28,
      height: 13,
      border: "1.4px solid var(--ink)",
      borderRadius: 3
    }
  }, React.createElement("div", {
    style: {
      position: "absolute",
      top: 1,
      left: 1,
      bottom: 1,
      width: `${Math.max(0, Math.min(100, battPct)) * 0.24}px`,
      background: battColor,
      borderRadius: 1
    }
  }), React.createElement("div", {
    style: {
      position: "absolute",
      right: -3,
      top: 3,
      bottom: 3,
      width: 2,
      background: "var(--ink)",
      borderRadius: 1
    }
  })), React.createElement("span", {
    className: "mono",
    style: {
      fontSize: 10,
      letterSpacing: 1.2,
      color: "var(--ink)",
      fontWeight: 600
    }
  }, battPct, "% ", battery.charging ? "· CHARGING" : "")));
}
function SetTrackingCard() {
  var [, bump] = React.useReducer(x => x + 1, 0);
  var [asking, setAsking] = React.useState(false);
  React.useEffect(() => {
    window.addEventListener(SET_TRACK_EVENT, bump);
    return () => window.removeEventListener(SET_TRACK_EVENT, bump);
  }, []);
  var cfg = window.FESTIVAL_CONFIG;
  var name = cfg && (cfg.shortName || cfg.name) || "this festival";
  var on = getSetTracking() === "on";
  var elig = setTrackEligibility(cfg, Date.now());
  var hasData = !!(cfg && (Object.keys(getSetTrackIntervals(cfg.id)).length || Object.keys(getSetTapPoints(cfg.id)).length));
  var canReview = !!(cfg && setReviewRows(cfg).length);
  var [reviewing, setReviewing] = React.useState(false);
  var [weekend, setWeekend] = React.useState(false);
  var btn = primary => ({
    background: primary ? "var(--acc)" : "var(--s3)",
    color: primary ? "var(--on-acc)" : "var(--ink)",
    border: "none",
    borderRadius: 999,
    padding: "0 16px",
    minHeight: 44,
    fontFamily: "var(--f-ui)",
    fontSize: 14,
    fontWeight: 650,
    cursor: "pointer"
  });
  var body = {
    fontSize: 14,
    color: "var(--ink-2)",
    lineHeight: 1.43,
    marginBottom: 12
  };
  var phase = cfg && typeof _festivalPhase === "function" ? _festivalPhase({
    config: cfg
  }, Date.now()) : "upcoming";
  var calib = cfg ? stageCalibrationStatus(cfg) : null;
  var canCalibrate = !!(calib && calib.needed && phase === "live");
  var [calibrating, setCalibrating] = React.useState(false);
  var native = !!_setTrackNative();
  var anyData = native && _setTrackHasAny();
  var [confirmDelete, setConfirmDelete] = React.useState(false);
  var status = elig === "no-stages" ? canCalibrate ? `${name}'s stages aren't measured yet. Calibrate them on site (${calib.done} of ${calib.needed} done) and sets can be timed on this phone.` : `${name}'s stages aren't measured yet, so sets can't be timed here.` : !on ? "Off. Plursky can note how long you stay at a stage during a set, to tell a full set from part of one." : elig === "ended" ? `On. ${name} is over, so nothing is counting.` : native ? elig === "live" ? _setTrackNativeOn ? "On. Counts during sets, even with the screen locked. iOS shows the location arrow while it runs." : "On. Counting while Plursky is open. Once set hours start, it keeps counting with the screen locked." : `On. On ${name}'s festival days, open Plursky once and it counts during sets, even with the screen locked.` : elig === "live" ? "On. Counting while Plursky is open. Lock the screen and the count pauses." : `On. It starts on ${name}'s festival days, and counts only while Plursky is open.`;
  return React.createElement("div", {
    "data-set-tracking-card": true,
    "data-set-tracking-state": on ? "on" : "off",
    "data-set-tracking-elig": elig,
    style: {
      padding: 16,
      borderRadius: "var(--rad-md)",
      background: "var(--s2)",
      boxShadow: "var(--e1)",
      border: "none",
      marginBottom: 12
    }
  }, React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      marginBottom: 6
    }
  }, React.createElement("div", {
    className: "duo-label",
    style: {
      color: "var(--ink-3)"
    }
  }, "SET TRACKING"), React.createElement("span", {
    className: "duo-label",
    style: {
      color: on ? "var(--acc-ink)" : "var(--ink-2)"
    }
  }, on ? "ON" : "OFF")), React.createElement("div", {
    className: "duo-headline",
    style: {
      marginBottom: 4
    }
  }, "Time the sets you catch"), React.createElement("div", {
    "data-set-tracking-status": true,
    style: body
  }, status), asking && !on ? React.createElement("div", {
    "data-set-tracking-consent": true
  }, native ? React.createElement("div", {
    style: body
  }, React.createElement("b", {
    style: {
      color: "var(--ink)"
    }
  }, "Recorded:"), " which stage you were at and when, during sets.", React.createElement("br", null), React.createElement("b", {
    style: {
      color: "var(--ink)"
    }
  }, "Your exact location:"), " kept on this phone only until Plursky turns it into stage times, then deleted.", React.createElement("br", null), "Never sent to Plursky or anyone else. Your own iPhone backup can include the stage times.", React.createElement("br", null), "It counts during set hours on festival days, screen locked too, once you've opened Plursky that day. iOS shows the location arrow while it runs. Turn it off here any time.") : React.createElement("div", {
    style: body
  }, React.createElement("b", {
    style: {
      color: "var(--ink)"
    }
  }, "Recorded:"), " which stage you were at and when, during sets.", React.createElement("br", null), React.createElement("b", {
    style: {
      color: "var(--ink)"
    }
  }, "Not recorded:"), " your exact location. Nothing leaves this phone.", React.createElement("br", null), "It counts only while Plursky is open, and you can turn it off here any time."), React.createElement("div", {
    style: {
      display: "flex",
      gap: 8,
      flexWrap: "wrap"
    }
  }, React.createElement("button", {
    "data-set-tracking-accept": true,
    onClick: () => {
      setSetTracking(true);
      setAsking(false);
    },
    style: btn(true)
  }, "Turn on"), React.createElement("button", {
    onClick: () => {
      setSetTracking(false);
      setAsking(false);
    },
    style: btn(false)
  }, "Not now"))) : React.createElement("div", {
    style: {
      display: "flex",
      gap: 8,
      flexWrap: "wrap"
    }
  }, on ? React.createElement("button", {
    "data-set-tracking-off": true,
    onClick: () => setSetTracking(false),
    style: btn(false)
  }, "Turn off") : elig !== "no-stages" && React.createElement("button", {
    "data-set-tracking-setup": true,
    onClick: () => setAsking(true),
    style: btn(false)
  }, "Set up"), canCalibrate && React.createElement("button", {
    "data-stage-calibrate-open": true,
    onClick: () => setCalibrating(true),
    style: btn(false)
  }, "Calibrate stages"), canReview && React.createElement("button", {
    "data-set-review-open": true,
    onClick: () => setReviewing(true),
    style: btn(false)
  }, "Review your sets"), canReview && yourWeekendEnabled() && React.createElement("button", {
    "data-your-weekend-open": true,
    onClick: () => setWeekend(true),
    style: btn(false)
  }, "Your weekend"), hasData && React.createElement("button", {
    "data-set-tracking-clear": true,
    onClick: () => clearSetTrack(cfg.id),
    style: btn(false)
  }, "Clear ", name, " times"), calib && calib.done > 0 && React.createElement("button", {
    "data-stage-calibrate-clear": true,
    onClick: () => clearStageCalibration(cfg.id),
    style: btn(false)
  }, "Clear stage calibration"), anyData && !confirmDelete && React.createElement("button", {
    "data-set-tracking-delete-all": true,
    onClick: () => setConfirmDelete(true),
    style: btn(false)
  }, "Delete all set times")), confirmDelete && React.createElement("div", {
    "data-set-tracking-delete-confirm": true,
    style: {
      marginTop: 12
    }
  }, React.createElement("div", {
    style: body
  }, "Delete every festival's set times and taps on this phone, and any locations it hasn't turned into stage times yet? This can't be undone."), React.createElement("div", {
    style: {
      display: "flex",
      gap: 8,
      flexWrap: "wrap"
    }
  }, React.createElement("button", {
    "data-set-tracking-delete-yes": true,
    onClick: () => {
      clearAllSetTrack();
      setConfirmDelete(false);
    },
    style: btn(true)
  }, "Delete"), React.createElement("button", {
    "data-set-tracking-delete-no": true,
    onClick: () => setConfirmDelete(false),
    style: btn(false)
  }, "Cancel"))), native && _setTrackInternal && React.createElement(SetTrackBatteryTest, {
    btn: btn,
    body: body
  }), reviewing && React.createElement(SetReviewSheet, {
    cfg: cfg,
    onClose: () => setReviewing(false)
  }), weekend && React.createElement(YourWeekendSheet, {
    cfg: cfg,
    onClose: () => setWeekend(false)
  }), calibrating && React.createElement(StageCalibrateSheet, {
    cfg: cfg,
    onClose: () => setCalibrating(false)
  }));
}
function SetTrackBatteryTest({
  btn,
  body
}) {
  var [st, setSt] = React.useState(null);
  var P = _setTrackNative();
  var refresh = () => {
    try {
      P.status().then(setSt).catch(() => {});
    } catch {}
  };
  React.useEffect(() => {
    if (!P) return;
    refresh();
    var t = setInterval(refresh, 15000);
    return () => clearInterval(t);
  }, []);
  if (!P || !_setTrackInternal) return null;
  var running = !!(st && st.testUntil > Date.now());
  var left = running ? Math.max(0, Math.round((st.testUntil - Date.now()) / 60000)) : 0;
  return React.createElement("div", {
    "data-set-track-battery-test": true,
    style: {
      marginTop: 14,
      paddingTop: 12,
      borderTop: "1px solid var(--s3)"
    }
  }, React.createElement("div", {
    className: "duo-label",
    style: {
      color: "var(--ink-3)",
      marginBottom: 6
    }
  }, "DEBUG BUILD · BATTERY TEST"), React.createElement("div", {
    style: body
  }, running ? `Running: GPS as in a set window, nothing saved. ${left} min left, ${st.testFixes || 0} fixes so far. Lock the screen now.` : `Runs GPS for 60 min as in a set window, screen locked, saving nothing. Note the battery % before and after.${st && st.testFixes ? ` Last test: ${st.testFixes} fixes.` : ""}`), React.createElement("div", {
    style: {
      display: "flex",
      gap: 8,
      flexWrap: "wrap"
    }
  }, running ? React.createElement("button", {
    "data-set-track-test-stop": true,
    onClick: () => P.testStop().then(refresh).catch(refresh),
    style: btn(false)
  }, "Stop test") : React.createElement("button", {
    "data-set-track-test-start": true,
    onClick: () => P.testStart({
      minutes: 60
    }).then(refresh).catch(refresh),
    style: btn(false)
  }, "Start 60-min test")));
}
function stageCalibrationStatus(cfg) {
  if (!cfg || !cfg.id) return null;
  var measured = new Set((typeof resolvedStageAnchors === "function" ? resolvedStageAnchors(cfg) : []).filter(a => a.anchorSource === "osm" || a.anchorSource === "crowd").map(a => a.stageId));
  var e = _readCalib(cfg.id);
  var stages = _calibStages(cfg).filter(st => !measured.has(st.id));
  return {
    stages: stages.map(st => ({
      id: st.id,
      name: st.name || st.short || st.id,
      done: !!e.anchors[st.id],
      pendingMs: e.pending[st.id] ? e.pending[st.id].ms : null
    })),
    needed: stages.length,
    done: stages.filter(st => e.anchors[st.id]).length
  };
}
var _CALIB_NOTE = {
  first: "First tap noted. Tap again from the same spot in 10 minutes or more to confirm.",
  "too-soon": "Wait a little: the second tap needs 10 minutes after the first.",
  moved: "That tap landed more than 30 m from the first one, so this one counts as a new first tap.",
  set: "Stage calibrated on this phone.",
  coarse: "Location is too rough here (needs 30 m or better). Nothing was noted.",
  "off-site": "You don't seem to be at the venue, so nothing was noted.",
  denied: "Location is off for Plursky, so nothing was noted.",
  "not-live": "Calibration works only while the festival is on.",
  hidden: "You left Plursky before your location came in, so nothing was noted.",
  none: "Couldn't get a location, so nothing was noted."
};
function StageCalibrateSheet({
  cfg = window.FESTIVAL_CONFIG,
  onClose
}) {
  var [, bump] = React.useReducer(x => x + 1, 0);
  var [busy, setBusy] = React.useState(null);
  var [note, setNote] = React.useState(null);
  React.useEffect(() => {
    window.addEventListener(SET_TRACK_EVENT, bump);
    return () => window.removeEventListener(SET_TRACK_EVENT, bump);
  }, []);
  var st = stageCalibrationStatus(cfg) || {
    stages: [],
    needed: 0,
    done: 0
  };
  var tap = async id => {
    setBusy(id);
    setNote(null);
    var r = await stageCalibrateNow(cfg, id);
    setBusy(null);
    setNote({
      stageId: id,
      status: r.status
    });
  };
  return React.createElement(FieldSheet, {
    title: "Calibrate stages",
    eyebrow: (cfg.shortName || cfg.name || "").toUpperCase(),
    onClose: onClose
  }, React.createElement("div", {
    "data-stage-calibrate": true,
    style: {
      fontSize: 14,
      color: "var(--ink-2)",
      lineHeight: 1.43,
      marginBottom: 12
    }
  }, "Stand at a stage and tap \"I'm here\". Tap again from the same spot 10 minutes later to confirm. The stage's position stays on this phone and is never shared. Sets are timed once every stage below is done (", st.done, " of ", st.needed, ")."), st.stages.map(s => React.createElement("div", {
    key: s.id,
    "data-stage-calibrate-row": s.id,
    style: {
      display: "flex",
      alignItems: "center",
      gap: 12,
      minHeight: 56,
      borderBottom: "1px solid var(--line)"
    }
  }, React.createElement("div", {
    style: {
      flex: 1,
      minWidth: 0
    }
  }, React.createElement("div", {
    style: {
      fontSize: 15,
      fontWeight: 650,
      overflowWrap: "anywhere"
    }
  }, s.name), React.createElement("div", {
    "data-stage-calibrate-state": true,
    className: "duo-data-s duo-ink3"
  }, s.done ? "Calibrated" : s.pendingMs ? `First tap at ${_setClock(s.pendingMs, cfg)}` : "Not calibrated"), note && note.stageId === s.id && React.createElement("div", {
    "data-stage-calibrate-note": true,
    role: "status",
    style: {
      fontSize: 13,
      color: "var(--ink-2)",
      marginTop: 4
    }
  }, _CALIB_NOTE[note.status] || _CALIB_NOTE.none)), React.createElement("button", {
    className: "duo-chip",
    "data-stage-calibrate-tap": s.id,
    disabled: !!busy,
    onClick: () => tap(s.id)
  }, React.createElement("span", null, busy === s.id ? "Checking…" : s.done ? "Redo" : "I'm here")))));
}
function _setClock(ms, cfg) {
  try {
    return new Intl.DateTimeFormat("en-US", {
      timeZone: cfg && cfg.tz || undefined,
      hour: "numeric",
      minute: "2-digit"
    }).format(new Date(ms));
  } catch {
    return "";
  }
}
function _savedSetIds(festivalId) {
  try {
    var v = JSON.parse(localStorage.getItem(`${festivalId}_saved_v1`) || "[]");
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}
var _SET_EVIDENCE_WORD = {
  gps: "Set tracking",
  checkin: "Check-in",
  photo: "Photo",
  tap: "Still here tap",
  hand: "Still here · your mark"
};
function setReviewRows(cfg = window.FESTIVAL_CONFIG) {
  if (!cfg || !cfg.id) return [];
  var ds = _attendedDataSets()[cfg.id] || {};
  var artists = ds.artists || (window.FESTIVAL_CONFIG && window.FESTIVAL_CONFIG.id === cfg.id ? window.ARTISTS : []) || [];
  var iv = setTrackEvidence(cfg);
  var attended = new Set(Object.values(getAllAttended(cfg.id)).flat());
  var saved = new Set(_savedSetIds(cfg.id));
  var now = Date.now();
  var rows = [];
  for (var a of artists) {
    var manual = getSetManual(cfg.id, a.id);
    var ev = attendEvidenceList(a, iv, cfg);
    var w = saved.has(a.id) && attendTimeClass(a) !== "blank" ? attendSetWindowMs(a, cfg, []) : null;
    var savedOver = !!w && w.endMs < now;
    if (!manual && !ev.length && !attended.has(a.id) && !savedOver) continue;
    rows.push({
      a,
      manual,
      ev,
      verdict: setTrackVerdict(a, cfg)
    });
  }
  var key = r => r.ev[0] && r.ev[0].from || 0;
  var min = a => {
    var n = toNightMin(a.start);
    return Number.isFinite(n) ? n : 9999;
  };
  var day = a => typeof a.day === "number" ? a.day : 99;
  return rows.sort((x, y) => day(x.a) - day(y.a) || min(x.a) - min(y.a) || key(x) - key(y) || String(x.a.id).localeCompare(String(y.a.id)));
}
var YOUR_WEEKEND_FLAG_KEY = "plursky_flag_your_weekend";
function yourWeekendEnabled() {
  try {
    return localStorage.getItem(YOUR_WEEKEND_FLAG_KEY) === "on";
  } catch {
    return false;
  }
}
function yourWeekendNights(rows, cfg) {
  var nights = new Map();
  var tz = cfg && cfg.tz || undefined;
  var nightOf = ms => {
    try {
      return new Intl.DateTimeFormat("en-US", {
        timeZone: tz,
        weekday: "short",
        month: "short",
        day: "numeric"
      }).format(new Date(ms - 8 * 3600000));
    } catch {
      return "";
    }
  };
  var _loop2 = function () {
      var {
        a,
        manual,
        verdict
      } = r || {};
      if (!a || manual === "absent") return 0;
      if (!(manual === "full" || manual === "partial" || verdict && verdict.caught)) return 0;
      var ev = r.ev || [];
      var runs = ev.map(e => ({
        from: e.from,
        to: e.to,
        src: e.kind === "gps" ? "gps" : "photo"
      }));
      var w = attendTimeClass(a) === "blank" ? null : attendSetWindowMs(a, cfg, runs);
      var marks = [];
      if (w) {
        var L = w.endMs - w.startMs;
        var share = ms => Math.min(1, Math.max(0, (ms - w.startMs) / L));
        for (var e of ev) {
          if (e.kind === "gps") {
            var l = share(e.from),
              rr = share(e.to);
            if (rr > l) marks.push({
              kind: "run",
              l,
              w: rr - l
            });
          } else marks.push({
            kind: "point",
            via: e.kind,
            l: share(e.from)
          });
        }
      }
      var inSet = e => !w || (e.kind === "gps" ? Math.min(e.to, w.endMs) > Math.max(e.from, w.startMs) : e.from >= w.startMs && e.from <= w.endMs);
      var youTimes = ev.filter(e => Number.isFinite(e.from) && inSet(e)).map(e => {
        var to = Number.isFinite(e.to) && e.to > e.from ? e.to : e.from;
        return w ? [Math.max(e.from, w.startMs), Math.min(to, w.endMs)] : [e.from, to];
      });
      var you = youTimes.length ? {
        fromMs: Math.min(...youTimes.map(t => t[0])),
        toMs: Math.max(...youTimes.map(t => t[1]))
      } : null;
      var youText = you ? you.toMs > you.fromMs ? `You: ${_setClock(you.fromMs, cfg)} to ${_setClock(you.toMs, cfg)}` : `You: ${_setClock(you.fromMs, cfg)}` : "Your times: nothing on this phone";
      var dd = cfg && cfg.dayDates && cfg.dayDates[a.day];
      var label = w ? nightOf(w.startMs) : dd && dd.short || (a.day != null ? `Day ${a.day}` : "");
      var key = w ? `n:${label}` : `d:${a.day}`;
      if (!nights.has(key)) nights.set(key, {
        key,
        label,
        sortMs: Infinity,
        day: typeof a.day === "number" ? a.day : 99,
        sets: []
      });
      var n = nights.get(key);
      if (w && w.startMs < n.sortMs) n.sortMs = w.startMs;
      n.sets.push({
        id: a.id,
        name: a.name,
        stage: a.stage,
        start: a.start || "",
        end: a.end || "",
        startMs: w ? w.startMs : null,
        mine: !!manual,
        tag: manual ? verdict && verdict.label || (manual === "full" ? "Full set · your edit" : "Part of it · your edit") : verdict && verdict.label || "Length unknown",
        marks,
        you,
        youText
      });
    },
    _ret2;
  for (var r of rows || []) {
    _ret2 = _loop2();
    if (_ret2 === 0) continue;
  }
  var out = [...nights.values()];
  for (var n of out) n.sets.sort((x, y) => (x.startMs ?? Infinity) - (y.startMs ?? Infinity) || String(x.id).localeCompare(String(y.id)));
  return out.sort((x, y) => x.sortMs - y.sortMs || x.day - y.day);
}
function YourWeekendSheet({
  cfg = window.FESTIVAL_CONFIG,
  onClose
}) {
  var [, bump] = React.useReducer(x => x + 1, 0);
  var [open, setOpen] = React.useState(null);
  React.useEffect(() => {
    window.addEventListener(SET_TRACK_EVENT, bump);
    return () => window.removeEventListener(SET_TRACK_EVENT, bump);
  }, []);
  var rows = setReviewRows(cfg);
  var nights = yourWeekendNights(rows, cfg);
  var stages = (_attendedDataSets()[cfg.id] || {}).stages || window.STAGES || [];
  if (open) {
    var a = rows.find(r => r.a.id === open)?.a;
    if (a) return React.createElement(SetCorrectionSheet, {
      a: a,
      cfg: cfg,
      onClose: () => setOpen(null)
    });
  }
  var count = nights.reduce((s, n) => s + n.sets.length, 0);
  return React.createElement(FieldSheet, {
    title: "Your weekend",
    eyebrow: (cfg.shortName || cfg.name || "").toUpperCase(),
    onClose: onClose
  }, React.createElement("div", {
    "data-your-weekend-summary": true,
    className: "duo-data-s duo-ink3",
    style: {
      marginBottom: 12
    }
  }, count ? `${count} set${count === 1 ? "" : "s"} caught on this phone` : "No sets caught on this phone yet."), nights.map(n => React.createElement("section", {
    key: n.key,
    "data-your-weekend-night": n.label,
    style: {
      marginBottom: 16
    }
  }, React.createElement("div", {
    className: "duo-label duo-ink3",
    style: {
      marginBottom: 4
    }
  }, n.label.toUpperCase()), n.sets.map(s => {
    var stage = stages.find(st => st.id === s.stage);
    return React.createElement("button", {
      key: s.id,
      "data-your-weekend-set": s.id,
      onClick: () => setOpen(s.id),
      style: {
        display: "block",
        width: "100%",
        padding: "10px 0",
        background: "transparent",
        border: "none",
        borderBottom: "1px solid var(--line)",
        textAlign: "left",
        cursor: "pointer",
        color: "var(--ink)"
      }
    }, React.createElement("div", {
      style: {
        display: "flex",
        alignItems: "baseline",
        gap: 12,
        flexWrap: "wrap"
      }
    }, React.createElement("div", {
      style: {
        flex: "1 1 160px",
        minWidth: 0,
        fontSize: 15,
        fontWeight: 650,
        overflowWrap: "anywhere"
      }
    }, s.name), React.createElement("span", {
      "data-your-weekend-tag": true,
      className: "duo-data-s",
      style: {
        color: s.mine ? "var(--acc-ink)" : "var(--ink)"
      }
    }, s.tag)), React.createElement("div", {
      className: "duo-data-s duo-ink3",
      style: {
        marginBottom: 6
      }
    }, [stage && (stage.short || stage.name), s.start && s.end ? `Set ${fmt12(s.start)} to ${fmt12(s.end)}` : "Set time not published"].filter(Boolean).join(" · ")), React.createElement("div", {
      "data-your-weekend-you": true,
      className: s.you ? "duo-data-s" : "duo-data-s duo-ink3",
      style: {
        marginBottom: 6,
        color: s.you ? "var(--ink)" : undefined
      }
    }, s.youText), s.startMs != null && s.marks.length > 0 && React.createElement("div", {
      "data-your-weekend-track": true,
      "aria-hidden": "true",
      style: {
        position: "relative",
        height: 8,
        borderRadius: 4,
        background: "var(--s3)"
      }
    }, s.marks.map((m, i) => m.kind === "run" ? React.createElement("span", {
      key: i,
      "data-your-weekend-run": true,
      style: {
        position: "absolute",
        top: 0,
        bottom: 0,
        left: `${(m.l * 100).toFixed(2)}%`,
        width: `${Math.max(1, m.w * 100).toFixed(2)}%`,
        borderRadius: 4,
        background: "var(--acc)"
      }
    }) : React.createElement("span", {
      key: i,
      "data-your-weekend-point": true,
      style: {
        position: "absolute",
        top: -2,
        width: 12,
        height: 12,
        marginLeft: -6,
        left: `${(m.l * 100).toFixed(2)}%`,
        borderRadius: 6,
        background: "var(--acc)",
        boxShadow: "0 0 0 2px var(--s2)"
      }
    }))));
  }))));
}
function SetCorrectionPanel({
  a,
  cfg
}) {
  var [, bump] = React.useReducer(x => x + 1, 0);
  React.useEffect(() => {
    window.addEventListener(SET_TRACK_EVENT, bump);
    return () => window.removeEventListener(SET_TRACK_EVENT, bump);
  }, []);
  var manual = getSetManual(cfg.id, a.id);
  var v = setTrackVerdict(a, cfg);
  var ev = attendEvidenceList(a, setTrackEvidence(cfg), cfg);
  var said = manual === "absent" ? "You said you weren't there" : v && v.label ? v.label : ev.length ? "You were there, length unknown" : "No record";
  var opt = (value, text) => {
    var on = manual === value;
    return React.createElement("button", {
      key: text,
      "data-set-manual": value || "clear",
      "aria-pressed": on,
      onClick: () => setSetManual(cfg.id, a.id, value),
      style: {
        minHeight: 44,
        padding: "0 14px",
        borderRadius: 999,
        cursor: "pointer",
        border: on ? "none" : "1px solid var(--line-2)",
        background: on ? "var(--acc)" : "transparent",
        color: on ? "var(--on-acc)" : "var(--ink)",
        fontFamily: "var(--f-ui)",
        fontSize: 14,
        fontWeight: 650
      }
    }, text);
  };
  return React.createElement("div", {
    "data-set-correction": a.id
  }, React.createElement("div", {
    "data-set-correction-said": true,
    className: "duo-headline",
    style: {
      marginBottom: 4
    }
  }, said), React.createElement("div", {
    className: "duo-data-s duo-ink3",
    style: {
      marginBottom: 12
    }
  }, a.start && a.end ? `${fmt12(a.start)} to ${fmt12(a.end)}` : "Set time not published"), React.createElement("div", {
    className: "duo-label duo-ink3",
    style: {
      marginBottom: 6
    }
  }, "WHY"), ev.length ? React.createElement("ul", {
    "data-set-why": true,
    style: {
      listStyle: "none",
      margin: "0 0 14px",
      padding: 0
    }
  }, ev.map((e, i) => React.createElement("li", {
    key: i,
    style: {
      fontSize: 14,
      color: "var(--ink-2)",
      lineHeight: 1.6
    }
  }, _SET_EVIDENCE_WORD[e.kind] || "Evidence", " · ", _setClock(e.from, cfg), e.to > e.from ? ` to ${_setClock(e.to, cfg)}` : ""))) : React.createElement("div", {
    style: {
      fontSize: 14,
      color: "var(--ink-2)",
      marginBottom: 14
    }
  }, "Nothing on this phone places you at this stage during the set."), React.createElement("div", {
    className: "duo-label duo-ink3",
    style: {
      marginBottom: 6
    }
  }, "YOUR ANSWER"), React.createElement("div", {
    style: {
      display: "flex",
      gap: 8,
      flexWrap: "wrap"
    }
  }, opt("full", "Full set"), opt("partial", "Part of it"), opt("absent", "I wasn't there"), manual && opt(null, "Use the evidence")));
}
function SetCorrectionSheet({
  a,
  cfg = window.FESTIVAL_CONFIG,
  onClose
}) {
  return React.createElement(FieldSheet, {
    title: a.name,
    eyebrow: "YOUR SET",
    onClose: onClose
  }, React.createElement(SetCorrectionPanel, {
    a: a,
    cfg: cfg
  }));
}
function SetReviewSheet({
  cfg = window.FESTIVAL_CONFIG,
  onClose
}) {
  var [, bump] = React.useReducer(x => x + 1, 0);
  var [open, setOpen] = React.useState(null);
  React.useEffect(() => {
    window.addEventListener(SET_TRACK_EVENT, bump);
    return () => window.removeEventListener(SET_TRACK_EVENT, bump);
  }, []);
  var rows = setReviewRows(cfg);
  var stages = (_attendedDataSets()[cfg.id] || {}).stages || window.STAGES || [];
  if (open) {
    var a = rows.find(r => r.a.id === open)?.a;
    if (a) return React.createElement(SetCorrectionSheet, {
      a: a,
      cfg: cfg,
      onClose: () => setOpen(null)
    });
  }
  return React.createElement(FieldSheet, {
    title: "Your sets",
    eyebrow: (cfg.shortName || cfg.name || "").toUpperCase(),
    onClose: onClose
  }, rows.length ? rows.map(({
    a,
    manual,
    verdict,
    ev
  }) => {
    var stage = stages.find(s => s.id === a.stage);
    var tag = manual === "absent" ? "Not there · your edit" : verdict && verdict.label ? verdict.label : ev.length ? "Length unknown" : "No record";
    return React.createElement("button", {
      key: a.id,
      "data-set-review-row": a.id,
      onClick: () => setOpen(a.id),
      style: {
        display: "flex",
        alignItems: "center",
        gap: 12,
        width: "100%",
        minHeight: 56,
        padding: "8px 0",
        background: "transparent",
        border: "none",
        borderBottom: "1px solid var(--line)",
        textAlign: "left",
        cursor: "pointer",
        color: "var(--ink)"
      }
    }, React.createElement("div", {
      style: {
        flex: 1,
        minWidth: 0
      }
    }, React.createElement("div", {
      style: {
        fontSize: 15,
        fontWeight: 650,
        overflowWrap: "anywhere"
      }
    }, a.name), React.createElement("div", {
      className: "duo-data-s duo-ink3"
    }, [stage && (stage.short || stage.name), a.start && fmt12(a.start)].filter(Boolean).join(" · "))), React.createElement("span", {
      "data-set-review-tag": true,
      className: "duo-data-s",
      style: {
        flex: "none",
        padding: "2px 8px",
        borderRadius: 999,
        background: "var(--s3)",
        color: manual ? "var(--acc-ink)" : verdict && verdict.label ? "var(--ink)" : "var(--ink-3)",
        fontStyle: verdict && verdict.label || manual ? "normal" : "italic"
      }
    }, tag));
  }) : React.createElement("div", {
    style: {
      fontSize: 14,
      color: "var(--ink-2)"
    }
  }, "No sets to review yet."));
}
function SetAttendanceRow({
  a
}) {
  var [, bump] = React.useReducer(x => x + 1, 0);
  var [tap, setTap] = React.useState(null);
  var [fixing, setFixing] = React.useState(false);
  React.useEffect(() => {
    window.addEventListener(SET_TRACK_EVENT, bump);
    return () => window.removeEventListener(SET_TRACK_EVENT, bump);
  }, []);
  var cfg = window.FESTIVAL_CONFIG;
  if (!a || !cfg || !cfg.id || !a.stage) return null;
  var stages = (_attendedDataSets()[cfg.id] || {}).stages || window.STAGES || [];
  var mobile = _stageIsMobile(a.stage, stages);
  var phase = typeof _festivalPhase === "function" ? _festivalPhase({
    config: cfg
  }, Date.now()) : "upcoming";
  var elig = mobile ? phase === "live" || phase === "ended" ? phase : "not-live" : setTrackEligibility(cfg, Date.now());
  if (elig !== "live" && elig !== "ended") return null;
  var live = elig === "live" && typeof isSetLive === "function" && isSetLive(a);
  var v = setTrackVerdict(a, cfg);
  var manual = getSetManual(cfg.id, a.id);
  var w = attendTimeClass(a) === "blank" ? null : attendSetWindowMs(a, cfg, []);
  var started = !!w && w.startMs <= Date.now();
  if (!live && !v && !manual && !started) return null;
  var onTap = async () => {
    setTap("busy");
    var r = mobile ? setTrackStillHereHand(cfg, a) : await setTrackStillHere(cfg);
    setTap(r.status === "trusted" || r.status === "hand" ? r.stageId === a.stage ? "here" : "other" : r.status);
  };
  var note = tap === "here" ? "Noted: you're here." : tap === "other" ? "Noted, at a different stage than this set." : tap === "denied" ? "Location is off for Plursky, so nothing was noted." : tap === "hidden" ? "You left Plursky before your location came in, so nothing was noted." : tap && tap !== "busy" ? "Couldn't place you at a stage, so nothing was noted." : null;
  return React.createElement("div", {
    "data-set-attendance": true,
    style: {
      marginTop: 10
    }
  }, (v && v.label || manual === "absent") && React.createElement("div", {
    "data-set-attendance-label": true,
    className: "duo-data-s",
    style: {
      marginBottom: 6
    }
  }, manual === "absent" ? "Not there · your edit" : v.label), React.createElement("div", {
    style: {
      display: "flex",
      columnGap: 8,
      flexWrap: "wrap"
    }
  }, live && React.createElement("button", {
    className: "duo-chip",
    "data-set-still-here": true,
    disabled: tap === "busy",
    onClick: onTap
  }, React.createElement("span", null, tap === "busy" ? "Checking…" : "Still here")), React.createElement("button", {
    className: "duo-chip",
    "data-set-fix": true,
    onClick: () => setFixing(true)
  }, React.createElement("span", null, v || manual ? "Fix" : "Were you here?"))), note && React.createElement("div", {
    "data-set-still-here-note": true,
    role: "status",
    style: {
      fontSize: 13,
      color: "var(--ink-2)",
      marginTop: 6
    }
  }, note), fixing && React.createElement(SetCorrectionSheet, {
    a: a,
    cfg: cfg,
    onClose: () => setFixing(false)
  }));
}
function _syncNativeAppearance(mode, choice) {
  var style = choice === "dark" || choice === "light" ? mode : "system";
  try {
    window.Capacitor?.Plugins?.Appearance?.setStyle?.({
      style
    });
  } catch {}
}
if (!window._appearanceNativeInited && window.PlurskyAppearance) {
  window._appearanceNativeInited = true;
  _syncNativeAppearance(window.PlurskyAppearance.mode(), window.PlurskyAppearance.choice());
  window.PlurskyAppearance.onChange((m, c) => _syncNativeAppearance(m, c));
}
function fitName(el, force) {
  var key = el.textContent + "|" + el.clientWidth;
  if (!force && el.dataset.fitKey === key) return;
  var base = parseFloat(el.dataset.fitBase || getComputedStyle(el).fontSize);
  if (!el.dataset.fitBase) el.dataset.fitBase = String(base);
  var min = parseFloat(el.dataset.fitMin || "14");
  el.style.whiteSpace = "nowrap";
  el.style.fontSize = base + "px";
  var rg = document.createRange();
  rg.selectNodeContents(el);
  var over = () => rg.getBoundingClientRect().width > el.getBoundingClientRect().width + 0.5;
  var size = base;
  while (over() && size > min) {
    size -= 1;
    el.style.fontSize = size + "px";
  }
  if (over()) el.style.whiteSpace = "normal";
  el.dataset.fitKey = el.textContent + "|" + el.clientWidth;
}
function fitNames(root, force) {
  if (!root) return;
  for (var el of root.querySelectorAll("[data-fit-name]")) fitName(el, force);
}
function useFitNames(root) {
  var el = () => typeof root === "function" ? root() : root && root.current;
  var ro = React.useRef(null);
  var probe = React.useRef(null);
  React.useLayoutEffect(() => {
    var r = el();
    fitNames(r);
    if (!r || typeof ResizeObserver === "undefined") return;
    if (!ro.current) ro.current = new ResizeObserver(entries => {
      for (var {
        target
      } of entries) {
        if (!target.isConnected) continue;
        if (target === probe.current) fitNames(el(), true);else fitName(target);
      }
    });
    for (var n of r.querySelectorAll("[data-fit-name]")) ro.current.observe(n);
    if (!probe.current || !r.contains(probe.current)) {
      var p = document.createElement("span");
      p.setAttribute("aria-hidden", "true");
      p.textContent = "Eptic b2b Space Laces";
      p.style.cssText = "position:absolute;left:0;top:0;visibility:hidden;pointer-events:none;white-space:nowrap;font-size:17px;font-weight:700";
      r.appendChild(p);
      probe.current = p;
      ro.current.observe(p);
    }
  });
  React.useEffect(() => () => {
    ro.current && ro.current.disconnect();
    if (probe.current) probe.current.remove();
  }, []);
}
var _FIT_WORDS = "[data-fit-words], .duo-name";
function _fitSize(el, px) {
  if (el.dataset.fitOrig == null) el.dataset.fitOrig = (el.style.getPropertyValue("font-size") || "") + "|" + el.style.getPropertyPriority("font-size");
  if (px == null) {
    var [v, pr] = el.dataset.fitOrig.split("|");
    if (v) el.style.setProperty("font-size", v, pr);else el.style.removeProperty("font-size");
    delete el.dataset.fitOrig;
    delete el.dataset.fitSet;
    return;
  }
  el.style.setProperty("font-size", px + "px", "important");
  el.dataset.fitSet = String(px);
}
function fitWords(el) {
  var nodes = [el, ...el.querySelectorAll("*")];
  var trs = nodes.map(n => [n.style.getPropertyValue("transition"), n.style.getPropertyPriority("transition")]);
  for (var n of nodes) n.style.setProperty("transition", "none", "important");
  var done = () => {
    nodes.forEach((n, i) => {
      if (trs[i][0]) n.style.setProperty("transition", trs[i][0], trs[i][1]);else n.style.removeProperty("transition");
    });
  };
  var cs = getComputedStyle(el);
  var cur = parseFloat(cs.fontSize);
  if (el.dataset.fitSet == null || Math.abs(cur - parseFloat(el.dataset.fitSet)) > 0.1) el.dataset.fitBase = String(cur);
  var base = parseFloat(el.dataset.fitBase);
  var key = el.textContent + "|" + el.clientWidth + "|" + base + "|" + getComputedStyle(el).fontFamily;
  if (el.dataset.fitKey === key) {
    done();
    return;
  }
  var words = [];
  var tw = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
  while (tw.nextNode()) {
    var _n = tw.currentNode;
    var re = /[^\s\-‐-—\/·]+/g;
    var m = void 0;
    while (m = re.exec(_n.data)) words.push([_n, m.index, m.index + m[0].length]);
  }
  var pad = parseFloat(cs.paddingLeft) + parseFloat(cs.paddingRight);
  var broken = () => {
    var box = el.getBoundingClientRect().width - pad + 0.5;
    return words.some(([n, a, b]) => {
      var rg = document.createRange();
      rg.setStart(n, a);
      rg.setEnd(n, b);
      var rs = rg.getClientRects();
      return rs.length > 1 && rs[rs.length - 1].top > rs[0].top + 1 || rg.getBoundingClientRect().width > box;
    });
  };
  var set = px => _fitSize(el, px);
  var size = cur;
  if (size < base) {
    size = base;
    set(size);
  }
  var min = parseFloat(el.dataset.fitMin || "11");
  if (broken()) {
    el.style.overflowWrap = "normal";
    var w0 = el.getBoundingClientRect().width;
    if (size > min) {
      set(size - 1);
      var took = Math.abs(parseFloat(getComputedStyle(el).fontSize) - (size - 1)) < 0.1;
      if (!took || el.getBoundingClientRect().width < w0 - 0.5) {
        _fitSize(el, null);
        el.style.overflowWrap = "";
        el.dataset.fitKey = el.textContent + "|" + el.clientWidth + "|" + base + "|" + getComputedStyle(el).fontFamily;
        done();
        return;
      }
      size -= 1;
    }
    while (broken() && size > min) {
      size -= 1;
      set(size);
    }
    if (broken()) el.style.overflowWrap = "anywhere";
  }
  el.dataset.fitKey = el.textContent + "|" + el.clientWidth + "|" + base + "|" + getComputedStyle(el).fontFamily;
  done();
}
function fitWordGroups(r) {
  var groups = {};
  for (var n of r.querySelectorAll("[data-fit-group]")) (groups[n.dataset.fitGroup] ||= []).push(n);
  for (var g of Object.values(groups)) {
    var size = Math.min(...g.map(n => parseFloat(getComputedStyle(n).fontSize)));
    for (var _n2 of g) if (Math.abs(parseFloat(getComputedStyle(_n2).fontSize) - size) > 0.1) _fitSize(_n2, size);
  }
}
if (typeof window !== "undefined" && !window._fitWordsInited && typeof MutationObserver !== "undefined") {
  window._fitWordsInited = true;
  var ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(entries => {
    for (var {
      target
    } of entries) if (target.isConnected) fitWords(target);
    fitWordGroups(document);
  }) : null;
  var fitIn = (node, all) => {
    var list = node.matches && node.matches(_FIT_WORDS) ? [node] : [];
    if (node.querySelectorAll) list.push(...node.querySelectorAll(_FIT_WORDS));
    for (var n of list) {
      if (all) n.dataset.fitKey = "";
      fitWords(n);
      ro && ro.observe(n);
    }
  };
  var settle = () => {
    var all = [...document.body.querySelectorAll(_FIT_WORDS)];
    for (var n of all) {
      n.dataset.fitKey = "";
      if (n.dataset.fitSet != null && n.dataset.fitBase != null && parseFloat(n.dataset.fitSet) !== parseFloat(n.dataset.fitBase)) _fitSize(n, parseFloat(n.dataset.fitBase));
      if (n.style.overflowWrap) n.style.overflowWrap = "";
    }
    for (var _n3 of all) {
      fitWords(_n3);
      ro && ro.observe(_n3);
    }
    fitWordGroups(document);
  };
  var settleTimer = null;
  var settleSoon = () => {
    clearTimeout(settleTimer);
    settleTimer = setTimeout(settle, 200);
  };
  var start = () => {
    fitIn(document.body);
    fitWordGroups(document);
    settleSoon();
    new MutationObserver(records => {
      var touched = new Set();
      for (var r of records) {
        for (var n of r.addedNodes) if (n.nodeType === 1) touched.add(n);
        var host = r.target.nodeType === 1 ? r.target : r.target.parentElement;
        var fit = host && host.closest && host.closest(_FIT_WORDS);
        if (fit) touched.add(fit);
      }
      for (var _n4 of touched) if (_n4.isConnected) fitIn(_n4);
      if (touched.size) {
        fitWordGroups(document);
        settleSoon();
      }
    }).observe(document.body, {
      childList: true,
      subtree: true,
      characterData: true
    });
    try {
      if (document.fonts) {
        document.fonts.addEventListener("loadingdone", settle);
        document.fonts.ready.then(settle);
      }
    } catch {}
    try {
      window.PlurskyAppearance && window.PlurskyAppearance.onChange(() => {
        settle();
        settleSoon();
      });
    } catch {}
  };
  if (document.body) start();else document.addEventListener("DOMContentLoaded", start);
}
function useAppearance() {
  var A = window.PlurskyAppearance;
  var [, force] = React.useReducer(x => x + 1, 0);
  React.useEffect(() => A ? A.onChange(force) : undefined, []);
  return {
    choice: A ? A.choice() : "system",
    mode: A ? A.mode() : "dark",
    set: c => A && A.set(c)
  };
}
function AppearanceRow() {
  var {
    choice,
    set
  } = useAppearance();
  var opts = [["system", "System"], ["dark", "Dark"], ["light", "Light"]];
  return React.createElement("div", {
    "data-appearance-row": true,
    style: {
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 12,
      flexWrap: "wrap",
      padding: "8px 8px 8px 16px",
      borderRadius: "var(--rad-md)",
      marginBottom: 12,
      background: "var(--s2)",
      boxShadow: "var(--e1)",
      border: "none"
    }
  }, React.createElement("div", {
    style: {
      fontSize: 15,
      fontWeight: 600,
      color: "var(--ink)"
    }
  }, "Appearance"), React.createElement("div", {
    role: "radiogroup",
    "aria-label": "Appearance",
    style: {
      display: "grid",
      gridTemplateColumns: "repeat(3, 1fr)",
      padding: 3,
      borderRadius: 999,
      background: "var(--paper-3)",
      flex: "1 1 196px",
      maxWidth: 222
    }
  }, opts.map(([v, l]) => {
    var on = choice === v;
    return React.createElement("button", {
      key: v,
      role: "radio",
      "aria-checked": on,
      "data-appearance": v,
      onClick: () => set(v),
      style: {
        minHeight: 38,
        border: 0,
        borderRadius: 999,
        cursor: "pointer",
        font: "600 14px/1 var(--font-ui)",
        background: on ? "var(--paper)" : "transparent",
        color: on ? "var(--ink)" : "var(--text-2)",
        boxShadow: on ? "0 0 0 1px var(--line-2), 0 2px 6px -2px rgba(var(--shade-rgb),0.25)" : "none"
      }
    }, l);
  })));
}
function _useTickMs(intervalMs) {
  var [, force] = React.useReducer(x => x + 1, 0);
  React.useEffect(() => {
    var id = setInterval(force, intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
}
function useOnlineStatus() {
  var [online, setOnline] = React.useState(typeof navigator !== "undefined" ? navigator.onLine : true);
  React.useEffect(() => {
    var on = () => setOnline(true);
    var off = () => setOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
  }, []);
  return online;
}
var _STATUS_DAYS = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];
function StatusStrip() {
  _useTickMs(30000);
  var online = useOnlineStatus();
  var {
    active: bsActive,
    lowSignal
  } = useBatterySaver();
  var now = new Date();
  var day = _STATUS_DAYS[now.getDay()];
  var hh = String(now.getHours()).padStart(2, "0");
  var mm = String(now.getMinutes()).padStart(2, "0");
  return (React.createElement("div", {
      style: {
        flexShrink: 0,
        minHeight: 24,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "0 20px",
        background: "var(--paper)",
        borderBottom: "1px solid var(--line)",
        fontSize: 12,
        lineHeight: 1.33,
        fontWeight: 500,
        fontVariantNumeric: "tabular-nums",
        color: "var(--text-2)"
      }
    }, React.createElement("span", null, day, " · ", hh, ":", mm), React.createElement("span", {
      style: {
        display: "flex",
        alignItems: "center",
        gap: 10
      }
    }, bsActive && React.createElement("span", {
      style: {
        display: "inline-flex",
        alignItems: "center",
        gap: 4,
        color: "var(--flare)"
      }
    }, React.createElement("svg", {
      width: "9",
      height: "12",
      viewBox: "0 0 24 24",
      fill: "none",
      stroke: "currentColor",
      strokeWidth: "2",
      strokeLinecap: "round",
      strokeLinejoin: "round"
    }, React.createElement("rect", {
      x: "6",
      y: "4",
      width: "12",
      height: "17",
      rx: "1.5"
    }), React.createElement("path", {
      d: "M10 1 L14 1"
    }), React.createElement("path", {
      d: "M11 9 L13 9 L11 13 L14 13 L10 18"
    })), "SAVER"), online && lowSignal && React.createElement("span", {
      "data-status-weak-signal": true,
      style: {
        display: "inline-flex",
        alignItems: "center",
        gap: 4,
        color: "var(--flare)"
      }
    }, React.createElement("svg", {
      width: "11",
      height: "11",
      viewBox: "0 0 24 24",
      fill: "none",
      stroke: "currentColor",
      strokeWidth: "2",
      strokeLinecap: "round",
      strokeLinejoin: "round"
    }, React.createElement("path", {
      d: "M6 13 Q12 8 18 13",
      opacity: "0.55"
    }), React.createElement("path", {
      d: "M9 16 Q12 13.5 15 16"
    }), React.createElement("circle", {
      cx: "12",
      cy: "19",
      r: "0.9",
      fill: "currentColor"
    })), "WEAK SIGNAL"), !online && React.createElement("span", {
      style: {
        display: "inline-flex",
        alignItems: "center",
        gap: 4,
        color: "var(--alert)"
      }
    }, React.createElement("svg", {
      width: "11",
      height: "11",
      viewBox: "0 0 24 24",
      fill: "none",
      stroke: "currentColor",
      strokeWidth: "2",
      strokeLinecap: "round",
      strokeLinejoin: "round"
    }, React.createElement("path", {
      d: "M4 4 L20 20"
    }), React.createElement("path", {
      d: "M2 9 Q6 5 10 5.4 M22 9 Q18 5 14 5.4"
    }), React.createElement("path", {
      d: "M6 13 Q12 8 18 13",
      opacity: "0.55"
    }), React.createElement("circle", {
      cx: "12",
      cy: "19",
      r: "0.9",
      fill: "currentColor"
    })), "OFFLINE")))
  );
}
function plurskyHaptic(style = "LIGHT") {
  try {
    var cap = window.Capacitor;
    if (!cap?.isNativePlatform?.()) return;
    var H = cap.Plugins?.Haptics;
    H?.impact?.({
      style
    });
  } catch {}
}
(function _initKbAvoidance() {
  if (typeof window === "undefined") return;
  var vv = window.visualViewport;
  if (!vv) return;
  var prev = vv.height;
  vv.addEventListener("resize", () => {
    var shrunk = vv.height < prev - 60;
    prev = vv.height;
    if (!shrunk) return;
    var el = document.activeElement;
    if (el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA")) {
      requestAnimationFrame(() => {
        el.scrollIntoView({
          behavior: "smooth",
          block: "center"
        });
      });
    }
  });
})();
Object.assign(window, {
  Screen,
  ScrollBody,
  TopBar,
  TabBar,
  Pill,
  ArtistSwatch,
  Wordmark,
  useArtistPhoto,
  useArtistPhotoMachine,
  ARTIST_PHOTO_MACHINE,
  getArtistImage,
  getShareableArtistImage,
  putArtistImage,
  putArtistImages,
  SpotifyFullLogo,
  SpotifyPhotoCredit,
  SPOTIFY_IMAGE_TTL_MS,
  _fetchProxyPhoto,
  _photoProxyUsable,
  _spotifyExactArtist,
  useInstallPrompt,
  InstallBanner,
  useNotifications,
  NotificationsCard,
  scheduleReminders,
  getAllAttended,
  getAttendedStore,
  getAttendedForNight,
  getAttendedCount,
  markAttended,
  unmarkAttended,
  isAttended,
  getAttendanceSource,
  detectCurrentArtist,
  recordAttendanceFromGps,
  FestivalChip,
  FestivalSwitcher,
  useBatterySaver,
  BatterySaverCard,
  BatterySaverToast,
  setBatterySaverMode,
  useAppearance,
  AppearanceRow,
  fitNames,
  useFitNames,
  fitWords,
  useOnlineStatus,
  StatusStrip,
  plurskyHaptic
});