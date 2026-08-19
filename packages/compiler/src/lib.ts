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

  const code = bindImports(emitted, freeNames, opts);

  // A future reader sourcemap must be shifted by the prepended imports.
  return { code, freeNames, map: undefined };
}

/** Bind a bare reader emit to its runtime and ambient imports. */
export function bindImports(
  emitted: string,
  freeNames: string[],
  opts: CompileOptions = {}
): string {
  return (
    bindFree(freeNames, CORE_RUNTIME_NAMES, CORE_RUNTIME_MODULE) +
    bindFree(freeNames, SOLID_AMBIENT_NAMES, "solid-js") +
    bindFree(freeNames, SOLID_WEB_NAMES, "solid-js/web") +
    preludeImport(freeNames, opts.prelude) +
    emitted
  );
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

/** A byte-offset mapping from Nota source to the bare virtual TSX. */
export interface CodeMapping {
  sourceOffsets: number[];
  generatedOffsets: number[];
  lengths: number[];
  generatedLengths: number[] | null;
  data: MappingCapabilities;
}

/** Volar capabilities for a mapped range. */
export interface MappingCapabilities {
  completion: boolean;
  format: boolean;
  navigation: boolean;
  semantic: boolean;
  structure: boolean;
  verification: boolean;
}

/** A recovered diagnostic with a UTF-8 byte span into the Nota source. */
export interface NotaError {
  message: string;
  start: number;
  len: number;
}

/** One reader-faithful highlight span over UTF-8 source bytes. */
export interface HighlightSpan {
  start: number;
  end: number;
  kind: string;
}

/** Every editor-facing view derived from one recovered parse. */
export interface AnalysisResult {
  code: string;
  freeNames: string[];
  mappings: CodeMapping[];
  errors: NotaError[];
  ast: string;
  highlights: HighlightSpan[];
}

let cachedKindNames: string[] | null = null;
const analysisCache = new Map<string, AnalysisResult>();
const ANALYSIS_CACHE_SIZE = 16;

/** Highlight kind names in reader discriminant order. */
export function highlightKindNames(): string[] {
  if (!cachedKindNames) {
    cachedKindNames = reader.highlightKindNames();
  }
  return cachedKindNames;
}

function decodeHighlights(flat: readonly number[]): HighlightSpan[] {
  const names = highlightKindNames();
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

/** Parse once and derive all editor-facing representations. Results are cached by source text. */
export function analyze(source: string): AnalysisResult {
  const cached = analysisCache.get(source);
  if (cached) {
    analysisCache.delete(source);
    analysisCache.set(source, cached);
    return cached;
  }

  const raw = reader.analyze(source);
  if (typeof raw.code !== "string" || typeof raw.ast !== "string") {
    throw new Error("nota: reader analysis missing `code`/`ast`");
  }
  const mappings = raw.mappings.map(mapping => ({
    ...mapping,
    generatedLengths: mapping.generatedLengths ?? null
  }));
  const result: AnalysisResult = {
    code: raw.code,
    freeNames: raw.freeNames,
    mappings,
    errors: raw.errors,
    ast: raw.ast,
    highlights: decodeHighlights(raw.highlights)
  };
  analysisCache.set(source, result);
  if (analysisCache.size > ANALYSIS_CACHE_SIZE) {
    analysisCache.delete(analysisCache.keys().next().value as string);
  }
  return result;
}

/** Reader-faithful syntax highlights from the shared analysis pass. */
export function highlightSpans(source: string): HighlightSpan[] {
  return analyze(source).highlights;
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
