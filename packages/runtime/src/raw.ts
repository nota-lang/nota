/**
 * The pre-rendered-HTML marker `raw(html)`: a `raw(slot)` an adapter injects as innerHTML instead
 * of escaping.
 *
 * `island()` pre-serializes a boundary's *static* children to an HTML string (the "slot"), then
 * hands them to the framework as `adapter.h(comp, props, raw(slot))`. The slot is already HTML — it
 * must NOT be re-escaped or re-parsed into framework vnodes. `raw(slot)` is the cross-package signal
 * for that: an adapter that finds a `RawHtml` among an element's children renders it as the
 * element's innerHTML (React `dangerouslySetInnerHTML`, Solid `innerHTML`) and emits no JSX children.
 *
 * It is a *branded object* (not a bare string) so it survives {@link "./vnode".flatten} unchanged
 * (flatten treats it as an opaque vnode and pushes it) and is unambiguously distinguishable from an
 * ordinary text child. Both `@nota-lang/react` and `@nota-lang/solid` import {@link isRaw} to detect
 * it — keeping the marker shape owned here, in the runtime, is what lets the two adapters agree.
 */

/** The unique brand key tagging a {@link RawHtml} value (private symbol → no accidental collision). */
const RAW: unique symbol = Symbol("nota.raw");

/** A pre-rendered HTML slot: opaque markup an adapter injects verbatim as innerHTML. */
export interface RawHtml {
  readonly [RAW]: true;
  /** The raw HTML string (already escaped/serialized by {@link "./serialize".serialize}). */
  readonly html: string;
  /**
   * Block-level in the static path (a raw leaf declares its own blockness): `struct` treats a block raw like a block
   * *sibling* — it flushes the surrounding paragraph run and is never `<p>`-wrapped. Default
   * `false`: an inline raw (e.g. KaTeX MathML) joins the run. Set it for raw whose HTML is
   * block-shaped (shiki's `<pre>`, display math) so grouping never nests it in a `<p>`.
   */
  readonly block?: boolean;
}

/** Wrap an already-serialized HTML string as a {@link RawHtml} marker. */
export function raw(html: string, opts?: { block?: boolean }): RawHtml {
  return { [RAW]: true, html, block: opts?.block === true };
}

/** True when `v` is a {@link RawHtml} marker (used by adapters to switch to innerHTML rendering). */
export function isRaw(v: unknown): v is RawHtml {
  return (
    typeof v === "object" && v !== null && (v as Partial<RawHtml>)[RAW] === true
  );
}
