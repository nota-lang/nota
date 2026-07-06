/**
 * The playground pipeline: fold a `.nota` source into a {@link PipelineResult} (compile → SSG),
 * carrying the prior result so each pane shows the **freshest valid artifact for its stage**.
 *
 * Three outcomes, by which stage threw:
 *   - **parse/emit error** (`compile*`): nothing new is valid, so keep the last-good result and just
 *     surface the message. The console stays quiet — this fires on nearly every half-typed keystroke.
 *   - **SSG runtime error** (`runSSG` executes the user's islands during SSR): the compile *succeeded*,
 *     so surface this run's emitted JS (the Generated-JS pane must not show the prior run's code) while
 *     keeping the last-good SSG/Rendered output under the error; log the error (with its stack) so it's
 *     visible in the JS console.
 *   - **success**: every artifact fresh, no error.
 */

// Subpath import on purpose: the package entry (`@nota-lang/vite`) pulls the compiler shim
// (child_process — Node-only); `registry` is the pure opts → hydration-entry-source generator.
import { generateClientEntry } from "@nota-lang/vite/registry";
import { compileNota, compileNotaRaw, parseNotaAst } from "./compiler";
import { type DocFn, type ManifestEntry, runSSG } from "./ssg";

/** The result of running the pipeline over the current editor value. */
export interface PipelineResult {
  /** The post-parse Nota AST as ESTree JSON (with `start`/`end`), for the AST tree pane. */
  ast: string;
  /** The source that produced {@link ast} — kept paired so the tree's node offsets index the right
   * text (on a parse error `ast` holds the last-good tree while the editor has raced ahead). */
  astSource: string;
  /** The bare emitted module, for the Generated-JS pane. */
  code: string;
  /** The emitted module with the runtime import prepended (fed to the SSG runner + iframe). */
  full: string;
  /** The SSG HTML. */
  html: string;
  /** The island manifest (debug metadata only; also the `hasIslands` gate). */
  manifest: Record<string, ManifestEntry>;
  /**
   * The evaluated document component (the module's default export), for the Rendered pane to
   * replay via `hydrateDocument(Doc, { root })`. `null` until a successful SSG run.
   */
  Doc: DocFn | null;
  /**
   * The generated client **hydration entry** (what a build ships as the inlined `<script>`):
   * `generateClientEntry({ moduleId })` — the replay entry (`import Doc …; hydrateDocument(Doc)`),
   * the exact source the CLI esbuild-bundles. `""` for an island-free document — no client JS is
   * generated at all (the zero-JS property).
   */
  clientJs: string;
  /** A compile/render error, if the pipeline threw. */
  error: string | null;
}

export const EMPTY: PipelineResult = {
  ast: "",
  astSource: "",
  code: "",
  full: "",
  html: "",
  manifest: {},
  Doc: null,
  clientJs: "",
  error: null
};

const errMessage = (err: unknown): string =>
  err instanceof Error ? err.message : String(err);

/** Run compile → SSG over `source`, folding the outcome into the prior result `prev`. */
export function runPipeline(
  source: string,
  prev: PipelineResult
): PipelineResult {
  let ast: string;
  let code: string;
  let full: string;
  try {
    // `parseAst` shares the reader's parse with `compile*`, so a parse error fails all three here.
    ast = parseNotaAst(source);
    code = compileNotaRaw(source);
    full = compileNota(source);
  } catch (err) {
    // Parse/emit error — expected while typing, so surface it in the UI but keep the console quiet.
    return { ...prev, error: errMessage(err) };
  }
  try {
    const { html, manifest, Doc } = runSSG(full);
    // The hydration entry a real build would ship: generated iff there is an island to hydrate
    // (mirrors the CLI, which emits no client bundle at all for an island-free doc). The entry is
    // pure wiring — `import Doc …; setAdapter(adapter); hydrateDocument(Doc);`.
    const clientJs =
      Object.keys(manifest).length > 0
        ? generateClientEntry({ moduleId: "./doc.compiled.mjs" })
        : "";
    return {
      ast,
      astSource: source,
      code,
      full,
      html,
      manifest,
      Doc,
      clientJs,
      error: null
    };
  } catch (err) {
    // Runtime error executing the user's islands during SSG — log the full error so its stack trace
    // is visible in the JS console (the UI surfaces only the message). The compile succeeded, so the
    // Generated-JS pane still shows this run's `code`/`full`; the SSG/Rendered panes keep their
    // last-good output under the error.
    console.error("[nota] SSG runtime error:", err);
    return {
      ...prev,
      ast,
      astSource: source,
      code,
      full,
      error: errMessage(err)
    };
  }
}
