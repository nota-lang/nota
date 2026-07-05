/**
 * The island registry / boot-entry helper.
 *
 * `bootIslands(manifest, registry)` (the runtime's hydration entry point) needs
 * `registry[name] → client component fn`. The reader makes every island-eligible component an
 * **independently importable module export** of the compiled `.nota` module, under a stable generated
 * name; the manifest's `comp` field *is* that exported name. So building the registry is mechanical:
 *
 * 1. collect the distinct `comp` names from a `render()` manifest;
 * 2. emit a client boot-entry JS string that imports the compiled module as a **namespace** and
 *    resolves each island component at hydrate time — module export first, else the runtime
 *    component registry (a *registered override*, contract R14b, populated by the optional setup
 *    module imported for side effects);
 * 3. build `registry = { [comp]: (props) => adapter.h(resolveComp(comp), props, []) }` — **BUILD the
 *    element, do NOT eagerly invoke** the component (the framework must call it during render, so
 *    its hooks/signals run); and
 * 4. `setAdapter(adapter)` + `bootIslands(manifest, registry)`.
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
 * The emitted module:
 * - imports `setAdapter` + `bootIslands` from the runtime and the `adapter` (default export) from the
 *   adapter module;
 * - imports the optional **setup module** for side effects (client-side `registerComponents`), then
 *   the compiled module as a namespace, resolving each island comp at hydrate time (export ??
 *   registered override — R14b);
 * - builds `registry[comp] = (props) => adapter.h(resolveComp(comp), props, [])` — the required
 *   element-builder shape (the framework invokes the component; this generator never does);
 * - embeds the manifest as a literal and calls `setAdapter(adapter); bootIslands(manifest, registry)`.
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

  // Distinct island component names, in first-seen order (deterministic output).
  const names: string[] = [];
  for (const entry of Object.values(manifest)) {
    if (!names.includes(entry.comp)) {
      names.push(entry.comp);
    }
  }

  // The compiled module is imported as a **namespace** (not named imports): a manifest comp may be
  // a *registered override* (contract R14b) that the module does not export, and a named import of
  // a missing export is a bundle-time error. Resolution happens per-name at hydrate time:
  // module export first (F1 hoisted components), else the runtime component registry (populated by
  // the setup module's registerComponents, which ran at import time above).
  const registryEntries = names
    .map(
      n =>
        `  ${JSON.stringify(n)}: (props, slot) => adapter.h(resolveComp(${JSON.stringify(n)}), props, slot ?? [])`
    )
    .join(",\n");

  // Import the setup module (side effects: client-side registerComponents) before resolution runs.
  const setupImport =
    opts.setupModule !== undefined
      ? `import ${JSON.stringify(opts.setupModule)};\n`
      : "";

  // Island-free → no module import, no resolver, an empty registry (the boot no-ops).
  const resolver =
    names.length > 0
      ? `import * as _islandModule from ${JSON.stringify(opts.moduleId)};

function resolveComp(name) {
  const comp = _islandModule[name] ?? registeredComponent(name);
  if (!comp) {
    console.error('nota: no client component for island "' + name + '" (not a module export, not registered)');
  }
  return comp;
}
`
      : "";

  // Embed the manifest as a literal so the bundle is self-contained (no fetch / DOM coupling).
  const manifestLiteral = JSON.stringify(manifest);

  return `// Generated by @nota-lang/vite generateClientEntry. Do not edit.
import { setAdapter, getAdapter, bootIslands, raw, registeredComponent } from ${JSON.stringify(runtimeModule)};
import adapter from ${JSON.stringify(adapterModule)};
${setupImport}${resolver}
const manifest = ${manifestLiteral};

const registry = {
${registryEntries}
};

setAdapter(adapter);

// Slot-aware boot. This generator owns slot rehydration; the runtime's slot-agnostic
// \`bootIslands\` is kept imported as the reference for the childless case. Specializes that
// algorithm — select each island's \`[data-hydration-id]\` node, recover its **slot** (the component's
// pre-rendered static children = the innerHTML of the SSR'd component root inside the marker), build
// the element with that slot, and \`adapter.hydrate\` over the server DOM. The slot is recovered as the
// island root's first element child's innerHTML so the component re-wraps the same children (rather
// than its own shell); falls back to the marker's innerHTML when there is no element child.
void bootIslands;
function bootIslandsWithSlots(manifest, registry, root) {
  const doc = root || (typeof document !== "undefined" ? document : null);
  if (!doc) return;
  for (const id of Object.keys(manifest)) {
    const entry = manifest[id];
    const node = doc.querySelector('[data-hydration-id="' + id + '"]');
    if (!node) continue;
    const build = registry[entry.comp];
    if (!build) continue;
    const inner = node.firstElementChild
      ? node.firstElementChild.innerHTML
      : node.innerHTML;
    const slot = inner ? raw(inner) : [];
    getAdapter().hydrate(build(entry.props, slot), node);
  }
}

bootIslandsWithSlots(manifest, registry);
`;
}
