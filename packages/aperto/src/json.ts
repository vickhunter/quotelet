// Robust JSON-object extraction from LLM output: <think> blocks, code fences, leading/trailing prose,
// braces inside strings, trailing commas. Returns the first balanced top-level object that parses.
export type ExtractResult = { ok: true; value: Record<string, unknown> } | { ok: false; error: string };

const MAX_INPUT = 64 * 1024;

function tryParse(s: string): unknown {
  try { return JSON.parse(s); } catch { /* fall through */ }
  try { return JSON.parse(s.replace(/,\s*([}\]])/g, "$1")); } catch { return undefined; }
}
const isObj = (x: unknown): x is Record<string, unknown> => x !== null && typeof x === "object" && !Array.isArray(x);

/** Balanced `{...}` spans in order of appearance, string-aware. */
function* objectSpans(s: string): Generator<string> {
  for (let start = s.indexOf("{"); start !== -1; start = s.indexOf("{", start + 1)) {
    let depth = 0, inStr = false, esc = false;
    for (let i = start; i < s.length; i++) {
      const ch = s[i];
      if (inStr) {
        if (esc) esc = false;
        else if (ch === "\\") esc = true;
        else if (ch === '"') inStr = false;
        continue;
      }
      if (ch === '"') inStr = true;
      else if (ch === "{") depth++;
      else if (ch === "}" && --depth === 0) { yield s.slice(start, i + 1); break; }
    }
  }
}

export function extractJson(raw: unknown): ExtractResult {
  if (typeof raw !== "string" || !raw.trim()) return { ok: false, error: "Model output is empty, expected a JSON object" };
  let s = raw.slice(0, MAX_INPUT).replace(/<think>[\s\S]*?<\/think>/gi, "").trim();
  const direct = tryParse(s);
  if (isObj(direct)) return { ok: true, value: direct };
  const candidates: string[] = [];
  for (const m of s.matchAll(/```[a-zA-Z0-9_-]*\s*\n?([\s\S]*?)```/g)) candidates.push(m[1].trim());
  candidates.push(s);
  for (const c of candidates) {
    const v = tryParse(c);
    if (isObj(v)) return { ok: true, value: v };
    for (const span of objectSpans(c)) {
      const o = tryParse(span);
      if (isObj(o)) return { ok: true, value: o };
    }
  }
  return { ok: false, error: "Model output contains no valid JSON object" };
}
