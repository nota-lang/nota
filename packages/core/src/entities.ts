/** The entities emitted by Solid's server-side HTML escaping. */

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
