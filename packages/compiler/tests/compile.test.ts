/**
 * `@nota-lang/compiler` shim tests.
 *
 * Drives the real reader — the default in-process **wasm backend** (`pkg-node`) — on the two shared
 * integration fixtures and asserts the pinned
 * emit surface (design/notation.md §Emit reference): the prepended `@nota-lang/runtime` import (the
 * reader omits it),
 * `export default function Doc()`, the keyed `@for` Fragment (`Fragment({ key: _i }`), the `nota-ul-li`
 * list sentinel, and the named component constructors `inlineComponent(fn, "Colorized")` /
 * `blockComponent(fn, "Note")`. A malformed `.nota` → `compile` throws with the reader's
 * diagnostics.
 *
 * A final suite exercises the **subprocess escape hatch** (`NOTA_COMPILE_BIN`) and pins backend
 * parity — the binary and the wasm build must emit byte-identical modules. It self-skips when the
 * pre-built `oxc/target/release/examples/nota_compile` is absent.
 */

import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { compile, RUNTIME_IMPORT } from "../src/lib";

const here = dirname(fileURLToPath(import.meta.url));
// tests/ → packages/compiler → packages → repo root → integration/
const integrationDir = join(here, "..", "..", "..", "integration");

const read = (name: string) => readFileSync(join(integrationDir, name), "utf8");

// Pin the default (wasm) backend for this file regardless of the developer's shell: stash any
// ambient NOTA_COMPILE_BIN and restore it after. The subprocess suite below sets it explicitly.
const ambientBin = process.env.NOTA_COMPILE_BIN;
beforeAll(() => {
  delete process.env.NOTA_COMPILE_BIN;
});
afterAll(() => {
  if (ambientBin !== undefined) {
    process.env.NOTA_COMPILE_BIN = ambientBin;
  }
});

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

    // The component binding stays DOCUMENT-LOCAL (an ordinary lexical statement inside Doc — no
    // hoist, no export; replay hydration recovers its closure, design/decode.md §Replay
    // hydration) and carries its
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
    // Document-local — no export (replay hydration recovers the closure).
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

describe("compile (diagnostics — a reader error throws)", () => {
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

// ===================================================================================================
// Subprocess escape hatch (NOTA_COMPILE_BIN) — backend parity. Self-skips without the binary.
// ===================================================================================================

const repoBinary = join(
  here,
  "..",
  "..",
  "..",
  "oxc",
  "target",
  "release",
  "examples",
  "nota_compile"
);
const binary = ambientBin && ambientBin.length > 0 ? ambientBin : repoBinary;
const binarySuite = existsSync(binary) ? describe : describe.skip;

/** Run `fn` with the subprocess backend forced, restoring the pinned-off env after. */
function withBinary<T>(fn: () => T): T {
  process.env.NOTA_COMPILE_BIN = binary;
  try {
    return fn();
  } finally {
    delete process.env.NOTA_COMPILE_BIN;
  }
}

binarySuite("compile (subprocess escape hatch — NOTA_COMPILE_BIN)", () => {
  test("the binary emits byte-identical output to the wasm backend", () => {
    for (const fixture of ["golden.nota", "note.nota"]) {
      const src = read(fixture);
      const viaWasm = compile(src, { sourcePath: fixture }).code;
      const viaBinary = withBinary(
        () => compile(src, { sourcePath: fixture }).code
      );
      expect(viaBinary).toBe(viaWasm);
    }
  });

  test("a malformed .nota throws with diagnostics through the subprocess too", () => {
    let thrown: unknown;
    try {
      withBinary(() => compile("@p{unterminated", { sourcePath: "bad.nota" }));
    } catch (e) {
      thrown = e;
    }
    expect(thrown).toBeInstanceOf(Error);
    const err = thrown as Error & { diagnostics?: string };
    expect(err.message).toContain("failed to compile");
    expect(err.message).toContain("bad.nota");
    expect((err.diagnostics ?? "").length).toBeGreaterThan(0);
  });
});
