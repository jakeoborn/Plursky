// historical.jsx — Past Festivals: the public library of past editions.
//
// A read-only archive of what each festival officially printed, built by
// scripts/historical/build-editions.mjs from archived official schedules. It
// is NOT the personal Festival Archive in spotify.jsx (what YOU caught); it
// never touches saved sets, notifications, the live clock or the active
// festival. Nothing here is precached: the index and each edition load on
// demand, and the service worker's network-first own-origin cache keeps the
// ones a user has opened.
//
// Billing and stage names render exactly as printed (founder ruling), and a
// closing set printed with only a start shows no invented end.

const _HIST_BASE = "data/historical/";
const _histCache = {};

function _histFetch(path) {
  if (!_histCache[path]) {
    _histCache[path] = fetch(_HIST_BASE + path).then(r => {
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return r.json();
    }).catch(e => { delete _histCache[path]; throw e; });
  }
  return _histCache[path];
}

function useHistorical(path) {
  const [res, setRes] = React.useState({ status: "loading" });
  const [attempt, setAttempt] = React.useState(0);
  React.useEffect(() => {
    let live = true;
    setRes({ status: "loading" });
    _histFetch(path).then(data => { if (live) setRes({ status: "ready", data }); })
      .catch(() => { if (live) setRes({ status: "error" }); });
    return () => { live = false; };
  }, [path, attempt]);
  return [res, () => setAttempt(a => a + 1)];
}

// "Weekend 1 · Friday" → group "Weekend 1", day "Friday". A plain "Friday"
// has no group, so single-weekend festivals get one row of day tabs.
function _histDayParts(d) {
  const i = (d.label || "").lastIndexOf(" · ");
  return i < 0 ? { group: "", name: d.label || `Day ${d.day}` } : { group: d.label.slice(0, i), name: d.label.slice(i + 3) };
}

function _histDate(ymd, opts) {
  try { return new Date(`${ymd}T12:00:00Z`).toLocaleDateString("en-US", { timeZone: "UTC", ...opts }); } catch { return ymd; }
}

function _histDateRange(days) {
  if (!days?.length) return "";
  const a = days[0].date, b = days[days.length - 1].date;
  const md = { month: "short", day: "numeric" };
  if (a === b) return `${_histDate(a, md)}, ${a.slice(0, 4)}`;
  if (a.slice(0, 7) === b.slice(0, 7)) return `${_histDate(a, md)}–${+b.slice(8)}, ${a.slice(0, 4)}`;
  return `${_histDate(a, md)} – ${_histDate(b, md)}, ${a.slice(0, 4)}`;
}

// Minutes into the festival day: a 01:30 set belongs after 23:00, not before
// noon, so anything before the edition's rolloverHour sorts past midnight.
function _histMinutes(t, rollover) {
  const [h, m] = (t || "").split(":").map(Number);
  if (isNaN(h)) return Infinity;
  return (h < (rollover ?? 6) ? h + 24 : h) * 60 + (m || 0);
}

const _histFold = s => (s || "").normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();

function _histBack(state, setState) {
  if (state.pastEdition) setState(s => ({ ...s, pastEdition: null }));
  else if (window._popNav) window._popNav();
  else setState(s => ({ ...s, tab: "home" }));
}

function _HistHeader({ title, sub, onBack, right }) {
  return (
    <div style={{ padding: "8px 8px 0 8px", display: "flex", alignItems: "flex-start", gap: 4 }}>
      <button onClick={onBack} aria-label="Back" style={fieldIconBtn}>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 6 L9 12 L15 18"/></svg>
      </button>
      <div style={{ flex: 1, minWidth: 0, paddingTop: 2 }}>
        {sub && <div style={{ fontSize: 11, lineHeight: "14px", fontWeight: 600, letterSpacing: "0.04em", textTransform: "uppercase", color: "var(--text-2)", marginBottom: 2 }}>{sub}</div>}
        <h1 style={{ margin: 0, fontSize: 28, lineHeight: "34px", fontWeight: 700, letterSpacing: "-0.01em", overflowWrap: "anywhere" }}>{title}</h1>
      </div>
      {right}
    </div>
  );
}

function _HistStatus({ res, retry, what }) {
  if (res.status === "loading") return <p role="status" style={{ margin: "24px 20px", color: "var(--text-2)" }}>Loading {what}…</p>;
  return (
    <div role="status" style={{ margin: "24px 20px", display: "grid", gap: 12 }}>
      <p style={{ margin: 0, color: "var(--text-2)" }}>Couldn't load {what}. Past festivals need a connection the first time you open them.</p>
      <FieldButton kind="secondary" onClick={retry}>Try again</FieldButton>
    </div>
  );
}

function PastFestivalsScreen({ state, setState }) {
  if (state.pastEdition) return <HistoricalEditionView key={state.pastEdition} state={state} setState={setState} />;
  return <_HistLibrary state={state} setState={setState} />;
}

function _HistLibrary({ state, setState }) {
  const [res, retry] = useHistorical("index.json");
  const editions = res.status === "ready" ? res.data.editions || [] : [];
  const years = [...new Set(editions.map(e => e.year))].sort((a, b) => b - a);
  return (
    <Screen>
      <_HistHeader title="Past festivals" sub="Official schedules · archived" onBack={() => _histBack(state, setState)} />
      <ScrollBody style={{ padding: "8px 20px 94px" }}>
        <p style={{ margin: "0 0 8px", fontSize: 15, lineHeight: "21px", color: "var(--text-2)", maxWidth: "60ch" }}>
          Every lineup and set time as each festival printed it. Read-only; nothing here changes your plan.
        </p>
        {res.status !== "ready" && <_HistStatus res={res} retry={retry} what="past festivals" />}
        {years.map(y => (
          <section key={y} style={{ marginTop: 16 }}>
            <h2 style={{ margin: "0 0 4px", fontSize: 11, lineHeight: "14px", fontWeight: 600, letterSpacing: "0.04em", textTransform: "uppercase", color: "var(--text-2)" }}>{y}</h2>
            {editions.filter(e => e.year === y).map(e => (
              <button key={e.id} onClick={() => setState(s => ({ ...s, pastEdition: e.id }))} style={{
                width: "100%", display: "flex", alignItems: "center", gap: 12, minHeight: 72, padding: "10px 0",
                background: "transparent", border: "none", borderBottom: "1px solid var(--line)",
                color: "var(--ink)", textAlign: "left", fontFamily: "inherit", cursor: "pointer",
              }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 17, lineHeight: "22px", fontWeight: 600 }}>{e.festivalName}</div>
                  <div style={{ fontSize: 13, lineHeight: "18px", color: "var(--text-2)" }}>{_histDateRange(e.days)}</div>
                  <div style={{ fontSize: 13, lineHeight: "18px", color: "var(--text-2)", fontVariantNumeric: "tabular-nums" }}>
                    {e.completeness === "lineup_only"
                      ? `${e.counts.artists} artists · lineup only`
                      : `${e.days.length} days · ${e.counts.stages} stages · ${e.counts.sets} sets`}
                  </div>
                </div>
                <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--text-3)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 6 L15 12 L9 18"/></svg>
              </button>
            ))}
          </section>
        ))}
      </ScrollBody>
    </Screen>
  );
}

const _HIST_METHOD = {
  structured_html: "Read from the festival's official set-times pages",
  official_image_transcription: "Transcribed from the festival's official schedule graphics, checked block by block",
};

function _HistProvenance({ edition, onClose }) {
  const p = edition.provenance || {};
  const stamp = ts => ts && /^\d{8}/.test(ts) ? _histDate(`${ts.slice(0, 4)}-${ts.slice(4, 6)}-${ts.slice(6, 8)}`, { month: "short", day: "numeric", year: "numeric" }) : "";
  const dayLabel = n => edition.days.find(d => d.day === n)?.label || `Day ${n}`;
  const link = { color: "var(--signal-ink)", overflowWrap: "anywhere" };
  return (
    <FieldSheet title="About this schedule" onClose={onClose}>
      <div style={{ display: "grid", gap: 14, fontSize: 15, lineHeight: "21px" }}>
        <p style={{ margin: 0, color: "var(--text-2)" }}>
          {_HIST_METHOD[p.extractionMethod] || "From the festival's official schedule"}, as archived by the Wayback Machine.
          Artist and stage names appear exactly as printed. Non-music activities are left out.
        </p>
        {p.official && <div><div style={{ fontSize: 13, color: "var(--text-2)" }}>Official source</div><div style={{ overflowWrap: "anywhere" }}>{p.official.replace(/^https?:\/\//, "")}</div></div>}
        {(p.captures || []).length > 0 && (
          <div>
            <div style={{ fontSize: 13, color: "var(--text-2)", marginBottom: 4 }}>Archived captures</div>
            {(p.captures || []).map((c, i) => (
              <div key={i} style={{ padding: "8px 0", borderBottom: "1px solid var(--line)" }}>
                <div style={{ fontWeight: 600 }}>{dayLabel(c.day)}</div>
                {c.archivedUrl && <a href={c.archivedUrl} target="_blank" rel="noopener noreferrer" style={link}>Set-times page · {stamp(c.captureTimestamp)}</a>}
                {c.imageArchivedUrl && <div><a href={c.imageArchivedUrl} target="_blank" rel="noopener noreferrer" style={link}>Schedule graphic · {stamp(c.imageCapture)}</a></div>}
                {c.pageArchivedUrl && <div><a href={c.pageArchivedUrl} target="_blank" rel="noopener noreferrer" style={link}>Schedule page · {stamp(c.pageCapture)}</a></div>}
              </div>
            ))}
          </div>
        )}
      </div>
    </FieldSheet>
  );
}

function _HistChip({ on, onClick, children, label }) {
  return (
    <button onClick={onClick} aria-pressed={on} aria-label={label} style={{
      minHeight: 36, padding: "0 12px", borderRadius: 999, border: on ? "none" : "1px solid var(--line-2)",
      background: on ? "var(--signal)" : "transparent", color: on ? "var(--on-signal)" : "var(--ink)",
      fontFamily: "inherit", fontSize: 14, fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap",
    }}>{children}</button>
  );
}

function HistoricalEditionView({ state, setState }) {
  // The id comes from app state, but only an id the index lists is fetched,
  // so a deep link can never ask for an arbitrary path.
  const [idx, retryIdx] = useHistorical("index.json");
  const meta = idx.status === "ready" ? (idx.data.editions || []).find(e => e.id === state.pastEdition) : null;
  const back = () => _histBack(state, setState);
  if (idx.status !== "ready") return <Screen><_HistHeader title="Past festivals" onBack={back} /><_HistStatus res={idx} retry={retryIdx} what="past festivals" /></Screen>;
  if (!meta) return <Screen><_HistHeader title="Past festivals" onBack={back} /><p style={{ margin: "24px 20px", color: "var(--text-2)" }}>That edition isn't in the library.</p></Screen>;
  return <_HistEdition meta={meta} back={back} />;
}

function _HistEdition({ meta, back }) {
  const [res, retry] = useHistorical(`editions/${meta.id}.json`);
  const [day, setDay] = React.useState(meta.days[0]?.day);
  const [q, setQ] = React.useState("");
  const [about, setAbout] = React.useState(false);
  const scroller = React.useRef(null);
  const e = res.status === "ready" ? res.data : null;
  const lineupOnly = meta.completeness === "lineup_only";
  const frozen = `Official ${meta.year} ${lineupOnly ? "lineup" : "schedule"} · archived`;

  const view = React.useMemo(() => {
    if (!e) return null;
    const artist = Object.fromEntries(e.artists.map(a => [a.id, a]));
    const stage = Object.fromEntries(e.stages.map(s => [s.id, s]));
    const byTime = (a, b) => _histMinutes(a.start, e.rolloverHour) - _histMinutes(b.start, e.rolloverHour);
    return { artist, stage, byTime };
  }, [e]);

  const infoBtn = (
    <button onClick={() => setAbout(true)} aria-label="About this schedule" style={fieldIconBtn}>
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="9"/><path d="M12 11 V16.5 M12 7.6 V7.5"/></svg>
    </button>
  );

  const query = _histFold(q.trim());
  const time = s => s.end ? `${fmt12(s.start)} – ${fmt12(s.end)}` : fmt12(s.start);
  const setRow = (s, sub) => (
    <li key={s.id} style={{ display: "flex", gap: 12, padding: "10px 0", borderBottom: "1px solid var(--line)", alignItems: "baseline" }}>
      <div style={{ width: 140, flexShrink: 0, fontSize: 13, lineHeight: "18px", color: "var(--text-2)", fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" }}>
        {time(s)}{s.openEnd && <div style={{ fontSize: 11, color: "var(--text-3)" }}>no end time printed</div>}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 16, lineHeight: "21px", fontWeight: 600, overflowWrap: "anywhere" }}>{view.artist[s.artistId]?.name}</div>
        {sub && <div style={{ fontSize: 13, lineHeight: "18px", color: "var(--text-2)" }}>{sub}</div>}
      </div>
    </li>
  );

  let body = null;
  if (e && lineupOnly) {
    const list = e.artists.filter(a => !query || _histFold(a.name).includes(query)).sort((a, b) => a.name.localeCompare(b.name));
    body = (
      <>
        <p style={{ margin: "4px 0 12px", fontSize: 14, color: "var(--text-2)" }}>No official set times survive for this edition, so only the lineup is shown.</p>
        <ul aria-label="Lineup" style={{ listStyle: "none", margin: 0, padding: 0 }}>
          {list.map(a => <li key={a.id} style={{ padding: "10px 0", borderBottom: "1px solid var(--line)", fontSize: 16, fontWeight: 600, overflowWrap: "anywhere" }}>{a.name}</li>)}
        </ul>
        {!list.length && <p style={{ color: "var(--text-2)" }}>No artist matches “{q.trim()}”.</p>}
      </>
    );
  } else if (e && query) {
    const hits = e.sets.filter(s => _histFold(view.artist[s.artistId]?.name).includes(query));
    body = (
      <>
        {meta.days.map(d => {
          const rows = hits.filter(s => s.day === d.day).sort(view.byTime);
          if (!rows.length) return null;
          return (
            <section key={d.day} style={{ marginTop: 12 }}>
              <h2 style={{ margin: 0, fontSize: 13, fontWeight: 600, color: "var(--text-2)" }}>{d.label} · {_histDate(d.date, { month: "short", day: "numeric" })}</h2>
              <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>{rows.map(s => setRow(s, view.stage[s.stageId]?.name))}</ul>
            </section>
          );
        })}
        {!hits.length && <p style={{ color: "var(--text-2)" }}>No set matches “{q.trim()}”.</p>}
      </>
    );
  } else if (e) {
    const daySets = e.sets.filter(s => s.day === day);
    const stages = e.stages.filter(st => daySets.some(s => s.stageId === st.id));
    const jump = id => {
      const el = scroller.current?.querySelector(`[data-stage="${CSS.escape(id)}"]`);
      if (el && scroller.current) scroller.current.scrollTo({ top: el.offsetTop - 8, behavior: "smooth" });
    };
    body = (
      <>
        <nav aria-label="Stages" style={{ display: "flex", flexWrap: "wrap", gap: 8, margin: "4px 0 8px" }}>
          {stages.map(st => (
            <button key={st.id} onClick={() => jump(st.id)} style={{
              minHeight: 32, padding: "0 10px", borderRadius: 8, border: "1px solid var(--line)", background: "var(--paper-2)",
              color: "var(--text-2)", fontFamily: "inherit", fontSize: 12, fontWeight: 600, cursor: "pointer",
            }}>{st.name}</button>
          ))}
        </nav>
        {stages.map(st => (
          <section key={st.id} data-stage={st.id} style={{ marginTop: 20 }}>
            <h2 style={{ margin: "0 0 2px", fontSize: 20, lineHeight: "25px", fontWeight: 700, overflowWrap: "anywhere" }}>{st.name}</h2>
            <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
              {daySets.filter(s => s.stageId === st.id).sort(view.byTime).map(s => setRow(s))}
            </ul>
          </section>
        ))}
      </>
    );
  }

  // Day tabs, grouped when the edition prints a group (ACL's two weekends).
  const groups = [];
  meta.days.forEach(d => {
    const p = _histDayParts(d);
    let g = groups.find(x => x.name === p.group);
    if (!g) { g = { name: p.group, days: [] }; groups.push(g); }
    g.days.push({ ...d, short: p.name });
  });

  return (
    <Screen>
      <_HistHeader title={meta.festivalName} sub={frozen} onBack={back} right={infoBtn} />
      <div style={{ padding: "8px 20px 8px", display: "grid", gap: 8, borderBottom: "1px solid var(--line)" }}>
        {!lineupOnly && !query && groups.map(g => (
          <div key={g.name || "days"} role="group" aria-label={g.name || "Days"} style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 6 }}>
            {g.name && <span style={{ width: 84, fontSize: 11, fontWeight: 600, letterSpacing: "0.04em", textTransform: "uppercase", color: "var(--text-2)" }}>{g.name}</span>}
            {g.days.map(d => (
              <_HistChip key={d.day} on={d.day === day} label={`${d.label}, ${_histDate(d.date, { month: "long", day: "numeric" })}`}
                onClick={() => { setDay(d.day); scroller.current?.scrollTo({ top: 0 }); }}>
                {d.short.slice(0, 3)} {+d.date.slice(8)}
              </_HistChip>
            ))}
          </div>
        ))}
        <input type="search" value={q} onChange={ev => setQ(ev.target.value)} placeholder={lineupOnly ? "Search the lineup" : "Search every day"}
          aria-label="Search artists" style={{
            width: "100%", boxSizing: "border-box", minHeight: 40, padding: "0 12px", borderRadius: 10,
            border: "1px solid var(--line-2)", background: "var(--paper-2)", color: "var(--ink)", fontFamily: "inherit", fontSize: 16,
          }} />
      </div>
      <ScrollBody ref={scroller} style={{ position: "relative", padding: "8px 20px 94px" }}>
        {res.status !== "ready" ? <_HistStatus res={res} retry={retry} what={meta.name} /> : body}
      </ScrollBody>
      {about && e && <_HistProvenance edition={e} onClose={() => setAbout(false)} />}
    </Screen>
  );
}
