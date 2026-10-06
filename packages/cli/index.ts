#!/usr/bin/env bun
// Quotelet CLI (design 10.4): templates | validate | quote | link. `bun packages/cli/index.ts <cmd>`.
import { main } from "./src/cli.ts";

const r = await main(process.argv.slice(2));
if (r.stdout) process.stdout.write(r.stdout.endsWith("\n") ? r.stdout : r.stdout + "\n");
if (r.stderr) process.stderr.write(r.stderr.endsWith("\n") ? r.stderr : r.stderr + "\n");
process.exit(r.code);
