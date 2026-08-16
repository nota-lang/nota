/**
 * `@nota-lang/compiler` — the Node shim around the oxc Nota *reader*.
 *
 * The reader lives in the Rust fork (`oxc::nota::compile`); this package is the JS-side glue that
 * makes its output usable from Node. {@link compile} takes a `.nota` source string, rewrites the
 * reader's h-call emit into **Solid JSX** ({@link jsxify} — the interim bridge until reader vNext
 * emits JSX natively, design/solid.md), and returns the module with the imports the reader
 * deliberately omits **prepended**:
 *
 * 1. the `@nota-lang/solid` import for the structural names the rewrite introduced
 *    (`NotaDoc`/`Reforest`/`UlLi`/`OlLi`) + the compat constructors;
 * 2. the `solid-js` import for the ambient state/control-flow surface the emit references *free*
 *    ({@link SOLID_AMBIENT_NAMES}) + `For` when a `@for` loop was recovered; and
 * 3. an **ambient prelude** import binding the prelude names the module references *free* —
 *    the reader reports the emit's free names ({@link CompileResult.freeNames}, from real scope
 *    analysis), and the shim binds the intersection with {@link AMBIENT_PRELUDE_NAMES} (plus any
 *    integrator {@link PreludeOptions.extraNames}) to {@link PreludeOptions.module}. A name the
 *    document binds itself (`%import { Tex } from …`) is not free, so the user's binding wins.
 *
 * The reader stays mechanism (which names are free); which module supplies them is policy and
 * lives here, under the integrator's control (`prelude: false` disables the injection).
 *
 * The backend is the node-target wasm reader, `@nota-lang/wasm-node` (`wasm-pack build --target
 * nodejs`; the workspace dep on the repo's `oxc/napi/nota_wasm/pkg-node` in development, an npm
 * package outside it), imported like any other dependency. It exposes the same `oxc::nota` entries
 * (`compile` / `compileVirtual` / `highlight`) in-process — no subprocess, no temp files — so
 * installs need no Rust toolchain and no platform-specific binary.
 */

import * as reader from "@nota-lang/wasm";
import { type JsxifyUsed, jsxify } from "./jsxify.js";

export { type JsxifyResult, type JsxifyUsed, jsxify } from "./jsxify.js";

/** The Solid-runtime module the rewritten emit's structural names are bound to. */
export const SOLID_RUNTIME_MODULE = "@nota-lang/solid";

/**
 * The `solid-js` ambient surface (design/solid.md): the state/control-flow names a document's
 * `%`-code may reference free. Replaces the old React-hook ambient set — documents write Solid
 * idioms now. Bound from `"solid-js"` when the emit references them free.
 */
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

/**
 * The `@nota-lang/solid` names an emit may need: the structural names `jsxify` introduces
 * (`NotaDoc`/`Reforest`/`UlLi`/`OlLi` — reported in {@link JsxifyUsed}, not free names) plus the
 * compat constructors the reader still emits as calls.
 */
const SOLID_RUNTIME_NAMES = ["inlineComponent", "blockComponent"] as const;

/**
 * The ambient prelude surface (design/decode.md §The registry & config) — the names the reader's
 * emit may reference free without the document binding them:
 *
 * - the **component slots**: `Tex`/`CodeInline`/`CodeBlock` (math/code), `Heading` (`#` sugar), and
 *   the doc-state family (`<x>`/`&x`/`[^x]`/`[^x]:` sugar lowers to `h(Label|Ref|…)`);
 * - the **config fns** (doc-global, last-write-wins, reset per render): `lstset`/`mathset`/
 *   `secset`/`bibset`, surfacing as bare calls in embedded JS (`% secset({ … })`).
 *
 * {@link compile} binds whichever of these the emit references free (per the reader's scope
 * analysis) to the configured prelude module. One flat list: with real free-name metadata the old
 * tag-vs-call textual distinction is moot.
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
  "Definition",
  "Footnote",
  "FootnoteMark",
  "FootnoteText",
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

/** The result of {@link compile}: the emitted Solid JSX module and (when available) its sourcemap. */
export interface CompileResult {
  /**
   * The emitted Solid JSX module — the reader's emit through {@link jsxify}, with the
   * `@nota-lang/solid` / `solid-js` / ambient-prelude imports prepended.
   */
  code: string;
  /**
   * The **reader emit's** free names (root-unresolved, value-position identifiers of the bare
   * module, pre-jsxify, sorted), straight from the reader's scope analysis. Includes the h-call
   * surface (`h`/`decode`/… — dissolved by the rewrite); the rest is the ambient surface plus
   * any genuinely unbound user references — useful for diagnostics ("unbound name …").
   */
  freeNames: string[];
  /** A {@link SourceMapV3}, when the backend produces one (the reader does not yet — see notes). */
  map?: SourceMapV3;
}

/**
 * The ambient prelude import for `freeNames` under `prelude`, or `""` when nothing needs binding.
 * A name is bound iff the emit references it free **and** it belongs to the ambient surface
 * (built-ins + `extraNames`); dedup/shadowing is the reader's scope analysis, not textual guesses.
 */
function preludeImport(
  freeNames: string[],
  prelude: PreludeOptions | false | undefined
): string {
  if (prelude === false) {
    return "";
  }
  const module = prelude?.module ?? "@nota-lang/prelude";
  const ambient = new Set<string>([
    ...AMBIENT_PRELUDE_NAMES,
    ...(prelude?.extraNames ?? [])
  ]);
  const needed = freeNames.filter(name => ambient.has(name));
  return needed.length > 0
    ? `import { ${needed.join(", ")} } from ${JSON.stringify(module)};\n`
    : "";
}

/**
 * Compile a `.nota` source string to an emitted JS module.
 *
 * Runs the in-process wasm reader. The {@link RUNTIME_IMPORT} is prepended to the result, followed
 * by the ambient prelude import for the free names the emit references (see {@link CompileOptions.prelude}).
 * A reader diagnostic is surfaced as the thrown `Error`'s message (raw text also on `.diagnostics`).
 *
 * @param source the `.nota` file contents
 * @param opts   optional {@link CompileOptions}
 * @returns the {@link CompileResult} (`{ code, freeNames, map? }`)
 * @throws if the reader reports a diagnostic — the error message carries the diagnostic text.
 */
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
    // A wasm build predating free-name metadata would silently skip the prelude injection — the
    // classic stale-artifact trap. Fail loudly instead (cf. validateVirtual).
    const where = opts.sourcePath ? ` (${opts.sourcePath})` : "";
    throw new Error(
      `nota: reader emit missing \`freeNames\` — stale @nota-lang/wasm build?${where}`
    );
  }

  // Rewrite the h-call surface into Solid JSX (the interim bridge; reader vNext emits JSX
  // directly and this becomes a no-op deletion — design/solid.md §The pipeline).
  const { code: jsx, used } = jsxify(emitted);

  // Prepend the imports the reader omits: the @nota-lang/solid structural/compat names, the
  // solid-js ambient names, then the ambient prelude bindings.
  const code =
    solidRuntimeImport(freeNames, used) +
    solidJsImport(freeNames, used) +
    preludeImport(freeNames, opts.prelude) +
    jsx;

  // The reader does not surface a sourcemap yet; structured CodeMappings + a flat v3 map are a
  // forthcoming reader upgrade (jsxify would compose one via babel generate). The prepended
  // preamble shifts generated offsets by its line count, which a real map must account for
  // (trivial to offset, and localized here — the one place that prepends). Kept undefined until
  // the backend emits it.
  return { code, freeNames, map: undefined };
}

/**
 * The `@nota-lang/solid` import: the structural names `jsxify` introduced (from {@link JsxifyUsed})
 * plus the compat constructors the emit references free. `""` when nothing needs binding.
 */
function solidRuntimeImport(freeNames: string[], used: JsxifyUsed): string {
  const names = [
    ...(["NotaDoc", "Reforest", "UlLi", "OlLi"] as const).filter(n => used[n]),
    ...SOLID_RUNTIME_NAMES.filter(n => freeNames.includes(n))
  ];
  return names.length > 0
    ? `import { ${names.join(", ")} } from ${JSON.stringify(SOLID_RUNTIME_MODULE)};\n`
    : "";
}

/**
 * The `solid-js` import: the ambient surface the emit references free, plus `For` when `jsxify`
 * introduced it (a `@for` loop). `""` when nothing needs binding.
 */
function solidJsImport(freeNames: string[], used: JsxifyUsed): string {
  const names = new Set(SOLID_AMBIENT_NAMES.filter(n => freeNames.includes(n)));
  if (used.For) {
    names.add("For");
  }
  return names.size > 0
    ? `import { ${[...names].join(", ")} } from "solid-js";\n`
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

/**
 * The raw virtual-emit shape the wasm entry returns (a Rust `None` for `generatedLengths` arrives
 * as `undefined` — {@link validateVirtual} normalizes it to `null`).
 */
interface VirtualJson {
  code: string;
  mappings: CodeMapping[];
  errors?: NotaError[];
}

/**
 * Compile a `.nota` source to the **type-preserving virtual `.tsx`** emit + Volar CodeMappings.
 * The language server (`@nota-lang/language-server`) consumes this.
 *
 * Runs the in-process wasm reader's `compileVirtual`. Unlike {@link compile}, the runtime import is
 * **not** prepended here — the language-server `LanguagePlugin` prepends a runtime+ambient typing
 * preamble (so `h`/`decode`/`useState`/… type-check) and shifts the mappings by its length; doing
 * it here would double-shift.
 *
 * The reader uses **EOF error-recovery** on this path, so it does **not** fail on unterminated
 * markup: a syntax error yields a best-effort `code` + `mappings` and comes back in
 * {@link VirtualCompileResult.errors} for the language server to surface as LSP diagnostics.
 *
 * @param source the `.nota` file contents
 * @param opts   optional {@link CompileOptions}
 * @returns the {@link VirtualCompileResult} (`{ code, mappings, errors }`)
 * @throws only if the reader itself fails (a desynced wasm build). A *recoverable* Nota syntax
 *   error does not throw.
 */
export function compileVirtual(
  source: string,
  opts: CompileOptions = {}
): VirtualCompileResult {
  // The wasm entry returns the already-structured object (camelCase, `errors` always present).
  // Validate the shape anyway — a desynced wasm build should surface a clear error here, not an
  // `undefined` downstream.
  const raw = reader.compileVirtual(source) as VirtualJson;
  return validateVirtual(raw, opts.sourcePath);
}

/**
 * Validate + normalize a raw virtual-emit object (the wasm entry's return value) into a
 * {@link VirtualCompileResult}, so a desynced wasm build surfaces a clear error rather than a
 * downstream `undefined`. Exported for unit-testing the validation against hand-written shapes.
 *
 * @internal
 */
export function validateVirtual(
  parsed: VirtualJson,
  sourcePath?: string
): VirtualCompileResult {
  if (typeof parsed.code !== "string" || !Array.isArray(parsed.mappings)) {
    const where = sourcePath ? ` (${sourcePath})` : "";
    throw new Error(`nota: virtual emit missing \`code\`/\`mappings\`${where}`);
  }
  // Light per-mapping validation: the parallel arrays must be present and equal-length. Cheap, and
  // it catches a desynced backend before the offset-shift math runs in the language server.
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
  // Normalize `generatedLengths` to `null` (serde-wasm-bindgen serializes a Rust `None` as
  // `undefined`; the declared type is `number[] | null`).
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
