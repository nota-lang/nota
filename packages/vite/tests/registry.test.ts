/**
 * `generateClientEntry` tests — registry generation.
 *
 * From a `render()` manifest, assert the generated client boot-entry module:
 *   - imports the compiled module as a **namespace** and resolves each distinct island comp at
 *     hydrate time — module export ?? runtime-registered override (contract R14b; a *registered*
 *     island component is not a module export, so a named import would fail at bundle time);
 *   - **builds** the element (`adapter.h(resolveComp(name), props, …)`) and does **NOT** eagerly
 *     invoke the component (the framework must call it during render so hooks/signals run);
 *   - `setAdapter`s the adapter and calls the slot-aware boot;
 *   - imports the optional setup module for side effects before boot.
 *
 * `generateClientEntry` is a pure `manifest → string` generator, so these are string/AST assertions —
 * no bundler needed (the CLI's end-to-end tests exercise the bundled+booted form for real). We
 * additionally parse the output with the stock JS parser to prove it is a syntactically valid module.
 */

import type { Manifest } from "@nota-lang/runtime";
import { describe, expect, test } from "vitest";
import { generateClientEntry } from "../src/registry";

// The canonical golden's manifest (the SSG output): two islands, both `Colorized`.
const GOLDEN_MANIFEST: Manifest = {
  "1": { comp: "Colorized", props: {} },
  "2": { comp: "Colorized", props: {} }
};

describe("generateClientEntry (registry/boot helper)", () => {
  test("imports the compiled module as a namespace + resolves comps at hydrate time (R14b)", () => {
    const out = generateClientEntry(GOLDEN_MANIFEST, {
      moduleId: "./doc.compiled.js"
    });
    // Namespace import — a manifest comp may be a registered override the module does not export,
    // and a named import of a missing export is a bundle-time error.
    expect(out).toContain(
      'import * as _islandModule from "./doc.compiled.js";'
    );
    // Resolution: module export first, else the runtime component registry.
    expect(out).toContain(
      "const comp = _islandModule[name] ?? registeredComponent(name);"
    );
    // De-duplicated: two islands of the same comp ⇒ exactly one registry entry.
    const entryCount = (out.match(/"Colorized": \(props, slot\)/g) ?? [])
      .length;
    expect(entryCount).toBe(1);
  });

  test("BUILDS the element (adapter.h), does NOT eagerly invoke the component", () => {
    const out = generateClientEntry(GOLDEN_MANIFEST, {
      moduleId: "./doc.compiled.js"
    });
    // registry entry is an element-builder taking `(props, slot)`: `adapter.h(resolveComp(n), props, slot ?? [])`.
    expect(out).toContain(
      '"Colorized": (props, slot) => adapter.h(resolveComp("Colorized"), props, slot ?? [])'
    );
    // It must NOT eagerly invoke the resolved component: `resolveComp(...)` only ever appears as
    // adapter.h's first ARGUMENT, never called with props itself.
    expect(out).not.toMatch(/resolveComp\("[^"]*"\)\s*\(/);
  });

  test("the setup module is imported for side effects before boot", () => {
    const out = generateClientEntry(GOLDEN_MANIFEST, {
      moduleId: "./doc.compiled.js",
      setupModule: "/site/setup.mjs"
    });
    expect(out).toContain('import "/site/setup.mjs";');
    // registrations must land before the boot call reads the registry
    expect(out.indexOf('import "/site/setup.mjs";')).toBeLessThan(
      out.indexOf("bootIslandsWithSlots(manifest, registry)")
    );
  });

  test("setAdapter(adapter) then boots (slot-aware boot; bootIslands kept as reference)", () => {
    const out = generateClientEntry(GOLDEN_MANIFEST, {
      moduleId: "./doc.compiled.js"
    });
    expect(out).toContain('import adapter from "@nota-lang/react";');
    // The runtime imports include `bootIslands` (the slot-agnostic reference), the `raw`/`getAdapter`
    // the slot-aware boot needs, and `registeredComponent` (override resolution — R14b).
    expect(out).toContain(
      'import { setAdapter, getAdapter, bootIslands, raw, registeredComponent } from "@nota-lang/runtime";'
    );
    expect(out).toContain("setAdapter(adapter);");
    // The generated entry runs the slot-aware boot (which specializes bootIslands to preserve slots).
    expect(out).toContain("bootIslandsWithSlots(manifest, registry);");
    // setAdapter precedes the boot (adapter must be set before islands hydrate through it).
    expect(out.indexOf("setAdapter(adapter)")).toBeLessThan(
      out.indexOf("bootIslandsWithSlots(manifest, registry)")
    );
    // it selects islands by the hydration-id marker and recovers the slot from the DOM.
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
    // one namespace import; a registry entry per distinct name
    expect(out).toContain('import * as _islandModule from "./m.js";');
    expect(out).toContain(
      '"Colorized": (props, slot) => adapter.h(resolveComp("Colorized"), props, slot ?? [])'
    );
    expect(out).toContain(
      '"Counter": (props, slot) => adapter.h(resolveComp("Counter"), props, slot ?? [])'
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

  test("adapterModule / runtimeModule are overridable (one adapter per build)", () => {
    const out = generateClientEntry(GOLDEN_MANIFEST, {
      moduleId: "./m.js",
      adapterModule: "@nota-lang/solid",
      runtimeModule: "/abs/runtime.js"
    });
    expect(out).toContain('import adapter from "@nota-lang/solid";');
    expect(out).toContain(
      'import { setAdapter, getAdapter, bootIslands, raw, registeredComponent } from "/abs/runtime.js";'
    );
  });

  test("the generated entry is a syntactically valid ES module", () => {
    const out = generateClientEntry(GOLDEN_MANIFEST, { moduleId: "./m.js" });
    // Strip the (import-only) statements `new Function` can't parse, then prove the body tokenizes.
    const body = out.replace(/^import .*$/gm, "");
    expect(() => new Function(body)).not.toThrow();
  });
});
