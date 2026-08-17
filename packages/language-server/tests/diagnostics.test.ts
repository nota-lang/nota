/**
 * **Diagnostics.** Drives the TS language service directly over the virtual `.tsx` + the (shifted)
 * `CodeMapping`s and maps each diagnostic back to its **`.nota`** range through Volar's own
 * `SourceMap` (`@volar/source-map`, re-exported by `@volar/language-core`). This drives the language
 * service directly over the virtual code + mappings, via the same shared
 * `createLanguageServiceHost` `feature-harness.ts` builds — it exercises the exact production path
 * (`buildVirtual` → TS diagnostics → mapped to `.nota`) using the production mapper, without the
 * heavier Volar program/connection plumbing.
 *
 * Headline case: `@Unknown{}` lowers to JSX (`<Unknown />`), so TS reports
 * "Cannot find name 'Unknown'" — landing on the `.nota` `@Unknown` range after mapping back. A
 * positive control (a declared component) asserts no such error, so the diagnostic is real scope
 * analysis, not a blanket "everything is undefined".
 *
 * Why a `.nota.tsx` filename for the in-memory virtual file: TS's language-service program filters
 * root files by known extension, so the virtual script is presented under a real `.tsx` name (its
 * *content* is `buildVirtual(...).code`). Mapping back to `.nota` uses our `CodeMapping`s, whose
 * `generatedOffsets` index exactly this content — so the round-trip is faithful to production.
 */

import { resolve } from "node:path";
import { SourceMap } from "@volar/language-core";
import ts from "typescript";
import { beforeEach, describe, expect, test } from "vitest";
import { buildVirtual } from "../src/language-plugin";
import { createLanguageServiceHost, PKG_ROOT } from "./feature-harness";

/**
 * A virtual `.tsx` driven by a real TS language service, one fresh `ts.LanguageService` per
 * `notaDiagnostics` call (the reader is fast; each test in this file calls it exactly once, so
 * there is no benefit to the incremental-update machinery a single mutable instance would need).
 */
function createHarness() {
  // A real `.tsx` extension so TS includes it in the program; the basename keeps the `.nota` origin
  // visible.
  const virtualFileName = resolve(PKG_ROOT, "__fixture__.nota.tsx");

  /**
   * Semantic diagnostics over the virtual `.tsx`, each mapped back to its `.nota` offset (the first
   * source offset the diagnostic's generated start maps to, or `null` if it falls in unmapped
   * preamble/boilerplate).
   */
  function notaDiagnostics(notaSource: string): {
    message: string;
    notaStart: number | null;
  }[] {
    const { code, mappings } = buildVirtual(notaSource);
    const sourceMap = new SourceMap<{ verification?: unknown }>(mappings);
    const host = createLanguageServiceHost(
      virtualFileName,
      PKG_ROOT,
      () => code
    );
    const ls = ts.createLanguageService(host);
    const diags = ls.getSemanticDiagnostics(virtualFileName);
    return diags.map(d => {
      const message = ts.flattenDiagnosticMessageText(d.messageText, "\n");
      let notaStart: number | null = null;
      if (d.start !== undefined) {
        for (const [sourceOffset] of sourceMap.toSourceLocation(d.start)) {
          notaStart = sourceOffset;
          break;
        }
      }
      return { message, notaStart };
    });
  }

  return { notaDiagnostics };
}

describe("createLanguageServiceHost (shared across this file and typed-surface.test.ts)", () => {
  test("jsx mode matches the shipped server config, not a per-suite guess", () => {
    // Regression pin for the fix: this file and typed-surface.test.ts each used to hard-code their
    // OWN `ts.JsxEmit.ReactJSX`, silently diverged from what actually ships (`browser.ts`'s
    // `TSCONFIG` sets `jsx: "preserve"`) — a virtual `.tsx` that type-checks under a different JSX
    // mode than production is not a faithful harness.
    const host = createLanguageServiceHost(
      resolve(PKG_ROOT, "__jsx-mode-check__.nota.tsx"),
      PKG_ROOT,
      () => ""
    );
    expect(host.getCompilationSettings().jsx).toBe(ts.JsxEmit.Preserve);
  });
});

describe("diagnostics (TS over the virtual .tsx, mapped back to .nota)", () => {
  let harness: ReturnType<typeof createHarness>;

  beforeEach(() => {
    harness = createHarness();
  });

  test("sanity: the ambient surface resolves (no module/exported-member/undefined-name errors)", () => {
    // If the preamble's ambient declarations were broken, the structural refs (`NotaDoc`, …) would
    // all error. ALL "Cannot find name" diagnostics, deliberately not a hardcoded name list (the
    // emit's free identifiers are Solid JSX components now, not `h`/`decode`/`Fragment` — a closed
    // list tracking specific names silently stops catching anything once the emit moves on; see
    // `typed-surface.test.ts`'s identical "not a hardcoded name list" reasoning).
    const diags = harness.notaDiagnostics("@p{hello}\n");
    const moduleErrors = diags.filter(d =>
      /Cannot find module|has no exported member|Cannot find name/.test(
        d.message
      )
    );
    expect(moduleErrors, JSON.stringify(diags)).toEqual([]);
  });

  test("@Unknown{} → \"Cannot find name 'Unknown'\" mapped to the .nota @Unknown range", () => {
    const source = "@Unknown{}\n";
    const diags = harness.notaDiagnostics(source);

    const cannotFind = diags.find(d =>
      /Cannot find name 'Unknown'/.test(d.message)
    );
    expect(cannotFind, JSON.stringify(diags)).toBeDefined();

    // Mapped back, the diagnostic lands on the `.nota` `Unknown` token (the component identifier).
    const idx = source.indexOf("Unknown");
    expect(cannotFind!.notaStart).toBe(idx);
  });

  test("positive control: a declared component does NOT raise Cannot-find-name", () => {
    const source =
      "% const Aside = (props: { children?: unknown }) => props.children;\n@Aside{hi}\n";
    const diags = harness.notaDiagnostics(source);
    const asideError = diags.find(d =>
      /Cannot find name 'Aside'/.test(d.message)
    );
    expect(asideError, JSON.stringify(diags)).toBeUndefined();
  });

  test("a TS scope error in a % block is reported at its .nota range", () => {
    // `count()` is an undefined free identifier in the `%` block → "Cannot find name 'count'".
    const source = "% const n: number = count()\n@p{@(n)}\n";
    const diags = harness.notaDiagnostics(source);
    const countError = diags.find(d =>
      /Cannot find name 'count'/.test(d.message)
    );
    expect(countError, JSON.stringify(diags)).toBeDefined();
    // Mapped back into the `%` block, onto the `count` identifier.
    expect(countError!.notaStart).toBe(source.indexOf("count"));
  });
});
