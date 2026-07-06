/**
 * **Nota syntax diagnostics + EOF recovery in the language server.**
 *
 * Two guarantees, both regressions of the pre-recovery behaviour (a `.nota` typo produced ZERO
 * diagnostics and an empty virtual module):
 *
 * 1. `buildVirtual` on an unterminated `.nota` still yields a non-empty virtual `.tsx` + mappings
 *    (incl. the `@tag[|` prop-completion anchor) — so TS features keep working over the parsed
 *    prefix instead of blanking out.
 * 2. `notaSyntaxDiagnostics` turns the reader's recovered errors into LSP diagnostics at the right
 *    `.nota` range — the source-level channel `volar-service-typescript` (which only sees the
 *    virtual `.tsx`) cannot provide.
 */

import { DiagnosticSeverity } from "@volar/language-server";
import { describe, expect, test } from "vitest";
import {
  NOTA_DIAGNOSTIC_SOURCE,
  notaSyntaxDiagnostics
} from "../src/diagnostics";
import { buildVirtual } from "../src/language-plugin";

describe("EOF recovery → non-empty virtual", () => {
  test("`@a[` still emits the props object literal + a completion anchor mapping", () => {
    const { code, mappings } = buildVirtual("@a[");
    // The recovered virtual contains the props object literal (not the empty-module fallback).
    expect(code).toContain('h("a", {');
    // The prop-completion anchor: a zero-width `completion` mapping at `.nota` offset 3.
    const anchor = mappings.find(
      m => m.sourceOffsets[0] === 3 && m.lengths[0] === 0
    );
    expect(
      anchor,
      JSON.stringify(mappings.map(m => m.sourceOffsets))
    ).toBeDefined();
    expect(anchor?.data.completion).toBeTruthy();
  });

  test("a well-formed `.nota` builds with no recovered errors", () => {
    const { errors } = buildVirtual("@p{hi}\n");
    expect(errors).toEqual([]);
  });
});

describe("notaSyntaxDiagnostics", () => {
  test("no diagnostics for a well-formed document", () => {
    expect(notaSyntaxDiagnostics("@p{hi}\n")).toEqual([]);
  });

  test("`@a[` → an 'expected `]`' diagnostic at the EOF caret", () => {
    const diags = notaSyntaxDiagnostics("@a[");
    expect(diags.length).toBe(1);
    const d = diags[0];
    expect(d.message).toMatch(/]/);
    expect(d.severity).toBe(DiagnosticSeverity.Error);
    expect(d.source).toBe(NOTA_DIAGNOSTIC_SOURCE);
    // Byte offset 3 (just after `[`) → line 0, char 3; a point diagnostic (start == end).
    expect(d.range.start).toEqual({ line: 0, character: 3 });
    expect(d.range.end).toEqual({ line: 0, character: 3 });
  });

  test("an unterminated body reports the missing `}` on the right line", () => {
    // Two lines then an unterminated body: the diagnostic lands on line 2 at EOF.
    const src = "one\ntwo\n@p{unterminated";
    const diags = notaSyntaxDiagnostics(src);
    expect(diags.length).toBe(1);
    expect(diags[0].message).toMatch(/}/);
    // The EOF caret is at the end of line 2 (0-based line index 2).
    expect(diags[0].range.start.line).toBe(2);
  });

  test("a reserved-name collision (`%let h = …`) surfaces as a diagnostic", () => {
    const diags = notaSyntaxDiagnostics("%let h = 1\n@p{x}\n");
    expect(diags.length).toBeGreaterThanOrEqual(1);
  });
});
