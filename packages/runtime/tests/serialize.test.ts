/**
 * `serialize` + `island` unit tests, driven by a **stub adapter** that
 * records its calls and returns sentinel HTML. Asserts: host/text/fragment/void HTML emission,
 * attribute serialization (style object, booleans, event-handler omission, escaping), monotonic
 * hydration ids, manifest entries, static-slot pre-rendering (the boundary's children reach the
 * adapter as already-serialized HTML), and the non-JSON-serializable-prop throw.
 */

import { afterEach, beforeEach, describe, expect, test } from "vitest";

import {
  type Adapter,
  blockComponent,
  type CompFn,
  clearAdapter,
  type ElementVNode,
  // aliased: importing it bare would shadow the legacy global `escape` (biome lint).
  escape as escapeHtml,
  FRAG,
  Fragment,
  getManifest,
  h,
  inlineComponent,
  island,
  isRaw,
  type RawHtml,
  raw,
  reset,
  serialize,
  setAdapter,
  struct,
  type VNode
} from "../src/lib";

// ---------------------------------------------------------------------------------------------
// vnode builders
// ---------------------------------------------------------------------------------------------

function el(
  tag: ElementVNode["tag"],
  children: VNode[] = [],
  props: Record<string, unknown> = {}
): ElementVNode {
  return { tag, props, children };
}
const frag = (children: VNode[] = []): ElementVNode => el(FRAG, children);

// ---------------------------------------------------------------------------------------------
// Stub adapter (records calls; returns sentinel HTML so island wiring is observable)
// ---------------------------------------------------------------------------------------------

interface HCall {
  tag: unknown;
  props: Record<string, unknown> | null;
  children: unknown;
}

/** A sentinel "framework element" the stub produces from `h`/`Fragment`. */
interface StubEl {
  call: HCall;
}

/** Build a stub adapter plus a log of its `h` calls (for asserting island wiring). */
function makeStubAdapter() {
  const hCalls: HCall[] = [];
  let hydrated: { el: unknown; container: unknown }[] = [];

  const adapter: Adapter = {
    h(tag, props, children): StubEl {
      const call = { tag, props, children };
      hCalls.push(call);
      return { call };
    },
    Fragment(props, children): StubEl {
      const call = { tag: FRAG, props, children };
      hCalls.push(call);
      return { call };
    },
    renderToString(elem: unknown): string {
      // Deterministic sentinel string that exposes the component name + the raw slot it received,
      // so tests can prove (a) the right component was rendered and (b) the static children slot
      // reached the framework pre-serialized.
      const { call } = elem as StubEl;
      const name = (call.tag as Partial<CompFn>).compName ?? "?";
      const slot = isRaw(call.children) ? (call.children as RawHtml).html : "";
      const propsJson = JSON.stringify(call.props);
      return `<stub comp="${name}" props='${propsJson}'>${slot}</stub>`;
    },
    hydrate(elem: unknown, container: unknown): void {
      hydrated.push({ el: elem, container });
    }
  };
  return {
    adapter,
    hCalls,
    hydrated,
    resetLog() {
      hCalls.length = 0;
      hydrated = [];
    }
  };
}

let stub: ReturnType<typeof makeStubAdapter>;

beforeEach(() => {
  stub = makeStubAdapter();
  setAdapter(stub.adapter);
  reset();
});
afterEach(() => {
  clearAdapter();
});

// =============================================================================================
// escape (unit)
// =============================================================================================

describe("escape", () => {
  test("escapes the five HTML-sensitive characters", () => {
    expect(escapeHtml(`a & b < c > d " e ' f`)).toBe(
      "a &amp; b &lt; c &gt; d &quot; e &#39; f"
    );
  });
  test("ampersand is escaped first (no double-escape)", () => {
    expect(escapeHtml("&lt;")).toBe("&amp;lt;");
  });
});

// =============================================================================================
// serialize — host / text / fragment / void
// =============================================================================================

describe("serialize (host / text / fragment / void)", () => {
  test("text leaf is escaped", () => {
    expect(serialize("a <b> & c")).toBe("a &lt;b&gt; &amp; c");
  });

  test("host element with children", () => {
    expect(serialize(el("p", ["Hello ", el("em", ["world"])]))).toBe(
      "<p>Hello <em>world</em></p>"
    );
  });

  test("fragment is transparent: children joined, no wrapper", () => {
    expect(serialize(frag(["one ", el("b", ["two"])]))).toBe("one <b>two</b>");
  });

  test("a FRAG's props (e.g. a `key`) do NOT leak into serialized HTML", () => {
    // Fragment({key}, child) sits the key in FRAG props; serialize renders FRAG as children joined,
    // with no wrapper element and no attribute pass — so static SSG output never carries the key.
    const f: ElementVNode = {
      tag: FRAG,
      props: { key: 7 },
      children: [el("b", ["two"])]
    };
    const out = serialize(f);
    expect(out).toBe("<b>two</b>");
    expect(out).not.toContain("key");
  });

  test("each keyed @for FRAG serializes transparently — its `key` never reaches the HTML", () => {
    // The reader's @for emit `["a","b"].map((x,_i) => Fragment({key:_i}, h("li",{},[x])))` produces
    // an array of keyed FRAGs. Each FRAG is transparent on serialize (children joined, no wrapper,
    // no attr pass), so the `key` it carries in props is dropped — only the inner <li> survives.
    const items = ["a", "b"].map((x, _i) =>
      Fragment({ key: _i }, h("li", {}, [x]))
    );
    // assert the FRAGs really hold the key (the ▸=false vnode), then that serialize drops it.
    expect((items[0] as ElementVNode).props).toEqual({ key: 0 });
    const html = items.map(serialize).join("");
    expect(html).toBe("<li>a</li><li>b</li>");
    expect(html).not.toContain("key");
  });

  test("keyed @for FRAGs through struct→serialize — transparent splice coalesces the list", () => {
    // The reader's @for over `-` items emits
    //   ["a","b"].map((x,_i) => Fragment({key:_i}, h("nota-ul-li",{},[x])))
    // struct splices each per-iteration FRAG transparently, so the `nota-ul-li` sentinels
    // become direct siblings of the flow container and groupLists coalesces them into ONE <ul>. The
    // `key` is dropped (static HTML needs none). This is the canonical golden's list behavior.
    const items = ["a", "b"].map((x, _i) =>
      Fragment({ key: _i }, h("nota-ul-li", {}, [x]))
    );
    const html = serialize(struct(frag(items)));
    expect(html).toBe("<ul><li>a</li><li>b</li></ul>");
    expect(html).not.toContain("key");
  });

  test("void elements self-close and ignore children", () => {
    expect(serialize(el("br"))).toBe("<br />");
    expect(serialize(el("img", [], { src: "/a.png" }))).toBe(
      '<img src="/a.png" />'
    );
    expect(serialize(el("hr"))).toBe("<hr />");
    expect(serialize(el("input", [], { type: "text" }))).toBe(
      '<input type="text" />'
    );
    // even a stray child on a void element is dropped
    expect(serialize(el("br", ["x"]))).toBe("<br />");
  });

  test("nested list HTML (the struct product)", () => {
    const ul = el("ul", [
      el("li", ["a"]),
      el("li", ["b", el("ul", [el("li", ["c"])])])
    ]);
    expect(serialize(ul)).toBe(
      "<ul><li>a</li><li>b<ul><li>c</li></ul></li></ul>"
    );
  });
});

// =============================================================================================
// serialize — attributes
// =============================================================================================

describe("serialize (attributes)", () => {
  test("string attribute value is escaped", () => {
    expect(serialize(el("a", ["go"], { href: '/x?a=1&b="2"' }))).toBe(
      '<a href="/x?a=1&amp;b=&quot;2&quot;">go</a>'
    );
  });

  test("boolean true → bare attr; false/nullish → omitted", () => {
    expect(
      serialize(el("input", [], { disabled: true, required: false }))
    ).toBe("<input disabled />");
    expect(serialize(el("input", [], { disabled: null }))).toBe("<input />");
    expect(serialize(el("input", [], { disabled: undefined }))).toBe(
      "<input />"
    );
  });

  test("style object → CSS string with kebab-cased keys", () => {
    expect(
      serialize(
        el("span", ["x"], { style: { color: "red", fontSize: "12px" } })
      )
    ).toBe('<span style="color: red; font-size: 12px">x</span>');
  });

  test("style string passes through", () => {
    expect(serialize(el("span", ["x"], { style: "color: red" }))).toBe(
      '<span style="color: red">x</span>'
    );
  });

  test("event handlers and function-valued props are omitted in static HTML", () => {
    expect(
      serialize(
        el("button", ["go"], { onClick: () => {}, onMouseDown: () => {} })
      )
    ).toBe("<button>go</button>");
    expect(serialize(el("div", ["x"], { foo: () => 1 }))).toBe("<div>x</div>");
  });

  test("a stray `children` prop is not serialized as an attribute", () => {
    expect(serialize(el("div", ["x"], { children: ["nope"], id: "d" }))).toBe(
      '<div id="d">x</div>'
    );
  });

  test("numeric / mixed attribute values stringify", () => {
    expect(serialize(el("div", ["x"], { "data-n": 0, tabindex: -1 }))).toBe(
      '<div data-n="0" tabindex="-1">x</div>'
    );
  });
});

// =============================================================================================
// island — ids, manifest, static slot, wiring
// =============================================================================================

describe("island (ids / manifest / slot / wiring)", () => {
  const Colorized: CompFn = inlineComponent(c => c, "Colorized");

  test("mints monotonic ids 1,2,3 and wraps in <nota-island>", () => {
    const a = island(el(Colorized, ["a"]) as ElementVNode & { tag: CompFn });
    const b = island(el(Colorized, ["b"]) as ElementVNode & { tag: CompFn });
    expect(a).toMatch(/^<nota-island data-hydration-id="1">/);
    expect(b).toMatch(/^<nota-island data-hydration-id="2">/);
    expect(a.endsWith("</nota-island>")).toBe(true);
  });

  test("records manifest { comp, props } per island", () => {
    island(el(Colorized, ["a"], { hue: 5 }) as ElementVNode & { tag: CompFn });
    island(el(Colorized, ["b"]) as ElementVNode & { tag: CompFn });
    expect(getManifest()).toEqual({
      "1": { comp: "Colorized", props: { hue: 5 } },
      "2": { comp: "Colorized", props: {} }
    });
  });

  test("static children are pre-serialized to an HTML slot handed to the adapter as raw()", () => {
    // children are real nota vnodes (list already struct'd to <ul>); the slot must be their HTML.
    const children = [el("ul", [el("li", ["a"]), el("li", ["b"])])];
    island(el(Colorized, children) as ElementVNode & { tag: CompFn });
    // the adapter's h was called with the component and a RawHtml child whose .html is the slot
    const compCall = stub.hCalls.find(c => c.tag === Colorized);
    expect(compCall).toBeDefined();
    expect(isRaw(compCall?.children)).toBe(true);
    expect((compCall?.children as RawHtml).html).toBe(
      "<ul><li>a</li><li>b</li></ul>"
    );
  });

  test("props pass through to the adapter h call (sans hydration-id — see decision)", () => {
    island(el(Colorized, ["a"], { hue: 5 }) as ElementVNode & { tag: CompFn });
    const compCall = stub.hCalls.find(c => c.tag === Colorized);
    expect(compCall?.props).toEqual({ hue: 5 });
    // the id is NOT smuggled into the component props — it lives on the wrapper element.
    expect(compCall?.props).not.toHaveProperty("hydration-id");
  });

  test("SSR shell is wrapped verbatim inside the marker (stub renderToString output present)", () => {
    const out = island(el(Colorized, ["a"]) as ElementVNode & { tag: CompFn });
    expect(out).toBe(
      `<nota-island data-hydration-id="1"><stub comp="Colorized" props='{}'>a</stub></nota-island>`
    );
  });

  test("serialize routes a boundary node through island", () => {
    const out = serialize(el(Colorized, ["a"]) as ElementVNode);
    expect(out).toMatch(/^<nota-island data-hydration-id="1">/);
    expect(getManifest()["1"].comp).toBe("Colorized");
  });

  test("a block component boundary also islands (name preserved)", () => {
    const Aside: CompFn = blockComponent(c => c, "Aside");
    const out = island(el(Aside, ["body"]) as ElementVNode & { tag: CompFn });
    expect(out).toMatch(/data-hydration-id="1"/);
    expect(getManifest()["1"].comp).toBe("Aside");
  });
});

// =============================================================================================
// island — non-JSON-serializable prop throws
// =============================================================================================

describe("island (JSON-serializable prop validation)", () => {
  const C: CompFn = inlineComponent(c => c, "C");

  test("a function prop throws a pointed error", () => {
    expect(() =>
      island(el(C, ["x"], { cb: () => 1 }) as ElementVNode & { tag: CompFn })
    ).toThrow(/not JSON-serializable.*function/s);
  });

  test("a symbol prop throws", () => {
    expect(() =>
      island(el(C, ["x"], { s: Symbol("z") }) as ElementVNode & { tag: CompFn })
    ).toThrow(/not JSON-serializable.*symbol/s);
  });

  test("a bigint prop throws", () => {
    expect(() =>
      island(el(C, ["x"], { n: 1n }) as ElementVNode & { tag: CompFn })
    ).toThrow(/not JSON-serializable.*bigint/s);
  });

  test("a nested function (in an object/array) throws with a path", () => {
    expect(() =>
      island(
        el(C, ["x"], { data: { items: [{ fn: () => 1 }] } }) as ElementVNode & {
          tag: CompFn;
        }
      )
    ).toThrow(/data\.items\[0\]\.fn/);
  });

  test("a circular prop throws", () => {
    const o: Record<string, unknown> = {};
    o.self = o;
    expect(() =>
      island(el(C, ["x"], { o }) as ElementVNode & { tag: CompFn })
    ).toThrow(/circular/);
  });

  test("plain JSON props (nested objects/arrays/strings/numbers/null) are accepted", () => {
    expect(() =>
      island(
        el(C, ["x"], {
          data: { a: [1, 2, "s", null], b: { c: true } }
        }) as ElementVNode & { tag: CompFn }
      )
    ).not.toThrow();
  });

  test("a non-serializable prop throws BEFORE an id is committed past it", () => {
    // first island ok → id 1; second throws → no id 2 manifest entry
    island(el(C, ["a"]) as ElementVNode & { tag: CompFn });
    expect(() =>
      island(el(C, ["b"], { bad: () => 1 }) as ElementVNode & { tag: CompFn })
    ).toThrow();
    // manifest has only the first island; the throw happened after id mint but before commit
    expect(Object.keys(getManifest())).toEqual(["1"]);
  });
});

// =============================================================================================
// raw marker (unit)
// =============================================================================================

describe("raw marker", () => {
  test("raw() wraps a string; isRaw detects it; survives identity checks", () => {
    const r = raw("<i>x</i>");
    expect(isRaw(r)).toBe(true);
    expect(r.html).toBe("<i>x</i>");
    expect(isRaw("<i>x</i>")).toBe(false);
    expect(isRaw(null)).toBe(false);
    expect(isRaw({ html: "x" })).toBe(false);
  });
});

// =============================================================================================
// Fuzzing findings, round 2 (2026-06) — NON-ignored, currently-FAILING runtime specs.
// Each asserts the spec-correct behavior, so it FAILS today against a real bug found by the
// `nota_inspect` fuzzing harness. (The reader-side findings live in the oxc integration suite,
// `crates/oxc_codegen/tests/integration/nota.rs`, module `fuzz_findings_2`.)
// =============================================================================================

describe("fuzz findings (round 2)", () => {
  // [RUNTIME-CRASH] a non-renderable interpolation child (an object / Date) crashes `struct` with a
  // cryptic "children is not iterable" instead of rendering gracefully or raising a clear error.
  // Repro: `@p{@({a: 1})}` → h("p", {}, [{ a: 1 }]).
  test("non-renderable (object) child should not crash with a cryptic error", () => {
    const tree = el("p", [{ a: 1 } as unknown as VNode]);
    expect(() => serialize(struct(tree))).not.toThrow(
      /children is not iterable/
    );
  });

  // [WHITESPACE] a paragraph-break marker ("\n\n") inside a TIGHT element (`@p`, `@h1`, `@li`)
  // survives as a literal double newline instead of being consumed/normalized.
  // Repro: `@p{a\n\nb}` → h("p", {}, ["a", "\n", "\n", "b"]).
  test("paragraph-break marker should not survive inside a tight element", () => {
    const tree = el("p", ["a", "\n", "\n", "b"]);
    expect(serialize(struct(tree))).not.toContain("\n\n");
  });
});
