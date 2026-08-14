/**
 * Paper scaffolding, driven through the real decode pipeline. The figure tests exercise the
 * definition label *query* path: `&id` (the prelude `Ref`) resolves to the figure's definition,
 * whose label is a query computing "Figure N" from `counters(doc, "figure")`.
 */

import { Ref, resetConfigForTest } from "@nota-lang/prelude";
import {
  decode,
  type ElementVNode,
  FRAG,
  reset,
  type VNode
} from "@nota-lang/runtime";
import { afterEach, describe, expect, test } from "vitest";

import {
  Abstract,
  Affiliation,
  Author,
  Authors,
  Caption,
  Center,
  Figure,
  Institution,
  Name,
  Row,
  Smallcaps,
  Subfigure,
  Title,
  Wrap
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

describe("front matter", () => {
  test("Title is a raw, classed h1 (unnumbered, un-TOC'd)", () => {
    const out = doc(frag([el(Title, ["My Paper"], {})]));
    expect(out).toContain('<h1 class="nota-doc-title">My Paper</h1>');
    expect(out).not.toContain("nota-secnum");
  });

  test("Authors / Author / Name / Affiliation / Institution classes", () => {
    const out = doc(
      frag([
        el(Authors, [
          el(Author, [
            el(Name, ["Ada Lovelace"]),
            el(Affiliation, ["Analytical Engines"]),
            el(Institution, ["London"])
          ])
        ])
      ])
    );
    expect(out).toContain('<div class="nota-authors">');
    expect(out).toContain('<div class="nota-author">');
    // a div is a flow container — inline runs paragraph-wrap
    expect(out).toContain(
      '<div class="nota-author-name"><p>Ada Lovelace</p></div>'
    );
    expect(out).toContain(
      '<div class="nota-author-affiliation"><p>Analytical Engines</p></div>'
    );
    expect(out).toContain('<div class="nota-institution"><p>London</p></div>');
  });

  test("Abstract renders its title and flow children as paragraphs", () => {
    const out = doc(
      frag([el(Abstract, ["First paragraph.", "\n", "\n", "Second one."], {})])
    );
    expect(out).toContain('<div class="nota-abstract">');
    expect(out).toContain(
      '<div class="nota-abstract-title"><p>Abstract</p></div>'
    );
    expect(out).toContain("<p>First paragraph.</p>");
    expect(out).toContain("<p>Second one.</p>");
  });
});

describe("layout helpers", () => {
  test("Smallcaps span", () => {
    const out = doc(frag([el("p", [el(Smallcaps, ["Nota"], {})])]));
    expect(out).toContain(
      '<span style="font-variant: small-caps;">Nota</span>'
    );
  });

  test("Wrap aligns left by default and right on request", () => {
    expect(doc(frag([el(Wrap, ["x"], {})]))).toContain(
      'class="nota-wrap nota-wrap-left"'
    );
    expect(doc(frag([el(Wrap, ["x"], { align: "right" })]))).toContain(
      'class="nota-wrap nota-wrap-right"'
    );
  });

  test("Row with an optional gap", () => {
    expect(doc(frag([el(Row, ["x"], {})]))).toContain('<div class="nota-row">');
    expect(doc(frag([el(Row, ["x"], { gap: 2 })]))).toContain(
      '<div class="nota-row" style="gap: 2em;">'
    );
    expect(doc(frag([el(Row, ["x"], { gap: "8px" })]))).toContain(
      '<div class="nota-row" style="gap: 8px;">'
    );
  });

  test("Center + Subfigure classes", () => {
    expect(doc(frag([el(Center, ["x"], {})]))).toContain(
      '<div class="nota-center">'
    );
    expect(doc(frag([el(Subfigure, ["x"], {})]))).toContain(
      '<div class="nota-subfigure">'
    );
  });
});

describe("Figure / Caption", () => {
  test("captions number their nearest preceding figure in document order", () => {
    const out = doc(
      frag([
        el(
          Figure,
          [el("img", [], { src: "a.png" }), el(Caption, ["First"], {})],
          { id: "fig1" }
        ),
        el(
          Figure,
          [el("img", [], { src: "b.png" }), el(Caption, ["Second"], {})],
          { id: "fig2" }
        )
      ])
    );
    expect(out).toContain('<figure id="fig-fig1" class="nota-figure">');
    expect(out).toContain('<figure id="fig-fig2" class="nota-figure">');
    expect(out).toContain(
      '<span class="nota-caption-label">Figure 1: </span>First'
    );
    expect(out).toContain(
      '<span class="nota-caption-label">Figure 2: </span>Second'
    );
  });

  test("&id refs render a def-ref link labeled by the figure-number query", () => {
    const out = doc(
      frag([
        el(Figure, [el(Caption, ["First"], {})], { id: "fig1" }),
        el(Figure, [el(Caption, ["Second"], {})], { id: "fig2" }),
        el("p", [
          "See ",
          el(Ref, [], { id: "fig1" }),
          " and ",
          el(Ref, [], { id: "fig2" }),
          "."
        ])
      ])
    );
    expect(out).toContain(
      '<a href="#def-fig1" class="nota-ref nota-def-ref" data-nota-def="fig1">Figure 1</a>'
    );
    expect(out).toContain(
      '<a href="#def-fig2" class="nota-ref nota-def-ref" data-nota-def="fig2">Figure 2</a>'
    );
    // the definition also feeds the tooltip bank
    expect(out).toContain('class="nota-def-tooltips"');
    expect(out).toContain('data-def="fig1"');
  });

  test("a Figure without an id registers no definition", () => {
    const out = doc(frag([el(Figure, [el(Caption, ["Solo"], {})], {})]));
    expect(out).toContain('<figure class="nota-figure">');
    expect(out).toContain(
      '<span class="nota-caption-label">Figure 1: </span>Solo'
    );
    expect(out).not.toContain("nota-def-tooltips");
  });

  test("a Caption with no preceding figure renders without a label", () => {
    const out = doc(frag([el("figure", [el(Caption, ["Lonely"], {})])]));
    expect(out).toContain('<figcaption class="nota-caption">Lonely');
    expect(out).not.toContain("nota-caption-label");
  });
});
