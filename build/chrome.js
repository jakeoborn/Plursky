function Screen({
  children,
  bg = "var(--paper)",
  pad = true,
  ink = "var(--ink)"
}) {
  return React.createElement("div", {
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
  }, React.createElement("div", null, sub && React.createElement("div", {
    className: "mono",
    style: {
      fontSize: 10,
      letterSpacing: 1.6,
      textTransform: "uppercase",
      color: "var(--muted)",
      marginBottom: 4
    }
  }, sub), React.createElement("div", {
    className: "serif",
    style: {
      fontSize: 34,
      lineHeight: 0.95,
      letterSpacing: -0.5
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
  return React.createElement("div", {
    style: {
      background: "var(--chrome)",
      backdropFilter: "blur(20px) saturate(160%)",
      WebkitBackdropFilter: "blur(20px) saturate(160%)",
      borderTop: "1px solid var(--line)",
      padding: "6px 10px 10px",
      display: "flex",
      justifyContent: "space-around"
    }
  }, tabs.map(t => {
    var Icon = t.icon;
    var on = active === t.id;
    return React.createElement("button", {
      key: t.id,
      onClick: () => {
        haptic.light();
        onChange(t.id);
      },
      "aria-current": on ? "page" : undefined,
      style: {
        background: "transparent",
        border: "none",
        cursor: "pointer",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 3,
        padding: "4px 12px",
        color: on ? "var(--signal)" : "var(--text-2)",
        minWidth: 64,
        minHeight: 49,
        transition: "color 0.15s ease"
      }
    }, React.createElement(Icon, {
      on: on
    }), React.createElement("span", {
      style: {
        fontSize: 12,
        lineHeight: "14px",
        fontWeight: on ? 600 : 500,
        transition: "color 0.15s"
      }
    }, t.label));
  }));
}
var stroke = on => ({
  fill: "none",
  stroke: "currentColor",
  strokeWidth: on ? 1.8 : 1.4,
  strokeLinecap: "round",
  strokeLinejoin: "round"
});
function HomeIcon({
  on
}) {
  return React.createElement("svg", {
    width: "22",
    height: "22",
    viewBox: "0 0 24 24",
    style: stroke(on)
  }, React.createElement("circle", {
    cx: "12",
    cy: "12",
    r: "3.2"
  }), React.createElement("path", {
    d: "M12 2.5 L12 5.5 M12 18.5 L12 21.5 M2.5 12 L5.5 12 M18.5 12 L21.5 12"
  }), React.createElement("path", {
    d: "M5.5 5.5 L7.5 7.5 M16.5 16.5 L18.5 18.5 M5.5 18.5 L7.5 16.5 M16.5 7.5 L18.5 5.5",
    opacity: "0.55"
  }));
}
function MapIcon({
  on
}) {
  return React.createElement("svg", {
    width: "22",
    height: "22",
    viewBox: "0 0 24 24",
    style: stroke(on)
  }, React.createElement("path", {
    d: "M3 6 L9 4 L15 6 L21 4 L21 18 L15 20 L9 18 L3 20 Z"
  }), React.createElement("path", {
    d: "M9 4 L9 18 M15 6 L15 20"
  }));
}
function LineupIcon({
  on
}) {
  return React.createElement("svg", {
    width: "22",
    height: "22",
    viewBox: "0 0 24 24",
    style: stroke(on)
  }, React.createElement("path", {
    d: "M4 6 L20 6 M4 12 L20 12 M4 18 L14 18"
  }), React.createElement("circle", {
    cx: "18",
    cy: "18",
    r: "2"
  }));
}
function MusicIcon({
  on
}) {
  return React.createElement("svg", {
    width: "22",
    height: "22",
    viewBox: "0 0 24 24",
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
function MemoriesIcon({
  on
}) {
  return React.createElement("svg", {
    width: "22",
    height: "22",
    viewBox: "0 0 24 24",
    style: stroke(on)
  }, React.createElement("rect", {
    x: "3",
    y: "5",
    width: "18",
    height: "14",
    rx: "2.5"
  }), React.createElement("circle", {
    cx: "8.5",
    cy: "10",
    r: "1.6"
  }), React.createElement("path", {
    d: "M3 16 L9 11 L13 14.5 L17 11 L21 14.5"
  }));
}
function MeIcon({
  on
}) {
  return React.createElement("svg", {
    width: "22",
    height: "22",
    viewBox: "0 0 24 24",
    style: stroke(on)
  }, React.createElement("circle", {
    cx: "12",
    cy: "9",
    r: "3.5"
  }), React.createElement("path", {
    d: "M5 20 C 5 16, 8.5 14, 12 14 C 15.5 14, 19 16, 19 20"
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
function useStaggerFade(depKey) {
  var ref = React.useRef(null);
  React.useEffect(() => {
    var el = ref.current;
    if (!el || !window.IntersectionObserver) return;
    var targets = el.querySelectorAll("[data-animate]");
    if (!targets.length) return;
    targets.forEach(t => {
      t.style.opacity = "0";
      t.style.transform = "translateY(8px)";
    });
    var idx = 0;
    var obs = new IntersectionObserver(entries => {
      entries.forEach(e => {
        if (!e.isIntersecting) return;
        var t = e.target;
        if (idx < 8) {
          var delay = idx * 40;
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
    }, {
      threshold: 0.05
    });
    targets.forEach(t => obs.observe(t));
    return () => obs.disconnect();
  }, [depKey]);
  return ref;
}
var _photoQueue = [];
var _photoActive = false;
function _drainPhotoQueue() {
  if (_photoActive || !_photoQueue.length) return;
  _photoActive = true;
  var {
    name,
    resolve
  } = _photoQueue.shift();
  var token = localStorage.getItem("spotify_token");
  var expires = localStorage.getItem("spotify_expires");
  if (!token || !expires || Date.now() >= parseInt(expires)) {
    _photoActive = false;
    resolve(null);
    _drainPhotoQueue();
    return;
  }
  fetch(`https://api.spotify.com/v1/search?q=${encodeURIComponent(name)}&type=artist&limit=3`, {
    headers: {
      Authorization: "Bearer " + token
    }
  }).then(r => r.ok ? r.json() : null).then(d => {
    var ln = name.toLowerCase();
    var items = d?.artists?.items || [];
    var match = items.find(x => x.name.toLowerCase() === ln) || items.find(x => ln.includes(x.name.toLowerCase())) || items[0];
    var img = match?.images?.[0]?.url || null;
    if (img) {
      try {
        var imgs = JSON.parse(localStorage.getItem("artist_images_v1") || "{}");
        imgs[ln] = img;
        localStorage.setItem("artist_images_v1", JSON.stringify(imgs));
      } catch {}
    }
    resolve(img);
  }).catch(() => resolve(null)).finally(() => {
    _photoActive = false;
    setTimeout(_drainPhotoQueue, 150);
  });
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
function _fetchItunesPhoto(name) {
  return fetch(`https://itunes.apple.com/search?term=${encodeURIComponent(name)}&entity=musicArtist&limit=1`).then(r => r.json()).then(d => {
    var art = d.results?.[0];
    if (!art?.artistName) return null;
    if (art.artistName.toLowerCase() !== name.toLowerCase()) return null;
    var url = (art.artworkUrl100 || "").replace("100x100", "600x600");
    if (!url) return null;
    try {
      var cache = JSON.parse(localStorage.getItem("artist_images_v1") || "{}");
      cache[name.toLowerCase()] = url;
      localStorage.setItem("artist_images_v1", JSON.stringify(cache));
    } catch {}
    return url;
  }).catch(() => null);
}
function useArtistPhoto(name) {
  var [photo, setPhoto] = React.useState(() => {
    try {
      return JSON.parse(localStorage.getItem("artist_images_v1") || "{}")[name.toLowerCase()] || null;
    } catch {
      return null;
    }
  });
  React.useEffect(() => {
    if (photo) return;
    var live = true;
    var token = localStorage.getItem("spotify_token");
    var expires = localStorage.getItem("spotify_expires");
    if (token && expires && Date.now() < parseInt(expires)) {
      _queuePhoto(name).then(img => {
        if (!live) return;
        if (img) {
          setPhoto(img);
          return;
        }
        _fetchItunesPhoto(name).then(url => {
          if (live && url) setPhoto(url);
        });
      });
    } else {
      _fetchItunesPhoto(name).then(url => {
        if (live && url) setPhoto(url);
      });
    }
    return () => {
      live = false;
    };
  }, [name.toLowerCase()]);
  return photo;
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
      background: primary ? "var(--signal)" : "var(--paper-3)",
      color: primary ? "var(--on-signal)" : "var(--ink)",
      border: "none",
      borderRadius: 14,
      cursor: "pointer",
      fontSize: 17,
      lineHeight: "22px",
      fontWeight: 600,
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
      fontSize: 20,
      lineHeight: "25px",
      fontWeight: 600
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
function FieldSheet({
  title,
  onClose,
  children
}) {
  useDeclareModal(true);
  React.useEffect(() => {
    var onKey = e => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
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
      background: "var(--paper-3)",
      borderRadius: "14px 14px 0 0",
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
  }, React.createElement("h2", {
    style: {
      margin: 0,
      fontSize: 20,
      lineHeight: "25px",
      fontWeight: 600
    }
  }, title), React.createElement("button", {
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
      overflowY: "auto",
      WebkitOverflowScrolling: "touch",
      padding: "4px 20px 24px"
    }
  }, children)));
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
    style: {
      margin: "8px 16px 0",
      padding: "10px 12px",
      borderRadius: 14,
      background: "var(--ink)",
      color: "var(--paper)",
      display: "flex",
      alignItems: "center",
      gap: 11
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
    className: "mono",
    style: {
      fontSize: 9,
      letterSpacing: 1.4,
      color: "var(--flare)",
      fontWeight: 700
    }
  }, "INSTALL PLURSKY"), React.createElement("div", {
    style: {
      fontSize: 12,
      lineHeight: 1.35,
      marginTop: 2,
      color: "rgba(247,237,224,0.85)"
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
    stroke: "var(--paper)",
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
      color: "var(--paper)"
    }
  }, "Add to Home Screen"), " for offline + full-screen.") : React.createElement(React.Fragment, null, "Add to home screen for offline lineup + full-screen map."))), !ip.isIOS && React.createElement("button", {
    onClick: ip.install,
    style: {
      background: "var(--ember)",
      color: "#fff",
      border: "none",
      borderRadius: 999,
      padding: "7px 12px",
      cursor: "pointer",
      fontFamily: "Geist Mono, monospace",
      fontSize: 10,
      letterSpacing: 1.2,
      fontWeight: 700,
      flexShrink: 0
    }
  }, "INSTALL"), React.createElement("button", {
    onClick: ip.dismiss,
    "aria-label": "Dismiss",
    style: {
      background: "transparent",
      border: "none",
      cursor: "pointer",
      color: "rgba(247,237,224,0.55)",
      padding: 4,
      flexShrink: 0,
      fontSize: 18,
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
  for (var i = 0; i < id.length; i++) h = h * 31 + id.charCodeAt(i) | 0;
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
var ATTENDED_KEY = "plursky_attended_v1";
function getAllAttended() {
  try {
    var raw = localStorage.getItem(ATTENDED_KEY);
    var obj = raw ? JSON.parse(raw) : {};
    Object.keys(obj).forEach(k => {
      obj[k] = Array.isArray(obj[k]) ? obj[k].filter(x => typeof x === "string") : [];
    });
    return obj;
  } catch {
    return {};
  }
}
function _writeAttended(map) {
  try {
    localStorage.setItem(ATTENDED_KEY, JSON.stringify(map));
  } catch {}
  try {
    window.dispatchEvent(new CustomEvent("plursky-attended-change"));
  } catch {}
}
function getAttendedForNight(night) {
  return new Set(getAllAttended()[night] || []);
}
function getAttendedCount() {
  var all = getAllAttended();
  return Object.values(all).reduce((s, arr) => s + (Array.isArray(arr) ? arr.length : 0), 0);
}
function markAttended(night, artistId, source = "manual") {
  if (!night || !artistId) return false;
  var all = getAllAttended();
  var list = all[night] || [];
  if (list.includes(artistId)) return false;
  all[night] = [...list, artistId];
  _writeAttended(all);
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
  var all = getAllAttended();
  var list = (all[night] || []).filter(x => x !== artistId);
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
    var log = JSON.parse(localStorage.getItem("plursky_attended_source_v1") || "{}");
    return log[artistId]?.source || "manual";
  } catch {
    return "manual";
  }
}
function _gpsDistMeters(latA, lngA, latB, lngB) {
  var toRad = d => d * Math.PI / 180;
  var cosLat = Math.cos(toRad((latA + latB) / 2));
  var dLat = toRad(latB - latA) * 6371000;
  var dLng = toRad(lngB - lngA) * 6371000 * cosLat;
  return Math.hypot(dLat, dLng);
}
function detectCurrentArtist(lat, lng, opts = {}) {
  if (typeof lat !== "number" || typeof lng !== "number") return null;
  var cfg = window.FESTIVAL_CONFIG;
  if (!cfg) return null;
  var anchors = typeof resolvedStageAnchors === "function" ? resolvedStageAnchors(cfg) : cfg.gpsAnchors || [];
  if (anchors.length === 0) return null;
  var radius = opts.radiusM || 140;
  var now = window.NOW;
  if (!now || !now.day || !now.time) return null;
  var best = null;
  for (var a of anchors) {
    var d = _gpsDistMeters(lat, lng, a.lat, a.lng);
    if (d > radius) continue;
    if (!best || d < best.d) best = {
      ...a,
      d
    };
  }
  if (!best) return null;
  var playing = activeLineup().find(a => a.stage === best.stageId && isSetLive(a));
  if (!playing) return null;
  return {
    artistId: playing.id,
    stageId: best.stageId,
    night: now.day,
    distM: Math.round(best.d)
  };
}
function recordAttendanceFromGps(lat, lng) {
  var hit = detectCurrentArtist(lat, lng);
  if (!hit) return null;
  var added = markAttended(hit.night, hit.artistId, "gps");
  return added ? hit : null;
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
function scheduleReminders(state, showLocal) {
  var ln = _capLocalNotifications();
  var now = Date.now();
  var leadMin = getReminderLeadMin();
  var pending = [];
  var lineup = activeLineup(state.saved);
  state.saved.forEach(id => {
    var a = lineup.find(x => x.id === id);
    if (!a) return;
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
          title: `${p.name} starts in ${p.leadMin} min`,
          body: `${p.stageName} · ${fmt12(p.start)}`,
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
  _SCHEDULED.forEach(h => {
    if (typeof h !== "number") clearTimeout(h);
  });
  _SCHEDULED.clear();
  pending.forEach(p => {
    var handle = setTimeout(() => {
      showLocal(`${p.name} starts in ${p.leadMin} min`, {
        body: `${p.stageName} · ${fmt12(p.start)}`,
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
      var lead = r.leadMin || 15;
      var handle = setTimeout(() => {
        showLocal(`${r.name} starts in ${lead} min`, {
          body: `${r.stageName} · ${fmt12(r.start)}`,
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
        padding: "12px 14px",
        borderRadius: 12,
        background: "var(--paper)",
        border: "1px solid var(--line)",
        marginBottom: 12
      }
    }, React.createElement("div", {
      className: "mono",
      style: {
        fontSize: 9,
        letterSpacing: 1.4,
        color: "var(--muted)",
        fontWeight: 700
      }
    }, "NOTIFICATIONS · UNSUPPORTED"), React.createElement("div", {
      style: {
        fontSize: 12,
        color: "var(--muted)",
        marginTop: 4,
        lineHeight: 1.4
      }
    }, window.Capacitor?.isNativePlatform?.() ? "Notifications aren't wired in this build yet — set-time reminders will land in a future update." : "Your browser doesn't support web notifications. Install Plursky to your home screen for the full experience."));
  }
  var label = perm === "granted" ? "ENABLED" : perm === "denied" ? "BLOCKED" : "OFF";
  var labelColor = perm === "granted" ? "var(--success)" : perm === "denied" ? "#f87171" : "var(--muted)";
  return React.createElement("div", {
    style: {
      padding: 14,
      borderRadius: 14,
      background: "var(--paper)",
      border: "1px solid var(--line)",
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
    className: "mono",
    style: {
      fontSize: 10,
      letterSpacing: 1.5,
      color: "var(--muted)",
      fontWeight: 700
    }
  }, "REMINDERS"), React.createElement("span", {
    className: "mono",
    style: {
      fontSize: 9,
      letterSpacing: 1.3,
      color: labelColor,
      fontWeight: 700
    }
  }, flash === "enabled" ? "✓ ENABLED" : flash === "tested" ? "✓ TEST SENT" : label)), React.createElement("div", {
    className: "serif",
    style: {
      fontSize: 20,
      lineHeight: 1.1,
      marginBottom: 4
    }
  }, leadMin, "-min head-up before each set"), React.createElement("div", {
    style: {
      fontSize: 13,
      color: "var(--muted)",
      lineHeight: 1.5,
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
    className: "mono",
    style: {
      fontSize: 9,
      letterSpacing: 1.4,
      color: "var(--muted)",
      fontWeight: 700
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
        background: on ? "var(--ink)" : "transparent",
        color: on ? "var(--paper)" : "var(--ink)",
        border: on ? "none" : "1px solid var(--line-2)",
        fontSize: 10,
        letterSpacing: 1.1,
        fontWeight: on ? 700 : 500
      }
    }, m, "M");
  }))), perm === "denied" && React.createElement("div", {
    style: {
      background: "var(--paper-2)",
      border: "1px solid var(--line-2)",
      borderRadius: 10,
      padding: "10px 12px",
      marginBottom: 12
    }
  }, React.createElement("div", {
    className: "mono",
    style: {
      fontSize: 9,
      letterSpacing: 1.3,
      color: "var(--muted)",
      fontWeight: 700,
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
      color: "#fff",
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
  accent = "var(--ink)"
}) {
  var [open, setOpen] = React.useState(false);
  var canSwitch = FESTIVALS_REGISTRY.filter(f => f.available).length > 1;
  var entry = FESTIVALS_REGISTRY.find(f => f.config.id === FESTIVAL_CONFIG.id);
  return React.createElement(React.Fragment, null, React.createElement("div", {
    onClick: canSwitch ? () => setOpen(true) : undefined,
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
      padding: "0 12px 0 10px",
      borderRadius: 18,
      background: "var(--chrome)",
      border: "1px solid var(--line)",
      fontSize: 11,
      lineHeight: "14px",
      fontWeight: 600,
      letterSpacing: "0.04em"
    }
  }, React.createElement("span", {
    style: {
      fontSize: 14
    }
  }, entry?.emoji || "🎪"), React.createElement("span", null, FESTIVAL_CONFIG.shortName.toUpperCase()), canSwitch && React.createElement("svg", {
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
function FestivalSwitcher({
  onClose
}) {
  var activeId = FESTIVAL_CONFIG.id;
  var [plusOpen, setPlusOpen] = React.useState(false);
  var onPick = (id, entry) => {
    if (id === activeId) {
      onClose();
      return;
    }
    if (entry.available) {
      setActiveFestivalAndReload(id);
      return;
    }
    if (entry.previewOnly && window._isPlusSub?.()) {
      setActiveFestivalAndReload(id);
      return;
    }
    if (entry.previewOnly) {
      setPlusOpen(true);
      return;
    }
    onClose();
  };
  var byRegion = {};
  FESTIVALS_REGISTRY.forEach(f => {
    (byRegion[f.region] = byRegion[f.region] || []).push(f);
  });
  return React.createElement("div", {
    onClick: onClose,
    style: {
      position: "absolute",
      inset: 0,
      zIndex: 60,
      background: "rgba(13,8,4,0.55)",
      backdropFilter: "blur(6px)",
      display: "flex",
      alignItems: "flex-end",
      animation: "fadeIn .2s"
    }
  }, plusOpen && React.createElement(PlusSheet, {
    feature: "early festival access",
    onClose: () => setPlusOpen(false)
  }), React.createElement("div", {
    onClick: e => e.stopPropagation(),
    style: {
      background: "var(--paper)",
      color: "var(--ink)",
      borderTopLeftRadius: 22,
      borderTopRightRadius: 22,
      width: "100%",
      padding: "14px 20px 24px",
      boxShadow: "0 -10px 40px rgba(0,0,0,0.4)",
      maxHeight: "85%",
      overflowY: "auto"
    }
  }, React.createElement("div", {
    style: {
      display: "flex",
      justifyContent: "center",
      marginBottom: 12
    }
  }, React.createElement("div", {
    style: {
      width: 36,
      height: 4,
      borderRadius: 4,
      background: "var(--line-2)"
    }
  })), React.createElement("div", {
    className: "mono",
    style: {
      fontSize: 10,
      letterSpacing: 1.6,
      color: "var(--muted)",
      marginBottom: 4
    }
  }, "PICK A FESTIVAL"), React.createElement("div", {
    className: "serif",
    style: {
      fontSize: 24,
      lineHeight: 1.05,
      marginBottom: 18
    }
  }, "Where are you raving?"), Object.entries(byRegion).map(([region, fests]) => React.createElement("div", {
    key: region,
    style: {
      marginBottom: 18
    }
  }, React.createElement("div", {
    className: "mono",
    style: {
      fontSize: 9,
      letterSpacing: 1.5,
      color: "var(--muted)",
      marginBottom: 8,
      fontWeight: 600
    }
  }, region.toUpperCase()), React.createElement("div", {
    style: {
      display: "grid",
      gap: 8
    }
  }, fests.map(f => {
    var isActive = f.config.id === activeId;
    var dimmed = !f.available;
    return React.createElement("button", {
      key: f.config.id,
      onClick: () => onPick(f.config.id, f),
      disabled: !f.available && !f.previewOnly && !isActive,
      style: {
        display: "flex",
        alignItems: "center",
        gap: 12,
        padding: "12px 14px",
        borderRadius: 14,
        background: isActive ? f.accent : "var(--paper-2)",
        color: isActive ? "#fff" : "var(--ink)",
        border: `1px solid ${isActive ? f.accent : "var(--line-2)"}`,
        cursor: f.available ? "pointer" : "default",
        opacity: dimmed && !isActive ? 0.55 : 1,
        textAlign: "left",
        fontFamily: "inherit",
        transition: "transform .12s"
      }
    }, React.createElement("span", {
      style: {
        fontSize: 22
      }
    }, f.emoji), React.createElement("div", {
      style: {
        flex: 1,
        minWidth: 0
      }
    }, React.createElement("div", {
      className: "serif",
      style: {
        fontSize: 18,
        lineHeight: 1.05,
        fontWeight: 400
      }
    }, f.config.name), React.createElement("div", {
      className: "mono",
      style: {
        fontSize: 10,
        letterSpacing: 1,
        marginTop: 3,
        opacity: 0.85
      }
    }, f.config.location.toUpperCase(), " · ", f.config.dates.toUpperCase())), isActive && React.createElement("div", {
      className: "mono",
      style: {
        fontSize: 9,
        letterSpacing: 1.2,
        fontWeight: 700,
        padding: "3px 7px",
        borderRadius: 999,
        background: "rgba(255,255,255,0.25)"
      }
    }, "ACTIVE"), !isActive && !f.available && f.previewOnly && React.createElement("div", {
      className: "mono",
      style: {
        fontSize: 9,
        letterSpacing: 1.2,
        fontWeight: 700,
        padding: "3px 7px",
        borderRadius: 999,
        background: "#6D28D9",
        color: "#fff"
      }
    }, "EARLY ACCESS"), !isActive && !f.available && !f.previewOnly && React.createElement("div", {
      className: "mono",
      style: {
        fontSize: 9,
        letterSpacing: 1.2,
        fontWeight: 700,
        padding: "3px 7px",
        borderRadius: 999,
        background: "var(--paper)",
        color: "var(--muted)",
        border: "1px solid var(--line-2)"
      }
    }, "SOON"));
  })))), React.createElement("div", {
    className: "mono",
    style: {
      fontSize: 9,
      letterSpacing: 1.2,
      color: "var(--muted)",
      marginTop: 6,
      textAlign: "center",
      lineHeight: 1.5
    }
  }, "More festivals coming through 2026.", React.createElement("br", null), "Switching reloads the app with the new festival's data.")));
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
  active: false,
  listeners: new Set()
};
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
      padding: "10px 14px",
      borderRadius: 14,
      background: "var(--ink)",
      color: "var(--paper)",
      display: "flex",
      alignItems: "center",
      gap: 10,
      boxShadow: "0 8px 24px rgba(0,0,0,0.35)"
    }
  }, React.createElement("span", {
    style: {
      fontSize: 16
    }
  }, "🔋"), React.createElement("div", {
    style: {
      flex: 1,
      minWidth: 0
    }
  }, React.createElement("div", {
    className: "mono",
    style: {
      fontSize: 9,
      letterSpacing: 1.4,
      color: "var(--flare)",
      fontWeight: 700
    }
  }, "BATTERY SAVER ON"), React.createElement("div", {
    style: {
      fontSize: 13,
      lineHeight: 1.35,
      marginTop: 2,
      color: "rgba(247,237,224,0.85)"
    }
  }, reason)), React.createElement("button", {
    onClick: () => setDismissed(true),
    "aria-label": "Dismiss",
    style: {
      background: "transparent",
      border: "none",
      cursor: "pointer",
      color: "rgba(247,237,224,0.6)",
      fontSize: 18,
      lineHeight: 1,
      padding: 4
    }
  }, "×"));
}
function BatterySaverCard() {
  var {
    active,
    mode,
    battery,
    setMode
  } = useBatterySaver();
  var segs = [{
    id: "off",
    label: "OFF"
  }, {
    id: "auto",
    label: "AUTO"
  }, {
    id: "on",
    label: "ON"
  }];
  var battPct = battery ? Math.round(battery.level * 100) : null;
  var battColor = battPct == null ? "var(--muted)" : battPct > 50 ? "var(--success)" : battPct > 20 ? "var(--flare)" : "#f87171";
  return React.createElement("div", {
    style: {
      padding: 14,
      borderRadius: 14,
      background: "var(--paper)",
      border: "1px solid var(--line)",
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
    className: "mono",
    style: {
      fontSize: 10,
      letterSpacing: 1.5,
      color: "var(--muted)",
      fontWeight: 700
    }
  }, "BATTERY SAVER"), React.createElement("span", {
    className: "mono",
    style: {
      fontSize: 9,
      letterSpacing: 1.3,
      color: active ? "var(--success)" : "var(--muted)",
      fontWeight: 700
    }
  }, active ? "✓ ACTIVE" : "STANDBY")), React.createElement("div", {
    className: "serif",
    style: {
      fontSize: 20,
      lineHeight: 1.1,
      marginBottom: 4
    }
  }, "Stretch the phone past sunrise"), React.createElement("div", {
    style: {
      fontSize: 13,
      color: "var(--muted)",
      lineHeight: 1.5,
      marginBottom: 12
    }
  }, "Dims the screen, freezes animations, and slows GPS polling. Auto kicks in at 2 AM or when battery drops under 25%."), React.createElement("div", {
    style: {
      display: "grid",
      gridTemplateColumns: "repeat(3, 1fr)",
      gap: 4,
      background: "var(--paper-2)",
      borderRadius: 999,
      padding: 3,
      border: "1px solid var(--line)"
    }
  }, segs.map(s => {
    var on = mode === s.id;
    return React.createElement("button", {
      key: s.id,
      onClick: () => setMode(s.id),
      style: {
        background: on ? "var(--ink)" : "transparent",
        color: on ? "var(--paper)" : "var(--ink)",
        border: "none",
        borderRadius: 999,
        padding: "7px 10px",
        fontFamily: "Geist Mono, monospace",
        fontSize: 10,
        letterSpacing: 1.2,
        fontWeight: 700,
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
var THEME_PREF_KEY = "theme_pref";
var _TH = window._TH = window._TH || {
  mode: (() => {
    try {
      return localStorage.getItem(THEME_PREF_KEY) || "auto";
    } catch {
      return "auto";
    }
  })(),
  listeners: new Set()
};
function resolveThemeClass(mode) {
  return "theme-field";
}
function applyThemeClass() {
  var next = resolveThemeClass(_TH.mode);
  if (document.documentElement.className !== next) {
    document.documentElement.className = next;
  }
  return next;
}
function setThemeMode(mode) {
  if (!["auto", "light", "dark"].includes(mode)) return;
  _TH.mode = mode;
  try {
    localStorage.setItem(THEME_PREF_KEY, mode);
  } catch {}
  applyThemeClass();
  _TH.listeners.forEach(fn => {
    try {
      fn(mode);
    } catch {}
  });
}
if (!window._thInited) {
  window._thInited = true;
  try {
    applyThemeClass();
  } catch {}
}
function useThemeMode() {
  var [, force] = React.useReducer(x => x + 1, 0);
  React.useEffect(() => {
    _TH.listeners.add(force);
    return () => _TH.listeners.delete(force);
  }, []);
  return {
    mode: _TH.mode,
    setMode: setThemeMode
  };
}
function ThemeCard() {
  var {
    mode,
    setMode
  } = useThemeMode();
  var segs = [{
    id: "auto",
    label: "AUTO"
  }, {
    id: "light",
    label: "LIGHT"
  }, {
    id: "dark",
    label: "DARK"
  }];
  var activeClass = resolveThemeClass(mode);
  var nowLabel = activeClass === "theme-night" ? "NIGHT" : activeClass === "theme-dawn" ? "DAWN" : activeClass === "theme-sunset" ? "SUNSET" : "LIGHT";
  return React.createElement("div", {
    style: {
      padding: 14,
      borderRadius: 14,
      background: "var(--paper)",
      border: "1px solid var(--line)",
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
    className: "mono",
    style: {
      fontSize: 10,
      letterSpacing: 1.5,
      color: "var(--muted)",
      fontWeight: 700
    }
  }, "THEME"), React.createElement("span", {
    className: "mono",
    style: {
      fontSize: 9,
      letterSpacing: 1.3,
      color: "var(--muted)",
      fontWeight: 700
    }
  }, nowLabel)), React.createElement("div", {
    className: "serif",
    style: {
      fontSize: 20,
      lineHeight: 1.1,
      marginBottom: 4
    }
  }, "Paper by day, stars by night"), React.createElement("div", {
    style: {
      fontSize: 13,
      color: "var(--muted)",
      lineHeight: 1.5,
      marginBottom: 12
    }
  }, "Auto follows the sky during the festival. Pin light or dark anytime."), React.createElement("div", {
    style: {
      display: "grid",
      gridTemplateColumns: "repeat(3, 1fr)",
      gap: 4,
      background: "var(--paper-2)",
      borderRadius: 999,
      padding: 3,
      border: "1px solid var(--line)"
    }
  }, segs.map(s => {
    var on = mode === s.id;
    return React.createElement("button", {
      key: s.id,
      onClick: () => setMode(s.id),
      style: {
        background: on ? "var(--ink)" : "transparent",
        color: on ? "var(--paper)" : "var(--ink)",
        border: "none",
        borderRadius: 999,
        padding: "7px 10px",
        fontFamily: "Geist Mono, monospace",
        fontSize: 10,
        letterSpacing: 1.2,
        fontWeight: 700,
        cursor: "pointer"
      }
    }, s.label);
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
    active: bsActive
  } = useBatterySaver();
  var now = new Date();
  var day = _STATUS_DAYS[now.getDay()];
  var hh = String(now.getHours()).padStart(2, "0");
  var mm = String(now.getMinutes()).padStart(2, "0");
  return React.createElement("div", {
    className: "mono",
    style: {
      flexShrink: 0,
      height: 22,
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      padding: "0 16px",
      background: "var(--paper-2)",
      borderBottom: "1px solid var(--line)",
      fontSize: 10,
      letterSpacing: 1.4,
      fontWeight: 600,
      color: "var(--muted)"
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
  })), "SAVER"), !online && React.createElement("span", {
    style: {
      display: "inline-flex",
      alignItems: "center",
      gap: 4,
      color: "#c14a37"
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
  })), "OFFLINE")));
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
  useInstallPrompt,
  InstallBanner,
  useNotifications,
  NotificationsCard,
  scheduleReminders,
  getAllAttended,
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
  useThemeMode,
  ThemeCard,
  setThemeMode,
  resolveThemeClass,
  applyThemeClass,
  useOnlineStatus,
  StatusStrip,
  plurskyHaptic
});