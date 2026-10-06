// AI Engineer steps for @aperto-api (H-01). In-process handler, APERTUS_MOCK=1, no browser, no network.
import { Given, Then, When } from "@cucumber/cucumber";
import assert from "node:assert/strict";
import { computeQuote, validateConfig, type Answers, type Config } from "../../packages/core/src/index.ts";
import { createApertoHandler } from "../../packages/aperto/src/proxy.ts";
import { EXAMPLES } from "../../packages/aperto/src/examples.ts";

let handler: ((req: Request) => Promise<Response>) | undefined;
let last: any;
const post = async (body: unknown) => {
  const res = await handler!(new Request("http://127.0.0.1:4173/api/aperto", { method: "POST", headers: { "content-type": "application/json", origin: "http://127.0.0.1:4173" }, body: JSON.stringify(body) }));
  return { status: res.status, json: await res.json() };
};
const answers = (s: string): Answers => Object.fromEntries(s.split(",").map((kv) => { const [k, v] = kv.trim().split("="); return [k, v === "true" ? true : v === "false" ? false : Number(v)]; }));
const SP = /[\u00a0\u202f\u2007]/g;

Given("the Aperto API runs with recorded Apertus answers", () => {
  handler = createApertoHandler({ env: { APERTUS_MOCK: "1" }, ratePerMinute: 1000 });
});

When("the owner posts the {string} example price list in {string} to the Aperto API", async (id: string, lang: string) => {
  const ex = EXAMPLES.find((e) => e.id === id);
  assert.ok(ex, `unknown example ${id}`);
  last = await post({ action: "config", text: ex.text, lang });
});

Then("the Aperto API answers ok with a valid config of {int} fields in {string} after {int} attempt(s)", (n: number, currency: string, attempts: number) => {
  assert.equal(last.status, 200);
  assert.equal(last.json.ok, true, JSON.stringify(last.json.errors));
  assert.equal(validateConfig(last.json.config).ok, true);
  assert.equal(last.json.config.fields.length, n);
  assert.equal(last.json.config.currency, currency);
  assert.equal(last.json.attempts, attempts);
});

Then("core quotes {string} on that config as {int} to {int} cents", (a: string, low: number, high: number) => {
  const q = computeQuote(last.json.config as Config, answers(a));
  assert.deepEqual([q.lowCents, q.highCents], [low, high]);
});

Then("the Aperto API answers not ok after {int} attempts and asks for a concrete number", (attempts: number) => {
  assert.equal(last.json.ok, false);
  assert.equal(last.json.attempts, attempts);
  assert.ok(last.json.errors.length > 1);
  assert.ok(last.json.errors.some((e: any) => e.path === "text" && /number/i.test(e.message)));
});

Then("the Aperto message for {string} in it, de, fr and en contains only core's formatted amounts", async (a: string) => {
  const config = last.json.config as Config;
  const quote = computeQuote(config, answers(a));
  const allowed = [quote.display.low, quote.display.high].map((s) => s.replace(SP, " "));
  for (const lang of ["it", "de", "fr", "en"]) {
    const r = await post({ action: "message", config, quote, lang });
    assert.equal(r.json.ok, true);
    for (const s of allowed) assert.ok(r.json.text.includes(s), `${lang}: missing ${s} in ${r.json.text}`);
    let rest: string = r.json.text;
    for (const s of allowed) rest = rest.split(s).join(" ");
    rest = rest.replace(/8[.,]1/g, " "); // the VAT rate
    assert.deepEqual(rest.match(/\d+/g) ?? [], [], `${lang}: extra numbers in ${r.json.text}`);
  }
});
