/**
 * **Part 3 M — `generateClientEntry` tests** (implementation.md §3.6 layer 2 — "Registry
 * generation"; contract §8 "Part-3 handoffs").
 *
 * From a `render()` manifest, assert the generated client boot-entry module:
 *   - imports each **distinct** island component **by its F1 exported name** from the compiled module
 *     (validates F1 end-to-end — the manifest `comp` is an importable export);
 *   - **builds** the element (`adapter.h(Component, props, …)`) and does **NOT** eagerly invoke the
 *     component (contract §8: the framework must call it during render so hooks/signals run);
 *   - `setAdapter`s the adapter and calls `bootIslands(manifest, registry)`.
 *
 * M is a pure `manifest → string` generator, so these are string/AST assertions — no bundler needed
 * (the CLI's Q-path e2e exercises the bundled+booted form for real). We additionally parse the output
 * with the stock JS parser to prove it is a syntactically valid module.
 */

import type { Manifest } from "@nota-lang/runtime";
import { describe, expect, test } from "vitest";
import { generateClientEntry } from "../src/registry";

// The canonical golden's manifest (contract §2 stage-5): two islands, both `Colorized`.
const GOLDEN_MANIFEST: Manifest = {
  "1": { comp: "Colorized", props: {} },
  "2": { comp: "Colorized", props: {} }
};

describe("generateClientEntry (Part 3 M — registry/boot helper)", () => {
  test("imports each DISTINCT island by its F1 exported name from the compiled module", () => {
    const out = generateClientEntry(GOLDEN_MANIFEST, {
      moduleId: "./doc.compiled.js"
    });
    // F1: the manifest `comp` ("Colorized") is imported by name from the compiled module id.
    expect(out).toContain(
      'import { Colorized as _island_Colorized } from "./doc.compiled.js";'
    );
    // De-duplicated: two islands of the same comp ⇒ exactly one import of `Colorized`.
    const importCount = (out.match(/Colorized as _island_Colorized/g) ?? [])
      .length;
    expect(importCount).toBe(1);
  });

  test("BUILDS the element (adapter.h), does NOT eagerly invoke the component (contract §8)", () => {
    const out = generateClientEntry(GOLDEN_MANIFEST, {
      moduleId: "./doc.compiled.js"
    });
    // registry entry is an element-builder taking `(props, slot)`: `adapter.h(Comp, props, slot ?? [])`.
    expect(out).toContain(
      '"Colorized": (props, slot) => adapter.h(_island_Colorized, props, slot ?? [])'
    );
    // It must NOT eagerly invoke the component, i.e. never `_island_Colorized(props)` directly.
    expect(out).not.toMatch(/_island_Colorized\s*\(/);
  });

  test("setAdapter(adapter) then boots (slot-aware boot; bootIslands kept as reference)", () => {
    const out = generateClientEntry(GOLDEN_MANIFEST, {
      moduleId: "./doc.compiled.js"
    });
    expect(out).toContain('import adapter from "@nota-lang/react";');
    // The runtime imports include `bootIslands` (the slot-agnostic reference) + the `raw`/`getAdapter`
    // the slot-aware boot needs (contract §8: slot rehydration is Part 3's job).
    expect(out).toContain(
      'import { setAdapter, getAdapter, bootIslands, raw } from "@nota-lang/runtime";'
    );
    expect(out).toContain("setAdapter(adapter);");
    // The generated entry runs the slot-aware boot (which specializes bootIslands to preserve slots).
    expect(out).toContain("bootIslandsWithSlots(manifest, registry);");
    // setAdapter precedes the boot (adapter must be set before islands hydrate through it).
    expect(out.indexOf("setAdapter(adapter)")).toBeLessThan(
      out.indexOf("bootIslandsWithSlots(manifest, registry)")
    );
    // it selects islands by the contract §8 marker and recovers the slot from the DOM.
    expect(out).toContain('[data-hydration-id="');
    expect(out).toContain("firstElementChild");
  });

  test("embeds the manifest as a literal (self-contained — no fetch / DOM coupling)", () => {
    const out = generateClientEntry(GOLDEN_MANIFEST, {
      moduleId: "./doc.compiled.js"
    });
    expect(out).toContain(
      `const manifest = ${JSON.stringify(GOLDEN_MANIFEST)};`
    );
  });

  test("multiple distinct islands → one import + one registry entry each", () => {
    const manifest: Manifest = {
      "1": { comp: "Colorized", props: {} },
      "2": { comp: "Counter", props: { start: 3 } },
      "3": { comp: "Colorized", props: {} }
    };
    const out = generateClientEntry(manifest, { moduleId: "./m.js" });
    // both distinct names imported, once each
    expect(out).toContain("Colorized as _island_Colorized");
    expect(out).toContain("Counter as _island_Counter");
    expect(
      (out.match(/_island_Colorized/g) ?? []).length
    ).toBeGreaterThanOrEqual(2); // import + registry
    // a registry entry per distinct name
    expect(out).toContain(
      '"Colorized": (props, slot) => adapter.h(_island_Colorized, props, slot ?? [])'
    );
    expect(out).toContain(
      '"Counter": (props, slot) => adapter.h(_island_Counter, props, slot ?? [])'
    );
  });

  test("an island-free manifest → no component imports, still boots (no-op)", () => {
    const out = generateClientEntry({}, { moduleId: "./m.js" });
    // No island imports from the compiled module.
    expect(out).not.toContain('from "./m.js"');
    // Still a valid boot call with an empty manifest + empty registry.
    expect(out).toContain("const manifest = {};");
    expect(out).toContain("bootIslandsWithSlots(manifest, registry);");
  });

  test("adapterModule / runtimeModule are overridable (one adapter per build, contract §F4)", () => {
    const out = generateClientEntry(GOLDEN_MANIFEST, {
      moduleId: "./m.js",
      adapterModule: "@nota-lang/solid",
      runtimeModule: "/abs/runtime.js"
    });
    expect(out).toContain('import adapter from "@nota-lang/solid";');
    expect(out).toContain(
      'import { setAdapter, getAdapter, bootIslands, raw } from "/abs/runtime.js";'
    );
  });

  test("the generated entry is a syntactically valid ES module", () => {
    const out = generateClientEntry(GOLDEN_MANIFEST, { moduleId: "./m.js" });
    // Strip the (import-only) statements `new Function` can't parse, then prove the body tokenizes.
    const body = out.replace(/^import .*$/gm, "");
    expect(() => new Function(body)).not.toThrow();
  });
});
