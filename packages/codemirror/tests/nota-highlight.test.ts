/**
 * Nota editor highlighting tests — reader-driven (the wasm `highlight` entry painting CM6
 * decorations; see src/nota-mode.ts). The substantive fixture is `integration/mega.nota`, the
 * repo's feature mega-test: it broke the old TextMate-grammar highlighter catastrophically (a
 * markup-valued prop switched the rest of the file into a runaway TS scope), so the assertions
 * here pin exactly the constructs that used to derail — everything *after* the poison line still
 * classifies as markup. `integration/prose-sugars.nota` covers what mega predates: the 2026-08
 * sugars (strike, thematic break, markup comments, trailing attrs groups) and their escape rows.
 * Plus a CM6 smoke that the bridge paints classed spans into the editor DOM
 * (jsdom) and keeps last-good decorations while the doc is mid-edit.
 */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { EditorView } from "@codemirror/view";
import { describe, expect, it } from "vitest";
import { embeddedTokens } from "../src/embedded-langs";
import {
  catppuccinHighlight,
  catppuccinLatte,
  embeddedHighlightSpans,
  embeddedRegions,
  highlightSpans,
  type NotaSpan,
  notaHighlighting
} from "../src/lib";

// Vitest runs with cwd = packages/codemirror (import.meta.url is not a file: URL here).
const MEGA_PATH = resolve(process.cwd(), "../../integration/mega.nota");
const MEGA = readFileSync(MEGA_PATH, "utf8");
const SUGARS_PATH = resolve(
  process.cwd(),
  "../../integration/prose-sugars.nota"
);
const SUGARS = readFileSync(SUGARS_PATH, "utf8");

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
    // after it rendered inside a TS scope. All 10 must classify — "## Nested statements" sits
    // right after a colon-block body, the shape of fixed reader bug 7 (TODO.md).
    expect(headings).toEqual([
      "# Nota Mega-Test",
      "## Elements & props",
      "## Control flow",
      "## Markup sugar",
      "###### A level-6 heading",
      "## Raw spans",
      "## Colon & block sugar",
      "## Nested statements",
      "## Doc-state sugar",
      "## Doc-state constructs"
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
    // Inline math paints per-`$` delimiters; the display fence's delimiters carry their line
    // break (`$$\n` opener / `\n$$` closer — the reader's pinned fence-delim shape).
    const mathDelims = excerpts(spans, MEGA, "math-delim");
    expect(mathDelims).toContain("$");
    expect(mathDelims).toContain("$$\n");
    expect(mathDelims).toContain("\n$$");
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

  it("classifies the doc-state sugar — sigil bytes + label idents, guard intact", () => {
    const spans = highlightSpans(MEGA);
    // The sugars reuse existing kinds (no new wire discriminants): the delimiter bytes paint
    // `sigil`, the label ident paints `interpolation` (the `@name` kind — a name-like
    // reference). (`[^`/`]:` retired with the footnote digraphs — design/references.md.)
    expect(excerpts(spans, MEGA, "sigil")).toEqual(
      expect.arrayContaining(["<", ">", "&"])
    );
    // `sec-kebab` pins the restored kebab charset (Typst-minus-period): the `-` is a label
    // continue char, so `<sec-kebab>` / `&sec-kebab` classify as one ident, not `sec` + `-kebab`.
    // The `n1`/`n2`/`n3` footnote uses are now `&`-refs (post-punctuation glue).
    expect(excerpts(spans, MEGA, "interpolation")).toEqual(
      expect.arrayContaining(["sec_flow", "sec-kebab", "n1", "n2", "n3"])
    );
    // A ref's postfix props group paints through the ordinary prop machinery.
    expect(excerpts(spans, MEGA, "prop-name")).toEqual(
      expect.arrayContaining(["page"])
    );
    // The boundary guard held: `Vec<T>` / `R&D` stayed literal, so their `<` / `&` / `T` produced no
    // doc-state spans — the ident set never includes `T` or `D`.
    const idents = excerpts(spans, MEGA, "interpolation");
    expect(idents).not.toContain("T");
    expect(idents).not.toContain("D");
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

describe("reader-driven highlighting of integration/prose-sugars.nota (2026-08 sugars)", () => {
  // mega.nota predates the 2026-08 sugars, so this fixture carries their span coverage. Its
  // smart-punct line holds two em-dashes (3 UTF-8 bytes / 1 UTF-16 unit each) *before* the
  // thematic break and the last attrs groups, so every exact excerpt below that line also pins
  // the byte→UTF-16 conversion — without it those spans would drift right and slice garbage.

  it("the fixture is multibyte before the sugar rows (guards the UTF-16 coverage)", () => {
    const dash = SUGARS.indexOf("—");
    expect(dash).toBeGreaterThan(-1);
    expect(dash).toBeLessThan(SUGARS.indexOf("---"));
    expect(new TextEncoder().encode(SUGARS).length).toBeGreaterThan(
      SUGARS.length
    );
  });

  it("classifies ~~strike~~ — whole-run under-layer + tilde markers as sigils", () => {
    const spans = highlightSpans(SUGARS);
    // Exact: only the two real strikes — the `\~~ stays tildes` escape row contributes none.
    // `~~two~~` sits after the em-dashes (exact slice ⇒ offsets converted).
    expect(excerpts(spans, SUGARS, "emphasis-strike")).toEqual([
      "~~struck~~",
      "~~two~~"
    ]);
    // The `~~` delimiters paint as sigils (the emphasis-marker kind): two per strike.
    expect(
      excerpts(spans, SUGARS, "sigil").filter(s => s === "~~")
    ).toHaveLength(4);
  });

  it("classifies the --- thematic break as line punctuation (list-marker kind)", () => {
    const spans = highlightSpans(SUGARS);
    // Exact: the break + the two `-` item markers, in document order. The prose `6 --- dots`
    // run (smart-punct material mid-paragraph) contributes none, and the break's exact slice
    // sits after the em-dashes (offset conversion again).
    expect(excerpts(spans, SUGARS, "list-marker")).toEqual(["---", "-", "-"]);
  });

  it("classifies // and nested /* */ markup comments (Comment kind, delimiters included)", () => {
    const spans = highlightSpans(SUGARS);
    // Exact: the comment-only line (span stops before its newline), the nested block form, and
    // the trailing comment inside a list item — and nothing from the `\// stays literal
    // slashes` escape row.
    expect(excerpts(spans, SUGARS, "comment")).toEqual([
      "// A comment-only line: consumed with its newline (no phantom paragraph break).",
      "/* a nested /* block */ comment */",
      "// a trailing comment inside the item"
    ]);
  });

  it("classifies trailing attrs groups — bare [ ] sigils, prop names, JS-string values", () => {
    const spans = highlightSpans(SUGARS);
    // One group each on the heading, a list item, and the closing paragraph. The markdown-link
    // shape `[these](here.html)` and the escaped `\[not: attrs]` contribute no brackets.
    const sigils = excerpts(spans, SUGARS, "sigil");
    expect(sigils.filter(s => s === "[")).toHaveLength(3);
    expect(sigils.filter(s => s === "]")).toHaveLength(3);
    // Exact prop-name sequence: heading attrs, then the @a/@img element props, then the
    // item/paragraph attrs (both after the em-dashes).
    expect(excerpts(spans, SUGARS, "prop-name")).toEqual([
      "id",
      "class",
      "href",
      "src",
      "alt",
      "class",
      "class"
    ]);
    expect(excerpts(spans, SUGARS, "prop-name")).not.toContain("not");
    expect(excerpts(spans, SUGARS, "js-string")).toEqual(
      expect.arrayContaining(['"sugars"', '"demo"', '"hot"', '"note"'])
    );
  });

  it("escape rows paint escape spans, not sugar spans", () => {
    const spans = highlightSpans(SUGARS);
    // `\//`, `\~~`, `\[` — each escape span is backslash + the first sugar byte; the rest of
    // the would-be delimiter stays plain text (asserted sugar-absent above).
    expect(excerpts(spans, SUGARS, "escape")).toEqual(
      expect.arrayContaining(["\\/", "\\~", "\\["])
    );
  });

  it("smart-punct material inside code/math stays raw (exact post-multibyte slices)", () => {
    const spans = highlightSpans(SUGARS);
    // Both interiors sit right after the first em-dash — exact slices double as the
    // byte→UTF-16 proof for the code/math kinds.
    expect(excerpts(spans, SUGARS, "code")).toEqual(['"code" -- ...']);
    expect(excerpts(spans, SUGARS, "math")).toEqual(["a -- b"]);
  });
});

describe("embeddedRegions (direct)", () => {
  it("lists each code/math interior with its resolved language tag", () => {
    const doc = "a $x+y$ b\n\n```py\nf(1)\n```\n";
    expect(embeddedRegions(doc)).toEqual([
      { from: 3, to: 6, lang: "tex" }, // math is always TeX
      { from: 17, to: 21, lang: "py" } // the raw fence tag; alias resolution is embeddedTokens'
    ]);
    expect(doc.slice(3, 6)).toBe("x+y");
    expect(doc.slice(17, 21)).toBe("f(1)");
  });

  it("inline code (no fence language) resolves to lang: null", () => {
    expect(embeddedRegions("run `f(x)` now\n")).toEqual([
      { from: 5, to: 9, lang: null }
    ]);
  });

  it("returns [] when the document doesn't parse", () => {
    expect(embeddedRegions("@em{unterminated")).toEqual([]);
  });
});

describe("theme exports", () => {
  it("catppuccinLatte / catppuccinHighlight are defined and non-empty", () => {
    // catppuccinLatte is a CM HighlightStyle: a non-empty rule list and a style() lookup.
    expect(catppuccinLatte.specs.length).toBeGreaterThan(0);
    expect(typeof catppuccinLatte.style).toBe("function");
    // catppuccinHighlight is the same style as a ready-to-compose extension.
    expect(catppuccinHighlight).toBeTruthy();
  });
});

describe("offset units — reader bytes → CodeMirror UTF-16", () => {
  it("spans stay aligned after a multi-byte character (the em-dash drift)", () => {
    // "—" is 3 UTF-8 bytes / 1 UTF-16 unit: without conversion the `&` sigil span lands on "o"
    // and the ref name reads "ta r" (the exact bug: `&nota` painting as `&no` + `ta…`).
    const src = "— &nota rules *bold*";
    const spans = highlightSpans(src);
    expect(excerpts(spans, src, "sigil")).toContain("&");
    const interp = excerpts(spans, src, "interpolation");
    expect(interp).toContain("nota");
    expect(excerpts(spans, src, "emphasis-strong")).toContain("*bold*");
  });

  it("astral-plane characters (2 UTF-16 units) keep later spans aligned", () => {
    const src = "🦀🦀 @em{crab}";
    const spans = highlightSpans(src);
    expect(excerpts(spans, src, "sigil")).toContain("@");
    expect(excerpts(spans, src, "tag-host")).toContain("em");
  });

  it("embedded regions resolve the right language text after multi-byte prose", () => {
    const src = "préambule — voilà\n\n```rust\nfn main() {}\n```\n";
    const spans = highlightSpans(src);
    expect(excerpts(spans, src, "code-lang")).toContain("rust");
    const code = excerpts(spans, src, "code");
    expect(code.some(c => c.includes("fn main"))).toBe(true);
    // The sub-tokenizer sees correctly sliced Rust, so a keyword token lands exactly on `fn`.
    const embedded = embeddedHighlightSpans(src);
    expect(
      embedded.some(
        s => src.slice(s.from, s.to) === "fn" && s.classes.length > 0
      )
    ).toBe(true);
  });

  it("ascii-only sources take the identity fast path (offsets unchanged)", () => {
    const src = "# Title\n\nplain *bold* text\n";
    const spans = highlightSpans(src);
    expect(excerpts(spans, src, "heading")).toContain("# Title");
    expect(excerpts(spans, src, "emphasis-strong")).toContain("*bold*");
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

describe("embedded sub-language highlighting (embeddedTokens)", () => {
  /** A token whose source slice equals `text`, or `undefined`. */
  function tokenOf(src: string, lang: string, text: string) {
    return embeddedTokens(src, lang).find(
      t => src.slice(t.from, t.to) === text
    );
  }

  it("tokenizes a code language's keywords / literals", () => {
    const py = "def g():\n    return 1";
    const defKw = tokenOf(py, "python", "def");
    expect(defKw).toBeDefined();
    expect(defKw?.classes).toBeTruthy(); // a HighlightStyle class was assigned
    expect(tokenOf(py, "python", "return")).toBeDefined();
    // A real Lezer parse, not a flat run: keyword and string classify distinctly.
    const js = 'const s = "hi";';
    expect(tokenOf(js, "js", "const")).toBeDefined();
    expect(tokenOf(js, "js", '"hi"')).toBeDefined();
  });

  it("resolves fence-tag aliases (py, rs, js) to their language", () => {
    expect(embeddedTokens("def x(): pass", "py").length).toBeGreaterThan(0);
    expect(embeddedTokens("let mut x = 1;", "rs").length).toBeGreaterThan(0);
    expect(embeddedTokens("const x = 1;", "js").length).toBeGreaterThan(0);
  });

  it("tokenizes TeX commands (the math language)", () => {
    const tex = "\\sum_{i=0}^n x_i";
    const cmd = embeddedTokens(tex, "tex").find(t =>
      tex.slice(t.from, t.to).includes("sum")
    );
    expect(cmd).toBeDefined();
    expect(embeddedTokens("\\alpha", "latex").length).toBeGreaterThan(0); // `latex` alias
  });

  it("returns nothing for an unknown or absent language (caller keeps flat)", () => {
    expect(embeddedTokens("whatever it is", "brainfuck")).toEqual([]);
    expect(embeddedTokens("whatever it is", null)).toEqual([]);
  });
});

describe("embedded highlighting end-to-end (embeddedHighlightSpans)", () => {
  it("associates a fenced block's language and tokenizes its interior at absolute offsets", () => {
    const doc = "```python\ndef g(): pass\n```\n";
    const def = embeddedHighlightSpans(doc).find(
      s => doc.slice(s.from, s.to) === "def"
    );
    expect(def).toBeDefined();
    // The offset is absolute into the source (past the fence line).
    expect(def?.from).toBe(doc.indexOf("def"));
  });

  it("highlights math as TeX — inline and display — with no language tag", () => {
    const inline = "before $\\alpha + \\beta$ after\n";
    expect(
      embeddedHighlightSpans(inline).some(s =>
        inline.slice(s.from, s.to).includes("alpha")
      )
    ).toBe(true);
    const display = "$$\n\\sum x\n$$\n";
    expect(
      embeddedHighlightSpans(display).some(s =>
        display.slice(s.from, s.to).includes("sum")
      )
    ).toBe(true);
  });

  it("leaves inline code and untagged fences flat (no embedded tokens)", () => {
    expect(embeddedHighlightSpans("run `f(x)` now\n")).toEqual([]);
    expect(embeddedHighlightSpans("```\nplain text\n```\n")).toEqual([]);
  });

  it("highlights a @style{...} element body as CSS", () => {
    const doc = "@style{ .a { color: red; } }\n";
    const spans = embeddedHighlightSpans(doc);
    expect(spans.some(s => doc.slice(s.from, s.to) === "color")).toBe(true);
    expect(spans.some(s => doc.slice(s.from, s.to) === "red")).toBe(true);
    // Only the CSS body, not the `@`/`style` head, is tokenized here.
    expect(spans.every(s => s.from >= doc.indexOf("{"))).toBe(true);
  });

  it("only @style bodies are CSS — a @div body stays plain", () => {
    expect(embeddedHighlightSpans("@div{ color: red }\n")).toEqual([]);
  });

  it("paints overlays and drops the flat under-layer in the editor DOM", () => {
    const view = new EditorView({
      doc: "```python\ndef g(): pass\n```\n",
      extensions: [notaHighlighting()],
      parent: document.body
    });
    try {
      const spans = [...view.dom.querySelectorAll(".cm-content span[class]")];
      // Embedded overlays carry HighlightStyle atomic classes, not `cm-nota-*`.
      expect(spans.some(el => !el.className.includes("cm-nota-"))).toBe(true);
      // A tokenized interior replaces (not layers under) its flat `code` paint.
      expect(view.dom.querySelector(".cm-nota-code")).toBeNull();
    } finally {
      view.destroy();
    }
  });

  it("falls back to the flat `code` paint for inline code (no fence language)", () => {
    const view = new EditorView({
      doc: "run `f(x)` now\n",
      extensions: [notaHighlighting()],
      parent: document.body
    });
    try {
      expect(view.dom.querySelector(".cm-nota-code")).not.toBeNull();
    } finally {
      view.destroy();
    }
  });
});

describe("kind coverage (reader ↔ KIND_STYLES sync)", () => {
  it("KIND_STYLES keys are exactly highlightKindNames() (both directions)", async () => {
    const { highlightKindNames } = await import("@nota-lang/compiler");
    const { KIND_STYLES } = await import("../src/nota-mode");
    const kinds = highlightKindNames();
    const styled = Object.keys(KIND_STYLES);
    expect(styled.filter(k => !kinds.includes(k))).toEqual([]);
    expect(kinds.filter(k => !styled.includes(k))).toEqual([]);
  });
});
