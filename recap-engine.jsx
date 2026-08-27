// ─────────────────────────────────────────────────────────────────
// recap-engine.jsx — share/recap canvas rendering engine
// Extracted verbatim from spotify.jsx (monolith split #1).
//
// Pure canvas/blob renderers + their share wrappers: recap share card,
// beat-synced recap VIDEO, collage + animated GIF, Festival DNA, Passport,
// Film Strip, Crew Showdown/Comparison.
//
// Cross-file contract (unchanged): these are top-level declarations, so
// they're global like the rest of the SPA. Runtime calls into spotify.jsx
// helpers (_canShare, _getPhoto, _imgFromBlob, _frameFromVideoBlob,
// _drawCover, _isPlusSub, _exportW/_exportH, _showShareLimitToast,
// _incShareCount, FESTIVAL_CONFIG, ARTISTS, STAGES) resolve at call time
// regardless of load order. Loaded BEFORE spotify.jsx in index.html.
// window-exported names below match exactly what spotify.jsx exported for
// the engine before the split, so window._share* call sites in
// artist.jsx / map.jsx / supabase.jsx keep working.
// ─────────────────────────────────────────────────────────────────

// v147: shareable image card — paints the recap stats onto a 1080x1920 canvas
// (Instagram story aspect), then shares via navigator.share files API (which
// pops the iOS share sheet — IG, Messages, AirDrop, save to camera roll) or
// downloads as PNG on desktop. Fonts ship via Google Fonts in index.html; we
// await document.fonts.ready so canvas picks them up.
async function _renderRecapShareCard(recap) {
  const W = 1080, H = 1920;
  const canvas = document.createElement("canvas");
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext("2d");
  const CFG = window.FESTIVAL_CONFIG || {};

  // Ensure custom fonts are ready before we draw — canvas falls back to a
  // generic serif if Instrument Serif hasn't loaded yet.
  try {
    await document.fonts.load("700 italic 96px 'Instrument Serif'");
    await document.fonts.load("700 24px 'Geist Mono'");
    await document.fonts.load("500 64px Geist");
  } catch {}

  // Background — same gradient as the hero card on screen
  const grad = ctx.createLinearGradient(0, 0, W, H);
  grad.addColorStop(0,    "#1a120d");
  grad.addColorStop(0.55, "#7b3d9a");
  grad.addColorStop(1,    "#e85d2e");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, H);

  // Subtle starfield to echo TopDownMap's aesthetic
  ctx.fillStyle = "rgba(247,237,224,0.4)";
  let s = 0xdeadbeef;
  for (let i = 0; i < 60; i++) {
    s = Math.imul(s ^ (s >>> 17), 0x45d9f3b);
    const rng = () => ((s = Math.imul(s, 0x119de1f3)) >>> 0) / 0x100000000;
    const x = rng() * W, y = rng() * H * 0.5;
    const r = 1 + rng() * 2.5;
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
  }

  // Kicker
  ctx.fillStyle = "rgba(247,237,224,0.65)";
  ctx.font = "700 26px 'Geist Mono', monospace";
  ctx.textAlign = "left";
  ctx.fillText(`PLURSKY · ${(CFG.shortName || "EDC LV").toUpperCase()} · ${CFG.year || ""}`, 72, 130);

  // Title
  ctx.fillStyle = "#f7ede0";
  ctx.textAlign = "left";
  ctx.font = "400 130px 'Instrument Serif', serif";
  ctx.fillText("That was", 72, 290);
  ctx.font = "italic 400 130px 'Instrument Serif', serif";
  ctx.fillStyle = "#f59a36";
  ctx.fillText("your weekend.", 72, 440);

  // 2x2 stats grid
  const cells = [
    { big: String(recap.setsCount),                small: "SETS CAUGHT" },
    { big: _fmtHrsMin(recap.totalMin),             small: "ON DANCEFLOORS" },
    { big: String(recap.stagesVisitedCount || recap.nights), small: recap.stagesVisitedCount != null ? `OF ${(window.STAGES || []).length} STAGES` : "NIGHTS" },
    { big: String(recap.headlinersCaught),         small: "HEADLINERS" },
  ];
  const gridTop = 600, cellH = 240, cellW = W / 2;
  cells.forEach((c, i) => {
    const col = i % 2, row = Math.floor(i / 2);
    const x = col * cellW + 72;
    const y = gridTop + row * cellH;
    ctx.fillStyle = "#f7ede0";
    ctx.font = "400 130px 'Instrument Serif', serif";
    ctx.fillText(c.big, x, y + 130);
    ctx.fillStyle = "rgba(247,237,224,0.65)";
    ctx.font = "700 22px 'Geist Mono', monospace";
    ctx.fillText(c.small, x, y + 175);
  });

  // Top-stage banner
  if (recap.topStage) {
    const by = gridTop + cellH * 2 + 60;
    ctx.fillStyle = recap.topStage.color;
    ctx.fillRect(72, by, W - 144, 6);
    ctx.fillStyle = "rgba(247,237,224,0.7)";
    ctx.font = "700 22px 'Geist Mono', monospace";
    ctx.fillText("YOU LIVED AT", 72, by + 60);
    ctx.fillStyle = "#f7ede0";
    ctx.font = "italic 400 80px 'Instrument Serif', serif";
    ctx.fillText(recap.topStage.name, 72, by + 150);
  }

  // Headliner pill row
  if (recap.headlinerNames?.length) {
    const hy = H - 380;
    ctx.fillStyle = "rgba(247,237,224,0.7)";
    ctx.font = "700 22px 'Geist Mono', monospace";
    ctx.fillText(`HEADLINERS CAUGHT · ${recap.headlinersCaught}`, 72, hy);
    ctx.font = "700 28px 'Geist Mono', monospace";
    ctx.fillStyle = "#f7ede0";
    let lineY = hy + 60;
    let lineW = 0;
    recap.headlinerNames.slice(0, 8).forEach((name) => {
      const text = "★ " + name.toUpperCase();
      const w = ctx.measureText(text).width + 40;
      if (lineW + w > W - 144) {
        lineY += 60;
        lineW = 0;
      }
      ctx.fillText(text, 72 + lineW, lineY);
      lineW += w + 24;
    });
  }

  // Watermark
  ctx.fillStyle = "rgba(247,237,224,0.55)";
  ctx.textAlign = "left";
  ctx.font = "700 26px 'Geist Mono', monospace";
  ctx.fillText("PLURSKY.COM", 72, H - 90);
  ctx.textAlign = "right";
  ctx.fillText("UNDER THE ELECTRIC SKY", W - 72, H - 90);

  return canvas;
}

async function _shareRecapCard(recap) {
  let canvas;
  try { canvas = await _renderRecapShareCard(recap); }
  catch (e) { console.error("[plursky-recap] render failed:", e); return false; }
  return _shareCanvasAsImage(canvas, {
    filename: `plursky-recap-${(window.FESTIVAL_CONFIG?.id || "festival")}.png`,
    title: `My ${window.FESTIVAL_CONFIG?.shortName || "festival"}`,
  });
}

// v226: shared PNG share tail — canvas → blob → native Capacitor sheet →
// web navigator.share({ files }) → download fallback. Extracted verbatim
// from _shareRecapCard so the Festival Year card uses the same path.
async function _shareCanvasAsImage(canvas, { filename, title }) {
  const blob = await new Promise(r => canvas.toBlob(r, "image/png"));
  if (!blob) return false;
  window.plurskyHaptic?.("LIGHT");
  const file = new File([blob], filename, { type: "image/png" });

  // Native iOS path (v163): @capacitor/share with `files` (data URL) — more
  // reliable inside WKWebView than the web `navigator.share({ files })` path
  // which can fail silently in some iOS versions.
  const capShare = window.Capacitor?.Plugins?.Share;
  if (capShare?.share && window.Capacitor?.isNativePlatform?.()) {
    try {
      const dataUrl = await new Promise((resolve, reject) => {
        const r = new FileReader();
        r.onload = () => resolve(r.result);
        r.onerror = reject;
        r.readAsDataURL(blob);
      });
      await capShare.share({ title, files: [dataUrl] });
      return true;
    } catch (e) {
      // Fall through to web flow if the native sheet errors or is cancelled
      if (e?.message && !/cancel|abort/i.test(e.message)) console.warn("[plursky-share]", e.message);
    }
  }

  // Web path — navigator.share({ files }) where supported
  if (navigator.share && typeof navigator.canShare === "function" && navigator.canShare({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title });
      return true;
    } catch (e) {
      if (e?.name === "AbortError") return false; // user cancelled — silent
    }
  }
  // Final fallback: download
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  return true;
}

// ── FESTIVAL YEAR CARD (v226 · integrations #6) ─────────────────────
// Spotify-Wrapped-style ANNUAL share card: aggregates every festival
// attended this year (archive snapshots + the live festival) into one
// 1080×1920 story-format image. Modeled on Goodreads "Year in Books"
// (annual stat card) + the existing weekend card's visual system so the
// two exports read as a family. Takes the object _computeFestivalYear()
// (spotify.jsx) builds: { year, festivals[], totalFestivals, totalSets,
// totalMoments, totalMin, topArtists[] }.
async function _renderFestivalYearCard(yd) {
  const W = 1080, H = 1920;
  const canvas = document.createElement("canvas");
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext("2d");

  try {
    await document.fonts.load("700 italic 96px 'Instrument Serif'");
    await document.fonts.load("700 24px 'Geist Mono'");
    await document.fonts.load("500 64px Geist");
  } catch {}

  // Background — deep night → horizon purple → ember. Darker start than
  // the weekend card so the two are siblings, not twins.
  const grad = ctx.createLinearGradient(0, 0, W, H);
  grad.addColorStop(0,    "#0a0618");
  grad.addColorStop(0.55, "#6D28D9");
  grad.addColorStop(1,    "#e85d2e");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, H);

  // Starfield (same generator as the weekend card)
  ctx.fillStyle = "rgba(247,237,224,0.4)";
  let s = 0xdeadbeef;
  for (let i = 0; i < 60; i++) {
    s = Math.imul(s ^ (s >>> 17), 0x45d9f3b);
    const rng = () => ((s = Math.imul(s, 0x119de1f3)) >>> 0) / 0x100000000;
    const x = rng() * W, y = rng() * H * 0.5;
    const r = 1 + rng() * 2.5;
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
  }

  // Kicker
  ctx.fillStyle = "rgba(247,237,224,0.65)";
  ctx.font = "700 26px 'Geist Mono', monospace";
  ctx.textAlign = "left";
  ctx.fillText(`PLURSKY · YOUR FESTIVAL YEAR`, 72, 130);

  // Title
  ctx.fillStyle = "#f7ede0";
  ctx.font = "400 130px 'Instrument Serif', serif";
  ctx.fillText("That was", 72, 290);
  ctx.font = "italic 400 130px 'Instrument Serif', serif";
  ctx.fillStyle = "#f59a36";
  ctx.fillText(`your ${yd.year}.`, 72, 440);

  // 2x2 stats grid — festivals / sets / memories / hours
  const fmtHrs = (typeof _fmtHrsMin === "function")
    ? _fmtHrsMin
    : (m) => `${Math.round((m || 0) / 60)}h`;
  const cells = [
    { big: String(yd.totalFestivals), small: yd.totalFestivals === 1 ? "FESTIVAL" : "FESTIVALS" },
    { big: String(yd.totalSets),      small: "SETS CAUGHT" },
    { big: String(yd.totalMoments),   small: "MEMORIES" },
    { big: fmtHrs(yd.totalMin),       small: "ON DANCEFLOORS" },
  ];
  const gridTop = 560, cellH = 230, cellW = W / 2;
  cells.forEach((c, i) => {
    const col = i % 2, row = Math.floor(i / 2);
    const x = col * cellW + 72;
    const y = gridTop + row * cellH;
    ctx.fillStyle = "#f7ede0";
    ctx.font = "400 130px 'Instrument Serif', serif";
    ctx.fillText(c.big, x, y + 130);
    ctx.fillStyle = "rgba(247,237,224,0.65)";
    ctx.font = "700 22px 'Geist Mono', monospace";
    ctx.fillText(c.small, x, y + 175);
  });

  // Festival rows — accent rule + name + per-festival counts
  let fy = gridTop + cellH * 2 + 70;
  ctx.fillStyle = "rgba(247,237,224,0.7)";
  ctx.font = "700 22px 'Geist Mono', monospace";
  ctx.fillText("WHERE THE YEAR TOOK YOU", 72, fy);
  fy += 28;
  const rows = (yd.festivals || []).slice(0, 4);
  rows.forEach((f) => {
    ctx.fillStyle = "#f59a36";
    ctx.fillRect(72, fy + 14, 44, 5);
    ctx.fillStyle = "#f7ede0";
    ctx.font = "italic 400 62px 'Instrument Serif', serif";
    ctx.fillText(f.name || f.id, 140, fy + 62);
    ctx.fillStyle = "rgba(247,237,224,0.6)";
    ctx.font = "700 22px 'Geist Mono', monospace";
    ctx.fillText(`${f.sets} SETS · ${f.moments} MEMORIES`, 140, fy + 100);
    fy += 130;
  });
  if ((yd.festivals || []).length > 4) {
    ctx.fillStyle = "rgba(247,237,224,0.6)";
    ctx.font = "700 22px 'Geist Mono', monospace";
    ctx.fillText(`+ ${yd.festivals.length - 4} MORE`, 140, fy + 30);
    fy += 60;
  }

  // Top-artist pill rows (same flow layout as the weekend card's
  // headliner pills) — clamped above the watermark zone.
  if (yd.topArtists?.length) {
    let hy = Math.max(fy + 60, H - 420);
    ctx.fillStyle = "rgba(247,237,224,0.7)";
    ctx.font = "700 22px 'Geist Mono', monospace";
    ctx.fillText("YOUR ARTISTS OF THE YEAR", 72, hy);
    ctx.font = "700 28px 'Geist Mono', monospace";
    ctx.fillStyle = "#f7ede0";
    let lineY = hy + 60;
    let lineW = 0;
    yd.topArtists.slice(0, 6).forEach((a) => {
      if (lineY > H - 150) return; // keep clear of the watermark
      const text = "★ " + a.name.toUpperCase() + (a.count > 1 ? ` ×${a.count}` : "");
      const w = ctx.measureText(text).width + 40;
      if (lineW + w > W - 144) {
        lineY += 60;
        lineW = 0;
        if (lineY > H - 150) return;
      }
      ctx.fillText(text, 72 + lineW, lineY);
      lineW += w + 24;
    });
  }

  // Watermark — the free-tier differentiator, always on
  ctx.fillStyle = "rgba(247,237,224,0.55)";
  ctx.textAlign = "left";
  ctx.font = "700 26px 'Geist Mono', monospace";
  ctx.fillText("PLURSKY.COM", 72, H - 90);
  ctx.textAlign = "right";
  ctx.fillText(`FESTIVAL YEAR · ${yd.year}`, W - 72, H - 90);

  return canvas;
}

async function _shareFestivalYearCard(yd) {
  let canvas;
  try { canvas = await _renderFestivalYearCard(yd); }
  catch (e) { console.error("[plursky-year] render failed:", e); return false; }
  return _shareCanvasAsImage(canvas, {
    filename: `plursky-festival-year-${yd?.year || "recap"}.png`,
    title: `My ${yd?.year || ""} festival year`.trim(),
  });
}

// ── RECAP VIDEO ENGINE ──────────────────────────────────────────────
// Canvas-based frame sequencer → MediaRecorder (mp4 where supported —
// iOS WKWebView and IG/TikTok need it — webm otherwise). Beat-synced
// when audio is provided. Three templates: highlight, diary, ditl.
// Formats: "feed" 1080×1350 (default) or "story" 1080×1920 with
// IG-story safe margins + caught-song overlay.

// Best caught-song for a moment: Shazam-confirmed → live capture →
// setlist estimate (same sources useSetlistSong reads, minus the hook).
// Runs as an async pre-pass before video rendering so frames can draw
// it synchronously. Returns { title, confidence } or null.
async function _resolveMomentSong(m) {
  if (m?.confirmedSong && m?.confirmedTitle) return { title: m.confirmedTitle, confidence: "exact" };
  if (m?.songCapture?.song) return { title: m.songCapture.song, confidence: m.songCapture.source === "shazam" ? "exact" : "estimated" };
  const artist = m?.artistId ? (window.ARTISTS || []).find(a => a.id === m.artistId) : null;
  if (!artist || !m?.takenAt) return null;
  if (typeof _getTracklistForArtist !== "function" || typeof _matchSongAtTime !== "function") return null;
  try {
    const data = await _getTracklistForArtist(artist.name);
    if (!data) return null;
    const r = _matchSongAtTime(artist, data, m.takenAt);
    if (r?.song) return { title: r.song, confidence: r.confidence || "estimated" };
  } catch {}
  return null;
}

const _VIDEO_TEMPLATES = {
  highlight: { transition: "zoom", holdSec: 1.2, transitionSec: 0.3, fontStyle: "bold", order: "energy" },
  diary:     { transition: "crossfade", holdSec: 3.0, transitionSec: 0.8, fontStyle: "serif", order: "chronological" },
  ditl:      { transition: "slide", holdSec: 2.0, transitionSec: 0.5, fontStyle: "mono", order: "chronological" },
};

async function _detectBeats(audioUrl) {
  let actx;
  try {
    actx = new (window.AudioContext || window.webkitAudioContext)();
    const res = await fetch(audioUrl);
    const buf = await res.arrayBuffer();
    const audio = await actx.decodeAudioData(buf);
    const data = audio.getChannelData(0);
    const sr = audio.sampleRate;
    const windowSize = Math.floor(sr * 0.05);
    const energies = [];
    for (let i = 0; i < data.length - windowSize; i += windowSize) {
      let sum = 0;
      for (let j = 0; j < windowSize; j++) sum += data[i + j] * data[i + j];
      energies.push({ time: i / sr, energy: sum / windowSize });
    }
    const avgEnergy = energies.reduce((s, e) => s + e.energy, 0) / energies.length;
    const threshold = avgEnergy * 1.8;
    const beats = [];
    let lastBeat = -0.3;
    for (const e of energies) {
      if (e.energy > threshold && e.time - lastBeat > 0.25) {
        beats.push(e.time);
        lastBeat = e.time;
      }
    }
    return beats;
  } catch { return []; }
  finally { try { actx?.close(); } catch {} }
}

function _buildVideoTimeline(imgs, beats, duration, tmpl) {
  const timeline = [];
  const titleEnd = 2.5;
  const statsStart = duration - 5;
  const endCardStart = duration - 2;
  timeline.push({ start: 0, end: titleEnd, type: "title" });
  const photoWindow = statsStart - titleEnd;
  if (imgs.length === 0) {
    timeline.push({ start: titleEnd, end: statsStart, type: "empty" });
  } else if (beats && beats.length >= imgs.length) {
    const beatSlots = beats.filter(b => b >= titleEnd && b <= statsStart);
    let slotIdx = 0;
    for (let i = 0; i < imgs.length && slotIdx < beatSlots.length; i++) {
      const start = beatSlots[slotIdx];
      const end = slotIdx + 1 < beatSlots.length ? beatSlots[slotIdx + 1] : statsStart;
      timeline.push({ start, end, photo: imgs[i], transition: tmpl.transition });
      slotIdx++;
    }
  } else {
    const perPhoto = photoWindow / imgs.length;
    for (let i = 0; i < imgs.length; i++) {
      timeline.push({
        start: titleEnd + i * perPhoto,
        end: titleEnd + (i + 1) * perPhoto,
        photo: imgs[i],
        transition: tmpl.transition,
      });
    }
  }
  timeline.push({ start: statsStart, end: endCardStart, type: "stats" });
  timeline.push({ start: endCardStart, end: duration, type: "end" });
  return timeline;
}

function _renderVideoFrame(ctx, W, H, t, timeline, chrome, tmpl) {
  const CFG = window.FESTIVAL_CONFIG || {};
  const seg = timeline.find(s => t >= s.start && t < s.end) || timeline[timeline.length - 1];
  const segProgress = (t - seg.start) / (seg.end - seg.start);

  ctx.fillStyle = "#1a120d";
  ctx.fillRect(0, 0, W, H);

  if (seg.type === "title") {
    const fade = Math.min(1, segProgress * 2);
    ctx.globalAlpha = fade;
    ctx.fillStyle = chrome.accent || "#6D28D9";
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = "#fff";
    ctx.font = "italic 400 72px 'Instrument Serif', serif";
    ctx.textAlign = "center";
    ctx.fillText(chrome.title || "My Weekend", W / 2, H / 2 - 40);
    ctx.font = "700 18px 'Geist Mono', monospace";
    ctx.fillStyle = "rgba(255,255,255,0.7)";
    ctx.fillText(chrome.subtitle || (CFG.shortName || "FESTIVAL").toUpperCase(), W / 2, H / 2 + 20);
    ctx.font = "700 18px 'Geist Mono', monospace";
    ctx.fillStyle = "rgba(255,255,255,0.6)";
    ctx.fillText("MADE WITH PLURSKY", W / 2, H - 60 - (chrome.story ? 270 : 0));
    ctx.globalAlpha = 1;
    return;
  }

  if (seg.type === "stats") {
    const recap = chrome.recap || {};
    // Story format: push content below IG's top chrome (~250px at 1920).
    const oy = chrome.story ? 200 : 0;
    ctx.fillStyle = "#f7ede0";
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = "#1a120d";
    ctx.font = "italic 400 56px 'Instrument Serif', serif";
    ctx.textAlign = "center";
    ctx.fillText("The Numbers", W / 2, 200 + oy);
    ctx.font = "700 16px 'Geist Mono', monospace";
    ctx.fillStyle = "rgba(26,18,13,0.6)";
    const stats = [
      recap.setsCount ? `${recap.setsCount} SETS CAUGHT` : null,
      recap.stagesVisitedCount ? `${recap.stagesVisitedCount} STAGES VISITED` : null,
      recap.momentsCount ? `${recap.momentsCount} MEMORIES CAPTURED` : null,
      recap.topStage ? `TOP STAGE: ${recap.topStage.name?.toUpperCase()}` : null,
      recap.topGenre ? `TOP GENRE: ${recap.topGenre.toUpperCase()}` : null,
    ].filter(Boolean);
    stats.forEach((s, i) => {
      const staggerFade = Math.min(1, Math.max(0, (segProgress - i * 0.12) * 4));
      ctx.globalAlpha = staggerFade;
      ctx.fillText(s, W / 2, 300 + oy + i * 50);
    });
    ctx.globalAlpha = 1;
    return;
  }

  if (seg.type === "end") {
    ctx.fillStyle = chrome.accent || "#6D28D9";
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = "#fff";
    ctx.font = "italic 400 48px 'Instrument Serif', serif";
    ctx.textAlign = "center";
    ctx.fillText("plursky.com", W / 2, H / 2 - 10);
    ctx.font = "700 14px 'Geist Mono', monospace";
    ctx.fillStyle = "rgba(255,255,255,0.5)";
    ctx.fillText("YOUR FESTIVAL. YOUR STORY.", W / 2, H / 2 + 40);
    return;
  }

  if (seg.type === "empty" || !seg.photo) return;
  const { img, moment } = seg.photo;
  const artist = moment?.artistId ? (window.ARTISTS || []).find(a => a.id === moment.artistId) : null;
  const stage = artist ? (window.STAGES || []).find(s => s.id === artist.stage) : null;

  const transitionDur = tmpl.transitionSec || 0.3;
  const fadeIn = Math.min(1, segProgress * (seg.end - seg.start) / transitionDur);
  const fadeOut = Math.min(1, (1 - segProgress) * (seg.end - seg.start) / transitionDur);
  const alpha = Math.min(fadeIn, fadeOut);

  // W2: 3D parallax — foreground layer moves faster than background
  const kenBurnsZoom = 1 + 0.08 * segProgress;
  const parallaxFg = (segProgress - 0.5) * 30;
  const parallaxBg = (segProgress - 0.5) * 12;
  const panY = (segProgress - 0.5) * 8;

  ctx.save();
  ctx.globalAlpha = Math.max(0.01, alpha);
  const sc = Math.max(W / img.width, H / img.height) * kenBurnsZoom;
  const dw = img.width * sc, dh = img.height * sc;
  ctx.drawImage(img, (W - dw) / 2 + parallaxBg, (H - dh) / 2 + panY, dw, dh);

  if (_isPlusSub()) {
    ctx.globalAlpha = Math.max(0.01, alpha) * 0.15;
    const fgZoom = kenBurnsZoom * 1.03;
    const fgSc = Math.max(W / img.width, H / img.height) * fgZoom;
    const fgDw = img.width * fgSc, fgDh = img.height * fgSc;
    ctx.globalCompositeOperation = "screen";
    ctx.drawImage(img, (W - fgDw) / 2 + parallaxFg, (H - fgDh) / 2 + panY * 1.5, fgDw, fgDh);
    ctx.globalCompositeOperation = "source-over";
  }
  ctx.globalAlpha = 1;
  ctx.restore();

  // Caption band. Story (9:16) keeps text inside the IG-safe area — IG's
  // own chrome covers roughly the bottom 270px at 1080×1920 — so every
  // bottom-anchored element lifts by `safe`. The band extends to the
  // bottom edge so the lifted text never floats on bare photo.
  const safe = chrome.story ? 270 : 0;
  const song = seg.photo.song;
  const bandH = song ? 250 : 200;
  ctx.fillStyle = "rgba(0,0,0,0.35)";
  ctx.fillRect(0, H - bandH - safe, W, bandH + safe);

  if (artist) {
    ctx.fillStyle = "#fff";
    ctx.font = `italic 400 ${chrome.story ? 52 : 42}px 'Instrument Serif', serif`;
    ctx.textAlign = "left";
    ctx.fillText(artist.name, 60, H - safe - (song ? 170 : 120));
    if (song) {
      ctx.font = "700 22px 'Geist Mono', monospace";
      let st = song.title;
      while (ctx.measureText(`♫ ${st}…`).width > W - 140 && st.length > 6) st = st.slice(0, -2);
      if (st !== song.title) st += "…";
      ctx.fillStyle = "#f59a36";
      ctx.fillText(`♫ ${st}`, 60, H - safe - 115);
      if (song.confidence !== "exact") {
        ctx.fillStyle = "rgba(255,255,255,0.45)";
        ctx.font = "700 12px 'Geist Mono', monospace";
        ctx.fillText("SETLIST ESTIMATE", 60, H - safe - 88);
      }
    }
    if (stage) {
      ctx.fillStyle = stage.color || "rgba(255,255,255,0.7)";
      ctx.font = "700 14px 'Geist Mono', monospace";
      ctx.fillText(`${stage.name?.toUpperCase()} · ${artist.start || ""}`, 60, H - safe - (song ? 50 : 80));
    }
  }

  // Story export carries the Plursky watermark on every photo frame —
  // the free-tier differentiator stays visible when the clip leaves the app.
  if (chrome.story) {
    ctx.fillStyle = "rgba(255,255,255,0.6)";
    ctx.font = "700 17px 'Geist Mono', monospace";
    ctx.textAlign = "right";
    ctx.fillText("MADE WITH PLURSKY · PLURSKY.COM", W - 50, H - safe - 50);
    ctx.textAlign = "left";
  }

  // W4: Spotify listening overlay
  if (_isPlusSub() && artist) {
    const cache = window._spotifyArtistCache || {};
    const entry = cache[artist.name?.toLowerCase()];
    const playCount = entry?.playCount || entry?.topTrackPop;
    if (playCount) {
      const fadeOverlay = Math.min(1, Math.max(0, (segProgress - 0.2) * 3));
      ctx.globalAlpha = fadeOverlay * 0.9;
      ctx.fillStyle = "rgba(0,0,0,0.5)";
      const pillW = 320, pillH = 36, pillX = 60, pillY = 60;
      ctx.beginPath();
      ctx.roundRect(pillX, pillY, pillW, pillH, pillH / 2);
      ctx.fill();
      ctx.fillStyle = "#1DB954";
      ctx.font = "700 11px 'Geist Mono', monospace";
      ctx.textAlign = "left";
      ctx.fillText(`♫ YOU'VE PLAYED THIS ARTIST ${playCount}× ON SPOTIFY`, pillX + 16, pillY + 23);
      ctx.globalAlpha = 1;
    }
  }

  if (!_isPlusSub()) {
    ctx.save();
    ctx.translate(W / 2, H / 2);
    ctx.rotate(-Math.PI / 6);
    ctx.fillStyle = "rgba(255,255,255,0.15)";
    ctx.font = "700 48px 'Geist Mono', monospace";
    ctx.textAlign = "center";
    ctx.fillText("PLURSKY+", 0, 0);
    ctx.restore();
  }

  const progressY = chrome.story ? 140 : 30, progressR = 18;
  ctx.strokeStyle = "rgba(255,255,255,0.2)";
  ctx.lineWidth = 3;
  ctx.beginPath(); ctx.arc(W - 50, progressY + progressR, progressR, 0, Math.PI * 2); ctx.stroke();
  ctx.strokeStyle = "#fff";
  ctx.beginPath(); ctx.arc(W - 50, progressY + progressR, progressR, -Math.PI / 2, -Math.PI / 2 + (t / (timeline[timeline.length - 1]?.end || 15)) * Math.PI * 2); ctx.stroke();
}

async function _renderRecapVideo({ moments, audioUrl, template, title, subtitle, kicker, accent, avatars, totemUrl, recap, onProgress, format }) {
  const story = format === "story";
  const W = 1080, H = story ? 1920 : 1350, FPS = 30;
  const CFG = window.FESTIVAL_CONFIG || {};

  try {
    await document.fonts.load("italic 400 72px 'Instrument Serif'");
    await document.fonts.load("700 18px 'Geist Mono'");
  } catch {}

  const photoMoments = moments.filter(m => m.photoId && (m.kind === "image" || !m.kind)).slice(0, 12);
  const imgs = [];
  for (const m of photoMoments) {
    try {
      const blob = await _getPhoto(m.photoId);
      if (!blob) continue;
      const img = await new Promise(r => { const i = new Image(); i.onload = () => r(i); i.onerror = () => r(null); i.src = URL.createObjectURL(blob); });
      if (!img) continue;
      // Caught-song pre-pass — resolved up front so the frame loop stays sync.
      let song = null;
      try { song = await _resolveMomentSong(m); } catch {}
      imgs.push({ img, moment: m, song });
    } catch {}
  }
  if (!imgs.length) return null;

  let beats = audioUrl ? await _detectBeats(audioUrl) : [];
  const DURATION = audioUrl ? 30 : 15;
  const tmpl = _VIDEO_TEMPLATES[template || "highlight"] || _VIDEO_TEMPLATES.highlight;
  const timeline = _buildVideoTimeline(imgs, beats, DURATION, tmpl);

  const canvas = document.createElement("canvas");
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext("2d");

  if (typeof canvas.captureStream !== "function") return null;

  const stream = canvas.captureStream(FPS);
  let audioEl = null;
  if (audioUrl) {
    try {
      audioEl = new Audio();
      audioEl.crossOrigin = "anonymous";
      audioEl.src = audioUrl;
      await new Promise((r, j) => { audioEl.oncanplaythrough = r; audioEl.onerror = () => { audioEl = null; r(); }; });
      if (audioEl) {
        const actx = new (window.AudioContext || window.webkitAudioContext)();
        const src = actx.createMediaElementSource(audioEl);
        const dest = actx.createMediaStreamDestination();
        src.connect(dest);
        src.connect(actx.destination);
        for (const t of dest.stream.getAudioTracks()) stream.addTrack(t);
      }
    } catch { audioEl = null; }
  }

  const chrome = { title: title || "My Weekend", subtitle: subtitle || `${(CFG.shortName || "FESTIVAL").toUpperCase()} · ${CFG.dates || ""}`, accent: accent || "#1a120d", recap: recap || {}, story };
  const chunks = [];

  const cleanup = () => {
    try { stream.getTracks().forEach(t => t.stop()); } catch {}
    if (audioEl) { audioEl.pause(); audioEl.currentTime = 0; }
    canvas.width = 0; canvas.height = 0;
  };

  // mp4 first: iOS WKWebView's MediaRecorder has NO webm support (the old
  // hardcoded webm constructor threw there), and IG/TikTok only ingest mp4.
  // Chrome falls through to webm where mp4 recording isn't available.
  const mimeType = ["video/mp4;codecs=avc1", "video/mp4", "video/webm;codecs=vp9", "video/webm"]
    .find(t => { try { return MediaRecorder.isTypeSupported?.(t); } catch { return false; } }) || "video/webm";
  let recorder;
  try { recorder = new MediaRecorder(stream, { mimeType, videoBitsPerSecond: 4_000_000 }); }
  catch {
    try { recorder = new MediaRecorder(stream); }
    catch { cleanup(); return null; }
  }
  recorder.ondataavailable = e => { if (e.data.size > 0) chunks.push(e.data); };

  return new Promise((resolve) => {
    const TIMEOUT = (DURATION + 10) * 1000;
    const timer = setTimeout(() => {
      try { recorder.stop(); } catch {}
      cleanup();
      resolve(null);
    }, TIMEOUT);

    recorder.onstop = () => {
      clearTimeout(timer);
      cleanup();
      resolve(chunks.length ? new Blob(chunks, { type: recorder.mimeType || mimeType }) : null);
    };
    recorder.onerror = () => {
      clearTimeout(timer);
      cleanup();
      resolve(null);
    };
    recorder.start(100);
    if (audioEl) audioEl.play().catch(() => {});

    const t0 = performance.now();
    const tick = () => {
      const elapsed = (performance.now() - t0) / 1000;
      if (elapsed >= DURATION) {
        try { recorder.stop(); } catch {}
        return;
      }
      _renderVideoFrame(ctx, W, H, elapsed, timeline, chrome, tmpl);
      if (onProgress) onProgress(elapsed / DURATION);
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
}

function _videoProgress(show, pct) {
  let el = document.getElementById("plursky-video-progress");
  if (show && !el) {
    el = document.createElement("div");
    el.id = "plursky-video-progress";
    el.style.cssText = "position:fixed;inset:0;z-index:9999;display:flex;flex-direction:column;align-items:center;justify-content:center;background:rgba(10,6,24,0.92);backdrop-filter:blur(8px);";
    el.innerHTML = `
      <svg width="120" height="120" viewBox="0 0 120 120" style="margin-bottom:20px">
        <circle cx="60" cy="60" r="52" fill="none" stroke="rgba(255,255,255,0.08)" stroke-width="6"/>
        <circle id="vp-ring" cx="60" cy="60" r="52" fill="none" stroke="url(#vp-grad)" stroke-width="6"
          stroke-linecap="round" stroke-dasharray="326.7" stroke-dashoffset="326.7"
          transform="rotate(-90 60 60)" style="transition:stroke-dashoffset .3s"/>
        <defs><linearGradient id="vp-grad" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="#6D28D9"/><stop offset="100%" stop-color="#e85d2e"/>
        </linearGradient></defs>
        <text id="vp-pct" x="60" y="66" text-anchor="middle" fill="#fff"
          font-family="'Geist Mono',monospace" font-size="24" font-weight="700">0%</text>
      </svg>
      <div style="font-family:'Geist Mono',monospace;font-size:12px;letter-spacing:1.6px;font-weight:700;color:#fff;margin-bottom:6px">
        RENDERING YOUR RECAP
      </div>
      <div style="font-family:'Geist',sans-serif;font-size:12px;color:rgba(255,255,255,0.4)">
        Keep Plursky open while we create your video
      </div>
    `;
    document.body.appendChild(el);
  }
  if (el) {
    if (!show) { el.remove(); return; }
    const p = Math.round((pct || 0) * 100);
    const ring = el.querySelector("#vp-ring");
    const txt = el.querySelector("#vp-pct");
    if (ring) ring.setAttribute("stroke-dashoffset", String(326.7 * (1 - (pct || 0))));
    if (txt) txt.textContent = p + "%";
  }
}

async function _shareRecapVideo({ moments, audioUrl, template, title, subtitle, accent, recap, format }) {
  const gate = _canShare(); if (!gate.allowed) { _showShareLimitToast(); return false; }
  _videoProgress(true, 0);
  let blob;
  try {
    blob = await _renderRecapVideo({
      moments, audioUrl, template, title, subtitle, accent, recap, format,
      onProgress: (p) => _videoProgress(true, p),
    });
  } catch (e) { console.error("[plursky-video]", e); }
  _videoProgress(false);
  if (!blob) return false;

  try { window.plurskyHaptic?.("MEDIUM"); } catch {}
  const ext = /mp4/.test(blob.type || "") ? "mp4" : "webm";
  const filename = `plursky-recap${format === "story" ? "-story" : ""}.${ext}`;
  const file = new File([blob], filename, { type: blob.type });
  const sheetTitle = `My ${window.FESTIVAL_CONFIG?.shortName || "festival"} recap`;

  const capShare = window.Capacitor?.Plugins?.Share;
  if (capShare?.share && window.Capacitor?.isNativePlatform?.()) {
    try {
      const dataUrl = await new Promise((resolve, reject) => {
        const r = new FileReader(); r.onload = () => resolve(r.result); r.onerror = reject; r.readAsDataURL(blob);
      });
      await capShare.share({ title: sheetTitle, files: [dataUrl] });
      return true;
    } catch (e) { if (e?.message && !/cancel|abort/i.test(e.message)) console.warn("[plursky-share]", e.message); }
  }
  if (navigator.share && typeof navigator.canShare === "function" && navigator.canShare({ files: [file] })) {
    try { await navigator.share({ files: [file], title: sheetTitle }); return true; }
    catch (e) { if (e?.name === "AbortError") return false; }
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  return true;
}

// GIF support — lazy-loaded on first use so gif.js is never fetched
// unless someone taps a GIF button.
let _gifWorkerBlobUrl = null;
async function _ensureGifJs() {
  if (window.GIF) return;
  await new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = "https://cdn.jsdelivr.net/npm/gif.js@0.2.0/dist/gif.js";
    s.onload = resolve;
    s.onerror = () => reject(new Error("Failed to load gif.js"));
    document.head.appendChild(s);
  });
  if (!_gifWorkerBlobUrl) {
    const res = await fetch("https://cdn.jsdelivr.net/npm/gif.js@0.2.0/dist/gif.worker.js");
    const text = await res.text();
    _gifWorkerBlobUrl = URL.createObjectURL(new Blob([text], { type: "application/javascript" }));
  }
}

function _gifProgress(show) {
  let el = document.getElementById("plursky-gif-progress");
  if (show && !el) {
    el = document.createElement("div");
    el.id = "plursky-gif-progress";
    el.style.cssText = "position:fixed;top:0;left:0;right:0;z-index:9999;padding:12px 20px;text-align:center;font-family:'Geist Mono',monospace;font-size:11px;letter-spacing:1.4px;font-weight:700;color:#fff;background:linear-gradient(135deg,#6D28D9,#e85d2e);";
    el.textContent = "⏳ CREATING GIF…";
    document.body.appendChild(el);
  } else if (!show && el) {
    el.remove();
  }
}

async function _renderCollageGif({ title, subtitle, kicker, accent, moments, avatars, totemUrl }) {
  await _ensureGifJs();
  const W = 540, H = 675;
  const CFG = window.FESTIVAL_CONFIG || {};

  try {
    await document.fonts.load("italic 400 42px 'Instrument Serif'");
    await document.fonts.load("700 11px 'Geist Mono'");
  } catch {}

  let totemImg = null;
  if (totemUrl) {
    try { totemImg = await new Promise(r => { const i = new Image(); i.onload = () => r(i); i.onerror = () => r(null); i.src = totemUrl; }); } catch {}
  }

  const photoMoments = moments.filter(m => m.photoId && (m.kind === "image" || !m.kind)).slice(0, 6);
  const imgs = [];
  for (const m of photoMoments) {
    try {
      const blob = await _getPhoto(m.photoId);
      if (!blob) continue;
      const img = await new Promise(r => { const i = new Image(); i.onload = () => r(i); i.onerror = () => r(null); i.src = URL.createObjectURL(blob); });
      if (img) imgs.push(img);
    } catch {}
  }
  if (!imgs.length) return null;

  const c = document.createElement("canvas");
  c.width = W; c.height = H;
  const ctx = c.getContext("2d");
  const hH = 115, fH = 55, mT = hH, mH = H - hH - fH;

  const drawChrome = () => {
    ctx.fillStyle = accent || "#1a120d";
    ctx.fillRect(0, 0, W, hH);
    const tL = totemImg ? 100 : 30;
    if (totemImg) {
      const tR = 30, tCx = 60, tCy = hH / 2;
      ctx.save();
      ctx.beginPath(); ctx.arc(tCx, tCy, tR, 0, Math.PI * 2); ctx.clip();
      const ts = Math.max(tR * 2 / totemImg.width, tR * 2 / totemImg.height);
      ctx.drawImage(totemImg, tCx - totemImg.width * ts / 2, tCy - totemImg.height * ts / 2, totemImg.width * ts, totemImg.height * ts);
      ctx.restore();
      ctx.strokeStyle = "rgba(255,255,255,0.5)"; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.arc(tCx, tCy, tR, 0, Math.PI * 2); ctx.stroke();
    }
    ctx.fillStyle = "rgba(255,255,255,0.78)";
    ctx.font = "700 11px 'Geist Mono', monospace";
    ctx.textAlign = "left";
    ctx.fillText(kicker || `PLURSKY · ${(CFG.shortName || CFG.name || "FESTIVAL").toUpperCase()}`, tL, 40);
    ctx.fillStyle = "#fff";
    ctx.font = "italic 400 42px 'Instrument Serif', serif";
    let safe = title || "Memories";
    while (ctx.measureText(safe).width > W - tL - 30 && safe.length > 4) safe = safe.slice(0, -2);
    if (safe !== (title || "Memories")) safe = safe.slice(0, -1) + "…";
    ctx.fillText(safe, tL, 85);
    if (subtitle) {
      ctx.fillStyle = "rgba(255,255,255,0.88)";
      ctx.font = "700 9px 'Geist Mono', monospace";
      ctx.fillText(subtitle, tL, 105);
    }
    ctx.fillStyle = "#1a120d";
    ctx.fillRect(0, H - fH, W, fH);
    let ftx = 30;
    if (avatars && avatars.length > 0) {
      const avR = 8, avStep = 11, cy = H - fH / 2;
      const avN = Math.min(avatars.length, 8);
      for (let ai = avN - 1; ai >= 0; ai--) {
        const cx = 30 + avR + ai * avStep;
        ctx.fillStyle = "#1a120d";
        ctx.beginPath(); ctx.arc(cx, cy, avR + 1, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = avatars[ai].color || "#7b3d9a";
        ctx.beginPath(); ctx.arc(cx, cy, avR, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = "#fff";
        ctx.font = "700 7px 'Geist Mono', monospace";
        ctx.textAlign = "center"; ctx.textBaseline = "middle";
        ctx.fillText((avatars[ai].initial || "?")[0], cx, cy + 1);
      }
      ftx = 30 + avR * 2 + (avN - 1) * avStep + 8;
      ctx.textBaseline = "alphabetic";
    }
    ctx.fillStyle = "#f7ede0";
    ctx.textAlign = "left";
    ctx.font = "700 11px 'Geist Mono', monospace";
    ctx.fillText("MADE WITH PLURSKY", ftx, H - 27);
    ctx.fillStyle = "rgba(247,237,224,0.7)";
    ctx.font = "italic 400 12px 'Instrument Serif', serif";
    ctx.textAlign = "right";
    ctx.fillText("plursky.com", W - 30, H - 27);
  };

  const drawPhoto = (img, zoom, panX, panY, alpha) => {
    ctx.save();
    ctx.beginPath(); ctx.rect(0, mT, W, mH); ctx.clip();
    if (alpha < 1) ctx.globalAlpha = alpha;
    const sc = Math.max(W / img.width, mH / img.height) * zoom;
    const dw = img.width * sc, dh = img.height * sc;
    ctx.drawImage(img, (W - dw) / 2 + panX, mT + (mH - dh) / 2 + panY, dw, dh);
    ctx.globalAlpha = 1;
    ctx.restore();
  };

  const gif = new GIF({ workers: 2, quality: 10, width: W, height: H, workerScript: _gifWorkerBlobUrl });

  for (let i = 0; i < imgs.length; i++) {
    const dir = i % 2 === 0 ? 1 : -1;
    for (let f = 0; f < 2; f++) {
      ctx.fillStyle = "#f7ede0"; ctx.fillRect(0, 0, W, H);
      drawChrome();
      drawPhoto(imgs[i], 1 + 0.06 * f, dir * f * 8, -f * 4, 1);
      if (!_isPlusSub()) { ctx.save(); ctx.translate(W/2, mT + mH/2); ctx.rotate(-Math.PI/6); ctx.fillStyle = "rgba(255,255,255,0.18)"; ctx.font = "700 32px 'Geist Mono', monospace"; ctx.textAlign = "center"; ctx.fillText("PLURSKY+", 0, 0); ctx.restore(); }
      gif.addFrame(ctx, { copy: true, delay: 500 });
    }
    if (imgs.length > 1) {
      const next = imgs[(i + 1) % imgs.length];
      ctx.fillStyle = "#f7ede0"; ctx.fillRect(0, 0, W, H);
      drawChrome();
      drawPhoto(imgs[i], 1.06, dir * 8, -4, 0.35);
      drawPhoto(next, 1, 0, 0, 0.65);
      if (!_isPlusSub()) { ctx.save(); ctx.translate(W/2, mT + mH/2); ctx.rotate(-Math.PI/6); ctx.fillStyle = "rgba(255,255,255,0.18)"; ctx.font = "700 32px 'Geist Mono', monospace"; ctx.textAlign = "center"; ctx.fillText("PLURSKY+", 0, 0); ctx.restore(); }
      gif.addFrame(ctx, { copy: true, delay: 250 });
    }
  }

  return new Promise((resolve) => {
    const timer = setTimeout(() => { try { gif.abort(); } catch {} resolve(null); }, 30000);
    gif.on("finished", (blob) => { clearTimeout(timer); resolve(blob); });
    gif.on("error", () => { clearTimeout(timer); resolve(null); });
    try { gif.render(); } catch { clearTimeout(timer); resolve(null); }
  });
}

// Generic shareable collage. Same renderer underlies the per-artist,
// per-stage, per-night, and weekend collages — only title/subtitle/
// kicker/accent/moments change. 1080×1350 = Instagram 4:5, also reads
// as a Story since the safe area is centered.
async function _renderCollage({ title, subtitle, kicker, accent, moments, avatars, totemUrl }) {
  const W = 1080, H = 1350;
  const canvas = document.createElement("canvas");
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext("2d");
  const CFG = window.FESTIVAL_CONFIG || {};

  try {
    await document.fonts.load("400 96px 'Instrument Serif'");
    await document.fonts.load("italic 400 80px 'Instrument Serif'");
    await document.fonts.load("700 20px 'Geist Mono'");
  } catch {}

  let totemImg = null;
  if (totemUrl) {
    try {
      totemImg = await new Promise(r => { const i = new Image(); i.onload = () => r(i); i.onerror = () => r(null); i.src = totemUrl; });
    } catch {}
  }

  ctx.fillStyle = "#f7ede0";
  ctx.fillRect(0, 0, W, H);

  // Accent-colored header band
  const headerH = 230;
  ctx.fillStyle = accent || "#1a120d";
  ctx.fillRect(0, 0, W, headerH);

  const textLeft = totemImg ? 200 : 60;

  if (totemImg) {
    const tR = 60, tCx = 120, tCy = headerH / 2;
    ctx.save();
    ctx.beginPath(); ctx.arc(tCx, tCy, tR, 0, Math.PI * 2); ctx.clip();
    const ts = Math.max(tR * 2 / totemImg.width, tR * 2 / totemImg.height);
    ctx.drawImage(totemImg, tCx - totemImg.width * ts / 2, tCy - totemImg.height * ts / 2, totemImg.width * ts, totemImg.height * ts);
    ctx.restore();
    ctx.strokeStyle = "rgba(255,255,255,0.5)";
    ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(tCx, tCy, tR, 0, Math.PI * 2); ctx.stroke();
  }

  ctx.fillStyle = "rgba(255,255,255,0.78)";
  ctx.font = "700 22px 'Geist Mono', monospace";
  ctx.textAlign = "left";
  ctx.fillText(kicker || `PLURSKY · ${(CFG.shortName || CFG.name || "FESTIVAL").toUpperCase()}`, textLeft, 80);
  ctx.fillStyle = "#fff";
  ctx.font = "italic 400 84px 'Instrument Serif', serif";
  let safeTitle = title || "Memories";
  const maxTitleW = W - textLeft - 60;
  while (ctx.measureText(safeTitle).width > maxTitleW && safeTitle.length > 4) {
    safeTitle = safeTitle.slice(0, -2);
  }
  if (safeTitle !== (title || "Memories")) safeTitle = safeTitle.slice(0, -1) + "…";
  ctx.fillText(safeTitle, textLeft, 170);
  if (subtitle) {
    ctx.fillStyle = "rgba(255,255,255,0.88)";
    ctx.font = "700 18px 'Geist Mono', monospace";
    ctx.fillText(subtitle, textLeft, 210);
  }

  // Photo mosaic area (between header + footer)
  const footerH = 110;
  const mosaicTop = headerH;
  const mosaicH = H - headerH - footerH;
  const mosaicW = W;
  const gap = 8;

  // Pull image blobs from IDB (filter out videos for v1 — video frames
  // require seeking + decode, deferred to v1.5 video recap).
  const photoMoments = moments.filter(m => m.photoId && (m.kind === "image" || !m.kind)).slice(0, 6);
  const imgs = await Promise.all(photoMoments.map(async (m) => {
    try {
      const blob = await _getPhoto(m.photoId);
      if (!blob) return null;
      return await new Promise((resolve) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = () => resolve(null);
        img.src = URL.createObjectURL(blob);
      });
    } catch { return null; }
  }));
  const valid = imgs.filter(Boolean);
  const n = valid.length;

  // Layout grid by count — each entry is [x, y, w, h] inside the mosaic
  let cells;
  if (n === 0)       cells = [];
  else if (n === 1)  cells = [[0, 0, mosaicW, mosaicH]];
  else if (n === 2)  cells = [[0, 0, mosaicW/2, mosaicH], [mosaicW/2, 0, mosaicW/2, mosaicH]];
  else if (n === 3)  cells = [[0, 0, mosaicW*0.6, mosaicH], [mosaicW*0.6, 0, mosaicW*0.4, mosaicH/2], [mosaicW*0.6, mosaicH/2, mosaicW*0.4, mosaicH/2]];
  else if (n === 4)  cells = [[0, 0, mosaicW/2, mosaicH/2], [mosaicW/2, 0, mosaicW/2, mosaicH/2], [0, mosaicH/2, mosaicW/2, mosaicH/2], [mosaicW/2, mosaicH/2, mosaicW/2, mosaicH/2]];
  else { // 5 or 6 — 3 across, 2 rows
    const cw = mosaicW / 3, ch = mosaicH / 2;
    cells = [
      [0, 0, cw, ch], [cw, 0, cw, ch], [cw*2, 0, cw, ch],
      [0, ch, cw, ch], [cw, ch, cw, ch], [cw*2, ch, cw, ch],
    ].slice(0, n);
  }

  // Draw each photo cover-fit into its cell
  valid.forEach((img, i) => {
    const [x, y, w, h] = cells[i];
    const ix = x + gap/2, iy = mosaicTop + y + gap/2;
    const iw = w - gap, ih = h - gap;
    const scale = Math.max(iw / img.width, ih / img.height);
    const dw = img.width * scale;
    const dh = img.height * scale;
    const dx = ix - (dw - iw) / 2;
    const dy = iy - (dh - ih) / 2;
    ctx.save();
    ctx.beginPath();
    ctx.rect(ix, iy, iw, ih);
    ctx.clip();
    ctx.drawImage(img, dx, dy, dw, dh);
    ctx.restore();
  });

  // Empty state — collage requested but no photos in IDB
  if (n === 0) {
    ctx.fillStyle = "rgba(26,18,13,0.45)";
    ctx.font = "italic 400 52px 'Instrument Serif', serif";
    ctx.textAlign = "center";
    ctx.fillText("No photos yet from this set", W/2, mosaicTop + mosaicH/2);
  }

  // Watermark for free tier
  if (n > 0 && !_isPlusSub()) {
    ctx.save();
    ctx.translate(W / 2, mosaicTop + mosaicH / 2);
    ctx.rotate(-Math.PI / 6);
    ctx.fillStyle = "rgba(255,255,255,0.18)";
    ctx.font = "700 64px 'Geist Mono', monospace";
    ctx.textAlign = "center";
    ctx.fillText("PLURSKY+", 0, 0);
    ctx.restore();
  }

  // Footer band — branding + count + optional crew avatars
  ctx.fillStyle = "#1a120d";
  ctx.fillRect(0, H - footerH, W, footerH);
  let footerTextX = 60;
  if (avatars && avatars.length > 0) {
    const avR = 15, avStep = 22, centerY = H - footerH / 2;
    const avCount = Math.min(avatars.length, 8);
    for (let ai = avCount - 1; ai >= 0; ai--) {
      const cx = 60 + avR + ai * avStep;
      ctx.fillStyle = "#1a120d";
      ctx.beginPath(); ctx.arc(cx, centerY, avR + 2, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = avatars[ai].color || "#7b3d9a";
      ctx.beginPath(); ctx.arc(cx, centerY, avR, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = "#fff";
      ctx.font = "700 13px 'Geist Mono', monospace";
      ctx.textAlign = "center"; ctx.textBaseline = "middle";
      ctx.fillText((avatars[ai].initial || "?")[0], cx, centerY + 1);
    }
    footerTextX = 60 + avR * 2 + (avCount - 1) * avStep + 16;
    ctx.textBaseline = "alphabetic";
  }
  ctx.fillStyle = "#f7ede0";
  ctx.textAlign = "left";
  ctx.font = "700 22px 'Geist Mono', monospace";
  ctx.fillText(`MADE WITH PLURSKY · ${n} MOMENT${n === 1 ? "" : "S"}`, footerTextX, H - 55);
  ctx.fillStyle = "rgba(247,237,224,0.7)";
  ctx.font = "italic 400 24px 'Instrument Serif', serif";
  ctx.textAlign = "right";
  ctx.fillText("plursky.com", W - 60, H - 55);

  return canvas;
}

// Generic share helper. Renders + shares + downloads-on-fallback. The
// per-{artist,stage,night,weekend} wrappers below just feed this their
// specific title/subtitle/accent.
async function _shareCollage({ title, subtitle, kicker, accent, moments, avatars, totemUrl, filenameSlug, shareTitle, format }) {
  const gate = _canShare();
  if (!gate.allowed) { _showShareLimitToast(); return false; }
  const customAccent = _getCustomAccent();
  if (customAccent) accent = customAccent;
  let blob;
  if (format === "gif") {
    _gifProgress(true);
    try {
      blob = await _renderCollageGif({ title, subtitle, kicker, accent, moments, avatars, totemUrl });
    } catch (e) { console.error("[plursky-collage] gif render failed:", e); }
    _gifProgress(false);
    if (!blob) return false;
  } else {
    let canvas;
    try {
      canvas = await _renderCollage({ title, subtitle, kicker, accent, moments, avatars, totemUrl });
    } catch (e) { console.error("[plursky-collage] render failed:", e); return false; }
    blob = await new Promise(r => canvas.toBlob(r, "image/png"));
    if (!blob) return false;
  }
  try { window.plurskyHaptic?.("LIGHT"); } catch {}
  _incShareCount();
  const isGif = format === "gif";
  const slug = (filenameSlug || title || "set").toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 32);
  const filename = `plursky-${slug}.${isGif ? "gif" : "png"}`;
  const file = new File([blob], filename, { type: isGif ? "image/gif" : "image/png" });
  const sheetTitle = shareTitle || `${title} at ${window.FESTIVAL_CONFIG?.shortName || "the festival"}`;

  const capShare = window.Capacitor?.Plugins?.Share;
  if (capShare?.share && window.Capacitor?.isNativePlatform?.()) {
    try {
      const dataUrl = await new Promise((resolve, reject) => {
        const r = new FileReader();
        r.onload = () => resolve(r.result);
        r.onerror = reject;
        r.readAsDataURL(blob);
      });
      await capShare.share({ title: sheetTitle, files: [dataUrl] });
      return true;
    } catch (e) {
      if (e?.message && !/cancel|abort/i.test(e.message)) console.warn("[plursky-share]", e.message);
    }
  }
  if (navigator.share && typeof navigator.canShare === "function" && navigator.canShare({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: sheetTitle });
      return true;
    } catch (e) {
      if (e?.name === "AbortError") return false;
    }
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  return true;
}

// Per-{artist, stage, night, weekend} share entry points. Each computes
// the right title/subtitle/accent + filters moments before delegating to
// _shareCollage. All exposed via window so any screen can call them.

async function _shareArtistCollage(artist, moments, format) {
  const stage = (window.STAGES || []).find(s => s.id === artist.stage) || {};
  const CFG = window.FESTIVAL_CONFIG || {};
  const dayShort = CFG.dayDates?.[artist.day]?.short || `DAY ${artist.day}`;
  return _shareCollage({
    title:    artist.name,
    subtitle: `${(stage.name || "").toUpperCase()} · ${dayShort.toUpperCase()} · ${artist.start}–${artist.end}`,
    accent:   stage.color || "#1a120d",
    moments,
    filenameSlug: artist.name,
    shareTitle:   `${artist.name} at ${CFG.shortName || "the festival"}`,
    format,
  });
}

async function _shareStageCollage(stage, momentsAcrossArtists, format) {
  const CFG = window.FESTIVAL_CONFIG || {};
  return _shareCollage({
    title:    stage.name,
    subtitle: `MY NIGHTS AT ${stage.short || stage.name?.toUpperCase()}`,
    accent:   stage.color || "#1a120d",
    moments:  momentsAcrossArtists,
    filenameSlug: `stage-${stage.short || stage.id}`,
    shareTitle:   `My ${stage.name} at ${CFG.shortName || "the festival"}`,
    format,
  });
}

async function _shareNightCollage(night, momentsForNight, format) {
  const CFG = window.FESTIVAL_CONFIG || {};
  const di = CFG.dayDates?.[night] || {};
  return _shareCollage({
    title:    di.name || `Night ${night}`,
    subtitle: `${(CFG.shortName || CFG.name || "FESTIVAL").toUpperCase()} · ${(di.short || `DAY ${night}`).toUpperCase()}`,
    accent:   "#e85d2e",
    moments:  momentsForNight,
    filenameSlug: `night-${night}`,
    shareTitle:   `My ${di.name || "festival night"} at ${CFG.shortName || "the festival"}`,
    format,
  });
}

async function _shareWeekendCollage(allMoments, format) {
  const CFG = window.FESTIVAL_CONFIG || {};
  const tagged   = allMoments.filter(m => m.artistId);
  const untagged = allMoments.filter(m => !m.artistId);
  const pool = tagged.length >= 6 ? tagged : [...tagged, ...untagged];
  const byNight = new Map();
  for (const m of pool) {
    if (!byNight.has(m.night)) byNight.set(m.night, []);
    byNight.get(m.night).push(m);
  }
  const picked = [];
  const nights = [...byNight.keys()].sort((a, b) => a - b);
  while (picked.length < 6 && nights.some(n => byNight.get(n).length > 0)) {
    for (const n of nights) {
      const arr = byNight.get(n);
      if (arr.length > 0) picked.push(arr.shift());
      if (picked.length >= 6) break;
    }
  }
  return _shareCollage({
    title:    "My Weekend",
    subtitle: `${(CFG.shortName || CFG.name || "FESTIVAL").toUpperCase()} · ${CFG.dates || ""}`,
    accent:   "#1a120d",
    moments:  picked,
    filenameSlug: `weekend-${CFG.id || "festival"}`,
    shareTitle:   `My ${CFG.shortName || "festival weekend"}`,
    format,
  });
}

async function _shareCrewCollage({ crewNames, avatars, crewArtistIds, overlapIds, format, totemUrl }) {
  const CFG = window.FESTIVAL_CONFIG || {};
  const all = [];
  try {
    const raw = JSON.parse(localStorage.getItem("plursky_moments_v1") || "{}");
    // Scope to the active festival so a crew collage doesn't mix EDC + ACL.
    const scoped = (typeof _activeMoments === "function") ? _activeMoments(raw) : raw;
    for (const k of Object.keys(scoped)) for (const m of (scoped[k] || [])) all.push(m);
  } catch {}

  const overlapSet = new Set(overlapIds || []);
  const crewSet = new Set(crewArtistIds || []);
  const overlapMoments = all.filter(m => m.artistId && overlapSet.has(m.artistId));
  const crewMoments = all.filter(m => m.artistId && crewSet.has(m.artistId));
  const pool = overlapMoments.length >= 6 ? overlapMoments : crewMoments.length > 0 ? crewMoments : all;

  const tagged = pool.filter(m => m.artistId);
  const untagged = pool.filter(m => !m.artistId);
  const source = tagged.length >= 6 ? tagged : [...tagged, ...untagged];
  const byNight = new Map();
  for (const m of source) {
    if (!byNight.has(m.night)) byNight.set(m.night, []);
    byNight.get(m.night).push(m);
  }
  const picked = [];
  const nights = [...byNight.keys()].sort((a, b) => a - b);
  while (picked.length < 6 && nights.some(n => byNight.get(n).length > 0)) {
    for (const n of nights) {
      const arr = byNight.get(n);
      if (arr.length > 0) picked.push(arr.shift());
      if (picked.length >= 6) break;
    }
  }

  let subtitle = (crewNames || []).map(n => n.toUpperCase()).join(" · ");
  if (subtitle.length > 55) subtitle = `${crewNames.length} CREW · ${(overlapIds || []).length} SETS IN COMMON`;

  return _shareCollage({
    title: "Our Weekend",
    subtitle,
    kicker: `PLURSKY · ${(CFG.shortName || CFG.name || "FESTIVAL").toUpperCase()} · CREW`,
    accent: "#6D28D9",
    moments: picked,
    avatars,
    totemUrl,
    filenameSlug: `crew-${CFG.id || "festival"}`,
    shareTitle: `Our crew's weekend at ${CFG.shortName || "the festival"}`,
    format,
  });
}

// ── WOW FEATURES (Plursky+ exclusive) ──────────────────────────────

// W1: Festival DNA — unique color barcode from your weekend's photos
async function _renderFestivalDNA(moments) {
  const photoMoments = moments.filter(m => m.photoId && (m.kind === "image" || !m.kind)).slice(0, 20);
  const colors = [];
  for (const m of photoMoments) {
    try {
      const blob = await _getPhoto(m.photoId);
      if (!blob) continue;
      const img = await new Promise(r => { const i = new Image(); i.onload = () => r(i); i.onerror = () => r(null); i.src = URL.createObjectURL(blob); });
      if (!img) continue;
      const tc = document.createElement("canvas");
      tc.width = 32; tc.height = 32;
      const tctx = tc.getContext("2d");
      tctx.drawImage(img, 0, 0, 32, 32);
      const d = tctx.getImageData(0, 0, 32, 32).data;
      let rSum = 0, gSum = 0, bSum = 0;
      for (let i = 0; i < d.length; i += 4) { rSum += d[i]; gSum += d[i+1]; bSum += d[i+2]; }
      const px = d.length / 4;
      colors.push(`rgb(${Math.round(rSum/px)},${Math.round(gSum/px)},${Math.round(bSum/px)})`);
    } catch {}
  }
  if (!colors.length) return null;

  const W = 1080, H = 1350;
  const CFG = window.FESTIVAL_CONFIG || {};
  const c = document.createElement("canvas"); c.width = W; c.height = H;
  const ctx = c.getContext("2d");

  try { await document.fonts.load("italic 400 72px 'Instrument Serif'"); await document.fonts.load("700 16px 'Geist Mono'"); } catch {}

  ctx.fillStyle = "#1a120d"; ctx.fillRect(0, 0, W, H);

  const stripY = 320, stripH = 600;
  const barW = W / colors.length;
  colors.forEach((c, i) => { ctx.fillStyle = c; ctx.fillRect(i * barW, stripY, barW + 1, stripH); });

  ctx.fillStyle = "rgba(26,18,13,0.3)";
  ctx.fillRect(0, stripY, W, 2);
  ctx.fillRect(0, stripY + stripH - 2, W, 2);

  ctx.fillStyle = "#f7ede0";
  ctx.font = "italic 400 72px 'Instrument Serif', serif";
  ctx.textAlign = "center";
  ctx.fillText("Festival DNA", W/2, 160);
  ctx.font = "700 16px 'Geist Mono', monospace";
  ctx.fillStyle = "rgba(247,237,224,0.5)";
  ctx.fillText(`${(CFG.shortName || "FESTIVAL").toUpperCase()} · ${colors.length} MOMENTS · YOUR UNIQUE PALETTE`, W/2, 210);

  if (!_isPlusSub()) {
    ctx.save(); ctx.translate(W/2, stripY + stripH/2); ctx.rotate(-Math.PI/6);
    ctx.fillStyle = "rgba(247,237,224,0.2)"; ctx.font = "700 64px 'Geist Mono', monospace"; ctx.textAlign = "center";
    ctx.fillText("PLURSKY+", 0, 0); ctx.restore();
  }
  ctx.fillStyle = "rgba(247,237,224,0.5)";
  ctx.font = "700 14px 'Geist Mono', monospace";
  ctx.fillText("MADE WITH PLURSKY+", W/2, H - 80);
  ctx.fillStyle = "rgba(247,237,224,0.65)";
  ctx.font = "italic 400 20px 'Instrument Serif', serif";
  ctx.fillText("plursky.com", W/2, H - 50);

  return c;
}

async function _shareFestivalDNA(moments) {
  const gate = _canShare(); if (!gate.allowed) { _showShareLimitToast(); return false; }
  const c = await _renderFestivalDNA(moments);
  if (!c) return false;
  const blob = await new Promise(r => c.toBlob(r, "image/png"));
  if (!blob) return false;
  try { window.plurskyHaptic?.("MEDIUM"); } catch {}
  _incShareCount();
  const file = new File([blob], "plursky-festival-dna.png", { type: "image/png" });
  const sheetTitle = `My Festival DNA — ${window.FESTIVAL_CONFIG?.shortName || "festival"}`;
  if (navigator.share && typeof navigator.canShare === "function" && navigator.canShare({ files: [file] })) {
    try { await navigator.share({ files: [file], title: sheetTitle }); return true; } catch {}
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a"); a.href = url; a.download = "plursky-festival-dna.png";
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  return true;
}

// W3: Festival Passport — stamped stage card
async function _renderFestivalPassport(state) {
  const W = 1080, H = 1350;
  const CFG = window.FESTIVAL_CONFIG || {};
  const c = document.createElement("canvas"); c.width = W; c.height = H;
  const ctx = c.getContext("2d");

  try { await document.fonts.load("italic 400 56px 'Instrument Serif'"); await document.fonts.load("700 14px 'Geist Mono'"); } catch {}

  ctx.fillStyle = "#f7ede0"; ctx.fillRect(0, 0, W, H);
  ctx.strokeStyle = "rgba(26,18,13,0.15)"; ctx.lineWidth = 2;
  ctx.strokeRect(40, 40, W - 80, H - 80);
  ctx.strokeRect(50, 50, W - 100, H - 100);

  ctx.fillStyle = "#1a120d";
  ctx.font = "italic 400 56px 'Instrument Serif', serif";
  ctx.textAlign = "center";
  ctx.fillText("Festival Passport", W/2, 140);
  ctx.font = "700 14px 'Geist Mono', monospace";
  ctx.fillStyle = "rgba(26,18,13,0.4)";
  ctx.fillText(`${(CFG.shortName || "FESTIVAL").toUpperCase()} · ${CFG.dates || "2026"}`, W/2, 180);

  const attended = [];
  try {
    const raw = JSON.parse(localStorage.getItem("plursky_attended_v1") || "{}");
    for (const [id, v] of Object.entries(raw)) { if (v) attended.push(id); }
  } catch {}

  const stages = window.STAGES || [];
  const artists = window.ARTISTS || [];
  const stageStats = new Map();
  for (const aid of attended) {
    const a = artists.find(x => x.id === aid);
    if (!a) continue;
    const s = stages.find(x => x.id === a.stage);
    if (!s) continue;
    if (!stageStats.has(s.id)) stageStats.set(s.id, { stage: s, count: 0 });
    stageStats.get(s.id).count++;
  }

  const sorted = [...stageStats.values()].sort((a, b) => b.count - a.count);
  const setsTotal = attended.length;
  const badge = setsTotal >= 20 ? "FESTIVAL VETERAN" : setsTotal >= 10 ? "WEEKEND WARRIOR" : setsTotal >= 5 ? "EXPLORER" : "FIRST TIMER";

  ctx.save();
  ctx.translate(W/2, 260);
  ctx.strokeStyle = setsTotal >= 20 ? "#e85d2e" : setsTotal >= 10 ? "#6D28D9" : "#2d7a55";
  ctx.lineWidth = 3;
  ctx.beginPath(); ctx.arc(0, 0, 40, 0, Math.PI * 2); ctx.stroke();
  ctx.beginPath(); ctx.arc(0, 0, 34, 0, Math.PI * 2); ctx.stroke();
  ctx.fillStyle = ctx.strokeStyle;
  ctx.font = "700 10px 'Geist Mono', monospace";
  ctx.textAlign = "center"; ctx.textBaseline = "middle";
  ctx.fillText(badge, 0, 0);
  ctx.restore();

  ctx.font = "700 11px 'Geist Mono', monospace";
  ctx.fillStyle = "rgba(26,18,13,0.35)";
  ctx.textAlign = "center";
  ctx.fillText(`${setsTotal} SETS CAUGHT · ${stageStats.size} STAGES VISITED`, W/2, 330);

  const stampStartY = 380;
  const cols = 3, stampW = 280, stampH = 200, gapX = 40, gapY = 30;
  const startX = (W - cols * stampW - (cols - 1) * gapX) / 2;

  sorted.slice(0, 9).forEach((entry, i) => {
    const col = i % cols, row = Math.floor(i / cols);
    const x = startX + col * (stampW + gapX);
    const y = stampStartY + row * (stampH + gapY);
    const s = entry.stage;

    ctx.save();
    ctx.translate(x + stampW/2, y + stampH/2);
    ctx.rotate((Math.random() - 0.5) * 0.15);

    ctx.strokeStyle = s.color || "#e85d2e";
    ctx.lineWidth = 2.5;
    ctx.globalAlpha = 0.7;
    const r = 8;
    ctx.beginPath();
    ctx.moveTo(-stampW/2 + r, -stampH/2);
    ctx.lineTo(stampW/2 - r, -stampH/2);
    ctx.quadraticCurveTo(stampW/2, -stampH/2, stampW/2, -stampH/2 + r);
    ctx.lineTo(stampW/2, stampH/2 - r);
    ctx.quadraticCurveTo(stampW/2, stampH/2, stampW/2 - r, stampH/2);
    ctx.lineTo(-stampW/2 + r, stampH/2);
    ctx.quadraticCurveTo(-stampW/2, stampH/2, -stampW/2, stampH/2 - r);
    ctx.lineTo(-stampW/2, -stampH/2 + r);
    ctx.quadraticCurveTo(-stampW/2, -stampH/2, -stampW/2 + r, -stampH/2);
    ctx.closePath();
    ctx.stroke();
    ctx.globalAlpha = 1;

    ctx.fillStyle = s.color || "#1a120d";
    ctx.font = "italic 400 28px 'Instrument Serif', serif";
    ctx.textAlign = "center";
    ctx.fillText(s.name || s.id, 0, -15);
    ctx.font = "700 32px 'Geist Mono', monospace";
    ctx.fillText(`${entry.count}`, 0, 30);
    ctx.font = "700 10px 'Geist Mono', monospace";
    ctx.fillStyle = "rgba(26,18,13,0.4)";
    ctx.fillText("SETS CAUGHT", 0, 55);

    ctx.font = "700 9px 'Geist Mono', monospace";
    ctx.fillStyle = s.color || "#e85d2e";
    ctx.fillText("✓ STAMPED", 0, 80);

    ctx.restore();
  });

  if (!_isPlusSub()) {
    ctx.save(); ctx.translate(W/2, H/2); ctx.rotate(-Math.PI/6);
    ctx.fillStyle = "rgba(26,18,13,0.12)"; ctx.font = "700 72px 'Geist Mono', monospace"; ctx.textAlign = "center";
    ctx.fillText("PLURSKY+", 0, 0); ctx.restore();
  }
  ctx.fillStyle = "rgba(26,18,13,0.45)";
  ctx.font = "700 14px 'Geist Mono', monospace";
  ctx.textAlign = "center";
  ctx.fillText("MADE WITH PLURSKY+", W/2, H - 80);
  ctx.fillStyle = "rgba(26,18,13,0.6)";
  ctx.font = "italic 400 18px 'Instrument Serif', serif";
  ctx.fillText("plursky.com", W/2, H - 55);

  return c;
}

async function _shareFestivalPassport(state) {
  const gate = _canShare(); if (!gate.allowed) { _showShareLimitToast(); return false; }
  const c = await _renderFestivalPassport(state);
  if (!c) return false;
  const blob = await new Promise(r => c.toBlob(r, "image/png"));
  if (!blob) return false;
  try { window.plurskyHaptic?.("MEDIUM"); } catch {}
  _incShareCount();
  const file = new File([blob], "plursky-festival-passport.png", { type: "image/png" });
  if (navigator.share && typeof navigator.canShare === "function" && navigator.canShare({ files: [file] })) {
    try { await navigator.share({ files: [file], title: "My Festival Passport" }); return true; } catch {}
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a"); a.href = url; a.download = "plursky-festival-passport.png";
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  return true;
}

// W5: Photo Film Strip — retro Kodak negative export
async function _renderFilmStrip(moments) {
  const photoMoments = moments.filter(m => m.photoId && (m.kind === "image" || !m.kind)).slice(0, 6);
  const imgs = [];
  for (const m of photoMoments) {
    try {
      const blob = await _getPhoto(m.photoId);
      if (!blob) continue;
      const img = await new Promise(r => { const i = new Image(); i.onload = () => r(i); i.onerror = () => r(null); i.src = URL.createObjectURL(blob); });
      if (img) imgs.push({ img, moment: m });
    } catch {}
  }
  if (!imgs.length) return null;

  const CFG = window.FESTIVAL_CONFIG || {};
  const frameW = 300, frameH = 420, sprocketR = 10, sprocketGap = 40;
  const filmPad = 50, borderW = 35;
  const W = imgs.length * frameW + (imgs.length - 1) * 20 + filmPad * 2 + borderW * 2;
  const H = frameH + borderW * 2 + filmPad * 2 + 120;
  const c = document.createElement("canvas"); c.width = W; c.height = H;
  const ctx = c.getContext("2d");

  try { await document.fonts.load("italic 400 36px 'Instrument Serif'"); await document.fonts.load("700 11px 'Geist Mono'"); } catch {}

  ctx.fillStyle = "#1a120d"; ctx.fillRect(0, 0, W, H);

  const stripY = 60;
  const stripH = frameH + borderW * 2;
  ctx.fillStyle = "#2a1f15"; ctx.fillRect(0, stripY, W, stripH);

  for (let x = filmPad; x < W - filmPad; x += sprocketGap) {
    ctx.fillStyle = "#1a120d";
    ctx.beginPath(); ctx.roundRect(x, stripY + 6, 18, 12, 3); ctx.fill();
    ctx.beginPath(); ctx.roundRect(x, stripY + stripH - 18, 18, 12, 3); ctx.fill();
  }

  imgs.forEach(({ img, moment }, i) => {
    const x = filmPad + borderW + i * (frameW + 20);
    const y = stripY + borderW;

    ctx.fillStyle = "#0a0806"; ctx.fillRect(x - 4, y - 4, frameW + 8, frameH + 8);
    ctx.save();
    ctx.beginPath(); ctx.rect(x, y, frameW, frameH); ctx.clip();
    const sc = Math.max(frameW / img.width, frameH / img.height);
    const dw = img.width * sc, dh = img.height * sc;
    ctx.drawImage(img, x + (frameW - dw) / 2, y + (frameH - dh) / 2, dw, dh);
    ctx.restore();

    ctx.fillStyle = "rgba(232,93,46,0.7)";
    ctx.font = "700 9px 'Geist Mono', monospace";
    ctx.textAlign = "center";
    ctx.fillText(`${i + 1}A`, x + frameW / 2, y + frameH + 22);

    const artist = moment?.artistId ? (window.ARTISTS || []).find(a => a.id === moment.artistId) : null;
    if (artist) {
      ctx.fillStyle = "rgba(247,237,224,0.6)";
      ctx.font = "700 8px 'Geist Mono', monospace";
      ctx.fillText(artist.name.toUpperCase().slice(0, 18), x + frameW / 2, y - 10);
    }
  });

  ctx.fillStyle = "#f7ede0";
  ctx.font = "italic 400 36px 'Instrument Serif', serif";
  ctx.textAlign = "left";
  ctx.fillText(`${CFG.shortName || "Festival"} Memories`, filmPad, H - 30);
  ctx.fillStyle = "rgba(247,237,224,0.4)";
  ctx.font = "700 11px 'Geist Mono', monospace";
  ctx.textAlign = "right";
  ctx.fillText("PLURSKY+ · plursky.com", W - filmPad, H - 35);
  if (!_isPlusSub()) {
    ctx.save(); ctx.translate(W/2, stripY + stripH/2); ctx.rotate(-Math.PI/12);
    ctx.fillStyle = "rgba(247,237,224,0.2)"; ctx.font = "700 48px 'Geist Mono', monospace"; ctx.textAlign = "center";
    ctx.fillText("PLURSKY+", 0, 0); ctx.restore();
  }

  return c;
}

async function _shareFilmStrip(moments) {
  const gate = _canShare(); if (!gate.allowed) { _showShareLimitToast(); return false; }
  const c = await _renderFilmStrip(moments);
  if (!c) return false;
  const blob = await new Promise(r => c.toBlob(r, "image/png"));
  if (!blob) return false;
  try { window.plurskyHaptic?.("MEDIUM"); } catch {}
  _incShareCount();
  const file = new File([blob], "plursky-film-strip.png", { type: "image/png" });
  if (navigator.share && typeof navigator.canShare === "function" && navigator.canShare({ files: [file] })) {
    try { await navigator.share({ files: [file], title: "Festival Film Strip" }); return true; } catch {}
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a"); a.href = url; a.download = "plursky-film-strip.png";
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  return true;
}

// W6: Crew Comparison Card — head-to-head stats
async function _renderCrewComparison(myName, myState, otherName, otherArtistIds) {
  const W = 1080, H = 1350;
  const CFG = window.FESTIVAL_CONFIG || {};
  const c = document.createElement("canvas"); c.width = W; c.height = H;
  const ctx = c.getContext("2d");

  try { await document.fonts.load("italic 400 56px 'Instrument Serif'"); await document.fonts.load("700 14px 'Geist Mono'"); } catch {}

  ctx.fillStyle = "#1a120d"; ctx.fillRect(0, 0, W, H);

  ctx.fillStyle = "#fff";
  ctx.font = "italic 400 56px 'Instrument Serif', serif";
  ctx.textAlign = "center";
  ctx.fillText("Crew Showdown", W/2, 120);
  ctx.font = "700 14px 'Geist Mono', monospace";
  ctx.fillStyle = "rgba(255,255,255,0.4)";
  ctx.fillText(`${(CFG.shortName || "FESTIVAL").toUpperCase()} · ${CFG.dates || ""}`, W/2, 160);

  const mySaved = myState.saved || [];
  const theirSaved = otherArtistIds || [];
  const overlap = mySaved.filter(id => theirSaved.includes(id));
  const myOnly = mySaved.filter(id => !theirSaved.includes(id));
  const theirOnly = theirSaved.filter(id => !mySaved.includes(id));

  const artists = window.ARTISTS || [];
  const stages = window.STAGES || [];

  const myTopStage = _topStageFor(mySaved, artists, stages);
  const theirTopStage = _topStageFor(theirSaved, artists, stages);

  const myGem = _hiddenGemFor(mySaved, artists);
  const theirGem = _hiddenGemFor(theirSaved, artists);

  const midX = W / 2;
  const colL = W * 0.25, colR = W * 0.75;

  ctx.fillStyle = "#6D28D9"; ctx.beginPath(); ctx.arc(colL, 260, 40, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = "#fff"; ctx.font = "700 22px 'Geist Mono', monospace"; ctx.textAlign = "center";
  ctx.fillText((myName || "ME")[0].toUpperCase(), colL, 268);
  ctx.fillStyle = "#e85d2e"; ctx.beginPath(); ctx.arc(colR, 260, 40, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = "#fff"; ctx.fillText((otherName || "THEM")[0].toUpperCase(), colR, 268);

  ctx.font = "italic 400 24px 'Instrument Serif', serif";
  ctx.fillStyle = "#f7ede0";
  ctx.fillText(myName || "Me", colL, 330);
  ctx.fillText(otherName || "Friend", colR, 330);

  const rows = [
    { label: "SETS SAVED", left: `${mySaved.length}`, right: `${theirSaved.length}` },
    { label: "IN COMMON", left: `${overlap.length}`, right: `${overlap.length}`, highlight: true },
    { label: "UNIQUE PICKS", left: `${myOnly.length}`, right: `${theirOnly.length}` },
    { label: "TOP STAGE", left: myTopStage?.name?.toUpperCase() || "—", right: theirTopStage?.name?.toUpperCase() || "—" },
    { label: "HIDDEN GEM", left: myGem || "—", right: theirGem || "—" },
  ];

  let rowY = 400;
  rows.forEach(row => {
    ctx.fillStyle = row.highlight ? "rgba(109,40,217,0.15)" : "rgba(247,237,224,0.04)";
    ctx.fillRect(80, rowY - 25, W - 160, 60);

    ctx.fillStyle = row.highlight ? "#a78bfa" : "rgba(247,237,224,0.35)";
    ctx.font = "700 10px 'Geist Mono', monospace";
    ctx.textAlign = "center";
    ctx.fillText(row.label, midX, rowY - 5);

    ctx.fillStyle = "#f7ede0";
    ctx.font = "700 22px 'Geist Mono', monospace";
    ctx.textAlign = "center";
    ctx.fillText(row.left, colL, rowY + 22);
    ctx.fillText(row.right, colR, rowY + 22);

    rowY += 80;
  });

  const vsY = 260;
  ctx.fillStyle = "#1a120d";
  ctx.beginPath(); ctx.arc(midX, vsY, 25, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = "rgba(247,237,224,0.2)"; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.arc(midX, vsY, 25, 0, Math.PI * 2); ctx.stroke();
  ctx.fillStyle = "#f7ede0"; ctx.font = "italic 400 20px 'Instrument Serif', serif";
  ctx.textAlign = "center"; ctx.textBaseline = "middle";
  ctx.fillText("vs", midX, vsY + 1);
  ctx.textBaseline = "alphabetic";

  if (overlap.length > 0) {
    const overlapNames = overlap.slice(0, 4).map(id => { const a = artists.find(x => x.id === id); return a?.name || id; });
    ctx.fillStyle = "rgba(247,237,224,0.3)";
    ctx.font = "700 10px 'Geist Mono', monospace";
    ctx.textAlign = "center";
    ctx.fillText(`SHARED SETS: ${overlapNames.join(" · ").toUpperCase()}${overlap.length > 4 ? ` + ${overlap.length - 4} MORE` : ""}`, W/2, rowY + 20);
  }

  if (!_isPlusSub()) {
    ctx.save(); ctx.translate(W/2, H/2 + 40); ctx.rotate(-Math.PI/6);
    ctx.fillStyle = "rgba(247,237,224,0.12)"; ctx.font = "700 64px 'Geist Mono', monospace"; ctx.textAlign = "center";
    ctx.fillText("PLURSKY+", 0, 0); ctx.restore();
  }
  ctx.fillStyle = "rgba(247,237,224,0.2)";
  ctx.font = "700 11px 'Geist Mono', monospace";
  ctx.textAlign = "center";
  ctx.fillText("MADE WITH PLURSKY+", W/2, H - 70);
  ctx.fillStyle = "rgba(247,237,224,0.4)";
  ctx.font = "italic 400 18px 'Instrument Serif', serif";
  ctx.fillText("plursky.com", W/2, H - 42);

  return c;
}

function _topStageFor(savedIds, artists, stages) {
  const counts = new Map();
  for (const id of savedIds) {
    const a = artists.find(x => x.id === id);
    if (!a) continue;
    counts.set(a.stage, (counts.get(a.stage) || 0) + 1);
  }
  let topId = null, topN = 0;
  for (const [sid, n] of counts) { if (n > topN) { topId = sid; topN = n; } }
  return topId ? stages.find(s => s.id === topId) : null;
}

function _hiddenGemFor(savedIds, artists) {
  let gem = null, lowestPop = Infinity;
  for (const id of savedIds) {
    const a = artists.find(x => x.id === id);
    if (!a) continue;
    const pop = a.spotifyPop ?? a.popularity ?? 50;
    if (pop < lowestPop) { lowestPop = pop; gem = a.name; }
  }
  return gem;
}

async function _shareCrewComparison(myName, myState, otherName, otherArtistIds) {
  const gate = _canShare(); if (!gate.allowed) { _showShareLimitToast(); return false; }
  const c = await _renderCrewComparison(myName, myState, otherName, otherArtistIds);
  if (!c) return false;
  const blob = await new Promise(r => c.toBlob(r, "image/png"));
  if (!blob) return false;
  try { window.plurskyHaptic?.("MEDIUM"); } catch {}
  _incShareCount();
  const file = new File([blob], "plursky-crew-showdown.png", { type: "image/png" });
  if (navigator.share && typeof navigator.canShare === "function" && navigator.canShare({ files: [file] })) {
    try { await navigator.share({ files: [file], title: "Crew Showdown" }); return true; } catch {}
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a"); a.href = url; a.download = "plursky-crew-showdown.png";
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  return true;
}

// Window exports — identical set spotify.jsx exported for the engine
// before the split, so existing window._x?.() call sites are unaffected.
Object.assign(window, {
  _renderCollage, _renderCollageGif, _shareCollage,
  _shareArtistCollage, _shareStageCollage, _shareNightCollage, _shareWeekendCollage, _shareCrewCollage,
  _renderRecapVideo, _shareRecapVideo, _detectBeats, _VIDEO_TEMPLATES,
  _shareFestivalDNA, _shareFestivalPassport, _shareFilmStrip, _shareCrewComparison,
  _renderFestivalYearCard, _shareFestivalYearCard, _shareCanvasAsImage,
});
