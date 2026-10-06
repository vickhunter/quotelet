import { describe, expect, test } from "bun:test";
import { extractJson } from "../src/json.ts";

describe("extractJson (robust to fences and prose)", () => {
  test("plain JSON", () => {
    expect(extractJson('{"a":1}')).toEqual({ ok: true, value: { a: 1 } });
  });
  test("```json fence with leading prose", () => {
    expect(extractJson('Here you go:\n```json\n{"a":{"b":[1,2]}}\n```\nThanks')).toEqual({ ok: true, value: { a: { b: [1, 2] } } });
  });
  test("bare ``` fence", () => {
    expect(extractJson('```\n{"a":2}\n```')).toEqual({ ok: true, value: { a: 2 } });
  });
  test("prose before and after, braces inside strings", () => {
    const r = extractJson('Sure! {"t":"a } tricky { string","n":3} Hope it helps {not json}');
    expect(r).toEqual({ ok: true, value: { t: "a } tricky { string", n: 3 } });
  });
  test("think block is skipped", () => {
    expect(extractJson('<think>maybe {"x":0}?</think>{"x":1}')).toEqual({ ok: true, value: { x: 1 } });
  });
  test("no JSON object -> error", () => {
    const r = extractJson("I cannot help with that.");
    expect(r.ok).toBe(false);
  });
  test("arrays are not configs", () => {
    expect(extractJson("[1,2,3]").ok).toBe(false);
  });
  test("trailing commas are tolerated", () => {
    expect(extractJson('{"a":[1,2,],}')).toEqual({ ok: true, value: { a: [1, 2] } });
  });
});

test("pathological brace soup is bounded (no quadratic blow-up)", () => {
  const t0 = performance.now();
  const r = extractJson("{".repeat(200000) + ' {"a":1}');
  expect(performance.now() - t0).toBeLessThan(500);
  expect(r.ok).toBe(false);
});
