/**
 * `generateClientEntry` tests — the data-only boot entry.
 *
 * All hydration *logic* (comp resolution, element builders, slot recovery, the boot loop) lives in
 * the runtime's `boot.ts` — unit-tested there. What this generator owns, and what these tests pin,
 * is the document **data** + wiring:
 *   - the manifest embedded as a literal (self-contained — no fetch / DOM coupling);
 *   - the compiled module imported as a **namespace** (a manifest comp may be a registered
 *     override the module does not export — contract R14b — and a named import of a missing
 *     export is a bundle-time error), only when islands exist;
 *   - the optional setup module imported for side effects before boot;
 *   - `setAdapter(adapter); bootIslandsWithSlots(manifest, islandRegistry(manifest, module))`.
 *
 * `generateClientEntry` is a pure `manifest → string` generator, so these are string assertions —
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

describe("generateClientEntry (data-only boot entry)", () => {
  test("imports the runtime boot surface + the compiled module as a namespace", () => {
    const out = generateClientEntry(GOLDEN_MANIFEST, {
      moduleId: "./doc.compiled.js"
    });
    expect(out).toContain(
      'import { setAdapter, islandRegistry, bootIslandsWithSlots } from "@nota-lang/runtime";'
    );
    expect(out).toContain(
      'import * as _islandModule from "./doc.compiled.js";'
    );
    // No hydration logic is stamped into the entry — it lives in the runtime.
    expect(out).not.toContain("function resolveComp");
    expect(out).not.toContain("function bootIslandsWithSlots");
    expect(out).not.toContain("querySelector");
  });

  test("boots via the runtime: registry derived from manifest + module, adapter set first", () => {
    const out = generateClientEntry(GOLDEN_MANIFEST, {
      moduleId: "./doc.compiled.js"
    });
    expect(out).toContain('import adapter from "@nota-lang/react";');
    expect(out).toContain("setAdapter(adapter);");
    expect(out).toContain(
      "bootIslandsWithSlots(manifest, islandRegistry(manifest, _islandModule));"
    );
    // setAdapter precedes the boot (islands hydrate through the chosen framework).
    expect(out.indexOf("setAdapter(adapter)")).toBeLessThan(
      out.indexOf("bootIslandsWithSlots(")
    );
  });

  test("the setup module is imported for side effects before boot", () => {
    const out = generateClientEntry(GOLDEN_MANIFEST, {
      moduleId: "./doc.compiled.js",
      setupModule: "/site/setup.mjs"
    });
    expect(out).toContain('import "/site/setup.mjs";');
    expect(out.indexOf('import "/site/setup.mjs";')).toBeLessThan(
      out.indexOf("bootIslandsWithSlots(")
    );
  });

  test("embeds the manifest as a literal (self-contained — no fetch / DOM coupling)", () => {
    const out = generateClientEntry(GOLDEN_MANIFEST, {
      moduleId: "./doc.compiled.js"
    });
    expect(out).toContain(
      `const manifest = ${JSON.stringify(GOLDEN_MANIFEST)};`
    );
  });

  test("an island-free manifest → no module import, an empty registry (boot no-ops)", () => {
    const out = generateClientEntry({}, { moduleId: "./m.js" });
    expect(out).not.toContain('from "./m.js"');
    expect(out).toContain("const manifest = {};");
    expect(out).toContain("bootIslandsWithSlots(manifest, {});");
  });

  test("adapterModule / runtimeModule are overridable (one adapter per build)", () => {
    const out = generateClientEntry(GOLDEN_MANIFEST, {
      moduleId: "./m.js",
      adapterModule: "@nota-lang/solid",
      runtimeModule: "/abs/runtime.js"
    });
    expect(out).toContain('import adapter from "@nota-lang/solid";');
    expect(out).toContain(
      'import { setAdapter, islandRegistry, bootIslandsWithSlots } from "/abs/runtime.js";'
    );
  });

  test("the generated entry is a syntactically valid ES module", () => {
    const out = generateClientEntry(GOLDEN_MANIFEST, { moduleId: "./m.js" });
    // Strip the (import-only) statements `new Function` can't parse, then prove the body tokenizes.
    const body = out.replace(/^import .*$/gm, "");
    expect(() => new Function(body)).not.toThrow();
  });
});
