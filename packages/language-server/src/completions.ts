/** Nota-specific `@` head completions; TypeScript supplies mapped prop completions. */

import { AMBIENT_PRELUDE_NAMES } from "@nota-lang/compiler";
import {
  type CompletionItem,
  CompletionItemKind,
  type LanguageServicePlugin
} from "@volar/language-server";
import {
  classifyLines,
  type LineClassification,
  statementFenceLines
} from "./line-context.js";

/** Common host tags offered at `@|`; arbitrary tags remain legal. */
export const NOTA_HOST_TAGS = [
  "p",
  "div",
  "span",
  "a",
  "img",
  "em",
  "strong",
  "code",
  "pre",
  "blockquote",
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
  "ul",
  "ol",
  "li",
  "dl",
  "dt",
  "dd",
  "table",
  "thead",
  "tbody",
  "tfoot",
  "tr",
  "td",
  "th",
  "caption",
  "section",
  "article",
  "aside",
  "nav",
  "header",
  "footer",
  "main",
  "figure",
  "figcaption",
  "details",
  "summary",
  "hr",
  "br",
  "b",
  "i",
  "u",
  "s",
  "sub",
  "sup",
  "mark",
  "small",
  "kbd",
  "samp",
  "var",
  "abbr",
  "input",
  "button",
  "label",
  "form",
  "select",
  "option",
  "textarea",
  "video",
  "audio",
  "source",
  "picture",
  "iframe",
  "canvas",
  "svg"
] as const;

/** Capitalized prelude names are valid markup heads. */
export const NOTA_PRELUDE_SLOTS: readonly string[] =
  AMBIENT_PRELUDE_NAMES.filter(name => /^[A-Z]/.test(name));

const COMPONENT_BINDING = String.raw`(?:export\s+)?(?:let|const|var)\s+([A-Z][A-Za-z0-9_$]*)\s*=`;
const PERCENT_COMPONENT_BINDING = new RegExp(
  String.raw`^\s*%+\s*${COMPONENT_BINDING}`,
  "gm"
);
const FENCE_COMPONENT_BINDING = new RegExp(
  String.raw`^\s*${COMPONENT_BINDING}`
);

/** Find capitalized component bindings in `%` statements and `%%%` fences. */
export function scanComponents(
  source: string,
  classification: LineClassification = classifyLines(source)
): string[] {
  const names = new Set<string>();
  for (
    let m = PERCENT_COMPONENT_BINDING.exec(source);
    m !== null;
    m = PERCENT_COMPONENT_BINDING.exec(source)
  ) {
    names.add(m[1]);
  }
  const lines = source.split("\n");
  for (const line of statementFenceLines(source, classification)) {
    const m = FENCE_COMPONENT_BINDING.exec(lines[line]);
    if (m) {
      names.add(m[1]);
    }
  }
  return [...names];
}

/** Return the partial name at an `@` head, or `null` outside a head. */
export function headContext(linePrefix: string): string | null {
  const m = /@([A-Za-z][A-Za-z0-9-]*|)$/.exec(linePrefix);
  return m ? m[1] : null;
}

/** Build the `@|` head completion items for `source` (tags + prelude slots + components). */
export function headCompletions(
  source: string,
  lines: LineClassification = classifyLines(source)
): CompletionItem[] {
  const items: CompletionItem[] = [];
  const seen = new Set<string>();
  const add = (label: string, kind: CompletionItemKind, detail: string) => {
    if (seen.has(label)) return;
    seen.add(label);
    items.push({ label, kind, detail });
  };
  for (const name of scanComponents(source, lines)) {
    add(name, CompletionItemKind.Class, "Nota component");
  }
  for (const name of NOTA_PRELUDE_SLOTS) {
    add(name, CompletionItemKind.Function, "Nota prelude");
  }
  for (const tag of NOTA_HOST_TAGS) {
    add(tag, CompletionItemKind.Property, "HTML element");
  }
  return items;
}

/** Capability-only plugin; source-document requests are routed in `server-core.ts`. */
export const notaCompletionsPlugin: LanguageServicePlugin = {
  name: "nota-completions",
  capabilities: {
    completionProvider: { triggerCharacters: ["@", "["] }
  },
  create: () => ({})
};
