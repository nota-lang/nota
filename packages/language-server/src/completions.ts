/**
 * **Nota completions.**
 *
 * Two disjoint completion surfaces:
 * - **`@|` head completions** — this plugin: after a bare `@…` at a markup-head position, offer host
 *   tag names, the ambient prelude slots, and in-scope capitalized components.
 * - **`@tag[|` prop completions** — *no Nota-specific code*: EOF recovery materialises a JSX
 *   element (`<tag />`) with a completion anchor mapping the cursor into its attribute position,
 *   and `volar-service-typescript` proposes the attribute names from the preamble's
 *   `JSX.IntrinsicElements` / the component's ambient props type (the typed emit surface,
 *   design/solid.md). This plugin only registers `[` as a trigger character so the client fires
 *   the request there; the items come from TS through the mapping.
 *
 * The head-context test is a deliberately small line-prefix regex (NOT a port of tinymist's cursor
 * classifier — TS answers everything a mapped cursor reaches); it is suppressed on `%`/`%%%`
 * statement lines (embedded JS), where `@` is not a markup head.
 */

import { AMBIENT_PRELUDE_NAMES } from "@nota-lang/compiler";
import {
  type CompletionItem,
  CompletionItemKind,
  type LanguageServicePlugin
} from "@volar/language-server";
import { NOTA_LANGUAGE_ID } from "./language-plugin.js";

/**
 * A curated set of common HTML host tags offered at `@|`. A *superset-friendly* list (unknown tags
 * are legal anyway — the typed `h` overloads keep an arbitrary-string fallback) that overlaps the
 * reader-emitted `nota-*` sentinels' host targets; completion is a convenience, so breadth over
 * precision. The typed per-tag attribute map is the source of truth for prop *checking*; this list
 * is the source of truth for tag *names*.
 */
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

/**
 * The ambient prelude slot / doc-state names the reader references as free identifiers (the registry
 * slots plus the doc-state family — heading sugar lowers to the ambient `Heading` slot; see
 * design/solid.md §The prelude) — offered as component-like completions at `@|`.
 * Derived from the compiler's {@link AMBIENT_PRELUDE_NAMES} (the single source of truth for the
 * ambient surface), keeping the capitalized component slots (the config fns — `lstset`/`texRef`/… —
 * are embedded-JS calls, not `@`-heads).
 */
export const NOTA_PRELUDE_SLOTS: readonly string[] =
  AMBIENT_PRELUDE_NAMES.filter(name => /^[A-Z]/.test(name));

/**
 * The in-scope **capitalized** component bindings in `source` — a document scan for
 * `%[export] let|const Name = …` where `Name` is capitalized (the component convention). A cheap,
 * robust stand-in for a full TS scope query (which the mapped cursor could also answer); it finds
 * document-local component definitions the reader hoists.
 */
export function scanComponents(source: string): string[] {
  const re =
    /^\s*%+\s*(?:export\s+)?(?:let|const|var)\s+([A-Z][A-Za-z0-9_$]*)\s*=/gm;
  const names = new Set<string>();
  for (let m = re.exec(source); m !== null; m = re.exec(source)) {
    names.add(m[1]);
  }
  return [...names];
}

/**
 * Is the line-prefix (text from the line start up to the cursor) a markup `@`-head position — a bare
 * `@` optionally followed by an identifier/hyphen run, at end of the prefix — and NOT on a `%`/`%%%`
 * statement line (embedded JS)? Returns the partial head text (possibly empty) or `null`.
 */
export function headContext(linePrefix: string): string | null {
  if (/^\s*%/.test(linePrefix)) {
    return null; // a `%`/`%%%` statement line — `@` here is embedded JS, not a markup head.
  }
  const m = /@([A-Za-z][A-Za-z0-9-]*|)$/.exec(linePrefix);
  return m ? m[1] : null;
}

/** Build the `@|` head completion items for `source` (tags + prelude slots + components). */
export function headCompletions(source: string): CompletionItem[] {
  const items: CompletionItem[] = [];
  const seen = new Set<string>();
  const add = (label: string, kind: CompletionItemKind, detail: string) => {
    if (seen.has(label)) return;
    seen.add(label);
    items.push({ label, kind, detail });
  };
  // In-scope components first (most specific), then prelude slots, then host tags.
  for (const name of scanComponents(source)) {
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

/**
 * The Nota completion Volar service plugin. Registers `@` and `[` as trigger characters; serves `@|`
 * head completions itself and lets `volar-service-typescript` serve `@tag[|` prop completions through
 * the recovery anchor mapping.
 */
export const notaCompletionsPlugin: LanguageServicePlugin = {
  name: "nota-completions",
  capabilities: {
    completionProvider: { triggerCharacters: ["@", "["] }
  },
  create() {
    return {
      provideCompletionItems(document, position) {
        if (document.languageId !== NOTA_LANGUAGE_ID) {
          return undefined;
        }
        const linePrefix = document.getText({
          start: { line: position.line, character: 0 },
          end: position
        });
        const head = headContext(linePrefix);
        if (head === null) {
          // Not a markup head (e.g. a `[` prop trigger or a `%` line) — defer to TS via the mapping.
          return undefined;
        }
        return {
          isIncomplete: false,
          items: headCompletions(document.getText())
        };
      }
    };
  }
};
