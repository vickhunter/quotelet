// APERTUS_MOCK=1: an OpenAI-compatible fetch that replays recorded answers (no network, no key).
// Config requests are matched on the owner's text (case/whitespace-insensitive) against
// fixtures/recorded-demo.json and the eval's recorded-dry.json ("dry-70b" profile). Unknown
// text -> HTTP 404 (code mock_no_recording). Message requests get a fixed per-language wording.
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { CONFIG_MARKER, MESSAGE_MARKER } from "./prompt.ts";
import type { FetchLike, Lang, Usage } from "./types.ts";

type Recording = { responses: string[]; usage?: Usage[]; latencyMs?: number[] };
const PKG = fileURLToPath(new URL("../", import.meta.url));
export const normText = (s: string) => s.normalize("NFC").toLowerCase().replace(/\s+/g, " ").replace(/[\s.!]+$/, "").trim();

let cache: Map<string, Recording> | null = null;
function recordings(): Map<string, Recording> {
  if (cache) return cache;
  const map = new Map<string, Recording>();
  const demoFile = join(PKG, "fixtures", "recorded-demo.json");
  if (existsSync(demoFile)) for (const r of JSON.parse(readFileSync(demoFile, "utf8"))) map.set(normText(r.text), r);
  const dryFile = join(PKG, "eval", "fixtures", "recorded-dry.json");
  const casesFile = join(PKG, "eval", "fixtures", "pricelists.json");
  if (existsSync(dryFile) && existsSync(casesFile)) {
    const dry = JSON.parse(readFileSync(dryFile, "utf8"));
    for (const c of JSON.parse(readFileSync(casesFile, "utf8"))) {
      const r = dry.profiles?.["dry-70b"]?.[c.id];
      if (r && !map.has(normText(c.text))) map.set(normText(c.text), r);
    }
  }
  return (cache = map);
}

const MOCK_WORDING: Record<Lang, string> = {
  it: "Buongiorno {BUSINESS}, ho usato il vostro calcolatore: la stima è tra {LOW} e {HIGH}. {VAT} Mi fate sapere quando sareste disponibili?",
  de: "Guten Tag {BUSINESS}, laut Ihrem Rechner liegt meine Schätzung zwischen {LOW} und {HIGH}. {VAT} Wann hätten Sie Zeit?",
  fr: "Bonjour {BUSINESS}, d'après votre calculateur, l'estimation se situe entre {LOW} et {HIGH}. {VAT} Quand seriez-vous disponible ?",
  en: "Hello {BUSINESS}, your calculator puts my estimate between {LOW} and {HIGH}. {VAT} When would you be available?",
};

const reply = (content: string, usage: Usage, model: string) =>
  Response.json({ model, choices: [{ index: 0, message: { role: "assistant", content }, finish_reason: "stop" }], usage: { prompt_tokens: usage.promptTokens, completion_tokens: usage.completionTokens } });

export function createMockFetch(opts: { profile?: Record<string, Recording>; textToId?: (text: string) => string | undefined } = {}): FetchLike {
  return async (_url, init) => {
    let body: any;
    try { body = JSON.parse(init.body); } catch { return Response.json({ error: { code: "bad_request" } }, { status: 400 }); }
    const msgs: { role: string; content: string }[] = Array.isArray(body?.messages) ? body.messages : [];
    const system = msgs[0]?.content ?? "";
    const user = msgs.find((m) => m.role === "user")?.content ?? "";
    const attempt = msgs.filter((m) => m.role === "assistant").length;
    const model = String(body?.model ?? "apertus-mock");
    if (system.startsWith(MESSAGE_MARKER)) {
      const lang = (user.match(/Requested language: (it|de|fr|en)/)?.[1] ?? "en") as Lang;
      return reply(MOCK_WORDING[lang], { promptTokens: 380, completionTokens: 48 }, model);
    }
    if (system.startsWith(CONFIG_MARKER)) {
      const text = user.match(/<price_list>\n([\s\S]*)\n<\/price_list>/)?.[1] ?? "";
      const id = opts.textToId?.(text);
      const rec = opts.profile && id ? opts.profile[id] : opts.profile ? undefined : recordings().get(normText(text));
      if (!rec) return Response.json({ error: { code: "mock_no_recording", message: "no recorded answer for this text" } }, { status: 404 });
      const i = Math.min(attempt, rec.responses.length - 1);
      return reply(rec.responses[i], rec.usage?.[i] ?? { promptTokens: 0, completionTokens: 0 }, model);
    }
    return Response.json({ error: { code: "unknown_prompt" } }, { status: 400 });
  };
}
