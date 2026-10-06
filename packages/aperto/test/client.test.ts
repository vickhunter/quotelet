import { describe, expect, test } from "bun:test";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createClient, ApertusError } from "../src/client.ts";
import { loadEnvLocal, readApertusEnv } from "../src/env.ts";

describe("Apertus client (OpenAI-compatible chat completions)", () => {
  test("posts to <base>/chat/completions with model, key and parses usage", async () => {
    let seen: any;
    const client = createClient({
      baseUrl: "https://inference.example/v1/",
      model: "swiss-ai/Apertus-8B-Instruct-2509",
      apiKey: "sk-test",
      fetch: async (url, init) => {
        seen = { url, init, body: JSON.parse(init.body) };
        return new Response(JSON.stringify({ model: "swiss-ai/Apertus-8B-Instruct-2509", choices: [{ message: { content: "hi" } }], usage: { prompt_tokens: 11, completion_tokens: 2 } }), { headers: { "content-type": "application/json" } });
      },
    });
    const r = await client.chat([{ role: "user", content: "x" }], { temperature: 0 });
    expect(seen.url).toBe("https://inference.example/v1/chat/completions");
    expect(seen.init.method).toBe("POST");
    expect(seen.init.headers.authorization).toBe("Bearer sk-test");
    expect(seen.body.model).toBe("swiss-ai/Apertus-8B-Instruct-2509");
    expect(seen.body.messages).toEqual([{ role: "user", content: "x" }]);
    expect(r.content).toBe("hi");
    expect(r.usage).toEqual({ promptTokens: 11, completionTokens: 2 });
    expect(r.latencyMs).toBeGreaterThanOrEqual(0);
  });
  test("no key -> no authorization header (keyless local vLLM/Ollama)", async () => {
    let headers: any;
    const client = createClient({ baseUrl: "http://127.0.0.1:11434/v1", model: "apertus", fetch: async (_u, init) => { headers = init.headers; return Response.json({ choices: [{ message: { content: "ok" } }] }); } });
    await client.chat([{ role: "user", content: "x" }]);
    expect(headers.authorization).toBeUndefined();
  });
  test("HTTP error -> ApertusError that never contains the key", async () => {
    const client = createClient({ baseUrl: "https://x/v1", model: "m", apiKey: "sk-secret-123", fetch: async () => new Response("bad key sk-secret-123", { status: 401 }) });
    const err = await client.chat([{ role: "user", content: "x" }]).catch((e) => e);
    expect(err).toBeInstanceOf(ApertusError);
    expect(String(err.message)).not.toContain("sk-secret-123");
    expect(err.status).toBe(401);
  });
  test("timeout -> ApertusError", async () => {
    const client = createClient({ baseUrl: "https://x/v1", model: "m", timeoutMs: 20, fetch: (_u, init) => new Promise((_r, rej) => init.signal?.addEventListener("abort", () => rej(new Error("aborted")))) });
    const err = await client.chat([{ role: "user", content: "x" }]).catch((e) => e);
    expect(err).toBeInstanceOf(ApertusError);
  });
});

describe("env (.env.local, git-ignored)", () => {
  test("loads .env.local without overriding real env", () => {
    const dir = mkdtempSync(join(tmpdir(), "aperto-env-"));
    writeFileSync(join(dir, ".env.local"), "# comment\nAPERTUS_BASE_URL=https://a.example/v1\nAPERTUS_MODEL=\"apertus-70b\"\nAPERTUS_API_KEY=from-file\nexport APERTUS_MODEL_SMALL='apertus-8b'\n");
    const env: Record<string, string | undefined> = { APERTUS_API_KEY: "from-env" };
    loadEnvLocal(dir, env);
    expect(env.APERTUS_BASE_URL).toBe("https://a.example/v1");
    expect(env.APERTUS_MODEL).toBe("apertus-70b");
    expect(env.APERTUS_MODEL_SMALL).toBe("apertus-8b");
    expect(env.APERTUS_API_KEY).toBe("from-env");
  });
  test("missing file is fine", () => {
    const env: Record<string, string | undefined> = {};
    expect(() => loadEnvLocal(join(tmpdir(), "does-not-exist-aperto"), env)).not.toThrow();
  });
  test("readApertusEnv", () => {
    expect(readApertusEnv({}).configured).toBe(false);
    expect(readApertusEnv({ APERTUS_MOCK: "1" }).mock).toBe(true);
    const e = readApertusEnv({ APERTUS_BASE_URL: "https://a/v1", APERTUS_MODEL: "m" });
    expect(e.configured).toBe(true);
    expect(e.baseUrl).toBe("https://a/v1");
  });
});

test("repo .gitignore ignores .env.local", async () => {
  const gi = await Bun.file(join(import.meta.dir, "..", "..", "..", ".gitignore")).text();
  expect(gi.split("\n").some((l) => l.trim() === ".env*" || l.trim() === ".env.local")).toBe(true);
});
