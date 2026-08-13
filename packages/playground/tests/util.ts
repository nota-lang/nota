/**
 * Test helpers over the wasm reader, mirroring the pipeline's composition: `compileNota` is the
 * runtime-import-prepended `full` form (what `runSSG` / the iframe evaluate), `compileNotaRaw` the
 * bare emit (the Generated-JS pane), `parseNotaAst` the ESTree JSON string (the AST pane).
 */

import { RUNTIME_IMPORT } from "@nota-lang/compiler";
import { compile, parseAst } from "@nota-lang/wasm";

export const compileNotaRaw = (source: string): string => compile(source).code;

export const compileNota = (source: string): string =>
  RUNTIME_IMPORT + compileNotaRaw(source);

export const parseNotaAst = (source: string): string => parseAst(source).ast;
