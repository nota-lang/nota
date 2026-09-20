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

/** Merge classes, placing class first for stable SSR attribute order. */
export function withClass(
  cls: string | undefined,
  rest: Record<string, unknown>
): Record<string, unknown> {
  if (cls === undefined) {
    return rest;
  }
  const { class: extra, ...others } = rest;
  return { class: mergeClass(cls, extra), ...others };
}
