// One icon geometry (24-grid), three renderings — each direction sets
// stroke width, caps and fill rule. Keeping the geometry shared means the
// winner's icon set is already drawn; only the rendering rule changes.
(function () {
  const P = {
    today:  "M12 20 3.5 9 M12 20 8.5 5 M12 20 15.5 5 M12 20 20.5 9 M9 20h6",
    lineup: "M4 6h16 M4 12h11 M4 18h14",
    map:    "M9 4 3 6.2v13.8l6-2.2 6 2.2 6-2.2V4l-6 2.2L9 4z M9 4v13.8 M15 6.2V20",
    me:     "M12 12.5a4.25 4.25 0 1 0 0-8.5 4.25 4.25 0 0 0 0 8.5z M4.5 20.5c1.4-3.7 4.3-5.6 7.5-5.6s6.1 1.9 7.5 5.6",
    search: "M10.5 17a6.5 6.5 0 1 0 0-13 6.5 6.5 0 0 0 0 13z M15.3 15.3 20 20",
    filter: "M4 7h10 M18 7h2 M4 17h2 M10 17h10 M16 9.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z M8 19.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z",
    back:   "M15 5 8 12l7 7",
    share:  "M12 3v12 M7.5 7.5 12 3l4.5 4.5 M5 12v7.5h14V12",
    check:  "M5 12.5 10 17.5 19.5 7",
    plus:   "M12 5v14 M5 12h14",
    sun:    "M12 16a4 4 0 1 0 0-8 4 4 0 0 0 0 8z M12 2.5v2 M12 19.5v2 M2.5 12h2 M19.5 12h2 M5.3 5.3l1.4 1.4 M17.3 17.3l1.4 1.4 M5.3 18.7l1.4-1.4 M17.3 6.7l1.4-1.4",
    clash:  "M5 5l14 14 M19 5 5 19",
    water:  "M12 3.5c3.2 4 5.5 7.1 5.5 10a5.5 5.5 0 0 1-11 0c0-2.9 2.3-6 5.5-10z",
    medic:  "M9.5 4h5v5.5H20v5h-5.5V20h-5v-5.5H4v-5h5.5z",
    play:   "M8 5.5v13l10.5-6.5z",
    gear:   "M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z M19 12a7 7 0 0 0-.1-1.2l2-1.5-2-3.4-2.3.9a7 7 0 0 0-2.1-1.2L14 3h-4l-.5 2.6a7 7 0 0 0-2.1 1.2l-2.3-.9-2 3.4 2 1.5A7 7 0 0 0 5 12c0 .4 0 .8.1 1.2l-2 1.5 2 3.4 2.3-.9a7 7 0 0 0 2.1 1.2L10 21h4l.5-2.6a7 7 0 0 0 2.1-1.2l2.3.9 2-3.4-2-1.5c.1-.4.1-.8.1-1.2z",
    chevron:"M9 5l7 7-7 7",
    pin:    "M12 21s-6.5-6.2-6.5-11a6.5 6.5 0 0 1 13 0c0 4.8-6.5 11-6.5 11z M12 12.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z",
    crew:   "M8.5 11a3.25 3.25 0 1 0 0-6.5 3.25 3.25 0 0 0 0 6.5z M16.5 10a2.75 2.75 0 1 0 0-5.5 2.75 2.75 0 0 0 0 5.5z M2.5 19.5c1-3 3.3-4.6 6-4.6s5 1.6 6 4.6 M15 14.6c2.8-.3 5 1.1 6.3 4.4",
    heart:  "M12 20s-7.5-4.6-7.5-10.2A4.3 4.3 0 0 1 12 7.2a4.3 4.3 0 0 1 7.5 2.6C19.5 15.4 12 20 12 20z",
    bolt:   "M13 2.5 5 13.5h6l-1 8 8-11h-6z",
    photo:  "M4 6.5h16v12H4z M4 15.5l4.5-4 3.5 3 2.5-2 5.5 4.5 M15.5 10.5a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3z",
  };
  window.ICON = function (name, o) {
    o = Object.assign({ size: 24, sw: 1.6, color: "currentColor", cap: "round", join: "round", fill: "none", under: null }, o || {});
    const d = P[name];
    const under = o.under ? `<path d="${d}" fill="${o.under}" stroke="none"/>` : "";
    return `<svg width="${o.size}" height="${o.size}" viewBox="0 0 24 24" aria-hidden="true" style="display:block;flex:none">${under}<path d="${d}" fill="${o.fill}" stroke="${o.color}" stroke-width="${o.sw}" stroke-linecap="${o.cap}" stroke-linejoin="${o.join}"/></svg>`;
  };
  window.ICON_NAMES = Object.keys(P);

  // iOS status bar + home indicator, coloured by the caller.
  window.STATUS = function (time, color) {
    return `<div style="position:absolute;top:0;left:0;right:0;height:54px;display:flex;align-items:center;justify-content:space-between;padding:6px 34px 0 42px;color:${color};z-index:20;font:600 17px/1 -apple-system,BlinkMacSystemFont,'SF Pro Text',sans-serif;letter-spacing:-.01em">
      <span>${time}</span>
      <span style="display:flex;gap:6px;align-items:center">
        <svg width="18" height="12" viewBox="0 0 18 12"><rect x="0" y="8" width="3" height="4" rx="1" fill="currentColor"/><rect x="5" y="5.5" width="3" height="6.5" rx="1" fill="currentColor"/><rect x="10" y="3" width="3" height="9" rx="1" fill="currentColor"/><rect x="15" y="0" width="3" height="12" rx="1" fill="currentColor" opacity=".35"/></svg>
        <svg width="16" height="12" viewBox="0 0 16 12"><path d="M8 11.5 5.6 9a3.4 3.4 0 0 1 4.8 0z M3.4 6.8a6.5 6.5 0 0 1 9.2 0l-1.4 1.4a4.5 4.5 0 0 0-6.4 0z M1 4.4a10 10 0 0 1 14 0l-1.4 1.4a8 8 0 0 0-11.2 0z" fill="currentColor"/></svg>
        <svg width="27" height="13" viewBox="0 0 27 13"><rect x=".5" y=".5" width="23" height="12" rx="3.5" fill="none" stroke="currentColor" opacity=".4"/><rect x="2" y="2" width="14" height="9" rx="2" fill="currentColor"/><path d="M25 4.5v4c.8-.3 1.3-1.1 1.3-2s-.5-1.7-1.3-2z" fill="currentColor" opacity=".4"/></svg>
      </span></div>`;
  };
  window.HOMEBAR = (color) => `<div style="position:absolute;bottom:8px;left:50%;transform:translateX(-50%);width:140px;height:5px;border-radius:3px;background:${color};z-index:30"></div>`;
})();
