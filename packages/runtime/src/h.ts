/**
 * The context-sensitive primitives `h` / `Fragment` / `decode`
 * (contract §1; decode.md §"Context-sensitive primitives").
 *
 * Under `▸ = false` (a static build) these build inert Nota vnodes and run the SSG pass; under
 * `▸ = true` (inside a component body during SSR) they delegate to the ambient framework adapter
 * (`@nota-lang/{react,solid}`). With no adapter injected, the `▸ = true` branches throw a pointed
 * "no adapter injected" error via `getAdapter()`.
 */

import { getAdapter } from "./adapter";
import { flag } from "./flag";
import { isRaw } from "./raw";
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
 * Decide whether the first argument to {@link Fragment} is a **leading props object** (vs. a child).
 * Contract §1 / §4 E5: the reader's `@for` emits `Fragment({ key: _i }, …body)`, so a leading
 * **plain object** is props; everything else (the bare `Fragment(map(...))` form, text, vnodes,
 * raw slots) is a child.
 *
 * `arg` is props iff it is a plain object that is **none of**:
 * - an **array** — `Array.isArray(arg)` (an array child is the `Fragment(xs.map(...))` shape);
 * - a **string** / **number** / **boolean** / **nullish** — these are scalar children, not objects;
 * - a **`RawHtml`** marker — `isRaw(arg)` (a pre-rendered slot rides through as a child);
 * - an **`ElementVNode`** — it carries a `tag` key; a props object never does.
 *
 * The `tag`-key test is the precise discriminator: `isElement` (just `typeof === "object"`) cannot
 * tell a props object from a vnode, but **only a vnode has `tag`** (the reader's emitted props are
 * attribute objects like `{ key, href, … }`, never `{ tag }`). So a props object is exactly an
 * object that is not array / not raw / has no `tag`.
 */
function isLeadingProps(
  arg: ChildArg | Record<string, unknown> | undefined
): arg is Record<string, unknown> {
  return (
    typeof arg === "object" &&
    arg !== null &&
    !Array.isArray(arg) &&
    !isRaw(arg) &&
    !("tag" in arg)
  );
}

/**
 * Fragment constructor with an **optional leading props object** (contract §1 / §4 E5).
 *
 * ```
 * Fragment(props?, …children)
 *   ▸ = false → ⟨FRAG, props ?? {}, flatten(children)⟩      // first arg is props iff a plain non-vnode obj
 *   ▸ = true  → Adapter.Fragment(props, flatten(children))  // React: createElement(Fragment, props, …)
 * ```
 *
 * The first argument is props iff {@link isLeadingProps} (a plain object that is not an array /
 * string / {@link RawHtml} / {@link ElementVNode}); otherwise **all** arguments — including the
 * first — are children. This decodes both the reader's keyed `@for` emit `Fragment({ key: _i },
 * …body)` *and* the bare `Fragment(["a","b"].map(...))` form (array first arg → child). At
 * `▸ = false` a `key` simply rides in the FRAG vnode's props — `struct`/`serialize` ignore it (static
 * HTML needs no reconciliation key). At `▸ = true` it is forwarded to the adapter.
 */
export function Fragment(
  propsOrFirstChild?: ChildArg | Record<string, unknown>,
  ...rest: ChildArg[]
): ElementVNode {
  let props: Record<string, unknown> | null;
  let children: ChildArg[];
  if (isLeadingProps(propsOrFirstChild)) {
    props = propsOrFirstChild;
    children = rest;
  } else {
    props = null;
    // the first arg is itself a child — splice it back in front of the rest
    children = [propsOrFirstChild as ChildArg, ...rest];
  }
  if (flag()) {
    return getAdapter().Fragment(
      props,
      flatten(children)
    ) as unknown as ElementVNode;
  }
  return { tag: FRAG, props: props ?? {}, children: flatten(children) };
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
