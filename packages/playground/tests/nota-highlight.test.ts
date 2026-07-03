/**
 * Nota editor highlighting tests — reader-driven (the wasm `highlight` entry painting CM6
 * decorations; see src/nota-mode.ts). The substantive fixture is `integration/mega.nota`, the
 * repo's feature mega-test: it broke the old TextMate-grammar highlighter catastrophically (a
 * markup-valued prop switched the rest of the file into a runaway TS scope), so the assertions
 * here pin exactly the constructs that used to derail — everything *after* the poison line still
 * classifies as markup. Plus a CM6 smoke that the bridge paints classed spans into the editor DOM
 * (jsdom) and keeps last-good decorations while the doc is mid-edit.
 */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { EditorView } from "@codemirror/view";
import { beforeAll, describe, expect, it } from "vitest";
import { ensureCompiler } from "../src/compiler";
import {
  highlightSpans,
  type NotaSpan,
  notaHighlighting
} from "../src/nota-mode";

// Vitest runs with cwd = packages/playground (import.meta.url is not a file: URL here).
const MEGA_PATH = resolve(process.cwd(), "../../integration/mega.nota");
const MEGA = readFileSync(MEGA_PATH, "utf8");

beforeAll(async () => {
  // jsdom has no file:// fetch; hand the wasm bytes straight to init.
  const wasmPath = fileURLToPath(import.meta.resolve("nota_wasm")).replace(
    /nota_wasm\.js$/,
    "nota_wasm_bg.wasm"
  );
  await ensureCompiler(readFileSync(wasmPath));
});

/** The spans of `kind` rendered as source excerpts. */
function excerpts(spans: NotaSpan[], source: string, kind: string): string[] {
  return spans
    .filter(s => s.kind === kind)
    .map(s => source.slice(s.from, s.to));
}

describe("reader-driven highlighting of integration/mega.nota", () => {
  it("classifies every heading — including all those after the markup-valued prop", () => {
    const spans = highlightSpans(MEGA);
    const headings = excerpts(spans, MEGA, "heading");
    // The old grammar died at `@figure[cap:@em{a caption}]` (line 33); every section heading
    // after it rendered inside a TS scope. All 8 must classify — "## Nested statements" sits
    // right after a colon-block body, the shape of fixed reader bug 7 (TODO.md).
    expect(headings).toEqual([
      "# Nota Mega-Test",
      "## Elements & props",
      "## Control flow",
      "## Markup sugar",
      "###### A level-6 heading",
      "## Raw spans",
      "## Colon & block sugar",
      "## Nested statements"
    ]);
  });

  it("keeps classifying markup constructs after the poison line", () => {
    const spans = highlightSpans(MEGA);
    // Constructs from the second half of the document (all post-poison).
    expect(excerpts(spans, MEGA, "list-marker")).toEqual(
      expect.arrayContaining(["-", "+", "1.", "2."])
    );
    expect(excerpts(spans, MEGA, "emphasis-strong")).toContain(
      "*bold with _italic_ within*"
    );
    expect(excerpts(spans, MEGA, "code-lang")).toContain("python");
    expect(excerpts(spans, MEGA, "math-delim")).toContain("$$");
    expect(excerpts(spans, MEGA, "escape")).toEqual(
      expect.arrayContaining([
        "\\*",
        "\\_",
        "\\#",
        "\\$",
        "\\@",
        "\\{",
        "\\}",
        "\\\\"
      ])
    );
    expect(excerpts(spans, MEGA, "tag-host")).toEqual(
      expect.arrayContaining(["figure", "pre", "section", "summary", "aside"])
    );
    expect(excerpts(spans, MEGA, "tag-component")).toEqual(
      expect.arrayContaining(["Aside", "Colorized"])
    );
    expect(excerpts(spans, MEGA, "prop-name")).toEqual(
      expect.arrayContaining(["cap", "class", "disabled"])
    );
    expect(excerpts(spans, MEGA, "control-keyword")).toEqual(
      expect.arrayContaining(["if", "else", "for", "of"])
    );
  });

  it("classifies the %%% fence as JS and the verbatim re-arm as markup", () => {
    const spans = highlightSpans(MEGA);
    expect(excerpts(spans, MEGA, "sigil")).toEqual(
      expect.arrayContaining(["%%%", "|{", "}|"])
    );
    expect(excerpts(spans, MEGA, "js-keyword")).toEqual(
      expect.arrayContaining(["export", "const", "let", "return"])
    );
    // `|@Colorized{…}` inside the `@pre|{…}|` body re-enters markup.
    expect(excerpts(spans, MEGA, "verbatim").join("")).toContain("is raw;");
  });

  it("gives stray brackets in prose no JS classification", () => {
    const spans = highlightSpans("see [1] and {2} here\n\n# H\n");
    expect(excerpts(spans, "see [1] and {2} here\n\n# H\n", "heading")).toEqual(
      ["# H"]
    );
    expect(
      spans.some(s => s.kind.startsWith("js-") || s.kind === "prop-name")
    ).toBe(false);
  });
});

describe("notaHighlighting CM6 bridge", () => {
  it("paints kind-classed spans into the editor DOM", () => {
    const view = new EditorView({
      doc: "# Hello\n\nSome @em{markup} and @name.\n",
      extensions: [notaHighlighting()],
      parent: document.body
    });
    try {
      expect(
        view.dom.querySelectorAll('.cm-line [class*="cm-nota-"]').length
      ).toBeGreaterThan(0);
      expect(view.dom.querySelector(".cm-nota-heading")).not.toBeNull();
      expect(view.dom.querySelector(".cm-nota-tag-host")).not.toBeNull();
      expect(view.dom.querySelector(".cm-nota-interpolation")).not.toBeNull();
    } finally {
      view.destroy();
    }
  });

  it("keeps last-good decorations while the document is mid-edit (parse error)", () => {
    const view = new EditorView({
      doc: "@em{x}\n",
      extensions: [notaHighlighting()],
      parent: document.body
    });
    try {
      expect(view.dom.querySelector(".cm-nota-tag-host")).not.toBeNull();
      // `@em{x` (deleted `}`) does not parse — the previous spans must survive, remapped.
      view.dispatch({ changes: { from: 5, to: 6 } });
      expect(view.dom.querySelector(".cm-nota-tag-host")).not.toBeNull();
    } finally {
      view.destroy();
    }
  });
});
