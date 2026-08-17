/**
 * The five HTML entities Solid's SSR escaping produces (`solid-js/web`'s `escape()`), and the
 * one decoder for them — the single copy (reforest's attr extraction, `textOf`, and the
 * prelude's decoration reconstruction all consume this; three hand-copies once agreed by luck).
 */

const ENTITIES: Record<string, string> = {
  "&amp;": "&",
  "&lt;": "<",
  "&gt;": ">",
  "&quot;": '"',
  "&#39;": "'"
};

/** Decode exactly the entity set Solid's SSR escape emits. */
export const decodeEntities = (s: string): string =>
  s.replace(/&(?:amp|lt|gt|quot|#39);/g, m => ENTITIES[m]);
