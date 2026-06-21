/**
 * `@nota-lang/compiler` — the Node shim around the oxc Nota *reader* (contract §1, impl §3.5).
 *
 * The reader lives in the Rust fork (`oxc::nota::compile`); this package is the JS-side glue that
 * makes its output usable from Node. {@link compile} takes a `.nota` source string and returns the
 * emitted JS module (plus, eventually, a sourcemap), with the `@nota-lang/runtime` import the reader
 * deliberately omits **prepended** (contract §1: "The reader does **not** emit the
 * `@nota-lang/runtime` import — the compiler shim/integrator prepends it").
 *
 * **v1 mechanism — Node subprocess.** We spawn the pre-built release CLI
 * (`oxc/target/release/examples/nota_compile <file.nota>`), which prints the emitted module to
 * stdout (diagnostics → stderr, exit 1 on error). The source is written to a temp file the shim
 * owns, the binary runs over it, and stdout is captured.
 *
 * **Later upgrade — wasm/napi backend.** Part 4's browser playground (and a faster Node path) wants
 * the reader compiled to wasm (`oxc::nota::compile` behind `wasm-bindgen`) so there is no subprocess
 * and it runs in the browser. That is a drop-in replacement for {@link compile}'s body — the API
 * (string in → `{ code, map }` out, runtime import prepended) is backend-agnostic and stays fixed.
 * v1 is the subprocess; the wasm backend is a later, non-breaking swap.
 */

import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

/** The runtime import the reader omits — contract §1, prepended onto every emit. */
export const RUNTIME_IMPORT =
  'import { h, decode, Fragment, inlineComponent, blockComponent } from "@nota-lang/runtime";\n';

/** Options for {@link compile}. */
export interface CompileOptions {
  /**
   * The original path of the source (e.g. a Vite module id). Used to name the temp file so the
   * binary's diagnostics and any future sourcemap reference a meaningful filename. Does **not** need
   * to exist on disk.
   */
  sourcePath?: string;
}

/**
 * A standard [Source Map v3](https://tc39.es/ecma426/) object. Declared structurally here (rather
 * than pulling a bundler type) so the shim stays backend-agnostic; it is shaped to be assignable to
 * Vite/Rollup's sourcemap-input type (only `mappings` is required) so it flows straight through
 * `@nota-lang/vite`'s `transform` return.
 */
export interface SourceMapV3 {
  mappings: string;
  version?: number;
  file?: string;
  sources?: (string | null)[];
  sourcesContent?: (string | null)[];
  names?: string[];
  sourceRoot?: string;
}

/** The result of {@link compile}: the emitted JS module and (when available) its sourcemap. */
export interface CompileResult {
  /** The emitted JS module, with the {@link RUNTIME_IMPORT} prepended. */
  code: string;
  /** A {@link SourceMapV3}, when the backend produces one (the CLI does not yet — see notes). */
  map?: SourceMapV3;
}

/**
 * Resolve the `nota_compile` binary.
 *
 * Order: the `NOTA_COMPILE_BIN` env var (an explicit path — lets the CLI / CI point at any build),
 * else the oxc release path resolved **relative to this package** so it works regardless of the
 * caller's cwd. `src/lib.ts` and the built `dist/lib.js` are both one directory under the package
 * root, so `../../../oxc/...` resolves identically from either (`<pkg>/{src,dist}` → repo root).
 */
function resolveBinary(): string {
  const fromEnv = process.env.NOTA_COMPILE_BIN;
  if (fromEnv && fromEnv.length > 0) {
    return fromEnv;
  }
  const here = dirname(fileURLToPath(import.meta.url));
  return join(
    here,
    "..",
    "..",
    "..",
    "oxc",
    "target",
    "release",
    "examples",
    "nota_compile"
  );
}

/**
 * Compile a `.nota` source string to an emitted JS module.
 *
 * Writes `source` to a temp file, spawns the `nota_compile` binary over it, and captures stdout as
 * the emitted module. The {@link RUNTIME_IMPORT} (contract §1) is prepended to the result. On a
 * non-zero exit the binary's stderr diagnostics are surfaced as the thrown `Error`'s message.
 *
 * @param source the `.nota` file contents
 * @param opts   optional {@link CompileOptions}
 * @returns the {@link CompileResult} (`{ code, map? }`)
 * @throws if the reader reports a diagnostic (non-zero exit) — the error message carries stderr.
 */
export function compile(
  source: string,
  opts: CompileOptions = {}
): CompileResult {
  const bin = resolveBinary();

  // Derive a stable, filesystem-safe basename from sourcePath (purely cosmetic — feeds the binary's
  // diagnostics / a future sourcemap `sources`). Falls back to a generic name.
  const base = opts.sourcePath ? sanitizeBase(opts.sourcePath) : "input";

  const dir = mkdtempSync(join(tmpdir(), "nota-compile-"));
  const file = join(dir, `${base}.nota`);
  try {
    writeFileSync(file, source, "utf8");

    let stdout: string;
    try {
      stdout = execFileSync(bin, [file], {
        encoding: "utf8",
        // Generous cap; the reader is fast. Avoids a hung subprocess wedging a build.
        maxBuffer: 64 * 1024 * 1024
      });
    } catch (err) {
      throw toCompileError(err, opts.sourcePath);
    }

    // Contract §1: prepend the runtime import the reader omits.
    const code = RUNTIME_IMPORT + stdout;

    // The CLI does not yet surface a sourcemap on stdout; H1's structured CodeMappings + a flat v3
    // map are a forthcoming reader upgrade (contract §4 H1). Once present, parse + return them here.
    // The prepended import shifts generated offsets by one leading line, which a real map must
    // account for (trivial to offset). Kept undefined until the backend emits it.
    return { code, map: undefined };
  } finally {
    // Best-effort cleanup of the temp dir; never mask a compile error with a cleanup failure.
    try {
      rmSync(dir, { recursive: true, force: true });
    } catch {
      /* ignore */
    }
  }
}

/** Turn a Vite module id / path into a safe `.nota` basename (no separators, no query/hash). */
function sanitizeBase(sourcePath: string): string {
  const noQuery = sourcePath.split("?")[0].split("#")[0];
  const leaf = noQuery.split(/[\\/]/).pop() || "input";
  const stripped = leaf.replace(/\.nota$/, "");
  const safe = stripped.replace(/[^A-Za-z0-9._-]/g, "_");
  return safe.length > 0 ? safe : "input";
}

/**
 * Normalize an `execFileSync` failure into a single `Error` carrying the reader's stderr
 * diagnostics. `execFileSync` throws an object with `stderr`/`stdout` (Buffers/strings) and a
 * `status` (exit code) — we lift stderr (the diagnostics) into the message and keep the raw text on
 * `.diagnostics` for programmatic consumers (e.g. a Vite error overlay).
 */
function toCompileError(err: unknown, sourcePath?: string): Error {
  const e = err as {
    stderr?: Buffer | string;
    stdout?: Buffer | string;
    status?: number | null;
    message?: string;
  };
  const stderr = e.stderr ? String(e.stderr).trim() : "";
  const where = sourcePath ? ` (${sourcePath})` : "";
  const status = e.status ?? "unknown";
  const detail = stderr || e.message || "nota_compile failed";
  const error = new Error(
    `nota: failed to compile${where} [exit ${status}]\n${detail}`
  );
  (error as Error & { diagnostics?: string }).diagnostics = stderr;
  return error;
}
