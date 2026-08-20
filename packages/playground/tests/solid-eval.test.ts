/**
 * `solid-eval`'s import/export handling: {@link evalModule} runs a babel-compiled document
 * module through its own targeted `Babel.transform` pass ({@link importExportPlugin}, not
 * exported — exercised indirectly here) to resolve `import`s against {@link MODULE_MAP} and
 * collect/strip `export`s. AST-based, not the `gm`-anchored regex surgery it replaced: the regex
 * matched `import`/`export` at the start of *any line*, including lines inside a string or
 * template-literal *value* — corrupting a document whose own content happens to start a line
 * with one of those words. The first test below is exactly that shape.
 */

import { compile } from "@nota-lang/compiler";
import * as notaCore from "@nota-lang/core";
import * as solidJs from "solid-js";
import { render } from "solid-js/web";
import { describe, expect, it } from "vitest";
import {
  compileAndEval,
  evalModule,
  MODULE_MAP,
  resolveModule
} from "../src/solid-eval";

describe("evalModule", () => {
  it("a template literal whose content has lines starting `import`/`export` survives byte-for-byte", () => {
    // The dangerous shape: a *value*, not a module boundary — but `^import`/`^export` (the `m`
    // flag) can't tell the difference from inside a plain string.replace.
    const evil =
      'before\nimport fake from "nowhere";\nexport const x = 1;\nafter';
    const compiled = [
      'import { NotaDoc } from "@nota-lang/core";',
      "export default function Doc() {",
      `  const evil = \`${evil}\`;`,
      "  return { content: evil, NotaDoc };",
      "}"
    ].join("\n");

    const mod = evalModule(compiled);
    const result = (mod.default as () => { content: string })();
    expect(result.content).toBe(evil);
  });

  it("named, namespace, and default imports resolve against MODULE_MAP", () => {
    const compiled = [
      'import { createSignal } from "solid-js";',
      'import * as core from "@nota-lang/core";',
      'import CoreDefault, { NotaDoc } from "@nota-lang/core";',
      "export default function Doc() {",
      "  return { createSignal, core, CoreDefault, NotaDoc };",
      "}"
    ].join("\n");

    const mod = evalModule(compiled);
    const result = (mod.default as () => Record<string, unknown>)();
    // Referential equality: MODULE_MAP wraps the SAME module instances this test file imports.
    expect(result.createSignal).toBe(solidJs.createSignal);
    expect(result.core).toBe(notaCore);
    expect(result.NotaDoc).toBe(notaCore.NotaDoc);
    // @nota-lang/core has no default export — resolving to `mod.default` (undefined) rather than
    // throwing proves the specifier was handled, not silently ignored.
    expect(result.CoreDefault).toBeUndefined();
  });

  it("a bare side-effect import of a known module is a no-op (no binding, no throw)", () => {
    const compiled = [
      'import "solid-js";',
      "export default function Doc() { return 1; }"
    ].join("\n");
    expect(() => evalModule(compiled)).not.toThrow();
  });

  it("default and named exports are visible on the returned record, as before", () => {
    const compiled = [
      "export const helper = 5;",
      "export function util() { return helper + 1; }",
      "export default function Doc() { return util(); }"
    ].join("\n");

    const mod = evalModule(compiled);
    expect(mod.helper).toBe(5);
    expect(typeof mod.util).toBe("function");
    expect(typeof mod.default).toBe("function");
    expect((mod.default as () => number)()).toBe(6);
  });

  it("an export list (`export { a, b };`) is dropped, matching the prior behavior", () => {
    // The pre-AST regex stripped this shape whole without ever capturing the names; the plugin
    // deliberately keeps that (surprising but pre-existing) shape rather than newly exposing it.
    const compiled = [
      "const a = 1;",
      "export { a };",
      "export default function Doc() { return a; }"
    ].join("\n");
    const mod = evalModule(compiled);
    expect(mod.a).toBeUndefined();
    expect((mod.default as () => number)()).toBe(1);
  });

  it("an import outside MODULE_MAP throws a pointed, actionable error", () => {
    const compiled = [
      'import { x } from "left-pad";',
      "export default function Doc() { return x; }"
    ].join("\n");
    expect(() => evalModule(compiled)).toThrow(
      /can only resolve imports of.*"left-pad" is not available here/s
    );
  });
});

describe("MODULE_MAP", () => {
  it("still lists the same four framework modules", () => {
    // Plus one entry per grammar the playground carries for fenced code — those are keyed
    // `@shikijs/langs/<tag>` and covered by the grammar cases below.
    expect(
      Object.keys(MODULE_MAP).filter(k => !k.startsWith("@shikijs/langs/"))
    ).toEqual([
      "solid-js",
      "solid-js/web",
      "@nota-lang/core",
      "@nota-lang/prelude"
    ]);
  });

  it("carries a grammar for a fenced tag, and tolerates one it does not", () => {
    // A fence tag compiles to `import … from "@shikijs/langs/<tag>"`. An uncarried tag must
    // degrade to an empty registration rather than fail the whole document.
    expect(resolveModule("@shikijs/langs/rust")?.default).toBeTruthy();
    expect(resolveModule("@shikijs/langs/wibble")).toEqual({ default: [] });
    expect(resolveModule("left-pad")).toBeUndefined();
  });

  it("evaluates a fenced document end to end, grammar and all", () => {
    // The whole path: the compiler emits the grammar import for ```rust, the evaluator resolves
    // it out of MODULE_MAP, and the prelude highlights against the registration.
    const { code: jsx } = compile("```rust\nfn main() {}\n```\n", {
      sourcePath: "doc.nota"
    });
    expect(jsx).toContain('import __notaLang_rust from "@shikijs/langs/rust"');
    const { Doc } = compileAndEval(jsx);
    const host = document.createElement("div");
    const dispose = render(() => Doc({}), host);
    expect(host.querySelector("pre.shiki")).toBeTruthy();
    dispose();
  });
});

describe("compileAndEval", () => {
  it("a document's own %-code template literal survives compile → babel → eval byte-for-byte", () => {
    // No `"` in the content: Reforest's smart-quotes pass (core/src/smart.ts) curls straight
    // quotes in *any* rendered text, an orthogonal, deliberate transform this test isn't about —
    // the property under test is purely "a line starts with import/export inside a value".
    const evil = "before\nimport fake from nowhere\nexport const x = 1\nafter";
    const src = `%let evil = \`${evil}\`\n@p{@(evil)}\n`;
    const { code: jsx } = compile(src, { sourcePath: "doc.nota" });

    const { Doc } = compileAndEval(jsx);
    const host = document.createElement("div");
    document.body.appendChild(host);
    const dispose = render(() => Doc() as never, host);

    expect(host.querySelector("p")?.textContent).toBe(evil);

    dispose();
    host.remove();
  });
});
