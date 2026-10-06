// Pre-bundles the Vercel Function entry (apps/web/api/aperto.ts) into ONE self-contained ESM file,
// <out>/api/aperto.mjs, with @quotelet/core, @quotelet/aperto and the mock recordings inlined. This lets
// a prebuilt static deploy (UI/UX ships apps/web/dist) carry the function without Vercel having to
// resolve .ts imports from outside apps/web. Usage: bun packages/aperto/scripts/bundle-vercel.ts <outDir>
import { mkdirSync, renameSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL("../../../", import.meta.url));

export async function bundleVercelFunction(outDir: string): Promise<string> {
  const apiDir = join(outDir, "api");
  mkdirSync(apiDir, { recursive: true });
  const r = await Bun.build({
    entrypoints: [join(ROOT, "apps/web/api/aperto.ts")],
    outdir: apiDir, target: "node", format: "esm", minify: false, sourcemap: "none",
    naming: "aperto.js", define: { "process.env.NODE_ENV": '"production"' },
  });
  if (!r.success) throw new Error("bundle failed: " + r.logs.map((l) => l.message).join("; "));
  const file = join(apiDir, "aperto.mjs");
  renameSync(join(apiDir, "aperto.js"), file);
  return file;
}

if (import.meta.main) {
  const out = process.argv[2];
  if (!out) { console.error("usage: bun packages/aperto/scripts/bundle-vercel.ts <outDir>"); process.exit(2); }
  console.log(await bundleVercelFunction(out));
}
