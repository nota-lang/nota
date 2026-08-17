/**
 * **Nota completions.**
 *
 * Two disjoint completion surfaces:
 * - **`@|` head completions** — {@link headContext}/{@link headCompletions}: after a bare `@…` at a
 *   markup-head position, offer host tag names, the ambient prelude slots, and in-scope capitalized
 *   components. Called directly from `registerNotaConnectionFeatures` in `server-core.ts` (the live
 *   path — see {@link notaCompletionsPlugin}'s doc for why it isn't served from this module's plugin).
 * - **`@tag[|` prop completions** — *no Nota-specific code*: EOF recovery materialises a JSX
 *   element (`<tag />`) with a completion anchor mapping the cursor into its attribute position,
 *   and `volar-service-typescript` proposes the attribute names from the preamble's
 *   `JSX.IntrinsicElements` / the component's ambient props type (the typed emit surface,
 *   design/solid.md). `notaCompletionsPlugin` only registers `[` as a trigger character so the
 *   client fires the request there; the items come from TS through the mapping.
 *
 * The head-context test is a deliberately small line-prefix regex (NOT a port of tinymist's cursor
 * classifier — TS answers everything a mapped cursor reaches); a bare `%` statement line is NOT
 * suppressed (`@` genuinely re-enters markup there — {@link headContext}'s doc), but the completion
 * call site in `server-core.ts` suppresses inside a literal fence interior it can see and this
 * line-prefix-only function cannot (`./line-context.js`'s `literalFenceLines`).
 */

import { AMBIENT_PRELUDE_NAMES } from "@nota-lang/compiler";
import {
  type CompletionItem,
  CompletionItemKind,
  type LanguageServicePlugin
} from "@volar/language-server";
import { statementFenceLines } from "./line-context.js";

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

/** The shared "is this a component binding" shape: `[export] let|const|var Name = …`, `Name`
 *  capitalized (the component convention) — anchored at line start by each caller below. */
const COMPONENT_BINDING = String.raw`(?:export\s+)?(?:let|const|var)\s+([A-Z][A-Za-z0-9_$]*)\s*=`;
/** A bare `%`/`%%%`-line-leading binding (ordinary markup context). */
const PERCENT_COMPONENT_BINDING = new RegExp(
  String.raw`^\s*%+\s*${COMPONENT_BINDING}`,
  "gm"
);
/** A binding on a line *inside* a `%%%` fence body, which carries no leading `%` of its own (only
 *  the fence's delimiter lines do). */
const FENCE_COMPONENT_BINDING = new RegExp(
  String.raw`^\s*${COMPONENT_BINDING}`
);

/**
 * The in-scope **capitalized** component bindings in `source` — a document scan for
 * `%[export] let|const Name = …` where `Name` is capitalized, PLUS the same shape on a bindingless
 * line inside a `%%%` fence body (`{@link statementFenceLines}` — those lines carry no leading `%`,
 * only the fence's own delimiter lines do, so the bare `%+`-anchored pattern alone would never see
 * them). A cheap, robust stand-in for a full TS scope query (which the mapped cursor could also
 * answer); it finds document-local component definitions the reader hoists.
 */
export function scanComponents(source: string): string[] {
  const names = new Set<string>();
  for (
    let m = PERCENT_COMPONENT_BINDING.exec(source);
    m !== null;
    m = PERCENT_COMPONENT_BINDING.exec(source)
  ) {
    names.add(m[1]);
  }
  const lines = source.split("\n");
  for (const line of statementFenceLines(source)) {
    const m = FENCE_COMPONENT_BINDING.exec(lines[line]);
    if (m) {
      names.add(m[1]);
    }
  }
  return [...names];
}

/**
 * Is the line-prefix (text from the line start up to the cursor) a markup `@`-head position — a bare
 * `@` optionally followed by an identifier/hyphen run, at end of the prefix? Returns the partial head
 * text (possibly empty) or `null`.
 *
 * Deliberately does NOT special-case a `%`/`%%%` statement line: the reader re-enters markup at an
 * `@` there for real (the same `parse_statement_list_item` JS parser powers both a `%` line and a
 * `%%%` fence body — `line-context.ts`'s module doc), and the semantic-token tier already paints
 * `@div[…]` on a `%` line accordingly — suppressing here would just be a second, *inconsistent*
 * heuristic on top of that. A literal fence interior (a `%%%` body, or a delegated-language code
 * fence — `./line-context.ts`'s `literalFenceLines`) is suppressed instead, but only at the
 * completion call site in `server-core.ts`: a multi-line fence's extent isn't visible from a single
 * line's prefix, which is all this function ever sees.
 */
export function headContext(linePrefix: string): string | null {
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
 * The Nota completion Volar service plugin. Registers `@` and `[` as trigger characters purely for
 * **capability advertisement** — Volar's `languageFeatureWorker` only ever offers service plugins the
 * *embedded* virtual `.tsx` (never the `.nota` source doc, since every `.nota` has generated code), so
 * this plugin's `create()` is never asked for the source-document completions it would otherwise
 * serve; a `provideCompletionItems` here would be dead code (verified: the source doc never reaches
 * it). The live `@|` completion path is {@link headContext}/{@link headCompletions} called directly
 * from `registerNotaConnectionFeatures` in `server-core.ts`, merged onto TS's own items.
 */
export const notaCompletionsPlugin: LanguageServicePlugin = {
  name: "nota-completions",
  capabilities: {
    completionProvider: { triggerCharacters: ["@", "["] }
  },
  create: () => ({})
};
