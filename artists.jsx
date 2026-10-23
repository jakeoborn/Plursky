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
// The career slice (M6): every billing with its id, for the artist page.
const _ART_CAREER_URL = "data/artists/careers.json";
const _artSlices = {};

function _artSliceFetch(url) {
  if (!_artSlices[url]) {
    _artSlices[url] = fetch(url).then(r => {
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return r.json();
    }).catch(e => { delete _artSlices[url]; throw e; });
  }
  return _artSlices[url];
}
const _artDirFetch = () => _artSliceFetch(_ART_DIR_URL);

function _useArtSlice(url) {
  const [res, setRes] = React.useState({ status: "loading" });
  const [attempt, setAttempt] = React.useState(0);
  React.useEffect(() => {
    let live = true;
    setRes({ status: "loading" });
    _artSliceFetch(url).then(data => { if (live) setRes({ status: "ready", data }); })
      .catch(() => { if (live) setRes({ status: "error" }); });
    return () => { live = false; };
  }, [url, attempt]);
  return [res, () => setAttempt(a => a + 1)];
}
const useArtistDirectory = () => _useArtSlice(_ART_DIR_URL);

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
  const [q, setQ] = React.useState("");
  const [playing, setPlaying] = React.useState(false);
  const [fest, setFest] = React.useState("");
  const [open, setOpen] = React.useState(null);
  const today = _artToday(), year = today.slice(0, 4);
  const data = res.status === "ready" ? res.data : null;
  const fests = data ? data.festivals : [];

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
  const openBilling = (b) => { _artOpenBilling(fests[b[0]], b[7], setState); setOpen(null); };
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
// A set at the open festival opens its artist page; an archived set opens
// its past edition; a set at another live festival opens nothing.
function _artOpenBilling(f, liveId, setState) {
  const go = window._pushNav || (n => setState(s => ({ ...s, ...n })));
  if (liveId && f.id === (window.FESTIVAL_CONFIG && FESTIVAL_CONFIG.id)) go({ artist: liveId });
  else if (!liveId) go({ tab: "past", pastEdition: f.id, pastDirect: true, artist: null });
}

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

// ── The career arc (artist repository M6, spec §4) ─────────────────────────
// Built only from the career slice. Every line on screen carries the billing
// ids it reads (data-billings), so the arc gate traces each one back to
// billings.json. Untimed billings never feed a slot or closing claim; main
// stage is claimed only where an edition carries a sourced ruling; "first" is
// always "in our records"; an archived set says when its page was archived
// (§4.5). A key still under review (§3.4) lists its billings separately, with
// no arc and nothing comparative. You-pins (§4.3) wait for a festival-scoped
// attended store.
const _crYear = (x, fests) => (x[2] || "").slice(0, 4) || String(fests[x[1]].year || "");
const _crTime = t => (t && typeof fmt12 === "function" ? fmt12(t) : t);
function _crPublished(ymd) {
  try { return new Date(`${ymd}T12:00:00Z`).toLocaleDateString("en-US", { timeZone: "UTC", month: "short", day: "numeric", year: "numeric" }); } catch { return ymd; }
}
const _crIsPartnerRole = x => x[7] === "b2b" || x[7] === "cobilled";

// The page's act → its registry key: the billing this page shows, and the
// performer on it whose key is this name's. No exact match, no career.
function useArtistCareer(festivalId, artistId, name) {
  const [res] = _useArtSlice(_ART_CAREER_URL);
  return React.useMemo(() => {
    if (res.status !== "ready" || !window.PlurskyArtistKey) return null;
    const d = res.data;
    if (!d._byBilling) {
      d._byBilling = new Map();
      for (const [k, a] of Object.entries(d.artists)) for (const x of a.b) d._byBilling.set(x[0], [...(d._byBilling.get(x[0]) || []), k]);
    }
    const want = window.PlurskyArtistKey.artistKey(name || "");
    const key = (d._byBilling.get(`${festivalId}:${artistId}`) || []).find(k => k === want);
    return key ? { key, c: d.artists[key], fests: d.festivals, nameOf: k => (d.artists[k] && d.artists[k].n) || d.names[k] || k } : null;
  }, [res, festivalId, artistId, name]);
}

function _careerModel(c, fests, today) {
  const bs = c.b, year = x => _crYear(x, fests);
  const years = [...new Set(bs.map(year))].sort();
  const brands = [];
  for (const x of bs) if (!brands.includes(fests[x[1]].brand)) brands.push(fests[x[1]].brand);
  const ladder = brands.map(br => {
    const mine = bs.filter(x => fests[x[1]].brand === br);
    const ys = [...new Set(mine.map(year))].sort(), moves = [];
    // A returning festival: the last set of one year against the first of the
    // next, stage and start as printed. Times only when both rows are timed.
    for (let i = 1; i < ys.length; i++) {
      const from = mine.filter(x => year(x) === ys[i - 1]).slice(-1)[0], to = mine.find(x => year(x) === ys[i]);
      const timed = !!(from[4] && to[4]);
      const side = x => [x[3] || "stage TBA", timed ? _crTime(x[4]) : null].filter(Boolean).join(" ");
      moves.push({ ids: [from[0], to[0]], text: `${ys[i - 1]} ${side(from)} → ${ys[i]} ${side(to)}${from[9] === false && to[9] === true ? " · main stage" : ""}` });
    }
    return { br, label: _artFestShort(fests[mine[0][1]].name), cells: years.map(y => mine.filter(x => year(x) === y)), moves };
  });
  const facts = [];
  facts.push({ ids: [bs[0][0]], text: `First on a lineup in our records: ${fests[bs[0][1]].name}` });
  if (years.length > 1) facts.push({ ids: bs.map(x => x[0]), text: years.map(y => { const n = new Set(bs.filter(x => year(x) === y).map(x => x[1])).size; return `${y}: ${n} festival${n === 1 ? "" : "s"}`; }).join(" → ") });
  const closed = new Map();
  for (const x of bs) if (x[8] === true && x[3]) { const t = `Closed ${x[3]}, ${fests[x[1]].name}`; closed.set(t, [...(closed.get(t) || []), x[0]]); }
  for (const [text, ids] of closed) facts.push({ ids, text });
  // Where they broke: the first main-stage set or closing slot, only after an
  // earlier billing known to be neither.
  const peak = x => x[9] === true || x[8] === true, neither = x => x[9] === false && x[8] === false;
  const pi = bs.findIndex(peak), prior = pi > 0 ? bs.slice(0, pi).find(neither) : null;
  if (prior) facts.push({ ids: [prior[0], bs[pi][0]], text: `First ${bs[pi][9] === true ? "main-stage set" : "closing slot"} in our records: ${fests[bs[pi][1]].name}` });
  const upcoming = bs.filter(x => x[2] ? (x[2] >= today || (x[14] && x[14] >= today)) : year(x) >= today.slice(0, 4));
  const partners = new Map();
  for (const x of bs) if (_crIsPartnerRole(x)) for (const k of x[10]) {
    const p = partners.get(k) || { k, years: new Set(), ids: [] };
    p.years.add(year(x)); p.ids.push(x[0]); partners.set(k, p);
  }
  return { years, ladder, facts, upcoming, partners: [...partners.values()] };
}

function _CareerNode({ x, fests }) {
  const main = x[9] === true, closing = x[8] === true, timed = !!x[4], split = timed && _crIsPartnerRole(x) && x[10].length > 0;
  const label = [fests[x[1]].name, x[3] || "stage TBA", timed ? _crTime(x[4]) : "time TBA", main && "main stage", closing && "closed the stage", split && "B2B"].filter(Boolean).join(", ");
  return (
    <svg data-ladder-node data-billings={x[0]} role="img" aria-label={label} width="20" height="20" viewBox="0 0 20 20" style={{ flex: "none", display: "block" }}>
      {timed ? <circle cx="10" cy="10" r="6" fill={main ? "var(--signal)" : "var(--ink-2)"} /> : <circle cx="10" cy="10" r="3" fill="var(--ink-3)" />}
      {closing && <circle cx="10" cy="10" r="9" fill="none" stroke="var(--signal)" strokeWidth="1.5" />}
      {split && <line x1="5.5" y1="14.5" x2="14.5" y2="5.5" stroke="var(--paper)" strokeWidth="2" />}
    </svg>
  );
}

function _CareerLadder({ m, fests }) {
  const n = m.years.length, cols = `repeat(${n}, minmax(0, 1fr))`;
  return (
    <div data-career-ladder className="duo-card" style={{ padding: "12px 14px", marginBottom: 10 }}>
      <div aria-hidden="true" style={{ display: "grid", gridTemplateColumns: cols, marginBottom: 4 }}>
        {m.years.map(y => <span key={y} className="duo-data-s duo-ink3" style={{ textAlign: "center" }}>{y}</span>)}
      </div>
      {m.ladder.map(row => {
        const on = row.cells.map((c, i) => c.length ? i : -1).filter(i => i >= 0);
        const a = on[0], z = on[on.length - 1];
        return (
          <div key={row.br} data-ladder-row={row.br} style={{ padding: "6px 0", borderTop: "1px solid var(--line)" }}>
            <div className="duo-body-s" style={{ fontWeight: 600, overflowWrap: "anywhere" }}>{row.label}</div>
            <div style={{ position: "relative", display: "grid", gridTemplateColumns: cols, alignItems: "center", minHeight: 24 }}>
              {z > a && <span aria-hidden="true" style={{ position: "absolute", top: "50%", height: 2, marginTop: -1, background: "var(--line-2)",
                left: `${(a + 0.5) / n * 100}%`, right: `${(n - z - 0.5) / n * 100}%` }} />}
              {row.cells.map((c, i) => (
                <span key={i} style={{ position: "relative", display: "flex", justifyContent: "center", gap: 2 }}>
                  {c.map(x => <_CareerNode key={x[0]} x={x} fests={fests} />)}
                </span>
              ))}
            </div>
            {row.moves.map(mv => (
              <div key={mv.ids.join(" ")} data-claim="move" data-billings={mv.ids.join(" ")} className="duo-body-s duo-ink2" style={{ fontWeight: 400, overflowWrap: "anywhere" }}>{mv.text}</div>
            ))}
          </div>
        );
      })}
      <div className="duo-body-s duo-ink3" style={{ fontWeight: 400, marginTop: 6, display: "flex", flexWrap: "wrap", columnGap: 12 }}>
        <span>● a set</span><span>• time TBA</span>
        {m.ladder.some(r => r.cells.some(c => c.some(x => x[9] === true))) && <span style={{ color: "var(--signal-ink)" }}>● main stage</span>}
        {m.ladder.some(r => r.cells.some(c => c.some(x => x[8] === true))) && <span>◯ closed the stage</span>}
        {m.ladder.some(r => r.cells.some(c => c.some(x => x[4] && _crIsPartnerRole(x) && x[10].length))) && <span>⊘ B2B</span>}
      </div>
    </div>
  );
}

// A year block (FotMob's season rows). A closed year renders no rows at all:
// a closed <details> kept its rows' old colours across a theme toggle,
// because Chrome skips style recalc in hidden details content.
function _CareerYear({ y, rows, row, startOpen }) {
  const [open, setOpen] = React.useState(startOpen);
  return (
    <div data-career-year={y}>
      <button aria-expanded={open} onClick={() => setOpen(v => !v)} className="duo-body"
        style={{ width: "100%", minHeight: 44, display: "flex", alignItems: "center", gap: 8, padding: 0, background: "transparent", border: "none",
          color: "var(--ink)", fontFamily: "inherit", fontWeight: 600, textAlign: "left", cursor: "pointer" }}>
        <svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
          style={{ flex: "none", transform: open ? "rotate(90deg)" : "none" }}><path d="M9 6 L15 12 L9 18"/></svg>
        {y} · {rows.length} {rows.length === 1 ? "billing" : "billings"}
      </button>
      {open && rows.slice().reverse().map(row)}
    </div>
  );
}

function ArtistCareer({ part, festivalId, artistId, name, setState }) {
  const career = useArtistCareer(festivalId, artistId, name);
  const [sheet, setSheet] = React.useState(null);
  if (!career) return null;
  const { c, fests, nameOf } = career;
  const today = _artToday();
  const m = c.pending ? null : _careerModel(c, fests, today);
  const openArtist = k => _artDirFetch().then(d => { const a = d.artists.find(x => x.k === k); if (a) setSheet({ a, fests: d.festivals }); }).catch(() => {});
  const sheetEl = sheet && <_ArtistBillingsSheet a={sheet.a} fests={sheet.fests} today={today} onClose={() => setSheet(null)}
    onOpenBilling={b => { _artOpenBilling(sheet.fests[b[0]], b[7], setState); setSheet(null); }} />;

  if (part === "arc") {
    if (c.pending) return (
      <p data-artist-career="pending" className="duo-body-s duo-ink2" style={{ margin: "0 0 14px", fontWeight: 400 }}>
        This name may be more than one act in our records, so its billings are listed separately below.
      </p>
    );
    return (
      <section data-artist-career style={{ marginBottom: 16 }}>
        <h2 className="duo-sect" style={{ padding: "4px 0 6px" }}>Career in our records</h2>
        {c.b.length === 1
          ? <div data-career-single style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <_CareerNode x={c.b[0]} fests={fests} />
              <span data-claim="first" data-billings={c.b[0][0]} className="duo-body">{m.facts[0].text}</span>
            </div>
          : <>
              <_CareerLadder m={m} fests={fests} />
              {m.facts.map(f => <p key={f.text} data-claim="fact" data-billings={f.ids.join(" ")} className="duo-body-s" style={{ margin: "0 0 4px", fontWeight: 400 }}>{f.text}</p>)}
            </>}
      </section>
    );
  }

  const row = (x, i) => {
    const f = fests[x[1]], live = x[13];
    const can = (live && f.id === festivalId && live !== artistId) || !live;
    const when = x[2] ? _artDay(x[2], true) + (x[14] ? ` and ${_artDay(x[14], true)}` : "") : "Date to be announced";
    const line = [when, x[3] || "stage TBA", x[4] ? _crTime(x[4]) : "time TBA", x[6], x[11] && `as published ${_crPublished(x[11])}`].filter(Boolean).join(" · ");
    const with_ = _crIsPartnerRole(x) && x[10].length ? `${x[7] === "b2b" ? "B2B with" : "With"} ${x[10].map(nameOf).join(", ")}` : null;
    const body = (
      <span style={{ flex: 1, minWidth: 0 }}>
        <span className="duo-body" style={{ display: "block", fontWeight: 600 }}>{f.name}</span>
        <span data-claim="billing" data-billings={x[0]} className="duo-body-s duo-ink2" style={{ display: "block", fontWeight: 400 }}>{line}</span>
        {with_ && <span data-claim="partners" data-billings={x[0]} className="duo-body-s duo-ink2" style={{ display: "block", fontWeight: 400 }}>{with_}</span>}
      </span>
    );
    const st = { width: "100%", display: "flex", alignItems: "center", gap: 12, minHeight: 56, padding: "8px 0", borderBottom: "1px solid var(--line)" };
    return can
      ? <button key={i} data-career-billing={x[0]} onClick={() => _artOpenBilling(f, live, setState)} style={{ ...st, background: "transparent", border: "none", borderBottom: st.borderBottom,
          color: "var(--ink)", textAlign: "left", fontFamily: "inherit", cursor: "pointer" }}>
          {body}
          <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: "var(--ink-3)", flex: "none" }}><path d="M9 6 L15 12 L9 18"/></svg>
        </button>
      : <div key={i} data-career-billing={x[0]} style={st}>{body}</div>;
  };
  const yearsDesc = [...new Set(c.b.map(x => _crYear(x, fests)))].sort().reverse();
  return (
    <div data-artist-career-detail>
      {m && m.upcoming.length > 0 && c.b.length > 1 && (
        <section data-career-upcoming style={{ marginBottom: 18 }}>
          <h2 className="duo-sect" style={{ padding: "4px 0 2px" }}>Coming up</h2>
          {m.upcoming.map(row)}
        </section>
      )}
      <section data-career-years style={{ marginBottom: 18 }}>
        <h2 className="duo-sect" style={{ padding: "4px 0 2px" }}>{c.pending ? "Billings under this name" : "Year by year"}</h2>
        {yearsDesc.map((y, i) => <_CareerYear key={y} y={y} rows={c.b.filter(x => _crYear(x, fests) === y)} row={row} startOpen={i === 0} />)}
      </section>
      {m && m.partners.length > 0 && (
        <section data-career-partners style={{ marginBottom: 18 }}>
          <h2 className="duo-sect" style={{ padding: "4px 0 6px" }}>B2B and collab partners</h2>
          <div style={{ display: "flex", gap: 12, overflowX: "auto", paddingBottom: 4 }}>
            {m.partners.map(p => (
              <button key={p.k} data-claim="partner" data-billings={p.ids.join(" ")} onClick={() => openArtist(p.k)}
                style={{ flex: "none", width: 88, display: "grid", justifyItems: "center", gap: 4, padding: "4px 0", background: "transparent", border: "none", color: "var(--ink)", fontFamily: "inherit", cursor: "pointer", minHeight: 44 }}>
                <_ArtFace name={nameOf(p.k)} size={48} />
                <span className="duo-body-s" style={{ fontWeight: 600, textAlign: "center", overflowWrap: "anywhere" }}>{nameOf(p.k)}</span>
                <span className="duo-body-s duo-ink3" style={{ fontWeight: 400 }}>{[...p.years].sort().join(", ")}</span>
              </button>
            ))}
          </div>
        </section>
      )}
      {m && c.s && c.s.length > 0 && (
        <section data-career-shared style={{ marginBottom: 18 }}>
          <h2 className="duo-sect" style={{ padding: "4px 0 2px" }}>Most often on the same lineup</h2>
          {c.s.map(([k, n]) => (
            <button key={k} data-claim="shared" data-shared={`${k}:${n}`} onClick={() => openArtist(k)}
              style={{ width: "100%", display: "flex", alignItems: "center", gap: 12, minHeight: 52, padding: "6px 0", background: "transparent", border: "none", borderBottom: "1px solid var(--line)", color: "var(--ink)", textAlign: "left", fontFamily: "inherit", cursor: "pointer" }}>
              <_ArtFace name={nameOf(k)} size={36} />
              <span className="duo-body" style={{ flex: 1, minWidth: 0, fontWeight: 600, overflowWrap: "anywhere" }}>{nameOf(k)}</span>
              <span className="duo-body-s duo-ink2" style={{ flexShrink: 0, fontWeight: 400 }}>{n} festivals together</span>
            </button>
          ))}
        </section>
      )}
      {sheetEl}
    </div>
  );
}

// The entry on Me, under All festivals (placement settled 2026-10-22: B6 spec
// section 5's global entry). The back button returns to Me.
function ArtistsDirectoryRow() {
  return (
    <button data-artists-entry onClick={() => (window._pushNav || (() => {}))({ tab: "artists", artist: null })}
      className="duo-card" style={{
        width: "100%", minHeight: 52, marginBottom: 14, padding: "10px 16px",
        display: "flex", alignItems: "center", gap: 12, border: "none",
        color: "var(--ink)", cursor: "pointer", textAlign: "left", fontFamily: "inherit",
      }}>
      <span className="duo-headline" style={{ flex: 1, minWidth: 0 }}>Artists</span>
      <span className="duo-body-s duo-ink2" style={{ flexShrink: 0 }}>Every festival</span>
    </button>
  );
}
