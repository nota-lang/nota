/**
 * The prelude over the two-pass SSG driver: headings + numbering + slug dedup, the forward Toc,
 * Label/Ref binding, footnotes (labeled + anonymous, list + backlinks), Cite/Bibliography,
 * definitions (anchors + bank), Tex (KaTeX MathML), CodeBlock/CodeInline (sync shiki), and the
 * pointed-error paths.
 */
import { NotaDoc, renderDocument } from "@nota-lang/solid";
import type { LanguageRegistration, ThemeRegistrationAny } from "shiki/core";
import { beforeEach, describe, expect, test, vi } from "vitest";
import {
  Bibliography,
  bibset,
  Cite,
  CodeBlock,
  CodeInline,
  config,
  counters,
  Definition,
  Footnote,
  FootnoteMark,
  Footnotes,
  FootnotesList,
  FootnoteText,
  Heading,
  headingIds,
  headingNumbers,
  Label,
  lstset,
  mathset,
  Ref,
  resetCodeWarningsForTest,
  resetConfigForTest,
  secset,
  Tex,
  Title,
  Toc,
  texRef
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

describe("heading mechanics", () => {
  test("out-of-range ranks clamp to 1–6; no rank defaults to 1", () => {
    const Doc = () => (
      <NotaDoc>
        <Heading rank={99}>Deep</Heading>
        <Heading rank={0}>Shallow</Heading>
        <Heading>Plain</Heading>
      </NotaDoc>
    );
    const html = clean(renderDocument(Doc).html);
    expect(html).toContain('<h6 id="deep"');
    expect(html).toContain('<h1 id="shallow"');
    expect(html).toContain('<h1 id="plain"');
  });

  test("extra props (a hoisted attrs group) spread onto the h-tag", () => {
    const Doc = () => (
      <NotaDoc>
        <Heading rank={2} class="fancy" data-x="1">
          Styled
        </Heading>
      </NotaDoc>
    );
    const html = clean(renderDocument(Doc).html);
    expect(html).toMatch(/<h2[^>]*class="fancy\s*"[^>]*data-x="1"[^>]*>Styled/);
  });

  test("headingIds/headingNumbers are pure: skipped ranks collapse, slugs dedup", () => {
    const facts = [
      { rank: 1, title: "A" },
      { rank: 3, title: "B" }
    ];
    // `#` then `###` → 1 then 1.1 (skipped rank collapses).
    expect(headingNumbers(facts, 6)).toEqual(["1", "1.1"]);
    expect(headingNumbers(facts, 1)).toEqual(["1", undefined]);
    expect(headingNumbers(facts, 0)).toEqual([undefined, undefined]);
    expect(
      headingIds([
        { rank: 1, title: "Same" },
        { rank: 1, title: "Same" },
        { rank: 1, title: "!!!", explicitId: "x" },
        { rank: 1, title: "???" }
      ])
    ).toEqual(["same", "same-2", "x", "section"]);
  });

  test("Toc({depth}) caps the ranks shown", () => {
    const Doc = () => (
      <NotaDoc>
        <Toc depth={1} />
        <Heading rank={1}>One</Heading>
        <Heading rank={2}>Two</Heading>
      </NotaDoc>
    );
    const html = clean(renderDocument(Doc).html);
    const nav = /<nav class="nota-toc"[^>]*>([\s\S]*?)<\/nav>/.exec(html);
    expect(nav).toBeTruthy();
    expect(nav?.[1]).toContain('href="#one"');
    expect(nav?.[1]).not.toContain('href="#two"');
  });
});

describe("counters", () => {
  test("counts facts by pos, keyed by pos; a reset fact restarts the count", () => {
    const f = (pos: number) => ({ pos });
    expect([...counters([f(2), f(5), f(9)], [f(4)]).entries()]).toEqual([
      [2, 1],
      [5, 1],
      [9, 2]
    ]);
    // No resets: a plain running count.
    expect([...counters([f(1), f(3)]).entries()]).toEqual([
      [1, 1],
      [3, 2]
    ]);
    expect(counters([]).size).toBe(0);
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

  test("a label with no preceding heading is a pointed error (seeded pass)", () => {
    const Doc = () => (
      <NotaDoc>
        <Label id="early" />
        <Ref id="early" />
      </NotaDoc>
    );
    expect(() => renderDocument(Doc)).toThrow(/no heading precedes/);
  });

  test("a missing Label id is a pointed error", () => {
    const Doc = () => (
      <NotaDoc>
        <Heading rank={1}>H</Heading>
        <Label />
      </NotaDoc>
    );
    expect(() => renderDocument(Doc)).toThrow(/@Label: missing id/);
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

  test("a paragraph break in a footnote body decodes into two paragraphs", () => {
    const Doc = () => (
      <NotaDoc>
        {"Text"}
        <FootnoteMark label="p" />
        <FootnoteText label="p">
          {"first fn para.\n\nsecond fn para."}
        </FootnoteText>
      </NotaDoc>
    );
    const html = clean(renderDocument(Doc).html);
    const list =
      /<section class="nota-footnotes"[^>]*>([\s\S]*)<\/section>/.exec(html);
    expect(list).toBeTruthy();
    // Flow decoding via Reforest: two nota-para inside the entry, backlink in the last.
    expect(list?.[1]?.match(/<p class="nota-para">/g)).toHaveLength(2);
    expect(list?.[1]).toMatch(
      /<p class="nota-para">second fn para\.[\s\S]*?nota-fnbacklink/
    );
  });

  test("an unreferenced FootnoteText is dropped silently", () => {
    const Doc = () => (
      <NotaDoc>
        {"Body"}
        <Footnote>{"used note"}</Footnote>
        <FootnoteText label="ghost">{"never shown"}</FootnoteText>
      </NotaDoc>
    );
    const html = clean(renderDocument(Doc).html);
    const list =
      /<section class="nota-footnotes"[^>]*>([\s\S]*)<\/section>/.exec(html);
    expect(list?.[1]?.match(/<li /g)).toHaveLength(1);
    expect(html).not.toContain("never shown");
  });

  test("a standalone FootnotesList renders in place without suppressing the trailer", () => {
    const Doc = () => (
      <NotaDoc>
        <Footnote>{"one"}</Footnote>
        <FootnotesList />
        <Footnote>{"two"}</Footnote>
      </NotaDoc>
    );
    const html = clean(renderDocument(Doc).html);
    const lists = [
      ...html.matchAll(
        /<section class="nota-footnotes"[^>]*>([\s\S]*?)<\/section>/g
      )
    ];
    // Unlike @Footnotes, FootnotesList sets no placement flag: the trailer still appends.
    expect(lists).toHaveLength(2);
    // The placed list sees the footnotes accumulated so far; the trailer sees all.
    expect(lists[0][1].match(/<li /g)).toHaveLength(1);
    expect(lists[1][1].match(/<li /g)).toHaveLength(2);
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

  test("bibset({style:'alpha'}) labels by (author, title) sort, not citation order", () => {
    const Doc = () => {
      bibset({
        src: {
          zeta: { author: "Zeta", title: "Zed" },
          alpha: { author: "Alpha", title: "Aleph" }
        },
        style: "alpha"
      });
      return (
        <NotaDoc>
          <Cite>{"zeta"}</Cite>
          {" then "}
          <Cite>{"alpha"}</Cite>
          {".\n\n"}
          <Bibliography />
        </NotaDoc>
      );
    };
    const html = clean(renderDocument(Doc).html);
    // zeta cited first but sorts second: [2]; alpha gets [1].
    expect(html).toMatch(/<a href="#bib-zeta"[^>]*>\[2\]<\/a>/);
    expect(html).toMatch(/<a href="#bib-alpha"[^>]*>\[1\]<\/a>/);
    // The bibliography lists in label (sorted) order.
    const bib = /<ol class="nota-bibliography"[^>]*>([\s\S]*?)<\/ol>/.exec(
      html
    );
    expect(bib?.[1]?.indexOf("bib-alpha")).toBeLessThan(
      bib?.[1]?.indexOf("bib-zeta") ?? -1
    );
  });

  test("an empty cite key list is a pointed error", () => {
    const Doc = () => (
      <NotaDoc>
        <Cite>{" , "}</Cite>
      </NotaDoc>
    );
    expect(() => renderDocument(Doc)).toThrow(/@Cite: empty key/);
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

  test("Definition({block}) renders a div flow container instead of a span", () => {
    const Doc = () => (
      <NotaDoc>
        <Definition id="blk" block tooltip="tip">
          {"Block body"}
        </Definition>
      </NotaDoc>
    );
    const html = clean(renderDocument(Doc).html);
    expect(html).toMatch(/<div id="def-blk" class="nota-definition">/);
    expect(html).not.toMatch(/<span id="def-blk"/);
  });
});

describe("mathset", () => {
  test("default output is MathML (no KaTeX CSS needed)", () => {
    const Doc = () => (
      <NotaDoc>
        <Tex>{"x^2"}</Tex>
      </NotaDoc>
    );
    const html = clean(renderDocument(Doc).html);
    expect(html).toContain("<math");
    expect(html).not.toContain("katex-html");
  });

  test("mathset({output:'html'}) switches Tex to KaTeX HTML spans", () => {
    const Doc = () => {
      mathset({ output: "html" });
      return (
        <NotaDoc>
          <Tex>{"x^2"}</Tex>
        </NotaDoc>
      );
    };
    const html = clean(renderDocument(Doc).html);
    expect(html).toContain("katex-html");
    expect(html).not.toContain("<math");
  });

  test("mathset({macros}) feeds KaTeX; a \\gdef never escapes its own Tex", () => {
    const WithMacro = () => {
      mathset({ macros: { "\\R": "\\mathbb{R}" } });
      return (
        <NotaDoc>
          <Tex>{"\\R"}</Tex>
        </NotaDoc>
      );
    };
    // \mathbb{R} → a double-struck R in MathML.
    expect(clean(renderDocument(WithMacro).html)).toContain("double-struck");

    // KaTeX mutates the macros table on \gdef; Tex hands it a per-call copy, so the doc-global
    // table stays config-owned: no leak into a later Tex in the same document…
    const LeakInDoc = () => (
      <NotaDoc>
        <Tex>{"\\gdef\\ans{42}\\ans"}</Tex>
        <Tex>{"\\ans"}</Tex>
      </NotaDoc>
    );
    expect(() => renderDocument(LeakInDoc)).toThrow(
      /Undefined control sequence/
    );

    // …and none across renders.
    const GdefOnly = () => (
      <NotaDoc>
        <Tex>{"\\gdef\\ans{42}\\ans"}</Tex>
      </NotaDoc>
    );
    expect(clean(renderDocument(GdefOnly).html)).toContain("42");
    expect("\\ans" in config().macros).toBe(false);
    const UsesGdef = () => (
      <NotaDoc>
        <Tex>{"\\ans"}</Tex>
      </NotaDoc>
    );
    expect(() => renderDocument(UsesGdef)).toThrow(
      /Undefined control sequence/
    );
  });

  test("mathset is positional: a later Tex renders under the new output mode", () => {
    const Doc = () => (
      <NotaDoc>
        {(() => {
          mathset({ output: "html" });
          return null;
        })()}
        <Tex>{"y"}</Tex>
      </NotaDoc>
    );
    const html = clean(renderDocument(Doc).html);
    expect(html).toContain("katex-html");
  });
});

describe("texRef", () => {
  test("under mathset({output:'html'}) the wrapped source carries data-nota-def", () => {
    const Doc = () => {
      mathset({ output: "html" });
      return (
        <NotaDoc>
          <Definition id="dep" label="dep" tooltip="The dependency relation.">
            {"deps"}
          </Definition>
          {" as "}
          <Tex>{texRef("dep", "\\kappa")}</Tex>
        </NotaDoc>
      );
    };
    const html = clean(renderDocument(Doc).html);
    // The rendered math is wired for the delegated tooltip handler…
    expect(html).toMatch(/<span[^>]*data-nota-def="dep"/);
    // …and the definition anchor it references exists.
    expect(html).toContain('id="def-dep"');
  });

  test("MathML output drops the \\htmlData attribute (math renders un-wired)", () => {
    const Doc = () => (
      <NotaDoc>
        <Tex>{texRef("dep", "\\kappa")}</Tex>
      </NotaDoc>
    );
    const html = clean(renderDocument(Doc).html);
    expect(html).toContain("<math");
    expect(html).not.toContain("data-nota-def");
  });

  test("invalid handle characters are a pointed error", () => {
    for (const bad of ["a,b", "a=b", "a{b", "a}b"]) {
      expect(() => texRef(bad, "x")).toThrow(/may not contain/);
    }
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

  test("armed elements become shiki decorations over their text range", () => {
    const Doc = () => (
      <NotaDoc>
        <CodeBlock lang="js">
          {"let "}
          <span class="hl" data-note="target">
            {"x"}
          </span>
          {" = 1;"}
        </CodeBlock>
      </NotaDoc>
    );
    const html = clean(renderDocument(Doc).html);
    // The whole text tokenized (shiki pre present)…
    expect(html).toMatch(/<pre class="shiki/);
    // …with the armed element as a decoration wrapping its range: tag + props survive, the
    // hydration key does not.
    expect(html).toMatch(
      /<span[^>]*class="hl"[^>]*data-note="target"[^>]*>x<\/span>/
    );
    expect(html).not.toMatch(/class="hl"[^>]*data-hk/);
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

  test("a text-less armed part contributes nothing and warns once (across both passes)", () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const Doc = () => (
      <NotaDoc>
        <CodeBlock lang="js">
          {"let "}
          <span class="hl" />
          {"x = 1;"}
        </CodeBlock>
      </NotaDoc>
    );
    const html = clean(renderDocument(Doc).html);
    expect(html).toMatch(/<pre class="shiki/);
    const armed = warnSpy.mock.calls.filter(([msg]) =>
      String(msg).includes("text-less armed part")
    );
    expect(armed).toHaveLength(1); // warnOnce dedups across the two SSG passes
    warnSpy.mockRestore();
  });

  test("lstset({langs, themes, theme}) registers extensions; a new set rebuilds the highlighter", () => {
    const wibble: LanguageRegistration = {
      name: "wibble",
      scopeName: "source.wibble",
      patterns: [{ match: "\\bzap\\b", name: "keyword.control.wibble" }],
      repository: {}
    };
    const hotpink: ThemeRegistrationAny = {
      name: "hotpink",
      settings: [
        { settings: { foreground: "#111111", background: "#FFFFFF" } },
        { scope: "keyword", settings: { foreground: "#FF1493" } }
      ]
    };
    const DocA = () => {
      lstset({
        langs: [wibble],
        themes: [hotpink],
        theme: "hotpink",
        lang: "wibble"
      });
      return (
        <NotaDoc>
          <CodeBlock>{"zap it"}</CodeBlock>
        </NotaDoc>
      );
    };
    const a = clean(renderDocument(DocA).html);
    expect(a).toMatch(/<pre class="shiki hotpink"/);
    expect(a).toMatch(/<span style="color:#FF1493">zap<\/span>/);

    // A subsequent lstset with a different theme set: the memoized highlighter must rebuild
    // (a stale instance would fail to resolve the new theme).
    const seagreen: ThemeRegistrationAny = {
      name: "seagreen",
      settings: [{ settings: { foreground: "#222222", background: "#EEFFEE" } }]
    };
    const DocB = () => {
      lstset({ themes: [seagreen], theme: "seagreen", lang: "js" });
      return (
        <NotaDoc>
          <CodeBlock>{"let x = 1;"}</CodeBlock>
        </NotaDoc>
      );
    };
    const b = clean(renderDocument(DocB).html);
    expect(b).toMatch(
      /<pre class="shiki seagreen" style="background-color:#EEFFEE/
    );
  });

  test("CodeInline highlights under a doc-global lstset({lang}) — the \\lstinline analogue", () => {
    const Doc = () => {
      lstset({ lang: "js" });
      return (
        <NotaDoc>
          {"Call "}
          <CodeInline>{"let q = f(x);"}</CodeInline>
          {" now."}
        </NotaDoc>
      );
    };
    const html = clean(renderDocument(Doc).html);
    // structure:"inline": span runs directly inside the code host, no nested <pre>.
    expect(html).toMatch(
      /<code class="nota-code-inline"[^>]*><span style="color:/
    );
    expect(html).not.toMatch(/nota-code-inline[^>]*><pre/);
  });
});
