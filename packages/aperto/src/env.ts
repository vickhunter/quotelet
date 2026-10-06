// Env handling. `.env.local` (repo root, git-ignored) is where Victor puts the Apertus key; it never
// overrides variables already set in the real environment.
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

export type Env = Record<string, string | undefined>;
export const REPO_ROOT = join(import.meta.dir, "..", "..", "..");

export function loadEnvLocal(dir: string = REPO_ROOT, env: Env = process.env): Env {
  const file = join(dir, ".env.local");
  if (!existsSync(file)) return env;
  for (const line of readFileSync(file, "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/);
    if (!m) continue;
    let v = m[2];
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
    else v = v.replace(/\s+#.*$/, "");
    if (env[m[1]] === undefined || env[m[1]] === "") env[m[1]] = v;
  }
  return env;
}

export type ApertusEnv = {
  configured: boolean; mock: boolean; baseUrl: string; model: string; apiKey?: string;
  modelSmall?: string; modelLarge?: string; timeoutMs: number;
};

export function readApertusEnv(env: Env = process.env): ApertusEnv {
  const s = (k: string) => (env[k] ?? "").trim() || undefined;
  const baseUrl = s("APERTUS_BASE_URL") ?? "";
  const model = s("APERTUS_MODEL") ?? s("APERTUS_MODEL_LARGE") ?? s("APERTUS_MODEL_SMALL") ?? "";
  const t = Number(s("APERTUS_TIMEOUT_MS"));
  return {
    configured: Boolean(baseUrl && model),
    mock: ["1", "true", "yes"].includes((s("APERTUS_MOCK") ?? "").toLowerCase()),
    baseUrl, model, apiKey: s("APERTUS_API_KEY"),
    modelSmall: s("APERTUS_MODEL_SMALL"), modelLarge: s("APERTUS_MODEL_LARGE"),
    timeoutMs: Number.isFinite(t) && t > 0 ? t : 20000,
  };
}
