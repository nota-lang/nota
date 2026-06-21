/**
 * Phase K — `bootIslands` under jsdom (implementation.md §2.4, §2.7). Two angles:
 *
 * - **wiring** (stub adapter): `bootIslands` finds each island's DOM node by `data-hydration-id` and
 *   calls `adapter.hydrate(registry[comp](props), node)` once per manifest entry — and skips ids
 *   with no DOM node or no registry entry.
 * - **live** (real React adapter): a rendered island is actually hydrated over its server DOM and
 *   becomes interactive (click → state change). Closes the SSG→client arc Part 3 builds the registry
 *   for. Uses a *childless* island (a counter) so hydration needs no static-slot reconstruction —
 *   that slot-rehydration is Part 3's registry concern; Part 2 fixes only the boot contract.
 */

import reactAdapter from "@nota-lang/react";
import {
  bootIslands,
  type CompProps,
  clearAdapter,
  inlineComponent,
  type Manifest,
  render,
  setAdapter
} from "@nota-lang/runtime";
import { useState } from "react";
import { afterEach, beforeEach, describe, expect, test } from "vitest";

afterEach(() => {
  clearAdapter();
  document.body.innerHTML = "";
});

// =============================================================================================
// wiring (stub adapter)
// =============================================================================================

describe("bootIslands (wiring, stub adapter)", () => {
  function stubAdapter() {
    const calls: { el: unknown; container: unknown }[] = [];
    return {
      adapter: {
        h: () => ({}),
        Fragment: () => ({}),
        renderToString: () => "",
        hydrate: (el: unknown, container: unknown) => {
          calls.push({ el, container });
        }
      },
      calls
    };
  }

  test("hydrates each manifest island over its [data-hydration-id] node", () => {
    const { adapter, calls } = stubAdapter();
    setAdapter(adapter);

    document.body.innerHTML =
      '<ul><li><nota-island data-hydration-id="1">x</nota-island></li>' +
      '<li><nota-island data-hydration-id="2">y</nota-island></li></ul>';

    const manifest: Manifest = {
      "1": { comp: "C", props: { k: 1 } },
      "2": { comp: "C", props: { k: 2 } }
    };
    const made: Record<string, unknown>[] = [];
    const registry = {
      C: (props: Record<string, unknown>) => {
        made.push(props);
        return { isC: true, props };
      }
    };

    bootIslands(manifest, registry);

    expect(calls).toHaveLength(2);
    // built with the manifest props, in order
    expect(made).toEqual([{ k: 1 }, { k: 2 }]);
    // hydrated into the correct nodes
    expect(
      (calls[0].container as Element).getAttribute("data-hydration-id")
    ).toBe("1");
    expect(
      (calls[1].container as Element).getAttribute("data-hydration-id")
    ).toBe("2");
    expect(calls[0].el).toEqual({ isC: true, props: { k: 1 } });
  });

  test("skips an id with no DOM node and an id with no registry entry", () => {
    const { adapter, calls } = stubAdapter();
    setAdapter(adapter);

    // only id 2 is present in the DOM; only "C" is registered.
    document.body.innerHTML =
      '<nota-island data-hydration-id="2">y</nota-island>' +
      '<nota-island data-hydration-id="3">z</nota-island>';

    const manifest: Manifest = {
      "1": { comp: "C", props: {} }, // no DOM node → skip
      "2": { comp: "C", props: {} }, // present + registered → hydrate
      "3": { comp: "Missing", props: {} } // present but not registered → skip
    };
    const registry = { C: (p: Record<string, unknown>) => ({ p }) };

    bootIslands(manifest, registry);

    expect(calls).toHaveLength(1);
    expect(
      (calls[0].container as Element).getAttribute("data-hydration-id")
    ).toBe("2");
  });

  test("accepts an explicit root element (no ambient document needed)", () => {
    const { adapter, calls } = stubAdapter();
    setAdapter(adapter);

    const root = document.createElement("div");
    root.innerHTML = '<nota-island data-hydration-id="1">x</nota-island>';
    const manifest: Manifest = { "1": { comp: "C", props: {} } };
    bootIslands(manifest, { C: () => ({}) }, root);

    expect(calls).toHaveLength(1);
  });
});

// =============================================================================================
// live (real React adapter): SSG → DOM → bootIslands → interactive
// =============================================================================================

describe("bootIslands (live, React adapter)", () => {
  beforeEach(() => setAdapter(reactAdapter));

  // A childless counter island: `useState` count, +1 on click. Childless → no static-slot
  // rehydration needed (that is Part 3's registry concern). It is the marked `CompFn`; React must
  // *call* it during render (so its hooks run), which both `island` and the registry below do via
  // `adapter.h(Counter, props, …)` → `createElement(Counter, props)` (never invoking it eagerly).
  const Counter = inlineComponent((_children: CompProps["children"]) => {
    const [n, setN] = useState(0);
    return reactAdapter.h(
      "button",
      { type: "button", onClick: () => setN(v => v + 1) },
      [`count: ${n}`]
    );
  }, "Counter");

  test("a rendered island hydrates and becomes interactive (click → count++)", async () => {
    // The document is a single childless island boundary at its root.
    const Doc = (): { tag: typeof Counter; props: object; children: [] } => ({
      tag: Counter,
      props: {},
      children: []
    });

    const { html, manifest } = render(Doc);

    // SSR shell present, wrapped in the marker.
    expect(html).toMatch(
      /<nota-island data-hydration-id="1"><button[^>]*>count: 0<\/button><\/nota-island>/
    );
    expect(manifest).toEqual({ "1": { comp: "Counter", props: {} } });

    // place server HTML into the document, then boot.
    document.body.innerHTML = html;

    // registry: name → an element factory that lets React *call* the component during render
    // (so hooks run + hydration matches). This is the shape Part 3's registry generator emits.
    const registry = {
      Counter: (props: Record<string, unknown>) =>
        reactAdapter.h(Counter, props, [])
    };

    bootIslands(manifest, registry);
    await flush();

    const button = document.querySelector("button");
    expect(button).not.toBeNull();
    expect(button?.textContent).toBe("count: 0");

    button?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    await flush();

    expect(document.querySelector("button")?.textContent).toBe("count: 1");
  });
});

async function flush(): Promise<void> {
  await Promise.resolve();
  await new Promise(r => setTimeout(r, 0));
}
