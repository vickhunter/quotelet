// Writes eval/fixtures/pricelists.json (the 30 cases) and eval/fixtures/recorded-dry.json.
// recorded-dry.json holds SYNTHETIC, hand-designed model answers for two profiles ("dry-8b",
// "dry-70b") so `eval:aperto --dry` can prove the harness offline. They are derived from the gold
// configs with deliberate, typical LLM mistakes. They are NOT Apertus output and say nothing about
// Apertus quality. Run: bun packages/aperto/eval/build-fixtures.ts
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { CASES, type EvalCase } from "./cases.ts";

type Rec = { responses: string[]; usage: { promptTokens: number; completionTokens: number }[]; latencyMs: number[] };
type Mut = (c: any, ec: EvalCase) => any;
const clone = <T>(x: T): T => JSON.parse(JSON.stringify(x));
const replaceId = (formula: string, from: string, to: string) => formula.replace(new RegExp(`\\b${from}\\b`, "g"), to);

// ---- typical mistakes ----
const badFormula: Mut = (c) => { const f = c.fields[0].id; c.formula = replaceId(c.formula, f, f === "quantita" ? "qty" : "quantita"); return c; };
const badField: Mut = (c) => { const t = c.fields.find((f: any) => f.type === "toggle"); if (t) t.on = "extra"; else { c.fields[0].min = c.fields[0].max; } return c; };
const wrongMin: Mut = (c) => { c.formula = c.formula.replace(/max\((\d+(?:\.\d+)?),/, (_: string, n: string) => `max(${Math.round(Number(n) * 0.8)},`); return c; };
const dropToggle: Mut = (c) => {
  const i = c.fields.map((f: any) => f.type).lastIndexOf("toggle");
  if (i < 0) return c;
  const t = c.fields[i];
  c.fields.splice(i, 1);
  c.formula = replaceId(c.formula, t.id, String(t.off));
  return c;
};
const vatFlip: Mut = (c) => { if (c.vat) c.vat.pricesInclude = !c.vat.pricesInclude; return c; };
const renameIds: Mut = (c) => {
  c.fields.forEach((f: any, i: number) => { const n = `f${i + 1}_${f.id.slice(0, 6)}`.replace(/_+$/, ""); c.formula = replaceId(c.formula, f.id, n); f.id = n; });
  c.fields.reverse();
  return c;
};
const umzugOneFloor: Mut = (c) => {
  c.fields = c.fields.filter((f: any) => f.id !== "etage_einzug");
  c.fields.find((f: any) => f.id === "etage_auszug").label = "Stockwerk";
  c.formula = "max(300, volumen * 45 + etage_auszug * 20 * ohne_lift)";
  return c;
};
const idraulicoLaborOnly: Mut = (c) => { c.formula = "40 + ore * 35 * weekend"; return c; };
const ambiguousAlt: Record<string, Mut> = {
  "fr-demenagement-geneve": (c) => { c.formula = c.formula.replace("volume * 40", "volume * 45"); c.range = { low: 0.9, high: 1.1 }; return c; },
  "it-giardinaggio-vago": (c) => { c.formula = "ore * 30"; return c; },
  "de-fenster-luzern": (c) => c,
  "en-dog-walking": (c) => { c.currency = "CHF"; c.locale = "en-CH"; return c; },
};

// ---- per-profile plans: caseId -> [first answer mutation(s), repair answer mutation(s)] ----
type Plan = { first: Mut[]; repair?: Mut[] | "same"; proseOnly?: boolean };
const P = (first: Mut[], repair?: Mut[] | "same"): Plan => ({ first, repair });
const plans: Record<string, Record<string, Plan>> = {
  "dry-70b": {
    "it-sci-airolo": P([badFormula], []),
    "de-catering-winterthur": P([badField], []),
    "it-idraulico-roma": P([idraulicoLaborOnly]),
    "de-umzug-lugano": P([umzugOneFloor]),
    "fr-demenagement-geneve": P([ambiguousAlt["fr-demenagement-geneve"]]),
    "it-traslochi-milano": P([renameIds]),
    "fr-guitare-vevey": P([renameIds]),
    "en-moving-geneva": P([renameIds]),
  },
  "dry-8b": {
    "it-sci-airolo": P([badFormula], []),
    "en-moving-geneva": P([badFormula], []),
    "de-catering-winterthur": P([badFormula], "same"),
    "fr-guitare-vevey": P([badField], "same"),
    "de-velo-stgallen": P([badField], []),
    "it-fotografo-firenze": P([badField], []),
    "it-traslochi-milano": P([wrongMin]),
    "fr-peinture-fribourg": P([wrongMin]),
    "it-imbianchino-padova": P([dropToggle]),
    "en-cleaning-zurich": P([dropToggle]),
    "de-maler-zuerich": P([vatFlip]),
    "it-idraulico-roma": P([idraulicoLaborOnly]),
    "de-umzug-lugano": P([umzugOneFloor]),
    "fr-demenagement-geneve": P([ambiguousAlt["fr-demenagement-geneve"]]),
    "it-giardinaggio-vago": P([ambiguousAlt["it-giardinaggio-vago"]]),
    "en-dog-walking": P([ambiguousAlt["en-dog-walking"]]),
    "en-garden-basel": { first: [], repair: [], proseOnly: true },
    "de-garten-basel": P([renameIds]),
    "it-pulizie-torino": P([renameIds]),
  },
};

const PROSE: Record<string, string> = { it: "Ecco la configurazione:", de: "Hier ist die Konfiguration:", fr: "Voici la configuration :", en: "Here is the config:" };
function wrap(json: string, i: number, lang: string): string {
  switch (i % 4) {
    case 0: return json;
    case 1: return `${PROSE[lang]}\n\`\`\`json\n${json}\n\`\`\``;
    case 2: return `${PROSE[lang]}\n\n${json}`;
    default: return `\`\`\`\n${json}\n\`\`\``;
  }
}
const apply = (gold: any, muts: Mut[], ec: EvalCase) => muts.reduce((c, m) => m(c, ec), clone(gold));

function record(profile: string, idx: number, ec: EvalCase): Rec {
  const plan = plans[profile][ec.id] ?? { first: [] };
  const big = profile === "dry-70b";
  const answers: string[] = [];
  if (plan.proseOnly) answers.push(ec.lang === "en" ? "Sure! The garden service costs CHF 70 per hour plus travel." : "OK.");
  else answers.push(wrap(JSON.stringify(apply(ec.gold, plan.first, ec)), idx, ec.lang));
  if (plan.repair !== undefined) answers.push(plan.repair === "same" ? answers[0] : JSON.stringify(apply(ec.gold, plan.repair, ec)));
  const usage = answers.map((a, k) => ({ promptTokens: 1450 + Math.round(ec.text.length / 3) + k * (380 + Math.round(answers[0].length / 3.5)), completionTokens: Math.round(a.length / 3.4) }));
  const latencyMs = answers.map((_, k) => (big ? 3800 + ((idx * 137 + k * 311) % 2600) : 1100 + ((idx * 89 + k * 173) % 950)));
  return { responses: answers, usage, latencyMs };
}

const out = join(import.meta.dir, "fixtures");
writeFileSync(join(out, "pricelists.json"), JSON.stringify(CASES, null, 1) + "\n");
const profiles: Record<string, Record<string, Rec>> = {};
for (const p of Object.keys(plans)) { profiles[p] = {}; CASES.forEach((c, i) => { profiles[p][c.id] = record(p, i, c); }); }
writeFileSync(join(out, "recorded-dry.json"), JSON.stringify({
  note: "SYNTHETIC answers derived from the gold configs with deliberate typical mistakes (see build-fixtures.ts). Not Apertus output; only proves the eval harness offline.",
  profiles,
}, null, 1) + "\n");
console.log(`wrote ${CASES.length} cases and ${Object.keys(profiles).length} dry profiles to ${out}`);
