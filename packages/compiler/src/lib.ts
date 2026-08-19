/**
 * JavaScript policy around the in-process wasm reader. It binds the reader's free names to the
 * Solid runtime and ambient prelude; `@nota-lang/compiler/reader` exposes the raw wasm surface.
 */

import * as reader from "./reader.js";

/** The Solid-runtime module the emit's structural names are bound to. */
export const CORE_RUNTIME_MODULE = "@nota-lang/core";

/** The default module the ambient prelude binds from ({@link PreludeOptions.module}). */
export const PRELUDE_MODULE = "@nota-lang/prelude";

/** Framework modules that generated documents may import. */
export const FRAMEWORK_MODULES: readonly string[] = [
  CORE_RUNTIME_MODULE,
  PRELUDE_MODULE,
  "solid-js",
  "solid-js/web"
];

/** The unique package roots of {@link FRAMEWORK_MODULES} (dedupe/pinning is per-package). */
export const FRAMEWORK_PACKAGES: readonly string[] = [
  ...new Set(
    FRAMEWORK_MODULES.map(m =>
      m
        .split("/")
        .slice(0, m.startsWith("@") ? 2 : 1)
        .join("/")
    )
  )
];

/** Solid names available to embedded document code without an explicit import. */
export const SOLID_AMBIENT_NAMES = [
  "createSignal",
  "createMemo",
  "createEffect",
  "createResource",
  "createContext",
  "useContext",
  "batch",
  "untrack",
  "on",
  "onMount",
  "onCleanup",
  "children",
  "mergeProps",
  "splitProps",
  "Show",
  "For",
  "Index",
  "Switch",
  "Match",
  "Suspense",
  "ErrorBoundary"
] as const;

/** Fail early when the vendored wasm and TypeScript shim are out of sync. */
const EMIT_SURFACE = (() => {
  try {
    return reader.emitSurface();
  } catch (err) {
    throw new Error(
      `nota: reader.emitSurface() is unavailable — stale src/generated wasm build? (${
        err instanceof Error ? err.message : String(err)
      })`
    );
  }
})();

/** Structural runtime names reported by the reader. */
export const CORE_RUNTIME_NAMES: readonly string[] = EMIT_SURFACE.structural;

const documentExportNames = EMIT_SURFACE.reserved.filter(
  name =>
    !EMIT_SURFACE.structural.includes(name) &&
    !EMIT_SURFACE.solid.includes(name) &&
    !EMIT_SURFACE.solidWeb.includes(name) &&
    !EMIT_SURFACE.prelude.includes(name)
);
if (documentExportNames.length !== 1) {
  throw new Error(
    `nota: expected one document export name in emitSurface(), found ${documentExportNames.length}`
  );
}

/** The emitted document function's name. */
export const DOC_EXPORT_NAME: string = documentExportNames[0];

/** The `solid-js/web` names the emit may reference free (`Dynamic` — dynamic `@(expr)` tags).
 * Derived from the reader (`emitSurface().solidWeb`). */
export const SOLID_WEB_NAMES: readonly string[] = EMIT_SURFACE.solidWeb;

/** Components and configuration functions supplied by the default ambient prelude. */
export const AMBIENT_PRELUDE_NAMES = [
  "Tex",
  "CodeInline",
  "CodeBlock",
  "Heading",
  "Title",
  "Toc",
  "Label",
  "Ref",
  "Definition",
  "Figure",
  "Subfigure",
  "Caption",
  "Smallcaps",
  "Footnote",
  "Footnotes",
  "FootnotesList",
  "Cite",
  "Bibliography",
  "lstset",
  "mathset",
  "secset",
  "bibset",
  "texRef"
] as const;

/** The ambient-prelude injection policy ({@link CompileOptions.prelude}). */
export interface PreludeOptions {
  /**
   * Module the ambient prelude bindings are imported from. Default `"@nota-lang/prelude"`.
   */
  module?: string;
  /**
   * Extra ambient names beyond {@link AMBIENT_PRELUDE_NAMES} that {@link PreludeOptions.module}
   * supplies (site-specific components a setup module re-exports). Every listed name must be an
   * export of that module. The Solid state surface needs no entry here — it is built in
   * ({@link SOLID_AMBIENT_NAMES}). Default `[]`.
   */
  extraNames?: string[];
}

/** Options for {@link compile}. */
export interface CompileOptions {
  /**
   * The original path of the source (e.g. a Vite module id). Names the source in diagnostics and
   * any future sourcemap. Does **not** need to exist on disk.
   */
  sourcePath?: string;
  /**
   * Ambient-prelude injection policy: `false` disables the injection entirely (the integrator
   * supplies the ambient names another way — e.g. the playground evaluates the emit inside a scope
   * object). Default: inject from `"@nota-lang/prelude"`.
   */
  prelude?: PreludeOptions | false;
}

/** Minimal source-map shape accepted by Vite and Rollup. */
export interface SourceMapV3 {
  mappings: string;
  version?: number;
  file?: string;
  sources?: (string | null)[];
  sourcesContent?: (string | null)[];
  names?: string[];
  sourceRoot?: string;
}

/** The result of {@link compile}: the emitted Solid JSX module and (when available) its sourcemap. */
export interface CompileResult {
  /**
   * The emitted Solid JSX module — the reader's native JSX emit, with the `@nota-lang/core` /
   * `solid-js` / ambient-prelude imports prepended.
   */
  code: string;
  /**
   * The emit's free names (root-unresolved, value-position identifiers of the bare module,
   * sorted), straight from the reader's scope analysis — the structural surface
   * (`NotaDoc`/`UlLi`/…, bound by the prepended imports), the ambient surface, plus any
   * genuinely unbound user references — useful for diagnostics ("unbound name …").
   */
  freeNames: string[];
  /** A {@link SourceMapV3}, when the backend produces one (the reader does not yet — see notes). */
  map?: SourceMapV3;
}

/** Build the ambient-prelude import for the reported free names. */
function preludeImport(
  freeNames: string[],
  prelude: PreludeOptions | false | undefined
): string {
  if (prelude === false) {
    return "";
  }
  const module = prelude?.module ?? PRELUDE_MODULE;
  const ambient = new Set<string>([
    ...AMBIENT_PRELUDE_NAMES,
    ...(prelude?.extraNames ?? [])
  ]);
  const needed = freeNames.filter(name => ambient.has(name));
  return needed.length > 0
    ? `import { ${needed.join(", ")} } from ${JSON.stringify(module)};\n`
    : "";
}

/** Compile Nota source to a Solid JSX module with its free-name imports prepended. */
export function compile(
  source: string,
  opts: CompileOptions = {}
): CompileResult {
  let emitted: string;
  let freeNames: string[];
  try {
    ({ code: emitted, freeNames } = reader.compile(source));
  } catch (err) {
    throw toCompileError(err, opts.sourcePath);
  }
  if (!Array.isArray(freeNames)) {
    // Do not silently skip imports when the vendored reader is stale.
    const where = opts.sourcePath ? ` (${opts.sourcePath})` : "";
    throw new Error(
      `nota: reader emit missing \`freeNames\` — stale src/generated wasm build?${where}`
    );
  }

  const code =
    bindFree(freeNames, CORE_RUNTIME_NAMES, CORE_RUNTIME_MODULE) +
    bindFree(freeNames, SOLID_AMBIENT_NAMES, "solid-js") +
    bindFree(freeNames, SOLID_WEB_NAMES, "solid-js/web") +
    preludeImport(freeNames, opts.prelude) +
    emitted;

  // A future reader sourcemap must be shifted by the prepended imports.
  return { code, freeNames, map: undefined };
}

/** The import binding `names ∩ freeNames` to `module`, or `""` when nothing needs binding. */
function bindFree(
  freeNames: string[],
  names: readonly string[],
  module: string
): string {
  const needed = names.filter(n => freeNames.includes(n));
  return needed.length > 0
    ? `import { ${needed.join(", ")} } from ${JSON.stringify(module)};\n`
    : "";
}

// ===================================================================================================
// The virtual (`.tsx`) emit for the language server.
// ===================================================================================================

/**
 * A Volar `@volar/language-core` `CodeMapping`, as emitted by the reader's `compile_virtual`
 * (`oxc/crates/oxc/src/nota.rs`).
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
 * One recovered Nota diagnostic from the reader's EOF error-recovery on the virtual path: a
 * `message` and the byte span (`start`/`len`) into the **`.nota`** source it points at. The
 * language server maps these to LSP diagnostics. A label-less diagnostic reports
 * `start: 0, len: 0`.
 */
export interface NotaError {
  /** The human-readable diagnostic message. */
  message: string;
  /** Byte offset into the `.nota` source where the diagnostic begins. */
  start: number;
  /** Length in bytes of the diagnostic's span (`0` for a point diagnostic, e.g. at EOF). */
  len: number;
}

/** A recoverable virtual TSX emit for editor tooling. */
export interface VirtualCompileResult {
  /** The emitted virtual `.tsx` module (type-preserving, no runtime/ambient preamble). */
  code: string;
  /** The {@link CodeMapping}s mapping `.tsx` offsets back to `.nota` offsets. */
  mappings: CodeMapping[];
  /** Recovered Nota parse/lowering diagnostics (byte-spanned into the `.nota`); empty if clean. */
  errors: NotaError[];
}

/** The raw wasm shape accepted by {@link validateVirtual}. @internal */
export interface VirtualJson {
  code: string;
  mappings: CodeMapping[];
  errors?: NotaError[];
}

/** Compile recoverable, type-preserving TSX for editor tooling. */
export function compileVirtual(
  source: string,
  opts: CompileOptions = {}
): VirtualCompileResult {
  const raw = reader.compileVirtual(source) as VirtualJson;
  return validateVirtual(raw, opts.sourcePath);
}

/** Validate a raw wasm virtual emit. @internal */
export function validateVirtual(
  parsed: VirtualJson,
  sourcePath?: string
): VirtualCompileResult {
  if (typeof parsed.code !== "string" || !Array.isArray(parsed.mappings)) {
    const where = sourcePath ? ` (${sourcePath})` : "";
    throw new Error(`nota: virtual emit missing \`code\`/\`mappings\`${where}`);
  }
  for (const m of parsed.mappings) {
    if (
      !Array.isArray(m.sourceOffsets) ||
      !Array.isArray(m.generatedOffsets) ||
      !Array.isArray(m.lengths) ||
      m.sourceOffsets.length !== m.generatedOffsets.length ||
      m.sourceOffsets.length !== m.lengths.length
    ) {
      throw new Error(
        "nota: virtual CodeMapping has missing or mismatched-length offset arrays"
      );
    }
  }
  // Rust `None` may cross the wasm boundary as `undefined`.
  const mappings = parsed.mappings.map(m => ({
    ...m,
    generatedLengths: m.generatedLengths ?? null
  }));
  // `errors` is optional for forward-compat with a wasm build that predates recovered-error
  // reporting (treated as "no diagnostics");
  // a present array is validated to the `{message, start, len}` shape.
  const errors: NotaError[] = Array.isArray(parsed.errors)
    ? parsed.errors.map(e => ({
        message: String(e.message),
        start: Number(e.start) || 0,
        len: Number(e.len) || 0
      }))
    : [];
  return { code: parsed.code, mappings, errors };
}

// ===================================================================================================
// Reader-driven syntax highlight spans.
// ===================================================================================================

/**
 * One reader-faithful highlight span over the **`.nota`** source: a `[start, end)` byte range and
 * its kind (a stable kebab-case name — `"tag-host"`, `"js-keyword"`, `"emphasis-strong"`, …). This
 * is the reader's `parse_nota_highlights` output the CodeMirror playground already paints; the
 * language server consumes it for reader-driven **semantic tokens**.
 */
export interface HighlightSpan {
  /** `.nota` byte offset of the span's first byte. */
  start: number;
  /** `.nota` byte offset one past the span's last byte. */
  end: number;
  /** The stable kebab-case highlight-kind name (index into {@link highlightKindNames}). */
  kind: string;
}

let cachedKindNames: string[] | null = null;

/**
 * The stable kebab-case highlight-kind names, in discriminant order (index a {@link HighlightSpan}'s
 * `kind` triple value into this). Cached after the first call.
 */
export function highlightKindNames(): string[] {
  if (!cachedKindNames) {
    cachedKindNames = reader.highlightKindNames();
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
 *   resilience (the semantic-tokens plugin) should catch and serve their last-good spans.
 */
export function highlightSpans(source: string): HighlightSpan[] {
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

/**
 * Normalize a thrown wasm-reader error (a `JsError` whose message is the newline-joined
 * diagnostics) into a `nota: failed to compile` message naming the source, with the raw diagnostic
 * text on `.diagnostics` for programmatic consumers (e.g. a Vite error overlay).
 */
function toCompileError(err: unknown, sourcePath?: string): Error {
  const diagnostics =
    err instanceof Error ? err.message : String(err ?? "nota: compile failed");
  const where = sourcePath ? ` (${sourcePath})` : "";
  const error = new Error(`nota: failed to compile${where}\n${diagnostics}`);
  (error as Error & { diagnostics?: string }).diagnostics = diagnostics;
  return error;
}
