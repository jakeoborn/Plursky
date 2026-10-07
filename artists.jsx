// artists.jsx — the Artists directory (artist repository, M5).
//
// Every artist billed across Plursky's festivals, A–Z, from the registry's
// directory slice (scripts/build-artist-registry.mjs → data/artists/
// directory.json). The slice loads on demand and is never precached, like
// the past editions. Names are the registry's display names, in full; a
// lineup row elsewhere still shows its billing verbatim.
//
// Patterns (spec §5, §9): Weverse's A–Z with members under a group,
// Snapchat / Yahoo News's index scrubber, Deezer / Spotify's events rows.
// Rows are windowed: only what is near the viewport renders, with each
// row's real height measured, because a name wraps instead of being cut.

const _ART_DIR_URL = "data/artists/directory.json";
let _artDirPromise = null;

function _artDirFetch() {
  if (!_artDirPromise) {
    _artDirPromise = fetch(_ART_DIR_URL).then(r => {
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return r.json();
    }).catch(e => { _artDirPromise = null; throw e; });
  }
  return _artDirPromise;
}

function useArtistDirectory() {
  const [res, setRes] = React.useState({ status: "loading" });
  const [attempt, setAttempt] = React.useState(0);
  React.useEffect(() => {
    let live = true;
    setRes({ status: "loading" });
    _artDirFetch().then(data => { if (live) setRes({ status: "ready", data }); })
      .catch(() => { if (live) setRes({ status: "error" }); });
    return () => { live = false; };
  }, [attempt]);
  return [res, () => setAttempt(a => a + 1)];
}

const _artFold = s => window.PlurskyArtistKey.foldKey(s);
const _artFestShort = name => String(name).replace(/\s+20\d\d$/, "");
function _artToday() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function _artDay(ymd, weekday) {
  try { return new Date(`${ymd}T12:00:00Z`).toLocaleDateString("en-US", { timeZone: "UTC", month: "short", day: "numeric", ...(weekday ? { weekday: "short" } : {}) }); } catch { return ymd; }
}
// Section letter: A–Z by the folded display name, everything else under #.
function _artLetter(a) { const c = _artFold(a.n)[0] || "#"; return /[a-z]/.test(c) ? c.toUpperCase() : "#"; }

// "6 festivals · next: EDC Orlando, Nov 6". A key still under review may be
// more than one act, so it never reads as one career.
function _artMeta(a, fests, today) {
  if (a.pending) return `${a.b.length} billing${a.b.length === 1 ? "" : "s"} · may be more than one act`;
  if (!a.b.length) return "";
  const brands = new Set(a.b.map(b => fests[b[0]].brand));
  const parts = [`${brands.size} festival${brands.size === 1 ? "" : "s"}`];
  const next = a.b.find(b => _artUpcoming(b, today));
  if (next) parts.push(`next: ${_artFestShort(fests[next[0]].name)}, ${_artDay(_artUpcoming(next, today))}`);
  else {
    const last = [...a.b].reverse().find(b => b[1]);
    if (last) parts.push(`last: ${_artFestShort(fests[last[0]].name)} ${last[1].slice(0, 4)}`);
  }
  return parts.join(" · ");
}
// The second line: the people behind a project or collab (Weverse's members
// line), or the projects an artist also plays as.
// A billing's next date on or after today: its own, or the second weekend
// of an ACL "both" act (b[8]); null once both have passed.
function _artUpcoming(b, today) {
  if (b[1] && b[1] >= today) return b[1];
  if (b[8] && b[8] >= today) return b[8];
  return null;
}
function _artSecond(a) {
  if (a.m) return a.m.join(" · ");
  if (a.p) return `Also plays as ${a.p.join(", ")}`;
  return null;
}

// A reviewed ledger photo or initials. Never a Spotify lookup: scrolling
// 2,500 names must not queue 2,500 requests.
function _ArtFace({ name, size = 40 }) {
  const rec = typeof getPermanentArtistImage === "function" ? getPermanentArtistImage(name) : null;
  return (
    <span className="duo-av" aria-hidden="true" style={{ width: size, height: size, fontSize: Math.round(size * 0.32) }}>
      {rec ? <img src={rec.url} alt="" /> : _duoInitials(name)}
    </span>
  );
}

function ArtistsDirectoryScreen({ state, setState }) {
  const [res, retry] = useArtistDirectory();
  const [q, setQ] = React.useState(state.artistsQuery || "");
  const [playing, setPlaying] = React.useState(false);
  const [fest, setFest] = React.useState("");
  const [open, setOpen] = React.useState(null);
  const today = _artToday(), year = today.slice(0, 4);
  const data = res.status === "ready" ? res.data : null;
  const fests = data ? data.festivals : [];
  // Lineup's search opens the directory scoped to the festival you have
  // open (Me's row opens it across every festival); the chip widens it.
  const scoped = React.useRef(false);
  React.useLayoutEffect(() => {
    if (!data || scoped.current) return;
    scoped.current = true;
    const i = state.artistsFestival ? data.festivals.findIndex(f => f.id === state.artistsFestival) : -1;
    if (i >= 0) setFest(String(i));
  }, [data]);

  const list = React.useMemo(() => {
    if (!data) return [];
    const fq = q.trim() ? _artFold(q.trim()) : "";
    const fi = fest === "" ? -1 : +fest;
    return data.artists.filter(a => {
      // Playing this year: a billing of its own, dated, still to come. A
      // name that only plays as a project (Bryan Kearney as Key4050) is not.
      if (playing && !a.b.some(b => { const d = _artUpcoming(b, today); return d && d.startsWith(year); })) return false;
      if (fi >= 0 && !a.b.some(b => b[0] === fi)) return false;
      if (fq && ![a.n, ...(a.m || []), ...(a.p || [])].some(s => _artFold(s).includes(fq))) return false;
      return true;
    }).sort((x, y) => _artFold(x.n).localeCompare(_artFold(y.n)));
  }, [data, q, playing, fest, today, year]);

  const items = React.useMemo(() => {
    const out = []; let cur = null;
    for (const a of list) {
      const L = _artLetter(a);
      if (L !== cur) { cur = L; out.push({ t: "h", key: `h:${L}`, letter: L }); }
      out.push({ t: "r", key: a.k, a });
    }
    return out;
  }, [list]);

  const back = () => { if (window._popNav) window._popNav(); else setState(s => ({ ...s, tab: "me" })); };
  const openBilling = (b) => {
    const f = fests[b[0]];
    if (b[7] && f.id === (window.FESTIVAL_CONFIG && FESTIVAL_CONFIG.id)) (window._pushNav || (n => setState(s => ({ ...s, ...n }))))({ artist: b[7] });
    else if (!b[7]) (window._pushNav || (n => setState(s => ({ ...s, ...n }))))({ tab: "past", pastEdition: f.id, pastDirect: true, artist: null });
    setOpen(null);
  };
  // Festivals that actually bill someone, newest first, for the picker.
  const festOptions = fests.map((f, i) => ({ i, f })).sort((x, y) => (y.f.year || 0) - (x.f.year || 0) || x.f.name.localeCompare(y.f.name));

  return (
    <Screen>
      <_HistHeader title="Artists" sub={fest === "" ? "Across every festival" : "At one festival"} onBack={back} />
      <div data-artists-controls style={{ padding: "8px 20px 4px", display: "grid", gap: 4 }}>
        <input type="search" value={q} onChange={e => setQ(e.target.value)} placeholder="Search artists"
          aria-label="Search artists" autoComplete="off" spellCheck={false}
          style={{ width: "100%", boxSizing: "border-box", height: 44, padding: "0 14px", borderRadius: "var(--rad-md)",
            border: "1px solid var(--line-2)", background: "var(--s2)", color: "var(--ink)", font: "400 16px/1 var(--f-ui)" }} />
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
          <button className="duo-chip" aria-pressed={playing} data-artists-playing onClick={() => setPlaying(v => !v)}><span>Playing {year}</span></button>
          <label className="duo-chip" style={{ position: "relative" }}>
            <span>{fest === "" ? "Festival" : _artFestShort(fests[+fest]?.name || "Festival") + (fests[+fest]?.year ? ` ${fests[+fest].year}` : "")}</span>
            <select data-artists-festival aria-label="Festival" value={fest} onChange={e => setFest(e.target.value)}
              style={{ position: "absolute", inset: 0, opacity: 0, width: "100%", cursor: "pointer" }}>
              <option value="">All festivals</option>
              {festOptions.map(({ i, f }) => <option key={f.id} value={String(i)}>{f.name}</option>)}
            </select>
          </label>
        </div>
        {data && <div className="duo-data-s duo-ink3" data-artists-count aria-live="polite">{list.length.toLocaleString("en-US")} {list.length === 1 ? "artist" : "artists"}</div>}
      </div>
      {res.status !== "ready"
        ? <_HistStatus res={res} retry={retry} what="artists" />
        : list.length
          ? <_ArtistsWindow items={items} fests={fests} today={today} onOpen={setOpen} />
          : <p role="status" className="duo-body-s duo-ink2" style={{ margin: "24px 20px", fontWeight: 400 }}>No artist matches. Names are as each festival billed them.</p>}
      {open && <_ArtistBillingsSheet a={open} fests={fests} today={today} onClose={() => setOpen(null)} onOpenBilling={openBilling} />}
    </Screen>
  );
}

const _ART_EST = { h: 40, r: 72 };
function _ArtistsWindow({ items, fests, today, onOpen }) {
  const scRef = React.useRef(null);
  const heights = React.useRef(new Map());
  const [ver, setVer] = React.useState(0);
  const [view, setView] = React.useState({ top: 0, h: 800 });
  const offsets = React.useMemo(() => {
    const o = new Float64Array(items.length + 1);
    for (let i = 0; i < items.length; i++) o[i + 1] = o[i] + (heights.current.get(items[i].key) ?? _ART_EST[items[i].t]);
    return o;
  }, [items, ver]);
  // A new filter starts at the top.
  React.useLayoutEffect(() => { if (scRef.current) scRef.current.scrollTop = 0; }, [items]);
  React.useLayoutEffect(() => {
    const sc = scRef.current; if (!sc) return undefined;
    const read = () => setView({ top: sc.scrollTop, h: sc.clientHeight });
    read();
    let raf = 0;
    const onScroll = () => { if (!raf) raf = requestAnimationFrame(() => { raf = 0; read(); }); };
    sc.addEventListener("scroll", onScroll, { passive: true });
    const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(read) : null;
    if (ro) ro.observe(sc);
    return () => { sc.removeEventListener("scroll", onScroll); if (ro) ro.disconnect(); if (raf) cancelAnimationFrame(raf); };
  }, []);
  const OVER = 600;
  let lo = 0, hi = items.length;
  { let a = 0, b = items.length; while (a < b) { const m = (a + b) >> 1; if (offsets[m + 1] < view.top - OVER) a = m + 1; else b = m; } lo = a; }
  { let i = lo; while (i < items.length && offsets[i] < view.top + view.h + OVER) i++; hi = i; }
  // Measure what rendered; a row above the viewport that changed height
  // moves the scroll by the same amount, so the list never jumps.
  React.useLayoutEffect(() => {
    const sc = scRef.current; if (!sc) return;
    let changed = false, above = 0;
    for (const el of sc.querySelectorAll("[data-dir-item]")) {
      const k = el.dataset.dirItem, h = el.offsetHeight, i = +el.dataset.dirIndex;
      const was = heights.current.get(k) ?? _ART_EST[items[i]?.t || "r"];
      if (Math.abs(was - h) > 0.5) { heights.current.set(k, h); changed = true; if (offsets[i] < sc.scrollTop) above += h - was; }
      else if (!heights.current.has(k)) heights.current.set(k, h);
    }
    if (changed) { if (above) sc.scrollTop += above; setVer(v => v + 1); }
  });
  // The index scrubber: letters present in the list; a press or drag jumps
  // to that section.
  const letters = React.useMemo(() => items.map((it, i) => it.t === "h" ? [it.letter, i] : null).filter(Boolean), [items]);
  // Letters sit at a fixed pitch, centred, and shrink only when they would not
  // fit, so two letters stay together instead of being spread over the whole
  // height beside unrelated rows. A press or drag picks the letter nearest the
  // finger, read from the letters' own rects.
  const jumpTo = (y, el) => {
    if (!letters.length || !el) return;
    let best = 0, bestD = Infinity;
    [...el.children].forEach((c, k) => {
      const r = c.getBoundingClientRect(), d = Math.abs(y - (r.top + r.height / 2));
      if (d < bestD) { bestD = d; best = k; }
    });
    const sc = scRef.current; if (sc) sc.scrollTop = offsets[letters[best][1]];
  };
  const onScrub = (e) => jumpTo(e.clientY, e.currentTarget);
  return (
    <div style={{ flex: 1, position: "relative", minHeight: 0 }}>
      <div ref={scRef} data-artists-scroll style={{ position: "absolute", inset: 0, overflowY: "auto", WebkitOverflowScrolling: "touch" }}>
        <div style={{ position: "relative", height: offsets[items.length] + 94 }}>
          {items.slice(lo, hi).map((it, j) => {
            const i = lo + j;
            const pos = { position: "absolute", top: offsets[i], left: 0, right: 0 };
            if (it.t === "h") return (
              <h2 key={it.key} data-dir-item={it.key} data-dir-index={i} data-dir-letter={it.letter} className="duo-sect"
                style={{ ...pos, margin: 0, padding: "16px 40px 6px 20px", boxSizing: "border-box" }}>{it.letter}</h2>
            );
            const a = it.a, second = _artSecond(a);
            return (
              <button key={it.key} data-dir-item={it.key} data-dir-index={i} data-artist-row={a.k} onClick={() => onOpen(a)} style={{
                ...pos, display: "flex", alignItems: "center", gap: 12, minHeight: 64, boxSizing: "border-box",
                padding: "10px 40px 10px 20px", background: "transparent", border: "none", borderBottom: "1px solid var(--line)",
                color: "var(--ink)", textAlign: "left", fontFamily: "inherit", cursor: "pointer",
              }}>
                <_ArtFace name={a.n} />
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span className="duo-name duo-body" style={{ display: "block", fontWeight: 600 }}>{a.n}</span>
                  {second && <span className="duo-body-s duo-ink2" style={{ display: "block", fontWeight: 400, overflowWrap: "anywhere" }}>{second}</span>}
                  <span className="duo-body-s duo-ink3" style={{ display: "block", fontWeight: 400, marginTop: 2 }}>{_artMeta(a, fests, today)}</span>
                </span>
              </button>
            );
          })}
        </div>
      </div>
      {letters.length > 1 && (
        <div data-artists-scrubber role="navigation" aria-label="Jump to letter"
          onPointerDown={e => { try { e.currentTarget.setPointerCapture(e.pointerId); } catch {} onScrub(e); }}
          onPointerMove={e => { if (e.buttons) onScrub(e); }}
          style={{ position: "absolute", right: 0, top: 8, bottom: 94, width: 32, display: "flex", flexDirection: "column",
            justifyContent: "center", alignItems: "center", touchAction: "none", userSelect: "none", cursor: "pointer" }}>
          {letters.map(([L, i]) => (
            <button key={L} aria-label={`Artists starting with ${L === "#" ? "a number or symbol" : L}`}
              onClick={() => { const sc = scRef.current; if (sc) sc.scrollTop = offsets[i]; }}
              className="duo-data-s duo-acc" style={{ flex: "0 1 18px", width: "100%", display: "flex", alignItems: "center", justifyContent: "center",
                background: "none", border: "none", padding: 0, minHeight: 0, lineHeight: 1, font: "600 11px/1 var(--f-ui)", color: "var(--acc-ink)" }}>{L}</button>
          ))}
        </div>
      )}
    </div>
  );
}

// One artist's billings in our records, newest year first (Deezer / Spotify
// events rows). A set at the festival you have open opens its artist page;
// an archived set opens that past edition. Billing text stays verbatim.
function _ArtistBillingsSheet({ a, fests, today, onClose, onOpenBilling }) {
  const years = [...new Set(a.b.map(b => (b[1] || "").slice(0, 4) || String(fests[b[0]].year || "")))].sort().reverse();
  const activeId = window.FESTIVAL_CONFIG && FESTIVAL_CONFIG.id;
  const second = _artSecond(a);
  return (
    <FieldSheet title={a.n} onClose={onClose}>
      <div data-artist-sheet={a.k}>
        {second && <p className="duo-body-s duo-ink2" style={{ margin: "0 0 8px", fontWeight: 400 }}>{second}</p>}
        {a.pending && (
          <p data-artist-sheet-pending className="duo-body-s duo-ink2" style={{ margin: "0 0 8px", fontWeight: 400 }}>
            These billings share a name and may be more than one act. They are listed separately until an official source ties them together.
          </p>
        )}
        {!a.b.length && <p className="duo-body-s duo-ink2" style={{ margin: "8px 0", fontWeight: 400 }}>No billings under this name; see the projects above.</p>}
        {years.map(y => (
          <section key={y} style={{ marginTop: 12 }}>
            <h3 className="duo-sect" style={{ margin: "0 0 4px" }}>{y}</h3>
            {a.b.filter(b => ((b[1] || "").slice(0, 4) || String(fests[b[0]].year || "")) === y).slice().reverse().map((b, i) => {
              const f = fests[b[0]];
              const can = (b[7] && f.id === activeId) || !b[7];
              const when = [b[1] ? _artDay(b[1], true) + (b[8] ? ` and ${_artDay(b[8], true)}` : "") : "Date to be announced", b[3] && typeof fmt12 === "function" ? fmt12(b[3]) : b[3]].filter(Boolean).join(" · ");
              const where = [b[2], b[4]].filter(Boolean).join(" · ");
              const body = (
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span className="duo-body" style={{ display: "block", fontWeight: 600 }}>{f.name}</span>
                  <span className="duo-body-s duo-ink2" style={{ display: "block", fontWeight: 400 }}>{when}{where ? ` · ${where}` : ""}</span>
                  {_artFold(b[6]) !== _artFold(a.n) && <span className="duo-body-s duo-ink3" style={{ display: "block", fontWeight: 400, overflowWrap: "anywhere" }}>Billed as {b[6]}</span>}
                </span>
              );
              return can ? (
                <button key={i} data-artist-billing onClick={() => onOpenBilling(b)} style={{ width: "100%", display: "flex", alignItems: "center", gap: 12, minHeight: 56, padding: "8px 0",
                  background: "transparent", border: "none", borderBottom: "1px solid var(--line)", color: "var(--ink)", textAlign: "left", fontFamily: "inherit", cursor: "pointer" }}>
                  {body}
                  <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: "var(--ink-3)", flex: "none" }}><path d="M9 6 L15 12 L9 18"/></svg>
                </button>
              ) : (
                <div key={i} data-artist-billing style={{ display: "flex", alignItems: "center", gap: 12, minHeight: 56, padding: "8px 0", borderBottom: "1px solid var(--line)" }}>{body}</div>
              );
            })}
          </section>
        ))}
      </div>
    </FieldSheet>
  );
}

// The entry on Me, under All festivals.
function ArtistsDirectoryRow() {
  return (
    <button data-artists-entry onClick={() => (window._pushNav || (() => {}))({ tab: "artists", artist: null, artistsQuery: "", artistsFestival: null, artistsFrom: "me" })}
      className="duo-card" style={{
        width: "100%", minHeight: 52, marginBottom: 14, padding: "10px 16px",
        display: "flex", alignItems: "center", gap: 12, border: "none",
        color: "var(--ink)", cursor: "pointer", textAlign: "left", fontFamily: "inherit",
      }}>
      <span className="duo-headline" style={{ flex: 1, minWidth: 0 }}>All artists</span>
      <span className="duo-body-s duo-ink2" style={{ flexShrink: 0 }}>Every festival</span>
    </button>
  );
}
