# Quotelet Aperto eval, 2026-10-06 (DRY RUN)

> **DRY RUN: these numbers are NOT Apertus results.** The answers are synthetic (`packages/aperto/eval/fixtures/recorded-dry.json`, made from the gold configs with deliberate typical mistakes by `build-fixtures.ts`). This run only proves that the harness, the validator loop and the scoring work offline. Real 8B vs 70B numbers come from `bun run eval:aperto` with `APERTUS_BASE_URL` + `APERTUS_MODEL_SMALL`/`APERTUS_MODEL_LARGE` set.

Endpoint: recorded fixtures (offline). Cases: 30 synthetic price lists (IT 10, DE 8, FR 6, EN 6; CHF de-CH/fr-CH/it-CH/en-CH and EUR it-IT/en-IE; 4 deliberately ambiguous), 3 test inputs each.

Pipeline per list: prompt → JSON → `validateConfig` + `compileFormula` → one repair retry with the validator errors → hard fail. **The model never computes a price.** Quote match = `computeQuote(generated)` vs `computeQuote(gold)` on the 3 inputs (low/high, net and gross, same currency, within 1% or 1 currency unit). Answers are mapped onto the generated fields by type, id, label, unit and values. A list counts as matched only if all 3 inputs match. Latency and tokens are per calculator, including the repair call.

## Summary

| Model | Valid config | 1st try / after repair | Quote match (all 3 inputs) | Inputs matched | Clear / ambiguous lists | Latency p50 / p95 | Tokens per calculator | Cost per calculator |
|---|---|---|---|---|---|---|---|---|
| dry-8b (synthetic recorded answers) | 28/30 (93%) | 23 / 5 | 18/30 (60%) | 77% | 65% / 25% | 1.7 s / 3.6 s | 2149 | n/a |
| dry-70b (synthetic recorded answers) | 30/30 (100%) | 28 / 2 | 27/30 (90%) | 96% | 92% / 75% | 4.8 s / 10.4 s | 1796 | n/a |

## By language

| Model | IT valid / match | DE valid / match | FR valid / match | EN valid / match |
|---|---|---|---|---|
| dry-8b | 10/10 / 6/10 | 7/8 / 5/8 | 5/6 / 3/6 | 6/6 / 4/6 |
| dry-70b | 10/10 / 9/10 | 8/8 / 7/8 | 6/6 / 5/6 | 6/6 / 6/6 |

## Per list: dry-8b

| List | Lang | Ambiguous | Valid | Attempts | Quotes matched | Latency | Tokens in/out | Errors |
|---|---|---|---|---|---|---|---|---|
| it-imbianchino-padova | it |  | yes | 1 | 2/3 | 1.1 s | 1494/164 |  |
| it-traslochi-milano | it |  | yes | 1 | 2/3 | 1.2 s | 1494/223 |  |
| it-pulizie-torino | it |  | yes | 1 | 3/3 | 1.3 s | 1498/188 |  |
| it-giardiniere-bologna | it |  | yes | 1 | 3/3 | 1.4 s | 1483/150 |  |
| it-idraulico-roma | it |  | yes | 1 | 2/3 | 1.5 s | 1486/145 |  |
| it-elettricista-lugano | it |  | yes | 1 | 3/3 | 1.5 s | 1484/159 |  |
| it-uffici-bellinzona | it |  | yes | 1 | 3/3 | 1.6 s | 1479/151 |  |
| it-fotografo-firenze | it |  | yes | 2 | 3/3 | 3.6 s | 3513/324 |  |
| it-giardinaggio-vago | it | yes | yes | 1 | 2/3 | 1.8 s | 1478/94 |  |
| it-sci-airolo | it |  | yes | 2 | 3/3 | 3.0 s | 3531/340 |  |
| de-umzug-lugano | de |  | yes | 1 | 2/3 | 2.0 s | 1481/186 |  |
| de-maler-zuerich | de |  | yes | 1 | 0/3 | 1.1 s | 1497/150 |  |
| de-reinigung-bern | de |  | yes | 1 | 3/3 | 1.2 s | 1503/172 |  |
| de-garten-basel | de |  | yes | 1 | 3/3 | 1.3 s | 1481/181 |  |
| de-fenster-luzern | de | yes | yes | 1 | 3/3 | 1.4 s | 1482/113 |  |
| de-velo-stgallen | de |  | yes | 2 | 3/3 | 3.1 s | 3541/356 |  |
| de-catering-winterthur | de |  | **no** | 2 | 0/3 | 3.3 s | 3508/304 | formula: Unknown identifier "quantita" (at position 0) |
| de-hundesitting-zug | de |  | yes | 1 | 3/3 | 1.7 s | 1478/170 |  |
| fr-nettoyage-lausanne | fr |  | yes | 1 | 3/3 | 1.8 s | 1495/198 |  |
| fr-demenagement-geneve | fr | yes | yes | 1 | 1/3 | 1.8 s | 1484/184 |  |
| fr-peinture-fribourg | fr |  | yes | 1 | 2/3 | 1.9 s | 1483/137 |  |
| fr-jardin-neuchatel | fr |  | yes | 1 | 3/3 | 2.0 s | 1494/182 |  |
| fr-plombier-sion | fr |  | yes | 1 | 3/3 | 1.2 s | 1490/153 |  |
| fr-guitare-vevey | fr |  | **no** | 2 | 0/3 | 2.7 s | 3530/358 | fields[2].on: must be a number |
| en-cleaning-zurich | en |  | yes | 1 | 2/3 | 1.3 s | 1493/154 |  |
| en-painting-milan | en |  | yes | 1 | 3/3 | 1.4 s | 1480/158 |  |
| en-moving-geneva | en |  | yes | 2 | 3/3 | 3.2 s | 3492/277 |  |
| en-dog-walking | en | yes | yes | 1 | 0/3 | 1.6 s | 1468/96 |  |
| en-tutoring-online | en |  | yes | 1 | 3/3 | 1.7 s | 1486/165 |  |
| en-garden-basel | en |  | yes | 2 | 3/3 | 3.7 s | 3373/166 |  |

## Per list: dry-70b

| List | Lang | Ambiguous | Valid | Attempts | Quotes matched | Latency | Tokens in/out | Errors |
|---|---|---|---|---|---|---|---|---|
| it-imbianchino-padova | it |  | yes | 1 | 3/3 | 3.8 s | 1494/197 |  |
| it-traslochi-milano | it |  | yes | 1 | 3/3 | 3.9 s | 1494/224 |  |
| it-pulizie-torino | it |  | yes | 1 | 3/3 | 4.1 s | 1498/184 |  |
| it-giardiniere-bologna | it |  | yes | 1 | 3/3 | 4.2 s | 1483/150 |  |
| it-idraulico-roma | it |  | yes | 1 | 2/3 | 4.3 s | 1486/145 |  |
| it-elettricista-lugano | it |  | yes | 1 | 3/3 | 4.5 s | 1484/159 |  |
| it-uffici-bellinzona | it |  | yes | 1 | 3/3 | 4.6 s | 1479/151 |  |
| it-fotografo-firenze | it |  | yes | 1 | 3/3 | 4.8 s | 1487/163 |  |
| it-giardinaggio-vago | it | yes | yes | 1 | 3/3 | 4.9 s | 1478/97 |  |
| it-sci-airolo | it |  | yes | 2 | 3/3 | 10.4 s | 3531/340 |  |
| de-umzug-lugano | de |  | yes | 1 | 2/3 | 5.2 s | 1481/186 |  |
| de-maler-zuerich | de |  | yes | 1 | 3/3 | 5.3 s | 1497/150 |  |
| de-reinigung-bern | de |  | yes | 1 | 3/3 | 5.4 s | 1503/172 |  |
| de-garten-basel | de |  | yes | 1 | 3/3 | 5.6 s | 1481/178 |  |
| de-fenster-luzern | de | yes | yes | 1 | 3/3 | 5.7 s | 1482/113 |  |
| de-velo-stgallen | de |  | yes | 1 | 3/3 | 5.9 s | 1493/179 |  |
| de-catering-winterthur | de |  | yes | 2 | 3/3 | 12.3 s | 3509/305 |  |
| de-hundesitting-zug | de |  | yes | 1 | 3/3 | 6.1 s | 1478/170 |  |
| fr-nettoyage-lausanne | fr |  | yes | 1 | 3/3 | 6.3 s | 1495/198 |  |
| fr-demenagement-geneve | fr | yes | yes | 1 | 1/3 | 3.8 s | 1484/184 |  |
| fr-peinture-fribourg | fr |  | yes | 1 | 3/3 | 3.9 s | 1483/137 |  |
| fr-jardin-neuchatel | fr |  | yes | 1 | 3/3 | 4.1 s | 1494/182 |  |
| fr-plombier-sion | fr |  | yes | 1 | 3/3 | 4.2 s | 1490/153 |  |
| fr-guitare-vevey | fr |  | yes | 1 | 3/3 | 4.4 s | 1488/182 |  |
| en-cleaning-zurich | en |  | yes | 1 | 3/3 | 4.5 s | 1493/180 |  |
| en-painting-milan | en |  | yes | 1 | 3/3 | 4.6 s | 1480/158 |  |
| en-moving-geneva | en |  | yes | 1 | 3/3 | 4.8 s | 1487/140 |  |
| en-dog-walking | en | yes | yes | 1 | 3/3 | 4.9 s | 1468/96 |  |
| en-tutoring-online | en |  | yes | 1 | 3/3 | 5.0 s | 1486/165 |  |
| en-garden-basel | en |  | yes | 1 | 3/3 | 5.2 s | 1488/158 |  |

Rerun: `bun run eval:aperto` (real endpoint from env or `.env.local`), `bun run eval:aperto --dry` (offline harness proof). Source: `packages/aperto/eval/`.
