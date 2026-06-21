/**
 * The island registry / boot-entry helper.
 *
 * `bootIslands(manifest, registry)` (the runtime's hydration entry point) needs
 * `registry[name] → client component fn`. The reader makes every island-eligible component an
 * **independently importable module export** of the compiled `.nota` module, under a stable generated
 * name; the manifest's `comp` field *is* that exported name. So building the registry is mechanical:
 *
 * 1. collect the distinct `comp` names from a `render()` manifest;
 * 2. emit a client boot-entry JS string that **imports each island component by its exported name**
 *    from the compiled module;
 * 3. build `registry = { [comp]: (props) => adapter.h(Component, props, []) }` — **BUILD the element,
 *    do NOT eagerly invoke** the component (the framework must call it during render, so its
 *    hooks/signals run); and
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
}

/**
 * A JS identifier safe to use as the local binding for an imported island component. Component names
 * are authored JS identifiers already, but we defensively sanitize (and prefix) so a generated local
 * can never collide with the entry's own bindings (`adapter`, `registry`, `bootIslands`, …) or be an
 * invalid identifier. `Colorized` → `_island_Colorized`.
 */
function localName(comp: string): string {
  const safe = comp.replace(/[^A-Za-z0-9_$]/g, "_");
  return `_island_${safe}`;
}

/**
 * Generate a client **boot-entry module** (as a JS source string) for a `render()` manifest.
 *
 * The emitted module:
 * - imports `setAdapter` + `bootIslands` from the runtime and the `adapter` (default export) from the
 *   adapter module;
 * - imports each **distinct** island component from `moduleId` **by its exported name**
 *   (`import { Colorized as _island_Colorized } from "<moduleId>"`);
 * - builds `registry[comp] = (props) => adapter.h(Component, props, [])` — the required element-builder
 *   shape (the framework invokes the component; this generator never does);
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

  // Distinct island component names, in first-seen order (deterministic output, one import each).
  const names: string[] = [];
  for (const entry of Object.values(manifest)) {
    if (!names.includes(entry.comp)) {
      names.push(entry.comp);
    }
  }

  // `import { Colorized as _island_Colorized, … } from "<moduleId>";`
  const componentImports =
    names.length > 0
      ? `import { ${names
          .map(n => `${n} as ${localName(n)}`)
          .join(", ")} } from ${JSON.stringify(opts.moduleId)};\n`
      : "";

  // registry: name → **element-builder** taking `(props, slot)`. BUILD the element (`adapter.h`), do
  // NOT eagerly invoke the component — the framework calls it during hydration so hooks
  // run. `slot` is the reconstructed static-children `raw` HTML (see the boot loop), passed as the
  // component's children; the component forwards it via `@children` onto its host, where the adapter
  // injects it as innerHTML — reproducing the server shell so hydration matches. `[]` when childless.
  const registryEntries = names
    .map(
      n =>
        `  ${JSON.stringify(n)}: (props, slot) => adapter.h(${localName(n)}, props, slot ?? [])`
    )
    .join(",\n");

  // Embed the manifest as a literal so the bundle is self-contained (no fetch / DOM coupling).
  const manifestLiteral = JSON.stringify(manifest);

  return `// Generated by @nota-lang/vite generateClientEntry. Do not edit.
import { setAdapter, getAdapter, bootIslands, raw } from ${JSON.stringify(runtimeModule)};
import adapter from ${JSON.stringify(adapterModule)};
${componentImports}
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
