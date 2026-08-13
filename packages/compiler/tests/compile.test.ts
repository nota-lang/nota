/**
 * `@nota-lang/compiler` shim tests.
 *
 * Drives the real reader — the in-process wasm backend (`@nota-lang/wasm-node`) — on the two shared
 * integration fixtures and asserts the pinned
 * emit surface (design/notation.md §Emit reference): the prepended `@nota-lang/runtime` import (the
 * reader omits it),
 * `export default function Doc()`, the keyed `@for` Fragment (`Fragment({ key: _i }`), the `nota-ul-li`
 * list sentinel, and the named component constructors `inlineComponent(fn, "Colorized")` /
 * `blockComponent(fn, "Note")`. A malformed `.nota` → `compile` throws with the reader's
 * diagnostics.
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

  test("map is currently undefined (the reader emits no sourcemap yet)", () => {
    const { map } = compile(read("note.nota"));
    expect(map).toBeUndefined();
  });
});

describe("compile (non-ASCII input — no wasm heap corruption)", () => {
  // Regression: a `.nota` containing a multibyte UTF-8 char (em-dash, U+2014) followed by enough
  // trailing content used to crash the wasm reader with a dlmalloc assertion
  // (`psize <= size + max_overhead`) surfacing as `unreachable`. Root cause: wasm-bindgen's
  // `passStringToWasm0` over-allocates the input buffer (realloc to a worst-case UTF-8 size) and the
  // reader frees it as a `Box<str>` at content length, a `dealloc` size mismatch that corrupts the
  // wasm heap. Fixed by nota_wasm's size-tracking `#[global_allocator]`. The crash was heap-layout
  // sensitive, so we compile repeatedly.
  const multibyte = [
    ["em-dash (3-byte)", "—"],
    ["e-acute (2-byte)", "é"],
    ["g-clef (4-byte)", "\u{1d11e}"]
  ] as const;

  for (const [name, ch] of multibyte) {
    test(`repeatedly compiles a doc with a ${name} + trailing content`, () => {
      const src = `# Heading\n\nA paragraph with a ${ch} char, followed by plenty of trailing text so the\nbuffer is over-allocated, then a second sentence to be safe.\n`;
      let out = "";
      // Heap corruption is layout-dependent — one call may pass, so hammer it.
      expect(() => {
        for (let i = 0; i < 50; i++)
          out = compile(src, { sourcePath: "u.nota" }).code;
      }).not.toThrow();
      // The multibyte char must survive verbatim in the emit.
      expect(out).toContain(ch);
      expect(out).toContain("export default function Doc()");
    });
  }

  test("the exact example doc (heading + emphasis + em-dash + list) compiles cleanly", () => {
    const src =
      "# Hello Nota\n\nThis is a *static* document with _no_ islands, served from a real package install — not a\nworkspace symlink.\n\n## A second section\n\nIt has headings and paragraphs, and a list:\n\n- first item\n- second item\n- third item\n";
    expect(() => {
      for (let i = 0; i < 50; i++) compile(src, { sourcePath: "hello.nota" });
    }).not.toThrow();
    const { code } = compile(src, { sourcePath: "hello.nota" });
    expect(code).toContain("install — not a");
    expect(code).toContain('h("nota-ul-li", {}');
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
