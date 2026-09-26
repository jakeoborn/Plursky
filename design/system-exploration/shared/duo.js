// One system, two modes. Every screen is drawn once from tokens; dark/ and
// white/ only differ in tokens.js. Structures borrowed from shipped apps
// (Mobbin), each cited where it is used.
(function () {
const E = window.EDC, I = window.ICON, NOW = E.moments.late.hhmm, nowM = E.toMin(NOW);
const ic = (n, o = {}) => I(n, Object.assign({ sw: 1.7, color: "currentColor" }, o));
const photo = (n) => `url(../photos/${n}.jpg)`;

// ── Artist photos. Spotify is the only approved artist-image source; the
// private photos/ folder holds each one verified by Spotify returning that
// artist's own name. photos/have.js lists them. A b2b splits the circle
// between its artists. Initials only when Spotify has nothing we could verify.
const HAVE = new Set(window.HAVE_PHOTOS || []);
const slug = (n) => n.toLowerCase().replace(/&/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const members = (n) => n.split(/\s+b[23]b\s+|\s+with\s+/).map((s) => s.trim());
const initials = (n) => members(n).slice(0, 2).map((m) => (m.match(/[A-Za-z0-9]/) || ["·"])[0].toUpperCase()).join("");
function av(name, size = 40, cls = "") {
  const got = members(name).map(slug).filter((k) => HAVE.has(k));
  const st = `width:${size}px;height:${size}px`;
  if (!got.length) return `<span class="av mono ${cls}" style="${st};font-size:${Math.round(size * .32)}px">${initials(name)}</span>`;
  return `<span class="av ${cls}" style="${st}">${got.map((k) => `<span style="background-image:${photo("artist-" + k)}"></span>`).join("")}</span>`;
}
window.DUO_PHOTO_COVERAGE = () => { const all = [...new Set(E.SETS.map((s) => s.name))]; return { acts: all.length, withPhoto: all.filter((n) => members(n).some((m) => HAVE.has(slug(m)))).length }; };

function tabbar(active) {
  const t = [["today", "Today"], ["lineup", "Lineup"], ["map", "Map"], ["me", "Me"]];
  return `<nav class="tabbar">${t.map(([k, l]) => `<div class="tab ${k === active ? "on" : ""}">${ic(k, { sw: 1.6 })}<span>${l}</span></div>`).join("")}</nav>`;
}
function phone(inner, active, onPhoto) { return `<div class="phone D">${STATUS(E.moments.late.label, onPhoto ? "#FFFFFF" : "var(--ink)")}${inner}${active ? tabbar(active) : ""}${HOMEBAR("var(--ink)")}</div>`; }
const planIds = new Set(E.PLAN.map((p) => p.id));
const isClash = (s) => planIds.has(s.id) && (s.name === "Subtronics" || s.name.startsWith("Peggy"));
const liveOn = (st) => E.SETS.find((s) => s.stage === st && s.s <= nowM && nowM < s.e);
const nextOn = (st) => E.SETS.filter((s) => s.stage === st && s.s >= nowM).sort((a, b) => a.s - b.s)[0];

// ── 1. TODAY ─────────────────────────────────────────────
// Header: Apple Invites' event page (big title, then who's coming as a face
// cluster). Plan card + stage list: Apple Sports' "My Teams" card over the
// league scoreboard: now on the left, next on the right, the clock between.
function today() {
  const js = E.byName("John Summit"), pg = E.byName("Peggy Gou b2b Ki/Ki"), st = E.byName("Subtronics");
  const pct = Math.round(E.progress(js, NOW) * 100), left = js.e - nowM;
  const crew = [["M", "#FFB3E6"], ["D", "#A6F4E4"], ["R", "#FFF1A8"]];
  const order = ["circuit", "neon", "cosmic", "quantum", "bionic", "stereo", "waste", "basspod"];
  const side = (s, right) => s ? `<div style="display:flex;flex-direction:column;align-items:${right ? "flex-end" : "flex-start"};gap:7px;min-width:0;${right ? "text-align:right" : ""}">${av(s.name, 40, planIds.has(s.id) ? "on" : "")}<div data-wrap class="clamp2" style="font:600 14px/17px var(--f-ui);max-width:140px">${s.name}</div></div>` : `<div class="t-body-s ink3" style="${right ? "text-align:right" : ""}">Stage closed</div>`;
  const rows = order.map((id) => { const a = liveOn(id), b = nextOn(id), stg = E.stage(id);
    return `<div class="hair" style="display:grid;grid-template-columns:1fr 84px 1fr;align-items:center;padding:14px 16px">
      ${side(a, false)}
      <div style="text-align:center;display:grid;gap:6px;justify-items:center"><span style="font:400 11px/1 var(--f-display);letter-spacing:.12em;color:var(--ink-3)">${stg.short}</span><span class="t-data">${b ? E.fmt(b.start) : "—"}</span></div>
      ${side(b, true)}</div>`; }).join("");
  return phone(`<div class="body" style="overflow:hidden">
    <div class="pad between" style="padding-top:10px"><span class="t-label ink3">Night 2 · Sat May 16</span><span class="row" style="gap:6px;color:var(--sun)">${ic("sun", { size: 16, sw: 1.8 })}<span class="t-data-s">SUNRISE 5:35</span></span></div>
    <div class="pad" style="margin-top:10px"><div class="t-hero">EDC Las Vegas</div></div>
    <div class="pad row" style="margin-top:12px;gap:10px"><span class="row" style="gap:0">${crew.map(([c, bg], i) => `<span style="width:30px;height:30px;border-radius:50%;display:grid;place-items:center;margin-left:${i ? -8 : 0}px;background:${bg};color:#14121C;font:700 12px/1 var(--f-ui);box-shadow:0 0 0 2.5px var(--bg);position:relative;z-index:${3 - i}">${c}</span>`).join("")}</span><span class="t-body-s ink2">3 of your crew at Kinetic Field</span></div>

    <div class="pad" style="margin-top:18px"><div class="card lift" style="padding:14px 16px 12px;position:relative;overflow:hidden">
      <div class="between"><span class="sect">Your plan</span><span class="t-label live"><i></i>Live</span></div>
      <div style="display:grid;grid-template-columns:1fr 96px 1fr;align-items:center;margin-top:12px">
        <div style="display:flex;flex-direction:column;gap:8px;min-width:0">${av(js.name, 56, "on")}<div data-wrap class="clamp2" style="font:700 17px/20px var(--f-ui)">${js.name}</div><div class="t-data-s ink3">KIN · TO ${E.fmt(js.end)}</div></div>
        <div style="text-align:center;display:grid;justify-items:center;gap:4px"><div class="t-clock" style="font-size:34px;line-height:34px">${left}</div><div class="t-data-s ink3">MIN LEFT</div><div class="track" style="width:72px;margin-top:6px"><b style="width:${pct}%"></b></div></div>
        <div style="display:flex;flex-direction:column;align-items:flex-end;gap:8px;min-width:0;text-align:right">${av(pg.name, 56, "cl")}<div data-wrap class="clamp2" style="font:700 17px/20px var(--f-ui)">${pg.name}</div><div class="t-data-s ink3">NEXT · CIR ${E.fmt(pg.start)}</div></div>
      </div>
      <div class="between" style="margin-top:12px;padding:9px 10px;border-radius:var(--r-sm);background:var(--s3)"><span class="row" style="gap:10px;min-width:0">${av(st.name, 28, "cl")}<span class="t-body-s ell"><span class="clash">Clash</span> · Subtronics at ${E.fmt(st.start)}, Kinetic</span></span><span class="t-body-s acc" style="flex:none">Choose</span></div>
    </div></div>

    <div class="pad between" style="margin-top:20px"><span class="sect">Every stage · now and next</span><span class="t-data-s ink3">${E.liveAt(NOW).length} LIVE</span></div>
    <div class="pad" style="margin-top:10px"><div class="card" style="overflow:hidden"><div class="between" style="padding:10px 16px 8px"><span class="t-label live"><i></i>Now</span><span class="t-label ink3">Next</span></div>${rows}</div></div>
  </div>`, "today");
}

// ── 2. LINEUP · LIST ─────────────────────────────────────
// Rows follow Spotify's artist Events list: picture, title, one line of
// detail, a circled add that fills when it's on your plan.
function lineup() {
  const span = 630, W = 352, x0 = 58;
  const order = ["kinetic", "circuit", "neon", "cosmic", "bionic", "quantum", "waste", "stereo", "basspod"];
  let lanes = "";
  order.forEach((sid, i) => { const y = i * 12;
    lanes += `<text x="0" y="${y + 6}" font-family="Michroma" font-size="9" letter-spacing=".5" style="fill:var(--ink-3)">${E.stage(sid).short}</text>`;
    E.SETS.filter((s) => s.stage === sid).forEach((s) => { const x = x0 + s.s / span * W, w = Math.max(2, (s.e - s.s) / span * W - 2), pl = planIds.has(s.id), lv = s.s <= nowM && nowM < s.e;
      lanes += pl ? `<rect x="${x}" y="${y}" width="${w}" height="5" rx="2.5" style="fill:var(--acc)"/>` : `<rect x="${x}" y="${y + 1.5}" width="${w}" height="2" rx="1" style="fill:${lv ? "var(--ink)" : "var(--line-2)"}"/>`; }); });
  const nx = x0 + nowM / span * W;
  const ticks = [["8P", 60], ["10P", 180], ["12A", 300], ["2A", 420], ["4A", 540]].map(([l, m]) => `<text x="${x0 + m / span * W}" y="124" text-anchor="middle" font-family="Martian Mono" font-size="9.5" style="fill:var(--ink-3)">${l}</text>`).join("");
  const strip = `<svg width="400" height="130" viewBox="-2 -6 414 134">${lanes}<line x1="${nx}" y1="-4" x2="${nx}" y2="108" style="stroke:var(--ink)" stroke-width="1"/><circle cx="${nx}" cy="-2" r="2.5" style="fill:var(--ink)"/>${ticks}</svg>`;
  const sets = E.SETS.filter((s) => s.s >= E.toMin("01:30") && s.s <= E.toMin("01:47")).sort((a, b) => a.s - b.s || (planIds.has(b.id) - planIds.has(a.id)) || a.name.localeCompare(b.name));
  const row = (s, live) => { const pl = planIds.has(s.id), cl = isClash(s);
    return `<div class="between" style="height:64px;padding:0 12px;border-radius:var(--r-sm);${live ? "background:var(--s2);box-shadow:var(--glow);" : pl ? "background:var(--acc-08);" : ""}">
      <div class="row" style="gap:12px;min-width:0"><span class="t-data ${pl ? "" : "ink2"}" style="width:40px">${E.fmt(s.start)}</span>${av(s.name, 42, live || pl ? (cl ? "cl" : "on") : "")}
      <div style="min-width:0"><div class="t-headline ell" style="max-width:210px;${pl ? "" : "font-weight:550"}">${s.name}</div><div class="t-body-s ${cl ? "clash" : "ink3"}" style="font-weight:400;font-size:13px">${cl ? "Clash · " : ""}${E.stage(s.stage).name}</div></div></div>
      ${live ? `<span class="t-label live" style="font-size:11px"><i></i>Live</span>` : `<span class="add ${pl ? "on" : ""}">${ic(pl ? "check" : "plus", { size: 16, sw: 2.2 })}</span>`}</div>`; };
  return phone(`<div class="body">
    <div class="pad between" style="padding-top:8px"><div class="t-title">Lineup</div><div class="row ink2" style="gap:6px"><span class="ibtn">${ic("search")}</span><span class="ibtn">${ic("filter")}</span></div></div>
    <div class="pad row" style="gap:22px;margin-top:6px">${[["FRI", "15"], ["SAT", "16"], ["SUN", "17"]].map(([d, n], i) => `<div style="padding-bottom:9px;position:relative;${i === 1 ? "" : "opacity:.5"}"><span class="t-label" style="font-size:12px">${d}</span> <span class="t-data-s ink3">${n}</span>${i === 1 ? `<span style="position:absolute;left:0;right:0;bottom:0;height:2px;background:var(--acc)"></span>` : ""}</div>`).join("")}</div>
    <div class="pad" style="margin-top:12px">${strip}</div>
    <div class="pad row" style="gap:8px;margin-top:8px"><span class="chip on">List</span><span class="chip">Grid</span><span class="chip">My plan <b>8</b></span><span class="chip">Live <b>9</b></span></div>
    <div class="pad" style="margin-top:12px;display:grid;gap:2px">
      <div class="sect" style="padding:6px 0 8px">Now on your plan</div>${row(E.byName("John Summit"), true)}
      <div class="sect" style="padding:16px 0 8px">1 AM</div>${sets.map((s) => row(s)).join("")}
    </div></div>`, "lineup");
}

// ── 3. LINEUP · GRID (timetable) ─────────────────────────
// Stages across, time down; each block leads with the artist's face. The
// current-time pill sits in the time column (Todoist's calendar does the same).
function calendar() {
  const order = ["kinetic", "circuit", "neon", "cosmic", "quantum", "bionic", "stereo", "waste", "basspod"];
  const t0 = E.toMin("23:30"), t1 = E.toMin("03:30"), k = 2.45, colW = 112, gut = 60;
  const ticks = []; for (let m = t0; m <= t1; m += 30) ticks.push(m);
  const clock = (m) => { let h = (19 + Math.floor(m / 60)) % 24, mm = m % 60; const ap = h >= 12 ? "P" : "A"; h = h % 12 || 12; return mm ? `${h}:${String(mm).padStart(2, "0")}` : `${h} ${ap}M`; };
  const block = (s) => { const a = Math.max(s.s, t0), b = Math.min(s.e, t1); if (b <= a) return "";
    const top = (a - t0) * k, h = (b - a) * k - 3, pl = planIds.has(s.id), live = s.s <= nowM && nowM < s.e, cl = isClash(s);
    return `<div style="position:absolute;left:3px;right:3px;top:${top}px;height:${h}px;border-radius:12px;padding:7px 8px;overflow:hidden;${pl ? `background:var(--acc-14);box-shadow:inset 0 0 0 1.5px ${cl ? "var(--clash)" : "var(--acc)"}` : `background:var(--s2);box-shadow:inset 0 0 0 1px var(--line)`}">
      <div class="between" style="gap:4px">${av(s.name, 24, pl ? (cl ? "cl" : "on") : "")}${h > 40 ? `<span class="t-data-s ${cl ? "clash" : live ? "" : "ink3"}" style="${live && !cl ? "color:var(--live)" : ""}">${cl ? "CLASH" : live ? "LIVE" : E.fmt(s.start)}</span>` : ""}</div>
      ${h > 44 ? `<div data-wrap style="margin-top:6px;font:${pl ? 650 : 550} 13px/16px var(--f-ui);color:${pl ? "var(--ink)" : "var(--ink-2)"};display:-webkit-box;-webkit-line-clamp:${h > 96 ? 3 : 2};-webkit-box-orient:vertical;overflow:hidden">${s.name}</div>` : ""}
    </div>`; };
  const H = (t1 - t0) * k;
  return phone(`<div class="body">
    <div class="pad between" style="padding-top:8px"><div class="t-title">Lineup</div><div class="row ink2" style="gap:6px"><span class="ibtn">${ic("search")}</span><span class="ibtn">${ic("filter")}</span></div></div>
    <div class="pad row" style="gap:8px;margin-top:8px"><span class="chip">List</span><span class="chip on">Grid</span><span class="chip">My plan <b>8</b></span><span class="t-label ink3" style="margin-left:auto">SAT 16</span></div>
    <div data-scroll-x style="position:absolute;left:0;right:0;top:110px;bottom:0;overflow:hidden">
      <div style="position:absolute;left:${gut}px;top:0;display:flex">${order.map((id) => `<div style="width:${colW}px;padding:0 3px"><div style="font:600 13px/1 var(--f-ui);padding:10px 6px 9px;color:${["kinetic", "circuit"].includes(id) ? "var(--ink)" : "var(--ink-2)"};white-space:nowrap"><span style="font:400 11px/1 var(--f-display);letter-spacing:.12em;color:var(--ink-3);margin-right:6px">${E.stage(id).short}</span>${E.stage(id).name.split(" ")[0]}</div></div>`).join("")}</div>
      <div style="position:absolute;left:0;right:0;top:36px;height:1px;background:var(--line-2)"></div>
      <div style="position:absolute;left:0;top:44px;width:${gut}px;height:${H}px">${ticks.filter((m) => Math.abs(m - nowM) * k > 22).map((m) => `<div class="t-data-s ink3" style="position:absolute;right:8px;top:${(m - t0) * k - 7}px;white-space:nowrap">${clock(m)}</div>`).join("")}</div>
      <div style="position:absolute;left:${gut}px;top:44px;height:${H}px;display:flex">
        ${ticks.map((m) => `<div style="position:absolute;left:0;width:${order.length * colW}px;top:${(m - t0) * k}px;height:1px;background:var(--line)"></div>`).join("")}
        ${order.map((id) => `<div style="position:relative;width:${colW}px;height:${H}px">${E.SETS.filter((s) => s.stage === id).map(block).join("")}</div>`).join("")}
        <div style="position:absolute;left:-${gut}px;width:${order.length * colW + gut}px;top:${(nowM - t0) * k}px;height:1.5px;background:var(--acc);box-shadow:0 0 10px var(--acc-55)"></div>
        <span class="t-data-s" style="position:absolute;left:-${gut - 4}px;top:${(nowM - t0) * k - 9}px;padding:2px 5px;border-radius:5px;background:var(--acc);color:var(--on-acc)">12:50</span>
      </div>
    </div>
  </div>`, "lineup");
}

// ── 4. MAP ───────────────────────────────────────────────
// The official EDC LV 2026 map. Stage sheet = a place sheet (Pangea, Tabby,
// Wanderlog): share/close in the header, faces on the rows, actions under.
// No distances or walk times: stage x/y are poster art, not a survey.
function map() {
  const W = 600, H = W * 1350 / 1080, ox = -14, oy = 150, px = (x) => ox + x / 100 * W, py = (y) => oy + y / 100 * H;
  const k = E.stage("kinetic"), you = { x: px(33), y: py(40) }, js = E.byName("John Summit"), st = E.byName("Subtronics");
  const pins = E.STAGES.map((s) => { const x = px(s.x), y = py(s.y), hot = s.id === "kinetic";
    return hot ? `<g><circle cx="${x}" cy="${y}" r="44" style="fill:var(--acc)" opacity=".22"/><circle cx="${x}" cy="${y}" r="30" fill="none" style="stroke:var(--acc)" stroke-width="2"/><circle cx="${x}" cy="${y}" r="8" style="fill:var(--acc)"/></g>`
      : `<g><circle cx="${x}" cy="${y}" r="11" style="fill:var(--bg);stroke:var(--ink)" fill-opacity=".7" stroke-opacity=".7" stroke-width="1.4"/><circle cx="${x}" cy="${y}" r="4" style="fill:var(--ink)"/></g>`; }).join("");
  const r = (s, lbl, t) => `<div class="between" style="padding:9px 0"><span class="row" style="gap:12px;min-width:0">${av(s.name, 38, lbl ? "" : "on")}<span style="min-width:0"><span class="t-body-s" style="display:block">${s.name}</span><span class="t-data-s ink3">${lbl || "NOW"}</span></span></span><span class="t-data ink2">${t}</span></div>`;
  return phone(`<div style="position:absolute;inset:0;overflow:hidden;background:var(--bg)">
    <img src="../../../edc-map-2026.jpg" alt="" style="position:absolute;left:${ox}px;top:${oy}px;width:${W}px;height:${H}px;filter:var(--map-filter)">
    <div style="position:absolute;inset:0;background:var(--map-fade)"></div>
    <svg width="440" height="956" style="position:absolute;inset:0">
      <path d="M${you.x} ${you.y} Q ${you.x + 70} ${(you.y + py(k.y)) / 2} ${px(k.x)} ${py(k.y) + 30}" fill="none" style="stroke:var(--acc)" stroke-width="3" stroke-dasharray="1 8" stroke-linecap="round"/>
      ${pins}<g transform="translate(${you.x},${you.y})"><circle r="18" fill="#2F6BFF" opacity=".25"/><circle r="7.5" fill="#2F6BFF" stroke="#fff" stroke-width="2.5"/></g></svg>
    <div class="between" style="position:absolute;top:62px;left:20px;right:20px"><div class="t-title">Map</div><span class="code" style="background:var(--chip-bg)">OFFICIAL · EDC 2026</span></div>
    <div style="position:absolute;top:110px;left:20px;right:0;display:flex;gap:8px"><span class="chip on">Stages</span><span class="chip">Water</span><span class="chip">Medical</span><span class="chip">Crew</span></div>
    <div style="position:absolute;left:12px;right:12px;bottom:98px;background:var(--scrim);backdrop-filter:blur(20px);-webkit-backdrop-filter:blur(20px);border-radius:var(--r-lg);box-shadow:var(--e2);padding:10px 18px 16px">
      <div style="width:36px;height:4px;border-radius:2px;background:var(--line-2);margin:0 auto 10px"></div>
      <div class="between" style="align-items:flex-start"><div><div class="t-label ink3"><span class="live" style="margin-right:8px"><i></i>Live</span>Stage · KIN</div><div class="t-title" style="font-size:24px;margin-top:6px">Kinetic Field</div></div>
        <div class="row ink2" style="gap:8px"><span class="ibtn" style="background:var(--s3)">${ic("share", { size: 18 })}</span><span class="ibtn" style="background:var(--s3)"><svg width="16" height="16" viewBox="0 0 16 16"><path d="M3.5 3.5l9 9M12.5 3.5l-9 9" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg></span></div></div>
      <div style="margin-top:4px">${r(js, "", "→ " + E.fmt(js.end))}<div class="hair"></div>${r(st, "NEXT · ON YOUR PLAN", E.fmt(st.start))}</div>
      <div class="btn pri" style="width:100%;margin-top:8px">${ic("crew", { size: 20, sw: 1.8 })}Meet crew here</div>
      <div class="row" style="margin-top:10px;gap:8px"><span class="chip">${ic("lineup", { size: 15, sw: 1.8 })}Stage schedule</span><span class="chip">${ic("sun", { size: 15, sw: 1.8 })}Sunrise set</span></div>
    </div>
  </div>`, "map");
}

// ── 5. ARTIST ────────────────────────────────────────────
// Apple Music's artist page: the photo is the header, the name sits on it
// bottom-left with a round play button bottom-right, and the page is a list.
function artist() {
  const js = E.byName("John Summit"), prev = E.byName("Hardwell"), next = E.byName("Subtronics");
  return phone(`<div class="body" style="top:0">
    <div style="position:relative;height:384px;background:${photo("artist-john-summit")} center 20%/cover,var(--s3)">
      <div style="position:absolute;inset:0;background:var(--hero-fade)"></div>
      <div class="between" style="position:absolute;left:16px;right:16px;top:58px;color:#fff"><span class="ibtn" style="background:rgba(0,0,0,.35);backdrop-filter:blur(10px)">${ic("back", { sw: 2 })}</span><span class="ibtn" style="background:rgba(0,0,0,.35);backdrop-filter:blur(10px)">${ic("share", { sw: 1.8 })}</span></div>
      <span style="position:absolute;right:16px;top:112px;font:500 11px/1 var(--f-ui);letter-spacing:.04em;padding:5px 8px;border-radius:6px;background:rgba(0,0,0,.45);color:#fff">Photo · Spotify</span>
      <div class="between" style="position:absolute;left:20px;right:20px;bottom:18px;align-items:flex-end"><div style="color:#fff"><div class="t-label" style="color:rgba(255,255,255,.8)">Tech House · Kinetic Field</div><div style="font:800 44px/44px var(--f-ui);letter-spacing:-.04em;margin-top:8px;text-shadow:0 2px 20px rgba(0,0,0,.35)">John Summit</div></div>
        <span style="width:56px;height:56px;border-radius:50%;display:grid;place-items:center;flex:none;background:var(--acc);color:var(--on-acc);box-shadow:0 10px 26px -10px var(--acc-55)">${ic("play", { size: 22, sw: 1.6, fill: "currentColor" })}</span></div>
    </div>
    <div class="pad" style="margin-top:16px">
      <div class="card lift" style="padding:14px 16px">
        <div class="between"><span class="t-label live"><i></i>Live now · Sat May 16</span><span class="t-data-s ink3">${js.e - nowM} MIN LEFT</span></div>
        <div class="t-clock" style="font-size:32px;line-height:34px;margin-top:10px">12:32<span class="ink3" style="font-size:20px"> → </span>1:42</div>
        <div class="track" style="margin-top:12px"><b style="width:${Math.round(E.progress(js, NOW) * 100)}%"></b></div>
      </div>
      <div class="row" style="gap:10px;margin-top:12px"><span class="btn pri" style="flex:1">${ic("check", { size: 20, sw: 2.2 })}On your plan</span><span class="btn sec" style="width:52px;padding:0">${ic("crew", { size: 20 })}</span></div>
      <div class="sect" style="margin:18px 0 2px">On Kinetic Field tonight</div>
      ${[[prev, "Before"], [js, "Now"], [next, "Next · on your plan"]].map(([s, l], i) => `<div class="between hair" style="padding:9px 0"><div class="row" style="gap:12px">${av(s.name, 44, i === 1 ? "on" : "")}<div><div class="t-body-s" style="${i === 1 ? "color:var(--acc-ink)" : ""}">${s.name}</div><div class="t-data-s ink3" style="margin-top:3px">${l.toUpperCase()}</div></div></div><span class="t-data ${i === 1 ? "" : "ink3"}">${E.fmt(s.start)}</span></div>`).join("")}
    </div>
  </div>`, "lineup", true);
}

// ── 6. INSIDE THE ARTIST CARD ────────────────────────────
function artistInside() {
  const sim = ["Bad Boombox b2b Ollie Lishman", "Prospa", "Cid"].map(E.byName);
  const tracks = [["Where You Are", "with Hayla — on Kinetic tonight at 8"], ["La Danza", ""], ["Deep End", ""], ["Make Me Feel", ""]];
  return phone(`<div class="body">
    <div class="pad between" style="padding-top:6px;padding-bottom:12px;border-bottom:1px solid var(--line)">
      <div class="row" style="gap:12px"><span class="ibtn" style="width:32px">${ic("back", { sw: 2 })}</span>${av("John Summit", 36, "on")}<div><div class="t-headline">John Summit</div><div class="t-data-s ink3">LIVE · KIN · 52 MIN LEFT</div></div></div><span class="ibtn">${ic("share", { sw: 1.8 })}</span></div>
    <div class="pad" style="margin-top:16px">
      <div class="between"><span class="sect">Likely in the set</span><span class="t-data-s ink3">FROM RECENT SETS</span></div>
      <div class="t-body-s ink2" style="font-weight:400;margin-top:8px">A guide, not a setlist: tracks this artist has played lately.</div>
      <div style="margin-top:8px">${tracks.map(([t, n], i) => `<div class="between hair" style="padding:10px 0"><div class="row" style="gap:14px"><span class="t-data ink3" style="width:18px">0${i + 1}</span><div><div class="t-body-s">${t}</div>${n ? `<div class="t-body-s ink3" style="font-weight:400;font-size:13px">${n}</div>` : ""}</div></div><span class="t-data-s acc">LIKELY</span></div>`).join("")}</div>
      <div class="btn sec" style="width:100%;margin-top:10px">${ic("play", { size: 16, sw: 1.6, fill: "currentColor" })}Open in Spotify</div>
    </div>
    <div class="pad" style="margin-top:20px">
      <div class="between" style="margin-bottom:10px"><span class="sect">Your moments · this set</span><span class="t-data-s ink3">3 · AUTO-TAGGED</span></div>
      <div style="display:grid;grid-template-columns:2fr 1fr;grid-template-rows:1fr 1fr;gap:6px;height:176px">
        <div style="grid-row:span 2;border-radius:var(--r-md);background:${photo("IMG_5484")} center/cover,var(--s3);position:relative"><span class="t-data-s" style="position:absolute;left:10px;bottom:10px;padding:4px 7px;border-radius:6px;background:rgba(0,0,0,.6);color:#fff">12:41 AM</span></div>
        <div style="border-radius:var(--r-sm);background:${photo("IMG_5621")} center/cover,var(--s3)"></div>
        <div style="border-radius:var(--r-sm);background:${photo("IMG_5605")} center/cover,var(--s3)"></div>
      </div>
    </div>
    <div class="pad" style="margin-top:20px">
      <div class="sect" style="margin-bottom:4px">If you like this · tonight</div>
      ${sim.map((s) => `<div class="between hair" style="padding:9px 0"><div class="row" style="gap:12px;min-width:0">${av(s.name, 42)}<div style="min-width:0"><div class="t-body-s ell" style="max-width:220px">${s.name}</div><div class="t-body-s ink3" style="font-weight:400;font-size:13px">${s.genre} · ${E.stage(s.stage).name}</div></div></div><div class="row" style="gap:10px"><span class="t-data ink2">${E.fmt(s.start)}</span><span class="add">${ic("plus", { size: 16, sw: 2.2 })}</span></div></div>`).join("")}
    </div>
  </div>`, "lineup");
}

// ── 7. ME ────────────────────────────────────────────────
// Headliner's elements, kept as they were. The Appearance row is Opera's and
// Cosmos's inline System/Dark/Light control (Mobbin): one tap, no sub-page.
// Headliner's elements: the "My EDC 2026" poster billed by minutes you
// stayed, the share row under it (Beli's recap: destinations, not a generic
// button) and the passport. Faces of the night run under the title.
function me() {
  const seen = [["Above & Beyond", 1], ["Kaskade", 1], ["Subtronics", 1], ["John Summit", 1], ["The Prodigy", 0], ["Sammy Virji", 0], ["Kettama", 0]];
  const bill = (n, big) => `<span style="white-space:nowrap;font:900 ${big ? 25 : 17}px/${big ? 27 : 21}px var(--f-billing);font-stretch:${big ? 64 : 72}%;text-transform:uppercase">${n}</span>`;
  return phone(`<div class="body">
    <div class="pad between" style="padding-top:8px"><div class="row" style="gap:12px"><span style="width:48px;height:48px;border-radius:50%;display:grid;place-items:center;background:var(--s3);box-shadow:0 0 0 1.5px var(--acc);font:700 17px var(--f-ui)">JO</span><div><div class="t-headline" style="font-size:21px">Jake</div><div class="t-label ink3" style="margin-top:4px">4 festivals · since 2024</div></div></div><span class="ibtn ink2">${ic("gear", { sw: 1.6 })}</span></div>
    <div class="pad" style="margin-top:16px">
      <div style="background:var(--acc);color:var(--on-acc);border-radius:var(--r-md);padding:18px 16px 16px;text-align:center;position:relative;overflow:hidden;box-shadow:0 18px 40px -22px var(--acc-55)">
        <div style="position:absolute;inset:0;background:radial-gradient(circle,rgba(255,255,255,.14) 1px,transparent 1.4px) 0 0/7px 7px"></div>
        <div class="t-label" style="position:relative;color:inherit;opacity:.85">Plursky presents</div>
        <div style="position:relative;font:900 60px/52px var(--f-billing);font-stretch:62%;text-transform:uppercase;margin-top:8px">My EDC 2026</div>
        <div style="position:relative;display:flex;justify-content:center;margin-top:12px">${seen.map(([n], i) => `<span style="margin-left:${i ? -8 : 0}px;position:relative;z-index:${9 - i};border-radius:50%;box-shadow:0 0 0 2px var(--acc)">${av(n, 34)}</span>`).join("")}</div>
        <div style="position:relative;height:2px;background:currentColor;opacity:.9;margin:12px 0 10px"></div>
        <div style="position:relative;text-wrap:balance">${seen.map(([n, big]) => bill(n, big)).join(`<span style="font:900 17px var(--f-billing)"> • </span>`)}</div>
        <div style="position:relative;height:2px;background:currentColor;opacity:.9;margin:10px 0 8px"></div>
        <div class="t-label" style="position:relative;color:inherit">Billed by minutes you stayed<br>14 sets · 19.7 hours · Sat so far</div>
      </div>
      <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-top:14px">${[["share", "Story", 1], ["crew", "Crew", 0], ["photo", "Save", 0], ["chevron", "More", 0]].map(([k, l, p]) => `<div style="display:grid;justify-items:center;gap:7px"><span style="width:52px;height:52px;border-radius:50%;display:grid;place-items:center;${p ? "background:var(--acc);color:var(--on-acc)" : "box-shadow:inset 0 0 0 1.5px var(--line-2);color:var(--ink)"}">${ic(k, { size: 21, sw: 1.8 })}</span><span class="t-body-s ink2" style="font-size:13px">${l}</span></div>`).join("")}</div>
    </div>
    <div class="pad" style="margin-top:16px"><div class="card between" style="padding:10px 10px 10px 16px">
      <div class="t-body-s">Appearance</div>
      <div class="seg" role="radiogroup" aria-label="Appearance">${[["system", "System"], ["dark", "Dark"], ["light", "Light"]].map(([v, l]) => `<button class="toggle" role="radio" data-v="${v}">${l}</button>`).join("")}</div>
    </div></div>
    <div class="pad" style="margin-top:18px"><div class="sect" style="margin-bottom:4px">Passport</div>
      ${[["EDC", "Las Vegas 2026", "3 nights · 14 sets"], ["NOC", "Nocturnal Wonderland 2025", "2 nights · 9 sets"], ["EDC", "Las Vegas 2025", "3 nights · 17 sets"]].map(([c, n, d]) => `<div class="between hair" style="padding:11px 0"><div class="row" style="gap:12px"><span class="code" style="min-width:56px;text-align:center">${c}</span><div><div class="t-body-s">${n}</div><div class="t-data-s ink3" style="margin-top:3px">${d.toUpperCase()}</div></div></div><span class="ink3">${ic("chevron", { size: 18, sw: 1.6 })}</span></div>`).join("")}
    </div>
    <div class="pad" style="margin-top:18px"><div class="between" style="margin-bottom:10px"><span class="sect">Memories</span><span class="t-data-s ink3">212 →</span></div>
      <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:6px">${["IMG_5537", "IMG_5545", "IMG_5597", "IMG_5626"].map((p) => `<div style="aspect-ratio:1;border-radius:var(--r-sm);background:${photo(p)} center/cover,var(--s3)"></div>`).join("")}</div></div>
  </div>`, "me");
}

const SCREENS = [["today", "Today", today], ["lineup", "Lineup · List", lineup], ["calendar", "Lineup · Grid", calendar], ["map", "Map", map], ["artist", "Artist", artist], ["artist-inside", "Artist · inside", artistInside], ["me", "Me", me]];
window.DUO_SCREENS = SCREENS;
const board = document.getElementById("screens");
if (board) board.innerHTML = SCREENS.map(([k, l, f], i) => `<div class="screen-wrap" data-screen="${k}"><div class="screen-cap">0${i + 1} · ${l}</div>${f()}</div>`).join("");
TOKENS.icons.samples = ["today", "lineup", "map", "me", "search", "share", "sun", "clash", "water", "medic", "crew", "play"].map((n) => `<div style="color:var(--ink)">${ic(n, { sw: 1.6 })}</div>`).join("");
if (document.getElementById("spec")) renderSpec(document.getElementById("spec"));
if (location.hash === "#render") document.documentElement.classList.add("render");
})();
