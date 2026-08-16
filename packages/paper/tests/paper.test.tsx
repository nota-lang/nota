/**
 * Paper constructs through the two-pass SSG driver: front-matter layout, store-numbered
 * figures + captions, `&id` references resolving to "Figure N" with the figure body in the
 * tooltip bank, the Language/BNF DSL (texRef-wired handles; the Bnf table as anchored
 * definitions), and inference rules.
 */
import { Ref, resetConfigForTest } from "@nota-lang/prelude";
import { NotaDoc, renderDocument } from "@nota-lang/solid";
import { beforeEach, describe, expect, test } from "vitest";
import {
  Abstract,
  Author,
  Authors,
  Caption,
  Figure,
  IR,
  inferRule,
  language,
  Name,
  Row,
  Smallcaps,
  Subfigure,
  Title,
  Wrap
} from "../src/lib";

beforeEach(() => {
  resetConfigForTest();
});

const clean = (h: string) =>
  h.replace(/\s*data-hk="[^"]*"/g, "").replace(/<!--\/?!?\$?-->/g, "");

describe("scaffold", () => {
  test("front matter + layout classes; abstract reforests into paragraphs", () => {
    const Doc = () => (
      <NotaDoc>
        <Title>{"On Documents"}</Title>
        <Authors>
          <Author>
            <Name>{"Will"}</Name>
          </Author>
        </Authors>
        <Abstract>{"First para.\n\nSecond para."}</Abstract>
        <Wrap align="right">
          <Smallcaps>{"sc"}</Smallcaps>
        </Wrap>
        <Row gap={2}>{"row"}</Row>
      </NotaDoc>
    );
    const html = clean(renderDocument(Doc).html);
    expect(html).toContain('class="nota-title"');
    expect(html).toMatch(
      /<div class="nota-authors"><div class="nota-author"><div class="nota-author-name">Will<\/div>/
    );
    // The abstract's interior reforests: the document's only paragraphs are its two.
    expect(html).toContain('<div class="nota-abstract-title">Abstract</div>');
    expect((html.match(/<p class="nota-para">/g) ?? []).length).toBe(2);
    expect(html).toContain('class="nota-wrap nota-wrap-right"');
    expect(html).toMatch(
      /<span style="font-variant: ?small-caps;?">sc<\/span>/
    );
    expect(html).toMatch(/<div class="nota-row" style="gap: ?2em;?">/);
  });

  test("figures number by registration order; captions bind to the nearest preceding figure", () => {
    const Doc = () => (
      <NotaDoc>
        {"See "}
        <Ref id="pipeline" />
        {" below.\n\n"}
        <Figure>
          <Subfigure>{"unlabeled"}</Subfigure>
          <Caption>{"first caption"}</Caption>
        </Figure>
        <Figure id="pipeline">
          {"the pipeline diagram"}
          <Caption>{"second caption"}</Caption>
        </Figure>
      </NotaDoc>
    );
    const { html: rawHtml } = renderDocument(Doc);
    const html = clean(rawHtml);
    // Captions: Figure 1 / Figure 2 by document order.
    expect(html).toMatch(
      /<span class="nota-caption-label">Figure 1: <\/span>first caption/
    );
    expect(html).toMatch(
      /<span class="nota-caption-label">Figure 2: <\/span>second caption/
    );
    // The labeled figure gets its anchor id.
    expect(html).toContain('<figure id="fig-pipeline" class="nota-figure"');
    // The forward &pipeline reference renders "Figure 2" as a def-ref anchor.
    expect(html).toMatch(
      /<a href="#def-pipeline"[^>]*data-nota-def="pipeline"[^>]*>Figure 2<\/a>/
    );
    // The tooltip bank holds the figure body.
    expect(html).toMatch(
      /data-def="pipeline"[^>]*><div class="nota-figure-tooltip">/
    );
  });

  test("a caption with no preceding figure renders unlabeled", () => {
    const Doc = () => (
      <NotaDoc>
        <Caption>{"stray"}</Caption>
      </NotaDoc>
    );
    const html = clean(renderDocument(Doc).html);
    expect(html).toContain(">stray</figcaption>");
    expect(html).not.toContain("nota-caption-label");
  });
});

describe("language / Bnf", () => {
  const L = language({
    sessty: {
      name: "Session type",
      meta: "\\sigma",
      forms: {
        send: {
          tex: (t, s) => `!${t}.${s}`,
          sig: l => [l.ty, l.sessty],
          desc: "send"
        }
      }
    },
    ty: { name: "Type", meta: "\\tau" }
  });

  test("handles: kinds are texRef-wrapped metas; forms fill and wrap", () => {
    expect(L.sessty).toBe("\\htmlData{nota-def=gram-sessty}{\\sigma}");
    expect(L.send("\\tau", "\\sigma")).toBe(
      "\\htmlData{nota-def=gram-sessty}{!\\tau.\\sigma}"
    );
  });

  test("Bnf renders anchored definitions with the rows in body and tooltip bank", () => {
    const Doc = () => (
      <NotaDoc>
        <L.Bnf />
      </NotaDoc>
    );
    const html = clean(renderDocument(Doc).html);
    // One anchored definition per kind.
    expect(html).toContain('id="def-gram-sessty"');
    expect(html).toContain('id="def-gram-ty"');
    // The display array rendered through KaTeX (plain handles inside — no \htmlData).
    expect(html).toContain("nota-tex-display");
    expect(html).not.toContain("nota-def=gram-sessty}{!");
    // The bank carries the table for tooltip pops.
    expect(html).toMatch(/data-def="gram-sessty"/);
  });

  test("name collisions are pointed errors", () => {
    expect(() =>
      language({
        a: { name: "A", meta: "a", forms: { b: { tex: () => "x" } } },
        b: { name: "B", meta: "b" }
      })
    ).toThrow(/collides/);
  });
});

describe("inference rules", () => {
  test("inferRule TeX shapes", () => {
    expect(inferRule({ conclusion: "c" })).toBe("\\dfrac{\\,}{c}");
    expect(inferRule({ premises: ["a", "b"], conclusion: "c" })).toBe(
      "\\dfrac{a \\quad b}{c}"
    );
    expect(
      inferRule({
        premises: ["a", "b", "c"],
        conclusion: "d",
        premisesPerRow: 2
      })
    ).toBe("\\dfrac{\\begin{array}{c}a \\quad b \\\\ c\\end{array}}{d}");
    expect(inferRule({ conclusion: "c", name: "T-Var" })).toBe(
      "{\\dfrac{\\,}{c}}\\;\\textsf{\\small T-Var}"
    );
  });

  test("IR renders display math; a missing bot is a pointed error", () => {
    const Doc = () => (
      <NotaDoc>
        <IR top="\Gamma \vdash e : \tau" bot="\Gamma \vdash e" name="T-App" />
      </NotaDoc>
    );
    const html = clean(renderDocument(Doc).html);
    expect(html).toContain("nota-tex-display");
    const Bad = () => (
      <NotaDoc>
        <IR />
      </NotaDoc>
    );
    expect(() => renderDocument(Bad)).toThrow(/missing bot/);
  });
});
