// D-003 persona simulations (design section 13): 1 Giulia (on harness/share.html via /q), 3 Sara,
// 4 Alex, 5 Mallory. Playwright chromium against the local harness on 127.0.0.1.
// Usage: node --import tsx sim/run.ts d003|all   (all = d003 then sim/d004.ts if present)
// Appends to proof/sim-<YYYY-MM-DD>.log (local date). Owner: AI Engineer.
import { chromium, type Browser, type BrowserContext, type Page } from "playwright";
import { appendFileSync, existsSync, mkdirSync, readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { join } from "node:path";
import { gzipSync } from "node:zlib";
import { ROOT, startHarness } from "../harness/server.ts";
import { buildWhatsAppUrl, computeQuote, defaultAnswers, encodeConfig, getTemplate, validateConfig } from "../packages/core/src/index.ts";

const mode = process.argv[2] ?? "d003";
const now = new Date();
const day = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
mkdirSync(join(ROOT, "proof"), { recursive: true });
const LOG = join(ROOT, "proof", `sim-${day}.log`);
const log = (s: string) => { console.log(s); appendFileSync(LOG, s + "\n"); };
const fx = (n: string) => JSON.parse(readFileSync(join(ROOT, "fixtures", n), "utf8"));
const b64u = (s: string) => Buffer.from(s, "utf8").toString("base64url");

type Check = { name: string; ok: boolean; detail: string };
class Persona {
  checks: Check[] = [];
  actions = 0;
  constructor(public id: string, public name: string) {}
  check(name: string, ok: boolean, detail = "") { this.checks.push({ name, ok, detail }); log(`  ${ok ? "PASS" : "FAIL"} [${this.id}] ${name}${detail ? ` — ${detail}` : ""}`); }
  get ok() { return this.checks.length > 0 && this.checks.every((c) => c.ok); }
}

type Watch = { requests: { url: string; method: string }[]; console: string[]; pageErrors: string[]; dialogs: string[] };
async function watchedPage(ctx: BrowserContext): Promise<{ page: Page; w: Watch }> {
  const page = await ctx.newPage();
  const w: Watch = { requests: [], console: [], pageErrors: [], dialogs: [] };
  page.on("request", (r) => w.requests.push({ url: r.url(), method: r.method() }));
  page.on("console", (m) => { if (m.type() === "error") w.console.push(m.text()); });
  page.on("pageerror", (e) => w.pageErrors.push(String(e)));
  page.on("dialog", (d) => { w.dialogs.push(d.message()); void d.dismiss(); });
  return { page, w };
}
const settled = (page: Page, n = 1) => page.waitForFunction((n) => (window as any).__ql?.events.filter((e: any) => e.type === "quotelet:ready" || e.type === "quotelet:error").length >= n, n, { timeout: 5000 });
const ql = (page: Page) => page.evaluate(() => (window as any).__ql);

// ---------------- Persona 1: Giulia (phone, share link on harness) ----------------
async function giulia(browser: Browser, base: string): Promise<Persona> {
  const p = new Persona("1", "Giulia, homeowner in Bologna, phone 375x812 (harness/share.html via /q)");
  log(`- Persona 1: ${p.name}`);
  const cfg = fx("config-imbianchino.json"); // the imbianchino-it template as customised by an owner (name + WhatsApp)
  const link = `${base}/q#c=${encodeConfig(cfg)}`;
  const ctx = await browser.newContext({ viewport: { width: 375, height: 812 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2, locale: "it-IT" });
  const { page, w } = await watchedPage(ctx);
  const t0 = Date.now();
  await page.goto(link); p.actions++;
  await settled(page);
  const root = page.locator("#w1");
  await root.locator('[data-testid="ql-field-mq"]').tap(); await root.locator('[data-testid="ql-field-mq"]').fill("75"); p.actions++;
  await root.locator('[data-testid="ql-field-colore"]').selectOption({ index: 1 }); p.actions++;
  await root.locator('[data-testid="ql-name"]').tap(); await root.locator('[data-testid="ql-name"]').fill("Giulia"); p.actions++;
  await root.locator('[data-testid="ql-cta-whatsapp"]').tap(); p.actions++;
  const answers = { ...defaultAnswers(validateConfig(cfg).ok ? (validateConfig(cfg) as any).config : cfg), mq: 75, colore: 1 };
  const expected = computeQuote(cfg, answers);
  const got = {
    low: Number(await root.locator('[data-testid="ql-result-low"]').getAttribute("data-cents")),
    high: Number(await root.locator('[data-testid="ql-result-high"]').getAttribute("data-cents")),
    lowGross: Number(await root.locator('[data-testid="ql-vat-note"]').getAttribute("data-low-gross-cents")),
    highGross: Number(await root.locator('[data-testid="ql-vat-note"]').getAttribute("data-high-gross-cents")),
  };
  const exp = { low: expected.lowCents, high: expected.highCents, lowGross: expected.vat.lowGrossCents, highGross: expected.vat.highGrossCents };
  p.check("cents match @quotelet/core", JSON.stringify(got) === JSON.stringify(exp), `browser ${JSON.stringify(got)} vs core ${JSON.stringify(exp)}`);
  const state = await ql(page);
  const url = state.opened[0]?.url ?? "";
  const expUrl = buildWhatsAppUrl(cfg, expected, { name: "Giulia" });
  p.check("WhatsApp handoff intercepted, wa.me URL + text match core", state.opened.length === 1 && url === expUrl, url.slice(0, 60) + "…");
  const text = decodeURIComponent(url.slice(url.indexOf("?text=") + 6));
  p.check("message has business, 5 answer lines, range, VAT note, name", ["Rossi Tinteggiature", "Giulia", "Prezzi IVA esclusa (22%)", "- Metri quadri di pavimento: 75 m²", "- Colore: Colorato"].every((s) => text.includes(s)) && text.split("\n").filter((l) => l.startsWith("- ")).length === 5);
  const origin = new URL(base).origin;
  const bad = w.requests.filter((r) => r.method !== "GET" || new URL(r.url).origin !== origin);
  p.check("zero non-GET or third-party requests", bad.length === 0, `${w.requests.length} requests, all GET same-origin${bad.length ? `; bad: ${bad.map((b) => b.url).join(", ")}` : ""}`);
  p.check("no console errors / page errors", w.console.length === 0 && w.pageErrors.length === 0 && state.errors.length === 0, [...w.console, ...w.pageErrors].join("; "));
  p.check("<= 8 actions", p.actions <= 8, `${p.actions} actions, ${Date.now() - t0} ms`);
  const leadEv = state.events.filter((e: any) => e.type === "quotelet:lead").map((e: any) => e.detail);
  p.check("lead event carries no PII", JSON.stringify(leadEv) === JSON.stringify([{ channel: "whatsapp", id: "imbianchino-it" }]) && !JSON.stringify(state.events).includes("Giulia"));
  const store = await page.evaluate(() => ({ l: localStorage.length, s: sessionStorage.length }));
  p.check("no cookies / storage written", (await ctx.cookies()).length === 0 && store.l === 0 && store.s === 0);
  await page.screenshot({ path: join(ROOT, "proof", "sim-giulia-harness-375.png"), fullPage: true });
  await ctx.close();
  return p;
}

// ---------------- Persona 3: Sara (web designer, plain + hostile host, two widgets) ----------------
async function sara(browser: Browser, base: string): Promise<Persona> {
  const p = new Persona("3", "Sara, freelance web designer (embed snippet on plain.html + hostile.html, two widgets)");
  log(`- Persona 3: ${p.name}`);
  const enc2 = encodeConfig(getTemplate("painting-en"));
  const q = `?config=/fixtures/config-imbianchino.json&enc2=${enc2}`;
  const styles: Record<string, unknown> = {};
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  for (const name of ["plain.html", "hostile.html"]) {
    const { page, w } = await watchedPage(ctx);
    await page.goto(`${base}/harness/${name}${q}`); p.actions++;
    await settled(page, 2);
    // No named helper functions inside evaluate(): tsx would wrap them with __name (undefined in the page).
    styles[name] = await page.evaluate(() => ["w1", "w2"].map((id) => {
      const host = document.getElementById(id)!;
      const r = host.shadowRoot!;
      return [host, r.querySelector(".t"), r.querySelector("label"), r.querySelector("input"), r.querySelector('[data-testid="ql-result-high"]'), r.querySelector("button")].map((el) => {
        if (!el) return null;
        const s = getComputedStyle(el);
        return [s.fontSize, s.color, s.fontFamily, s.display, s.paddingTop, s.backgroundColor, s.borderTopWidth].join("|");
      });
    }));
    const st = await ql(page);
    const ready = st.events.filter((e: any) => e.type === "quotelet:ready").map((e: any) => `${e.host}:${e.detail.id}`).sort();
    p.check(`${name}: both widgets mount and fire quotelet:ready`, JSON.stringify(ready) === JSON.stringify(["w1:imbianchino-it", "w2:painting-en"]), ready.join(", "));
    if (name === "hostile.html") {
      const w1 = page.locator('#w1 [data-testid="ql-result-high"]'), w2 = page.locator('#w2 [data-testid="ql-result-high"]');
      const before = [await w1.getAttribute("data-cents"), await w2.getAttribute("data-cents")];
      const n0 = st.events.length;
      await page.locator('#w1 [data-testid="ql-field-mq"]').fill("120"); p.actions++;
      const after = [await w1.getAttribute("data-cents"), await w2.getAttribute("data-cents")];
      const st2 = await ql(page);
      const newEv = st2.events.slice(n0).map((e: any) => `${e.type}@${e.host}`);
      p.check("widgets are independent (w1 changes, w2 untouched)", before[0] !== after[0] && before[1] === after[1], `w1 ${before[0]}→${after[0]}, w2 ${before[1]}→${after[1]}`);
      p.check("quotelet:quote fires on the changed widget only", newEv.length > 0 && newEv.every((e: string) => e === "quotelet:quote@w1"), newEv.join(", "));
      await page.screenshot({ path: join(ROOT, "proof", "sim-sara-hostile-1280.png"), fullPage: true });
    }
    p.check(`${name}: no page errors, host script ran`, w.pageErrors.length === 0 && st.hostAlive === true);
    await page.close();
  }
  const same = JSON.stringify(styles["plain.html"]) === JSON.stringify(styles["hostile.html"]);
  p.check("Shadow DOM isolation: computed styles identical on plain vs hostile host", same, same ? "host * {font-size:40px!important;color:red!important} etc. had no effect" : JSON.stringify(styles));
  const gz = gzipSync(readFileSync(join(ROOT, "dist", "quotelet.js"))).length;
  p.check("bundle <= 15 KB gzip", gz <= 15360, `${gz} B gzip`);
  await ctx.close();
  return p;
}

// ---------------- Persona 4: Alex (dev from HN, README quickstart) ----------------
async function alex(browser: Browser, base: string): Promise<Persona> {
  const p = new Persona("4", "Alex, dev from HN (README quickstart: templates → validate → quote --json → link → open)");
  log(`- Persona 4: ${p.name}`);
  const readme = readFileSync(join(ROOT, "README.md"), "utf8");
  const block = /```sh quickstart\n([\s\S]*?)```/.exec(readme)?.[1] ?? "";
  const cmds = block.split("\n").map((l) => l.trim()).filter((l) => l && !l.startsWith("#"));
  p.check("README has a quickstart block", cmds.length >= 4, `${cmds.length} commands`);
  const t0 = Date.now();
  const outs: string[] = [];
  let allZero = true;
  for (const raw of cmds) {
    if (raw.startsWith("bun install")) { log(`    $ ${raw}   (skipped: already installed by the harness run)`); continue; }
    const cmd = raw.replaceAll("http://127.0.0.1:4173", base);
    const r = spawnSync("bash", ["-c", cmd], { cwd: ROOT, encoding: "utf8" });
    p.actions++;
    log(`    $ ${cmd} -> exit ${r.status}`);
    allZero &&= r.status === 0;
    outs.push(r.stdout);
  }
  const secs = (Date.now() - t0) / 1000;
  p.check("every command exits 0", allZero);
  const quoteOut = outs.find((o) => o.trim().startsWith("{"));
  let q: any = null;
  try { q = JSON.parse(quoteOut ?? ""); } catch { /* reported below */ }
  p.check("quote --json parses", !!q && Number.isInteger(q.lowCents), q ? `low ${q.lowCents} high ${q.highCents} cents` : "no JSON");
  const link = outs.map((o) => o.trim()).find((o) => o.includes("/q#c=")) ?? "";
  p.check("link prints <base>/q#c=…", link.startsWith(`${base}/q#c=`), link.slice(0, 60) + "…");
  const ctx = await browser.newContext();
  const { page, w } = await watchedPage(ctx);
  await page.goto(link); p.actions++;
  await settled(page);
  await page.locator('#w1 [data-testid="ql-field-mq"]').fill("80");
  const hi = Number(await page.locator('#w1 [data-testid="ql-result-high"]').getAttribute("data-cents"));
  p.check("opened link shows the calculator; mq=80 matches the CLI quote", !!q && hi === q.highCents && w.pageErrors.length === 0, `widget high ${hi} vs CLI ${q?.highCents}`);
  await ctx.close();
  const total = (Date.now() - t0) / 1000;
  p.check("start to finish < 2 min", total < 120, `${total.toFixed(1)} s (CLI ${secs.toFixed(1)} s)`);
  return p;
}

// ---------------- Persona 5: Mallory (hostile config author) ----------------
async function mallory(browser: Browser, base: string): Promise<Persona> {
  const p = new Persona("5", "Mallory, hostile config author (injection formula, XSS label, 50 KB config, garbage base64)");
  log(`- Persona 5: ${p.name}`);
  const big = { ...fx("config-imbianchino.json"), disclaimer: "A".repeat(500), fields: Array.from({ length: 12 }, (_, i) => ({ id: `f${i}`, type: "choice", label: "L".repeat(80), options: Array.from({ length: 20 }, (_, j) => ({ label: `${"<b>".repeat(20)}${j}`, value: j })), default: 0 })), formula: "f0", padding: "P".repeat(30000) };
  const cases: { name: string; frag: string; expectError: boolean }[] = [
    { name: "injection formula", frag: b64u(JSON.stringify(fx("config-invalid-formula.json"))), expectError: true },
    { name: "XSS label + script title", frag: encodeConfig(fx("config-xss-label.json")), expectError: false },
    { name: "50 KB config", frag: b64u(JSON.stringify(big)), expectError: true },
    { name: "garbage base64", frag: "!!!%%%<script>alert(1)</script>", expectError: true },
    { name: "valid base64 of non-JSON", frag: b64u("alert(1)//"), expectError: true },
    { name: "prototype pollution JSON", frag: b64u('{"__proto__":{"polluted":1},"constructor":{"prototype":{"x":1}}}'), expectError: true },
  ];
  log(`    50 KB case: fragment ${cases[2].frag.length} chars`);
  for (const c of cases) {
    const ctx = await browser.newContext();
    const { page, w } = await watchedPage(ctx);
    await page.goto(`${base}/q#c=${c.frag}`); p.actions++;
    await settled(page);
    await page.waitForTimeout(150);
    const st = await page.evaluate(() => {
      const r = document.getElementById("w1")!.shadowRoot!;
      return {
        error: !!r.querySelector('[data-testid="ql-error"]'), calc: !!r.querySelector('[data-testid="ql-result-low"]'),
        injected: r.querySelectorAll("img,script,iframe,object,b").length, xss: (window as any).__qlXss, polluted: ({} as any).polluted,
        hostAlive: (window as any).__ql.hostAlive, winErrors: (window as any).__ql.errors, dialogs: (window as any).__ql.dialogs,
      };
    });
    const shownRight = c.expectError ? st.error && !st.calc : !st.error && st.calc;
    const literal = c.expectError || (await page.locator('#w1 label[for="ql-f-mq"]').textContent()) === "<img src=x onerror=alert(1)>";
    const safe = st.injected === 0 && st.xss === undefined && st.polluted === undefined && w.dialogs.length === 0 && st.dialogs.length === 0;
    const alive = st.hostAlive === true && w.pageErrors.length === 0 && st.winErrors.length === 0;
    p.check(`${c.name}: ${c.expectError ? "ql-error shown" : "renders as literal text"}; no dialog/script; host alive; no throw`, shownRight && literal && safe && alive,
      `error=${st.error} calc=${st.calc} injected=${st.injected} dialogs=${w.dialogs.length} pageErrors=${w.pageErrors.length}`);
    await ctx.close();
  }
  return p;
}

async function main() {
  const b = spawnSync("bun", ["packages/widget/build.ts"], { cwd: ROOT, encoding: "utf8" });
  if (b.status !== 0) { console.error(b.stderr); process.exit(1); }
  const server = await startHarness();
  const browser = await chromium.launch({ headless: true });
  log(`\n=== sim:d003 ${now.toISOString()} (local ${now.toLocaleString("it-IT", { timeZone: "Europe/Rome" })} Europe/Rome) ===`);
  log(`harness ${server.url} · chromium ${browser.version()} · ${b.stdout.trim()}`);
  const results: Persona[] = [];
  for (const run of [giulia, sara, alex, mallory]) {
    try { results.push(await run(browser, server.url)); }
    catch (e) { const p = new Persona(run.name, run.name); p.check("journey completed", false, String(e)); results.push(p); }
  }
  await browser.close();
  await server.close();
  const passed = results.filter((r) => r.ok).length;
  const checks = results.reduce((n, r) => n + r.checks.length, 0);
  const failed = results.reduce((n, r) => n + r.checks.filter((c) => !c.ok).length, 0);
  log(`SUMMARY sim:d003 personas ${passed}/${results.length} passed (${results.map((r) => `P${r.id} ${r.ok ? "PASS" : "FAIL"}`).join(", ")}); checks ${checks - failed}/${checks} passed`);
  let code = passed === results.length ? 0 : 1;
  if (mode === "all") {
    if (existsSync(join(ROOT, "sim", "d004.ts"))) {
      log("sim (all): running D-004 personas via sim/d004.ts (owned by UI/UX)");
      const r = spawnSync("node", ["--import", "tsx", "sim/d004.ts"], { cwd: ROOT, stdio: "inherit" });
      code ||= r.status ?? 1;
    } else log("sim (all): sim/d004.ts not present yet (D-004)");
  }
  process.exit(code);
}
main().catch((e) => { console.error(e); process.exit(1); });
