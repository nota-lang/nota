/**
 * `@nota-lang/compiler` — the Node shim around the oxc Nota *reader*.
 *
 * The reader lives in the Rust fork (`oxc::nota::compile`); this package is the JS-side glue that
 * makes its output usable from Node. {@link compile} takes a `.nota` source string and returns the
 * emitted JS module (plus, eventually, a sourcemap), with the `@nota-lang/runtime` import the reader
 * deliberately omits **prepended**. The reader does not emit the `@nota-lang/runtime` import — the
 * compiler shim (or integrator) prepends it.
 *
 * **Current mechanism — Node subprocess.** We spawn the pre-built release CLI
 * (`oxc/target/release/examples/nota_compile <file.nota>`), which prints the emitted module to
 * stdout (diagnostics → stderr, exit 1 on error). The source is written to a temp file the shim
 * owns, the binary runs over it, and stdout is captured.
 *
 * **Later upgrade — wasm/napi backend.** A browser playground (and a faster Node path) wants the
 * reader compiled to wasm (`oxc::nota::compile` behind `wasm-bindgen`) so there is no subprocess and
 * it runs in the browser. That is a drop-in replacement for {@link compile}'s body — the API (string
 * in → `{ code, map }` out, runtime import prepended) is backend-agnostic and stays fixed. The
 * subprocess is the current path; the wasm backend is a later, non-breaking swap.
 */

import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

/** The runtime import the reader omits — prepended onto every emit. */
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
 * the emitted module. The {@link RUNTIME_IMPORT} is prepended to the result. On a non-zero exit the
 * binary's stderr diagnostics are surfaced as the thrown `Error`'s message.
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

    // Prepend the runtime import the reader omits.
    const code = RUNTIME_IMPORT + stdout;

    // The CLI does not yet surface a sourcemap on stdout; structured CodeMappings + a flat v3 map are
    // a forthcoming reader upgrade. Once present, parse + return them here. The prepended import
    // shifts generated offsets by one leading line, which a real map must account for (trivial to
    // offset). Kept undefined until the backend emits it.
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

// ===================================================================================================
// The virtual (`.tsx`) emit for the language server.
// ===================================================================================================

/**
 * A Volar `@volar/language-core` `CodeMapping`, as emitted by the reader's `compile_virtual`
 * (`oxc/crates/oxc/src/nota.rs`) and serialized by the binary's `--virtual` mode.
 *
 * Parallel arrays — one *segment* per index `k`: source bytes `[sourceOffsets[k],
 * sourceOffsets[k]+lengths[k])` correspond to generated bytes `[generatedOffsets[k],
 * generatedOffsets[k]+(generatedLengths?.[k] ?? lengths[k]))`. The reader produces one byte-exact
 * leaf per segment, so `generatedLengths` is `null` (generated length == source length) in practice,
 * but the field is carried for fidelity. `data` is the capability flag set (Volar `CodeInformation`).
 *
 * Offsets index the **`.nota`** source (`sourceOffsets`) and the reader's **bare** virtual `.tsx`
 * (`generatedOffsets`) — i.e. *without* the runtime+ambient typing preamble, which the reader omits.
 * The language-server `LanguagePlugin` prepends that preamble and shifts every `generatedOffsets` by
 * its length (`sourceOffsets` unchanged).
 */
export interface CodeMapping {
  /** Source byte offsets into the `.nota` (one per segment). */
  sourceOffsets: number[];
  /** Generated byte offsets into the bare virtual `.tsx` (one per segment). */
  generatedOffsets: number[];
  /** Segment lengths in the source (one per segment). */
  lengths: number[];
  /**
   * Segment lengths in the generated output when they differ from {@link lengths}; `null` ⇒ every
   * segment's generated length equals its source length (the common, byte-exact case).
   */
  generatedLengths: number[] | null;
  /** The Volar `CodeInformation` capability flags for this mapping's range(s). */
  data: MappingCapabilities;
}

/**
 * Volar `CodeInformation` capability flags for a mapped range (the `oxc` `MappingCapabilities`).
 * Each boolean gates a class of IDE feature when the TS service result maps
 * back to the `.nota`: `completion` (autocomplete), `format` (formatting/edits), `navigation`
 * (go-to-def / find-refs / rename), `semantic` (semantic tokens + **hover**), `structure` (outline /
 * folding), `verification` (**diagnostics**, incl. `@Unknown{}` → "Cannot find name").
 */
export interface MappingCapabilities {
  completion: boolean;
  format: boolean;
  navigation: boolean;
  semantic: boolean;
  structure: boolean;
  verification: boolean;
}

/**
 * One recovered Nota diagnostic from the reader's EOF error-recovery (`--virtual`): a `message` and
 * the byte span (`start`/`len`) into the **`.nota`** source it points at. The language server maps
 * these to LSP diagnostics (contract D5). A label-less diagnostic reports `start: 0, len: 0`.
 */
export interface NotaError {
  /** The human-readable diagnostic message. */
  message: string;
  /** Byte offset into the `.nota` source where the diagnostic begins. */
  start: number;
  /** Length in bytes of the diagnostic's span (`0` for a point diagnostic, e.g. at EOF). */
  len: number;
}

/**
 * The result of {@link compileVirtual}: the **bare** virtual `.tsx` (TS types preserved; runtime
 * import + ambient prelude *not* prepended — the language-server adds those), its
 * {@link CodeMapping}s, and any recovered {@link NotaError}s (empty for a well-formed file).
 *
 * The virtual path uses EOF error-recovery, so `compileVirtual` **does not throw** on unterminated
 * markup: it returns a best-effort `code` + `mappings` and reports the syntax/lowering problems in
 * `errors` for the language server to surface as diagnostics.
 */
export interface VirtualCompileResult {
  /** The emitted virtual `.tsx` module (type-preserving, no runtime/ambient preamble). */
  code: string;
  /** The {@link CodeMapping}s mapping `.tsx` offsets back to `.nota` offsets. */
  mappings: CodeMapping[];
  /** Recovered Nota parse/lowering diagnostics (byte-spanned into the `.nota`); empty if clean. */
  errors: NotaError[];
}

/** The exact `--virtual` stdout JSON shape `compileVirtual` parses. */
interface VirtualJson {
  code: string;
  mappings: CodeMapping[];
  errors?: NotaError[];
}

/**
 * Compile a `.nota` source to the **type-preserving virtual `.tsx`** emit + Volar CodeMappings.
 * The language server (`@nota-lang/language-server`) consumes this.
 *
 * Spawns the reader binary with `--virtual <file>` (same path resolution as {@link compile}) and
 * parses the JSON from stdout. Unlike {@link compile}, the runtime import is **not**
 * prepended here — the language-server `LanguagePlugin` prepends a runtime+ambient typing preamble
 * (so `h`/`decode`/`useState`/… type-check) and shifts the mappings by its length; doing it here
 * would double-shift.
 *
 * The reader uses **EOF error-recovery** on this path, so it does **not** fail (exit non-zero) on
 * unterminated markup: a syntax error yields a best-effort `code` + `mappings` and comes back in
 * {@link VirtualCompileResult.errors} for the language server to surface as LSP diagnostics (D5).
 *
 * @param source the `.nota` file contents
 * @param opts   optional {@link CompileOptions}
 * @returns the {@link VirtualCompileResult} (`{ code, mappings, errors }`)
 * @throws only if the binary itself fails to run (missing/old build lacking `--virtual`, an OS
 *   spawn error) — the error carries stderr. A *recoverable* Nota syntax error does not throw.
 */
export function compileVirtual(
  source: string,
  opts: CompileOptions = {}
): VirtualCompileResult {
  const bin = resolveBinary();
  const base = opts.sourcePath ? sanitizeBase(opts.sourcePath) : "input";

  const dir = mkdtempSync(join(tmpdir(), "nota-virtual-"));
  const file = join(dir, `${base}.nota`);
  try {
    writeFileSync(file, source, "utf8");

    let stdout: string;
    try {
      stdout = execFileSync(bin, ["--virtual", file], {
        encoding: "utf8",
        maxBuffer: 64 * 1024 * 1024
      });
    } catch (err) {
      throw toCompileError(err, opts.sourcePath);
    }

    return parseVirtualJson(stdout, opts.sourcePath);
  } finally {
    try {
      rmSync(dir, { recursive: true, force: true });
    } catch {
      /* ignore */
    }
  }
}

/**
 * Parse the `--virtual` stdout JSON into a {@link VirtualCompileResult}, validating the shape so a
 * malformed binary surfaces a clear error rather than a downstream `undefined`. Exported for
 * unit-testing the parse against a hand-written sample JSON while the binary's `--virtual` mode is
 * still landing in the reader.
 *
 * @internal
 */
export function parseVirtualJson(
  stdout: string,
  sourcePath?: string
): VirtualCompileResult {
  let parsed: VirtualJson;
  try {
    parsed = JSON.parse(stdout) as VirtualJson;
  } catch (e) {
    const where = sourcePath ? ` (${sourcePath})` : "";
    throw new Error(
      `nota: --virtual produced invalid JSON${where}: ${(e as Error).message}\n${stdout.slice(0, 200)}`
    );
  }
  if (typeof parsed.code !== "string" || !Array.isArray(parsed.mappings)) {
    const where = sourcePath ? ` (${sourcePath})` : "";
    throw new Error(
      `nota: --virtual JSON missing \`code\`/\`mappings\`${where}`
    );
  }
  // Light per-mapping validation: the parallel arrays must be present and equal-length. Cheap, and
  // it catches a desynced binary before the offset-shift math runs in the language server.
  for (const m of parsed.mappings) {
    if (
      !Array.isArray(m.sourceOffsets) ||
      !Array.isArray(m.generatedOffsets) ||
      !Array.isArray(m.lengths) ||
      m.sourceOffsets.length !== m.generatedOffsets.length ||
      m.sourceOffsets.length !== m.lengths.length
    ) {
      throw new Error(
        "nota: --virtual CodeMapping has missing or mismatched-length offset arrays"
      );
    }
  }
  // `errors` is optional for forward-compat with a pre-D5 binary (treated as "no diagnostics");
  // a present array is validated to the `{message, start, len}` shape.
  const errors: NotaError[] = Array.isArray(parsed.errors)
    ? parsed.errors.map(e => ({
        message: String(e.message),
        start: Number(e.start) || 0,
        len: Number(e.len) || 0
      }))
    : [];
  return { code: parsed.code, mappings: parsed.mappings, errors };
}

// ===================================================================================================
// Reader-driven syntax highlight spans (via the node-target wasm reader).
// ===================================================================================================

/**
 * One reader-faithful highlight span over the **`.nota`** source: a `[start, end)` byte range and
 * its kind (a stable kebab-case name — `"tag-host"`, `"js-keyword"`, `"emphasis-strong"`, …). This
 * is the reader's `parse_nota_highlights` output the CodeMirror playground already paints; the
 * language server consumes it for reader-driven **semantic tokens** (contract D2).
 */
export interface HighlightSpan {
  /** `.nota` byte offset of the span's first byte. */
  start: number;
  /** `.nota` byte offset one past the span's last byte. */
  end: number;
  /** The stable kebab-case highlight-kind name (index into {@link highlightKindNames}). */
  kind: string;
}

/** The minimal shape of the node-target wasm reader this shim calls for highlighting. */
interface WasmReader {
  highlight(source: string): Uint32Array;
  highlightKindNames(): string[];
}

let wasmReader: WasmReader | null = null;
let cachedKindNames: string[] | null = null;

/**
 * Lazily load the **node-target** wasm reader (`oxc/napi/nota_wasm/pkg-node`, built with
 * `wasm-pack build --target nodejs`). In-process and sub-ms — no subprocess — so it is suitable for
 * per-keystroke semantic tokens (unlike the {@link compile} binary path). Resolved relative to this
 * package (like {@link resolveBinary}); overridable with `NOTA_WASM_NODE` for CI / alternate builds.
 *
 * @throws if the node wasm package is missing — rebuild with
 *   `wasm-pack build napi/nota_wasm --target nodejs --out-dir pkg-node --out-name nota_wasm`.
 */
function loadWasmReader(): WasmReader {
  if (wasmReader) {
    return wasmReader;
  }
  const fromEnv = process.env.NOTA_WASM_NODE;
  const here = dirname(fileURLToPath(import.meta.url));
  const wasmPath =
    fromEnv && fromEnv.length > 0
      ? fromEnv
      : join(
          here,
          "..",
          "..",
          "..",
          "oxc",
          "napi",
          "nota_wasm",
          "pkg-node",
          "nota_wasm.js"
        );
  const require = createRequire(import.meta.url);
  wasmReader = require(wasmPath) as WasmReader;
  return wasmReader;
}

/**
 * The stable kebab-case highlight-kind names, in discriminant order (index a {@link HighlightSpan}'s
 * `kind` triple value into this). Cached after the first call.
 */
export function highlightKindNames(): string[] {
  if (!cachedKindNames) {
    cachedKindNames = loadWasmReader().highlightKindNames();
  }
  return cachedKindNames;
}

/**
 * Reader-faithful syntax highlight spans for a whole `.nota` source, decoded from the wasm reader's
 * flat `[start, end, kind]` `Uint32Array` triples into named {@link HighlightSpan}s. Spans are
 * source-native (no preamble shift) and already sorted start-ascending / end-descending (outer
 * spans before the spans they contain — paint in list order).
 *
 * @param source the `.nota` file contents
 * @returns the highlight spans
 * @throws if the source fails to parse (the reader's `highlight` throws) — callers that want editor
 *   resilience (the semantic-tokens plugin) should catch and serve their last-good spans (D2).
 */
export function highlightSpans(source: string): HighlightSpan[] {
  const reader = loadWasmReader();
  const names = highlightKindNames();
  const flat = reader.highlight(source);
  const spans: HighlightSpan[] = [];
  for (let i = 0; i + 2 < flat.length; i += 3) {
    const kindIndex = flat[i + 2];
    spans.push({
      start: flat[i],
      end: flat[i + 1],
      kind: names[kindIndex] ?? String(kindIndex)
    });
  }
  return spans;
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
