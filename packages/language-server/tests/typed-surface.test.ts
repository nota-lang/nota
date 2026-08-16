/**
 * **Typed emit surface, resolution-independent** (design/solid.md — the Solid JSX emit).
 *
 * The headline guarantee: a `.nota` in a directory with **no** `node_modules/@nota-lang` still
 * types — the virtual `.tsx` is Solid JSX whose free identifiers (structural components, prelude
 * slots, solid-js surface) and global `JSX` namespace resolve through the module-local ambient
 * declarations the preamble inlines, not through disk. So this harness roots the TS language
 * service in a scratch directory that resolves nothing on disk (empty `types`, no local
 * `node_modules`), and only the default lib is read from the filesystem — the emit-surface types
 * can come *only* from the preamble.
 *
 * On that harness we assert, through the real virtual-`.tsx` pipeline:
 * - **hover** on an ambient (`createSignal`) shows its real signature (was `any`: "no inferred type");
 * - a **wrong attribute value on a known host tag** (`@a[href: 123]` → `<a href={123}>`) is a TS
 *   error (the preamble's `JSX.IntrinsicElements` attribute map);
 * - an **unknown tag** (`@custom-el[foo: 1]`) is legal (the open string-index fallback);
 * - a **prelude slot's real prop type** flows (`@Heading` sugar's `rank` is a number) through its
 *   ambient component declaration at the JSX element.
 */

import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { SourceMap } from "@volar/language-core";
import ts from "typescript";
import { describe, expect, test } from "vitest";
import { buildVirtual } from "../src/language-plugin";

/**
 * A TS language service over the virtual `.tsx` for a `.nota`, rooted in a scratch directory with no
 * resolvable `@nota-lang/*` on disk — so the runtime types resolve *only* through the preamble's
 * ambient module. Mirrors `diagnostics.test.ts` but with a node_modules-free current directory.
 */
function noNodeModulesHarness(notaSource: string) {
  const dir = mkdtempSync(join(tmpdir(), "nota-typed-"));
  const virtualFileName = join(dir, "doc.nota.tsx");
  const { code, mappings } = buildVirtual(notaSource);
  const sourceMap = new SourceMap(mappings);

  const compilerOptions: ts.CompilerOptions = {
    target: ts.ScriptTarget.ES2022,
    module: ts.ModuleKind.ESNext,
    moduleResolution: ts.ModuleResolutionKind.Bundler,
    jsx: ts.JsxEmit.ReactJSX,
    strict: true,
    noEmit: true,
    skipLibCheck: true,
    types: [] // no ambient @types; the emit surface (structural/solid-js/prelude) must come from the preamble
  };

  const host: ts.LanguageServiceHost = {
    getCompilationSettings: () => compilerOptions,
    getScriptFileNames: () => [virtualFileName],
    getScriptVersion: () => "1",
    getScriptSnapshot: fileName =>
      fileName === virtualFileName
        ? ts.ScriptSnapshot.fromString(code)
        : ts.sys.fileExists(fileName)
          ? ts.ScriptSnapshot.fromString(ts.sys.readFile(fileName) ?? "")
          : undefined,
    getCurrentDirectory: () => dir,
    getDefaultLibFileName: opts => ts.getDefaultLibFilePath(opts),
    readFile: ts.sys.readFile,
    fileExists: ts.sys.fileExists,
    directoryExists: ts.sys.directoryExists,
    getDirectories: ts.sys.getDirectories,
    readDirectory: ts.sys.readDirectory,
    realpath: ts.sys.realpath
  };
  const ls = ts.createLanguageService(host);

  function gen(notaOffset: number): number | null {
    for (const [g] of sourceMap.toGeneratedLocation(notaOffset)) {
      return g;
    }
    return null;
  }
  function hoverAt(notaOffset: number): string | null {
    const g = gen(notaOffset);
    if (g === null) return null;
    const qi = ls.getQuickInfoAtPosition(virtualFileName, g);
    return qi ? ts.displayPartsToString(qi.displayParts) : null;
  }
  function diagnostics(): { message: string; notaStart: number | null }[] {
    return ls.getSemanticDiagnostics(virtualFileName).map(d => {
      const message = ts.flattenDiagnosticMessageText(d.messageText, "\n");
      let notaStart: number | null = null;
      if (d.start !== undefined) {
        for (const [s] of sourceMap.toSourceLocation(d.start)) {
          notaStart = s;
          break;
        }
      }
      return { message, notaStart };
    });
  }
  return { hoverAt, diagnostics };
}

describe("typed surface resolves with no node_modules (D3)", () => {
  test("the emit surface resolves (no 'Cannot find module' / 'Cannot find name' at all)", () => {
    // ALL "Cannot find" diagnostics, deliberately not a hardcoded name list — a closed list once
    // let a missing preamble declaration (`Attrs`) slip through unasserted.
    const h = noNodeModulesHarness("@p{hi}\n");
    const bad = h
      .diagnostics()
      .filter(d => /Cannot find module|Cannot find name/.test(d.message));
    expect(bad, JSON.stringify(h.diagnostics())).toEqual([]);
  });

  test("a flow-position attrs group resolves (`<Attrs …/>` is in the preamble)", () => {
    // `# T [id: "x"]` + a paragraph-trailing `[class: "note"]` emit `<Attrs class="note" />` in
    // the virtual `.tsx`; the preamble must declare `Attrs` or every such document diagnoses
    // "Cannot find name 'Attrs'".
    const h = noNodeModulesHarness(
      '# T [id: "x"]\n\npara text [class: "note"]\n'
    );
    const bad = h.diagnostics().filter(d => /Cannot find name/.test(d.message));
    expect(bad, JSON.stringify(h.diagnostics())).toEqual([]);
  });

  test("hover on an ambient (`createSignal`) shows its real signature (not `any`)", () => {
    const source = "%let s = createSignal(0)\n@p{hi}\n";
    const h = noNodeModulesHarness(source);
    const hover = h.hoverAt(source.indexOf("createSignal"));
    expect(
      hover,
      "no hover — the ambient declaration did not resolve"
    ).toBeTruthy();
    // The generic signature instantiates at the call site — a real type, not `any`.
    expect(hover).toMatch(/createSignal/);
    expect(hover).toContain("value: number");
  });
});

describe("JSX IntrinsicElements typing through the .nota → .tsx pipeline", () => {
  test("a wrong attribute value on a known host tag is a TS type error", () => {
    // `@a[href: 123]` → `<a href={123}>`; the preamble's `JSX.IntrinsicElements` types `href` as
    // `string` on <a>, so the attribute value is rejected with a `string` mismatch. Completion on
    // the attribute region works the same way — that is the primary editor affordance for props.
    const source = "@a[href: 123]{link}\n";
    const h = noNodeModulesHarness(source);
    const typeErr = h
      .diagnostics()
      .find(d => /not assignable to type 'string'/.test(d.message));
    expect(typeErr, JSON.stringify(h.diagnostics())).toBeDefined();
  });

  test("an unknown / custom tag is legal (arbitrary-string fallback — no error)", () => {
    const source = '@custom-el[foo: "bar"]{x}\n';
    const h = noNodeModulesHarness(source);
    const bad = h
      .diagnostics()
      .filter(d => /not assignable|Cannot find/.test(d.message));
    expect(bad, JSON.stringify(h.diagnostics())).toEqual([]);
  });

  test("a prelude slot's real prop type flows: bad `rank` on `@Heading` errors", () => {
    // `@Heading` element form → `<Heading rank="x">`; the ambient `Heading` declaration types
    // `rank` as a number, so a string `rank` is an error — proving the slot's real prop type
    // reached the JSX element.
    const source = '@Heading[rank: "x"]{Title}\n';
    const h = noNodeModulesHarness(source);
    const typeErr = h
      .diagnostics()
      .find(d => /not assignable to type 'number'/.test(d.message));
    expect(typeErr, JSON.stringify(h.diagnostics())).toBeDefined();
  });
});
