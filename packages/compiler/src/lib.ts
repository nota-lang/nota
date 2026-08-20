/**
 * JavaScript policy around the in-process wasm reader. It binds the reader's free names to the
 * Solid runtime and ambient prelude; `@nota-lang/compiler/reader` exposes the raw wasm surface.
 */

import * as reader from "./reader.js";
import { SHIKI_LANG_MODULES } from "./shiki-langs.generated.js";

export { SHIKI_LANG_MODULES } from "./shiki-langs.generated.js";

/** The Solid-runtime module the emit's structural names are bound to. */
export const CORE_RUNTIME_MODULE = "@nota-lang/core";

/**
 * The package a fence tag's grammar is imported from.
 *
 * `@shikijs/langs`, never the `shiki` umbrella. `shiki`'s exports are condition-sensitive, and
 * under the `unwasm` condition (which Nitro adds by default) `shiki/core` pulls in the Oniguruma
 * wasm engine. Generated documents should not be able to drag that into an integrator's bundle
 * because they happened to contain a fence.
 */
export const SHIKI_LANGS_MODULE = "@shikijs/langs";

/** The module specifier for fence tag `lang`'s grammar (`@shikijs/langs/rust`). */
export function shikiLangModule(lang: string): string {
  return `${SHIKI_LANGS_MODULE}/${lang}`;
}

/** The default module the ambient prelude binds from ({@link PreludeOptions.module}). */
export const PRELUDE_MODULE = "@nota-lang/prelude";

/**
 * Framework modules that generated documents may import.
 *
 * `@shikijs/langs` is here because a fenced language tag compiles to `import … from
 * "@shikijs/langs/<tag>"` ({@link CompileOptions.grammars}). A document is not required to
 * depend on it to write ```rust, so integrators resolve these against their own dependency
 * tree when the document's own directory cannot — the same fallback the prelude and the Solid
 * runtime already rely on.
 */
export const FRAMEWORK_MODULES: readonly string[] = [
  CORE_RUNTIME_MODULE,
  PRELUDE_MODULE,
  "solid-js",
  "solid-js/web",
  SHIKI_LANGS_MODULE
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

/**
 * Which `@nota-lang/prelude` submodule supplies each ambient name.
 *
 * The emit imports from these directly rather than from the package barrel. A barrel makes every
 * ambient name look like a dependency on every other one: `export { Tex } from "./tex"` keeps
 * katex reachable from a document with no math, and `export { CodeBlock } from "./code"` keeps
 * the shiki engine reachable from a document with no code. `sideEffects: false` lets a bundler
 * see through that, but only if it is trusted and only for a bundler that implements it —
 * importing the module that actually holds the name needs neither.
 *
 * It also decides which stylesheets a page loads: `./figure` and `./def` import their own CSS, so
 * a document reaches those rules exactly when it renders those components.
 *
 * This is a claim about prelude's file layout, which the compiler cannot check — the drift test
 * in packages/playground (which depends on both) fails if a name moves.
 */
export const AMBIENT_PRELUDE_MODULES: Readonly<Record<string, string>> = {
  Tex: "tex",
  CodeInline: "code",
  CodeBlock: "code",
  Heading: "doc-state",
  Title: "doc-state",
  Toc: "doc-state",
  Label: "doc-state",
  Ref: "doc-state",
  Note: "doc-state",
  Notes: "doc-state",
  NotesList: "doc-state",
  Cite: "doc-state",
  Bibliography: "doc-state",
  Def: "def",
  texRef: "def",
  Figure: "figure",
  Subfigure: "figure",
  Caption: "figure",
  Smallcaps: "figure",
  // The positional setters sit with what they configure, not in a config grab-bag: `lstset`
  // registers grammars the code module highlights with, `mathset` the macros and output mode the
  // tex module renders through, `secset`/`bibset` the numbering and citation state doc-state
  // owns. A document reaching for one of them therefore reaches for the module it is about.
  lstset: "code",
  mathset: "tex",
  secset: "doc-state",
  bibset: "doc-state"
};

/**
 * Components and configuration functions supplied by the default ambient prelude.
 *
 * Ordered, and kept as its own list rather than derived from {@link AMBIENT_PRELUDE_MODULES}:
 * the language server's generated preamble declares the surface in this order, so grouping it by
 * submodule would churn that file for no reason. `compile.test.ts` pins the two key sets equal.
 */
export const AMBIENT_PRELUDE_NAMES = [
  "Tex",
  "CodeInline",
  "CodeBlock",
  "Heading",
  "Title",
  "Toc",
  "Label",
  "Ref",
  "Def",
  "Figure",
  "Subfigure",
  "Caption",
  "Smallcaps",
  "Note",
  "Notes",
  "NotesList",
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
  /**
   * Auto-register a shiki grammar for every fenced language tag: ```rust gets an
   * `import` of `@shikijs/langs/rust` and an `lstset({ langs })` call at the top of the
   * document.
   *
   * On by default, and the reason grammars can be opt-in at all — a document says which
   * languages it highlights simply by tagging its fences, and pays for exactly those rather than
   * for a preloaded set. `false` for integrators that resolve imports themselves against a fixed
   * module map (the in-browser evaluator), where an unresolvable specifier is a hard error.
   */
  grammars?: boolean;
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
  /**
   * The language tags on this document's fenced code blocks, sorted and deduplicated — every tag
   * as written, whether or not a grammar was found for it.
   */
  fenceLangs: string[];
  /** A {@link SourceMapV3}, when the backend produces one (the reader does not yet — see notes). */
  map?: SourceMapV3;
}

/**
 * Build the ambient-prelude imports for the reported free names.
 *
 * For the default prelude these are *submodule* imports — `@nota-lang/prelude/tex` rather than
 * the package barrel — so a document depends on the modules holding the names it uses and
 * nothing else (see {@link AMBIENT_PRELUDE_MODULES}). Names are grouped per module and the
 * modules emitted in a stable order, because the emit is compared byte-for-byte by tests and by
 * the two-pass render's convergence check.
 *
 * Two cases still bind through one module. A custom {@link PreludeOptions.module} is a single
 * module by definition — the integrator's own surface, whose internal layout the compiler knows
 * nothing about — and {@link PreludeOptions.extraNames} name exports of that module rather than
 * of prelude's submodules, so they follow the same path.
 */
function preludeImport(
  freeNames: string[],
  prelude: PreludeOptions | false | undefined
): string {
  if (prelude === false) {
    return "";
  }
  const custom = prelude?.module !== undefined;
  const extras = new Set(prelude?.extraNames ?? []);
  const barrel = prelude?.module ?? PRELUDE_MODULE;

  const bind = (names: string[], module: string) =>
    names.length > 0
      ? `import { ${names.join(", ")} } from ${JSON.stringify(module)};\n`
      : "";

  if (custom) {
    const ambient = new Set([...AMBIENT_PRELUDE_NAMES, ...extras]);
    return bind(
      freeNames.filter(name => ambient.has(name)),
      barrel
    );
  }

  const byModule = new Map<string, string[]>();
  for (const name of freeNames) {
    const module = AMBIENT_PRELUDE_MODULES[name];
    if (module !== undefined) {
      byModule.set(module, [...(byModule.get(module) ?? []), name]);
    }
  }
  const submodules = [...byModule.keys()]
    .sort()
    .map(module =>
      bind(byModule.get(module) as string[], `${barrel}/${module}`)
    )
    .join("");
  // Extra ambient names are the integrator's, and live on the barrel even when prelude is the
  // default one (a site setup module re-exporting its own components).
  return (
    submodules +
    bind(
      freeNames.filter(n => extras.has(n)),
      barrel
    )
  );
}

/** A JS identifier for the grammar bound to fence tag `lang` (tags may hold `+`, `-`, `#`). */
function grammarBinding(lang: string): string {
  return `__notaLang_${lang.replace(/[^A-Za-z0-9_$]/g, "_")}`;
}

/**
 * The grammar imports for `fenceLangs`, and the `lstset` call that registers them.
 *
 * Only tags shiki actually publishes a module for get an import. An unknown tag — a typo, or a
 * grammar the document registers itself through `lstset({ langs })` — is left alone: emitting
 * `@shikijs/langs/wibble` would fail the *bundler*, whose error names generated code rather than
 * the fence that caused it, and would break the documents that legitimately supply their own
 * grammars. Those still reach the runtime's "no grammar loaded for lang …" warning.
 *
 * The registration is a statement at the top of the document function rather than at module
 * scope, because `lstset` outside a document session writes the session-wide *baseline* and would
 * leak one document's grammars into every other document on the page.
 */
function grammarBindings(fenceLangs: string[]): {
  imports: string;
  register: string;
} {
  const known = fenceLangs.filter(lang => SHIKI_LANG_MODULES.has(lang));
  if (known.length === 0) {
    return { imports: "", register: "" };
  }
  const imports = known
    .map(
      lang =>
        `import ${grammarBinding(lang)} from ${JSON.stringify(
          shikiLangModule(lang)
        )};\n`
    )
    .join("");
  const langs = known.map(grammarBinding).join(", ");
  return { imports, register: `lstset({ langs: [${langs}] });` };
}

/**
 * Splice `statement` in as the first statement of the emitted document function.
 *
 * String surgery on generated output, which is safe in the way surgery on *user* source would not
 * be: the reader emits this header verbatim, and `emitted_document_header_is_spliceable` in
 * tests/compile.test.ts fails if that ever stops being true.
 */
function injectIntoDoc(emitted: string, statement: string): string {
  if (statement === "") {
    return emitted;
  }
  const header = `export default function ${DOC_EXPORT_NAME}() {`;
  const at = emitted.indexOf(header);
  if (at === -1) {
    throw new Error(
      `nota: cannot register fence grammars — the reader's emit no longer opens with ` +
        `\`${header}\`. Update injectIntoDoc() in @nota-lang/compiler.`
    );
  }
  const end = at + header.length;
  return `${emitted.slice(0, end)}\n\t${statement}${emitted.slice(end)}`;
}

/** Compile Nota source to a Solid JSX module with its free-name imports prepended. */
export function compile(
  source: string,
  opts: CompileOptions = {}
): CompileResult {
  let emitted: string;
  let freeNames: string[];
  let fenceLangs: string[];
  try {
    ({ code: emitted, freeNames, fenceLangs } = reader.compile(source));
  } catch (err) {
    throw toCompileError(err, opts.sourcePath);
  }
  if (!Array.isArray(freeNames) || !Array.isArray(fenceLangs)) {
    // Do not silently skip imports when the vendored reader is stale.
    const where = opts.sourcePath ? ` (${opts.sourcePath})` : "";
    throw new Error(
      `nota: reader emit missing \`freeNames\`/\`fenceLangs\` — stale src/generated wasm ` +
        `build?${where}`
    );
  }

  const code = bindImports({ code: emitted, freeNames, fenceLangs }, opts);

  // A future reader sourcemap must be shifted by the prepended imports.
  return { code, freeNames, fenceLangs, map: undefined };
}

/** A bare reader emit — what `reader.compile`/`reader.analyze` return, narrowed to what binding needs. */
export interface ReaderEmit {
  /** The emitted module, before imports are prepended. */
  code: string;
  /** Root-unresolved value identifiers, sorted. */
  freeNames: string[];
  /** Fenced language tags, sorted and deduplicated. */
  fenceLangs: string[];
}

/**
 * Bind a bare reader emit to its runtime and ambient imports, and register the grammars its
 * fences ask for.
 *
 * Takes the whole emit rather than its fields: a caller that passed `code` and `freeNames` and
 * forgot `fenceLangs` would get a document that compiles, renders, and silently highlights
 * nothing — the failure is invisible at the call site, so the call site does not get to make it.
 *
 * Registering adds `lstset` to the names the prelude import must bind, which is why the grammar
 * work happens before `preludeImport` reads the free-name list.
 */
export function bindImports(
  emit: ReaderEmit,
  opts: CompileOptions = {}
): string {
  const { code: emitted, freeNames, fenceLangs } = emit;
  const { imports, register } =
    opts.grammars === false
      ? { imports: "", register: "" }
      : grammarBindings(fenceLangs);
  const body = injectIntoDoc(emitted, register);
  // The injected call references `lstset` free, so the prelude import has to cover it — unless
  // the document already calls `lstset` itself, in which case it is in `freeNames` and adding it
  // again would emit `import { lstset, lstset }`.
  const names =
    register === "" || freeNames.includes("lstset")
      ? freeNames
      : [...freeNames, "lstset"];
  return (
    bindFree(names, CORE_RUNTIME_NAMES, CORE_RUNTIME_MODULE) +
    bindFree(names, SOLID_AMBIENT_NAMES, "solid-js") +
    bindFree(names, SOLID_WEB_NAMES, "solid-js/web") +
    preludeImport(names, opts.prelude) +
    imports +
    body
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
  /** Fenced language tags, sorted and deduplicated — see {@link CompileResult.fenceLangs}. */
  fenceLangs: string[];
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
    fenceLangs: raw.fenceLangs,
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
