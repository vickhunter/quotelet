// @quotelet/aperto public types: the POST /api/aperto contract (hack-apertus-quotelet.md section 9).
// UI/UX wires against these shapes. Changing them needs Product Lead.
import type { Config, Quote, ValidationError } from "../../core/src/index.ts";

export type Lang = "it" | "de" | "fr" | "en";
export const LANGS: readonly Lang[] = ["it", "de", "fr", "en"] as const;

/** Same shape as core's ValidationError. `path` is a config path ("formula", "fields[0].min") or "" / "request" / "model". */
export type ApiError = ValidationError; // { path: string; message: string }

// ---- action "config" -------------------------------------------------------------------------
export type ConfigRequest = { action: "config"; text: string; lang: Lang };
/** `source` (additive, optional for older clients): "recording" when APERTUS_MOCK=1 replayed a recorded answer. */
export type ConfigSource = "model" | "recording";
export type ConfigSuccess = { ok: true; config: Config; attempts: number; warnings: ApiError[]; source?: ConfigSource };
export type ConfigFailure = { ok: false; errors: ApiError[]; attempts: number };
export type ConfigResponse = ConfigSuccess | ConfigFailure;

// ---- action "message" ------------------------------------------------------------------------
/** `quote` is the Quote from core `computeQuote(config, answers)`. The server only reads its cents
 *  (lowCents, highCents, vat.*) and re-formats every amount with core's Intl formatting; client
 *  display strings are ignored, so the text can only carry core-formatted amounts. */
export type MessageRequest = { action: "message"; config: Config; quote: Quote; lang: Lang };
/** "model": live model wording; "recording": APERTUS_MOCK=1 replayed wording; "template": built-in fallback (any mode). */
export type MessageSource = "model" | "template" | "recording";
export type MessageSuccess = { ok: true; text: string; source: MessageSource };
export type MessageFailure = { ok: false; errors: ApiError[] };
export type MessageResponse = MessageSuccess | MessageFailure;

export type ApertoRequest = ConfigRequest | MessageRequest;
export type ApertoResponse = ConfigResponse | MessageResponse;

/** Request-level rejection (HTTP 400/403/405/413/415/429/500). `attempts: 0` is added when action is "config". */
export type ProxyError = { ok: false; errors: ApiError[]; attempts?: number };

export const PROXY_LIMITS = {
  /** Max request body in bytes (HTTP 413 above). */
  maxBodyBytes: 4096,
  /** Max price-list text length in characters (HTTP 400 above). */
  maxTextChars: 3000,
  /** Per-IP token bucket: capacity and refill per minute (best-effort, in-memory, per instance). */
  ratePerMinute: 10,
} as const;

// ---- library-level types (additive; the proxy maps these to the shapes above) ----------------
export type ChatMessage = { role: "system" | "user" | "assistant"; content: string };
export type Usage = { promptTokens: number; completionTokens: number };
export type ChatResult = { content: string; usage: Usage; latencyMs: number; model: string };

/** fetch-compatible transport, injectable so tests and the mock never touch the network. */
export type FetchLike = (url: string, init: { method: string; headers: Record<string, string>; body: string; signal?: AbortSignal }) => Promise<Response>;

export type ClientOptions = { baseUrl: string; model: string; apiKey?: string; fetch?: FetchLike; timeoutMs?: number; maxTokens?: number; /** answers are replayed recordings (APERTUS_MOCK) */ recorded?: boolean };
export interface ChatClient {
  readonly model: string;
  /** true when answers are replayed recordings (APERTUS_MOCK=1), so results are labelled "recording", not "model". */
  readonly recorded?: boolean;
  chat(messages: ChatMessage[], opts?: { temperature?: number; maxTokens?: number; json?: boolean }): Promise<ChatResult>;
}

export type AttemptTrace = { latencyMs: number; usage: Usage; errors: ApiError[] };
export type GenerateResult = ConfigResponse & { trace: AttemptTrace[] };
export type DraftResult = MessageSuccess & { attempts: number; errors: ApiError[]; trace: AttemptTrace[] };
