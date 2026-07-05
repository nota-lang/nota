/**
 * Client boot: slot-aware island hydration + island-component resolution.
 *
 * Everything here is document-*independent* — it used to be stamped into every generated client
 * entry by `@nota-lang/vite`'s `generateClientEntry`, which now emits only the document data
 * (manifest literal, module import, adapter, optional setup import) and calls:
 *
 * ```js
 * setAdapter(adapter);
 * bootIslandsWithSlots(manifest, islandRegistry(manifest, _islandModule));
 * ```
 *
 * - {@link resolveIslandComponent} — a manifest `comp` resolves to the compiled module's export
 *   (the reader's F1 hoisted components) or, failing that, the component registry (a
 *   `registerComponents` override, contract R14b — the setup module re-registered it client-side
 *   before boot).
 * - {@link islandRegistry} — derive the `comp → element-builder` registry from a manifest + the
 *   module namespace. Builders **build** the element (`getAdapter().h`) and never invoke the
 *   component — the framework calls it during hydration so hooks/signals run. Resolution happens
 *   inside the builder, at hydrate time, after setup registrations ran.
 * - {@link bootIslandsWithSlots} — the slot-aware boot (supersedes the generated copy; the
 *   slot-agnostic {@link "./serialize".bootIslands} remains the childless reference): select each
 *   island's `[data-hydration-id]` marker, recover its **slot** (the component's pre-rendered
 *   static children = the innerHTML of the SSR'd component root inside the marker), build the
 *   element with that slot, and `adapter.hydrate` over the server DOM. The slot is recovered as
 *   the marker's first element child's innerHTML so the component re-wraps the same children
 *   (rather than its own shell); falls back to the marker's innerHTML when there is no element
 *   child. Without the slot a re-render would lack the static children → React hydration
 *   mismatch (#418).
 */

import { getAdapter } from "./adapter";
import { type RawHtml, raw } from "./raw";
import { registeredComponent } from "./registry";
import type { Manifest } from "./serialize";

/** The compiled `.nota` module's namespace (island components under their exported names). */
export type IslandModule = Record<string, unknown>;

/** An element-builder: `(props, slot?) → framework element` (`null` when the comp is unresolvable). */
export type IslandBuilder = (
  props: Record<string, unknown>,
  slot?: RawHtml | []
) => unknown;

/**
 * Resolve a manifest `comp` name: module export first, else the component registry (a registered
 * override — R14b). `undefined` (with a pointed console error) when neither knows the name.
 */
export function resolveIslandComponent(
  module: IslandModule,
  name: string
): unknown {
  const comp = module[name] ?? registeredComponent(name);
  if (comp == null) {
    console.error(
      `nota: no client component for island "${name}" (not a module export, not registered)`
    );
  }
  return comp;
}

/**
 * Derive the boot registry from a manifest + the compiled module's namespace: one element-builder
 * per distinct `comp`. See the module docs for the build-don't-invoke and resolve-at-hydrate-time
 * rules; an unresolvable comp yields `null` (that island is skipped, error already logged).
 */
export function islandRegistry(
  manifest: Manifest,
  module: IslandModule
): Record<string, IslandBuilder> {
  const registry: Record<string, IslandBuilder> = {};
  for (const { comp } of Object.values(manifest)) {
    registry[comp] ??= (props, slot) => {
      const component = resolveIslandComponent(module, comp);
      if (component == null) {
        return null;
      }
      return getAdapter().h(
        component as Parameters<ReturnType<typeof getAdapter>["h"]>[0],
        props,
        slot ?? []
      );
    };
  }
  return registry;
}

/** The DOM surface the boot needs from an island marker node. */
interface IslandNode {
  firstElementChild: { innerHTML: string } | null;
  innerHTML: string;
}

/**
 * The slot-aware boot (see module docs). Missing nodes / registry entries / unresolvable
 * components are skipped — kept lenient so a partial registry boots what it can (matching
 * {@link "./serialize".bootIslands}).
 *
 * @param root optional DOM subtree to search within (defaults to `document`); injectable for tests.
 */
export function bootIslandsWithSlots(
  manifest: Manifest,
  registry: Record<string, IslandBuilder>,
  root: { querySelector(s: string): unknown } = bootDocument()
): void {
  const adapter = getAdapter();
  for (const [id, entry] of Object.entries(manifest)) {
    const node = root.querySelector(
      `[data-hydration-id="${id}"]`
    ) as IslandNode | null;
    if (node == null) {
      continue; // no DOM for this island (e.g. pruned) — skip
    }
    const build = registry[entry.comp];
    if (build == null) {
      continue; // not in this registry — skip
    }
    const inner = node.firstElementChild
      ? node.firstElementChild.innerHTML
      : node.innerHTML;
    const slot: RawHtml | [] = inner ? raw(inner) : [];
    const element = build(entry.props, slot);
    if (element == null) {
      continue; // unresolvable component (error already logged by the builder)
    }
    adapter.hydrate(element, node);
  }
}

/** Resolve the ambient `document` (client), or throw a pointed error if there is none (e.g. Node). */
function bootDocument(): { querySelector(s: string): unknown } {
  const doc = (
    globalThis as { document?: { querySelector(s: string): unknown } }
  ).document;
  if (doc == null) {
    throw new Error(
      "bootIslandsWithSlots: no `document` in scope. Call it in a browser/jsdom context, or pass an explicit root element."
    );
  }
  return doc;
}
