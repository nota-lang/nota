/**
 * The server half (ssr project — JSX compiled with generate:"ssr", node conditions): Reforest
 * over SSR chunks, the doc-state store, the two-pass renderDocument driver (forward references,
 * convergence), trailers, and the snapshot embed.
 */
import { type JSX, children as resolveChildren, Show } from "solid-js";
import { renderToString } from "solid-js/web";
import { describe, expect, test } from "vitest";
import {
  Attrs,
  createDocState,
  DOC_STATE_ID,
  DocStateContext,
  docStateScript,
  NotaDoc,
  OlLi,
  Reforest,
  renderDocument,
  textOf,
  UlLi,
  useDocState
} from "../src/lib";
import { Doc } from "./fixtures/doc";

describe("reforest over SSR chunks", () => {
  test("paragraphs, sections, and lists in dead HTML", () => {
    const html = renderToString(() => (
      <Reforest>
        {"one paragraph\n\ntwo paragraph"}
        <h2>Head</h2>
        {"owned text"}
        <UlLi>a</UlLi>
        <UlLi>b</UlLi>
        <OlLi>c</OlLi>
      </Reforest>
    ));
    expect(html).toMatch(/<p[^>]*class="nota-para"[^>]*>one paragraph<\/p>/);
    expect(html).toMatch(/<section[^>]*class="nota-section"/);
    // The section owns the text and the coalesced lists.
    const section = html.slice(html.indexOf("<section"));
    expect(section).toContain("<h2");
    expect(section).toMatch(/<ul[^>]*class="nota-list"/);
    expect(section).toMatch(/<ol[^>]*class="nota-list"/);
    expect(section.match(/<ul /g)).toHaveLength(1);
  });

  test("chunk categorization sees through component boundaries", () => {
    const InlineWidget = () => <em>w</em>;
    const BlockWidget = () => <figure>f</figure>;
    const html = renderToString(() => (
      <Reforest>
        before <InlineWidget /> mid
        <BlockWidget />
        after
      </Reforest>
    ));
    // The inline widget's <em> stays inside the first paragraph; the figure splits it.
    expect(html).toMatch(/<p[^>]*class="nota-para"[^>]*>before .*<em/);
    expect(html).toMatch(/<figure/);
    expect((html.match(/<p /g) ?? []).length).toBe(2);
  });

  test("textOf strips tags and decodes entities from chunks", () => {
    let got = "";
    const Probe = (props: { children?: JSX.Element }) => {
      // Emulate what Heading does: resolve children, extract text.
      const resolved = resolveChildren(() => props.children);
      got = textOf(resolved.toArray());
      return null;
    };
    renderToString(() => (
      <Probe>
        A &amp; B <em>C</em>
      </Probe>
    ));
    expect(got).toBe("A & B C");
  });
});

describe("doc-state store", () => {
  test("register/read live (pos-stamped); seeded reads pin until release", () => {
    const live = createDocState();
    live.register("heading", { id: "a" });
    live.register("label", { key: "l" });
    expect(live.read("heading")).toEqual([{ id: "a", pos: 1 }]);
    expect(live.read("label")).toEqual([{ key: "l", pos: 2 }]); // pos is cross-kind document order

    const seeded = createDocState({ heading: [{ id: "a" }, { id: "b" }] });
    seeded.register("heading", { id: "a" });
    expect(seeded.read("heading")).toHaveLength(2); // seed-pinned
    expect(seeded.live("heading")).toHaveLength(1);
    seeded.release();
    expect(seeded.read("heading")).toHaveLength(1); // live now
  });

  test("snapshot drops function-valued fields", () => {
    const s = createDocState();
    s.register("definition", { key: "k", tooltip: () => "jsx" });
    expect(s.snapshot()).toEqual({ definition: [{ key: "k", pos: 1 }] });
  });

  test("useDocState outside NotaDoc is a pointed error", () => {
    const Bad = () => {
      useDocState();
      return null;
    };
    expect(() => renderToString(() => <Bad />)).toThrow(/inside <NotaDoc>/);
  });
});

describe("renderDocument (two-pass SSG)", () => {
  test("forward references resolve: the Toc above its headings lists them", () => {
    const { html, state } = renderDocument(Doc);
    // The nav precedes the headings in the HTML yet contains their entries.
    const nav = /<nav[^>]*class="toc"[^>]*>(.*?)<\/nav>/.exec(html);
    expect(nav).toBeTruthy();
    expect(nav?.[1]).toContain("Alpha");
    expect(nav?.[1]).toContain("Beta");
    expect(nav?.[1]).not.toContain("Gamma"); // Show-gated heading is unmounted
    expect(html.indexOf("<nav")).toBeLessThan(html.indexOf('id="alpha"'));
    // The snapshot carries the converged facts.
    expect(state.heading?.map(h => h.id)).toEqual(["alpha", "beta"]);
    // Reforested document shell.
    expect(html).toMatch(/^<article[^>]*class="nota-doc"/);
    expect(html).toMatch(/<ul[^>]*class="nota-list"/);
    // The trailer rendered at document end (hydration-marker comments may trail it).
    expect(html).toMatch(/<footer[^>]*class="colophon"[^>]*>fin<\/footer>/);
    expect(html.indexOf("colophon")).toBeGreaterThan(html.indexOf('id="beta"'));
  });

  test("renderId prefixes every hydration key; state is unaffected", () => {
    const plain = renderDocument(Doc);
    const scoped = renderDocument(Doc, { renderId: "i7" });
    const keys = [...scoped.html.matchAll(/data-hk="([^"]*)"/g)].map(m => m[1]);
    expect(keys.length).toBeGreaterThan(0);
    expect(keys.every(k => k.startsWith("i7"))).toBe(true);
    expect(scoped.state).toEqual(plain.state);
  });

  test("a fact derived from reading another fact fails convergence", () => {
    const Echo = () => {
      const state = useDocState();
      // Registers one fact per already-visible heading — pass 2 sees more than pass 1.
      state.register("echo", { n: state.read("heading").length });
      return null;
    };
    const H = () => {
      const state = useDocState();
      state.register("heading", { id: "x" });
      return <h2>x</h2>;
    };
    const Bad = () => (
      <NotaDoc>
        <Echo />
        <H />
      </NotaDoc>
    );
    expect(() => renderDocument(Bad)).toThrow(/did not converge/);
  });

  test("flags are positional (set before read in tree order)", () => {
    const Place = () => {
      const state = useDocState();
      state.flag("footnotes-placed");
      return null;
    };
    const Trailer = () => {
      const state = useDocState();
      state.trailer("footnotes", () => (
        <Show when={!state.hasFlag("footnotes-placed")}>
          <div class="footnotes">list</div>
        </Show>
      ));
      return null;
    };
    const Placed = () => (
      <NotaDoc>
        <Trailer />
        <Place />
      </NotaDoc>
    );
    const Unplaced = () => (
      <NotaDoc>
        <Trailer />
      </NotaDoc>
    );
    expect(renderDocument(Placed).html).not.toContain("footnotes");
    expect(renderDocument(Unplaced).html).toContain("footnotes");
  });
});

describe("docStateScript", () => {
  test("embeds JSON with < escaped", () => {
    const tag = docStateScript({ heading: [{ text: "</script>alert(1)" }] });
    expect(tag).toContain(`id="${DOC_STATE_ID}"`);
    expect(tag).not.toContain("</script>alert");
    const inner = /<script[^>]*>(.*)<\/script>/.exec(tag)?.[1] ?? "";
    expect(JSON.parse(inner)).toEqual({
      heading: [{ text: "</script>alert(1)" }]
    });
  });
});

describe("driver-owned store adoption", () => {
  test("NotaDoc adopts an outer provider store", () => {
    const outer = createDocState();
    const Register = () => {
      useDocState().register("ping", { ok: true });
      return null;
    };
    renderToString(() => (
      <DocStateContext.Provider value={outer}>
        <NotaDoc>
          <Register />
        </NotaDoc>
      </DocStateContext.Provider>
    ));
    expect(outer.live("ping")).toEqual([{ ok: true, pos: 1 }]);
  });

  test("a bare NotaDoc is self-sufficient", () => {
    const Register = () => {
      useDocState().register("ping", { ok: true });
      return null;
    };
    expect(() =>
      renderToString(() => (
        <NotaDoc>
          <Register />
        </NotaDoc>
      ))
    ).not.toThrow();
  });
});

describe("attrs markers over SSR chunks (notation.md §Attrs)", () => {
  test("a marker decorates the paragraph it sits in and is stripped", () => {
    const html = renderToString(() => (
      <Reforest>
        {"styled text "}
        <Attrs class="note" data-x="1" />
        {"\n\nplain"}
      </Reforest>
    ));
    expect(html).toMatch(/class="nota-para note\s*"/);
    expect(html).toContain('data-x="1"');
    expect(html).not.toContain("data-nota-attrs");
    // The second paragraph is untouched.
    expect(html).toMatch(/<p[^>]*class="nota-para"[^>]*>plain<\/p>/);
  });

  test("a lone marker attaches to the preceding paragraph", () => {
    const html = renderToString(() => (
      <Reforest>
        {"first para"}
        {"\n\n"}
        <Attrs class="x" />
        {"\n\n"}
        {"second"}
      </Reforest>
    ));
    expect(html).toMatch(/class="nota-para x\s*"[^>]*>first para<\/p>/);
    expect(html).toContain("second</p>");
  });
});

describe("smart punctuation over SSR chunks (Pollen rules at the decode stage)", () => {
  test("quotes, dashes, and ellipses smarten in prose; code interiors stay raw", () => {
    const html = renderToString(() => (
      <Reforest>
        {'He said "yes" -- it\'s 5...'}
        <code>{'"raw" -- ...'}</code>
      </Reforest>
    ));
    expect(html).toContain("He said “yes”–it’s 5…");
    // Solid's SSR leaves `"` unescaped in text content — the code interior stays raw.
    expect(html).toContain('"raw" -- ...');
  });

  test("quote context crosses inline-element boundaries (Pollen's flatten)", () => {
    const html = renderToString(() => (
      <Reforest>
        {"do '"}
        <em>{"not'"}</em>
      </Reforest>
    ));
    expect(html).toContain("do ‘");
    expect(html).toContain("not’");
  });

  test("smart={false} and the store setting disable the pass", () => {
    const off = renderToString(() => (
      <Reforest smart={false}>{'"x" -- y...'}</Reforest>
    ));
    expect(off).toContain('"x" -- y...');

    const viaStore = renderToString(() => (
      <DocStateContext.Provider value={createDocState(undefined, { smart: false })}>
        <Reforest>{'"x" -- y...'}</Reforest>
      </DocStateContext.Provider>
    ));
    expect(viaStore).toContain('"x" -- y...');
  });

  test("renderDocument threads the smart setting through both passes", () => {
    const Doc2 = () => <NotaDoc>{'"quoted" -- dashed'}</NotaDoc>;
    const on = renderDocument(Doc2);
    expect(on.html).toContain("“quoted”–dashed");
    const off = renderDocument(Doc2, { smart: false });
    expect(off.html).toContain('"quoted" -- dashed');
  });

  test("a paragraph break survives the dash rule (horizontal whitespace only)", () => {
    const html = renderToString(() => <Reforest>{"a --\n\nb"}</Reforest>);
    // Two paragraphs — the en dash must not eat the blank line.
    expect(html).toMatch(/<p[^>]*>a\s*–<\/p>/);
    expect(html).toMatch(/<p[^>]*>b<\/p>/);
  });
});
