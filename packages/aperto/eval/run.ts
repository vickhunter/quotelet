// bun run eval:aperto [--dry] [--limit N] [--out DIR] [--readme]
// Real run: needs APERTUS_BASE_URL + APERTUS_MODEL (or APERTUS_MODEL_SMALL / APERTUS_MODEL_LARGE),
// from the environment or the git-ignored .env.local. Without them it prints SKIP and exits 0.
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { loadEnvLocal, REPO_ROOT } from "../src/env.ts";
import { profilesFromEnv, runEval, summaryTable } from "./lib.ts";

const args = process.argv.slice(2);
const dry = args.includes("--dry");
const val = (k: string) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : undefined; };
loadEnvLocal();

if (!dry && !profilesFromEnv(process.env).length) {
  console.log("eval:aperto: SKIP. No Apertus endpoint configured (set APERTUS_BASE_URL and APERTUS_MODEL, or APERTUS_MODEL_SMALL/APERTUS_MODEL_LARGE, in the env or in .env.local). Run `bun run eval:aperto --dry` to exercise the harness on recorded fixtures.");
  process.exit(0);
}

const r = await runEval({ dry, outDir: val("--out"), limit: val("--limit") ? Number(val("--limit")) : undefined });
console.log(`\n${summaryTable(r.models, process.env)}\n\nwrote ${r.file}`);

if (args.includes("--readme") || !dry) {
  const readme = join(REPO_ROOT, "README.md");
  const s = readFileSync(readme, "utf8");
  const start = "<!-- aperto-eval:start -->", end = "<!-- aperto-eval:end -->";
  if (s.includes(start) && s.includes(end)) {
    const rel = r.file.replace(REPO_ROOT + "/", "");
    const block = `${start}\n${dry ? "_Dry run on synthetic recorded answers (harness proof, **not Apertus results**); real 8B vs 70B numbers pending the endpoint key._\n\n" : ""}${summaryTable(r.models, process.env)}\n\nSource: \`${rel}\`.\n${end}`;
    writeFileSync(readme, s.slice(0, s.indexOf(start)) + block + s.slice(s.indexOf(end) + end.length));
    console.log("updated README eval table");
  }
}
