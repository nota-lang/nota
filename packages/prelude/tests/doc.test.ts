/**
 * `@nota-lang/prelude` doc-state constructs, driven through the **real** decode
 * pipeline via `decode(v)` (which at ▸=false runs `normalize → index → force → struct → serialize`,
 * plus the trailer auto-append). Unit-level assertions (`counters`, boundary-children indexing) call
 * `indexDoc`/`normalize` directly. No adapter is set — no fixture islands a component.
 *
 * Isolation: the prelude registers the `"footnotes"` trailer at module load (global-persistent). We
 * deliberately do NOT `clearTrailers` in teardown (that would poison the footnote tests); config +
 * the component registry are the only per-render state, reset per test.
 */

import {
  blockComponent,
  type CompProps,
  clearRegisteredComponents,
  decode,
  type ElementVNode,
  FRAG,
  Fragment,
  h,
  indexDoc,
  mark,
  normalize,
  registerComponents,
  render,
  reset,
  type VNode
} from "@nota-lang/runtime";
import { afterEach, describe, expect, test } from "vitest";

import {
  Bibliography,
  bibset,
  Cite,
  counters,
  Footnote,
  FootnoteMark,
  Footnotes,
  FootnoteText,
  Heading,
  Label,
  Ref,
  resetConfigForTest,
  secset,
  Toc,
  textContent
} from "../src/lib";

const el = (
  tag: ElementVNode["tag"],
  children: VNode[] = [],
  props: Record<string, unknown> = {}
): ElementVNode => ({ tag, props, children });
const frag = (children: VNode[] = []): ElementVNode => el(FRAG, children);

/** Drive the real ▸=false decode pipeline (marks/queries/trailers all resolve). */
const doc = (v: VNode): string => decode(v) as string;

afterEach(() => {
  resetConfigForTest();
  clearRegisteredComponents();
  reset();
});

// =============================================================================================
// textContent helper
// =============================================================================================

describe("textContent", () => {
  test("flattens markup to text; skips marks/queries; stringifies numbers", () => {
    expect(textContent(["a", el("em", ["b"]), 3])).toBe("ab3");
    expect(textContent([mark("x"), "y", null, false, true])).toBe("y");
    expect(textContent(el("span", ["deep ", el("strong", ["text"])]))).toBe(
      "deep text"
    );
  });
});

// =============================================================================================
// Heading — ids, dedup, explicit id
// =============================================================================================

describe("Heading ids (slug + dedup + explicit)", () => {
  test("slugified, deduplicated, and explicit ids", () => {
    const out = doc(
      frag([
        el(Heading, ["Hello, World!"], { rank: 1 }),
        el(Heading, ["Hello World"], { rank: 2 }),
        el(Heading, ["Custom"], { rank: 3, id: "my-id" })
      ])
    );
    expect(out).toContain('<h1 id="hello-world">Hello, World!</h1>');
    expect(out).toContain('<h2 id="hello-world-2">Hello World</h2>');
    expect(out).toContain('<h3 id="my-id">Custom</h3>');
  });
});

// =============================================================================================
// Heading — numbering (secset)
// =============================================================================================

describe("Heading numbering (secset)", () => {
  test("numbering is OFF by default (no secnum span)", () => {
    const out = doc(frag([el(Heading, ["A"], { rank: 1 })]));
    expect(out).not.toContain("nota-secnum");
    expect(out).toContain('<h1 id="a">A</h1>');
  });

  test("secset({numberDepth}) numbers headings hierarchically", () => {
    secset({ numberDepth: 2 });
    const out = doc(
      frag([
        el(Heading, ["A"], { rank: 1 }),
        el(Heading, ["B"], { rank: 2 }),
        el(Heading, ["C"], { rank: 2 }),
        el(Heading, ["D"], { rank: 1 }),
        el(Heading, ["E"], { rank: 3 })
      ])
    );
    expect(out).toContain(
      '<h1 id="a"><span class="nota-secnum">1</span> A</h1>'
    );
    expect(out).toContain(
      '<h2 id="b"><span class="nota-secnum">1.1</span> B</h2>'
    );
    expect(out).toContain(
      '<h2 id="c"><span class="nota-secnum">1.2</span> C</h2>'
    );
    expect(out).toContain(
      '<h1 id="d"><span class="nota-secnum">2</span> D</h1>'
    );
    // rank 3 is beyond numberDepth 2 → no number
    expect(out).toContain('<h3 id="e">E</h3>');
  });

  test("skipped ranks collapse gracefully (# / ### → 1 / 1.1)", () => {
    secset({ numberDepth: 3 });
    const out = doc(
      frag([el(Heading, ["A"], { rank: 1 }), el(Heading, ["B"], { rank: 3 })])
    );
    expect(out).toContain(
      '<h1 id="a"><span class="nota-secnum">1</span> A</h1>'
    );
    expect(out).toContain(
      '<h3 id="b"><span class="nota-secnum">1.1</span> B</h3>'
    );
  });

  test("secset does not leak between renders (per-render reset)", () => {
    const DocNum = (): VNode => {
      secset({ numberDepth: 2 });
      return frag([el(Heading, ["A"], { rank: 1 })]);
    };
    const DocPlain = (): VNode => frag([el(Heading, ["A"], { rank: 1 })]);
    const r1 = render(DocNum);
    const r2 = render(DocPlain);
    expect(r1.html).toContain('<span class="nota-secnum">1</span>');
    expect(r2.html).not.toContain("nota-secnum");
  });
});

// =============================================================================================
// Toc
// =============================================================================================

describe("Toc", () => {
  test("nested list of links (nesting via child sentinels → nested <ul>)", () => {
    const out = doc(
      frag([
        el(Toc, [], {}),
        el(Heading, ["Intro"], { rank: 1 }),
        el(Heading, ["Background"], { rank: 2 }),
        el(Heading, ["Conclusion"], { rank: 1 })
      ])
    );
    expect(out).toContain(
      '<ul><li><a href="#intro">Intro</a>' +
        '<ul><li><a href="#background">Background</a></li></ul></li>' +
        '<li><a href="#conclusion">Conclusion</a></li></ul>'
    );
  });

  test("depth prop caps the ranks shown", () => {
    const out = doc(
      frag([
        el(Toc, [], { depth: 1 }),
        el(Heading, ["Intro"], { rank: 1 }),
        el(Heading, ["Background"], { rank: 2 }),
        el(Heading, ["Conclusion"], { rank: 1 })
      ])
    );
    expect(out).toContain(
      '<ul><li><a href="#intro">Intro</a></li>' +
        '<li><a href="#conclusion">Conclusion</a></li></ul>'
    );
    expect(out).not.toContain("#background");
  });

  test("empty document → renders nothing", () => {
    expect(doc(frag([el(Toc, [], {})]))).toBe("");
  });

  test("numbered headings show their section number in the TOC", () => {
    secset({ numberDepth: 1 });
    const out = doc(
      frag([el(Toc, [], {}), el(Heading, ["Intro"], { rank: 1 })])
    );
    expect(out).toContain('<a href="#intro">1 Intro</a>');
  });
});

// =============================================================================================
// Label / Ref
// =============================================================================================

describe("Label / Ref", () => {
  test("forward @Ref (before the labeled section) resolves to the preceding heading", () => {
    const out = doc(
      frag([
        el("p", ["See ", el(Ref, [], { id: "sec:intro" }), "."]),
        el(Heading, ["Introduction"], { rank: 1 }),
        el(Label, [], { id: "sec:intro" }),
        el("p", ["Body text."])
      ])
    );
    expect(out).toContain(
      '<p>See <a href="#introduction">Introduction</a>.</p>'
    );
  });

  test("@Ref to a numbered heading links with the section number", () => {
    secset({ numberDepth: 1 });
    const out = doc(
      frag([
        el("p", ["See ", el(Ref, [], { id: "s" }), "."]),
        el(Heading, ["Intro"], { rank: 1 }),
        el(Label, [], { id: "s" })
      ])
    );
    expect(out).toContain('<a href="#intro">1</a>');
  });

  test("@Label ignores children; the id prop is the key", () => {
    // children present but ignored — resolution is by the `id` prop alone
    const out = doc(
      frag([
        el("p", ["See ", el(Ref, [], { id: "k" }), "."]),
        el(Heading, ["Intro"], { rank: 1 }),
        el(Label, ["ignored body"], { id: "k" })
      ])
    );
    expect(out).toContain('<a href="#intro">Intro</a>');
  });

  test("empty/missing @Label id is a pointed error", () => {
    expect(() => doc(frag([el(Label, [], {})]))).toThrow(/@Label: missing id/);
    expect(() => doc(frag([el(Label, [], { id: "" })]))).toThrow(
      /@Label: missing id/
    );
  });

  test("empty/missing @Ref id is a pointed error", () => {
    expect(() => doc(frag([el("p", [el(Ref, [], {})])]))).toThrow(
      /@Ref: missing id/
    );
  });

  test("missing @Label is a pointed error naming the key", () => {
    const tree = frag([
      el("p", [el(Ref, [], { id: "nope" })]),
      el(Heading, ["X"], { rank: 1 })
    ]);
    expect(() => doc(tree)).toThrow(/no @Label found for key "nope"/);
  });

  test("duplicate @Label is a pointed error naming the key", () => {
    const tree = frag([
      el(Heading, ["X"], { rank: 1 }),
      el(Label, [], { id: "k" }),
      el(Label, [], { id: "k" }),
      el("p", [el(Ref, [], { id: "k" })])
    ]);
    expect(() => doc(tree)).toThrow(/duplicate @Label for key "k"/);
  });
});

// =============================================================================================
// Footnotes
// =============================================================================================

describe("Footnotes", () => {
  test("footnotes from a .map() loop number by tree order + auto-append at doc end", () => {
    const items = ["A", "B", "C"];
    const tree = Fragment(
      items.map((x, i) =>
        Fragment({ key: i }, el("p", [x, el(Footnote, [`note ${x}`], {})]))
      )
    );
    expect(doc(tree)).toBe(
      '<p>A<sup class="nota-fnref"><a id="fnref-1" href="#fn-1">1</a></sup></p>' +
        '<p>B<sup class="nota-fnref"><a id="fnref-2" href="#fn-2">2</a></sup></p>' +
        '<p>C<sup class="nota-fnref"><a id="fnref-3" href="#fn-3">3</a></sup></p>' +
        '<section class="nota-footnotes"><ol>' +
        '<li id="fn-1"><div class="nota-fn-content"><p>note A <a href="#fnref-1" class="nota-fnbacklink">↩</a></p></div></li>' +
        '<li id="fn-2"><div class="nota-fn-content"><p>note B <a href="#fnref-2" class="nota-fnbacklink">↩</a></p></div></li>' +
        '<li id="fn-3"><div class="nota-fn-content"><p>note C <a href="#fnref-3" class="nota-fnbacklink">↩</a></p></div></li>' +
        "</ol></section>"
    );
  });

  test("explicit @Footnotes places the list there and suppresses the trailer", () => {
    const out = doc(
      frag([
        el("p", ["x", el(Footnote, ["n"], {})]),
        el(Footnotes, [], {}),
        el("p", ["after"])
      ])
    );
    expect(out).toBe(
      '<p>x<sup class="nota-fnref"><a id="fnref-1" href="#fn-1">1</a></sup></p>' +
        '<section class="nota-footnotes"><ol>' +
        '<li id="fn-1"><div class="nota-fn-content"><p>n <a href="#fnref-1" class="nota-fnbacklink">↩</a></p></div></li>' +
        "</ol></section>" +
        "<p>after</p>"
    );
    // exactly one list (no duplicate at the end)
    expect(out.match(/nota-footnotes/g)).toHaveLength(1);
  });

  test("no footnotes → no list", () => {
    expect(doc(frag([el("p", ["just text"])]))).toBe("<p>just text</p>");
  });

  test("a site-registered FootnotesList override reaches the auto-append trailer", () => {
    registerComponents({
      FootnotesList: (_p: CompProps) => h("div", { class: "custom-fn" }, ["FN"])
    });
    const out = doc(frag([el("p", ["x", el(Footnote, ["n"], {})])]));
    // the trailer resolved the FootnotesList *slot* to the override (a flow <div>, so its inline
    // child is paragraph-wrapped) instead of the shipped default section
    expect(out).toContain('<div class="custom-fn"><p>FN</p></div>');
    expect(out).not.toContain("nota-footnotes");
  });
});

// =============================================================================================
// Labeled footnotes — @FootnoteMark / @FootnoteText, Markdown semantics
// =============================================================================================

describe("Labeled footnotes", () => {
  test("repeated @FootnoteMark for one label share a number + one list entry (first ref backlinks)", () => {
    const out = doc(
      frag([
        el("p", [
          "a",
          el(FootnoteMark, [], { label: "x" }),
          " b",
          el(FootnoteMark, [], { label: "x" })
        ]),
        el(FootnoteText, ["the note"], { label: "x" })
      ])
    );
    // the FIRST reference carries fnref-1; the second links to #fn-1 with no id
    expect(out).toContain(
      '<p>a<sup class="nota-fnref"><a id="fnref-1" href="#fn-1">1</a></sup>' +
        ' b<sup class="nota-fnref"><a href="#fn-1">1</a></sup></p>'
    );
    // exactly one list entry, backlinking the first reference
    expect(out).toContain(
      '<section class="nota-footnotes"><ol>' +
        '<li id="fn-1"><div class="nota-fn-content"><p>the note <a href="#fnref-1" class="nota-fnbacklink">↩</a></p></div></li>' +
        "</ol></section>"
    );
    expect(out.match(/<li id="fn-/g)).toHaveLength(1);
  });

  test("anonymous @Footnote + labeled @FootnoteMark interleave, numbered by reference order", () => {
    const out = doc(
      frag([
        el("p", [
          el(Footnote, ["anon one"], {}), // → 1
          el(FootnoteMark, [], { label: "x" }), // → 2 (first ref to x)
          el(Footnote, ["anon two"], {}), // → 3
          el(FootnoteMark, [], { label: "x" }) // → 2 (shared)
        ]),
        el(FootnoteText, ["labeled x"], { label: "x" })
      ])
    );
    expect(out).toContain(
      '<p><sup class="nota-fnref"><a id="fnref-1" href="#fn-1">1</a></sup>' +
        '<sup class="nota-fnref"><a id="fnref-2" href="#fn-2">2</a></sup>' +
        '<sup class="nota-fnref"><a id="fnref-3" href="#fn-3">3</a></sup>' +
        '<sup class="nota-fnref"><a href="#fn-2">2</a></sup></p>'
    );
    expect(out).toContain(
      '<section class="nota-footnotes"><ol>' +
        '<li id="fn-1"><div class="nota-fn-content"><p>anon one <a href="#fnref-1" class="nota-fnbacklink">↩</a></p></div></li>' +
        '<li id="fn-2"><div class="nota-fn-content"><p>labeled x <a href="#fnref-2" class="nota-fnbacklink">↩</a></p></div></li>' +
        '<li id="fn-3"><div class="nota-fn-content"><p>anon two <a href="#fnref-3" class="nota-fnbacklink">↩</a></p></div></li>' +
        "</ol></section>"
    );
  });

  test("a @FootnoteText definition may precede its @FootnoteMark reference", () => {
    const out = doc(
      frag([
        el(FootnoteText, ["defined first"], { label: "x" }),
        el("p", ["ref", el(FootnoteMark, [], { label: "x" })])
      ])
    );
    expect(out).toContain(
      '<p>ref<sup class="nota-fnref"><a id="fnref-1" href="#fn-1">1</a></sup></p>'
    );
    expect(out).toContain(
      '<li id="fn-1"><div class="nota-fn-content"><p>defined first <a href="#fnref-1" class="nota-fnbacklink">↩</a></p></div></li>'
    );
  });

  test("a referenced label with no @FootnoteText is a pointed error naming the label", () => {
    const tree = frag([
      el("p", ["x", el(FootnoteMark, [], { label: "ghost" })])
    ]);
    expect(() => doc(tree)).toThrow(
      /no @FootnoteText definition for footnote "ghost"/
    );
  });

  test("a duplicate @FootnoteText for one label is a pointed error naming the label", () => {
    const tree = frag([
      el("p", ["x", el(FootnoteMark, [], { label: "d" })]),
      el(FootnoteText, ["one"], { label: "d" }),
      el(FootnoteText, ["two"], { label: "d" })
    ]);
    expect(() => doc(tree)).toThrow(/duplicate definition for footnote "d"/);
  });

  test("an unreferenced @FootnoteText is dropped silently (absent from the list)", () => {
    const out = doc(
      frag([
        el("p", ["x", el(FootnoteMark, [], { label: "used" })]),
        el(FootnoteText, ["used note"], { label: "used" }),
        el(FootnoteText, ["orphan note"], { label: "unused" })
      ])
    );
    expect(out).toContain(
      '<section class="nota-footnotes"><ol>' +
        '<li id="fn-1"><div class="nota-fn-content"><p>used note <a href="#fnref-1" class="nota-fnbacklink">↩</a></p></div></li>' +
        "</ol></section>"
    );
    expect(out).not.toContain("orphan");
    expect(out.match(/<li id="fn-/g)).toHaveLength(1);
  });

  test("empty/missing label is a pointed error for @FootnoteMark and @FootnoteText", () => {
    expect(() => doc(frag([el("p", [el(FootnoteMark, [], {})])]))).toThrow(
      /@FootnoteMark: missing label/
    );
    expect(() => doc(frag([el(FootnoteText, ["body"], {})]))).toThrow(
      /@FootnoteText: missing label/
    );
  });

  test("labeled footnotes referenced inside a .map() loop number by tree order", () => {
    const items = ["a", "b"];
    const tree = Fragment(
      Fragment(
        items.map((L, i) =>
          Fragment({ key: i }, el("p", [L, el(FootnoteMark, [], { label: L })]))
        )
      ),
      el(FootnoteText, ["note a"], { label: "a" }),
      el(FootnoteText, ["note b"], { label: "b" })
    );
    const out = doc(tree);
    expect(out).toContain(
      '<p>a<sup class="nota-fnref"><a id="fnref-1" href="#fn-1">1</a></sup></p>' +
        '<p>b<sup class="nota-fnref"><a id="fnref-2" href="#fn-2">2</a></sup></p>'
    );
    expect(out).toContain(
      '<section class="nota-footnotes"><ol>' +
        '<li id="fn-1"><div class="nota-fn-content"><p>note a <a href="#fnref-1" class="nota-fnbacklink">↩</a></p></div></li>' +
        '<li id="fn-2"><div class="nota-fn-content"><p>note b <a href="#fnref-2" class="nota-fnbacklink">↩</a></p></div></li>' +
        "</ol></section>"
    );
  });

  test("explicit @Footnotes placement renders the labeled list and suppresses the trailer", () => {
    const out = doc(
      frag([
        el("p", ["x", el(FootnoteMark, [], { label: "x" })]),
        el(FootnoteText, ["the note"], { label: "x" }),
        el(Footnotes, [], {}),
        el("p", ["after"])
      ])
    );
    expect(out).toBe(
      '<p>x<sup class="nota-fnref"><a id="fnref-1" href="#fn-1">1</a></sup></p>' +
        '<section class="nota-footnotes"><ol>' +
        '<li id="fn-1"><div class="nota-fn-content"><p>the note <a href="#fnref-1" class="nota-fnbacklink">↩</a></p></div></li>' +
        "</ol></section>" +
        "<p>after</p>"
    );
    expect(out.match(/nota-footnotes/g)).toHaveLength(1);
  });

  test("a multi-paragraph @FootnoteText body renders TWO <p>s in the entry (flow content)", () => {
    // Will's repro: a `[^n1]:` definition whose body contains a blank line renders as two
    // paragraphs. The reader emits the paragraph-break marker (adjacent "\n","\n") inside the
    // colon body; FootnotesList wraps the entry in a `div` flow container, so `groupParas` turns the
    // break into a real <p> split, with the backlink joining the FINAL paragraph run.
    const out = doc(
      frag([
        el("p", ["Body", el(FootnoteMark, [], { label: "n1" })]),
        el(
          FootnoteText,
          ["The first paragraph.", "\n", "\n", "And a second paragraph?"],
          { label: "n1" }
        )
      ])
    );
    expect(out).toContain(
      '<li id="fn-1"><div class="nota-fn-content">' +
        "<p>The first paragraph.</p>" +
        "<p>And a second paragraph? " +
        '<a href="#fnref-1" class="nota-fnbacklink">↩</a></p>' +
        "</div></li>"
    );
    // exactly two paragraphs in the entry
    expect(
      out.match(/<li id="fn-1">.*?<\/li>/)?.[0].match(/<p>/g)
    ).toHaveLength(2);
  });
});

// =============================================================================================
// Cite / Bibliography
// =============================================================================================

describe("Cite / Bibliography", () => {
  const SRC = {
    knuth84: { author: "Knuth", title: "TeX", year: "1984" },
    lamport86: { author: "Lamport", title: "LaTeX", year: "1986" }
  };

  test("numeric style: labels by first-citation order; bibliography in label order", () => {
    bibset({ src: SRC });
    const out = doc(
      frag([
        el("p", [
          "See ",
          el(Cite, ["knuth84"], {}),
          " and ",
          el(Cite, ["lamport86"], {}),
          "."
        ]),
        el(Bibliography, [], {})
      ])
    );
    expect(out).toContain(
      '<p>See <a href="#bib-knuth84" class="nota-cite">[1]</a> and ' +
        '<a href="#bib-lamport86" class="nota-cite">[2]</a>.</p>'
    );
    expect(out).toContain(
      '<ol class="nota-bibliography">' +
        '<li id="bib-knuth84">Knuth. TeX. 1984.</li>' +
        '<li id="bib-lamport86">Lamport. LaTeX. 1986.</li></ol>'
    );
  });

  test("alpha style: labels by (author, title); citation labels match the list order", () => {
    bibset({ src: SRC, style: "alpha" });
    const out = doc(
      frag([
        el("p", [el(Cite, ["lamport86"], {}), " ", el(Cite, ["knuth84"], {})]),
        el(Bibliography, [], {})
      ])
    );
    // Knuth sorts before Lamport → knuth84 = 1, lamport86 = 2 (regardless of citation order)
    expect(out).toContain('<a href="#bib-lamport86" class="nota-cite">[2]</a>');
    expect(out).toContain('<a href="#bib-knuth84" class="nota-cite">[1]</a>');
    expect(out).toContain(
      '<ol class="nota-bibliography">' +
        '<li id="bib-knuth84">Knuth. TeX. 1984.</li>' +
        '<li id="bib-lamport86">Lamport. LaTeX. 1986.</li></ol>'
    );
  });

  test("multi-key @Cite{a, b} renders bracketed links", () => {
    bibset({ src: SRC });
    const out = doc(frag([el("p", [el(Cite, ["knuth84, lamport86"], {})])]));
    expect(out).toContain(
      '<p>[<a href="#bib-knuth84" class="nota-cite">1</a>, ' +
        '<a href="#bib-lamport86" class="nota-cite">2</a>]</p>'
    );
  });

  test("a cited key missing from the source is a pointed error naming the key", () => {
    bibset({ src: { a: { author: "A" } } });
    const tree = frag([el("p", [el(Cite, ["missing"], {})])]);
    expect(() => doc(tree)).toThrow(/no bibliography entry for key "missing"/);
  });

  test("a @Cite inside a @Footnote indexes and resolves (normChildren)", () => {
    bibset({ src: { k: { author: "K", title: "T", year: "2020" } } });
    const out = doc(
      frag([
        el("p", ["x", el(Footnote, ["see ", el(Cite, ["k"], {})], {})]),
        el(Bibliography, [], {})
      ])
    );
    // the cite label renders inside the footnote list item…
    expect(out).toContain(
      '<li id="fn-1"><div class="nota-fn-content"><p>see <a href="#bib-k" class="nota-cite">[1]</a> ' +
        '<a href="#fnref-1" class="nota-fnbacklink">↩</a></p></div></li>'
    );
    // …and the cited entry appears in the bibliography
    expect(out).toContain('<li id="bib-k">K. T. 2020.</li>');
  });
});

// =============================================================================================
// counters (the generic doc-state helper)
// =============================================================================================

describe("counters", () => {
  test("1-based count per kind in document order", () => {
    const d = indexDoc(
      normalize(frag([mark("fig"), mark("fig"), mark("sec"), mark("fig")]))
    );
    const figs = d.all("fig");
    expect(figs.map(e => counters(d, "fig").get(e))).toEqual([1, 2, 3]);
  });

  test("resetOn restarts the count after each resetOn-kind mark", () => {
    const d = indexDoc(
      normalize(frag([mark("fig"), mark("fig"), mark("sec"), mark("fig")]))
    );
    const figs = d.all("fig");
    const cr = counters(d, "fig", { resetOn: "sec" });
    expect(figs.map(e => cr.get(e))).toEqual([1, 2, 1]);
  });
});

// =============================================================================================
// island boundary children
// =============================================================================================

describe("constructs inside a component boundary's static children", () => {
  test("marks in island children are indexed (never the body)", () => {
    const Aside = blockComponent((c: CompProps) => c.children, "Aside");
    const tree = frag([el(Aside, [el(Heading, ["Nested"], { rank: 2 })])]);
    const ix = indexDoc(normalize(tree));
    expect(ix.all("heading").length).toBe(1);
  });
});
