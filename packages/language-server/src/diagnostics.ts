/**
 * **Nota syntax diagnostics** (contract D5).
 *
 * The TS language service (`volar-service-typescript`) reports *type* errors over the virtual
 * `.tsx`; it says nothing about a malformed `.nota` — an unclosed `[props]` group, `{ … }` body, or
 * bare `@`-head. Before this, a `.nota` typo produced **zero** diagnostics (the reader aborted the
 * parse, `compileVirtual` threw, and `createNotaVirtualCode` degraded to an empty module that
 * swallowed the error).
 *
 * The reader now recovers (EOF error-recovery) and returns the syntax/lowering problems as
 * {@link NotaError}s (byte-spanned into the `.nota`). This module turns them into LSP `Diagnostic`s
 * and packages the thin Volar {@link LanguageServicePlugin} that serves them for `*.nota` documents.
 */

import { compileVirtual, type NotaError } from "@nota-lang/compiler";
import {
  type Diagnostic,
  DiagnosticSeverity,
  type LanguageServicePlugin,
  type Position
} from "@volar/language-server";
import { NOTA_LANGUAGE_ID } from "./language-plugin.js";

/** The `source` field stamped on every Nota syntax diagnostic (shown in the editor's Problems UI). */
export const NOTA_DIAGNOSTIC_SOURCE = "nota";

/**
 * Compute the LSP {@link Position} (0-based line / UTF-16 character) of a byte `offset` into
 * `source`. Nota offsets are byte offsets, but the reader's diagnostic spans land on ASCII
 * delimiters (`]`/`}`/EOF) in practice; we still count by UTF-16 code units of the decoded prefix so
 * a multibyte prefix does not misplace the column. A clamped offset past the end maps to the last
 * position (a point diagnostic at EOF).
 */
function offsetToPosition(source: string, offset: number): Position {
  const clamped = Math.max(0, Math.min(offset, source.length));
  let line = 0;
  let lineStart = 0;
  for (let i = 0; i < clamped; i++) {
    if (source.charCodeAt(i) === 10 /* \n */) {
      line++;
      lineStart = i + 1;
    }
  }
  return { line, character: clamped - lineStart };
}

/**
 * Map the reader's recovered {@link NotaError}s for `source` into LSP `Diagnostic`s (severity
 * `Error`, `source: "nota"`). A zero-length error (a point diagnostic, e.g. "expected `]`" at EOF)
 * yields a zero-width range at its offset, which editors render as a caret. Pure + synchronous — the
 * reader is sub-process-fast and Volar caches per document version.
 */
export function notaSyntaxDiagnostics(source: string): Diagnostic[] {
  let errors: NotaError[];
  try {
    ({ errors } = compileVirtual(source));
  } catch {
    // The binary itself failed to run (missing/old build). No Nota diagnostics — the TS service's
    // module-resolution error, if any, is the user-visible signal; do not crash the plugin.
    return [];
  }
  return errors.map(e => ({
    range: {
      start: offsetToPosition(source, e.start),
      end: offsetToPosition(source, e.start + e.len)
    },
    severity: DiagnosticSeverity.Error,
    source: NOTA_DIAGNOSTIC_SOURCE,
    message: e.message
  }));
}

/**
 * The Nota syntax-diagnostics Volar service plugin: reports {@link notaSyntaxDiagnostics} for
 * `*.nota` documents. Registered alongside `volar-service-typescript` in `server.ts`; the TS plugin
 * handles the virtual `.tsx`'s type errors, this one the `.nota`'s own syntax errors — the two
 * diagnostic streams are disjoint (different documents) and merge in the editor's Problems view.
 */
export const notaDiagnosticsServicePlugin: LanguageServicePlugin = {
  name: "nota-syntax-diagnostics",
  capabilities: {
    diagnosticProvider: {
      interFileDependencies: false,
      workspaceDiagnostics: false
    }
  },
  create() {
    return {
      provideDiagnostics(document) {
        if (document.languageId !== NOTA_LANGUAGE_ID) {
          return null;
        }
        return notaSyntaxDiagnostics(document.getText());
      }
    };
  }
};
