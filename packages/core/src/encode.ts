import { validateConfig } from "./schema.ts";
import { LIMITS, type Config, type ValidationError } from "./types.ts";

function toB64Url(bytes: Uint8Array): string {
  let bin = "";
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode.apply(null, Array.from(bytes.subarray(i, i + 0x8000)));
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/** base64url(JSON), UTF-8, no padding. */
export function encodeConfig(config: Config): string {
  return toB64Url(new TextEncoder().encode(JSON.stringify(config)));
}

export type DecodeResult = { ok: true; config: Config; warnings: ValidationError[] } | { ok: false; errors: ValidationError[] };

/** Never throws: any bad input comes back as { ok: false, errors }. */
export function decodeConfig(s: string): DecodeResult {
  const bad = (message: string): DecodeResult => ({ ok: false, errors: [{ path: "", message }] });
  try {
    if (typeof s !== "string") return bad("Encoded config must be a string");
    if (s.length === 0) return bad("Encoded config is empty");
    if (s.length > LIMITS.maxEncoded) return bad("Encoded config is larger than 8 KB");
    if (!/^[A-Za-z0-9_-]+$/.test(s) || s.length % 4 === 1) return bad("Encoded config is not valid base64url");
    const b64 = s.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((s.length + 3) % 4);
    let bin: string;
    try { bin = atob(b64); } catch { return bad("Encoded config is not valid base64url"); }
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    let text: string;
    try { text = new TextDecoder("utf-8", { fatal: true }).decode(bytes); } catch { return bad("Encoded config is not valid UTF-8"); }
    let data: unknown;
    try { data = JSON.parse(text); } catch { return bad("Encoded config is not valid JSON"); }
    return validateConfig(data);
  } catch {
    return bad("Encoded config could not be read");
  }
}
