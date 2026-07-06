/**
 * Doc-state — `mark`/`query`, the `DocIndex`, and the `normalize → index → force`
 * decode passes, plus the trailer registry and the guarded seams.
 *
 * Pipeline tests drive the real wired path via `decode(v)` (which at `▸ = false` runs `decodeTree`)
 * and `render(Doc)` (raw-tree fallback); `indexDoc`/`force`/`normalize` are exercised directly for
 * the unit-level assertions. No adapter is set — none of the fixtures island a component (their
 * component nodes are only *indexed*, never serialized), so the SSG path stays adapter-free.
 */

import { afterEach, describe, expect, test } from "vitest";

import {
  blockComponent,
  clearTrailers,
  decode,
  type ElementVNode,
  FRAG,
  Fragment,
  h,
  indexDoc,
  type MarkLeaf,
  mark,
  normalize,
  query,
  registerTrailer,
  render,
  reset,
  serialize,
  struct,
  type VNode,
  withFlag
} from "../src/lib";

// ---------------------------------------------------------------------------------------------
// builders + helpers
// ---------------------------------------------------------------------------------------------

function el(
  tag: ElementVNode["tag"],
  children: VNode[] = [],
  props: Record<string, unknown> = {}
): ElementVNode {
  return { tag, props, children };
}
const frag = (children: VNode[] = []): ElementVNode => el(FRAG, children);

/** `decode` at `▸ = false` returns the decoded HTML string. */
const html = (v: VNode): string => decode(v) as string;

// Global-persistent trailers/registry could leak between tests → reset defensively.
afterEach(() => {
  clearTrailers();
  reset();
});

// =============================================================================================
// index — tree order, per-kind seq, global pos
// =============================================================================================

describe("indexDoc (tree order, seq, pos)", () => {
  test("index uses TREE order, not construction order", () => {
    // Build marks out of order: m2 (later in the tree) is constructed BEFORE m1.
    const m2 = mark("h", { n: 2 });
    const m1 = mark("h", { n: 1 });
    const tree = frag([el("div", [m1]), el("div", [m2])]);
    const ix = indexDoc(tree);
    expect(ix.get(m1).seq).toBe(1);
    expect(ix.get(m1).pos).toBe(1);
    expect(ix.get(m2).seq).toBe(2);
    expect(ix.get(m2).pos).toBe(2);
    expect(ix.all("h").map(e => e.data.n)).toEqual([1, 2]);
  });

  test("pos is a total order across kinds; seq is per-kind", () => {
    const a = mark("fig");
    const b = mark("tbl");
    const c = mark("fig");
    const ix = indexDoc(frag([a, b, c]));
    expect([ix.get(a).pos, ix.get(b).pos, ix.get(c).pos]).toEqual([1, 2, 3]);
    expect([ix.get(a).seq, ix.get(c).seq]).toEqual([1, 2]); // fig: 1,2
    expect(ix.get(b).seq).toBe(1); // tbl: 1
  });

  test("all(unknownKind) is an empty array; get(unindexed) throws pointedly", () => {
    const ix = indexDoc(frag([mark("x")]));
    expect(ix.all("nope")).toEqual([]);
    expect(() => ix.get(mark("stray"))).toThrow(/not in the index/);
  });

  test("data defaults to {}", () => {
    const m = mark("x");
    expect(indexDoc(frag([m])).get(m).data).toEqual({});
  });
});

// =============================================================================================
// index through fragments / templates / boundaries
// =============================================================================================

describe("indexDoc (through the tree shapes decode normalizes)", () => {
  test("marks inside keyed @for Fragments index in order; fragments splice transparently", () => {
    // @for (n of [a,b]) { mark + a list item } — the keyed-@for Fragment shape.
    const marks: MarkLeaf[] = [];
    const tree = Fragment(
      ["a", "b"].map((n, _i) => {
        const m = mark("item", { n });
        marks.push(m);
        return Fragment({ key: _i }, m, h("nota-ul-li", {}, [n]));
      })
    );
    const ix = indexDoc(normalize(tree));
    expect(ix.all("item").map(e => e.data.n)).toEqual(["a", "b"]);
    expect(marks.map(m => ix.get(m).seq)).toEqual([1, 2]);
    // …and the full decode: marks removed, fragments transparent → the sentinels coalesce to ONE <ul>.
    expect(html(tree)).toBe("<ul><li>a</li><li>b</li></ul>");
  });

  test("marks produced by a static template are indexed (normalize precedes index)", () => {
    const Tmpl = () => frag([mark("gen"), h("span", {}, ["x"])]);
    const tree = frag([el(Tmpl)]);
    // Un-normalized, indexDoc would not see the template's mark; normalize exposes it.
    expect(indexDoc(tree).all("gen").length).toBe(0);
    expect(indexDoc(normalize(tree)).all("gen").length).toBe(1);
    // decode removes the mark and keeps the span (flow FRAG wraps the inline run).
    expect(html(tree)).toBe("<p><span>x</span></p>");
  });

  test("marks in a component boundary's static children are indexed (never the body)", () => {
    const Aside = blockComponent(c => c, "Aside");
    const m = mark("note");
    const tree = frag([
      h("p", {}, ["before"]),
      el(Aside, [h("span", {}, [m])])
    ]);
    const ix = indexDoc(normalize(tree));
    expect(ix.all("note").length).toBe(1);
    expect(ix.get(m).kind).toBe("note");
  });

  test("mark()/query() inside a component body (▸ = true) throw (doc-state is static-document-only)", () => {
    expect(() => withFlag(true, () => mark("x"))).toThrow(/static-document/);
    expect(() => withFlag(true, () => query(() => []))).toThrow(
      /static-document/
    );
  });
});

// =============================================================================================
// force — queries resolved against the index, before grouping
// =============================================================================================

describe("force (queries, recursion, new-mark guard)", () => {
  test("a query's nota-ul-li output coalesces with authored sentinels (force before grouping + whitespace bridging)", () => {
    const tree = frag([
      h("nota-ul-li", {}, ["authored"]),
      query(() => [h("nota-ul-li", {}, ["from-query"])])
    ]);
    expect(html(tree)).toBe("<ul><li>authored</li><li>from-query</li></ul>");
  });

  test("a query may return another query (recursive force against the frozen index)", () => {
    const tree = frag([
      query(() => [h("span", {}, ["a"]), query(() => [h("span", {}, ["b"])])])
    ]);
    expect(html(tree)).toBe("<p><span>a</span><span>b</span></p>");
  });

  test("a query returning an already-indexed mark drops it silently (no new-mark error)", () => {
    // `m` is authored in the <p> (so it is indexed); a query re-emits the SAME mark object.
    const m = mark("fn", { content: h("em", {}, ["ftnt"]) });
    const tree = frag([
      el("p", ["body", m]),
      query(doc => doc.all("fn").map(() => m))
    ]);
    expect(() => html(tree)).not.toThrow();
    expect(html(tree)).toBe("<p>body</p>"); // both occurrences of the mark drop
  });

  test("a query introducing a NEW mark is a pointed error (no fixpoint iteration)", () => {
    const tree = frag([query(() => [mark("surprise")])]);
    expect(() => html(tree)).toThrow(/new mark/);
  });

  test("force is a structural identity for a mark/query-free tree", () => {
    const tree = frag([el("p", ["x"]), h("nota-ul-li", {}, ["a"])]);
    const norm = normalize(tree);
    // no marks → the forced tree serializes+structs to the same HTML as struct alone.
    expect(html(tree)).toBe(serialize(struct(norm)));
  });
});

// =============================================================================================
// data.content walk
// =============================================================================================

describe("indexDoc (data.content walk)", () => {
  test("marks inside a parent mark's data.content index under the parent's position", () => {
    const inner = mark("cite", { key: "smith" });
    const parent = mark("fn", {
      content: frag([h("em", {}, ["see "]), inner])
    });
    const after = mark("cite", { key: "jones" });
    const tree = frag([el("p", ["x", parent, " y", after])]);
    const ix = indexDoc(normalize(tree));
    // DFS pos: parent(1) → its content's inner cite(2) → sibling after cite(3).
    expect(ix.get(parent).pos).toBe(1);
    expect(ix.get(inner).pos).toBe(2);
    expect(ix.get(after).pos).toBe(3);
    // per-kind seq: cite inner=1, after=2 (fn parent seq=1).
    expect(ix.get(inner).seq).toBe(1);
    expect(ix.get(after).seq).toBe(2);
    // a query reading all("cite") sees BOTH the content-nested and the sibling cite.
    expect(ix.all("cite").map(e => e.data.key)).toEqual(["smith", "jones"]);
  });

  test("a footnote-style query reads all() including content-nested marks", () => {
    const cite = mark("cite", { key: "x" });
    const note = mark("footnote", { content: frag([cite, "note body"]) });
    const tree = frag([
      el("p", ["prose", note]),
      // a "footnotes" query renders each footnote's content at the doc end
      query(doc =>
        doc.all("footnote").map(e => h("p", { class: "fn" }, [e.data.content]))
      )
    ]);
    // The footnote content (its own cite mark included) forces cleanly: cite drops, body renders.
    expect(html(tree)).toBe('<p>prose</p><p class="fn">note body</p>');
  });
});

// =============================================================================================
// mark removal is grouping-invisible
// =============================================================================================

describe("mark removal is grouping-invisible", () => {
  test("a mark between two list sentinels does not split the list", () => {
    const tree = frag([
      h("nota-ul-li", {}, ["a"]),
      mark("x"),
      h("nota-ul-li", {}, ["b"])
    ]);
    expect(html(tree)).toBe("<ul><li>a</li><li>b</li></ul>");
  });

  test("a lone mark in flow context yields no empty <p>", () => {
    expect(html(frag([mark("x")]))).toBe("");
  });

  test("a mark between two paragraphs does not merge them", () => {
    const tree = frag([el("p", ["one"]), mark("x"), el("p", ["two"])]);
    expect(html(tree)).toBe("<p>one</p><p>two</p>");
  });
});

// =============================================================================================
// trailer registry
// =============================================================================================

describe("trailer registry", () => {
  test("a trailer's children append after the doc content and its queries force", () => {
    // The trailer's children include a query that reads a mark authored in the doc body — proving
    // trailers are appended BEFORE indexing. (`<p>` is block-but-not-flow, so its text is not
    // re-wrapped.)
    const notes = mark("fn", { content: "n1" });
    let called = false;
    const tree = frag([el("p", ["body", notes])]);
    // Register AFTER building the doc — the trailer still forces against the whole index.
    registerTrailer("footnotes", () => {
      called = true;
      return query(doc =>
        doc.all("fn").map(e => h("p", { class: "fn" }, [e.data.content]))
      );
    });
    expect(html(tree)).toBe('<p>body</p><p class="fn">n1</p>');
    expect(called).toBe(true);
  });

  test("re-register replaces the same-named trailer (keeps registration slot)", () => {
    registerTrailer("t", () => h("p", {}, ["first"]));
    registerTrailer("t", () => h("p", {}, ["second"]));
    expect(html(frag([el("p", ["b"])]))).toBe("<p>b</p><p>second</p>");
  });

  test("trailers persist across render() calls (NOT reset per render)", () => {
    registerTrailer("t", () => h("p", {}, ["persist"]));
    const Doc = () => frag([el("p", ["b"])]);
    const first = render(Doc).html;
    const second = render(Doc).html; // render() calls reset(); trailers must survive it
    expect(first).toBe("<p>b</p><p>persist</p>");
    expect(second).toBe(first);
  });

  test("no trailer registered → byte-identical to plain decode (no FRAG wrap)", () => {
    const tree = frag([el("p", ["body"]), h("nota-ul-li", {}, ["x"])]);
    expect(html(tree)).toBe("<p>body</p><ul><li>x</li></ul>");
    // identical to serialize(struct(normalize(...))) with no doc-state passes doing anything.
    expect(html(tree)).toBe(serialize(struct(normalize(tree))));
  });
});

// =============================================================================================
// guarded seams: serialize / struct / Fragment
// =============================================================================================

describe("guarded seams (serialize / struct / Fragment leading-props)", () => {
  test("serialize on a tree with a doc-state leaf throws pointedly", () => {
    expect(() => serialize(el("p", [mark("x")]))).toThrow(/decode pipeline/);
    expect(() => serialize(query(() => []))).toThrow(/decode pipeline/);
  });

  test("struct passes a doc-state leaf through untouched (opaque)", () => {
    const m = mark("x");
    expect(struct(m)).toBe(m);
    const q = query(() => []);
    expect(struct(q)).toBe(q);
    // inside a tight (non-flow) container the leaf survives struct at its position…
    const inner = mark("y");
    const out = struct(el("em", [inner])) as ElementVNode;
    expect(out.children[0]).toBe(inner);
  });

  test("a mark/query as Fragment's first arg is a CHILD, not leading props", () => {
    const m = mark("x");
    const f = Fragment(m, h("span", {}, ["s"])) as ElementVNode;
    expect(f.props).toEqual({});
    expect(f.children[0]).toBe(m);
    const q = query(() => []);
    const g = Fragment(q) as ElementVNode;
    expect(g.props).toEqual({});
    expect(g.children[0]).toBe(q);
  });
});

// =============================================================================================
// render() raw-tree fallback drives the pipeline
// =============================================================================================

describe("render (raw-tree fallback)", () => {
  test("render() decodes a raw-tree Doc containing marks/queries", () => {
    const Doc = () =>
      frag([
        h("nota-ul-li", {}, ["a"]),
        mark("x"),
        query(() => [h("nota-ul-li", {}, ["b"])])
      ]);
    const { html: out, manifest } = render(Doc);
    expect(out).toBe("<ul><li>a</li><li>b</li></ul>");
    expect(manifest).toEqual({});
  });
});
