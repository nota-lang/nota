/**
 * **Diagnostics** — implementation.md §5.8 layer 2. Drives the TS language service directly over the
 * virtual `.tsx` + the (shifted) `CodeMapping`s and maps each diagnostic back to its **`.nota`**
 * range through Volar's own `SourceMap` (`@volar/source-map`, re-exported by `@volar/language-core`).
 * This is the §5.8-sanctioned "drive the language service directly over the virtual code + mappings"
 * path — it exercises the exact Phase-V spine (`buildVirtual` → TS diagnostics → mapped to `.nota`)
 * using the production mapper, without the heavier Volar program/connection plumbing.
 *
 * Headline case (§5.2): `@Unknown{}` lowers to `h(Unknown, {}, [])`, so TS reports
 * "Cannot find name 'Unknown'" — landing on the `.nota` `@Unknown` range after mapping back. A
 * positive control (a declared component) asserts no such error, so the diagnostic is real scope
 * analysis, not a blanket "everything is undefined".
 *
 * Why a `.nota.tsx` filename for the in-memory virtual file: TS's language-service program filters
 * root files by known extension, so the virtual script is presented under a real `.tsx` name (its
 * *content* is `buildVirtual(...).code`). Mapping back to `.nota` uses our `CodeMapping`s, whose
 * `generatedOffsets` index exactly this content — so the round-trip is faithful to production.
 */

import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { SourceMap } from "@volar/language-core";
import ts from "typescript";
import { beforeEach, describe, expect, test } from "vitest";
import { buildVirtual } from "../src/language-plugin";

// `import.meta.dirname` is `<pkg>/tests`; the package root is where `node_modules` (runtime `.d.ts`,
// lib.d.ts) resolves so the virtual `.tsx`'s `@nota-lang/runtime` import type-checks.
const PKG_ROOT = resolve(import.meta.dirname, "..");

/**
 * One mutable virtual `.tsx` driven by a real TS language service. `setSource(notaSource)` compiles
 * the `.nota` via `buildVirtual` and installs the result as the virtual file's content + mappings.
 */
function createHarness() {
  // A real `.tsx` extension so TS includes it in the program; the basename keeps the `.nota` origin
  // visible. Resolved under the package root so module resolution finds the workspace runtime types.
  const virtualFileName = resolve(PKG_ROOT, "__fixture__.nota.tsx");

  let virtualCode = "";
  let sourceMap = new SourceMap<{ verification?: unknown }>([]);
  let version = 0;

  const compilerOptions: ts.CompilerOptions = {
    target: ts.ScriptTarget.ES2022,
    module: ts.ModuleKind.ESNext,
    moduleResolution: ts.ModuleResolutionKind.Bundler,
    jsx: ts.JsxEmit.ReactJSX,
    strict: true,
    noEmit: true,
    skipLibCheck: true,
    types: []
  };

  const host: ts.LanguageServiceHost = {
    getCompilationSettings: () => compilerOptions,
    getScriptFileNames: () => [virtualFileName],
    getScriptVersion: fileName =>
      fileName === virtualFileName ? String(version) : "0",
    getScriptSnapshot: fileName => {
      if (fileName === virtualFileName) {
        return ts.ScriptSnapshot.fromString(virtualCode);
      }
      if (existsSync(fileName)) {
        return ts.ScriptSnapshot.fromString(readFileSync(fileName, "utf8"));
      }
      return undefined;
    },
    getCurrentDirectory: () => PKG_ROOT,
    getDefaultLibFileName: opts => ts.getDefaultLibFilePath(opts),
    readFile: ts.sys.readFile,
    fileExists: ts.sys.fileExists,
    directoryExists: ts.sys.directoryExists,
    getDirectories: ts.sys.getDirectories,
    readDirectory: ts.sys.readDirectory,
    realpath: ts.sys.realpath
  };

  const ls = ts.createLanguageService(host);

  function setSource(notaSource: string): void {
    const { code, mappings } = buildVirtual(notaSource);
    virtualCode = code;
    sourceMap = new SourceMap(mappings);
    version++;
  }

  /**
   * Semantic diagnostics over the virtual `.tsx`, each mapped back to its `.nota` offset (the first
   * source offset the diagnostic's generated start maps to, or `null` if it falls in unmapped
   * preamble/boilerplate).
   */
  function notaDiagnostics(notaSource: string): {
    message: string;
    notaStart: number | null;
  }[] {
    setSource(notaSource);
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

describe("diagnostics (TS over the virtual .tsx, mapped back to .nota)", () => {
  let harness: ReturnType<typeof createHarness>;

  beforeEach(() => {
    harness = createHarness();
  });

  test("sanity: the runtime types resolve (no module/exported-member errors)", () => {
    // If the runtime `.d.ts` didn't resolve, `h`/`decode`/`Fragment` refs would all error.
    const diags = harness.notaDiagnostics("@p{hello}\n");
    const moduleErrors = diags.filter(d =>
      /Cannot find module|has no exported member|Cannot find name 'h'|Cannot find name 'decode'|Cannot find name 'Fragment'/.test(
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
      '% const Aside = inlineComponent((children) => h("aside", {}, children));\n@Aside{hi}\n';
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
