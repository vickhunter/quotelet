# Quotelet

Open-source instant quote calculator for service businesses: one script tag or a share link gives visitors a price range with VAT, and the lead goes to the owner's WhatsApp or email. No server, no stored data.

Status: local prep package (P-02). No remote yet; the public repo comes after D-003 and D-004 are accepted (D-005).

- Spec and interface contract: `docs/design.md` (canonical copy at `[internal notes, not published]`; if they differ, the shared one wins)
- Acceptance scenarios: `features/quotelet.feature`
- Persona simulations: `sims/personas.md`
- Launch drafts (Victor posts): `gtm/launch-drafts.md`

License: MIT (added with D-005).

## Developer quickstart (D-003: engine, widget, CLI)

```sh quickstart
bun install
bun packages/cli/index.ts templates
bun packages/cli/index.ts validate templates/imbianchino-it.json
bun packages/cli/index.ts quote templates/imbianchino-it.json --set mq=80 --json
bun packages/cli/index.ts link templates/imbianchino-it.json --base http://127.0.0.1:4173
```

Embed (after `bun packages/widget/build.ts` builds `dist/quotelet.js`, ≤15 KB gzip):

```html
<div data-quotelet data-config-url="/calc.json"></div>
<script src="https://<host>/quotelet.js" defer></script>
```

Checks: `bun test` (unit) · `bun run bdd --tags @D-003` (Gherkin, Playwright chromium) · `bun run sim:d003` (personas 1, 3, 4, 5; log in `proof/sim-<date>.log`). Local harness: `bun harness/server.ts` then open `http://127.0.0.1:4173/`.
