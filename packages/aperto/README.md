# @quotelet/aperto

Quotelet Aperto (Hack Apertus, Track 2B). [Apertus](https://huggingface.co/swiss-ai) turns a plain-language price list (IT/DE/FR/EN) into a **validated** Quotelet config v1. It also writes the customer message in the customer's language. **The LLM never computes prices.** It only emits a config that `@quotelet/core` accepts or rejects (`validateConfig` + `compileFormula`), plus wording with placeholders that core fills with its own formatted amounts.

```
owner text ──► Apertus ──► JSON ──► validateConfig + compileFormula ──ok──► config (URL fragment, never stored)
                  ▲                         │ errors
                  └──── one repair retry ◄──┘ (then hard fail: error list)

quote (core cents) ──► Apertus writes wording with {LOW} {HIGH} {VAT} ──► checks: no digits, placeholders present
                                                                       ──► core fills amounts ──► text
                                                       (invalid twice / model down ──► per-language template)
```

## HTTP contract: `POST /api/aperto` (hack-apertus-quotelet.md section 9)

Transport: `Content-Type: application/json`, body ≤ **4096 bytes** (413 above), `text` ≤ 3000 chars. Per-IP token bucket of **10 requests/min** (429 + `Retry-After`). It is **best-effort**: in-memory, per server instance, so serverless cold starts and parallel instances each keep their own bucket. Same-origin only: no `Access-Control-Allow-*` headers are ever sent, and a request whose `Origin` differs from the request's own origin gets 403. The API key stays on the server and is never echoed. All responses are `Cache-Control: no-store`. Nothing is logged or stored.

Types: `packages/aperto/src/types.ts` (`ConfigRequest`, `ConfigResponse`, `MessageRequest`, `MessageResponse`, `ProxyError`, `PROXY_LIMITS`, `Lang`).

### action `config`
```jsonc
// request
{ "action": "config", "text": "Umzug: 45 CHF pro m³, +20 CHF pro Stockwerk ohne Lift, mindestens 300 CHF, MwSt 8.1% inklusive", "lang": "de" }   // lang: "it" | "de" | "fr" | "en"
// 200 success
{ "ok": true, "config": { "v": 1, "id": "umzug-lugano", "locale": "de-CH", "currency": "CHF", "...": "validated config v1" }, "attempts": 1, "warnings": [ { "path": "formula", "message": "..." } ] }
// 200 failure (model answered, validator rejected it twice)
{ "ok": false, "errors": [ { "path": "fields[1].on", "message": "must be a number" }, { "path": "text", "message": "Add a concrete number ..." } ], "attempts": 2 }
```
- `attempts` is the number of model calls: 1, or 2 after the single repair retry. It is 0 when the request was rejected before any model call.
- `config` is the normalised output of `validateConfig`, so it can go straight into `encodeConfig` / `/q#c=…`.
- `warnings` come from core (for example division by zero with the defaults) plus Aperto's own checks:
  - `business.whatsapp` / `business.email` are dropped when they do not appear in the owner's text (stops prompt injection and hallucinated contacts from routing leads elsewhere).
  - `formula`: numbers in the formula that are not in the text ("grounding" check).
- Model unreachable or not configured: `{ ok:false, errors:[{ path:"model", message }], attempts }` (HTTP 503 when nothing is configured, 200 otherwise).

### action `message`
```jsonc
// request: quote = computeQuote(config, answers) from @quotelet/core
{ "action": "message", "config": { "v": 1, "...": "..." }, "quote": { "lowCents": 86000, "highCents": 106000, "vat": { "...": "..." }, "...": "..." }, "lang": "it" }
// 200 success
{ "ok": true, "text": "Buongiorno! La stima è tra CHF 860.00 e CHF 1’060.00. IVA 8.1% inclusa.", "source": "model" }   // or "template"
// 400 failure (bad config/quote)
{ "ok": false, "errors": [ { "path": "config.formula", "message": "..." } ] }
```
- The server re-validates `config` with `validateConfig`. It reads only the cents in `quote` (`lowCents`, `highCents`, `vat.lowGrossCents`, `vat.highGrossCents`, `vat.rate`, `vat.pricesInclude`) and re-formats them with core `formatMoney` (the same function behind `computeQuote` and the widget; Swiss grouping is always U+2019 on every runtime; NBSP normalised to spaces as in `buildLeadMessage`). Client `display` strings are ignored.
- The model must return wording containing `{LOW}` and `{HIGH}`, plus `{VAT}` when the config shows VAT. `{BUSINESS}` is optional. Any digit, any other `{…}` placeholder, any link, or more than 600 chars means rejection. After one repair retry, the server falls back to a fixed template in the requested language (`source:"template"`). If the model is down or not configured, the template is used straight away. So `message` returns `ok:false` only for a bad request.
- `{VAT}` becomes e.g. "IVA 8.1% inclusa." (prices include VAT) or "IVA 22% esclusa; con IVA: 1.293,20 € – 1.744,60 €." (prices exclude VAT, gross range from core cents).

### Request-level errors (both actions)
| HTTP | When | Body |
|---|---|---|
| 400 | not JSON, unknown action, bad `lang`, empty/too long `text`, invalid `config`/`quote` | `{ ok:false, errors:[{path,message}] }` (+ `attempts:0` for `config`) |
| 403 | `Origin` header present and not same-origin | same |
| 405 | method other than POST (OPTIONS too: no CORS preflight is granted) | same |
| 413 | body > 4096 bytes | same |
| 415 | `Content-Type` is not `application/json` | same |
| 429 | rate limit; `Retry-After` seconds | same |
| 503 | `config` with no model configured (no env, no mock) | same, `path:"model"` |

## Library
```ts
import { generateConfig, draftMessage, createClient, clientFromEnv, EXAMPLES } from "@quotelet/aperto";
import { createApertoHandler, handler } from "@quotelet/aperto/proxy";   // (req: Request) => Promise<Response>

await generateConfig(text, "de", { client })        // ConfigResponse + trace (latency, tokens per attempt)
await draftMessage(config, quote, "it", { client }) // { ok:true, text, source, attempts, errors, trace }
```
`client` is any `ChatClient`. Tests inject recorded answers, so `bun test` makes no network calls.

## Environment
| Var | Meaning |
|---|---|
| `APERTUS_BASE_URL` | OpenAI-compatible base URL, e.g. `https://<provider>/v1` or `http://127.0.0.1:8000/v1` (vLLM) / `http://127.0.0.1:11434/v1` (Ollama). `/chat/completions` is appended |
| `APERTUS_MODEL` | model id served there (e.g. `swiss-ai/Apertus-8B-Instruct-2509`) |
| `APERTUS_API_KEY` | bearer token; optional for local servers. Server-side only |
| `APERTUS_MODEL_SMALL` / `APERTUS_MODEL_LARGE` | eval: compare two models (8B vs 70B) on the same endpoint |
| `APERTUS_MOCK=1` | use the recorded answers in `fixtures/` (no network, no key): the 4 `EXAMPLES` + the 30 eval lists |
| `APERTUS_TIMEOUT_MS` | per-call timeout (default 20000; the eval uses at least 60000) |
| `APERTUS_RATE_PER_MINUTE` | per-IP token bucket size/refill (default 10; local mock server defaults to 600 so BDD runs don't hit 429) |
| `APERTUS_PRICE_SMALL` / `APERTUS_PRICE_LARGE` / `APERTUS_PRICE_MODEL` | eval only: `in/out` USD per 1M tokens for the cost column |

The client sends `User-Agent: quotelet-aperto/0.1`, which some gateways (for example Public AI) require.

`.env.local` at the repo root is loaded by the local servers (`scripts/serve.ts`, `harness/server.ts`) and by the eval. It never overrides real env vars, and the servers read it into a copy, not into `process.env`. It is git-ignored (`.env*`). On Vercel, set the vars in the project settings (preview environment only for H-01).

## Local and Vercel wiring
- `bun run serve` (built web app) and `bun harness/server.ts` (widget harness) both route `POST /api/aperto` to `localApertoHandler()` on 127.0.0.1:4173. With `APERTUS_MOCK=1` and no key you get the recorded answers.
- Vite dev server (5173): proxy `/api` to `http://127.0.0.1:4173` (UI/UX's `vite.config.ts`, not changed here).
- Vercel: `apps/web/api/aperto.ts` re-exports the handler as `export default { fetch }`. Two things to check on the first preview deploy: the function bundles files outside `apps/web` (`packages/aperto`, `packages/core`), and the SPA rewrite in `vercel.json` does not shadow `/api/*`. Functions take precedence over rewrites, but only if the deploy includes `apps/web/api` and not just the static `dist` folder.

## Recorded answers
`fixtures/recorded-demo.json` and `eval/fixtures/recorded-dry.json` are **hand-authored stand-ins** in the shape Apertus returns (prose, code fences, one broken answer). They are not captured Apertus output. They exist so tests, `APERTUS_MOCK=1` and `eval --dry` run offline. Real numbers come from `bun run eval:aperto` with a configured endpoint.
