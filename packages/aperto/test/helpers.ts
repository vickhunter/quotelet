import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { ChatClient, ChatMessage, ChatResult } from "../src/types.ts";

export const PKG = join(import.meta.dir, "..");
export const ROOT = join(PKG, "..", "..");
export const recorded = (name: string): any => JSON.parse(readFileSync(join(PKG, "fixtures", name), "utf8"));
export const rootFixture = (name: string): any => JSON.parse(readFileSync(join(ROOT, "fixtures", name), "utf8"));

/** A ChatClient that replays recorded model answers in order and records every prompt it got. */
export function replayClient(answers: (string | Error)[], model = "recorded"): ChatClient & { calls: ChatMessage[][] } {
  const calls: ChatMessage[][] = [];
  let i = 0;
  return {
    model,
    calls,
    async chat(messages: ChatMessage[]): Promise<ChatResult> {
      calls.push(messages.map((m) => ({ ...m })));
      const a = answers[Math.min(i++, answers.length - 1)];
      if (a instanceof Error) throw a;
      return { content: a, usage: { promptTokens: 100, completionTokens: 50 }, latencyMs: 5, model };
    },
  };
}

/** Fails the test if anything tries real network. */
export const noNetwork = async (): Promise<Response> => { throw new Error("network access in unit test"); };
