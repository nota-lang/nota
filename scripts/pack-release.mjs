#!/usr/bin/env node
/**
 * Pack the publishable packages into release tarballs — the GitHub-Release distribution channel
 * (memory: no npm while experimenting; users install tarball URLs and deps resolve through the
 * URLs baked in here).
 *
 *   node scripts/pack-release.mjs --version 0.2.0 --refs url  --out dist-release
 *   node scripts/pack-release.mjs --version 0.2.0 --refs file --out dist-release [--skip-build]
 *
 * For each package: stamp `--version` (lockstep, from the release PR title), rewrite every
 * internal dep (`workspace:*` and the `link:` wasm deps) to either
 *   url:  https://github.com/nota-lang/nota/releases/download/v<V>/<tarball>   (publishable)
 *   file: file:<out>/<tarball>                                                 (dry-run smoke tests)
 * then `pnpm pack`. Manifests are snapshotted and restored afterwards — the rewrite must never
 * land in the working tree. (Rewriting BEFORE pack matters: `pnpm pack` auto-rewrites any
 * remaining `workspace:*` to a bare semver, which would point consumers at a registry we don't
 * publish to.)
 *
 * Both wasm builds pack as their own tarballs: `@nota-lang/wasm` (web — codemirror/playground) and
 * `@nota-lang/wasm-node` (node — the compiler shim's backend, an ordinary dependency).
 *
 * `@nota-lang/cli` and `@nota-lang/vite` also get unversioned alias copies (`nota-lang-cli.tgz`)
 * so `releases/latest/download/…` is a stable install URL.
 */

import { execFileSync } from "node:child_process";
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync
} from "node:fs";
import { dirname, isAbsolute, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const RELEASE_BASE = "https://github.com/nota-lang/nota/releases/download";

/** Workspace packages in dependency order (build order = pack order). */
const WORKSPACE_PACKAGES = [
  "runtime",
  "prelude",
  "compiler",
  "react",
  "solid",
  "vite",
  "cli",
  "codemirror"
];

/** Packages that get an unversioned alias tarball for `releases/latest/download/`. */
const LATEST_ALIASES = ["@nota-lang/cli", "@nota-lang/vite"];

const wasmPkgDir = join(repoRoot, "oxc", "napi", "nota_wasm", "pkg");
const wasmNodeDir = join(repoRoot, "oxc", "napi", "nota_wasm", "pkg-node");

// --- argv ---
const args = process.argv.slice(2);
function argValue(flag) {
  const i = args.indexOf(flag);
  return i >= 0 ? args[i + 1] : undefined;
}
const version = argValue("--version");
const refs = argValue("--refs") ?? "url";
const outDir = resolve(repoRoot, argValue("--out") ?? "dist-release");
const skipBuild = args.includes("--skip-build");

if (!version || !/^\d+\.\d+\.\d+(-[0-9A-Za-z.-]+)?$/.test(version)) {
  console.error("usage: pack-release.mjs --version X.Y.Z [--refs url|file] [--out dir] [--skip-build]");
  process.exit(1);
}
if (refs !== "url" && refs !== "file") {
  console.error(`--refs must be "url" or "file", got ${JSON.stringify(refs)}`);
  process.exit(1);
}

// --- preconditions: the reader artifacts must be prebuilt (scripts/build-wasm.mjs) ---
for (const [what, path] of [
  ["web wasm (@nota-lang/wasm)", join(wasmPkgDir, "nota_wasm.js")],
  ["node wasm (@nota-lang/wasm-node)", join(wasmNodeDir, "nota_wasm.js")]
]) {
  if (!existsSync(path)) {
    console.error(`missing ${what} at ${path} — run \`node scripts/build-wasm.mjs\` first`);
    process.exit(1);
  }
}

/** `@nota-lang/cli` → `nota-lang-cli-<V>.tgz` (pnpm pack's naming, made explicit). */
function tarballName(pkgName) {
  return `${pkgName.replace(/^@/, "").replace(/\//g, "-")}-${version}.tgz`;
}

/** The dependency ref a packed manifest carries for an internal package. */
function refFor(pkgName) {
  return refs === "url"
    ? `${RELEASE_BASE}/v${version}/${tarballName(pkgName)}`
    : `file:${join(outDir, tarballName(pkgName))}`;
}

/** Rewrite one manifest object in place: stamp version, redirect internal deps, drop devDeps. */
function rewriteManifest(manifest) {
  manifest.version = version;
  // devDependencies are inert for consumers of a tarball; dropping them keeps `workspace:*`
  // strings (meaningless outside the workspace) out of the published manifest.
  delete manifest.devDependencies;
  for (const field of ["dependencies", "optionalDependencies", "peerDependencies"]) {
    const deps = manifest[field];
    if (!deps) continue;
    for (const [name, spec] of Object.entries(deps)) {
      if (
        name.startsWith("@nota-lang/") &&
        (spec.startsWith("workspace:") || spec.startsWith("file:") || spec.startsWith("link:"))
      ) {
        deps[name] = refFor(name);
      }
    }
  }
}

function run(cmd, cmdArgs, cwd) {
  execFileSync(cmd, cmdArgs, { cwd, stdio: "inherit" });
}

/** pnpm-pack `dir` with its manifest temporarily rewritten; returns the tarball path. */
function packDir(dir, pkgName) {
  const manifestPath = join(dir, "package.json");
  const original = readFileSync(manifestPath, "utf8");
  const manifest = JSON.parse(original);
  rewriteManifest(manifest);
  writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
  try {
    run("pnpm", ["pack", "--pack-destination", outDir], dir);
  } finally {
    writeFileSync(manifestPath, original);
  }
  const tarball = join(outDir, tarballName(pkgName));
  if (!existsSync(tarball)) {
    console.error(`pnpm pack did not produce the expected ${tarball}`);
    process.exit(1);
  }
  return tarball;
}

mkdirSync(outDir, { recursive: true });

// --- build all dists in dependency order (skippable for a re-pack) ---
if (!skipBuild) {
  for (const pkg of WORKSPACE_PACKAGES) {
    console.log(`[pack-release] depot build ${pkg}`);
    run("depot", ["--no-fullscreen", "build"], join(repoRoot, "packages", pkg));
  }
}

// --- pack the wasm packages first (nothing depends on their tarballs at pack time) ---
console.log("[pack-release] pack @nota-lang/wasm");
packDir(wasmPkgDir, "@nota-lang/wasm");
console.log("[pack-release] pack @nota-lang/wasm-node");
packDir(wasmNodeDir, "@nota-lang/wasm-node");

// --- pack the workspace packages ---
for (const pkg of WORKSPACE_PACKAGES) {
  const dir = join(repoRoot, "packages", pkg);
  const name = JSON.parse(readFileSync(join(dir, "package.json"), "utf8")).name;
  console.log(`[pack-release] pack ${name}`);
  packDir(dir, name);
}

// --- unversioned aliases for releases/latest/download/ ---
for (const pkgName of LATEST_ALIASES) {
  const from = join(outDir, tarballName(pkgName));
  const to = join(outDir, `${pkgName.replace(/^@/, "").replace(/\//g, "-")}.tgz`);
  copyFileSync(from, to);
  console.log(`[pack-release] alias ${to}`);
}

console.log(`[pack-release] done → ${outDir} (refs: ${refs}, version: ${version})`);
if (!isAbsolute(outDir)) {
  // resolve() above makes this unreachable; belt for future edits.
  console.warn("[pack-release] warning: outDir is not absolute; file refs would be ambiguous");
}
