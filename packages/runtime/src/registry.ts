/**
 * The component registry: MDX-provider-style runtime override of ambient prelude components
 * (design/decode.md §The registry & config).
 *
 * The emitted code references `Tex` / `CodeInline` / `CodeBlock` as free identifiers; the standard
 * prelude binds each to a {@link slot} — a *plain* function tag `(props) => h(lookup(name) ??
 * fallback, props, children)`. Because a slot is a plain function, static-template semantics apply: `struct` expands it
 * eagerly at decode time into an `h(resolved, …)` node, and the *resolved* tag's own nature decides
 * the semantics —
 *
 * - a **plain function** (the shipped defaults, or a user-registered template) expands further:
 *   fully static output, zero client JS;
 * - an **`inlineComponent`/`blockComponent`** is a boundary: SSR + hydration island, standard
 *   component semantics;
 * - a **host string** just renders that element.
 *
 * {@link registerComponents} is **global-persistent** — override is site policy, so it is NOT reset
 * per `render()` (unlike the prelude's per-document `lstset` config). Register once from site entry
 * code (or a `% registerComponents({…})` statement, which runs when `Doc()` executes — before
 * `decode` expands any slot). The client entry must perform the same registrations before
 * `hydrateDocument` (the setup import in the generated entry) so the replay expands each slot to
 * the same islanded override the server did.
 */

import type { CompFn, CompProps } from "./component.js";
import { h } from "./h.js";
import type { ChildArg, TemplateFn } from "./vnode.js";

/** A tag a slot can resolve to: host string, static template, or marked component. */
export type RegisteredTag = string | CompFn | TemplateFn;

/** The global registry. Module-level on purpose: see the module docs (global-persistent). */
const registry = new Map<string, RegisteredTag>();

/**
 * Register site-wide component overrides by ambient name (`{ Tex: MyMath, CodeBlock: … }`).
 * Later registrations win; a re-registration replaces the earlier one.
 */
export function registerComponents(map: Record<string, RegisteredTag>): void {
  for (const [name, tag] of Object.entries(map)) {
    registry.set(name, tag);
  }
}

/**
 * Clear all registrations (or just the named ones). A test/dev hook — production code registers
 * and never clears; there is deliberately no per-render reset.
 */
export function clearRegisteredComponents(...names: string[]): void {
  if (names.length === 0) {
    registry.clear();
    return;
  }
  for (const name of names) {
    registry.delete(name);
  }
}

/** The currently registered override for `name`, if any (introspection/test hook). */
export function registeredComponent(name: string): RegisteredTag | undefined {
  return registry.get(name);
}

/**
 * Build a registry slot: the plain-function tag the prelude exports under an ambient name.
 *
 * The lookup happens at *invocation* time (static-template expansion inside `decode`, or the framework's own
 * render under `▸ = true`), not at slot creation — so a `% registerComponents({…})` at the top of a
 * document affects that document's own math/code spans. Under `▸ = true` the slot behaves
 * identically: `h` delegates to the adapter, which invokes a resolved component natively.
 */
export function slot(name: string, fallback: RegisteredTag): TemplateFn {
  const slotFn: TemplateFn = (props: CompProps) => {
    const resolved = registry.get(name) ?? fallback;
    const { children, ...rest } = props;
    // `resolved` is a dynamic `RegisteredTag` (string | CompFn | TemplateFn); narrow by `typeof` so
    // the typed `h` overloads apply (a string → the host overload, a function → the tag overload).
    // The typed emit surface deliberately has no loose union overload.
    return typeof resolved === "string"
      ? h(resolved, rest, children as ChildArg[])
      : h(resolved, rest, children as ChildArg[]);
  };
  // Name the function for diagnostics (e.g. struct's template-expansion cycle error names the tag).
  Object.defineProperty(slotFn, "name", { value: `slot(${name})` });
  return slotFn;
}
