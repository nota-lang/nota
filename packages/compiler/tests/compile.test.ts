/**
 * `@nota-lang/compiler` shim tests.
 *
 * Drives the real reader — the in-process wasm backend — on the shared integration fixtures and
 * asserts the pinned **Solid JSX** emit surface (design/solid.md §The pipeline): the native JSX
 * emit (`<NotaDoc>` wrap, `<UlLi>` sentinels, `<For>`, no h-call surface) and
 * the prepended imports (`@nota-lang/core` structural names, the `solid-js` ambient surface,
 * the ambient prelude for free names). A malformed `.nota` → `compile` throws with the reader's
 * diagnostics.
 */

import { existsSync, readdirSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { parse } from "@babel/parser";
import { describe, expect, test } from "vitest";
import {
  AMBIENT_PRELUDE_NAMES,
  compile,
  SOLID_AMBIENT_NAMES,
  CORE_RUNTIME_NAMES,
  SOLID_WEB_NAMES
} from "../src/lib";

const here = dirname(fileURLToPath(import.meta.url));
// tests/ → packages/compiler → packages → repo root → integration/
const repoRoot = join(here, "..", "..", "..");
const integrationDir = join(repoRoot, "integration");

const read = (name: string) => readFileSync(join(integrationDir, name), "utf8");

describe("compile (JSX emit surface + prepended imports)", () => {
  test("golden.nota: NotaDoc wrap, For recovery, UlLi sentinel, plain-arrow component", () => {
    const src = read("golden.nota");
    const { code } = compile(src, { sourcePath: "golden.nota" });

    // The structural names the rewrite introduced, from @nota-lang/core.
    expect(code).toMatch(
      /^import \{ NotaDoc, UlLi \} from "@nota-lang\/core";/m
    );
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

  test("map is currently undefined (the reader emits no sourcemap yet)", () => {
    const { map } = compile(read("note.nota"));
    expect(map).toBeUndefined();
  });
});

describe("the emit re-parses as a valid JSX module (validity invariant, every fixture)", () => {
  // Every shared integration fixture must compile without diagnostics AND yield a
  // Babel-parseable JSX module — discovered by readdir so a new fixture is covered
  // automatically. None needs external context at compile time: `compile` is a pure text
  // transform, so asset.nota's `./asset.css` / `?url` imports are the *bundler's* business and
  // appear verbatim in the emit.
  const fixtures = readdirSync(integrationDir)
    .filter(f => f.endsWith(".nota"))
    .sort();

  test("the discovered fixture set includes the known files", () => {
    expect(fixtures).toEqual(
      expect.arrayContaining([
        "asset.nota",
        "closure.nota",
        "conditional.nota",
        "golden.nota",
        "mega.nota",
        "note.nota",
        "prose-sugars.nota",
        "static.nota"
      ])
    );
  });

  for (const name of fixtures) {
    test(`${name}: compiles clean and re-parses as valid JSX`, () => {
      const { code } = compile(read(name), { sourcePath: name });
      expect(() =>
        parse(code, { sourceType: "module", plugins: ["jsx"] })
      ).not.toThrow();
    });
  }
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
});

describe("the ambient name lists cover their surfaces (full list↔surface loops)", () => {
  // Each exported list claims a module supplies its names: the shim prepends
  // `import { <names ∩ freeNames> } from "<module>"`, so a listed name missing from the module
  // would crash every document that references it. Enumerate each module's REAL export surface
  // and assert every listed name exists — the whole list, not spot checks.

  /**
   * The **value** export names of a TS(X) module, statically enumerated (`@babel/parser` +
   * a walk of the top-level export statements; `export *` is followed into its source). The
   * workspace siblings are not dependencies of this package — nothing here executes them — so
   * the surface is read from their `src/`, which also can't go stale the way a dist can.
   */
  function exportedValueNames(
    entryPath: string,
    seen = new Set<string>()
  ): Set<string> {
    const names = new Set<string>();
    if (seen.has(entryPath)) return names;
    seen.add(entryPath);
    const ast = parse(readFileSync(entryPath, "utf8"), {
      sourceType: "module",
      plugins: ["typescript", "jsx"]
    });
    const resolveRelative = (source: string): string => {
      for (const ext of [".ts", ".tsx"]) {
        const candidate = join(dirname(entryPath), source + ext);
        if (existsSync(candidate)) return candidate;
      }
      throw new Error(`cannot resolve ${source} from ${entryPath}`);
    };
    for (const node of ast.program.body) {
      if (node.type === "ExportAllDeclaration") {
        for (const n of exportedValueNames(
          resolveRelative(node.source.value),
          seen
        )) {
          names.add(n);
        }
      } else if (node.type === "ExportNamedDeclaration") {
        if (node.exportKind === "type") continue;
        for (const spec of node.specifiers) {
          if (spec.type === "ExportSpecifier" && spec.exportKind !== "type") {
            const exported = spec.exported;
            names.add(
              exported.type === "Identifier" ? exported.name : exported.value
            );
          }
        }
        const decl = node.declaration;
        if (decl) {
          if (
            (decl.type === "FunctionDeclaration" ||
              decl.type === "ClassDeclaration") &&
            decl.id
          ) {
            names.add(decl.id.name);
          } else if (decl.type === "VariableDeclaration") {
            for (const d of decl.declarations) {
              if (d.id.type === "Identifier") names.add(d.id.name);
            }
          }
          // TS type-alias/interface declarations are type-only — not value exports.
        }
      }
    }
    return names;
  }

  test("CORE_RUNTIME_NAMES ⊆ @nota-lang/core's exports", () => {
    const surface = exportedValueNames(
      join(repoRoot, "packages", "core", "src", "lib.tsx")
    );
    expect(CORE_RUNTIME_NAMES.filter(n => !surface.has(n))).toEqual([]);
  });

  test("AMBIENT_PRELUDE_NAMES ⊆ @nota-lang/prelude's exports", () => {
    const surface = exportedValueNames(
      join(repoRoot, "packages", "prelude", "src", "lib.ts")
    );
    expect(AMBIENT_PRELUDE_NAMES.filter(n => !surface.has(n))).toEqual([]);
  });

  // solid-js is not a dependency of this package either; resolve it the way a built document
  // would — through @nota-lang/core's own dependency graph. `createRequire` from that package
  // loads the CJS server build; the export *surface* is identical across solid's builds.
  const solidRequire = createRequire(
    join(repoRoot, "packages", "core", "package.json")
  );

  test("SOLID_AMBIENT_NAMES ⊆ solid-js's exports", () => {
    const solid = solidRequire("solid-js") as Record<string, unknown>;
    expect(SOLID_AMBIENT_NAMES.filter(n => !(n in solid))).toEqual([]);
  });

  test("SOLID_WEB_NAMES ⊆ solid-js/web's exports", () => {
    const web = solidRequire("solid-js/web") as Record<string, unknown>;
    expect(SOLID_WEB_NAMES.filter(n => !(n in web))).toEqual([]);
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

describe("compile (2026-08 sugars: comments, hr, strike, links, images, attrs)", () => {
  test("prose-sugars.nota: the shared fixture compiles with every sugar in place", () => {
    const { code } = compile(read("prose-sugars.nota"), {
      sourcePath: "prose-sugars.nota"
    });
    expect(code).toContain('<Heading rank={1} id="sugars" class="demo">');
    expect(code).toContain("<s>");
    // Links/images are element forms (the markdown sugar was reverted; shapes stay prose).
    expect(code).toContain('<a href="https://example.com/a_b">');
    expect(code).toContain('<img src="sample.svg" alt="An owl" />');
    expect(code).toContain("[these](here.html)");
    expect(code).toContain("<hr />");
    expect(code).toContain('<UlLi class="hot">');
    expect(code).toContain('<Attrs class="note" />');
    // Comments are trivia; escapes survive as literal text.
    expect(code).not.toContain("comment-only line");
    expect(code).toContain("// stays literal slashes");
  });

  test("comments are trivia; thematic break and strike lower to host elements", () => {
    const { code } = compile(
      "a // gone\n\n/* also gone */\n~~struck~~ text\n\n---\n",
      { sourcePath: "sugars.nota" }
    );
    expect(code).not.toContain("gone");
    expect(code).toContain("<s>");
    expect(code).toContain("<hr />");
  });

  test("heading attrs hoist; a paragraph attrs group binds the Attrs marker", () => {
    const { code, freeNames } = compile(
      '# Title [id: "intro", class: "wide"]\n\npara text [class: "note"]\n',
      { sourcePath: "attrs.nota" }
    );
    expect(code).toContain('<Heading rank={1} id="intro" class="wide">');
    expect(code).toContain('<Attrs class="note" />');
    // The marker is a structural free name, bound from @nota-lang/core.
    expect(freeNames).toContain("Attrs");
    expect(code).toMatch(/^import \{ .*Attrs.* \} from "@nota-lang\/core";/m);
  });
});
