/**
 * The Nota vnode data model.
 *
 * ```
 * v ::= string                       // text leaf
 *     | { tag, props, children }      // tag: host string (decode owns) | CompFn (boundary)
 * ```
 *
 * A static build (`▸ = false`) yields a tree of plain `{tag, props, children}` nodes.
 * Component-tagged nodes are *deferred*: `h(Colorized, …)` records a boundary
 * rather than invoking `Colorized`. The `struct`/`serialize` passes consume this model.
 */

import type { CompFn, CompProps } from "./component";
import { isRaw, type RawHtml } from "./raw";

/**
 * A **plain function tag**: a static template (contract R10). `struct` expands it eagerly —
 * invoking it with `{ children, …props }` and splicing the result into the sibling stream *before*
 * grouping, so a template's list sentinels coalesce with its siblings'. Contrast {@link CompFn}:
 * the marked constructors buy *deferral* (an island boundary, `kind`-driven paragraph grouping,
 * hydration by name); a bare function buys none of that and needs none — it is inlined at decode
 * time. Under `▸ = true` the framework adapter invokes plain function tags natively.
 */
export type TemplateFn = (props: CompProps) => unknown;

/**
 * The fragment tag sentinel. A unique `symbol` so it can never collide with a host tag string or a
 * component function, and so
 * `tag === FRAG` is an unambiguous structural test.
 */
export const FRAG: unique symbol = Symbol("nota.fragment");
export type Frag = typeof FRAG;

/** A non-text vnode: a host element, a fragment, a template, or a component boundary. */
export interface ElementVNode {
  /**
   * - `string` → host element (lowercase tag); `decode` owns and restructures it.
   * - {@link FRAG} → a fragment (transparent grouping; carries no DOM element of its own).
   * - {@link CompFn} → a component boundary; the framework owns its body, `struct` stops here.
   * - {@link TemplateFn} (any unmarked function) → a static template; `struct` expands it eagerly.
   */
  tag: string | Frag | CompFn | TemplateFn;
  /** Props object. Always present (defaults to `{}`); never `null`/`undefined` on a built node. */
  props: Record<string, unknown>;
  /** Already-flattened child vnodes (see {@link flatten}). */
  children: VNode[];
}

/**
 * A vnode is a text leaf, an element/fragment/boundary node, or a {@link RawHtml} leaf —
 * pre-rendered HTML that the static path passes through opaquely (`struct` never descends,
 * `serialize` emits it verbatim; contract R14e). Raw leaves are how the prelude's KaTeX output
 * enters the tree without re-escaping.
 */
export type VNode = string | ElementVNode | RawHtml;

/** True when `v` is a non-text vnode (has a `tag`/`props`/`children` shape). A {@link RawHtml}
 *  leaf is *not* an element — it is opaque to every structural pass. */
export function isElement(v: VNode): v is ElementVNode {
  return typeof v === "object" && v !== null && !isRaw(v);
}

/** True when `v` is a fragment node. */
export function isFragment(v: VNode): v is ElementVNode & { tag: Frag } {
  return isElement(v) && v.tag === FRAG;
}

/**
 * A raw child argument as it arrives at `h`/`Fragment`, before normalization. The emitted code
 * passes strings, numbers, booleans, nullish, nested vnodes, and arrays thereof (e.g.
 * `["a","b"].map(...)` yields an array child). {@link flatten} normalizes all of these.
 */
export type ChildArg = VNode | number | boolean | null | undefined | ChildArg[];

/**
 * Normalize the variadic child arguments of `h`/`Fragment` into a flat `VNode[]`.
 *
 * Rules (one pass; arrays flattened exactly **one level**, matching the two emitted call shapes
 * `h("nota-ul-li", {}, [child])` and `h(C, {}, x)`):
 *
 * - **Arrays are spliced in** one level deep. `@for`/`@if` lowerings produce an array child
 *   (`xs.map(...)`); splicing it makes its elements direct siblings. Nested arrays recurse so a
 *   `.map` returning fragments-of-arrays still flattens fully.
 * - **Strings pass through** unchanged (they are text leaves; whitespace is significant — the
 *   reader already applied the Scribble algorithm, so we must not trim or merge here).
 * - **Numbers are coerced to text** via `String(n)` (JSX-style). `0` and `NaN` are kept as
 *   `"0"`/`"NaN"` — numeric, not nullish.
 * - **Nullish and booleans are dropped**: `null`, `undefined`, `false`, **and** `true`. This is
 *   the usual JSX convention where `cond && <x/>` renders nothing for a falsy `cond`; we extend
 *   it to drop `true` as well so that `@if`-style guards never leak a stray `"true"` text node.
 *   (`@if (c) {a}` lowers to `c ? Fragment("a") : null`, so a dropped `null` is the
 *   common case; dropping bare booleans is the documented, conservative choice.)
 * - Existing `ElementVNode`s pass through untouched.
 */
export function flatten(children: readonly ChildArg[]): VNode[] {
  const out: VNode[] = [];
  flattenInto(children, out);
  return out;
}

function flattenInto(children: readonly ChildArg[], out: VNode[]): void {
  for (const c of children) {
    if (c == null || c === false || c === true) {
      // drop nullish + booleans (JSX semantics; documented choice for booleans)
      continue;
    }
    if (typeof c === "string") {
      out.push(c);
    } else if (typeof c === "number") {
      out.push(String(c));
    } else if (Array.isArray(c)) {
      // splice arrays in; recurse so a `.map` returning arrays flattens fully
      flattenInto(c, out);
    } else {
      // an ElementVNode, or a RawHtml leaf (opaque; §8 "survives flatten")
      out.push(c);
    }
  }
}
