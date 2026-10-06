// Minimal OpenAI-compatible chat-completions client (CSCS / HF / vLLM / Ollama all speak it).
// The transport is injectable; errors never carry the API key or the upstream body.
import type { ChatClient, ChatMessage, ChatResult, ClientOptions, FetchLike } from "./types.ts";
import { readApertusEnv, type Env } from "./env.ts";
import { createMockFetch } from "./mock.ts";

export class ApertusError extends Error {
  status?: number;
  constructor(message: string, status?: number) { super(message); this.name = "ApertusError"; this.status = status; }
}

export function createClient(opts: ClientOptions): ChatClient {
  const base = opts.baseUrl.replace(/\/+$/, "");
  const url = /\/chat\/completions$/.test(base) ? base : `${base}/chat/completions`;
  const doFetch: FetchLike = opts.fetch ?? ((u, init) => fetch(u, init));
  const timeoutMs = opts.timeoutMs ?? 20000;
  return {
    model: opts.model,
    recorded: opts.recorded === true,
    async chat(messages: ChatMessage[], o = {}): Promise<ChatResult> {
      const headers: Record<string, string> = { "content-type": "application/json", accept: "application/json", "user-agent": "quotelet-aperto/0.1 (+https://github.com/vickhunter/quotelet)" }; // some gateways (Public AI) require a User-Agent
      if (opts.apiKey) headers.authorization = `Bearer ${opts.apiKey}`;
      const body: Record<string, unknown> = {
        model: opts.model, messages, temperature: o.temperature ?? 0, max_tokens: o.maxTokens ?? opts.maxTokens ?? 1500, stream: false,
      };
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), timeoutMs);
      const t0 = performance.now();
      let res: Response;
      try {
        res = await doFetch(url, { method: "POST", headers, body: JSON.stringify(body), signal: ctrl.signal });
      } catch (e) {
        throw new ApertusError(ctrl.signal.aborted ? `Model timed out after ${timeoutMs} ms` : "Model endpoint unreachable");
      } finally {
        clearTimeout(timer);
      }
      if (!res.ok) {
        let detail = "";
        try { const j: any = await res.json(); if (typeof j?.error?.code === "string") detail = ` (${j.error.code.slice(0, 40)})`; } catch { /* ignore body: may echo secrets */ }
        throw new ApertusError(`Model endpoint returned HTTP ${res.status}${detail}`, res.status);
      }
      let j: any;
      try { j = await res.json(); } catch { throw new ApertusError("Model endpoint returned non-JSON"); }
      const content = j?.choices?.[0]?.message?.content;
      if (typeof content !== "string") throw new ApertusError("Model response has no message content");
      return {
        content,
        usage: { promptTokens: Number(j?.usage?.prompt_tokens) || 0, completionTokens: Number(j?.usage?.completion_tokens) || 0 },
        latencyMs: Math.round(performance.now() - t0),
        model: typeof j?.model === "string" ? j.model : opts.model,
      };
    },
  };
}

/** Client from env: real endpoint if configured; recorded mock if APERTUS_MOCK=1; else null. */
export function clientFromEnv(env: Env = process.env, fetchImpl?: FetchLike, model?: string): ChatClient | null {
  const e = readApertusEnv(env);
  if (e.configured) return createClient({ baseUrl: e.baseUrl, model: model ?? e.model, apiKey: e.apiKey, fetch: fetchImpl, timeoutMs: e.timeoutMs });
  if (e.mock) return createClient({ baseUrl: "http://mock.invalid/v1", model: model ?? "apertus-mock", fetch: createMockFetch(), recorded: true });
  return null;
}
