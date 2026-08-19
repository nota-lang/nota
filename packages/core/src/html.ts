export type HtmlToken =
  | { kind: "comment"; start: number; end: number }
  | {
      kind: "tag";
      start: number;
      end: number;
      closing: boolean;
      name: string;
      attrs: string;
      selfClosing: boolean;
    };

/** Scan tags and comments in Solid's serialized HTML without splitting quoted attributes. */
export function* htmlTokens(html: string): Generator<HtmlToken> {
  const pattern =
    /<!--[\s\S]*?-->|<(\/?)([a-zA-Z][a-zA-Z0-9-]*)((?:"[^"]*"|'[^']*'|[^>"'])*)>/g;
  for (let match = pattern.exec(html); match; match = pattern.exec(html)) {
    const start = match.index;
    const end = pattern.lastIndex;
    if (match[0].startsWith("<!--")) {
      yield { kind: "comment", start, end };
      continue;
    }
    const attrs = match[3];
    yield {
      kind: "tag",
      start,
      end,
      closing: match[1] === "/",
      name: match[2].toLowerCase(),
      attrs,
      selfClosing: attrs.endsWith("/")
    };
  }
}
