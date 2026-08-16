/**
 * The prelude over the two-pass SSG driver: headings + numbering + slug dedup, the forward Toc,
 * Label/Ref binding, footnotes (labeled + anonymous, list + backlinks), Cite/Bibliography,
 * definitions (anchors + bank), Tex (KaTeX MathML), CodeBlock/CodeInline (sync shiki), and the
 * pointed-error paths.
 */
import { NotaDoc, renderDocument } from "@nota-lang/solid";
import { beforeEach, describe, expect, test } from "vitest";
import {
  Bibliography,
  bibset,
  Cite,
  CodeBlock,
  CodeInline,
  Definition,
  Footnote,
  FootnoteMark,
  Footnotes,
  FootnoteText,
  Heading,
  Label,
  lstset,
  Ref,
  resetCodeWarningsForTest,
  resetConfigForTest,
  secset,
  Tex,
  Title,
  Toc
} from "../src/lib";

beforeEach(() => {
  resetConfigForTest();
  resetCodeWarningsForTest();
});

// Hydration keys and insertion-marker comments are claim-time bookkeeping; strip them so
// assertions read the document structure.
const clean = (html: string) =>
  html.replace(/\s*data-hk="[^"]*"/g, "").replace(/<!--\/?!?\$?-->/g, "");

describe("headings + numbering + toc", () => {
  const Doc = () => {
    secset({ numberDepth: 2 });
    return (
      <NotaDoc>
        <Title>The Document</Title>
        <Toc />
        <Heading rank={1}>Intro</Heading>
        {"Intro text."}
        <Heading rank={2}>Details</Heading>
        {"Detail text."}
        <Heading rank={1}>Intro</Heading>
        {"Same title again (slug dedups)."}
      </NotaDoc>
    );
  };

  test("numbers, ids, and the forward Toc resolve", () => {
    const { html: rawHtml, state } = renderDocument(Doc);
    const html = clean(rawHtml);
    // Title is not a heading fact.
    expect(html).toContain('class="nota-title"');
    expect(state.heading).toHaveLength(3);
    // Numbering: 1 / 1.1 / 2 with secnum spans.
    expect(html).toMatch(/<span class="nota-secnum"[^>]*>1<\/span>/);
    expect(html).toMatch(/<span class="nota-secnum"[^>]*>1\.1<\/span>/);
    expect(html).toMatch(/<span class="nota-secnum"[^>]*>2<\/span>/);
    // Slug dedup: intro, details, intro-2.
    expect(html).toContain('id="intro"');
    expect(html).toContain('id="details"');
    expect(html).toContain('id="intro-2"');
    // The Toc (above the headings) lists all three with numbers.
    const nav = /<nav class="nota-toc"[^>]*>([\s\S]*?)<\/nav>/.exec(html);
    expect(nav).toBeTruthy();
    expect(nav?.[1]).toContain('href="#intro"');
    expect(nav?.[1]).toContain("1.1 Details");
    expect(nav?.[1]).toContain('href="#intro-2"');
    // Nesting: Details sits in a sublist inside Intro's item.
    expect(nav?.[1]).toMatch(
      /<li[^>]*>[\s\S]*?Intro[\s\S]*?<ul[^>]*>[\s\S]*?Details/
    );
    // Reforest sectioned the document.
    expect(html).toMatch(/<section class="nota-section"/);
  });

  test("a heading-less document renders no Toc", () => {
    const Empty = () => (
      <NotaDoc>
        <Toc />
        {"Just prose."}
      </NotaDoc>
    );
    const html = clean(renderDocument(Empty).html);
    expect(html).not.toContain("nota-toc");
  });
});

describe("label / ref", () => {
  test("a ref binds to the nearest preceding heading and shows its number", () => {
    const Doc = () => {
      secset({ numberDepth: 2 });
      return (
        <NotaDoc>
          {"See "}
          <Ref id="here" />
          {" for details.\n\n"}
          <Heading rank={1}>One</Heading>
          <Heading rank={2}>Two</Heading>
          <Label id="here" />
          {"Labeled text."}
        </NotaDoc>
      );
    };
    const html = clean(renderDocument(Doc).html);
    expect(html).toMatch(/<a href="#two"[^>]*class="nota-ref"[^>]*>1\.1<\/a>/);
  });

  test("unnumbered target falls back to its title text; authored children win", () => {
    const Doc = () => (
      <NotaDoc>
        <Ref id="l1" />
        {" and "}
        <Ref id="l1">{"custom"}</Ref>
        <Heading rank={1}>Alpha</Heading>
        <Label id="l1" />
      </NotaDoc>
    );
    const html = clean(renderDocument(Doc).html);
    expect(html).toMatch(/<a href="#alpha"[^>]*>Alpha<\/a>/);
    expect(html).toMatch(/<a href="#alpha"[^>]*>custom<\/a>/);
  });

  test("a ref to nothing is a pointed error (seeded pass)", () => {
    const Doc = () => (
      <NotaDoc>
        <Ref id="ghost" />
      </NotaDoc>
    );
    expect(() => renderDocument(Doc)).toThrow(/no @Definition or @Label/);
  });

  test("duplicate labels are a pointed error", () => {
    const Doc = () => (
      <NotaDoc>
        <Heading rank={1}>H</Heading>
        <Label id="x" />
        <Label id="x" />
        <Ref id="x" />
      </NotaDoc>
    );
    expect(() => renderDocument(Doc)).toThrow(/duplicate @Label/);
  });
});

describe("footnotes", () => {
  test("labeled + anonymous numbering, shared labels, the list, backlinks", () => {
    const Doc = () => (
      <NotaDoc>
        {"First"}
        <FootnoteMark label="a" />
        {" then"}
        <Footnote>{"inline note"}</Footnote>
        {" and again"}
        <FootnoteMark label="a" />
        {".\n\n"}
        <FootnoteText label="a">{"the labeled body"}</FootnoteText>
      </NotaDoc>
    );
    const html = clean(renderDocument(Doc).html);
    // Distinct-label first-appearance numbering: a=1, anonymous=2; the repeat shares 1.
    expect(html).toMatch(/<a id="fnref-1" href="#fn-1"[^>]*>1<\/a>/);
    expect(html).toMatch(/<a id="fnref-2" href="#fn-2"[^>]*>2<\/a>/);
    // The repeated reference has no id (only the first backlinks).
    expect(html.match(/id="fnref-1"/g)).toHaveLength(1);
    expect(html.match(/href="#fn-1"/g)).toHaveLength(2);
    // The auto-appended list: entries in number order with backlinks.
    const list =
      /<section class="nota-footnotes"[^>]*>([\s\S]*)<\/section>/.exec(html);
    expect(list).toBeTruthy();
    expect(list?.[1]).toContain('id="fn-1"');
    expect(list?.[1]).toContain("the labeled body");
    expect(list?.[1]).toContain("inline note");
    expect(list?.[1]).toMatch(/<a href="#fnref-1" class="nota-fnbacklink"/);
  });

  test("no footnotes → no list; explicit placement suppresses the trailer", () => {
    const None = () => <NotaDoc>{"clean"}</NotaDoc>;
    expect(renderDocument(None).html).not.toContain("nota-footnotes");

    const Placed = () => (
      <NotaDoc>
        <Footnote>{"n"}</Footnote>
        <Footnotes />
        {"After the placed list."}
      </NotaDoc>
    );
    const html = clean(renderDocument(Placed).html);
    // Exactly one list (placed), not two (trailer suppressed).
    expect(html.match(/nota-footnotes/g)).toHaveLength(1);
    expect(html.indexOf("nota-footnotes")).toBeLessThan(
      html.indexOf("After the placed")
    );
  });

  test("a referenced label with no definition is a pointed error", () => {
    const Doc = () => (
      <NotaDoc>
        <FootnoteMark label="missing" />
      </NotaDoc>
    );
    expect(() => renderDocument(Doc)).toThrow(/no @FootnoteText definition/);
  });

  test("duplicate definitions for one label are a pointed error", () => {
    const Doc = () => (
      <NotaDoc>
        <FootnoteMark label="d" />
        <FootnoteText label="d">{"one"}</FootnoteText>
        <FootnoteText label="d">{"two"}</FootnoteText>
      </NotaDoc>
    );
    expect(() => renderDocument(Doc)).toThrow(/duplicate definition/);
  });
});

describe("cite / bibliography", () => {
  test("numeric labels by first citation; the bibliography lists cited entries in order", () => {
    const Doc = () => {
      bibset({
        src: {
          knuth84: {
            author: "Knuth",
            title: "Literate Programming",
            year: 1984
          },
          pollen: { author: "Butterick", title: "Pollen", url: "https://p" }
        }
      });
      return (
        <NotaDoc>
          {"As shown in "}
          <Cite>{"pollen"}</Cite>
          {" and "}
          <Cite>{"knuth84, pollen"}</Cite>
          {".\n\n"}
          <Bibliography />
        </NotaDoc>
      );
    };
    const html = clean(renderDocument(Doc).html);
    // pollen cited first → [1]; knuth84 → [2]; the multi-key renders [2, 1].
    expect(html).toMatch(/<a href="#bib-pollen"[^>]*>\[1\]<\/a>/);
    expect(html).toMatch(
      /\[<a href="#bib-knuth84"[^>]*>2<\/a>, <a href="#bib-pollen"[^>]*>1<\/a>\]/
    );
    const bib = /<ol class="nota-bibliography"[^>]*>([\s\S]*?)<\/ol>/.exec(
      html
    );
    expect(bib).toBeTruthy();
    expect(bib?.[1]).toContain('id="bib-pollen"');
    expect(bib?.[1]).toContain("Knuth. Literate Programming. 1984.");
    expect(bib?.[1]).toMatch(/<a href="https:\/\/p"/);
    expect(bib?.[1]?.indexOf("bib-pollen")).toBeLessThan(
      bib?.[1]?.indexOf("bib-knuth84") ?? -1
    );
  });

  test("an unknown cite key is a pointed error", () => {
    const Doc = () => (
      <NotaDoc>
        <Cite>{"nope"}</Cite>
      </NotaDoc>
    );
    expect(() => renderDocument(Doc)).toThrow(/no bibliography entry/);
  });
});

describe("definitions", () => {
  test("anchor in place, tooltip bank + style in the trailer, def-aware Ref", () => {
    const Doc = () => (
      <NotaDoc>
        <Definition id="nota" label="Nota" tooltip="A document language.">
          {"Nota"}
        </Definition>
        {" is referenced as "}
        <Ref id="nota" />
        {"."}
      </NotaDoc>
    );
    const html = clean(renderDocument(Doc).html);
    expect(html).toMatch(/<span id="def-nota" class="nota-definition"/);
    // The def-ref: a REAL anchor (no-JS fallback) wired for the tooltip handler.
    expect(html).toMatch(
      /<a href="#def-nota"[^>]*class="nota-ref nota-def-ref"[^>]*data-nota-def="nota"[^>]*>Nota<\/a>/
    );
    // The bank trailer: hidden, one entry, with the style inline.
    expect(html).toMatch(/<div class="nota-def-tooltips" aria-hidden="true"/);
    expect(html).toMatch(/data-def="nota"[^>]*>A document language\./);
    expect(html).toContain(".nota-def-tooltip-open");
  });

  test("duplicate definitions are a pointed error", () => {
    const Doc = () => (
      <NotaDoc>
        <Definition id="d">{"one"}</Definition>
        <Definition id="d">{"two"}</Definition>
      </NotaDoc>
    );
    expect(() => renderDocument(Doc)).toThrow(
      /duplicate definition for id "d"/
    );
  });
});

describe("tex + code", () => {
  test("Tex renders MathML inline and display; scalars splice", () => {
    const Doc = () => (
      <NotaDoc>
        {"Inline "}
        <Tex>
          {"a_"}
          {3}
        </Tex>
        {" and display:"}
        <Tex display>{"x^2"}</Tex>
      </NotaDoc>
    );
    const html = clean(renderDocument(Doc).html);
    expect(html).toMatch(/<span class="nota-tex"[^>]*><span class="katex"/);
    expect(html).toContain("<math");
    expect(html).toMatch(/<div class="nota-tex-display"/);
    // The display div is a block: not paragraph-wrapped.
    expect(html).not.toMatch(/<p[^>]*>[^<]*<div class="nota-tex-display"/);
  });

  test("a markup part inside math is a pointed error", () => {
    const Doc = () => (
      <NotaDoc>
        <Tex>
          {"x "}
          <em>{"y"}</em>
        </Tex>
      </NotaDoc>
    );
    expect(() => renderDocument(Doc)).toThrow(/markup part inside math/);
  });

  test("CodeBlock highlights via shiki; unknown lang falls back to plain", () => {
    const Doc = () => (
      <NotaDoc>
        <CodeBlock lang="js">{"let x = 1;"}</CodeBlock>
        <CodeBlock lang="nolang">{"plain text"}</CodeBlock>
        {"Inline "}
        <CodeInline>{"f(x)"}</CodeInline>
        {"."}
      </NotaDoc>
    );
    const html = clean(renderDocument(Doc).html);
    expect(html).toMatch(/<div class="nota-code-block"[^>]*><pre class="shiki/);
    expect(html).toMatch(
      /<pre class="nota-code-block"[^>]*><code[^>]*>plain text/
    );
    expect(html).toMatch(/<code class="nota-code-inline"[^>]*>f\(x\)/);
  });

  test("lstset({lang}) is positional: a later block highlights, config resets per test", () => {
    const Doc = () => (
      <NotaDoc>
        {(() => {
          lstset({ lang: "js" });
          return null;
        })()}
        <CodeBlock>{"let y = 2;"}</CodeBlock>
      </NotaDoc>
    );
    const html = clean(renderDocument(Doc).html);
    expect(html).toMatch(/<pre class="shiki/);
  });
});
