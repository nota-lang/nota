/**
 * The definition/tooltip system (`./src/def.ts` + the def-aware `Ref` in `./src/doc.ts`), driven
 * through the real decode pipeline via `decode(v)` — same conventions as doc.test.ts. The
 * `"definitions"` trailer is registered at prelude load (global-persistent), so every `decode`
 * here exercises the real trailer path.
 */

import {
  decode,
  type ElementVNode,
  FRAG,
  Fragment,
  h,
  reset,
  type VNode
} from "@nota-lang/runtime";
import { afterEach, describe, expect, test } from "vitest";

import {
  Definition,
  Footnote,
  FootnoteText,
  Heading,
  Label,
  mathset,
  Ref,
  resetConfigForTest,
  Tex,
  texRef
} from "../src/lib";

const el = (
  tag: ElementVNode["tag"],
  children: VNode[] = [],
  props: Record<string, unknown> = {}
): ElementVNode => ({ tag, props, children });
const frag = (children: VNode[] = []): ElementVNode => el(FRAG, children);

const doc = (v: VNode): string => decode(v) as string;

afterEach(() => {
  resetConfigForTest();
  reset();
});

describe("Definition", () => {
  test("renders its body in place inside an inline anchor", () => {
    const html = doc(
      frag([
        h(Definition, { id: "nota" }, ["Nota is a language."]),
        "\n\n",
        "After."
      ])
    );
    expect(html).toContain(
      '<span id="def-nota" class="nota-definition">Nota is a language.</span>'
    );
    expect(html).toContain("<p>After.</p>");
  });

  test("block definitions wrap in a flow <div> (paragraphs inside)", () => {
    const html = doc(
      frag([h(Definition, { id: "d", block: true }, ["a", "\n\n", "b"])])
    );
    expect(html).toContain('<div id="def-d" class="nota-definition">');
    expect(html).toContain("<p>a</p><p>b</p>");
  });

  test("missing id is a pointed error", () => {
    expect(() => doc(frag([h(Definition, {}, ["x"])]))).toThrow(/missing id/);
  });

  test("duplicate definitions for one id error pointedly", () => {
    expect(() =>
      doc(
        frag([
          h(Definition, { id: "d" }, ["one"]),
          h(Definition, { id: "d" }, ["two"]),
          h(Ref, { id: "d" }, [])
        ])
      )
    ).toThrow(/duplicate definition for id "d"/);
  });
});

describe("Ref → definition resolution", () => {
  test("a ref to a definition links the anchor and carries data-nota-def", () => {
    const html = doc(
      frag([
        h(Definition, { id: "nota", label: "Nota" }, ["The language."]),
        "\n\n",
        h(Ref, { id: "nota" }, [])
      ])
    );
    expect(html).toMatch(
      /<a href="#def-nota" class="nota-ref nota-def-ref" data-nota-def="nota">Nota<\/a>/
    );
  });

  test("label precedence: authored children beat the label prop beat the key", () => {
    const withChildren = doc(
      frag([
        h(Definition, { id: "x", label: "Lbl" }, ["b"]),
        h(Ref, { id: "x" }, [h("em", {}, ["custom"])])
      ])
    );
    expect(withChildren).toContain("<em>custom</em></a>");

    const withLabel = doc(
      frag([
        h(Definition, { id: "x", label: "Lbl" }, ["b"]),
        h(Ref, { id: "x" }, [])
      ])
    );
    expect(withLabel).toContain(">Lbl</a>");

    const bare = doc(
      frag([h(Definition, { id: "x" }, ["b"]), h(Ref, { id: "x" }, [])])
    );
    expect(bare).toContain(">x</a>");
  });

  test("markup labels render as markup", () => {
    const html = doc(
      frag([
        h(Definition, { id: "n", label: h("strong", {}, ["N"]) }, ["b"]),
        h(Ref, { id: "n" }, [])
      ])
    );
    expect(html).toContain("<strong>N</strong></a>");
  });

  test("falls back to @Label/heading resolution when no definition matches", () => {
    const html = doc(
      frag([
        h(Heading, { rank: 1 }, ["Intro"]),
        h(Label, { id: "sec" }, []),
        "\n\n",
        h(Ref, { id: "sec" }, [])
      ])
    );
    expect(html).toContain('<a href="#intro">Intro</a>');
  });

  test("no definition or label is a pointed error naming both", () => {
    expect(() => doc(frag([h(Ref, { id: "ghost" }, [])]))).toThrow(
      /no @Definition or @Label found for key "ghost"/
    );
  });
});

describe("the definitions trailer (tooltip bank)", () => {
  test("appends the bank + style + script when definitions exist", () => {
    const html = doc(
      frag([h(Definition, { id: "d", label: "D" }, ["Body text."])])
    );
    expect(html).toContain(
      '<div class="nota-def-tooltips" aria-hidden="true">'
    );
    expect(html).toContain(
      '<div class="nota-def-tooltip" data-def="d"><p>Body text.</p></div>'
    );
    expect(html).toContain("<style>.nota-def-tooltips { display: none; }");
    expect(html).toContain("__notaDefTooltips");
  });

  test("absent for definition-free documents", () => {
    const html = doc(frag(["Nothing to define."]));
    expect(html).not.toContain("nota-def-tooltips");
    expect(html).not.toContain("__notaDefTooltips");
  });

  test("tooltip content precedence: tooltip prop beats the body", () => {
    const html = doc(
      frag([
        h(Definition, { id: "d", tooltip: h("em", {}, ["tip"]) }, ["Body."])
      ])
    );
    expect(html).toContain(
      '<div class="nota-def-tooltip" data-def="d"><p><em>tip</em></p></div>'
    );
  });

  test("a raw-leaf body (a code/math render) IS the tooltip — no key fallback", () => {
    const html = doc(
      frag([h(Definition, { id: "d" }, [h(Tex, { display: true }, ["x^2"])])])
    );
    const bank = html.slice(html.indexOf("nota-def-tooltips"));
    expect(bank).toContain("<math");
    expect(bank).not.toContain('data-def="d"><p>d</p>');
  });

  test("a bodiless definition falls back to its label", () => {
    const html = doc(
      frag([
        h(Definition, { id: "d", label: "Lbl" }, []),
        h(Ref, { id: "d" }, [])
      ])
    );
    expect(html).toContain('data-def="d"><p>Lbl</p></div>');
  });

  test("doc-state inside a definition body indexes once (no double numbering)", () => {
    const html = doc(
      frag([
        h(Definition, { id: "d" }, ["Uses", h(Footnote, {}, ["a note"])]),
        "\n\n",
        "Tail."
      ])
    );
    // The body's footnote indexes once via the in-place render (`body` is not a walked
    // `data.content` field); the tooltip bank re-render reuses number 1 rather than minting 2.
    expect(html).toContain('id="fn-1"');
    expect(html).not.toContain('id="fn-2"');
    const lists = html.match(/<section class="nota-footnotes">/g) ?? [];
    expect(lists.length).toBe(1);
  });
});

describe("texRef + math output", () => {
  test("texRef wraps TeX in \\htmlData", () => {
    expect(texRef("deps", "\\kappa")).toBe(
      "\\htmlData{nota-def=deps}{\\kappa}"
    );
  });

  test("texRef rejects ids that break the \\htmlData syntax", () => {
    expect(() => texRef("a,b", "x")).toThrow(/may not contain/);
    expect(() => texRef("a=b", "x")).toThrow(/may not contain/);
  });

  test("html output emits the data attribute; mathml drops it silently", () => {
    mathset({ output: "html" });
    const html = doc(
      frag([
        h(Definition, { id: "deps", label: "κ" }, ["The dependency set."]),
        h(Tex, {}, [texRef("deps", "\\kappa")])
      ])
    );
    expect(html).toContain('data-nota-def="deps"');

    resetConfigForTest();
    const mathml = doc(
      frag([
        h(Definition, { id: "deps", label: "κ" }, ["The dependency set."]),
        h(Tex, {}, [texRef("deps", "\\kappa")])
      ])
    );
    expect(mathml).not.toContain('data-nota-def="deps"');
    expect(mathml).toContain("<math");
  });

  test("mathset output restores to the baseline on reset()", () => {
    mathset({ output: "html" });
    expect(doc(frag([h(Tex, {}, ["x"])]))).toContain("katex-html");
    reset();
    const mathml = doc(frag([h(Tex, {}, ["x^2"])]));
    expect(mathml).toContain("<math");
    expect(mathml).not.toContain("katex-html");
  });
});

describe("footnote definitions still work beside definitions", () => {
  test("a labeled footnote + a definition coexist", () => {
    const html = doc(
      frag([
        h(Definition, { id: "d" }, ["def body"]),
        "\n\n",
        "Text",
        h(FootnoteText, { label: "1" }, ["note body"]),
        Fragment(h(Ref, { id: "d" }, []))
      ])
    );
    expect(html).toContain("nota-def-tooltips");
  });
});
