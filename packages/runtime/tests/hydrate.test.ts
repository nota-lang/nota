/**
 * Replay-hydration driver tests (contract R15): `captureRender` + `hydrateDocument`, driven by a
 * **stub adapter** and a **fake root** (no framework, no jsdom). Asserts:
 *
 * - **id parity** — the same `freshId` sequence is minted whether the document is rendered
 *   (SSG, `▸`-flag off, `capturing` off) or replayed (`capturing` on), *including* a nested island
 *   inside a parent's slot; capture records only the depth-0 boundaries, but the manifest (written
 *   in both modes) proves the ids match.
 * - **determinism guard** — a captured-vs-DOM id-set mismatch throws **before** any hydration.
 * - **empty slot** — a childless island hydrates with `[]`, not a `raw` slot.
 * - **teardowns + leniency** — `hydrateDocument` returns one teardown per hydrated island, and a
 *   single island's failure is caught (logged) without aborting the rest.
 */

import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import {
  type Adapter,
  type CompFn,
  captureRender,
  clearAdapter,
  type ElementVNode,
  FRAG,
  getManifest,
  type HydrationRoot,
  hydrateDocument,
  inlineComponent,
  isRaw,
  render,
  reset,
  setAdapter,
  type VNode
} from "../src/lib";

// ---------------------------------------------------------------------------------------------
// vnode builder
// ---------------------------------------------------------------------------------------------

function el(
  tag: ElementVNode["tag"],
  children: VNode[] = [],
  props: Record<string, unknown> = {}
): ElementVNode {
  return { tag, props, children };
}

// ---------------------------------------------------------------------------------------------
// Stub adapter (records h + hydrate calls; hydrate returns a numbered teardown)
// ---------------------------------------------------------------------------------------------

interface HCall {
  tag: unknown;
  props: Record<string, unknown> | null;
  children: unknown;
}

function makeStubAdapter() {
  const hCalls: HCall[] = [];
  const hydrated: { el: unknown; node: unknown }[] = [];
  const teardownCalls: number[] = [];
  let teardownSeq = 0;
  const adapter: Adapter = {
    h(tag, props, children) {
      const call = { tag, props, children };
      hCalls.push(call);
      return { call };
    },
    Fragment(props, children) {
      return { frag: true, props, children };
    },
    renderToString() {
      return "<stub/>";
    },
    hydrate(elem, container) {
      hydrated.push({ el: elem, node: container });
      const seq = ++teardownSeq;
      return () => {
        teardownCalls.push(seq);
      };
    }
  };
  return { adapter, hCalls, hydrated, teardownCalls };
}

// ---------------------------------------------------------------------------------------------
// Fake root: serves marker nodes by id (querySelector) and lists them all (querySelectorAll)
// ---------------------------------------------------------------------------------------------

function fakeRoot(ids: string[]): { root: HydrationRoot } {
  const nodes = ids.map(id => ({
    _id: id,
    getAttribute(name: string): string | null {
      return name === "data-hydration-id" ? id : null;
    }
  }));
  const root: HydrationRoot = {
    querySelector(sel: string) {
      const id = sel.match(/data-hydration-id="([^"]+)"/)?.[1];
      return nodes.find(n => n._id === id) ?? null;
    },
    querySelectorAll() {
      return nodes;
    }
  };
  return { root };
}

let stub: ReturnType<typeof makeStubAdapter>;

beforeEach(() => {
  stub = makeStubAdapter();
  setAdapter(stub.adapter);
  reset();
});
afterEach(() => {
  clearAdapter();
  vi.restoreAllMocks();
});

// =============================================================================================
// id parity — SSG render vs. capture replay, including a nested-in-slot island
// =============================================================================================

describe("id parity (SSG render vs. capture replay)", () => {
  // A/C are top-level islands; B is nested inside A's static children (its slot).
  const A: CompFn = inlineComponent(c => c, "A");
  const B: CompFn = inlineComponent(c => c, "B");
  const C: CompFn = inlineComponent(c => c, "C");

  // Doc: ⟨FRAG, [ A[ B["inner"] ], C["c"] ]⟩ — A wraps the nested island B.
  const Doc = (): VNode => el(FRAG, [el(A, [el(B, ["inner"])]), el(C, ["c"])]);

  test("both modes mint the same ids (outer-then-inner DFS); capture records only depth-0", () => {
    // SSG: every island SSRs and lands in the manifest → ids 1 (A), 2 (B, nested), 3 (C).
    const server = render(Doc);
    expect(Object.keys(server.manifest).sort()).toEqual(["1", "2", "3"]);

    // Replay: SAME ids minted (manifest is written in capture mode too — id parity), but only the
    // depth-0 boundaries A and C are *captured*; B is SSR'd into A's slot (slotDepth > 0), not
    // captured, and so is never independently hydrated.
    const captured = captureRender(Doc);
    expect([...captured.keys()].sort()).toEqual(["1", "3"]);
    expect(Object.keys(getManifest()).sort()).toEqual(["1", "2", "3"]);

    // A's captured slot carries B's SSR'd marker verbatim (byte-parity for the parent slot).
    expect(captured.get("1")?.slotHtml).toContain('data-hydration-id="2"');
    // The captured tags are the live boundaries themselves.
    expect(captured.get("1")?.tag).toBe(A);
    expect(captured.get("3")?.tag).toBe(C);
  });
});

// =============================================================================================
// determinism guard — mismatch aborts before hydrating anything
// =============================================================================================

describe("determinism guard", () => {
  const One: CompFn = inlineComponent(c => c, "One");
  const DocOne = (): VNode => el(One, ["x"]);

  test("an extra DOM id (not captured) throws before any hydration", () => {
    // captured = {1}; DOM = {1,2} → not equal → abort.
    const { root } = fakeRoot(["1", "2"]);
    expect(() => hydrateDocument(DocOne, { root })).toThrow(
      /did not replay deterministically/
    );
    expect(stub.hydrated).toHaveLength(0);
  });

  test("a missing DOM id (captured but absent) throws before any hydration", () => {
    // captured = {1}; DOM = {} → not equal → abort.
    const { root } = fakeRoot([]);
    expect(() => hydrateDocument(DocOne, { root })).toThrow(
      /did not replay deterministically/
    );
    expect(stub.hydrated).toHaveLength(0);
  });

  test("equal sets do not throw and hydrate the island", () => {
    const { root } = fakeRoot(["1"]);
    expect(() => hydrateDocument(DocOne, { root })).not.toThrow();
    expect(stub.hydrated).toHaveLength(1);
  });
});

// =============================================================================================
// empty slot — a childless island hydrates with [], not a raw slot
// =============================================================================================

describe("empty slot", () => {
  const Bare: CompFn = inlineComponent(c => c, "Bare");
  const DocBare = (): VNode => el(Bare, [], { n: 1 });

  test("childless island → adapter.h(tag, props, []) (no raw slot)", () => {
    const { root } = fakeRoot(["1"]);
    hydrateDocument(DocBare, { root });

    const call = stub.hCalls.find(c => c.tag === Bare);
    expect(call).toBeDefined();
    expect(call?.children).toEqual([]); // empty slot → [], not raw
    expect(isRaw(call?.children)).toBe(false);
    expect(call?.props).toEqual({ n: 1 });
    expect(stub.hydrated).toHaveLength(1);
  });
});

// =============================================================================================
// teardowns + per-island leniency
// =============================================================================================

describe("teardowns + leniency", () => {
  const P: CompFn = inlineComponent(c => c, "P");
  const Q: CompFn = inlineComponent(c => c, "Q");
  const DocPQ = (): VNode => el(FRAG, [el(P, ["p"]), el(Q, ["q"])]);

  test("returns one teardown per hydrated island; teardowns fire their handle", () => {
    const { root } = fakeRoot(["1", "2"]);
    const teardowns = hydrateDocument(DocPQ, { root });
    expect(teardowns).toHaveLength(2);
    expect(stub.teardownCalls).toEqual([]); // not called yet
    for (const t of teardowns) {
      t();
    }
    expect(stub.teardownCalls).toEqual([1, 2]);
  });

  test("one island's hydrate failure is caught (logged), the rest still hydrate", () => {
    const err = vi.spyOn(console, "error").mockImplementation(() => {});
    // An adapter whose hydrate throws for Q's element only.
    const hydrated: unknown[] = [];
    const throwing: Adapter = {
      h: (tag, props, children) => ({ tag, props, children }),
      Fragment: (props, children) => ({ props, children }),
      renderToString: () => "<stub/>",
      hydrate(elem) {
        const tag = (elem as { tag: unknown }).tag;
        if (tag === Q) {
          throw new Error("boom");
        }
        hydrated.push(elem);
        return () => {};
      }
    };
    setAdapter(throwing);

    const { root } = fakeRoot(["1", "2"]);
    const teardowns = hydrateDocument(DocPQ, { root });

    // P hydrated (teardown kept); Q threw → caught + logged, no teardown, no re-throw.
    expect(teardowns).toHaveLength(1);
    expect(hydrated).toHaveLength(1);
    expect((hydrated[0] as { tag: unknown }).tag).toBe(P);
    expect(err).toHaveBeenCalledWith(
      expect.stringContaining('failed to hydrate island "2" (Q)'),
      expect.anything()
    );
  });
});
