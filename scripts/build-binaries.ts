#!/usr/bin/env bun
/**
 * Compile single-file binaries for each supported target.
 * Run via `bun run build:binaries` from apps/cli/.
 */
import { $ } from "bun";

const targets = [
  "bun-darwin-arm64",
  "bun-darwin-x64",
  "bun-linux-x64",
  "bun-linux-arm64",
  "bun-windows-x64",
] as const;

const entry = "src/index.ts";
const outDir = "dist/binaries";

await $`mkdir -p ${outDir}`;

for (const target of targets) {
  const ext = target.startsWith("bun-windows") ? ".exe" : "";
  const out = `${outDir}/messages-${target.replace("bun-", "")}${ext}`;
  console.log(`→ ${target}`);
  await $`bun build --compile --minify --target=${target} ${entry} --outfile ${out}`;
}

console.log(`\nBuilt ${targets.length} binaries in ${outDir}/`);
