/**
 * The context-sensitive primitives `h` / `Fragment` / `decode`
 * (contract §1; decode.md §"Context-sensitive primitives").
 *
 * Under `▸ = false` (a static build) these build inert Nota vnodes and run the SSG pass; under
 * `▸ = true` (inside a component body during SSR) they delegate to the ambient framework adapter.
 * Phases G/H exercise only the `▸ = false` paths; the `▸ = true` branches dispatch through the
 * (not-yet-injected) adapter, which throws "no adapter injected" until Phase J.
 */

import { getAdapter } from "./adapter";
import { flag } from "./flag";
import { serialize } from "./serialize";
import { struct } from "./struct";
import {
  type ChildArg,
  type ElementVNode,
  FRAG,
  flatten,
  type VNode
} from "./vnode";

/**
 * Hyperscript. `t` is a host string or a component function; `p` is a props object or `null`.
 *
 * ```
 * ▸ = false → ⟨t, p ?? {}, flatten(children)⟩          // inert nota vnode; component NOT invoked
 * ▸ = true  → Adapter.h(t, p, flatten(children))        // framework hyperscript
 * ```
 *
 * Component tags are **not** invoked under the static build — `h(Colorized, …)` merely records
 * `Colorized` as the boundary `tag`; its body runs later, inside `island()`'s SSR (decode.md).
 *
 * Both emitted call shapes are handled by {@link flatten}: `h("ulli", {}, [child])` (one array
 * arg) and `h(C, {}, x)` (one scalar arg).
 */
export function h(
  t: ElementVNode["tag"],
  p: Record<string, unknown> | null,
  ...children: ChildArg[]
): ElementVNode {
  if (flag()) {
    // ▸ = true: framework owns this subtree. (No adapter in G/H → getAdapter() throws.)
    return getAdapter().h(t, p, flatten(children)) as unknown as ElementVNode;
  }
  return { tag: t, props: p ?? {}, children: flatten(children) };
}

/**
 * Fragment constructor (variadic).
 *
 * ```
 * ▸ = false → ⟨FRAG, {}, flatten(children)⟩
 * ▸ = true  → Adapter.Fragment(flatten(children))
 * ```
 */
export function Fragment(...children: ChildArg[]): ElementVNode {
  if (flag()) {
    return getAdapter().Fragment(flatten(children)) as unknown as ElementVNode;
  }
  return { tag: FRAG, props: {}, children: flatten(children) };
}

/**
 * The decode pass (contract §1; decode.md §"Context-sensitive primitives").
 *
 * ```
 * ▸ = false → serialize(struct(v))     // the SSG pass: restructure, then stringify
 * ▸ = true  → v                        // identity inside a component body
 * ```
 *
 * Inside a component (`▸ = true`) every `h` already returned an opaque framework element, so there
 * is nothing for a restructuring pass to see and `decode` is the identity. Under the static build
 * it is `serialize ∘ struct`. **In Phases G/H `serialize` is a stub** (Phase I), so the
 * `▸ = false` branch here will throw via `serialize`; `struct` — the deliverable this wave — is
 * exercised directly by tests and by callers that want the structured tree.
 */
export function decode(v: VNode): unknown {
  if (flag()) {
    return v;
  }
  return serialize(struct(v));
}
