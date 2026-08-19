/** Run the playground's parse → emit → Babel → evaluation pipeline. */

import { analyze, bindImports } from "@nota-lang/compiler";
import { compileAndEval, type DocFn } from "./solid-eval";

export interface PipelineResult {
  ast: string;
  astSource: string;
  jsx: string;
  compiled: string;
  Doc: DocFn | null;
  docVersion: number;
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

export function runPipeline(
  source: string,
  prev: PipelineResult
): PipelineResult {
  let ast: string;
  let jsx: string;
  try {
    const result = analyze(source);
    if (result.errors.length > 0) {
      throw new Error(result.errors.map(error => error.message).join("\n"));
    }
    ast = result.ast;
    jsx = bindImports(result.code, result.freeNames);
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
