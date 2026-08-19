/** Convert recovered reader errors into source-level LSP diagnostics. */

import { analyze, type NotaError } from "@nota-lang/compiler";
import {
  type Diagnostic,
  DiagnosticSeverity,
  type LanguageServicePlugin
} from "@volar/language-server";
import { makeByteConverter } from "./byte-offsets.js";

export const NOTA_DIAGNOSTIC_SOURCE = "nota";

/** Compile `source` and map its byte-spanned errors to UTF-16 LSP ranges. */
export function notaSyntaxDiagnostics(source: string): Diagnostic[] {
  let errors: NotaError[];
  try {
    ({ errors } = analyze(source));
  } catch {
    return [];
  }
  if (errors.length === 0) {
    return [];
  }
  const { toPosition } = makeByteConverter(source);
  return errors.map(e => ({
    range: {
      start: toPosition(e.start),
      end: toPosition(e.start + e.len)
    },
    severity: DiagnosticSeverity.Error,
    source: NOTA_DIAGNOSTIC_SOURCE,
    message: e.message
  }));
}

/** Capability-only plugin; diagnostics are merged in `server-core.ts`. */
export const notaDiagnosticsServicePlugin: LanguageServicePlugin = {
  name: "nota-syntax-diagnostics",
  capabilities: {
    diagnosticProvider: {
      interFileDependencies: false,
      workspaceDiagnostics: false
    }
  },
  create: () => ({})
};
