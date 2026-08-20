/**
 * The prelude over the two-pass SSG driver: headings + numbering + slug dedup, the forward Toc,
 * Label/Ref binding, notes (labeled + anonymous, list + backlinks), Cite/Bibliography,
 * definitions (anchors + bank), Tex (KaTeX MathML), CodeBlock/CodeInline (sync shiki), and the
 * pointed-error paths.
 */
import { NotaDoc, renderDocument, useDocState } from "@nota-lang/core";
import type { LanguageRegistration, ThemeRegistrationAny } from "shiki/core";
import javascript from "shiki/langs/javascript.mjs";
import rust from "shiki/langs/rust.mjs";
import { beforeEach, describe, expect, test, vi } from "vitest";
import {
  BASE_THEME_NAMES,
  Bibliography,
  bibset,
  Caption,
  Cite,
  CodeBlock,
  CodeInline,
  config,
  Def,
  DefBank,
  FACT_KINDS,
  Figure,
  Heading,
  headingIds,
  headingNumbers,
  Label,
  loadedLangNames,
  lstset,
  mathset,
  Note,
  Notes,
  NotesList,
  Ref,
  resetCodeWarningsForTest,
  resetConfigForTest,
  Smallcaps,
  Subfigure,
  secset,
  Tex,
  Title,
  Toc,
  texRef
} from "../src/lib";

beforeEach(() => {
  resetConfigForTest();
  resetCodeWarningsForTest();
  // Grammars are opt-in (see src/langs.ts). Registering outside a document session sets the
  // baseline every session clones — the "site setup module" path — so the highlighting tests
  // below read as they did when `javascript` was preloaded.
  lstset({ langs: [javascript] });
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
    // Title is not a heading anchor.
    expect(html).toContain('class="nota-title"');
    const anchors = state
      .filter(entry => entry.kind === FACT_KINDS.anchor)
      .map(entry => entry.fact);
    expect(anchors).toHaveLength(3);
    expect(anchors.every(anchor => anchor.kind === "heading")).toBe(true);
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

  test("reference metadata in a heading is omitted from its slug and Toc text", () => {
    const Doc = () => (
      <NotaDoc>
        <Toc />
        <Heading>
          {"Results"}
          <Note>{"caveat"}</Note>
        </Heading>
      </NotaDoc>
    );
    const html = clean(renderDocument(Doc).html);
    // The note mark renders in the heading…
    expect(html).toMatch(/<h1 id="results"[^>]*>[\s\S]*nota-noteref/);
    // …but titleTextOf skips `nota-noteref`, so neither the slug nor the Toc entry
    // absorbs the note number.
    expect(html).not.toContain('id="results-1"');
    const toc = /<nav class="nota-toc">([\s\S]*?)<\/nav>/.exec(html)?.[1] ?? "";
    expect(toc).toContain("Results");
    expect(toc).not.toMatch(/Results\s*1/);
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
    expect(
      headingIds([
        { rank: 1, title: "X" },
        { rank: 1, title: "Authored", explicitId: "x" }
      ])
    ).toEqual(["x-2", "x"]);
    expect(() =>
      headingIds([
        { rank: 1, title: "A", explicitId: "x" },
        { rank: 1, title: "B", explicitId: "x" }
      ])
    ).toThrow(/duplicate heading anchors for id "x"/);
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

describe("label / ref", () => {
  test("label binding follows registration order", () => {
    const Doc = () => (
      <NotaDoc>
        <Heading>One</Heading>
        <Label id="here" />
        <Ref id="here" />
      </NotaDoc>
    );
    expect(clean(renderDocument(Doc).html)).toMatch(
      /<a href="#one"[^>]*class="nota-ref"[^>]*>One<\/a>/
    );
  });

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
    expect(() => renderDocument(Doc)).toThrow(/no anchor for id "ghost"/);
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
    expect(() => renderDocument(Doc)).toThrow(/duplicate label anchors/);
  });
});

describe("notes", () => {
  test("labeled + anonymous numbering, shared labels, the list, backlinks", () => {
    const Doc = () => (
      <NotaDoc>
        {"First"}
        <Ref id="a" />
        {" then"}
        <Note>{"inline note"}</Note>
        {" and again"}
        <Ref id="a" />
        {".\n\n"}
        <Note id="a">{"the labeled body"}</Note>
      </NotaDoc>
    );
    const html = clean(renderDocument(Doc).html);
    // Distinct-label first-appearance numbering: a=1, anonymous=2; the repeat shares 1.
    expect(html).toMatch(/<a id="noteref-1" href="#note-1"[^>]*>1<\/a>/);
    expect(html).toMatch(/<a id="noteref-2" href="#note-2"[^>]*>2<\/a>/);
    // The repeated reference has no id (only the first backlinks).
    expect(html.match(/id="noteref-1"/g)).toHaveLength(1);
    expect(html.match(/href="#note-1"/g)).toHaveLength(2);
    // The auto-appended list: entries in number order with backlinks.
    const list = /<section class="nota-notes"[^>]*>([\s\S]*)<\/section>/.exec(
      html
    );
    expect(list).toBeTruthy();
    expect(list?.[1]).toContain('id="note-1"');
    expect(list?.[1]).toContain("the labeled body");
    expect(list?.[1]).toContain("inline note");
    expect(list?.[1]).toMatch(/<a href="#noteref-1" class="nota-notebacklink"/);
  });

  test("no notes → no list; explicit placement suppresses the trailer", () => {
    const None = () => <NotaDoc>{"clean"}</NotaDoc>;
    expect(renderDocument(None).html).not.toContain("nota-notes");

    const Placed = () => (
      <NotaDoc>
        <Note>{"n"}</Note>
        <Notes />
        {"After the placed list."}
      </NotaDoc>
    );
    const html = clean(renderDocument(Placed).html);
    // Exactly one list (placed), not two (trailer suppressed).
    expect(html.match(/nota-notes/g)).toHaveLength(1);
    expect(html.indexOf("nota-notes")).toBeLessThan(
      html.indexOf("After the placed")
    );
  });

  test("a paragraph break in a note body decodes into two paragraphs", () => {
    const Doc = () => (
      <NotaDoc>
        {"Text"}
        <Ref id="p" />
        <Note id="p">{"first fn para.\n\nsecond fn para."}</Note>
      </NotaDoc>
    );
    const html = clean(renderDocument(Doc).html);
    const list = /<section class="nota-notes"[^>]*>([\s\S]*)<\/section>/.exec(
      html
    );
    expect(list).toBeTruthy();
    // Flow decoding via Reforest: two nota-para inside the entry, backlink in the last.
    expect(list?.[1]?.match(/<p class="nota-para">/g)).toHaveLength(2);
    expect(list?.[1]).toMatch(
      /<p class="nota-para">second fn para\.[\s\S]*?nota-notebacklink/
    );
  });

  test("an unreferenced @Note[id] definition is dropped silently", () => {
    const Doc = () => (
      <NotaDoc>
        {"Body"}
        <Note>{"used note"}</Note>
        <Note id="ghost">{"never shown"}</Note>
      </NotaDoc>
    );
    const html = clean(renderDocument(Doc).html);
    const list = /<section class="nota-notes"[^>]*>([\s\S]*)<\/section>/.exec(
      html
    );
    expect(list?.[1]?.match(/<li /g)).toHaveLength(1);
    expect(html).not.toContain("never shown");
  });

  test("a standalone NotesList renders in place without suppressing the trailer", () => {
    const Doc = () => (
      <NotaDoc>
        <Note>{"one"}</Note>
        <NotesList />
        <Note>{"two"}</Note>
      </NotaDoc>
    );
    const html = clean(renderDocument(Doc).html);
    const lists = [
      ...html.matchAll(
        /<section class="nota-notes"[^>]*>([\s\S]*?)<\/section>/g
      )
    ];
    // Unlike @Notes, NotesList sets no placement flag: the trailer still appends.
    expect(lists).toHaveLength(2);
    // The placed list sees the notes accumulated so far; the trailer sees all.
    expect(lists[0][1].match(/<li /g)).toHaveLength(1);
    expect(lists[1][1].match(/<li /g)).toHaveLength(2);
  });

  test("a referenced label with no definition is a pointed error", () => {
    const Doc = () => (
      <NotaDoc>
        <Ref id="missing" />
      </NotaDoc>
    );
    expect(() => renderDocument(Doc)).toThrow(/no anchor for id "missing"/);
  });

  test("duplicate definitions for one label are a pointed error", () => {
    const Doc = () => (
      <NotaDoc>
        <Ref id="d" />
        <Note id="d">{"one"}</Note>
        <Note id="d">{"two"}</Note>
      </NotaDoc>
    );
    expect(() => renderDocument(Doc)).toThrow(/duplicate note anchors/);
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
    expect(html).toMatch(/<a[^>]*href="#bib-pollen"[^>]*>\[1\]<\/a>/);
    expect(html).toMatch(
      /\[<a[^>]*href="#bib-knuth84"[^>]*>2<\/a>, <a[^>]*href="#bib-pollen"[^>]*>1<\/a>\]/
    );
    // The first citing site of each key carries the citeref backlink id…
    expect(html).toMatch(/<a id="citeref-1"[^>]*href="#bib-pollen"/);
    expect(html).toMatch(/<a id="citeref-2"[^>]*href="#bib-knuth84"/);
    expect(html.match(/id="citeref-1"/g)).toHaveLength(1);
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
    // …and each entry backlinks to it.
    expect(bib?.[1]).toMatch(
      /<a href="#citeref-1" class="nota-citebacklink">↩<\/a>/
    );
    expect(bib?.[1]).toMatch(
      /<a href="#citeref-2" class="nota-citebacklink">↩<\/a>/
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
    expect(html).toMatch(/<a[^>]*href="#bib-zeta"[^>]*>\[2\]<\/a>/);
    expect(html).toMatch(/<a[^>]*href="#bib-alpha"[^>]*>\[1\]<\/a>/);
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

describe("unified references (&id across kinds)", () => {
  test("a ref reaches a heading directly: forward slug + explicit id, numbered and not", () => {
    const Doc = () => (
      <NotaDoc>
        {"See "}
        <Ref id="details" />
        {" and "}
        <Ref id="intro">{"the intro"}</Ref>
        {".\n\n"}
        <Heading rank={1}>Details</Heading>
        <Heading rank={1} id="intro">
          {"Custom Title"}
        </Heading>
      </NotaDoc>
    );
    const html = clean(renderDocument(Doc).html);
    // Slug-resolved (weak, unnumbered → title text); explicit-id-resolved with authored text.
    expect(html).toMatch(
      /<a href="#details"[^>]*class="nota-ref"[^>]*>Details<\/a>/
    );
    expect(html).toMatch(/<a href="#intro"[^>]*>the intro<\/a>/);
  });

  test("a numbered heading ref shows the section number", () => {
    const Doc = () => {
      secset({ numberDepth: 2 });
      return (
        <NotaDoc>
          <Heading rank={1}>Alpha</Heading>
          <Heading rank={2}>Beta</Heading>
          {"see "}
          <Ref id="beta" />
        </NotaDoc>
      );
    };
    const html = clean(renderDocument(Doc).html);
    expect(html).toMatch(/<a href="#beta"[^>]*>1\.1<\/a>/);
  });

  test("a strong anchor silently shadows a colliding heading slug", () => {
    const Doc = () => (
      <NotaDoc>
        <Heading rank={1}>Nota</Heading>
        <Def id="nota" Label={() => "the language"}>
          {"Nota"}
        </Def>
        {"see "}
        <Ref id="nota" />
      </NotaDoc>
    );
    const html = clean(renderDocument(Doc).html);
    // The definition wins; no duplicate error (derived names must not explode documents).
    expect(html).toMatch(
      /<a href="#def-nota"[^>]*data-nota-def="nota"[^>]*>the language<\/a>/
    );
  });

  test("two strong anchors with one id are a pointed cross-kind error", () => {
    const Doc = () => (
      <NotaDoc>
        <Heading rank={1}>H</Heading>
        <Label id="x" />
        <Def id="x">{"body"}</Def>
      </NotaDoc>
    );
    expect(() => renderDocument(Doc)).toThrow(
      /duplicate anchor id "x" \(a label and a def\)/
    );
  });

  test("note definitions are referenced with &id: shared numbers, list, no in-place render", () => {
    const Doc = () => (
      <NotaDoc>
        {"First"}
        <Ref id="x" />
        {" then"}
        <Note>{"anon note"}</Note>
        {" again"}
        <Ref id="x" />
        {".\n\n"}
        <Note id="x">{"labeled body"}</Note>
      </NotaDoc>
    );
    const html = clean(renderDocument(Doc).html);
    // First-use order: x=1, anon=2; the repeat shares 1; only the first carries the backlink id.
    expect(html).toMatch(/<a id="noteref-1" href="#note-1"[^>]*>1<\/a>/);
    expect(html).toMatch(/<a id="noteref-2" href="#note-2"[^>]*>2<\/a>/);
    expect(html.match(/href="#note-1"/g)).toHaveLength(2);
    expect(html.match(/id="noteref-1"/g)).toHaveLength(1);
    const list = /<section class="nota-notes"[^>]*>([\s\S]*)<\/section>/.exec(
      html
    );
    expect(list?.[1]?.match(/<li /g)).toHaveLength(2);
    expect(list?.[1]).toContain("labeled body");
    expect(list?.[1]).toContain("anon note");
    // The definition renders nothing at its own position (its body only appears in the list).
    expect(html.indexOf("labeled body")).toBeGreaterThan(
      html.indexOf("nota-notes")
    );
  });

  test("a bib key ref is a citation; a page prop renders the locator", () => {
    const Doc = () => {
      bibset({
        src: { knuth84: { author: "Knuth", title: "TeXbook", year: 1984 } }
      });
      return (
        <NotaDoc>
          {"See "}
          <Ref id="knuth84" page="33" />
          {".\n\n"}
          <Bibliography />
        </NotaDoc>
      );
    };
    const html = clean(renderDocument(Doc).html);
    expect(html).toMatch(
      /<a id="citeref-1" href="#bib-knuth84" class="nota-cite"[^>]*>\[1, p\. 33\]<\/a>/
    );
    expect(html).toMatch(/<li id="bib-knuth84"[^>]*>Knuth\. TeXbook\. 1984\./);
  });

  test("an extension kind (figure-style anchor) rides the generic arm: ordinal, href, tooltip", () => {
    const RawFigure = (props: { id: string; bank: string }) => {
      const state = useDocState();
      state.register(FACT_KINDS.anchor, {
        kind: "figure",
        id: props.id,
        href: `#fig-${props.id}`,
        refPrefix: "Figure ",
        tooltip: true,
        bank: () => props.bank
      });
      state.trailer("defs", () => <DefBank />);
      return <figure id={`fig-${props.id}`} />;
    };
    const Doc = () => (
      <NotaDoc>
        <RawFigure id="one" bank="first preview" />
        <RawFigure id="two" bank="second preview" />
        {"as "}
        <Ref id="two" />
        {" shows"}
      </NotaDoc>
    );
    const html = clean(renderDocument(Doc).html);
    expect(html).toMatch(
      /<a href="#fig-two"[^>]*class="nota-ref nota-def-ref"[^>]*data-nota-def="two"[^>]*>Figure 2<\/a>/
    );
    // The generalized bank renders the figure's tooltip entry.
    expect(html).toMatch(/data-def="two"[^>]*>second preview/);
  });
});

describe("figures", () => {
  test("numbering is anchor-order; captions read their enclosing figure", () => {
    const Doc = () => (
      <NotaDoc>
        <Figure id="one">
          <Caption>{"first"}</Caption>
        </Figure>
        <Figure>
          <Caption>{"anonymous still counts"}</Caption>
        </Figure>
        <Figure id="three">
          <Caption>{"third"}</Caption>
        </Figure>
      </NotaDoc>
    );
    const html = clean(renderDocument(Doc).html);
    expect(html).toMatch(/Figure 1: <\/span>first/);
    expect(html).toMatch(/Figure 2: <\/span>anonymous still counts/);
    expect(html).toMatch(/Figure 3: <\/span>third/);
    // An id'd figure is addressable; an anonymous one is not.
    expect(html).toContain('id="fig-one"');
    expect(html).toContain('id="fig-three"');
  });

  test("&id resolves through the generic Ref arm: number, link and tooltip", () => {
    const Doc = () => (
      <NotaDoc>
        <Figure id="plot">
          <Caption>{"the plot"}</Caption>
        </Figure>
        {"see "}
        <Ref id="plot" />
      </NotaDoc>
    );
    const html = clean(renderDocument(Doc).html);
    expect(html).toMatch(
      /<a href="#fig-plot"[^>]*data-nota-def="plot"[^>]*>Figure 1<\/a>/
    );
    expect(html).toContain('data-def="plot" data-target="fig-plot"');
    expect(html.match(/the plot/g)).toHaveLength(1);
  });

  test("the layout style ships exactly once, however many figures", () => {
    const Doc = () => (
      <NotaDoc>
        <Figure>
          <Subfigure>{"a"}</Subfigure>
          <Subfigure>{"b"}</Subfigure>
        </Figure>
        <Figure />
        <Figure />
      </NotaDoc>
    );
    const html = renderDocument(Doc).html;
    expect(html.match(/\.nota-caption-label/g)?.length ?? 0).toBe(1);
    expect(html).toContain('class="nota-subfigure"');
  });

  test("a caption outside any figure renders unlabeled", () => {
    const Doc = () => (
      <NotaDoc>
        <Caption>{"loose"}</Caption>
      </NotaDoc>
    );
    const html = clean(renderDocument(Doc).html);
    expect(html).toContain("loose");
    expect(html).not.toContain("nota-caption-label");
  });

  test("Smallcaps wraps its children", () => {
    const Doc = () => (
      <NotaDoc>
        <Smallcaps>{"acm"}</Smallcaps>
      </NotaDoc>
    );
    expect(clean(renderDocument(Doc).html)).toMatch(
      /<span style="font-variant:\s?small-caps;">acm<\/span>/
    );
  });
});

describe("definitions", () => {
  test("anchor in place, tooltip bank + style in the trailer, def-aware Ref", () => {
    const Doc = () => (
      <NotaDoc>
        <Def id="nota" Label={() => "Nota"} tooltip="A document language.">
          {"Nota"}
        </Def>
        {" is referenced as "}
        <Ref id="nota" />
        {"."}
      </NotaDoc>
    );
    const html = clean(renderDocument(Doc).html);
    expect(html).toMatch(/<span id="def-nota" class="nota-def"/);
    // The def-ref: a REAL anchor (no-JS fallback) wired for the tooltip handler.
    expect(html).toMatch(
      /<a href="#def-nota"[^>]*class="nota-ref nota-def-ref"[^>]*data-nota-def="nota"[^>]*>Nota<\/a>/
    );
    // The bank trailer: hidden, one entry, with the style inline.
    expect(html).toMatch(/<div class="nota-def-tooltips" aria-hidden="true"/);
    expect(html).toMatch(/data-def="nota"[^>]*>A document language\./);
    expect(html).toContain(".nota-def-tooltip-open");
  });

  test("the rendered definition body is the default tooltip target", () => {
    const Doc = () => (
      <NotaDoc>
        <Def id="term" Label={() => "Term"}>
          <strong>{"The full definition."}</strong>
        </Def>
        <Ref id="term" />
      </NotaDoc>
    );
    const html = clean(renderDocument(Doc).html);
    expect(html).toMatch(/<a href="#def-term"[^>]*>Term<\/a>/);
    expect(html).toMatch(/data-def="term"[^>]*data-target="def-term"/);
    expect(html.match(/The full definition\./g)).toHaveLength(1);
  });

  test("definition labels preserve arbitrary components", () => {
    const Label = () => (
      <span class="term-label">
        <em>{"Rich"}</em> {"label"}
      </span>
    );
    const Doc = () => (
      <NotaDoc>
        <Def id="term" Label={Label}>
          {"The definition."}
        </Def>
        <Ref id="term" />
      </NotaDoc>
    );
    const html = clean(renderDocument(Doc).html);
    expect(html).toMatch(
      /<a href="#def-term"[^>]*><span class="term-label"><em>Rich<\/em> label<\/span><\/a>/
    );
  });

  test("rich definition labels resolve across forward references", () => {
    const Label = () => (
      <span class="term-label">
        <em>{"Forward"}</em> {"label"}
      </span>
    );
    const Doc = () => (
      <NotaDoc>
        <Ref id="term" />
        <Def id="term" Label={Label}>
          {"The definition."}
        </Def>
      </NotaDoc>
    );
    const html = clean(renderDocument(Doc).html);
    expect(html).toMatch(
      /<a href="#def-term"[^>]*><span class="term-label"><em>Forward<\/em> label<\/span><\/a>/
    );
  });

  test("the retired lowercase label prop gives a migration error", () => {
    const Doc = () => (
      <NotaDoc>
        <Def id="term" {...{ label: "Term" }}>
          {"The definition."}
        </Def>
      </NotaDoc>
    );
    expect(() => renderDocument(Doc)).toThrow(
      /label was replaced by the component prop Label/
    );
  });

  test("duplicate definitions are a pointed error", () => {
    const Doc = () => (
      <NotaDoc>
        <Def id="d">{"one"}</Def>
        <Def id="d">{"two"}</Def>
      </NotaDoc>
    );
    expect(() => renderDocument(Doc)).toThrow(
      /duplicate def anchors for id "d"/
    );
  });

  test("Def({block}) renders a div flow container instead of a span", () => {
    const Doc = () => (
      <NotaDoc>
        <Def id="blk" block tooltip="tip">
          {"Block body"}
        </Def>
      </NotaDoc>
    );
    const html = clean(renderDocument(Doc).html);
    expect(html).toMatch(/<div id="def-blk" class="nota-def">/);
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

  test("positionality survives the two-pass driver: a Tex before a mid-doc mathset stays MathML", () => {
    // Pass 1 ends in HTML mode; pass 2 must still begin from its fresh session config.
    const Doc = () => (
      <NotaDoc>
        <Tex>{"a"}</Tex>
        {(() => {
          mathset({ output: "html" });
          return null;
        })()}
        <Tex>{"b"}</Tex>
      </NotaDoc>
    );
    const html = clean(renderDocument(Doc).html);
    const first = html.indexOf('class="nota-tex"');
    const second = html.indexOf('class="nota-tex"', first + 1);
    expect(first).toBeGreaterThanOrEqual(0);
    expect(second).toBeGreaterThan(first);
    const before = html.slice(first, second);
    const after = html.slice(second);
    // Before the call: MathML, no KaTeX-HTML spans.
    expect(before).toContain("<math");
    expect(before).not.toContain("katex-html");
    // After the call: KaTeX-HTML spans, no MathML.
    expect(after).toContain("katex-html");
    expect(after).not.toContain("<math");
  });
});

describe("texRef", () => {
  test("under mathset({output:'html'}) the wrapped source carries data-nota-def", () => {
    const Doc = () => {
      mathset({ output: "html" });
      return (
        <NotaDoc>
          <Def id="dep" Label={() => "dep"} tooltip="The dependency relation.">
            {"deps"}
          </Def>
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

  test("lstset positionality survives the two-pass driver: an earlier inline stays plain", () => {
    // Same shape as the mathset two-pass regression: pass 1's language must not leak into pass 2.
    const Doc = () => (
      <NotaDoc>
        <CodeInline>{"f(x)"}</CodeInline>
        {(() => {
          lstset({ lang: "js" });
          return null;
        })()}
        <CodeInline>{"f(x)"}</CodeInline>
      </NotaDoc>
    );
    const html = clean(renderDocument(Doc).html);
    const first = html.indexOf("nota-code-inline");
    const second = html.indexOf("nota-code-inline", first + 1);
    expect(first).toBeGreaterThanOrEqual(0);
    expect(second).toBeGreaterThan(first);
    // Before the call: a plain <code>, no shiki token runs. After: highlighted runs.
    expect(html.slice(first, second)).not.toContain("<span style=");
    expect(html.slice(second)).toContain('<span style="color:');
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

describe("list consistency (single-sourced surfaces)", () => {
  test("the config default theme is a preloaded theme", () => {
    resetConfigForTest();
    expect(BASE_THEME_NAMES).toContain(config().theme);
  });
});

describe("grammars are opt-in", () => {
  test("an unregistered lang falls back to plain and says how to register it", () => {
    resetConfigForTest();
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const Doc = () => (
      <NotaDoc>
        <CodeBlock lang="rust">{"fn main() {}"}</CodeBlock>
      </NotaDoc>
    );
    const html = clean(renderDocument(Doc).html);
    expect(html).not.toMatch(/<pre class="shiki/);
    expect(html).toMatch(
      /<pre class="nota-code-block"[^>]*><code[^>]*>fn main/
    );
    expect(warn.mock.calls.flat().join("\n")).toMatch(
      /shiki\/langs\/rust\.mjs/
    );
    warn.mockRestore();
  });

  test("nothing is preloaded: a fresh config knows no grammar", () => {
    resetConfigForTest();
    expect(loadedLangNames()).toEqual([]);
  });

  test("lstset({langs}) is what makes a grammar available", () => {
    resetConfigForTest();
    const Doc = () => (
      <NotaDoc>
        {(() => {
          lstset({ langs: [rust] });
          return null;
        })()}
        <CodeBlock lang="rust">{"fn main() {}"}</CodeBlock>
      </NotaDoc>
    );
    expect(clean(renderDocument(Doc).html)).toMatch(/<pre class="shiki/);
  });

  test("registering two grammars makes exactly those available", () => {
    resetConfigForTest();
    lstset({ langs: [rust, javascript] });
    const loaded = loadedLangNames();
    expect(loaded).toContain("rust");
    expect(loaded).toContain("javascript");
    expect(loaded).not.toContain("python");
  });
});
