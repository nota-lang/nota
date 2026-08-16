/**
 * `@nota-lang/compiler` shim tests.
 *
 * Drives the real reader — the in-process wasm backend — on the shared integration fixtures and
 * asserts the pinned **Solid JSX** emit surface (design/solid.md §The pipeline): the native JSX
 * emit (`<NotaDoc>` wrap, `<UlLi>` sentinels, `<For>`, no h-call surface) and
 * the prepended imports (`@nota-lang/solid` structural names, the `solid-js` ambient surface,
 * the ambient prelude for free names). A malformed `.nota` → `compile` throws with the reader's
 * diagnostics.
 */

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { parse } from "@babel/parser";
import { describe, expect, test } from "vitest";
import {
  AMBIENT_PRELUDE_NAMES,
  compile,
  SOLID_AMBIENT_NAMES
} from "../src/lib";

const here = dirname(fileURLToPath(import.meta.url));
// tests/ → packages/compiler → packages → repo root → integration/
const integrationDir = join(here, "..", "..", "..", "integration");

const read = (name: string) => readFileSync(join(integrationDir, name), "utf8");

describe("compile (JSX emit surface + prepended imports)", () => {
  test("golden.nota: NotaDoc wrap, For recovery, UlLi sentinel, plain-arrow component", () => {
    const src = read("golden.nota");
    const { code } = compile(src, { sourcePath: "golden.nota" });

    // The structural names the rewrite introduced, from @nota-lang/solid.
    expect(code).toMatch(/^import \{ NotaDoc, UlLi \} from "@nota-lang\/solid";/m);
    // The solid-js ambient surface: createSignal is free in the doc's %-code; For was recovered.
    expect(code).toMatch(/^import \{ createSignal, For \} from "solid-js";/m);

    // document mode emits the default Doc, body wrapped in <NotaDoc>.
    expect(code).toContain("export default function Doc()");
    expect(code).toContain("return <NotaDoc>");

    // The component is a plain Solid arrow, and its binding stays DOCUMENT-LOCAL.
    expect(code).toMatch(/let Colorized = \(props\) => \{/);
    expect(code).not.toMatch(/export let Colorized/);
    expect(code).not.toContain('"Colorized")'); // name-attach is gone with the manifest

    // @for → <For>, with the `-` marker as <UlLi> and the component as a JSX tag.
    expect(code).toMatch(/<For each=\{\["a", "b"\]\}>/);
    expect(code).toContain("<UlLi><Colorized>{x}</Colorized></UlLi>");

    // The h-call surface is fully dissolved.
    expect(code).not.toMatch(/\bh\(/);
    expect(code).not.toMatch(/\bdecode\(/);
    expect(code).not.toMatch(/\bFragment\(/);
    expect(code).not.toContain("@nota-lang/runtime");
  });

  test("note.nota: plain-arrow component, aside gets a Reforest interior, em stays tight", () => {
    const src = read("note.nota");
    const { code } = compile(src, { sourcePath: "note.nota" });

    expect(code).toContain("export default function Doc()");
    expect(code).toMatch(/let Note = \(props\) => </);
    expect(code).not.toMatch(/export let Note/);
    expect(code).not.toContain('"Note")'); // name-attach is gone with the manifest
    // aside is a flow container: its interior decodes as flow via <Reforest> (emit policy).
    expect(code).toMatch(/<aside><Reforest>/);
    expect(code).toContain('<em>{"world"}</em>');
  });

  test("the emit re-parses as a valid JSX module (validity invariant)", () => {
    const { code } = compile(read("note.nota"), { sourcePath: "note.nota" });
    expect(() =>
      parse(code, { sourceType: "module", plugins: ["jsx"] })
    ).not.toThrow();
  });

  test("map is currently undefined (the reader emits no sourcemap yet)", () => {
    const { map } = compile(read("note.nota"));
    expect(map).toBeUndefined();
  });
});

describe("compile (non-ASCII input — no wasm heap corruption)", () => {
  // Regression: a `.nota` containing a multibyte UTF-8 char (em-dash, U+2014) followed by enough
  // trailing content used to crash the wasm reader with a dlmalloc assertion — see the
  // size-tracking `#[global_allocator]` in nota_wasm. Heap-layout sensitive, so compile repeatedly.
  const multibyte = [
    ["em-dash (3-byte)", "—"],
    ["e-acute (2-byte)", "é"],
    ["g-clef (4-byte)", "\u{1d11e}"]
  ] as const;

  for (const [name, ch] of multibyte) {
    test(`repeatedly compiles a doc with a ${name} + trailing content`, () => {
      const src = `# Heading\n\nA paragraph with a ${ch} char, followed by plenty of trailing text so the\nbuffer is over-allocated, then a second sentence to be safe.\n`;
      let out = "";
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
    expect(code).toContain("<UlLi>");
  });
});

describe("compile (ambient prelude injection + freeNames)", () => {
  test("free Tex/CodeInline references get a prelude import", () => {
    const { code } = compile("Math $x^2$ and `f(x)`\n");
    // Sorted (the reader reports free names sorted; the filter preserves order).
    expect(code).toMatch(
      /^import \{ CodeInline, Tex \} from "@nota-lang\/prelude";$/m
    );
  });

  test("no ambient refs → no prelude import", () => {
    const { code } = compile("Just @em{prose}.\n");
    expect(code).not.toContain("@nota-lang/prelude");
  });

  test("a config-fn call (secset) injects; a prose mention of its text does not", () => {
    const injected = compile("% secset({ n: 1 })\n# Title\n");
    expect(injected.code).toMatch(
      /^import \{ Heading, secset \} from "@nota-lang\/prelude";$/m
    );
    const prose = compile("@p{secset( is not a call}\n");
    expect(prose.code).not.toContain("@nota-lang/prelude");
  });

  test("a %import of the same name suppresses the injection (lexical override)", () => {
    const { code, freeNames } = compile(
      '%import { Tex } from "./my-tex.js"\nMath $x^2$\n'
    );
    expect(code).not.toContain("@nota-lang/prelude");
    expect(code).toContain('from "./my-tex.js"');
    expect(freeNames).not.toContain("Tex");
  });

  test("prelude: false disables injection; a custom module is honored", () => {
    const off = compile("$x$\n", { prelude: false });
    expect(off.code).not.toContain("@nota-lang/prelude");
    const custom = compile("$x$\n", { prelude: { module: "/my/prelude.ts" } });
    expect(custom.code).toContain('import { Tex } from "/my/prelude.ts";\n');
  });

  test("the solid-js ambient surface binds free state/control-flow names", () => {
    const { code } = compile("%let [n, setN] = createSignal(0)\nhi @{n()}\n");
    expect(code).toMatch(/^import \{ createSignal \} from "solid-js";$/m);
  });

  test("extraNames: a free custom name binds alongside the built-ins; unused extras don't", () => {
    const { code } = compile("%let s = useSiteTheme()\nMath $x^2$\n", {
      prelude: {
        module: "virtual:nota-ambient",
        extraNames: ["useSiteTheme", "registerWidgets"]
      }
    });
    expect(code).toMatch(
      /import \{ Tex, useSiteTheme \} from "virtual:nota-ambient";\n/
    );
    expect(code).not.toContain("registerWidgets");
  });

  test("freeNames: sorted, cover the structural JSX surface, exclude bound names", () => {
    const { freeNames } = compile(read("golden.nota"));
    for (const name of ["NotaDoc", "UlLi", "For", "createSignal"]) {
      expect(freeNames).toContain(name);
    }
    for (const gone of ["h", "decode", "Fragment", "inlineComponent"]) {
      expect(freeNames).not.toContain(gone);
    }
    expect(freeNames).not.toContain("Colorized");
    expect(freeNames).toEqual([...freeNames].sort());
  });

  test("the ambient name lists cover their surfaces", () => {
    for (const name of ["Tex", "Heading", "Label", "secset", "bibset"]) {
      expect(AMBIENT_PRELUDE_NAMES).toContain(name);
    }
    for (const name of ["createSignal", "Show", "For", "onMount"]) {
      expect(SOLID_AMBIENT_NAMES).toContain(name);
    }
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
    expect(err.message).toContain("failed to compile");
    expect(err.message).toContain("bad.nota");
    expect(err.message.toLowerCase()).toContain("expected");
    expect(typeof err.diagnostics).toBe("string");
    expect((err.diagnostics ?? "").length).toBeGreaterThan(0);
  });
});
