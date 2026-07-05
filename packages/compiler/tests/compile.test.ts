/**
 * `@nota-lang/compiler` shim tests.
 *
 * Drives the real reader subprocess on the two shared integration fixtures and asserts the emit
 * surface the contract pins: the prepended `@nota-lang/runtime` import (the reader omits it),
 * `export default function Doc()`, the keyed `@for` Fragment (`Fragment({ key: _i }`), the `nota-ul-li`
 * list sentinel, and the named component constructors `inlineComponent(fn, "Colorized")` /
 * `blockComponent(fn, "Note")`. A malformed `.nota` → `compile` throws with the reader's
 * diagnostics.
 *
 * These tests exercise the *binary* (via `NOTA_COMPILE_BIN` or the package-relative default), so
 * they require the pre-built `oxc/target/release/examples/nota_compile`.
 */

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, test } from "vitest";
import { compile, RUNTIME_IMPORT } from "../src/lib";

const here = dirname(fileURLToPath(import.meta.url));
// tests/ → packages/compiler → packages → repo root → integration/
const integrationDir = join(here, "..", "..", "..", "integration");

const read = (name: string) => readFileSync(join(integrationDir, name), "utf8");

describe("compile (emit surface + prepended runtime import)", () => {
  test("golden.nota: prepends the runtime import; component + Doc + keyed @for + nota-ul-li", () => {
    const src = read("golden.nota");
    const { code } = compile(src, { sourcePath: "golden.nota" });

    // the reader omits the runtime import; the shim prepends EXACTLY this line.
    expect(code.startsWith(RUNTIME_IMPORT)).toBe(true);
    expect(code).toContain(
      'import { h, decode, Fragment, inlineComponent, blockComponent } from "@nota-lang/runtime";'
    );

    // document mode emits the default Doc.
    expect(code).toContain("export default function Doc()");

    // The component binding stays DOCUMENT-LOCAL (contract R15: an ordinary lexical statement
    // inside Doc — no hoist, no export; replay hydration recovers its closure) and carries its
    // binding name as the constructor's 2nd arg (the island's debug-manifest `comp`).
    expect(code).toMatch(/let Colorized = inlineComponent\(/);
    expect(code).not.toMatch(/export let Colorized/);
    expect(code).toContain('}, "Colorized");');

    // keyed @for — each iteration wraps in Fragment({ key: _i }, …).
    expect(code).toContain("Fragment({ key: _i }");
    // the `-` list marker lowers to the `nota-ul-li` sentinel (runtime struct coalesces to <ul><li>).
    expect(code).toContain('h("nota-ul-li", {}');
    // the component tag is invoked as a component (identifier, not string).
    expect(code).toContain("h(Colorized, {}");
    // Doc's body is decode()-wrapped.
    expect(code).toContain("return decode(Fragment(");
  });

  test("note.nota: blockComponent named, aside host, em nesting", () => {
    const src = read("note.nota");
    const { code } = compile(src, { sourcePath: "note.nota" });

    expect(code.startsWith(RUNTIME_IMPORT)).toBe(true);
    expect(code).toContain("export default function Doc()");
    // The binding name passed to blockComponent (drives the debug-manifest `comp` for the island).
    // note.nota's body is a single expression, so the name lands right after the closing paren of
    // the body (`…[children]), "Note");`) rather than after a `}` (cf. golden's multi-line body).
    // R15: document-local — no export.
    expect(code).toMatch(/let Note = blockComponent\(/);
    expect(code).not.toMatch(/export let Note/);
    expect(code).toContain(', "Note");');
    expect(code).toContain('h("aside", {}');
    expect(code).toContain('h("em", {}, ["world"])');
  });

  test("the prepended emit re-parses as a valid ES module (validity invariant)", () => {
    // A cheap global catch for codegen/prepend bugs: the result must be syntactically valid JS.
    // `new Function` won't accept import statements, so strip the import line and check the body
    // parses (the import itself is a fixed literal we control).
    const { code } = compile(read("note.nota"), { sourcePath: "note.nota" });
    const body = code.slice(RUNTIME_IMPORT.length);
    // Wrap in an async arrow so top-level `export`/`await` (document mode may emit async) don't choke
    // a bare Function parse: we only assert *the generated statements* tokenize.
    const withoutExports = body.replace(/^export\s+(default\s+)?/gm, "");
    expect(
      () => new Function(`return (async () => { ${withoutExports} })`)
    ).not.toThrow();
  });

  test("map is currently undefined (CLI emits no sourcemap yet)", () => {
    const { map } = compile(read("note.nota"));
    expect(map).toBeUndefined();
  });
});

describe("compile (diagnostics — non-zero exit throws with stderr)", () => {
  test("a malformed .nota throws an Error carrying the reader's diagnostics", () => {
    let thrown: unknown;
    try {
      // Unterminated element body — the reader reports `Expected `}``.
      compile("@p{unterminated", { sourcePath: "bad.nota" });
    } catch (e) {
      thrown = e;
    }
    expect(thrown).toBeInstanceOf(Error);
    const err = thrown as Error & { diagnostics?: string };
    // The message names the source and carries the reader's diagnostic text.
    expect(err.message).toContain("failed to compile");
    expect(err.message).toContain("bad.nota");
    expect(err.message.toLowerCase()).toContain("expected");
    // Raw diagnostics preserved for programmatic consumers (e.g. a Vite overlay).
    expect(typeof err.diagnostics).toBe("string");
    expect((err.diagnostics ?? "").length).toBeGreaterThan(0);
  });
});
