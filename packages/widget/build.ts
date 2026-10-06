// Bundles the widget into dist/quotelet.js (IIFE, minified) and reports the gzip size.
import { mkdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = join(import.meta.dir, "..", "..");
const OUT = join(ROOT, "dist");
mkdirSync(OUT, { recursive: true });
const result = await Bun.build({
  entrypoints: [join(import.meta.dir, "src", "index.ts")],
  outdir: OUT,
  naming: "quotelet.js",
  format: "iife",
  target: "browser",
  minify: true,
  banner: "/*! Quotelet 0.1.0 | MIT | no cookies, no storage, no tracking */",
});
if (!result.success) {
  for (const log of result.logs) console.error(log);
  process.exit(1);
}
const file = join(OUT, "quotelet.js");
const buf = readFileSync(file);
const gz = Bun.gzipSync(buf).length;
console.log(`dist/quotelet.js ${buf.length} B, gzip ${gz} B (budget 15360 B)`);
if (gz > 15 * 1024) { console.error("gzip budget exceeded"); process.exit(1); }
