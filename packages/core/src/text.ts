import { decodeEntities } from "./entities";
import { htmlTokens } from "./html";
import { isSSRChunk, type ResolvedChild } from "./reforest";

function chunkText(html: string): string {
  let text = "";
  let from = 0;
  for (const token of htmlTokens(html)) {
    text += html.slice(from, token.start);
    from = token.end;
  }
  return decodeEntities(text + html.slice(from));
}

/** Extract text from resolved children on either the DOM or SSR path. */
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
    return chunkText(c.t);
  }
  return c.textContent ?? "";
}
