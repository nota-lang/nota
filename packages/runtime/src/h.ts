/**
 * The context-sensitive primitives `h` / `Fragment` / `decode`.
 *
 * Under `▸ = false` (a static build) these build inert Nota vnodes and run the SSG pass; under
 * `▸ = true` (inside a component body during SSR) they delegate to the ambient framework adapter
 * (`@nota-lang/{react,solid}`). With no adapter injected, the `▸ = true` branches throw a pointed
 * "no adapter injected" error via `getAdapter()`.
 */

import { getAdapter } from "./adapter";
import { isMark, isQuery } from "./doc";
import type { NotaHostProps } from "./dom";
import { flag } from "./flag";
import { isRaw } from "./raw";
import { decodeTree } from "./serialize";
import {
  type ChildArg,
  type ElementVNode,
  FRAG,
  flatten,
  type VNode
} from "./vnode";

/**
 * Remove `children` from a component/slot's prop type for the `h(tag, props, …)` call site — the
 * children come from the trailing `h` args (the decoded body), not the props object. A *key-remapped*
 * mapped type (not the built-in `Omit`): over a prop type with a permissive `[prop: string]: unknown`
 * index signature, `Omit` collapses to a bare index signature and drops the named prop types (so a
 * wrong `rank` on `Heading` would go unchecked); this remap preserves the named props (value-checked)
 * *and* the index signature (extras stay legal).
 */
type OmitChildren<P> = {
  [K in keyof P as K extends "children" ? never : K]: P[K];
};

/**
 * Hyperscript. `t` is a host string or a component/template function; `p` is a props object or
 * `null`.
 *
 * ```
 * ▸ = false → ⟨t, p ?? {}, flatten(children)⟩          // inert nota vnode; component NOT invoked
 * ▸ = true  → Adapter.h(t, p, flatten(children))        // framework hyperscript
 * ```
 *
 * Component tags are **not** invoked under the static build — `h(Colorized, …)` merely records
 * `Colorized` as the boundary `tag`; its body runs later, inside `island()`'s SSR.
 *
 * Both emitted call shapes are handled by {@link flatten}: `h("nota-ul-li", {}, [child])` (one array
 * arg) and `h(C, {}, x)` (one scalar arg).
 *
 * **Typed emit surface (contract R22).** Two public overloads, tried in order:
 * 1. a **function tag** (a component from `inlineComponent`/`blockComponent`, or an ambient prelude
 *    slot like `Tex`/`Heading`) — `props` is the tag's own parameter type minus `children` (the
 *    children come from the trailing args / the decoded body), so `h(Heading, { rank: 1 }, …)`
 *    checks `rank`, and a prelude slot's real prop type flows without the old contravariant
 *    tag-assignability failure;
 * 2. a **string tag** — `props` is the Nota-owned {@link NotaHostProps} for that tag (`h("a", {
 *    href })` completes/checks `href`; an unknown tag falls through to the permissive global
 *    attributes, so `nota-*` sentinels and custom elements stay legal).
 *
 * There is deliberately **no** loose `Record<string, unknown>` overload: it would swallow every
 * wrong-prop-value on a known tag (they would silently match `Record<string, unknown>` instead of
 * erroring). The loose signature below the overloads is the *implementation* only — not callable —
 * so a mistyped prop on a known tag is a real error.
 */
export function h<P extends object>(
  t: (props: P) => unknown,
  p: OmitChildren<P> | null,
  ...children: ChildArg[]
): ElementVNode;
export function h<K extends string>(
  t: K,
  p: NotaHostProps<K> | null,
  ...children: ChildArg[]
): ElementVNode;
export function h(
  t: ElementVNode["tag"],
  p: Record<string, unknown> | null,
  ...children: ChildArg[]
): ElementVNode {
  if (flag()) {
    // ▸ = true: framework owns this subtree. (With no adapter injected, getAdapter() throws.)
    return getAdapter().h(t, p, flatten(children)) as unknown as ElementVNode;
  }
  return { tag: t, props: p ?? {}, children: flatten(children) };
}

/**
 * Decide whether the first argument to {@link Fragment} is a **leading props object** (vs. a child).
 * The reader's `@for` emits `Fragment({ key: _i }, …body)`, so a leading
 * **plain object** is props; everything else (the bare `Fragment(map(...))` form, text, vnodes,
 * raw slots) is a child.
 *
 * `arg` is props iff it is a plain object that is **none of**:
 * - an **array** — `Array.isArray(arg)` (an array child is the `Fragment(xs.map(...))` shape);
 * - a **string** / **number** / **boolean** / **nullish** — these are scalar children, not objects;
 * - a **`RawHtml`** marker — `isRaw(arg)` (a pre-rendered slot rides through as a child);
 * - a doc-state **`MarkLeaf`/`QueryLeaf`** — `isMark`/`isQuery` (they are `tag`-less plain objects,
 *   so without this they would be eaten as props; contract R18 — they ride through as children);
 * - an **`ElementVNode`** — it carries a `tag` key; a props object never does.
 *
 * The `tag`-key test is the precise discriminator: `isElement` (just `typeof === "object"`) cannot
 * tell a props object from a vnode, but **only a vnode has `tag`** (the reader's emitted props are
 * attribute objects like `{ key, href, … }`, never `{ tag }`). So a props object is exactly an
 * object that is not array / not raw / not a doc-state leaf / has no `tag`.
 */
function isLeadingProps(
  arg: ChildArg | Record<string, unknown> | undefined
): arg is Record<string, unknown> {
  return (
    typeof arg === "object" &&
    arg !== null &&
    !Array.isArray(arg) &&
    !isRaw(arg) &&
    !isMark(arg) &&
    !isQuery(arg) &&
    !("tag" in arg)
  );
}

/**
 * Fragment constructor with an **optional leading props object**.
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
 * The decode pass.
 *
 * ```
 * ▸ = false → decodeTree(v)            // the SSG pass: normalize → index → force → struct → serialize
 * ▸ = true  → v                        // identity inside a component body
 * ```
 *
 * Inside a component (`▸ = true`) every `h` already returned an opaque framework element, so there
 * is nothing for a restructuring pass to see and `decode` is the identity. Under the static build it
 * runs the full R18 pipeline ({@link decodeTree} = `serialize ∘ struct ∘ force ∘ index ∘
 * normalize`): resolve doc-state marks/queries and append trailers, restructure the tree, then
 * stringify it to HTML. For a mark-free document this is byte-identical to `serialize(struct(v))`.
 */
export function decode(v: VNode): unknown {
  if (flag()) {
    return v;
  }
  return decodeTree(v);
}
