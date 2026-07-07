#!/usr/bin/env node
/**
 * Canonical build for the wasm reader — both targets, with the `package.json`s wasm-pack
 * generates patched to their published identities. Run from anywhere in the repo:
 *
 *   node scripts/build-wasm.mjs           # web + node
 *   node scripts/build-wasm.mjs web       # just the playground/codemirror target
 *   node scripts/build-wasm.mjs node      # just the compiler-shim target
 *
 * wasm-pack derives the npm package name from the crate name (`nota_wasm`) on every build, so the
 * rename to `@nota-lang/wasm` must be re-applied after each build — this script is the one place
 * that knows that. CI and the release pack script call this instead of raw wasm-pack.
 *
 * Outputs (both gitignored by wasm-pack's own `.gitignore: *`):
 *   oxc/napi/nota_wasm/pkg       — `@nota-lang/wasm` (web target): codemirror + playground +
 *                                  the website consume it (`link:` dep in the workspace, a release
 *                                  tarball outside it).
 *   oxc/napi/nota_wasm/pkg-node  — `@nota-lang/wasm-node` (nodejs target): the compiler shim's
 *                                  backend, an ordinary dependency (`link:` dep in the workspace, a
 *                                  release tarball outside it) — the patched name is what the
 *                                  shim's `import` resolves.
 */

import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const oxcDir = join(repoRoot, "oxc");
const crateDir = join(oxcDir, "napi", "nota_wasm");

const TARGETS = {
  web: {
    outDir: "pkg",
    wasmPackTarget: "web",
    name: "@nota-lang/wasm",
    description:
      "The Nota reader compiled to wasm (web target): compile/compileVirtual/parseAst/highlight."
  },
  node: {
    outDir: "pkg-node",
    wasmPackTarget: "nodejs",
    name: "@nota-lang/wasm-node",
    description:
      "The Nota reader compiled to wasm (node target) — @nota-lang/compiler's backend."
  }
};

const requested = process.argv.slice(2);
const keys = requested.length > 0 ? requested : Object.keys(TARGETS);

for (const key of keys) {
  const target = TARGETS[key];
  if (!target) {
    console.error(
      `unknown target ${JSON.stringify(key)} — expected: ${Object.keys(TARGETS).join(", ")}`
    );
    process.exit(1);
  }

  console.log(`[build-wasm] wasm-pack build --target ${target.wasmPackTarget} → ${target.outDir}`);
  execFileSync(
    "wasm-pack",
    [
      "build",
      "napi/nota_wasm",
      "--target",
      target.wasmPackTarget,
      "--out-dir",
      target.outDir,
      "--out-name",
      "nota_wasm"
    ],
    { cwd: oxcDir, stdio: "inherit" }
  );

  const manifestPath = join(crateDir, target.outDir, "package.json");
  const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
  manifest.name = target.name;
  manifest.description = target.description;
  manifest.license = "MIT";
  manifest.repository = {
    type: "git",
    url: "git+https://github.com/nota-lang/nota.git"
  };
  writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
  console.log(`[build-wasm] patched ${manifestPath} → ${target.name}`);
}
