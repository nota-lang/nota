import { describe, expect, test } from "vitest";

import {
  blockComponent,
  type CompFn,
  type ElementVNode,
  FRAG,
  Fragment,
  flatten,
  groupLists,
  groupParas,
  groupSections,
  h,
  inlineComponent,
  isComp,
  raw,
  struct,
  type VNode,
  withFlag
} from "../src/lib";

// =============================================================================================
// vnode construction helpers (compact builders for hand-written fixture trees)
// =============================================================================================

/** A host/fragment/boundary node with explicit children. */
function el(
  tag: ElementVNode["tag"],
  children: VNode[] = [],
  props: Record<string, unknown> = {}
): ElementVNode {
  return { tag, props, children };
}

const frag = (children: VNode[] = []): ElementVNode => el(FRAG, children);

// Build the two components used across fixtures (their bodies never run under ▸=false).
const Colorized: CompFn = inlineComponent(children => children);
const InlineC: CompFn = inlineComponent(children => children);
const BlockC: CompFn = blockComponent(children => children);

// =============================================================================================
// Static core: h / Fragment / flatten
// =============================================================================================

describe("flatten / h / Fragment", () => {
  test("h builds an inert vnode; props default to {}", () => {
    expect(h("p", null, "Hello")).toEqual({
      tag: "p",
      props: {},
      children: ["Hello"]
    });
    expect(h("a", { href: "/x" }, "go")).toEqual({
      tag: "a",
      props: { href: "/x" },
      children: ["go"]
    });
  });

  test("h does NOT invoke a component tag — it records the boundary", () => {
    let called = false;
    const C = inlineComponent(() => {
      called = true;
      return "boom";
    });
    const node = h(C, {}, "a") as ElementVNode;
    expect(called).toBe(false);
    expect(node.tag).toBe(C);
    expect(node.children).toEqual(["a"]);
  });

  test('flatten: array child spliced one level (the h("nota-ul-li",{},[child]) shape)', () => {
    const child = h("li", {}, "x");
    expect(h("nota-ul-li", {}, [child])).toEqual({
      tag: "nota-ul-li",
      props: {},
      children: [child]
    });
  });

  test("flatten: scalar child (the h(C,{},x) shape)", () => {
    expect(h(Colorized, {}, "a")).toEqual({
      tag: Colorized,
      props: {},
      children: ["a"]
    });
  });

  test("flatten: numbers coerce to text; 0 kept", () => {
    expect(flatten([1, " ", 0, " ", 42])).toEqual(["1", " ", "0", " ", "42"]);
  });

  test("flatten: nullish and booleans dropped (incl. true)", () => {
    expect(flatten([null, "a", undefined, false, "b", true])).toEqual([
      "a",
      "b"
    ]);
  });

  test("flatten: nested arrays flatten fully (.map returning arrays)", () => {
    expect(flatten([["a", ["b", "c"]], "d"])).toEqual(["a", "b", "c", "d"]);
  });

  test("Fragment builds a FRAG node", () => {
    const f = Fragment("one ", h("b", {}, "two"));
    expect(f).toEqual({
      tag: FRAG,
      props: {},
      children: ["one ", { tag: "b", props: {}, children: ["two"] }]
    });
  });

  // ---- Fragment's optional leading props object ----

  test("Fragment({key}, child) carries props.key and the right children", () => {
    const child = h("li", {}, "x");
    const f = Fragment({ key: 0 }, child) as ElementVNode;
    expect(f).toEqual({ tag: FRAG, props: { key: 0 }, children: [child] });
    expect(f.props.key).toBe(0);
  });

  test("Fragment(child1, child2) (no leading props) is children-only, props {}", () => {
    const f = Fragment("a", h("b", {}, "c")) as ElementVNode;
    expect(f).toEqual({
      tag: FRAG,
      props: {},
      children: ["a", { tag: "b", props: {}, children: ["c"] }]
    });
  });

  test("disambiguation: an array first arg is a CHILD, not props (bare Fragment(map(...)))", () => {
    // A keyless `Fragment(xs.map(...))` — the array is spliced one level as children.
    const f = Fragment(["a", "b"].map(x => h("li", {}, x))) as ElementVNode;
    expect(f.props).toEqual({});
    expect(f.children).toEqual([
      { tag: "li", props: {}, children: ["a"] },
      { tag: "li", props: {}, children: ["b"] }
    ]);
  });

  test("disambiguation: a string first arg is a CHILD, not props", () => {
    const f = Fragment("hello") as ElementVNode;
    expect(f.props).toEqual({});
    expect(f.children).toEqual(["hello"]);
  });

  test("disambiguation: a vnode first arg (has `tag`) is a CHILD, not props", () => {
    const v = h("span", {}, "x");
    const f = Fragment(v) as ElementVNode;
    expect(f.props).toEqual({});
    expect(f.children).toEqual([v]);
  });

  test("disambiguation: a RawHtml first arg is a CHILD, not props", () => {
    const slot = raw("<i>x</i>");
    const f = Fragment(slot) as ElementVNode;
    expect(f.props).toEqual({});
    // raw survives flatten as an opaque vnode
    expect(f.children).toEqual([slot]);
  });

  test("Fragment({}) (empty props object) is treated as props, not a child", () => {
    // an empty plain object has no `tag`, is not raw/array → props; children empty.
    const f = Fragment({}) as ElementVNode;
    expect(f.props).toEqual({});
    expect(f.children).toEqual([]);
  });

  test("the @for emit shape `xs.map((x,_i) => Fragment({key:_i}, h('li',{},[x])))`", () => {
    const nodes = ["a", "b"].map((x, _i) =>
      Fragment({ key: _i }, h("li", {}, [x]))
    ) as ElementVNode[];
    expect(nodes).toEqual([
      {
        tag: FRAG,
        props: { key: 0 },
        children: [{ tag: "li", props: {}, children: ["a"] }]
      },
      {
        tag: FRAG,
        props: { key: 1 },
        children: [{ tag: "li", props: {}, children: ["b"] }]
      }
    ]);
  });

  test("▸=true branch with no adapter throws 'no adapter injected'", () => {
    expect(() => withFlag(true, () => h("p", {}, "x"))).toThrow(
      /no adapter injected/
    );
    expect(() => withFlag(true, () => Fragment("x"))).toThrow(
      /no adapter injected/
    );
  });

  test("isComp distinguishes components from plain functions/host tags", () => {
    expect(isComp(Colorized)).toBe(true);
    expect(isComp(BlockC)).toBe(true);
    expect(isComp((x: unknown) => x)).toBe(false);
    expect(isComp("div")).toBe(false);
    expect(Colorized.kind).toBe("inline");
    expect(BlockC.kind).toBe("block");
  });
});

// =============================================================================================
// struct: groupLists
// =============================================================================================

describe("groupLists", () => {
  test("coalesces a run of nota-ul-li into one ul of li", () => {
    const input = [
      el("nota-ul-li", ["a"]),
      el("nota-ul-li", ["b"]),
      el("nota-ul-li", ["c"])
    ];
    expect(groupLists(input)).toEqual([
      el("ul", [el("li", ["a"]), el("li", ["b"]), el("li", ["c"])])
    ]);
  });

  test("nota-ol-li → ol", () => {
    expect(
      groupLists([el("nota-ol-li", ["1"]), el("nota-ol-li", ["2"])])
    ).toEqual([el("ol", [el("li", ["1"]), el("li", ["2"])])]);
  });

  test("adjacent nota-ul-li-run and nota-ol-li-run stay separate lists", () => {
    const input = [
      el("nota-ul-li", ["a"]),
      el("nota-ul-li", ["b"]),
      el("nota-ol-li", ["1"]),
      el("nota-ol-li", ["2"])
    ];
    expect(groupLists(input)).toEqual([
      el("ul", [el("li", ["a"]), el("li", ["b"])]),
      el("ol", [el("li", ["1"]), el("li", ["2"])])
    ]);
  });

  test("a non-list sibling between two nota-ul-li runs splits them", () => {
    const input = [
      el("nota-ul-li", ["a"]),
      el("p", ["mid"]),
      el("nota-ul-li", ["b"])
    ];
    expect(groupLists(input)).toEqual([
      el("ul", [el("li", ["a"])]),
      el("p", ["mid"]),
      el("ul", [el("li", ["b"])])
    ]);
  });

  test("non-list children pass through untouched", () => {
    expect(groupLists(["text", el("em", ["x"])])).toEqual([
      "text",
      el("em", ["x"])
    ]);
  });

  test("nested list forms via struct recursion (no special case in groupLists)", () => {
    // - a
    //   - b
    //   - c   (parser nests the inner nota-ul-li run inside item a's children)
    const tree = frag([
      el("nota-ul-li", ["a", el("nota-ul-li", ["b"]), el("nota-ul-li", ["c"])])
    ]);
    expect(struct(tree)).toEqual(
      frag([
        el("ul", [
          el("li", ["a", el("ul", [el("li", ["b"]), el("li", ["c"])])])
        ])
      ])
    );
  });

  test("adjacent lists ignore newlines", () => {
    const tree = frag([el("nota-ul-li", ["a"]), "\n", el("nota-ul-li", ["b"])]);
    expect(struct(tree)).toEqual(
      frag([el("ul", [el("li", ["a"]), el("li", ["b"])])])
    );
  });

  // ---- whitespace bridging ----

  test("a blank line (two '\\n') between same-kind sentinels bridges into one list", () => {
    // `- a`␤␤`- b`: the reader absorbs the between-item blank into the item extents, so both
    // sentinels arrive with a whitespace run between them. Bridging consumes the run — one <ul>.
    expect(
      groupLists([el("nota-ul-li", ["a"]), "\n", "\n", el("nota-ul-li", ["b"])])
    ).toEqual([el("ul", [el("li", ["a"]), el("li", ["b"])])]);
  });

  test("a multi-node soft-whitespace run bridges same-kind sentinels", () => {
    expect(
      groupLists([el("nota-ul-li", ["a"]), "\n", " ", el("nota-ul-li", ["b"])])
    ).toEqual([el("ul", [el("li", ["a"]), el("li", ["b"])])]);
  });

  test("whitespace between DIFFERENT-kind sentinels does NOT bridge (and is not consumed)", () => {
    expect(
      groupLists([el("nota-ul-li", ["a"]), "\n", el("nota-ol-li", ["b"])])
    ).toEqual([el("ul", [el("li", ["a"])]), "\n", el("ol", [el("li", ["b"])])]);
  });

  test("whitespace at run edges is preserved (only interior whitespace is consumed)", () => {
    expect(groupLists(["x", "\n", el("nota-ul-li", ["a"]), "\n", "y"])).toEqual(
      ["x", "\n", el("ul", [el("li", ["a"])]), "\n", "y"]
    );
  });
});

// =============================================================================================
// struct: groupParas + block/inline classification
// =============================================================================================

describe("groupParas", () => {
  test("a single inline run becomes one <p>", () => {
    expect(groupParas(["Hello ", el("em", ["world"])])).toEqual([
      el("p", ["Hello ", el("em", ["world"])])
    ]);
  });

  test("a paragraph break splits a run into two <p>", () => {
    // "\n\n" is a blank line → paragraph boundary; consumed.
    expect(groupParas(["a", "\n\n", "b"])).toEqual([
      el("p", ["a"]),
      el("p", ["b"])
    ]);
  });

  // The reader emits ONE "\n" child PER interior newline (no pre-coalescing; design/decode.md §struct), so a
  // blank source line arrives as the TWO SEPARATE siblings below — NOT a single "\n\n" node like the
  // test above. groupParas accumulates the whitespace run and tests the concatenation, so the blank
  // line still splits into two <p>. (Regression test for the reader ⨯ runtime para-break mismatch.)
  test("a blank line as the reader's separate '\\n' nodes splits into two <p>", () => {
    expect(groupParas(["a", "\n", "\n", "b"])).toEqual([
      el("p", ["a"]),
      el("p", ["b"])
    ]);
  });

  test("a single '\\n' is a soft break and stays inside the <p>", () => {
    expect(groupParas(["a", "\n", "b"])).toEqual([el("p", ["a", "\n", "b"])]);
  });

  test("a block host sibling flushes the run and passes through unwrapped", () => {
    const input = ["a", el("ul", [el("li", ["x"])]), "b"];
    expect(groupParas(input)).toEqual([
      el("p", ["a"]),
      el("ul", [el("li", ["x"])]),
      el("p", ["b"])
    ]);
  });

  test("inline component JOINS the run (lands inside <p>)", () => {
    const inlineNode = el(InlineC, ["hi"]);
    expect(groupParas(["a ", inlineNode, " b"])).toEqual([
      el("p", ["a ", inlineNode, " b"])
    ]);
  });

  test("block component FLUSHES the run and passes through", () => {
    const blockNode = el(BlockC, ["hi"]);
    expect(groupParas(["a", blockNode, "b"])).toEqual([
      el("p", ["a"]),
      blockNode,
      el("p", ["b"])
    ]);
  });

  test("a whitespace-only run is dropped, not wrapped in an empty <p>", () => {
    expect(groupParas([el("ul", []), "\n", el("ul", [])])).toEqual([
      el("ul", []),
      el("ul", [])
    ]);
  });

  test("a fragment is inline (joins the run) per the literal isBlock definition", () => {
    const f = frag(["mid"]);
    expect(groupParas(["a", f, "b"])).toEqual([el("p", ["a", f, "b"])]);
  });
});

// =============================================================================================
// struct: groupSections + heading ownership/nesting
// =============================================================================================

describe("groupSections", () => {
  test("a heading owns following non-heading siblings", () => {
    const input = [el("h1", ["A"]), el("p", ["x"]), el("p", ["y"])];
    expect(groupSections(input)).toEqual([
      el("section", [el("h1", ["A"]), el("p", ["x"]), el("p", ["y"])])
    ]);
  });

  test("an equal-rank heading ends the section (siblings, not nested)", () => {
    const input = [
      el("h1", ["A"]),
      el("p", ["x"]),
      el("h1", ["B"]),
      el("p", ["y"])
    ];
    expect(groupSections(input)).toEqual([
      el("section", [el("h1", ["A"]), el("p", ["x"])]),
      el("section", [el("h1", ["B"]), el("p", ["y"])])
    ]);
  });

  test("a deeper-rank heading NESTS inside the shallower section", () => {
    const input = [el("h1", ["A"]), el("h2", ["B"]), el("p", ["y"])];
    expect(groupSections(input)).toEqual([
      el("section", [
        el("h1", ["A"]),
        el("section", [el("h2", ["B"]), el("p", ["y"])])
      ])
    ]);
  });

  test("h2 closes at the next h1 (rank <= own ends ownership)", () => {
    const input = [
      el("h1", ["A"]),
      el("h2", ["B"]),
      el("p", ["b"]),
      el("h1", ["C"])
    ];
    expect(groupSections(input)).toEqual([
      el("section", [
        el("h1", ["A"]),
        el("section", [el("h2", ["B"]), el("p", ["b"])])
      ]),
      el("section", [el("h1", ["C"])])
    ]);
  });

  test("content before the first heading passes through unwrapped", () => {
    const input = [el("p", ["intro"]), el("h1", ["A"]), el("p", ["x"])];
    expect(groupSections(input)).toEqual([
      el("p", ["intro"]),
      el("section", [el("h1", ["A"]), el("p", ["x"])])
    ]);
  });
});

// =============================================================================================
// struct integration: container gate + recursion (no double-wrap, no <p>-in-<p>)
// =============================================================================================

describe("struct (container gate + recursion)", () => {
  test("boundary stop: component passes through intact, static children decoded", () => {
    // A component's static children are list items → coalesced to <ul> (groupLists runs in any
    // component slot), but struct does NOT descend into the component body.
    const tree = el(InlineC, [
      el("nota-ul-li", ["a"]),
      el("nota-ul-li", ["b"])
    ]);
    expect(struct(tree)).toEqual(
      el(InlineC, [el("ul", [el("li", ["a"]), el("li", ["b"])])])
    );
  });

  test("inline component slot is tight: a single inline child is NOT paragraph-wrapped", () => {
    // The worked-example case: @Colorized{a} keeps "a" bare, not <p>a</p>.
    expect(struct(el(InlineC, ["a"]))).toEqual(el(InlineC, ["a"]));
  });

  test("block component slot is flow: bare inline content IS paragraph-wrapped", () => {
    // @Aside{ Hello } (block) → its slot gets a <p>, like any flow container.
    expect(struct(el(BlockC, ["Hello"]))).toEqual(
      el(BlockC, [el("p", ["Hello"])])
    );
  });

  test("block component slot sections by heading rank (flow content)", () => {
    const tree = el(BlockC, [el("h1", ["A"]), "x", el("h2", ["B"]), "y"]);
    expect(struct(tree)).toEqual(
      el(BlockC, [
        el("section", [
          el("h1", ["A"]),
          el("p", ["x"]),
          el("section", [el("h2", ["B"]), el("p", ["y"])])
        ])
      ])
    );
  });

  test("an explicit <p> is NOT re-wrapped in another <p>", () => {
    expect(struct(el("p", ["Hello"]))).toEqual(el("p", ["Hello"]));
  });

  test("an inline host element keeps its inline children (no implicit <p>)", () => {
    expect(struct(el("em", ["hi"]))).toEqual(el("em", ["hi"]));
  });

  test("a tight <li> with a single inline child does NOT wrap it in <p>", () => {
    const tree = frag([el("nota-ul-li", [el(InlineC, ["a"])])]);
    expect(struct(tree)).toEqual(
      frag([el("ul", [el("li", [el(InlineC, ["a"])])])])
    );
  });

  test("a flow container (FRAG) DOES paragraph-wrap bare inline content", () => {
    expect(struct(frag(["Hello ", el("em", ["world"])]))).toEqual(
      frag([el("p", ["Hello ", el("em", ["world"])])])
    );
  });

  test("section interiors get paras/lists but are not re-sectioned (no double-wrap)", () => {
    // Body: h1 A, "text1", h2 B, "text2" — sectioning + paragraphs, nested, exactly once.
    const tree = frag([el("h1", ["A"]), "text1", el("h2", ["B"]), "text2"]);
    expect(struct(tree)).toEqual(
      frag([
        el("section", [
          el("h1", ["A"]),
          el("p", ["text1"]),
          el("section", [el("h2", ["B"]), el("p", ["text2"])])
        ])
      ])
    );
  });

  test("lists survive paragraph grouping and then get sectioned (pass ordering)", () => {
    // # Title  then  - a  - b
    const tree = frag([
      el("h1", ["Title"]),
      el("nota-ul-li", ["a"]),
      el("nota-ul-li", ["b"])
    ]);
    expect(struct(tree)).toEqual(
      frag([
        el("section", [
          el("h1", ["Title"]),
          el("ul", [el("li", ["a"]), el("li", ["b"])])
        ])
      ])
    );
  });

  test("strings are returned unchanged", () => {
    expect(struct("plain text")).toBe("plain text");
  });

  test("a whitespace-bridged list still forms paragraphs around it (bridging × groupParas)", () => {
    // intro␤␤ - a ␤ - b ␤␤ outro : the blank lines fence a <p> off from the list on each side,
    // while the single "\n" between the two items is bridged/consumed so the list stays one <ul>.
    const tree = frag([
      "intro",
      "\n",
      "\n",
      el("nota-ul-li", ["a"]),
      "\n",
      el("nota-ul-li", ["b"]),
      "\n",
      "\n",
      "outro"
    ]);
    expect(struct(tree)).toEqual(
      frag([
        el("p", ["intro"]),
        el("ul", [el("li", ["a"]), el("li", ["b"])]),
        el("p", ["outro"])
      ])
    );
  });

  test("the keyed @for emit shape bridges over the interleaved '\\n' into one <ul>", () => {
    // The reader emits, for a textual `- a`, a `@for` of `-` items, then a textual `- b`:
    //   h("nota-ul-li",{},["a"]),
    //   xs.map((v,_i) => Fragment({key:_i}, h("nota-ul-li",{},[v]))),  // an array child
    //   "\n",
    //   h("nota-ul-li",{},["b"])
    // Fragment splices the array child one level; struct dissolves the per-iteration keyed FRAGs,
    // so the sentinels become direct siblings — but a stray "\n" sits before the final one.
    // Whitespace bridging covers it: all items coalesce into ONE <ul>.
    const shape = Fragment(
      h("nota-ul-li", {}, ["a"]),
      ["x", "y"].map((v, _i) =>
        Fragment({ key: _i }, h("nota-ul-li", {}, [v]))
      ),
      "\n",
      h("nota-ul-li", {}, ["b"])
    ) as ElementVNode;
    expect(struct(shape)).toEqual(
      frag([
        el("ul", [
          el("li", ["a"]),
          el("li", ["x"]),
          el("li", ["y"]),
          el("li", ["b"])
        ])
      ])
    );
  });
});

// =============================================================================================
// Plain-function tags — static templates
// =============================================================================================

describe("plain-function tags (static templates)", () => {
  test("a template's output splices before grouping: its sentinel joins the sibling run", () => {
    // `% let Foo = () => @{- You're beautiful.}` … `- You don't know` `@Foo{}` — the template's
    // list item coalesces with the sibling item into ONE <ul>.
    const Foo = () => frag([el("nota-ul-li", ["You're beautiful."])]);
    const tree = frag([el("nota-ul-li", ["You don't know"]), el(Foo)]);
    expect(struct(tree)).toEqual(
      frag([
        el("ul", [
          el("li", ["You don't know"]),
          el("li", ["You're beautiful."])
        ])
      ])
    );
  });

  test("children and props forward as { children, …props }", () => {
    const Wrap = ({ children, cls }: { children: VNode[]; cls?: unknown }) =>
      el("div", children, { class: cls });
    const tree = frag([el(Wrap, ["kid"], { cls: "x" })]);
    // The expanded <div> is a flow container, so its bare text child paragraph-wraps as usual.
    expect(struct(tree)).toEqual(
      frag([el("div", [el("p", ["kid"])], { class: "x" })])
    );
  });

  test("templates chain: a template returning a template-tagged node keeps expanding", () => {
    const Inner = () => el("nota-ul-li", ["deep"]);
    const Outer = () => el(Inner);
    expect(struct(frag([el(Outer)]))).toEqual(
      frag([el("ul", [el("li", ["deep"])])])
    );
  });

  test("a template's nullish/boolean output normalizes like any h child", () => {
    const Nothing = () => null;
    // The template contributes nothing; the surviving inline run paragraph-wraps (flow FRAG).
    expect(struct(frag(["a", el(Nothing), "b"]))).toEqual(
      frag([el("p", ["a", "b"])])
    );
  });

  test("marked components are NOT expanded — the boundary survives", () => {
    expect(struct(el(InlineC, ["kid"]))).toEqual(el(InlineC, ["kid"]));
  });

  test("a cyclic template chain fails pointedly instead of hanging", () => {
    const Loop = (): ElementVNode => el(Loop);
    expect(() => struct(frag([el(Loop)]))).toThrow(/did not terminate/);
  });
});

// =============================================================================================
// THE HEADLINE FIXTURE — the tree after Doc() runs → struct output
// =============================================================================================

describe("headline fixture (tree after Doc() → struct)", () => {
  test("the two nota-ul-li coalesce; each li holds the untouched Colorized boundary", () => {
    // The structured tree after Doc() runs (▸=false; Colorized deferred, not invoked):
    const stage4 = frag([
      el("nota-ul-li", [el(Colorized, ["a"])]),
      el("nota-ul-li", [el(Colorized, ["b"])])
    ]);

    const expected = frag([
      el("ul", [
        el("li", [el(Colorized, ["a"])]),
        el("li", [el(Colorized, ["b"])])
      ])
    ]);

    expect(struct(stage4)).toEqual(expected);

    // Spot-check the boundary stop is intact: the Colorized nodes are the *same component fn*,
    // their children decoded (here trivially ["a"]/["b"]), and the body was never invoked.
    const ul = (struct(stage4) as ElementVNode).children[0] as ElementVNode;
    const li0 = ul.children[0] as ElementVNode;
    const boundary = li0.children[0] as ElementVNode;
    expect(boundary.tag).toBe(Colorized);
    expect(isComp(boundary.tag)).toBe(true);
    expect(boundary.children).toEqual(["a"]);
  });
});
