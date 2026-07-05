/**
 * The island registry / boot-entry helper.
 *
 * `bootIslands(manifest, registry)` (the runtime's hydration entry point) needs
 * `registry[name] → client component fn`. The reader makes every island-eligible component an
 * **independently importable module export** of the compiled `.nota` module, under a stable generated
 * name; the manifest's `comp` field *is* that exported name. So building the registry is mechanical:
 *
 * 1. embed the manifest as a literal;
 * 2. import the compiled module as a **namespace** (a manifest comp may be a *registered override*,
 *    contract R14b, that the module does not export — a named import would fail at bundle time)
 *    plus the optional setup module for its side effects (client-side `registerComponents`); and
 * 3. `setAdapter(adapter)` + `bootIslandsWithSlots(manifest, islandRegistry(manifest, module))`.
 *
 * All hydration *logic* — comp resolution (export ?? registered override), the build-don't-invoke
 * element builders, slot recovery, the boot loop — lives in the runtime (`@nota-lang/runtime`'s
 * `boot.ts`); the generated entry is document **data** only.
 *
 * The generated string is **source for a bundler** — the CLI esbuild-bundles it (registry + boot +
 * island components + adapter + runtime) into one inlinable `<script>`; the playground feeds the same
 * shape to native-ESM + import maps. This helper itself stays bundler-agnostic: it is a pure
 * `manifest → string` code generator.
 *
 * **Why the manifest is embedded as a literal.** The entry embeds the manifest inline and calls
 * `bootIslands(<literal>, registry)`, so the bundle is self-contained — no separate fetch, no DOM
 * `<script type=application/json>` coupling (manifest *delivery* is left to the integrator; the CLI
 * additionally inlines a JSON view as metadata, but boot never depends on it).
 */

import type { Manifest } from "@nota-lang/runtime";

/** Options for {@link generateClientEntry}. */
export interface ClientEntryOptions {
  /**
   * The module specifier of the **compiled `.nota` module** to import island components from. This is
   * what the manifest's exported names (`manifest.comp`) are imported from — e.g. a relative path to
   * the emitted module on disk (`"./doc.compiled.js"`), or a virtual id the bundler resolves. Required:
   * an island registry is meaningless without the module that exports the components.
   */
  moduleId: string;
  /**
   * The framework **adapter** module specifier (default `"@nota-lang/react"`). Its *default export*
   * is the `Adapter`; the entry `setAdapter`s it before `bootIslands` (so islands hydrate through the
   * chosen framework). One adapter per build.
   */
  adapterModule?: string;
  /**
   * The `@nota-lang/runtime` specifier (default `"@nota-lang/runtime"`). Overridable for tests /
   * non-standard layouts; `setAdapter` + `bootIslands` are imported from here.
   */
  runtimeModule?: string;
  /**
   * Optional **site setup module** specifier, imported for side effects *before* boot (contract
   * R14b): its `registerComponents({…})` calls re-run on the client, so an island whose component
   * was registered (not exported from the compiled module) resolves at hydrate time. Mirror of the
   * CLI's `--setup`.
   */
  setupModule?: string;
}

/**
 * Generate a client **boot-entry module** (as a JS source string) for a `render()` manifest.
 *
 * The emitted module is document data + wiring only (see the module docs): runtime imports, the
 * adapter (default export), the optional setup import, the compiled module namespace, the manifest
 * literal, and `setAdapter(adapter); bootIslandsWithSlots(manifest, islandRegistry(manifest,
 * module))`.
 *
 * @param manifest the manifest returned by `render(Doc)` (`Record<id, { comp, props }>`)
 * @param opts     {@link ClientEntryOptions} (at least `moduleId`)
 * @returns the boot-entry module source — feed it to a bundler (esbuild for the CLI)
 */
export function generateClientEntry(
  manifest: Manifest,
  opts: ClientEntryOptions
): string {
  const adapterModule = opts.adapterModule ?? "@nota-lang/react";
  const runtimeModule = opts.runtimeModule ?? "@nota-lang/runtime";

  const hasIslands = Object.keys(manifest).length > 0;

  // Import the setup module (side effects: client-side registerComponents) before boot resolves.
  const setupImport =
    opts.setupModule !== undefined
      ? `import ${JSON.stringify(opts.setupModule)};\n`
      : "";

  // The compiled module is imported as a **namespace** (not named imports): a manifest comp may be
  // a *registered override* (contract R14b) that the module does not export, and a named import of
  // a missing export is a bundle-time error. `islandRegistry`/`bootIslandsWithSlots` (runtime)
  // resolve each comp at hydrate time — module export first, else the component registry.
  // Island-free → no module import, an empty registry (the boot no-ops).
  const moduleImport = hasIslands
    ? `import * as _islandModule from ${JSON.stringify(opts.moduleId)};\n`
    : "";
  const registryExpr = hasIslands
    ? "islandRegistry(manifest, _islandModule)"
    : "{}";

  // Embed the manifest as a literal so the bundle is self-contained (no fetch / DOM coupling).
  // Everything else — slot recovery, comp resolution, the boot loop — lives in the runtime
  // (`boot.ts`); this entry is document DATA only.
  const manifestLiteral = JSON.stringify(manifest);

  return `// Generated by @nota-lang/vite generateClientEntry. Do not edit.
import { setAdapter, islandRegistry, bootIslandsWithSlots } from ${JSON.stringify(runtimeModule)};
import adapter from ${JSON.stringify(adapterModule)};
${setupImport}${moduleImport}
const manifest = ${manifestLiteral};

setAdapter(adapter);
bootIslandsWithSlots(manifest, ${registryExpr});
`;
}
