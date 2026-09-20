// ── General Landing + Saved Festivals (v341) ───────────────────────────────
//
// WHAT THIS REPLACES: the app opened straight into whichever festival
// getActiveFestivalId() resolved, so a returning user landed on the EDC Las
// Vegas wrap page whether or not that is the festival they are thinking about.
// Root now answers "what can I do now?" first, and the user chooses.
//
// THE THREE STATES THIS FILE KEEPS APART, because collapsing any pair of them
// is how a festival's memories leak into another festival's screen:
//
//   SAVED   — `plursky_saved_festivals_v1`. An explicit, versioned list. It is
//             never inferred from saved artists, imported media, archive rows
//             or last-opened, and entering a festival never writes it.
//   ACTIVE  — `active_festival_id`, owned by data.jsx. Which festival the
//             scoped screens are showing. Set by ENTERING, not by saving.
//   LANDED  — a per-session fact: whether this load should show General Home
//             or go straight into a festival. A deep link decides it; a stored
//             active id does NOT.
//
// Loaded BEFORE spotify.jsx (CLAUDE.md §4/§5), so everything it borrows from
// there — _readMoments, _dedupeByMedia, _mediaIdentity — is called at RUNTIME
// by bare name and never referenced at eval time. This file deliberately makes
// no top-level `Object.assign(window, …)` call: data.jsx's festival switch
// owns those names and a later assign here would overwrite them.

const _SAVED_FESTIVALS_KEY   = "plursky_saved_festivals_v1";
const _LANDING_MIGRATED_KEY  = "plursky_landing_migrated_v1";

// ── Saved-festival collection ──────────────────────────────────────────────
// Stored as { v, ids } rather than a bare array so a later shape change can be
// told apart from a corrupt value instead of guessed at.
function readSavedFestivals() {
  try {
    const raw = JSON.parse(localStorage.getItem(_SAVED_FESTIVALS_KEY) || "null");
    if (!raw) return [];
    const ids = Array.isArray(raw) ? raw : (Array.isArray(raw.ids) ? raw.ids : []);
    // De-duped and filtered to strings; a malformed entry is dropped rather
    // than rendered as an empty row.
    return [...new Set(ids.filter(id => typeof id === "string" && id))];
  } catch { return []; }
}
function writeSavedFestivals(ids) {
  try {
    localStorage.setItem(_SAVED_FESTIVALS_KEY, JSON.stringify({ v: 1, ids: [...new Set(ids || [])] }));
  } catch {}
  try { window.dispatchEvent(new CustomEvent("plursky-saved-festivals-change")); } catch {}
  return readSavedFestivals();
}
function isFestivalSaved(id) { return !!id && readSavedFestivals().includes(id); }
function saveFestival(id) {
  if (!id) return readSavedFestivals();
  const cur = readSavedFestivals();
  return cur.includes(id) ? cur : writeSavedFestivals([...cur, id]);
}
function unsaveFestival(id) {
  return writeSavedFestivals(readSavedFestivals().filter(x => x !== id));
}
function toggleSavedFestival(id) {
  return isFestivalSaved(id) ? unsaveFestival(id) : saveFestival(id);
}

// ── The one migration ──────────────────────────────────────────────────────
// An existing user's `active_festival_id` is INPUT, not a grant. It does not
// become a saved festival and it does not select the landing state, because
// either would re-create the exact behaviour this wave removes: the app
// deciding for you which festival you care about. It is left in place so
// deep links and continuity inside a festival keep working.
//
// Runs once and records that it ran, so a user who later unsaves everything
// is not "migrated" again into a saved row they deliberately removed.
function runLandingMigration() {
  try {
    if (localStorage.getItem(_LANDING_MIGRATED_KEY) === "1") return { ran: false, autoSaved: [] };
    localStorage.setItem(_LANDING_MIGRATED_KEY, "1");
  } catch { return { ran: false, autoSaved: [] }; }
  // Deliberately empty. Named and returned so the gate can assert that the
  // migration auto-saves NOTHING, rather than asserting on absence.
  return { ran: true, autoSaved: [] };
}

// Should this load show General Home?
//
// Yes, unless the URL names a destination. A stored active festival is not a
// destination — that is the whole point. `params` is a URLSearchParams (or
// anything with .get), so this is pure and testable.
function landingShouldOpenGeneral(params) {
  const get = (k) => { try { return params && params.get ? params.get(k) : null; } catch { return null; } };
  // Any deep link that names a festival, an artist, a stage or a tab is an
  // explicit destination and wins over the general landing.
  const named = get("f") || get("festival") || get("artist") || get("stage")
             || get("tab") || get("lineup") || get("crew") || get("day");
  return !named;
}

// ── Exact-festival memory counts ───────────────────────────────────────────
// A festival card may show a count ONLY for that exact festival.
//
// The active-festival reader (_activeMoments) treats an UNSTAMPED legacy
// moment as belonging to the current festival when the last-festival pointer
// agrees. That inference is right for "what am I looking at now" and wrong for
// a landing card, which is a claim about one named festival next to twelve
// others. So this matches `festivalId` EXACTLY and counts nothing else.
// Unattributed records are returned separately and are never added to a card.
function momentsForFestival(all, festivalId) {
  const out = [];
  if (!festivalId) return out;
  for (const night of Object.keys(all || {})) {
    const arr = all[night];
    if (!Array.isArray(arr)) continue;
    for (const m of arr) if (m && m.festivalId === festivalId) out.push(m);
  }
  return out;
}
function unattributedMoments(all) {
  const out = [];
  for (const night of Object.keys(all || {})) {
    const arr = all[night];
    if (!Array.isArray(arr)) continue;
    for (const m of arr) if (m && !m.festivalId) out.push(m);
  }
  return out;
}
// Unique REACHABLE records for one festival — the same media-identity dedupe
// the library counts with, so a card and the library it opens agree.
function festivalMemoryCount(festivalId, all) {
  const src = all || (typeof _readMoments === "function" ? _readMoments() : {});
  const mine = momentsForFestival(src, festivalId);
  return (typeof _dedupeByMedia === "function" ? _dedupeByMedia(mine) : mine).length;
}

// ── Per-festival view state ────────────────────────────────────────────────
// Returning from a festival to General Home preserves that festival's Wall /
// Memories position — search text, filter, which days were collapsed, scroll —
// WITHOUT saving the festival. Keyed by festival id so two festivals never
// share a scroll offset or a filter.
const _FEST_VIEW_KEY = "plursky_festival_view_v1";
function readFestivalView(festivalId) {
  if (!festivalId) return {};
  try {
    const all = JSON.parse(localStorage.getItem(_FEST_VIEW_KEY) || "{}");
    return (all && all[festivalId]) || {};
  } catch { return {}; }
}
function writeFestivalView(festivalId, patch) {
  if (!festivalId) return {};
  try {
    const all = JSON.parse(localStorage.getItem(_FEST_VIEW_KEY) || "{}");
    const next = { ...(all[festivalId] || {}), ...(patch || {}) };
    all[festivalId] = next;
    localStorage.setItem(_FEST_VIEW_KEY, JSON.stringify(all));
    return next;
  } catch { return {}; }
}

// ── UI ─────────────────────────────────────────────────────────────────────

// An honest one-line state for a festival row. Never a distance, an ETA, a set
// time or an availability claim — those are only source-safe inside a festival
// that has the data, and a landing card has no way to know.
function _landingFestivalState(entry, now) {
  const phase = typeof _festivalPhase === "function" ? _festivalPhase(entry, now) : "upcoming";
  if (!entry.available && !entry.previewOnly) return { label: "Not open yet", tone: "muted", locked: true };
  if (!entry.available && entry.previewOnly)  return { label: "Early access", tone: "muted", locked: true };
  if (phase === "live")  return { label: "Happening now", tone: "signal" };
  if (phase === "ended") return { label: "Ended", tone: "muted" };
  if (phase === "tba")   return { label: "Dates TBA", tone: "muted" };
  if (entry.scheduleTBA) return { label: "Lineup in · set times TBA", tone: "muted" };
  return { label: "Upcoming", tone: "muted" };
}

function _LandingFestivalCard({ entry, saved, memoryCount, onEnter }) {
  const now = Date.now();
  const st = _landingFestivalState(entry, now);
  const c = entry.config;
  const toneColor = st.tone === "signal" ? "var(--signal-ink)" : "var(--text-2)";
  return (
    <button
      onClick={() => { if (!st.locked) onEnter(c.id, entry); }}
      disabled={st.locked}
      aria-label={`${c.name}. ${st.label}.${saved ? " Saved." : ""}${memoryCount ? ` ${memoryCount} memories.` : ""}`}
      style={{
        width: "100%", display: "flex", alignItems: "center", gap: 12,
        minHeight: 72, padding: "10px 0",
        background: "transparent", border: "none",
        borderBottom: "1px solid var(--line)",
        color: "var(--ink)", textAlign: "left", fontFamily: "inherit",
        cursor: st.locked ? "default" : "pointer",
        opacity: st.locked ? 0.55 : 1,
      }}>
      {typeof FestivalThumb === "function" ? <FestivalThumb entry={entry} /> : null}
      <div style={{ flex: 1, minWidth: 0 }}>
        {/* Everything on this row WRAPS. At 320px "Henry Maier Festival Park ·
            Milwaukee, WI" pushed the row 42px wide and the card panned
            sideways; a clipped festival name or venue is also an ambiguous
            row, and the full value is nowhere else on this screen.

            The date does NOT get nowrap: Summerfest prints three blocks, and
            one unbreakable 234px date string in a 192px column was the entire
            42px overflow. A date range that wraps beats a card that pans. */}
        <div style={{ display: "flex", alignItems: "baseline", gap: 6, flexWrap: "wrap", minWidth: 0 }}>
          <span style={{ fontSize: 17, lineHeight: 1.29, fontWeight: 600, minWidth: 0, overflowWrap: "anywhere" }}>{c.name}</span>
          {saved && (
            <span aria-hidden="true" title="Saved" style={{ flexShrink: 0, fontSize: 12, color: "var(--signal-ink)" }}>★</span>
          )}
        </div>
        <div style={{ fontSize: 13, lineHeight: 1.38, color: "var(--text-2)", minWidth: 0, overflowWrap: "anywhere" }}>
          {c.location}{c.dates ? " · " : ""}{c.dates || null}
        </div>
        <div style={{ marginTop: 2, fontSize: 13, lineHeight: 1.38, color: toneColor, fontVariantNumeric: "tabular-nums" }}>
          {st.label}
          {/* EXACT-festival count only. Absent means "none for this festival",
              never "none anywhere" and never another festival's total. */}
          {memoryCount > 0 ? ` · ${memoryCount} ${memoryCount === 1 ? "memory" : "memories"}` : ""}
        </div>
      </div>
      {!st.locked && (
        <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--text-3)"
             strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
          <path d="M9 6 L15 12 L9 18"/>
        </svg>
      )}
    </button>
  );
}

function GeneralLandingScreen({ state, setState }) {
  const [savedIds, setSavedIds] = React.useState(readSavedFestivals);
  const [q, setQ] = React.useState("");
  const [moments, setMoments] = React.useState(() => {
    try { return typeof _readMoments === "function" ? _readMoments() : {}; } catch { return {}; }
  });

  // Saved state can change from the festival page (the Save control lives
  // there), so mirror it rather than reading once.
  React.useEffect(() => {
    const refresh = () => setSavedIds(readSavedFestivals());
    window.addEventListener("plursky-saved-festivals-change", refresh);
    window.addEventListener("storage", refresh);
    return () => {
      window.removeEventListener("plursky-saved-festivals-change", refresh);
      window.removeEventListener("storage", refresh);
    };
  }, []);
  React.useEffect(() => {
    const refresh = () => { try { setMoments(_readMoments()); } catch {} };
    window.addEventListener("plursky-moments-change", refresh);
    return () => window.removeEventListener("plursky-moments-change", refresh);
  }, []);

  const now = Date.now();
  const registry = (typeof FESTIVALS_REGISTRY !== "undefined" ? FESTIVALS_REGISTRY : []).filter(f => f && f.config && f.config.id);
  // REUSE the registry's own ordering. A second sort here would be a second
  // festival truth, and the two would drift.
  const ordered = typeof _sortFestivalsForSwitcher === "function"
    ? _sortFestivalsForSwitcher(registry, now)
    : registry;
  const activeId = (typeof FESTIVAL_CONFIG !== "undefined" && FESTIVAL_CONFIG) ? FESTIVAL_CONFIG.id : null;

  const counts = React.useMemo(() => {
    const m = {};
    for (const f of registry) m[f.config.id] = festivalMemoryCount(f.config.id, moments);
    return m;
  }, [moments, registry.length]);
  const orphanCount = React.useMemo(() => {
    const u = unattributedMoments(moments);
    return (typeof _dedupeByMedia === "function" ? _dedupeByMedia(u) : u).length;
  }, [moments]);

  // ENTERING is not SAVING. This only changes which festival the scoped
  // screens show, and lands on that festival's Today screen.
  const enterFestival = React.useCallback((id) => {
    if (id && activeId && id !== activeId && typeof setActiveFestivalAndReload === "function") {
      // The reload re-resolves the active festival; record the destination so
      // the boot after it does not bounce back to General Home.
      try { sessionStorage.setItem("plursky_landing_entered", id); } catch {}
      setActiveFestivalAndReload(id);
      return;
    }
    setState(s => ({ ...s, tab: "home", artist: null }));
  }, [activeId, setState]);

  const saved = ordered.filter(f => savedIds.includes(f.config.id));
  const term = q.trim().toLowerCase();
  const matches = (f) => !term
    || `${f.config.name} ${f.config.location || ""}`.toLowerCase().includes(term);
  // Every registry entry appears EXACTLY ONCE in Browse, using the existing
  // phase rules. Saved rows are a shortcut above, not a removal from Browse —
  // hiding them there would make the search claim the festival does not exist.
  const browse = ordered.filter(matches);
  const phaseOf = (f) => (typeof _festivalPhase === "function" ? _festivalPhase(f, now) : "upcoming");
  const groups = [
    { label: "Happening now", fests: browse.filter(f => phaseOf(f) === "live") },
    { label: "Upcoming",      fests: browse.filter(f => phaseOf(f) === "upcoming") },
    { label: "Dates TBA",     fests: browse.filter(f => phaseOf(f) === "tba") },
    { label: "Past",          fests: browse.filter(f => phaseOf(f) === "ended") },
  ].filter(g => g.fests.length > 0);

  const eyebrow = {
    margin: "18px 0 2px", fontSize: 11, lineHeight: 1.27, fontWeight: 600,
    letterSpacing: "0.04em", textTransform: "uppercase", color: "var(--text-2)",
  };
  const card = (f) => (
    <_LandingFestivalCard
      key={f.config.id}
      entry={f}
      saved={savedIds.includes(f.config.id)}
      memoryCount={counts[f.config.id] || 0}
      onEnter={enterFestival}
    />
  );

  // The one primary action. With a saved or live festival it enters it; with
  // nothing saved it points at Browse, which is already on screen.
  const primary = saved.find(f => phaseOf(f) === "live")
    || saved.find(f => phaseOf(f) === "upcoming")
    || ordered.find(f => phaseOf(f) === "live" && f.available)
    || saved[0]
    || null;

  return (
    <Screen>
      <ScrollBody style={{ padding: "0 16px calc(96px + env(safe-area-inset-bottom, 0px))" }}>
        <header style={{ paddingTop: 10 }}>
          <h1 style={{ margin: 0, fontSize: 28, lineHeight: 1.21, fontWeight: 700, letterSpacing: "-0.01em" }}>
            Plursky
          </h1>
          <p style={{ margin: "4px 0 0", fontSize: 15, lineHeight: 1.4, color: "var(--text-2)" }}>
            Pick a festival to plan it, live it, and keep it.
          </p>
        </header>

        {/* One clear primary action, answering "what can I do now?". */}
        {primary && (
          <button
            onClick={() => enterFestival(primary.config.id)}
            style={{
              width: "100%", marginTop: 14, minHeight: 56, padding: "10px 16px",
              display: "flex", alignItems: "center", gap: 12,
              background: "var(--signal)", color: "var(--on-signal)",
              border: "none", borderRadius: 14, cursor: "pointer",
              textAlign: "left", fontFamily: "inherit",
            }}>
            <span style={{ flex: 1, minWidth: 0 }}>
              <span style={{ display: "block", fontSize: 17, lineHeight: 1.29, fontWeight: 600 }}>
                {phaseOf(primary) === "live" ? `Open ${primary.config.name}` : `Plan ${primary.config.name}`}
              </span>
              <span style={{ display: "block", fontSize: 13, lineHeight: 1.38, opacity: 0.85 }}>
                {phaseOf(primary) === "live" ? "Happening now" : primary.config.dates || "Upcoming"}
              </span>
            </span>
          </button>
        )}

        {/* ── Saved festivals ──────────────────────────────────────────── */}
        <h2 style={eyebrow}>Saved festivals</h2>
        {saved.length > 0 ? saved.map(card) : (
          <p style={{ margin: "6px 0 0", fontSize: 15, lineHeight: 1.4, color: "var(--text-2)" }}>
            Open a festival and tap Save to keep it here.
          </p>
        )}

        {/* Unattributed media is surfaced, never silently filed under a
            festival. It is the landing's face of Needs Review. */}
        {orphanCount > 0 && (
          <button
            onClick={() => setState(s => ({ ...s, tab: "memories", artist: null }))}
            style={{
              width: "100%", marginTop: 12, minHeight: 44, padding: "10px 14px",
              display: "block", textAlign: "left", borderRadius: 14, cursor: "pointer",
              background: "var(--paper-2)", border: "none", color: "var(--warn)",
              fontSize: 15, lineHeight: 1.33, fontWeight: 600, fontFamily: "inherit",
            }}>
            ⚑ {orphanCount} {orphanCount === 1 ? "memory is" : "memories are"} not filed to a festival · Review
          </button>
        )}

        {/* ── Browse ───────────────────────────────────────────────────── */}
        <h2 style={eyebrow}>Browse festivals</h2>
        <input
          value={q}
          onChange={e => setQ(e.target.value)}
          type="search"
          aria-label="Search festivals"
          placeholder="Search festivals"
          style={{
            width: "100%", boxSizing: "border-box", marginTop: 6, marginBottom: 2,
            minHeight: 44, padding: "0 14px", borderRadius: 14,
            background: "var(--paper-2)", border: "none", color: "var(--ink)",
            fontSize: 16, fontFamily: "inherit", outline: "none",
          }}
        />
        {groups.length === 0 ? (
          <p style={{ margin: "10px 0 0", fontSize: 15, lineHeight: 1.4, color: "var(--text-2)" }}>
            No festival matches “{q.trim()}”.
          </p>
        ) : groups.map(g => (
          <section key={g.label}>
            <h3 style={eyebrow}>{g.label}</h3>
            {g.fests.map(card)}
          </section>
        ))}
      </ScrollBody>
    </Screen>
  );
}

// Save/Unsave, for the FESTIVAL page. Saving never navigates; entering never
// saves. Both halves of that rule are asserted by the landing gate.
function FestivalSaveRow({ festivalId, name }) {
  const [saved, setSaved] = React.useState(() => isFestivalSaved(festivalId));
  React.useEffect(() => { setSaved(isFestivalSaved(festivalId)); }, [festivalId]);
  const label = saved ? `Saved — ${name || "this festival"} is on your home screen` : `Save ${name || "this festival"} to your home screen`;
  return (
    <button
      onClick={() => { toggleSavedFestival(festivalId); setSaved(isFestivalSaved(festivalId)); }}
      aria-pressed={saved}
      aria-label={label}
      style={{
        width: "100%", minHeight: 52, marginBottom: 14, padding: "10px 14px",
        display: "flex", alignItems: "center", gap: 10,
        background: "var(--paper-2)", border: "none", borderRadius: 14,
        color: "var(--ink)", cursor: "pointer", textAlign: "left", fontFamily: "inherit",
      }}>
      <span aria-hidden="true" style={{ fontSize: 16, color: saved ? "var(--signal-ink)" : "var(--text-2)" }}>
        {saved ? "★" : "☆"}
      </span>
      <span style={{ flex: 1, minWidth: 0, fontSize: 15, lineHeight: 1.33, fontWeight: 600 }}>
        {saved ? "Saved" : "Save this festival"}
      </span>
      <span style={{ flexShrink: 0, fontSize: 13, lineHeight: 1.38, color: "var(--text-2)" }}>
        {saved ? "Tap to remove" : "Keep it on your home screen"}
      </span>
    </button>
  );
}
