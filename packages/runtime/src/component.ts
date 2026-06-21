/**
 * Component constructors.
 *
 * `inlineComponent` / `blockComponent` wrap a user function into a *marked* component function.
 * The mark (`isComp`, `kind`) is what `struct`/`serialize` branch on: `isComp` distinguishes a
 * component boundary from a host node, and `kind` drives `<p>` grouping (an inline component joins
 * a paragraph run; a block component flushes it).
 */

import { withFlag } from "./flag";
import type { VNode } from "./vnode";

/** Props handed to a component: its decoded static `children` plus authored props. */
export interface CompProps {
  children: VNode[];
  [key: string]: unknown;
}

/** A user-authored component body: `(children, props) => markup`. */
export type CompBody = (children: VNode[], props: CompProps) => unknown;

/** A marked component function (the value `h(C, …)` records as a boundary tag). */
export interface CompFn {
  (props: CompProps): unknown;
  /** Marker: this function is a Nota component boundary (not a plain function passed as a tag). */
  isComp: true;
  /** Drives `<p>` grouping in {@link "./struct"}: `"inline"` joins a run, `"block"` flushes it. */
  kind: "inline" | "block";
  /**
   * The stable/export name. Set from the constructor's optional 2nd `name`
   * argument; `nameOf(CompFn) := CompFn.compName` is what {@link "./serialize".island} writes into
   * the manifest's `comp` field.
   *
   * **Why a passed name and not `fn.name`:** the reader hoists a `%let Name = inlineComponent(…)`
   * binding to module scope, but the constructor's *returned* function is the value of a
   * `CallExpression` initializer, so JS never name-evaluates it — `marked.name` is `""` (or
   * `"marked"`). The reader therefore passes the authored name explicitly. `undefined` when the
   * caller omits it (e.g. unit-test fixtures that never reach `island`).
   */
  compName?: string;
}

/**
 * Build a marked component of the given `kind`. The returned function, when *called* (which only
 * happens under `▸ = true`, i.e. inside `island()` during SSR — never during the static `struct`
 * pass), flips `▸` to `true` for the duration of the body:
 *
 * ```
 * marked = (props) => withFlag(true, () => fn(props.children, props))
 * marked.isComp = true;  marked.kind = kind;  marked.compName = name
 * ```
 *
 * Under the static build the function is *not* invoked — `h(C, …)` only records `C` as a boundary
 * tag (see {@link "./h".h}) — so `kind`/`isComp` are read structurally by `struct`, and the body
 * runs only later, inside SSR. `name` rides along as `compName` for `island`'s manifest.
 */
function makeComponent(
  fn: CompBody,
  kind: "inline" | "block",
  name?: string
): CompFn {
  const marked = ((props: CompProps) =>
    withFlag(true, () => fn(props.children, props))) as CompFn;
  marked.isComp = true;
  marked.kind = kind;
  marked.compName = name;
  return marked;
}

/**
 * An inline component: joins surrounding inline content inside a `<p>` (kind `"inline"`).
 *
 * `name` is the stable/export name the reader passes (`inlineComponent(fn, "Colorized")`); it is
 * recorded as `compName` and surfaces as the island manifest's `comp`. Optional so hand-written
 * fixtures that never island a component may omit it.
 */
export function inlineComponent(fn: CompBody, name?: string): CompFn {
  return makeComponent(fn, "inline", name);
}

/**
 * A block component: flushes the current paragraph run and stands on its own (kind `"block"`).
 * `name` behaves as in {@link inlineComponent}.
 */
export function blockComponent(fn: CompBody, name?: string): CompFn {
  return makeComponent(fn, "block", name);
}

/**
 * True when `tag` is a Nota component function (a boundary). Used by `struct`/`serialize` to
 * decide whether to stop at a boundary vs. recurse into a host node. Narrowed by the `isComp`
 * mark so a plain function accidentally used as a tag is *not* treated as a component.
 */
export function isComp(tag: unknown): tag is CompFn {
  return typeof tag === "function" && (tag as Partial<CompFn>).isComp === true;
}

/**
 * The component's manifest name (`CompFn.compName`).
 * {@link "./serialize".island} writes this into `manifest[id].comp`. If the reader omitted the
 * name (so `compName` is unset), this throws a pointed error — an island can't be hydrated by a
 * client that can't name its component, so a missing name is a build error, not a silent `""`.
 */
export function nameOf(tag: CompFn): string {
  if (tag.compName === undefined) {
    throw new Error(
      'island component has no name: a component used as a hydration island must be constructed with its export name, e.g. inlineComponent(fn, "Colorized"). The reader passes this automatically; a hand-written fixture must supply it.'
    );
  }
  return tag.compName;
}
