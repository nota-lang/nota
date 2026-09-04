/**
 * Shared by components that accept pass-through HTML attributes alongside their own semantic
 * props (`Figure`'s `id`, `Def`'s `block`, …): a user-supplied `class` augments the component's
 * structural class rather than replacing it, matching how Reforest merges a paragraph's hoisted
 * `class` attrs group.
 */

/** `base`, plus `extra` appended when it is a non-blank string. */
export function mergeClass(base: string, extra: unknown): string {
  return typeof extra === "string" && extra.trim() !== ""
    ? `${base} ${extra}`
    : base;
}

/**
 * `rest` plus `cls` applied as a `classList` entry rather than a `class` attribute.
 *
 * Solid's SSR spread (`ssrSpread`/`ssrElement` in `solid-js/web`) always renders a `class` prop as
 * `"<value> "` — a trailing space reserved for a `classList` suffix — whenever the element also
 * spreads other props, even when that suffix is empty. Routing the merged class through
 * `classList` instead sidesteps that code path (its single-key case renders with no padding) and
 * keeps output identical to the pre-spread markup. `classList`'s DOM/SSR implementations both
 * split a multi-token key like `"nota-figure hero"` into its constituent classes, so a
 * space-joined merge works as a single key.
 */
export function withClass(
  cls: string | undefined,
  rest: Record<string, unknown>
): Record<string, unknown> {
  return cls === undefined ? rest : { classList: { [cls]: true }, ...rest };
}
