/**
 * textOf — see-through text extraction over resolved children.
 */

import { decodeEntities } from "./entities";
import { isSSRChunk, type ResolvedChild } from "./reforest";

/**
 * The plain text of resolved children — `textContent` on the client, tag-strip + entity-decode
 * on SSR chunks. The same see-through-the-boundary trick `categorize` uses, applied to
 * text: this is how `Heading` recovers its title for slugs/Toc entries and how `Tex`/`CodeBlock`
 * recover their source.
 */
export function textOf(cs: ResolvedChild[] | ResolvedChild): string {
  if (Array.isArray(cs)) {
    return cs.map(textOf).join("");
  }
  const c = cs;
  if (c === null || c === undefined || typeof c === "boolean") {
    return "";
  }
  if (typeof c === "string") {
    return c;
  }
  if (typeof c === "number") {
    return String(c);
  }
  if (isSSRChunk(c)) {
    return decodeEntities(c.t.replace(/<[^>]*>/g, ""));
  }
  return c.textContent ?? "";
}
