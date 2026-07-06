#!/usr/bin/env node
/**
 * Build the installable Nota VS Code extension (.vsix).
 *
 *   node scripts/package-vsix.mjs --version X.Y.Z --out <dir> [--skip-build]
 *
 * vsce cannot package a pnpm-workspace node_modules, so the vsix is fully self-contained instead:
 *  - `dist/extension.js` — the client, esbuild-bundled (external: vscode).
 *  - `dist/server.js`    — the whole language server, esbuild-bundled from
 *    `@nota-lang/language-server`'s built `dist/bin.js` (Volar + vscode-languageserver +
 *    typescript + the compiler shim, one file). `import.meta.url` is rebuilt from `__filename`
 *    via banner+define so the shim's `createRequire`/path logic works inside the CJS bundle.
 *  - `wasm/`             — the node-wasm reader (the shim's default backend). The extension sets
 *    `NOTA_WASM_NODE` to it when spawning the server; the shim's vendored-`wasm/` probe finds it
 *    too (dist/../wasm), so either path works.
 *
 * After bundling, a real LSP `initialize` handshake runs against `dist/server.js` — a broken
 * bundle fails here, in CI, not in a user's editor. The manifest is version-stamped
 * (snapshot/restored) and `vsce package --no-dependencies` emits `<out>/vscode-nota-<V>.vsix`.
 */

import { execFileSync, spawn } from "node:child_process";
import {
  copyFileSync,
  cpSync,
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync
} from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";

const pkgDir = join(dirname(fileURLToPath(import.meta.url)), "..");
const repoRoot = join(pkgDir, "..", "..");
const wasmNodeDir = join(repoRoot, "oxc", "napi", "nota_wasm", "pkg-node");

const args = process.argv.slice(2);
function argValue(flag) {
  const i = args.indexOf(flag);
  return i >= 0 ? args[i + 1] : undefined;
}
const version = argValue("--version");
const outDir = resolve(repoRoot, argValue("--out") ?? "dist-release");
const skipBuild = args.includes("--skip-build");

if (!version || !/^\d+\.\d+\.\d+(-[0-9A-Za-z.-]+)?$/.test(version)) {
  console.error("usage: package-vsix.mjs --version X.Y.Z [--out dir] [--skip-build]");
  process.exit(1);
}
if (!existsSync(join(wasmNodeDir, "nota_wasm.js"))) {
  console.error(`missing node wasm at ${wasmNodeDir} — run \`node scripts/build-wasm.mjs node\` first`);
  process.exit(1);
}

function run(cmd, cmdArgs, cwd) {
  execFileSync(cmd, cmdArgs, { cwd, stdio: "inherit" });
}

// --- 1. build the language server's dist (and its deps) so the bundle has a real entry ---
if (!skipBuild) {
  for (const pkg of ["runtime", "compiler", "language-server"]) {
    console.log(`[vsix] depot build ${pkg}`);
    run("depot", ["--no-fullscreen", "build"], join(repoRoot, "packages", pkg));
  }
}

// --- 2. esbuild bundles ---
console.log("[vsix] bundle dist/extension.js + dist/server.js");
const common = {
  bundle: true,
  platform: "node",
  format: "cjs",
  target: "node20", // VS Code >= 1.85 extension host
  logLevel: "warning"
};
await build({
  ...common,
  entryPoints: [join(pkgDir, "src", "extension.ts")],
  outfile: join(pkgDir, "dist", "extension.js"),
  external: ["vscode"]
});
await build({
  ...common,
  entryPoints: [join(repoRoot, "packages", "language-server", "dist", "bin.js")],
  outfile: join(pkgDir, "dist", "server.js"),
  // The compiler shim (ESM dist) uses import.meta.url for createRequire + its wasm/binary path
  // probes; a CJS bundle would otherwise turn it into undefined. Rebuild it from __filename.
  banner: {
    js: "const __nota_import_meta_url = require('node:url').pathToFileURL(__filename).href;"
  },
  define: { "import.meta.url": "__nota_import_meta_url" }
});

// --- 3. vendor the wasm reader + LICENSE next to the bundles ---
const wasmDir = join(pkgDir, "wasm");
rmSync(wasmDir, { recursive: true, force: true });
cpSync(wasmNodeDir, wasmDir, {
  recursive: true,
  filter: src => !src.endsWith(".gitignore")
});
copyFileSync(join(repoRoot, "LICENSE"), join(pkgDir, "LICENSE"));

// --- 4. LSP initialize handshake against the bundle (with the vsix's wasm layout) ---
console.log("[vsix] smoke: LSP initialize against dist/server.js");
await new Promise((resolvePromise, reject) => {
  const server = spawn(process.execPath, [join(pkgDir, "dist", "server.js"), "--stdio"], {
    env: { ...process.env, NOTA_WASM_NODE: join(wasmDir, "nota_wasm.js") },
    stdio: ["pipe", "pipe", "pipe"]
  });
  const timer = setTimeout(() => {
    server.kill();
    reject(new Error("server bundle did not answer initialize within 15s"));
  }, 15_000);
  let stdout = "";
  let stderr = "";
  server.stdout.on("data", d => {
    stdout += String(d);
    if (stdout.includes('"capabilities"')) {
      clearTimeout(timer);
      server.kill();
      console.log("[vsix] smoke ok — server answered initialize");
      resolvePromise();
    }
  });
  server.stderr.on("data", d => {
    stderr += String(d);
  });
  server.on("exit", code => {
    if (code !== null && code !== 0) {
      clearTimeout(timer);
      reject(new Error(`server bundle exited ${code}:\n${stderr}`));
    }
  });
  const body = JSON.stringify({
    jsonrpc: "2.0",
    id: 1,
    method: "initialize",
    params: { processId: null, rootUri: null, capabilities: {} }
  });
  server.stdin.write(`Content-Length: ${Buffer.byteLength(body)}\r\n\r\n${body}`);
});

// --- 5. vsce package with a version-stamped manifest (snapshot/restore) ---
mkdirSync(outDir, { recursive: true });
const manifestPath = join(pkgDir, "package.json");
const original = readFileSync(manifestPath, "utf8");
const manifest = JSON.parse(original);
manifest.version = version;
manifest.repository = {
  type: "git",
  url: "git+https://github.com/nota-lang/nota.git",
  directory: "packages/vscode-nota"
};
// The vsix is self-contained; deps only confuse vsce (workspace: protocol) and are skipped by
// --no-dependencies anyway.
delete manifest.dependencies;
delete manifest.devDependencies;
delete manifest.private; // vsce refuses private manifests
writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);

const vsixPath = join(outDir, `vscode-nota-${version}.vsix`);
try {
  run(
    join(pkgDir, "node_modules", ".bin", "vsce"),
    ["package", "--no-dependencies", "--out", vsixPath],
    pkgDir
  );
} finally {
  writeFileSync(manifestPath, original);
  // Leave dist/ bundles (gitignored, useful) but remove the vendored wasm + LICENSE copies so the
  // package dir stays clean for dev.
  rmSync(wasmDir, { recursive: true, force: true });
  rmSync(join(pkgDir, "LICENSE"), { force: true });
}

console.log(`[vsix] done → ${vsixPath}`);
