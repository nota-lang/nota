/**
 * Client-boot unit tests: `islandRegistry` / `resolveIslandComponent` / `bootIslandsWithSlots` —
 * the document-independent hydration logic that used to be stamped into every generated client
 * entry (now emitted as data-only entries that call these).
 */

import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import {
  type Adapter,
  bootIslandsWithSlots,
  clearAdapter,
  clearRegisteredComponents,
  islandRegistry,
  type Manifest,
  registerComponents,
  resolveIslandComponent,
  setAdapter
} from "../src/lib";

/** A recording adapter: h returns a sentinel element; hydrate logs (element, node). */
function makeAdapter() {
  const hydrated: { el: unknown; node: unknown }[] = [];
  const adapter: Adapter = {
    h: (tag, props, children) => ({ tag, props, children }),
    Fragment: (props, children) => ({ props, children }),
    renderToString: () => "",
    hydrate(el, node) {
      hydrated.push({ el, node });
    }
  };
  return { adapter, hydrated };
}

/** A fake island marker node + a root that serves it by hydration id. */
function domWith(
  nodes: Record<string, { firstInner?: string; inner?: string }>
) {
  const built: Record<string, unknown> = {};
  for (const [id, spec] of Object.entries(nodes)) {
    built[id] = {
      firstElementChild:
        spec.firstInner === undefined ? null : { innerHTML: spec.firstInner },
      innerHTML: spec.inner ?? ""
    };
  }
  return {
    nodes: built,
    root: {
      querySelector(sel: string) {
        const id = sel.match(/data-hydration-id="([^"]+)"/)?.[1] ?? "";
        return built[id] ?? null;
      }
    }
  };
}

const Comp = () => "el";
let rec: ReturnType<typeof makeAdapter>;

beforeEach(() => {
  rec = makeAdapter();
  setAdapter(rec.adapter);
});
afterEach(() => {
  clearAdapter();
  clearRegisteredComponents();
  vi.restoreAllMocks();
});

describe("resolveIslandComponent", () => {
  test("module export wins; registry is the fallback (R14b); miss logs a pointed error", () => {
    const err = vi.spyOn(console, "error").mockImplementation(() => {});
    registerComponents({ A: "kbd", B: "mark" });
    expect(resolveIslandComponent({ A: Comp }, "A")).toBe(Comp);
    expect(resolveIslandComponent({}, "B")).toBe("mark");
    expect(resolveIslandComponent({}, "C")).toBeUndefined();
    expect(err).toHaveBeenCalledWith(
      expect.stringContaining('no client component for island "C"')
    );
  });
});

describe("islandRegistry", () => {
  const manifest: Manifest = {
    "1": { comp: "A", props: { x: 1 } },
    "2": { comp: "A", props: { x: 2 } },
    "3": { comp: "B", props: {} }
  };

  test("one builder per DISTINCT comp; builds via adapter.h, never invokes", () => {
    const registry = islandRegistry(manifest, { A: Comp, B: Comp });
    expect(Object.keys(registry).sort()).toEqual(["A", "B"]);
    const el = registry.A({ x: 1 }) as { tag: unknown; children: unknown };
    expect(el.tag).toBe(Comp); // built, not invoked (no "el" result)
    expect(el.children).toEqual([]); // childless default
  });

  test("resolution happens at build time, so a later registration is seen", () => {
    const registry = islandRegistry(manifest, {});
    vi.spyOn(console, "error").mockImplementation(() => {});
    expect(registry.A({})).toBeNull(); // unresolvable now
    registerComponents({ A: Comp });
    expect((registry.A({}) as { tag: unknown }).tag).toBe(Comp); // resolvable after
  });
});

describe("bootIslandsWithSlots", () => {
  test("recovers the slot from the SSR'd component root and hydrates over the marker", () => {
    const manifest: Manifest = { "1": { comp: "A", props: { p: 1 } } };
    const { root, nodes } = domWith({
      "1": { firstInner: "<b>static slot</b>" }
    });
    bootIslandsWithSlots(manifest, islandRegistry(manifest, { A: Comp }), root);
    expect(rec.hydrated).toHaveLength(1);
    const { el, node } = rec.hydrated[0];
    expect(node).toBe(nodes["1"]);
    const built = el as { props: unknown; children: { html?: string } };
    expect(built.props).toEqual({ p: 1 });
    expect(built.children.html).toBe("<b>static slot</b>"); // raw(slot)
  });

  test("no element child → marker innerHTML; empty → childless boot ([])", () => {
    const manifest: Manifest = {
      "1": { comp: "A", props: {} },
      "2": { comp: "A", props: {} }
    };
    const { root } = domWith({ "1": { inner: "bare text" }, "2": {} });
    bootIslandsWithSlots(manifest, islandRegistry(manifest, { A: Comp }), root);
    const [a, b] = rec.hydrated.map(
      h => (h.el as { children: unknown }).children
    );
    expect((a as { html: string }).html).toBe("bare text");
    expect(b).toEqual([]);
  });

  test("lenient skips: missing node, missing registry entry, unresolvable comp", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const manifest: Manifest = {
      "1": { comp: "A", props: {} }, // no DOM node
      "2": { comp: "B", props: {} }, // not in registry
      "3": { comp: "C", props: {} } // in registry but unresolvable
    };
    const { root } = domWith({ "2": {}, "3": {} });
    const registry = islandRegistry(
      { "1": manifest["1"], "3": manifest["3"] },
      {} // C unresolvable; A's node missing; B absent from the registry entirely
    );
    bootIslandsWithSlots(manifest, registry, root);
    expect(rec.hydrated).toHaveLength(0);
  });
});
