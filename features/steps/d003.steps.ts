// AI Engineer steps for the @D-003 scenarios (core, widget, cli). Owner: AI Engineer.
// Widget steps run Playwright chromium against the local harness (harness/server.ts, 127.0.0.1).
import { After, AfterAll, Before, Given, Then, When } from "@cucumber/cucumber";
import { chromium, type Browser, type BrowserContext, type Page } from "playwright";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { startHarness, ROOT } from "../../harness/server.ts";
import { decodeConfig, validateConfig } from "../../packages/core/src/index.ts";

type Req = { url: string; method: string };
type D3 = {
  context?: BrowserContext; page?: Page; harnessPage?: string;
  requests: Req[]; dialogs: string[]; pageErrors: string[]; consoleErrors: string[];
  fixtureName?: string; t0?: number;
  config?: unknown; validation?: ReturnType<typeof validateConfig>;
  file?: string; cli?: { code: number | null; stdout: string; stderr: string };
};
type W = { d3: D3 };

let harness: { url: string; close(): Promise<void> } | undefined;
let browser: Browser | undefined;
const fixtureText = (n: string) => readFileSync(join(ROOT, "fixtures", n), "utf8").replace(/\n$/, "");

async function ensureEnv() {
  if (!harness) {
    const b = spawnSync("bun", ["packages/widget/build.ts"], { cwd: ROOT, encoding: "utf8" });
    if (b.status !== 0) throw new Error("widget build failed: " + b.stderr);
    harness = await startHarness();
  }
  browser ??= await chromium.launch({ headless: true });
}

async function openPage(w: W, pageName: string, query: string) {
  await ensureEnv();
  const d = w.d3;
  if (!d.context) {
    d.context = await browser!.newContext({ viewport: { width: 1280, height: 900 } });
    d.page = await d.context.newPage();
    d.page.on("request", (r) => d.requests.push({ url: r.url(), method: r.method() }));
    d.page.on("dialog", (dlg) => { d.dialogs.push(dlg.message()); void dlg.dismiss(); });
    d.page.on("pageerror", (e) => d.pageErrors.push(String(e)));
    d.page.on("console", (m) => { if (m.type() === "error") d.consoleErrors.push(m.text()); });
  }
  await d.page!.goto(`${harness!.url}/harness/${pageName}${query}`);
  await d.page!.waitForFunction(() => (window as any).__ql?.events.some((e: any) => e.type === "quotelet:ready" || e.type === "quotelet:error"), null, { timeout: 5000 });
  return d.page!;
}
const page = (w: W) => { assert.ok(w.d3.page, "no page open"); return w.d3.page!; };
const tid = (w: W, id: string) => page(w).locator(`#w1 [data-testid="${id}"]`);
const cents = async (w: W, id: string) => Number(await tid(w, id).getAttribute("data-cents"));

Before({ tags: "@D-003" }, function (this: W) {
  this.d3 = { requests: [], dialogs: [], pageErrors: [], consoleErrors: [] };
});
After({ tags: "@D-003" }, async function (this: W) {
  await this.d3?.context?.close();
});
AfterAll(async () => {
  await browser?.close();
  await harness?.close();
});

// ---------- widget mounting ----------
Given("the harness page {string} with global CSS overrides", function (this: W, name: string) {
  this.d3.harnessPage = name;
});

Given("the widget is mounted with fixture {string}", async function (this: W, name: string) {
  this.d3.fixtureName = name;
  const p = await openPage(this, this.d3.harnessPage ?? "plain.html", `?config=/fixtures/${encodeURIComponent(name)}`);
  if (this.d3.harnessPage === "hostile.html") assert.equal(await p.locator("#hostile-css").count(), 1, "hostile CSS missing");
});

When("the visitor keeps the default answers", async function (this: W) {
  await tid(this, "ql-result-low").waitFor();
});

When("the visitor sets {string} to {int}", async function (this: W, id: string, value: number) {
  this.d3.t0 = await page(this).evaluate(() => performance.now());
  await tid(this, `ql-field-${id}`).fill(String(value));
});

When("the visitor sets {string} to {int} and turns {string} off", async function (this: W, id: string, value: number, toggle: string) {
  await tid(this, `ql-field-${id}`).fill(String(value));
  await tid(this, `ql-field-${toggle}`).setChecked(false);
});

Given("the visitor typed the name {string}", async function (this: W, name: string) {
  await tid(this, "ql-name").fill(name);
});

When("the visitor taps the WhatsApp button", async function (this: W) {
  await tid(this, "ql-cta-whatsapp").click();
});

// ---------- amounts ----------
Then("the low amount is {int} cents and the high amount is {int} cents", async function (this: W, low: number, high: number) {
  assert.equal(await cents(this, "ql-result-low"), low);
  assert.equal(await cents(this, "ql-result-high"), high);
});
Then("the high amount is greater than {int} cents", async function (this: W, n: number) {
  const v = await cents(this, "ql-result-high");
  assert.ok(v > n, `high ${v} is not > ${n}`);
});
Then("the VAT note says prices exclude VAT at {int}%", async function (this: W, rate: number) {
  const t = (await tid(this, "ql-vat-note").textContent()) ?? "";
  assert.match(t, /esclusa|exclude/i);
  assert.ok(t.includes(`${rate}%`), `VAT note "${t}" lacks ${rate}%`);
  assert.equal(await tid(this, "ql-vat-note").isVisible(), true);
});
Then("the gross range is {int} to {int} cents", async function (this: W, lo: number, hi: number) {
  const v = tid(this, "ql-vat-note");
  assert.equal(Number(await v.getAttribute("data-low-gross-cents")), lo);
  assert.equal(Number(await v.getAttribute("data-high-gross-cents")), hi);
});
Then("the disclaimer is visible", async function (this: W) {
  const d = tid(this, "ql-disclaimer");
  assert.equal(await d.isVisible(), true);
  assert.ok(((await d.textContent()) ?? "").length > 10);
});
Then("a {string} event fires within {int} ms", async function (this: W, type: string, ms: number) {
  const t0 = this.d3.t0!;
  const ev = await page(this).evaluate(([type, t0]) => (window as any).__ql.events.find((e: any) => e.type === type && e.t >= (t0 as number)), [type, t0] as const);
  assert.ok(ev, `no ${type} event after the change`);
  assert.ok(ev.t - t0 <= ms, `${type} took ${Math.round(ev.t - t0)} ms`);
  assert.ok(!JSON.stringify(ev.detail).includes("Giulia"));
});

// ---------- handoff + privacy ----------
Then("the opened URL starts with {string}", async function (this: W, prefix: string) {
  const opened = await page(this).evaluate(() => (window as any).__ql.opened);
  assert.equal(opened.length, 1, `expected 1 handoff, got ${opened.length}`);
  assert.ok(opened[0].url.startsWith(prefix), opened[0].url);
  const lead = await page(this).evaluate(() => (window as any).__ql.events.filter((e: any) => e.type === "quotelet:lead").map((e: any) => e.detail));
  assert.deepEqual(lead, [{ channel: "whatsapp", id: "imbianchino-it" }]);
});
Then("the decoded text equals fixture {string}", async function (this: W, name: string) {
  const [{ url }] = await page(this).evaluate(() => (window as any).__ql.opened);
  assert.equal(decodeURIComponent(url.slice(url.indexOf("?text=") + 6)), fixtureText(name));
});
Then("the page made no network request other than the script and the config", async function (this: W) {
  const origin = harness!.url;
  const hostOwn = (u: string) => /\/harness\/[a-z]+\.(html|js)(\?|$)/.test(new URL(u).pathname + (new URL(u).search ? "?" : ""));
  const widgetReqs = this.d3.requests.filter((r) => !hostOwn(r.url));
  const allowed = [`${origin}/quotelet.js`, `${origin}/fixtures/${this.d3.fixtureName}`];
  for (const r of this.d3.requests) assert.equal(r.method, "GET", `non-GET request ${r.method} ${r.url}`);
  for (const r of widgetReqs) assert.ok(allowed.includes(r.url), `unexpected request ${r.url}`);
  assert.equal(widgetReqs.filter((r) => r.url === allowed[1]).length, 1, "config must be fetched exactly once");
});
Then("no cookie or localStorage key was written by the widget", async function (this: W) {
  assert.deepEqual(await this.d3.context!.cookies(), []);
  const s = await page(this).evaluate(() => ({ local: localStorage.length, session: sessionStorage.length }));
  assert.deepEqual(s, { local: 0, session: 0 });
});

// ---------- core validation ----------
Given("the config fixture {string}", function (this: W, name: string) {
  this.d3.fixtureName = name;
  this.d3.config = JSON.parse(readFileSync(join(ROOT, "fixtures", name), "utf8"));
});
When("the config is validated", function (this: W) {
  this.d3.validation = validateConfig(this.d3.config);
});
Then("validation fails with an error at path {string}", function (this: W, path: string) {
  const v = this.d3.validation!;
  assert.equal(v.ok, false);
  if (!v.ok) assert.ok(v.errors.some((e) => e.path === path), JSON.stringify(v.errors));
});
Then("the widget shows the {string} box instead of a calculator", async function (this: W, id: string) {
  const p = await openPage(this, "plain.html", `?config=/fixtures/${encodeURIComponent(this.d3.fixtureName!)}`);
  assert.equal(await tid(this, id).isVisible(), true);
  assert.equal(await tid(this, "ql-result-low").count(), 0);
  assert.equal(await tid(this, "ql-cta-whatsapp").count(), 0);
  const errEv = await p.evaluate(() => (window as any).__ql.events.filter((e: any) => e.type === "quotelet:error").map((e: any) => e.detail));
  assert.ok(errEv.length === 1 && errEv[0].errors.some((e: any) => e.path === "formula"));
  assert.deepEqual(this.d3.pageErrors, []);
});

// ---------- hostile page ----------
Then("the label is shown as literal text", async function (this: W) {
  const p = page(this);
  const label = await p.locator('#w1 label[for="ql-f-mq"]').textContent();
  assert.equal(label, "<img src=x onerror=alert(1)>");
  const injected = await p.evaluate(() => document.getElementById("w1")!.shadowRoot!.querySelectorAll("img, script, iframe, object").length);
  assert.equal(injected, 0);
  // Shadow DOM isolation: host CSS (40px red, display:none on inputs) does not reach the widget.
  const style = await tid(this, "ql-field-mq").evaluate((el) => { const s = getComputedStyle(el); return { fs: s.fontSize, display: s.display, color: s.color }; });
  assert.equal(style.fs, "16px");
  assert.notEqual(style.display, "none");
  assert.notEqual(style.color, "rgb(255, 0, 0)");
});
Then("no dialog or script execution happened", async function (this: W) {
  const p = page(this);
  await p.waitForTimeout(300);
  assert.deepEqual(this.d3.dialogs, []);
  const st = await p.evaluate(() => ({ dialogs: (window as any).__ql.dialogs, xss: (window as any).__qlXss }));
  assert.deepEqual(st, { dialogs: [], xss: undefined });
  assert.ok(!this.d3.requests.some((r) => /\/x(\?|$)/.test(new URL(r.url).pathname)), "img src=x was requested");
});
Then("the host page's own script still runs after the widget errors or loads", async function (this: W) {
  const p = page(this);
  assert.equal(await p.evaluate(() => (window as any).__ql.hostAlive), true);
  assert.equal(await p.locator("#host-status").textContent(), "host script ran");
  // Now make the widget error on the same page and prove host code keeps running after it.
  const after = await p.evaluate(() => {
    const el = document.createElement("div");
    document.body.appendChild(el);
    let threw = false;
    try { (window as any).Quotelet.mount(el, "%%%garbage%%%"); (window as any).Quotelet.mount(el, null); } catch { threw = true; }
    const shown = !!el.shadowRoot?.querySelector('[data-testid="ql-error"]');
    (window as any).__ql.afterError = true;
    return { threw, shown, afterError: (window as any).__ql.afterError };
  });
  assert.deepEqual(after, { threw: false, shown: true, afterError: true });
  assert.deepEqual(this.d3.pageErrors, []);
  assert.deepEqual(await p.evaluate(() => (window as any).__ql.errors), []);
});

// ---------- CLI ----------
Given("the file {string}", function (this: W, file: string) {
  this.d3.file = file;
  readFileSync(join(ROOT, file)); // throws if missing
});
When("I run {string}", function (this: W, cmd: string) {
  const [bin, ...args] = cmd.split(/\s+/);
  assert.equal(bin, "quotelet");
  const r = spawnSync("bun", ["packages/cli/index.ts", ...args], { cwd: ROOT, encoding: "utf8" });
  this.d3.cli = { code: r.status, stdout: r.stdout, stderr: r.stderr };
});
Then("it prints a URL containing {string}", function (this: W, s: string) {
  assert.equal(this.d3.cli!.code, 0, this.d3.cli!.stderr);
  const out = this.d3.cli!.stdout.trim();
  assert.ok(out.includes(s), out);
  new URL(out);
});
Then("decoding the fragment gives a config equal to the file", function (this: W) {
  const frag = this.d3.cli!.stdout.trim().split("#c=")[1];
  const d = decodeConfig(frag);
  assert.equal(d.ok, true);
  if (d.ok) assert.deepEqual(d.config, JSON.parse(readFileSync(join(ROOT, this.d3.file!), "utf8")));
});
