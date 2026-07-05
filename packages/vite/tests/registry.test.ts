/**
 * `generateClientEntry` tests — the wiring-only replay-hydration entry (contract R15).
 *
 * All hydration *logic* (the capture replay, the determinism guard, the per-island hydrate loop)
 * lives in the runtime's `hydrate.ts` — unit-tested there. What this generator owns, and what these
 * tests pin, is the wiring:
 *   - the compiled module's **default export** (`Doc`) imported and handed to `hydrateDocument`
 *     (no manifest literal, no namespace import, no registry — the replay recovers everything);
 *   - the adapter imported and `setAdapter`'d before `hydrateDocument`;
 *   - the optional setup module imported for side effects, with `bakeConfigBaseline()` called
 *     before `hydrateDocument` (the replay's `reset()` restores the baked baseline — the client
 *     must mirror the CLI's SSR setup-bake or the recomputed slot bytes could diverge).
 *
 * `generateClientEntry` is a pure `opts → string` generator, so these are string assertions — no
 * bundler needed (the CLI's end-to-end tests exercise the bundled+hydrated form for real). We
 * additionally parse the output with the stock JS parser to prove it is a syntactically valid module.
 */

import { describe, expect, test } from "vitest";
import { generateClientEntry } from "../src/registry";

describe("generateClientEntry (wiring-only replay entry)", () => {
  test("imports the runtime replay surface + the compiled module's default export", () => {
    const out = generateClientEntry({ moduleId: "./doc.compiled.js" });
    expect(out).toContain(
      'import { setAdapter, hydrateDocument } from "@nota-lang/runtime";'
    );
    expect(out).toContain('import Doc from "./doc.compiled.js";');
    // No hydration logic and no document data are stamped into the entry — the replay recovers
    // per-island data live; the manifest/registry transport is gone (R15).
    expect(out).not.toContain("manifest");
    expect(out).not.toContain("islandRegistry");
    expect(out).not.toContain("bootIslands");
    expect(out).not.toContain("querySelector");
    expect(out).not.toContain("import * as");
  });

  test("hydrates via the runtime: setAdapter first, then hydrateDocument(Doc)", () => {
    const out = generateClientEntry({ moduleId: "./doc.compiled.js" });
    expect(out).toContain('import adapter from "@nota-lang/react";');
    expect(out).toContain("setAdapter(adapter);");
    expect(out).toContain("hydrateDocument(Doc);");
    // setAdapter precedes the replay (islands capture/hydrate through the chosen framework).
    expect(out.indexOf("setAdapter(adapter)")).toBeLessThan(
      out.indexOf("hydrateDocument(")
    );
  });

  test("the setup module is imported for side effects, and the config baseline is baked", () => {
    const out = generateClientEntry({
      moduleId: "./doc.compiled.js",
      setupModule: "/site/setup.mjs"
    });
    expect(out).toContain('import "/site/setup.mjs";');
    expect(out).toContain(
      'import { bakeConfigBaseline } from "@nota-lang/prelude";'
    );
    expect(out).toContain("bakeConfigBaseline();");
    // setup import precedes the Doc import (its registerComponents/lstset side effects run first);
    // the bake lands after setAdapter and before hydrateDocument (the replay resets to the baked
    // baseline — mirroring the CLI's SSR entry).
    expect(out.indexOf('import "/site/setup.mjs";')).toBeLessThan(
      out.indexOf("import Doc from")
    );
    expect(out.indexOf("bakeConfigBaseline();")).toBeGreaterThan(
      out.indexOf("setAdapter(adapter);")
    );
    expect(out.indexOf("bakeConfigBaseline();")).toBeLessThan(
      out.indexOf("hydrateDocument(")
    );
  });

  test("no setup module → no prelude import, no bake call", () => {
    const out = generateClientEntry({ moduleId: "./doc.compiled.js" });
    expect(out).not.toContain("bakeConfigBaseline");
    expect(out).not.toContain("@nota-lang/prelude");
  });

  test("adapterModule / runtimeModule are overridable (one adapter per build)", () => {
    const out = generateClientEntry({
      moduleId: "./m.js",
      adapterModule: "@nota-lang/solid",
      runtimeModule: "/abs/runtime.js"
    });
    expect(out).toContain('import adapter from "@nota-lang/solid";');
    expect(out).toContain(
      'import { setAdapter, hydrateDocument } from "/abs/runtime.js";'
    );
  });

  test("the generated entry is a syntactically valid ES module", () => {
    const out = generateClientEntry({
      moduleId: "./m.js",
      setupModule: "/site/setup.mjs"
    });
    // Strip the (import-only) statements `new Function` can't parse, then prove the body tokenizes.
    const body = out.replace(/^import .*$/gm, "");
    expect(() => new Function(body)).not.toThrow();
  });
});
