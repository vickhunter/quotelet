# Quotelet

Open-source instant quote calculator for service businesses. Add one script tag to a site (or share one link) and visitors get a price range with VAT shown. The lead goes to the owner's WhatsApp or email. No backend, no signup, no customer data stored.

**Live demo:** https://quotelet.vercel.app · License: [MIT](LICENSE)

## What it does
- **Calculator engine** (`packages/core`): a validated JSON config (number, choice and toggle fields), a safe formula language (no `eval`), min-max range, rounding, VAT, all in integer cents. One formatter (`formatMoney`) prints every amount the same way on every runtime.
- **Widget** (`packages/widget`): `dist/quotelet.js`, one file under 15 KB gzip, no network calls besides loading itself.
- **Share link**: the whole calculator lives in the URL fragment (`/q#c=…`), so a business with no website can still send a link.
- **Builder** (`apps/web`, `/build`): pick a template, set prices and labels, get a share link and an embed snippet. English and Italian.
- **CLI** (`packages/cli`): list templates, validate configs, compute quotes, make links.
- **Quotelet Aperto** (`packages/aperto`): describe your prices in plain words; Apertus turns them into a validated calculator (details below).

## Run it locally
Needs [Bun](https://bun.sh) 1.4+ (Node 20+ for the BDD and browser checks).

```sh
bun install
bun run build    # widget + web app into apps/web/dist
bun run serve    # http://127.0.0.1:4173
```

Add `APERTUS_MOCK=1` before `bun run serve` to try Quotelet Aperto with recorded answers and no API key.

### Embed the widget
`bun run build:widget` builds `dist/quotelet.js`. Host it next to a config JSON:

```html
<div data-quotelet data-config-url="/calc.json"></div>
<script src="https://<your-host>/quotelet.js" defer></script>
```

Start from one of the configs in `templates/` (painter, cleaning, movers in Italian; painting in English).

### Tests
`bun test` (unit) · `bun run bdd --tags @D-003` / `@aperto-api` (Gherkin acceptance; browser scenarios use Playwright chromium against a running `bun run serve`) · `bun run sim:d003` (scripted user journeys, log in `proof/sim-<date>.log`).

## CLI quickstart

```sh quickstart
bun install
bun packages/cli/index.ts templates
bun packages/cli/index.ts validate templates/imbianchino-it.json
bun packages/cli/index.ts quote templates/imbianchino-it.json --set mq=80 --json
bun packages/cli/index.ts link templates/imbianchino-it.json --base http://127.0.0.1:4173
```

Or via the root script: `bun run cli <command>`.

## Quotelet Aperto (Hack Apertus, Track 2B)

Describe your prices in plain Italian, German, French or English. [Apertus](https://huggingface.co/swiss-ai) turns the text into a **validated** Quotelet calculator and writes each customer's quote message in the customer's language. **The LLM never does the math.**

```
"Umzug: 45 CHF pro m³, +20 CHF pro Stockwerk ohne Lift, mindestens 300 CHF, MwSt 8.1% inklusive"
        │
        ▼  Apertus (8B / 70B, OpenAI-compatible endpoint)
   config v1 JSON ──► validateConfig + compileFormula ──► errors? ──► one repair retry ──► still bad: error list shown
        │ ok (formula = data, no eval)
        ▼
   /q#c=<config in the URL fragment>  ──► computeQuote (deterministic, integer cents)
        │
        ▼  Apertus writes wording only: "…tra {LOW} e {HIGH}. {VAT}"  ──► core fills its own formatted amounts
   WhatsApp text in IT / DE / FR / EN (a model that writes a digit is rejected; per-language template fallback)
```

- Code: `packages/aperto` (client, `generateConfig`, `draftMessage`, proxy, eval). API contract and shapes: [`packages/aperto/README.md`](packages/aperto/README.md).
- Local run with no key: `APERTUS_MOCK=1 bun run serve` (or `APERTUS_MOCK=1 bun harness/server.ts`). `POST http://127.0.0.1:4173/api/aperto` replays recorded answers for the example price lists.
- Local run with Apertus: put the env vars below in `.env.local` (git-ignored), then `bun run serve`.

### Environment
| Var | Required | Meaning |
|---|---|---|
| `APERTUS_BASE_URL` | yes (real model) | OpenAI-compatible base URL (`…/v1`). The CSCS inference endpoint from the hackathon guide, a provider, or your own vLLM/Ollama |
| `APERTUS_MODEL` | yes (real model) | model id, e.g. `swiss-ai/Apertus-v1.5-8B` / `swiss-ai/Apertus-v1.5-70B` (provider ids differ, e.g. `swiss-ai/apertus-v1.5-70b`) |
| `APERTUS_API_KEY` | provider-dependent | bearer token. Read only on the server, never sent to the browser, never logged |
| `APERTUS_MODEL_SMALL`, `APERTUS_MODEL_LARGE` | eval | the two models compared by `bun run eval:aperto` (8B vs 70B) |
| `APERTUS_PRICE_SMALL`, `APERTUS_PRICE_LARGE` | eval, optional | `in/out` USD per 1M tokens, for the cost-per-calculator column |
| `APERTUS_MOCK` | dev/CI | `1` = recorded answers, no network |
| `APERTUS_TIMEOUT_MS`, `APERTUS_RATE_PER_MINUTE` | optional | per-call timeout (default 20000) and per-IP limit (default 10/min) |

### Eval: 30 price lists, 4 languages, 8B vs 70B
`bun run eval:aperto` runs 30 synthetic price lists (IT 10, DE 8, FR 6, EN 6; CHF and EUR; 4 deliberately ambiguous) with gold configs and 3 test inputs each against the configured endpoint. It writes `proof/aperto-eval-<date>.md`. With no endpoint it prints SKIP and exits 0. `--dry` replays synthetic recorded answers to prove the harness offline.

<!-- aperto-eval:start -->
_Dry run on synthetic recorded answers (harness proof, **not Apertus results**); real 8B vs 70B numbers pending the endpoint key._

| Model | Valid config | 1st try / after repair | Quote match (all 3 inputs) | Inputs matched | Clear / ambiguous lists | Latency p50 / p95 | Tokens per calculator | Cost per calculator |
|---|---|---|---|---|---|---|---|---|
| dry-8b (synthetic recorded answers) | 28/30 (93%) | 23 / 5 | 18/30 (60%) | 77% | 65% / 25% | 1.7 s / 3.6 s | 2149 | n/a |
| dry-70b (synthetic recorded answers) | 30/30 (100%) | 28 / 2 | 27/30 (90%) | 96% | 92% / 75% | 4.8 s / 10.4 s | 1796 | n/a |

Source: `proof/aperto-eval-2026-10-06-dry.md`.
<!-- aperto-eval:end -->

### Sovereign deployment (self-host, open weights)
Apertus is open-weights and open-data, so the whole stack can run on your own hardware. No third party ever sees a price list or a customer quote.

1. Serve the model behind an OpenAI-compatible API:
   - **vLLM** (GPU): `vllm serve swiss-ai/Apertus-v1.5-8B --max-model-len 32768` (70B: add `--tensor-parallel-size 4`). Endpoint: `http://127.0.0.1:8000/v1`.
   - **Ollama** (laptop/CPU): `ollama serve` with a GGUF quantisation of the open weights. Check that a build for your Apertus version exists, or convert one with llama.cpp. Endpoint: `http://127.0.0.1:11434/v1`.
2. Set the same env vars: `APERTUS_BASE_URL=http://127.0.0.1:8000/v1`, `APERTUS_MODEL=swiss-ai/Apertus-v1.5-8B`. No key is needed for a local server.
3. `bun install && bun run build && bun run serve`. The proxy (`packages/aperto/src/proxy.ts`) is a standard `Request → Response` function, so it runs unchanged on Bun, Node 18+, Vercel Functions or any Web-standard host.

**Nothing is stored.** The proxy keeps no database, no logs of the text and no cookies. Only an in-memory rate-limit counter per IP exists, and it is lost on restart. The generated config lives in the share link's URL fragment (`/q#c=…`), which browsers never send to the server. The customer-facing widget makes no network calls besides loading itself. The only data that leaves the browser is the owner's price-list text and, for the message, the config plus quote cents, sent to *your* model endpoint.

### Hackathon disclosure
Quotelet's first commit is 6 Oct 2026 08:46 CEST, inside the Hack Apertus period (1-16 Oct 2026). All Apertus features (`packages/aperto`, `/aperto`, the message-language toggle) were built 6-13 Oct 2026.
