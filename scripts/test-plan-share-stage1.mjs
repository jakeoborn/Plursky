#!/usr/bin/env node
// Public plan-share link (#74, PM spec v2 row 4). Stage 1 shipped a local
// preview behind a flag; stage 2 (Jake: "go 74", 2026-11-25) turns it on.
//   A. static: the flag ships true; the sheet and the menu item sit behind it;
//      the preview code itself makes no network, storage or share call (the
//      link's side effects live in planShareLink* helpers, which send the
//      contract's payload and nothing else); the contract script is loaded,
//      precached and copied; no migration file; plan.html is never indexed.
//   B. running app, as shipped: the Share menu has the link item.
//   C. running app: the sheet renders exactly the payload's sets, through the
//      one contract; nothing leaves while it only previews; the name appears
//      only on opt-in; signed out, CREATE LINK asks to sign in and writes
//      nothing; with the backend stubbed, the link is created from exactly
//      the previewed payload, shown, remembered, and turned off.
// Pixels: PLAN_SHARE_SHOTS=<dir> saves the sheet at 320 and 393, Dark and Light.
import { readFileSync, readdirSync, existsSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";
import { createServer } from "node:net";
import { chromium } from "playwright";
import { serverReady } from "./lib/server-ready.mjs";
import { wireVendor } from "./lib/vendor-cdn.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
let checks = 0, failed = 0;
const check = (ok, msg) => { checks++; if (!ok) { failed++; console.log(`  ✗  ${msg}`); } };
const read = p => readFileSync(join(ROOT, p), "utf8");

// ── A. static ──────────────────────────────────────────────────────────────
const lineup = read("lineup.jsx");
check(/^const PLAN_SHARE_LINK_ON = true;$/m.test(lineup), "A. PLAN_SHARE_LINK_ON ships true (stage 2)");
check((lineup.match(/PLAN_SHARE_LINK_ON &&/g) || []).length === 2, "A. the menu item and the sheet are each behind the flag (2 guards)");
check((lineup.match(/<PlanShareLinkSheet\b/g) || []).length === 1, "A. the sheet is mounted in exactly one place");
const body = name => { const i = lineup.indexOf(`function ${name}(`); const j = lineup.indexOf("\nfunction ", i + 10); return i < 0 ? "" : lineup.slice(i, j); };
const preview = body("planShareDraft") + body("PlanShareLinkSheet");
check(preview.length > 2000, "A. harness: found planShareDraft and PlanShareLinkSheet");
for (const [re, what] of [[/\bfetch\s*\(/, "fetch"], [/XMLHttpRequest|sendBeacon|WebSocket/, "XHR/beacon/socket"], [/\bsb[A-Z]\w*\s*\(|supabase/i, "Supabase"],
  [/navigator\.(share|clipboard)/, "share sheet / clipboard"], [/localStorage|sessionStorage|indexedDB/, "storage"], [/plursky_display_name|sbGetUser|getDisplayName/, "profile-name read"]])
  check(!re.test(preview), `A. the preview code makes no ${what} call`);
check(/window\.PlurskyPlanShare/.test(preview) && /makePublicPlan\(/.test(preview), "A. the payload is built by the shared contract, not restated");
const index = read("index.html");
const iContract = index.indexOf('<script src="data/plan-share-contract.js?v='), iLineup = index.indexOf('<script src="build/lineup.js?v=');
check(iContract > 0 && iContract < iLineup, "A. index.html loads the contract before build/lineup.js");
check(/`\.\/data\/plan-share-contract\.js\?v=\$\{APP_VER\}`/.test(read("sw.js")), "A. sw.js precaches the contract");
check(/'data\/plan-share-contract\.js'/.test(read("scripts/build.mjs")), "A. build.mjs copies the contract into dist/");
const supa = (function walk(d) { return readdirSync(d, { withFileTypes: true }).flatMap(e => e.isDirectory() ? walk(join(d, e.name)) : [join(d, e.name)]); })(join(ROOT, "supabase"));
check(!supa.some(f => /plan_share|plan-share/i.test(f)), "A. no plan-share file anywhere under supabase/ (no schema ships)");
check(/NOT in\s+-- supabase\/migrations|NOT in supabase\/migrations/.test(read("docs/plan-share/public_plan_shares_DRAFT.sql")), "A. the draft SQL says it is not a migration");
// Stage 2: the sheet creates through ONE call carrying the previewed payload,
// and the backend write carries that payload's fields and nothing else.
const sheetBody = body("PlanShareLinkSheet");
check((sheetBody.match(/planShareLinkCreate\(/g) || []).length === 1 && /planShareLinkCreate\(d\.payload\)/.test(sheetBody), "A. the sheet creates the link from exactly the previewed payload");
const supaJsx = read("supabase.jsx");
const ins = (supaJsx.match(/from\("public_shares"\)\.insert\(\{([^}]*)\}\)/) || [])[1] || "";
check(JSON.stringify(ins.split(",").map(s => s.trim().split(":")[0].trim()).filter(Boolean).sort()) === JSON.stringify(["display_name", "expires_at", "festival_id", "kind", "payload", "token"]), `A. the public_shares insert writes only token/kind/festival_id/payload/display_name/expires_at (${ins.trim()})`);
check(/display_name: payload\.displayName \|\| null/.test(supaJsx), "A. display_name comes only from the opt-in payload name");
check(/crypto\.getRandomValues\(b\)/.test(supaJsx) && /new Uint8Array\(32\)/.test(supaJsx), "A. the token is 32 bytes from crypto.getRandomValues");
const planHtml = read("plan.html");
check(/<meta name="robots" content="noindex, nofollow">/.test(planHtml), "A. plan.html is noindex, nofollow");
check(/^Disallow: \/plan\.html$/m.test(read("robots.txt")), "A. robots.txt disallows /plan.html");
check(!/plan\.html/.test(read("sitemap.xml")), "A. sitemap.xml never lists plan.html");
check(!/innerHTML|insertAdjacentHTML|document\.write/.test(planHtml.slice(planHtml.indexOf("<script>"))), "A. plan.html renders shared text with textContent only");
check(/rpc\("get_public_share"/.test(planHtml) && !/\.from\(/.test(planHtml), "A. plan.html reads only through get_public_share, never the table");

// ── B/C. the running app ──────────────────────────────────────────────────
const FID = "edc-lv-2026", AT = "2026-05-10T18:00:00Z";
const reservePort = () => new Promise((resolve, reject) => { const s = createServer(); s.once("error", reject); s.listen(0, "127.0.0.1", () => { const a = s.address(); s.close(e => e ? reject(e) : resolve(a.port)); }); });
const PORT = await reservePort();
const server = spawn("python3", ["-m", "http.server", String(PORT), "--bind", "127.0.0.1"], { cwd: ROOT, stdio: "ignore" });
const SHOTS = process.env.PLAN_SHARE_SHOTS;
try {
  await serverReady(`http://127.0.0.1:${PORT}/index.html`);
  // The runner has system Chrome, not Playwright's bundled shell (#408 CI): the repo's established selection.
  const executablePath = ["/opt/google/chrome/chrome", "/usr/bin/google-chrome", "/usr/bin/chromium"].find(existsSync);
  const browser = await chromium.launch({ headless: true, ...(executablePath ? { executablePath } : {}) });
  const open = async ({ flagOn, width = 393, mode = "dark", saved = [], tab = "home", fid = FID, at = AT }) => {
    const bctx = await browser.newContext({ viewport: { width, height: 844 }, serviceWorkers: "block", colorScheme: mode });
    await wireVendor(bctx);
    await bctx.clock.install({ time: new Date(at) });
    await bctx.addInitScript(({ FID, saved, mode }) => {
      if (sessionStorage.getItem("seeded")) return;
      sessionStorage.setItem("seeded", "1");
      localStorage.setItem("onboarded", "v1"); localStorage.setItem("active_festival_id", FID);
      localStorage.setItem("active_festival_explicit", "1"); localStorage.setItem("cloud_nudge_seen", "1");
      localStorage.setItem("plursky_display_name", "Profile Name");   // must NEVER reach the link
      localStorage.setItem("plursky_lineup_view", "list");
      localStorage.setItem("plursky.appearance", mode);
      localStorage.setItem(`${FID}_saved_v1`, JSON.stringify(saved));
    }, { FID: fid, saved, mode });
    const page = await bctx.newPage();
    const requests = []; page.on("request", r => requests.push({ url: r.url(), method: r.method() }));
    await page.goto(`http://127.0.0.1:${PORT}/index.html?f=${fid}&tab=${tab}`, { waitUntil: "domcontentloaded" });
    await page.waitForFunction(({ fid, wantShare }) => window.FESTIVAL_CONFIG?.id === fid && typeof window.activeLineup === "function"
      && (!wantShare || document.querySelector("[data-share-lineup]")), { fid, wantShare: saved.length > 0 }, { timeout: 60000 });
    return { bctx, page, requests };
  };

  // The saved plan: three timed acts on two nights, plus one with no confirmed time when the lineup has one.
  const pick = await (async () => {
    const { bctx, page } = await open({ flagOn: false });
    const r = await page.evaluate(() => {
      const L = window.activeLineup();
      const timed = L.filter(a => window.setTimingMin(a)?.end != null);
      const d1 = timed.filter(a => a.day === 1).slice(0, 2), d2 = timed.filter(a => a.day === 2).slice(0, 1);
      const untimed = L.find(a => !window.setTimingMin(a));
      return { ids: [...d1, ...d2].map(a => a.id), untimed: untimed ? untimed.id : null };
    });
    await bctx.close();
    return r;
  })();
  check(pick.ids.length === 3, `C. harness: three timed acts to save (got ${JSON.stringify(pick.ids)})`);
  const saved = [...pick.ids, ...(pick.untimed ? [pick.untimed] : [])];
  // B. as shipped: the Share menu has the link item.
  {
    const { bctx, page } = await open({ flagOn: false, saved });
    await page.locator("[data-share-lineup]").first().click();
    check(await page.getByText("Copy as text").isVisible(), "B. harness: the Share menu opened");
    check(await page.getByText("Share as a link").count() === 1, "B. as shipped: the 'Share as a link' item is there");
    check(await page.evaluate(() => window.PlurskyPlanShare && typeof window.PlurskyPlanShare.makePublicPlan === "function"), "B. the contract loaded in the app");
    await bctx.close();
  }

  const runSheet = async ({ width, mode, assert }) => {
    const { bctx, page, requests } = await open({ flagOn: true, width, mode, saved });
    await page.locator("[data-share-lineup]").first().click();
    await page.getByText("Share as a link").click();
    await page.waitForSelector("[data-plan-share-sheet]");
    const before = requests.length;
    if (assert) {
      const shown = await page.$$eval("[data-plan-share-set]", els => els.map(e => e.getAttribute("data-plan-share-set")));
      const draft = await page.evaluate(s => window.planShareDraft(s, ""), saved);
      check(!draft.error, `C. the draft builds (error ${draft.error})`);
      const payloadIds = (draft.payload?.sets || []).map(s => s.id);
      check(JSON.stringify(shown) === JSON.stringify(payloadIds), `C. the sheet shows exactly the payload's sets (${JSON.stringify(shown)} vs ${JSON.stringify(payloadIds)})`);
      check(JSON.stringify(payloadIds) === JSON.stringify(pick.ids), "C. the payload carries the three timed saves, in plan order");
      const ends = await page.$$eval("[data-plan-share-set]", els => els.map(e => {
        const a = window.ARTISTS.find(x => String(x.id) === e.getAttribute("data-plan-share-set"));
        const end = e.querySelector("[data-plan-share-end]");
        return { id: a && a.id, shown: end ? end.textContent : null, want: a ? "– " + window.fmt12(a.end) : "?" };
      }));
      check(ends.length === shown.length && ends.every(x => x.shown === x.want), `C. every row shows its end time (${JSON.stringify(ends)})`);
      check(JSON.stringify(Object.keys(draft.payload).sort()) === JSON.stringify(["expiresAt", "festivalId", "festivalName", "kind", "schemaVersion", "sets", "tz"]), "C. payload keys are the allowlist only (no name by default; festival name and zone only)");
      check(!JSON.stringify(draft.payload).includes("Profile Name"), "C. the profile name never reaches the payload");
      const endMs = await page.evaluate(() => window.FESTIVAL_CONFIG.endMs);
      check(draft.payload.expiresAt === new Date(endMs + 7 * 86400000).toISOString(), "C. the link ends exactly a week after the edition end");
      check(draft.payload.sets.every(s => Date.parse(s.endsAt) > Date.parse(s.startsAt)), "C. every set ends after it starts (absolute times)");
      if (pick.untimed) check(await page.$("[data-plan-share-left='1']") !== null, "C. the untimed save is counted as left off, not guessed");
      // An unconfirmed time is left off and counted, never guessed: mark one
      // saved act unconfirmed (bare names resolve through window) and redraft.
      const unconf = await page.evaluate(({ s, id }) => {
        const orig = window.setTimingMin;
        window.setTimingMin = a => (a.id === id ? null : orig(a));
        try { const d = window.planShareDraft(s, ""); return { ids: (d.payload?.sets || []).map(x => x.id), left: d.left }; }
        finally { window.setTimingMin = orig; }
      }, { s: saved, id: pick.ids[1] });
      check(unconf.left === 1 + (pick.untimed ? 1 : 0) && !unconf.ids.includes(pick.ids[1]), `C. an unconfirmed set is counted and left off (${JSON.stringify(unconf)})`);
      const head = await page.$eval("[data-plan-share-sheet]", el => el.innerText);
      check(!/\bA EDC\b/.test(head) && /EDC LV 2026 plan/.test(head), "C. the heading reads '<festival> plan' with no stray article");
      check(await page.$("[data-plan-share-ends]") !== null, "C. the sheet says when the link stops working");
      const btn = page.getByRole("button", { name: "Create link" });
      check(await btn.isEnabled(), "C. Create link is enabled when the plan has timed sets");
      const hit = await page.$eval("[data-plan-share-create]", el => { const r = el.getBoundingClientRect(); const top = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2); return !!top && el.contains(top); });
      check(hit, "C. Create link is on top and tappable (not under the tab bar)");
      await page.getByText("Show a name on the link").click();
      await page.getByLabel("Name to show on the link").fill("Jake");
      const named = await page.evaluate(s => window.planShareDraft(s, "Jake"), saved);
      check(named.payload?.displayName === "Jake", "C. opt-in name goes on the payload");
      check(await page.getByText("Jake's EDC", { exact: false }).count() > 0, "C. the preview shows the opted-in name");
      await page.waitForTimeout(300);
      // The screen behind keeps its own ambient reads (Today's weather.gov
      // forecast), so judge what LEAVES: no write, nothing to Supabase, and no
      // request carrying the plan (a set id or an artist name). Section A
      // already proves the sheet's code has no network call at all.
      const after = requests.slice(before);
      const names = draft.payload.sets.map(x => encodeURIComponent(x.artist).toLowerCase());
      const leak = after.filter(r => r.method !== "GET" || /supabase/i.test(r.url)
        || pick.ids.some(id => r.url.includes(`=${id}`) || r.url.includes(`/${id}`)) || names.some(n => r.url.toLowerCase().includes(n)));
      check(leak.length === 0, `C. nothing about the plan leaves while the sheet only previews (${leak.map(r => r.method + " " + r.url).join(", ")})`);
      await page.getByText("Show a name on the link").click();
      // Signed out: CREATE LINK asks to sign in and writes nothing.
      const beforeCreate = requests.length;
      await btn.click();
      await page.waitForSelector("[data-plan-share-msg]");
      check(/Sign in with Apple on the Me tab/.test(await page.$eval("[data-plan-share-msg]", e => e.textContent)), "C. signed out: CREATE LINK asks to sign in");
      const wrote = requests.slice(beforeCreate).filter(r => r.method !== "GET" && /supabase/i.test(r.url));
      check(wrote.length === 0, `C. signed out: nothing is written (${wrote.map(r => r.method + " " + r.url).join(", ")})`);
      check(await page.$("[data-plan-share-live]") === null, "C. signed out: no link is shown");
      // Backend stubbed (bare names resolve through window): the link is made
      // from exactly the previewed payload, shown, remembered, and turned off.
      const TOK = "A".repeat(21) + "_" + "b".repeat(21);
      await page.evaluate(TOK => {
        window.__sent = []; window.__revoked = [];
        window.sbPlanShareCreate = async p => { window.__sent.push(p); return { token: TOK, expiresAt: p.expiresAt }; };
        window.sbPlanShareRevoke = async t => { window.__revoked.push(t); return { ok: true }; };
      }, TOK);
      await btn.click();
      await page.waitForSelector("[data-plan-share-live]");
      const sent = await page.evaluate(() => window.__sent);
      const wantPayload = await page.evaluate(s => window.planShareDraft(s, "").payload, saved);
      check(sent.length === 1 && JSON.stringify(sent[0]) === JSON.stringify(wantPayload), "C. the created link carries exactly the previewed payload");
      check((await page.$eval("[data-plan-share-url]", e => e.textContent)) === `https://plursky.com/plan.html?t=${TOK}`, "C. the sheet shows the plan.html link");
      const stored = await page.evaluate(fid => JSON.parse(localStorage.getItem("plursky_plan_links_v1") || "{}")[fid], FID);
      check(stored && stored.token === TOK && stored.sets === pick.ids.length, `C. the link is remembered per festival (${JSON.stringify(stored)})`);
      await page.locator("[data-plan-share-off]").click();
      await page.waitForSelector("[data-plan-share-create]");
      check(JSON.stringify(await page.evaluate(() => window.__revoked)) === JSON.stringify([TOK]), "C. TURN OFF LINK revokes that token");
      check(await page.evaluate(fid => !(JSON.parse(localStorage.getItem("plursky_plan_links_v1") || "{}")[fid]), FID), "C. a turned-off link is forgotten on the device");
    }
    if (SHOTS) {
      mkdirSync(SHOTS, { recursive: true });
      const over = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
      check(!over, `C. no horizontal overflow at ${width} ${mode}`);
      await page.screenshot({ path: join(SHOTS, `plan-share-sheet-${width}-${mode}.png`) });
    }
    await bctx.close();
  };
  await runSheet({ width: 393, mode: "dark", assert: true });

  // D. multi-weekend: ACL 2026, before the festival, a Weekend-2 selection.
  // af02 Happy Landing is W2-only (Fri Oct 9 13:00-13:45 CDT); af05 Jesse Welles
  // plays both weekends and follows the selection's weekend (Fri Oct 9 16:15-17:15).
  // Payload AND the sheet's day header must say the same date.
  {
    const ACL = "acl-2026", ACL_AT = "2026-09-20T18:00:00Z";
    const sheetFor = async (ids, width = 393, mode = "dark") => {
      const o = await open({ flagOn: true, fid: ACL, at: ACL_AT, saved: ids, width, mode });
      await o.page.locator("[data-share-lineup]").first().click();
      await o.page.getByText("Share as a link").click();
      await o.page.waitForSelector("[data-plan-share-sheet]");
      o.heads = await o.page.$$eval("[data-plan-share-day]", els => els.map(e => e.textContent.trim().toUpperCase()));
      o.times = await o.page.$$eval("[data-plan-share-set]", els => els.map(e => [e.getAttribute("data-plan-share-set"), e.querySelector("[data-plan-share-start]")?.textContent, e.querySelector("[data-plan-share-end]")?.textContent]));
      o.over = await o.page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth
        || [...document.querySelectorAll("[data-plan-share-set] *")].some(el => el.scrollWidth > el.clientWidth + 1));
      // The widest label a row can carry, measured in the real cell: it must fit its column.
      o.widest = await o.page.evaluate(() => {
        const cell = document.querySelector("[data-plan-share-end]"); if (!cell) return null;
        const probe = cell.cloneNode(); probe.textContent = "– 12:00 AM"; probe.style.cssText = "position:absolute;visibility:hidden;white-space:nowrap";
        cell.parentElement.appendChild(probe); const w = probe.getBoundingClientRect().width; probe.remove();
        return { w: Math.round(w * 10) / 10, col: cell.parentElement.clientWidth, font: getComputedStyle(cell).fontFamily.split(",")[0] };
      });
      return o;
    };
    const w2 = await sheetFor(["af02", "af05"]);
    const d = await w2.page.evaluate(() => window.planShareDraft(["af02", "af05"], ""));
    const got = Object.fromEntries((d.payload?.sets || []).map(s => [s.id, [s.startsAt, s.endsAt]]));
    check(!d.error && d.left === 0, `D. ACL W2 draft builds with nothing left off (error ${d.error}, left ${d.left})`);
    check(JSON.stringify(got.af02) === JSON.stringify(["2026-10-09T18:00:00.000Z", "2026-10-09T18:45:00.000Z"]), `D. W2-only Happy Landing is on Fri Oct 9, not Oct 2 (${JSON.stringify(got.af02)})`);
    check(JSON.stringify(got.af05) === JSON.stringify(["2026-10-09T21:15:00.000Z", "2026-10-09T22:15:00.000Z"]), `D. a both-weekend set follows the W2 selection (${JSON.stringify(got.af05)})`);
    check(JSON.stringify(w2.heads) === JSON.stringify(["FRIDAY · OCT 9"]), `D. the W2 sheet header reads FRIDAY · OCT 9 (${JSON.stringify(w2.heads)})`);
    check(JSON.stringify(w2.times) === JSON.stringify([["af02", "1:00 PM", "– 1:45 PM"], ["af05", "4:15 PM", "– 5:15 PM"]]), `D. each row shows start and end (${JSON.stringify(w2.times)})`);
    check(!w2.over, "D. no overflow in the rows at 393 dark");
    check(w2.widest && w2.widest.w <= w2.widest.col, `D. the widest end label "– 12:00 AM" fits its column (${JSON.stringify(w2.widest)})`);
    if (SHOTS) await w2.page.screenshot({ path: join(SHOTS, "plan-share-sheet-acl-w2-393-dark.png") });
    await w2.bctx.close();
    const narrow = await sheetFor(["af02", "af05"], 320, "light");
    check(JSON.stringify(narrow.times) === JSON.stringify(w2.times) && !narrow.over, `D. 320 light: same start/end, no overflow (${JSON.stringify(narrow.times)})`);
    if (SHOTS) await narrow.page.screenshot({ path: join(SHOTS, "plan-share-sheet-acl-w2-320-light.png") });
    await narrow.bctx.close();
    const w1 = await sheetFor(["af05"]);
    const d1 = await w1.page.evaluate(() => window.planShareDraft(["af05"], ""));
    check(d1.payload?.sets?.[0]?.startsAt === "2026-10-02T21:15:00.000Z", `D. the same set alone stays on Weekend 1 before the festival (${d1.payload?.sets?.[0]?.startsAt})`);
    check(JSON.stringify(w1.heads) === JSON.stringify(["FRIDAY · OCT 2"]), `D. the same set alone: header FRIDAY · OCT 2 (${JSON.stringify(w1.heads)})`);
    if (SHOTS) await w1.page.screenshot({ path: join(SHOTS, "plan-share-sheet-acl-w1-393-dark.png") });
    await w1.bctx.close();
  }
  if (SHOTS) for (const width of [320, 393]) for (const mode of ["dark", "light"]) await runSheet({ width, mode, assert: false });
  await browser.close();
} finally { server.kill(); }

if (failed) { console.log(`✗ plan-share link: ${failed}/${checks} checks failed`); process.exit(1); }
console.log(`✓ plan-share link: ${checks} checks (flag on, preview is network-free, link = exactly the previewed payload, revocable, never indexed, one contract)`);
