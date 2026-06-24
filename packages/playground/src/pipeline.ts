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

import { compileNota, compileNotaRaw } from "./compiler";
import { type ManifestEntry, runSSG } from "./ssg";

/** The result of running the pipeline over the current editor value. */
export interface PipelineResult {
  /** The bare emitted module, for the Generated-JS pane. */
  code: string;
  /** The emitted module with the runtime import prepended (fed to the SSG runner + iframe). */
  full: string;
  /** The SSG HTML. */
  html: string;
  /** The island manifest. */
  manifest: Record<string, ManifestEntry>;
  /** The island components, keyed by name (for the Rendered pane to hydrate). */
  registry: Record<string, unknown>;
  /** A compile/render error, if the pipeline threw. */
  error: string | null;
}

export const EMPTY: PipelineResult = {
  code: "",
  full: "",
  html: "",
  manifest: {},
  registry: {},
  error: null
};

const errMessage = (err: unknown): string =>
  err instanceof Error ? err.message : String(err);

/** Run compile → SSG over `source`, folding the outcome into the prior result `prev`. */
export function runPipeline(
  source: string,
  prev: PipelineResult
): PipelineResult {
  let code: string;
  let full: string;
  try {
    code = compileNotaRaw(source);
    full = compileNota(source);
  } catch (err) {
    // Parse/emit error — expected while typing, so surface it in the UI but keep the console quiet.
    return { ...prev, error: errMessage(err) };
  }
  try {
    const { html, manifest, registry } = runSSG(full);
    return { code, full, html, manifest, registry, error: null };
  } catch (err) {
    // Runtime error executing the user's islands during SSG — log the full error so its stack trace
    // is visible in the JS console (the UI surfaces only the message). The compile succeeded, so the
    // Generated-JS pane still shows this run's `code`/`full`; the SSG/Rendered panes keep their
    // last-good output under the error.
    console.error("[nota] SSG runtime error:", err);
    return { ...prev, code, full, error: errMessage(err) };
  }
}
