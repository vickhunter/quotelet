import { readFileSync } from "node:fs";
import { join } from "node:path";
export const ROOT = join(import.meta.dir, "..", "..", "..");
export const fixture = (name: string): any => JSON.parse(readFileSync(join(ROOT, "fixtures", name), "utf8"));
export const fixtureText = (name: string): string => readFileSync(join(ROOT, "fixtures", name), "utf8").replace(/\n$/, "");
export const clone = <T>(x: T): T => JSON.parse(JSON.stringify(x));
