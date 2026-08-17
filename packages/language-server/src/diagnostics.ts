/**
 * **Nota syntax diagnostics.**
 *
 * The TS language service (`volar-service-typescript`) reports *type* errors over the virtual
 * `.tsx`; it says nothing about a malformed `.nota` — an unclosed `[props]` group, `{ … }` body, or
 * bare `@`-head. Before this, a `.nota` typo produced **zero** diagnostics (the reader aborted the
 * parse, `compileVirtual` threw, and `createNotaVirtualCode` degraded to an empty module that
 * swallowed the error).
 *
 * The reader now recovers (EOF error-recovery) and returns the syntax/lowering problems as
 * {@link NotaError}s (byte-spanned into the `.nota`). This module turns them into LSP `Diagnostic`s
 * via {@link notaSyntaxDiagnostics} — the live function `server-core.ts` calls at its
 * `sendDiagnostics` choke point — and also exports the thin Volar {@link LanguageServicePlugin} that
 * exists solely to advertise the `diagnosticProvider` capability (see its own doc for why its
 * `create()` never actually serves anything).
 */

import { compileVirtual, type NotaError } from "@nota-lang/compiler";
import {
  type Diagnostic,
  DiagnosticSeverity,
  type LanguageServicePlugin
} from "@volar/language-server";
import { makeByteConverter } from "./byte-offsets.js";

/** The `source` field stamped on every Nota syntax diagnostic (shown in the editor's Problems UI). */
export const NOTA_DIAGNOSTIC_SOURCE = "nota";

/**
 * Map the reader's recovered {@link NotaError}s for `source` into LSP `Diagnostic`s (severity
 * `Error`, `source: "nota"`). `NotaError.start`/`len` are UTF-8 **byte** offsets/lengths (the
 * reader's native unit) — routed through the package-shared {@link makeByteConverter}
 * (`./byte-offsets.ts`; also used at the Volar mapping boundary and by semantic tokens) to LSP's
 * UTF-16 `(line, character)` positions, so a multibyte prefix (an em-dash, an accented word) before
 * an error no longer misplaces its column. A zero-length error (a point diagnostic, e.g. "expected
 * `]`" at EOF) yields a zero-width range at its offset, which editors render as a caret. Pure +
 * synchronous — the reader is sub-process-fast and Volar caches per document version.
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

/**
 * The Nota syntax-diagnostics Volar service plugin. Registered (alongside `volar-service-typescript`)
 * in the plugin list passed to `server.initialize` (`server-core.ts`) purely so its
 * `diagnosticProvider` capability merges into the server's advertised capabilities; its `create()` is
 * a no-op because Volar's `languageFeatureWorker` never offers a service plugin the `.nota` source doc
 * (only the generated virtual `.tsx`, which this plugin has nothing to say about), so a
 * `provideDiagnostics` here would never run. The live Nota syntax diagnostics are pushed by
 * {@link notaSyntaxDiagnostics} through `interceptDiagnostics` in `server-core.ts`, which merges them
 * onto Volar's TS diagnostics at the `connection.sendDiagnostics` choke point — the two diagnostic
 * streams (TS over the virtual, Nota syntax over the source) are disjoint and merge there for the
 * editor's Problems view.
 */
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
