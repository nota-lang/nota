/**
 * Component-registry unit tests (design/decode.md §The registry & config): `slot` /
 * `registerComponents` and the `RawHtml` static path.
 *
 * - A slot is a *plain* function tag (a static template): `struct` expands it eagerly, resolving the registry at
 *   invocation time. A registered plain function / host string stays fully static; a registered
 *   `blockComponent`/`inlineComponent` becomes a boundary → island.
 * - Registration is **global-persistent**: NOT cleared by the per-render `reset()` (site policy,
 *   unlike `lstset`-style document config).
 * - `RawHtml` is an opaque leaf in the static path: `struct` passes it through, `serialize` emits
 *   it verbatim, and as a sibling it is inline (joins a paragraph run).
 */

import { afterEach, beforeEach, describe, expect, test } from "vitest";

import {
  type Adapter,
  blockComponent,
  type CompProps,
  clearAdapter,
  clearRegisteredComponents,
  type ElementVNode,
  FRAG,
  getManifest,
  h,
  isRaw,
  type RawHtml,
  raw,
  registerComponents,
  registeredComponent,
  reset,
  serialize,
  setAdapter,
  slot,
  struct,
  type VNode
} from "../src/lib";

// ---------------------------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------------------------

function el(
  tag: ElementVNode["tag"],
  children: VNode[] = [],
  props: Record<string, unknown> = {}
): ElementVNode {
  return { tag, props, children };
}
const frag = (children: VNode[] = []): ElementVNode => el(FRAG, children);

/** decode a static tree: the ▸=false pipeline. */
const decodeStatic = (v: VNode): string => serialize(struct(v));

/** A minimal adapter stub so a registered *component* override can island. */
const stubAdapter: Adapter = {
  h: (tag, props, children) => ({ tag, props, children }),
  Fragment: (props, children) => ({ tag: FRAG, props, children }),
  renderToString(elem: unknown): string {
    const { tag, children } = elem as { tag: unknown; children: unknown };
    const name =
      (tag as { compName?: string }).compName ?? String((tag as never) ?? "?");
    const slotHtml = isRaw(children) ? (children as RawHtml).html : "";
    return `<stub comp="${name}">${slotHtml}</stub>`;
  },
  hydrate(): void {}
};

/** The default the slot falls back to: a static template rendering a marked host. */
const TexDefault = ({ children }: CompProps) =>
  h("span", { class: "tex-default" }, children);
const Tex = slot("Tex", TexDefault);

beforeEach(() => {
  reset();
});
afterEach(() => {
  clearRegisteredComponents();
  clearAdapter();
});

// =============================================================================================
// slot resolution
// =============================================================================================

describe("slot: resolution + static-template expansion", () => {
  test("unregistered → fallback expands statically", () => {
    expect(decodeStatic(el(Tex, ["x^2"]))).toBe(
      '<span class="tex-default">x^2</span>'
    );
  });

  test("registered plain function → override expands statically", () => {
    registerComponents({
      Tex: ({ children }: CompProps) => h("code", {}, children)
    });
    expect(decodeStatic(el(Tex, ["x^2"]))).toBe("<code>x^2</code>");
  });

  test("registered host string → that element", () => {
    registerComponents({ Tex: "kbd" });
    expect(decodeStatic(el(Tex, ["x^2"]))).toBe("<kbd>x^2</kbd>");
  });

  test("props forward through the slot to the resolved tag", () => {
    // The fallback re-emits its non-children props onto the host, so a `display` prop
    // must survive slot → resolved-template forwarding (serialized as a bare attribute).
    const PropEcho = ({ children, ...rest }: CompProps) =>
      h("span", rest, children);
    const S = slot("PropEcho", PropEcho);
    expect(decodeStatic(el(S, ["b"], { display: true }))).toBe(
      "<span display>b</span>"
    );
  });

  test("registered marked component → boundary: SSR island + manifest entry", () => {
    setAdapter(stubAdapter);
    registerComponents({
      Tex: blockComponent(children => h("div", {}, children), "MyTex")
    });
    const html = decodeStatic(frag([el(Tex, ["x^2"])]));
    // NB: a BLOCK component's static children slot decodes as flow (the container gate), so "x^2" paragraph-wraps.
    expect(html).toBe(
      '<nota-island data-hydration-id="1"><stub comp="MyTex"><p>x^2</p></stub></nota-island>'
    );
    expect(getManifest()["1"]).toEqual({ comp: "MyTex" });
  });

  test("lookup happens at expansion time, not slot creation", () => {
    // Build the vnode BEFORE registering: `decode` runs after `Doc()` evaluated its body, so a
    // top-of-document `% registerComponents({…})` must still affect that document's spans.
    const v = el(Tex, ["late"]);
    registerComponents({ Tex: "mark" });
    expect(decodeStatic(v)).toBe("<mark>late</mark>");
  });
});

// =============================================================================================
// registry lifecycle
// =============================================================================================

describe("registerComponents: global-persistent (site policy)", () => {
  test("survives the per-render reset()", () => {
    registerComponents({ Tex: "kbd" });
    reset(); // render()'s per-render state reset — must NOT clear registrations
    expect(decodeStatic(el(Tex, ["x"]))).toBe("<kbd>x</kbd>");
  });

  test("re-registration replaces; clearing (named / all) restores the fallback", () => {
    registerComponents({ Tex: "kbd" });
    registerComponents({ Tex: "mark" });
    expect(registeredComponent("Tex")).toBe("mark");
    clearRegisteredComponents("Tex");
    expect(registeredComponent("Tex")).toBeUndefined();
    expect(decodeStatic(el(Tex, ["x"]))).toBe(
      '<span class="tex-default">x</span>'
    );
  });
});

// =============================================================================================
// RawHtml static path
// =============================================================================================

describe("RawHtml in the static path", () => {
  test("struct passes a raw root through untouched", () => {
    const r = raw("<math><mi>x</mi></math>");
    expect(struct(r)).toBe(r);
  });

  test("serialize emits raw verbatim — contrast with escaped text", () => {
    expect(serialize(raw('<math display="block"/>'))).toBe(
      '<math display="block"/>'
    );
    expect(serialize('<math display="block"/>')).toBe(
      "&lt;math display=&quot;block&quot;/&gt;"
    );
  });

  test("a raw sibling is inline: joins the paragraph run", () => {
    const html = decodeStatic(
      frag(["before ", raw("<math><mi>x</mi></math>"), " after"])
    );
    expect(html).toBe("<p>before <math><mi>x</mi></math> after</p>");
  });

  test("a BLOCK raw sibling flushes the run and is never <p>-wrapped", () => {
    const html = decodeStatic(
      frag([
        "text",
        "\n",
        "\n",
        raw("<pre>x</pre>", { block: true }),
        "\n",
        "\n",
        "tail"
      ])
    );
    expect(html).toBe("<p>text</p><pre>x</pre><p>tail</p>");
  });

  test("a template returning a raw leaf decodes verbatim (the KaTeX-default shape)", () => {
    const TexRaw = ({ children }: CompProps) =>
      raw(`<math><mi>${(children as string[]).join("")}</mi></math>`);
    const S = slot("TexRaw", TexRaw);
    expect(decodeStatic(frag([el(S, ["y"])]))).toBe(
      "<p><math><mi>y</mi></math></p>"
    );
  });
});
