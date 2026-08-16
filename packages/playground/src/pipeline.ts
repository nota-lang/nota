/**
 * The playground pipeline: fold a `.nota` source into a {@link PipelineResult}
 * (parse → emit → babel → eval), carrying the prior result so each pane shows the **freshest
 * valid artifact for its stage**.
 *
 * Outcomes, by which stage threw:
 *   - **parse/emit error** (`parseAst`/`compile`): nothing new is valid — keep the last-good
 *     result, surface the message quietly (fires on nearly every half-typed keystroke).
 *   - **babel/eval error**: the emit *succeeded*, so surface this run's JSX while keeping the
 *     last-good compiled/rendered artifacts under the error; log it (with stack).
 *   - **success**: every artifact fresh, no error.
 */

import { compile } from "@nota-lang/compiler";
import { parseAst } from "@nota-lang/compiler/reader";
import { compileAndEval, type DocFn } from "./solid-eval";

/** The result of running the pipeline over the current editor value. */
export interface PipelineResult {
  /** The post-parse Nota AST as ESTree JSON (with `start`/`end`), for the AST tree pane. */
  ast: string;
  /** The source that produced {@link ast} — kept paired so node offsets index the right text. */
  astSource: string;
  /** The emitted Solid JSX module (imports prepended), for the JSX pane. */
  jsx: string;
  /** The babel-compiled client module (what vite-plugin-solid would produce, generate "dom"). */
  compiled: string;
  /** The evaluated document component; `null` until a successful eval. */
  Doc: DocFn | null;
  /** Bumped on every successful eval so the preview re-renders even for a same-name Doc. */
  docVersion: number;
  /** A compile/eval error, if the pipeline threw. */
  error: string | null;
}

export const EMPTY: PipelineResult = {
  ast: "",
  astSource: "",
  jsx: "",
  compiled: "",
  Doc: null,
  docVersion: 0,
  error: null
};

const errMessage = (err: unknown): string =>
  err instanceof Error ? err.message : String(err);

/** Run parse → emit → babel → eval over `source`, folding into the prior result `prev`. */
export function runPipeline(
  source: string,
  prev: PipelineResult
): PipelineResult {
  let ast: string;
  let jsx: string;
  try {
    // `parseAst` shares the reader's parse with `compile`, so a parse error fails both here.
    ast = parseAst(source).ast;
    jsx = compile(source, { sourcePath: "doc.nota" }).code;
  } catch (err) {
    return { ...prev, error: errMessage(err) };
  }
  try {
    const { compiled, Doc } = compileAndEval(jsx);
    return {
      ast,
      astSource: source,
      jsx,
      compiled,
      Doc,
      docVersion: prev.docVersion + 1,
      error: null
    };
  } catch (err) {
    console.error("[nota] compile/eval error:", err);
    return { ...prev, ast, astSource: source, jsx, error: errMessage(err) };
  }
}
