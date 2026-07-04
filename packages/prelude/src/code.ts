/**
 * The default code components (contract R14c): sync shiki with armed-parts-as-decorations.
 *
 * `` `…` `` lowers to `h(CodeInline, {}, parts)` and a fence to `h(CodeBlock, {lang?}, parts)`;
 * the prelude's slots resolve here unless overridden. The parts are R13 raw runs interleaved with
 * `|@`-armed splices. The armed-decoration model:
 *
 * 1. **Reconstruct** one contiguous source text: string parts append verbatim; an armed *element*
 *    contributes its text-content (nested markup flattens to text — v1 pinned) and records a
 *    shiki **decoration** over that range (`tagName` = the host tag, `properties` = the props);
 *    an armed *fragment* contributes its text with no decoration.
 * 2. **Tokenize the whole text** — the grammar sees the real program text, with no holes — and let
 *    shiki wrap the decorated ranges.
 *
 * A part that cannot join the text (a component boundary, a `raw` leaf, an empty element) drops
 * the span to the **plain fallback** (unhighlighted, splices rendered as markup) with a build
 * warning: highlighting a text we cannot faithfully reconstruct would lie about the code.
 *
 * The highlighter is a **sync** core (JS regex engine; grammars/themes eagerly imported) because
 * `struct`'s R10 expansion is synchronous. Language resolution: the fence `lang` tag wins, else
 * `lstset({language})`; no language (or an unknown one, with a warning) → plain `<pre><code>`.
 */

import {
  type CompProps,
  type ElementVNode,
  h,
  isElement,
  raw,
  type VNode
} from "@nota-lang/runtime";
import {
  createHighlighterCoreSync,
  type DecorationItem,
  type HighlighterCore
} from "shiki/core";
import { createJavaScriptRegexEngine } from "shiki/engine/javascript";
import css from "shiki/langs/css.mjs";
import html from "shiki/langs/html.mjs";
import javascript from "shiki/langs/javascript.mjs";
import json from "shiki/langs/json.mjs";
import jsx from "shiki/langs/jsx.mjs";
import markdown from "shiki/langs/markdown.mjs";
import python from "shiki/langs/python.mjs";
import rust from "shiki/langs/rust.mjs";
import shellscript from "shiki/langs/shellscript.mjs";
import tsx from "shiki/langs/tsx.mjs";
import typescript from "shiki/langs/typescript.mjs";
import githubDark from "shiki/themes/github-dark.mjs";
import githubLight from "shiki/themes/github-light.mjs";

import { config } from "./config";

// ---------------------------------------------------------------------------------------------
// The sync highlighter (curated grammars + lstset extensions; memoized on the registration set)
// ---------------------------------------------------------------------------------------------

/** The curated default grammar set. Extend at runtime via `lstset({ languages })`. */
const BASE_LANGS = [
  ...javascript,
  ...typescript,
  ...jsx,
  ...tsx,
  ...json,
  ...python,
  ...rust,
  ...shellscript,
  ...html,
  ...css,
  ...markdown
];
const BASE_THEMES = [githubLight, githubDark];

const engine = createJavaScriptRegexEngine();
let cached: { key: string; hl: HighlighterCore } | null = null;

/** The current highlighter, rebuilt only when the grammar/theme registration set changes. */
function highlighter(): HighlighterCore {
  const cfg = config();
  const langs = [...BASE_LANGS, ...cfg.extraLangs];
  const themes = [...BASE_THEMES, ...cfg.extraThemes];
  const key = `${langs.map(l => l.name).join(",")}|${themes.map(t => t.name).join(",")}`;
  if (cached === null || cached.key !== key) {
    cached = { key, hl: createHighlighterCoreSync({ langs, themes, engine }) };
  }
  return cached.hl;
}

/** Is `lang` a loaded grammar name or alias? */
function hasLang(lang: string): boolean {
  return highlighter().getLoadedLanguages().includes(lang);
}

// ---------------------------------------------------------------------------------------------
// Warnings (once per distinct message — a fence appears many times in a document build)
// ---------------------------------------------------------------------------------------------

const warned = new Set<string>();
function warnOnce(msg: string): void {
  if (!warned.has(msg)) {
    warned.add(msg);
    console.warn(`nota prelude: ${msg}`);
  }
}

// ---------------------------------------------------------------------------------------------
// Reconstruction: parts → contiguous text + decorations
// ---------------------------------------------------------------------------------------------

interface Reconstruction {
  text: string;
  decorations: DecorationItem[];
  /** true → a part could not join the text; render the plain fallback. */
  plain: boolean;
}

/** The flattened text of a subtree, or `null` if it holds a non-text leaf (component/raw). */
function textContent(el: ElementVNode): string | null {
  let out = "";
  for (const c of el.children) {
    if (typeof c === "string") {
      out += c;
    } else if (isElement(c) && typeof c.tag !== "function") {
      const t = textContent(c);
      if (t === null) {
        return null;
      }
      out += t;
    } else {
      return null;
    }
  }
  return out;
}

function reconstruct(children: readonly VNode[]): Reconstruction {
  let text = "";
  const decorations: DecorationItem[] = [];
  const bail = (why: string): Reconstruction => {
    warnOnce(`${why} — rendering this code span without highlighting.`);
    return { text: "", decorations: [], plain: true };
  };
  for (const part of children) {
    if (typeof part === "string") {
      text += part;
      continue;
    }
    if (!isElement(part)) {
      // a RawHtml leaf: pre-rendered HTML has no reconstructible source text
      return bail("a raw-HTML part inside a code span");
    }
    if (typeof part.tag === "function") {
      return bail("a component inside a code span cannot be highlighted");
    }
    const t = textContent(part);
    if (t === null) {
      return bail("a code-span part holds non-text content");
    }
    if (typeof part.tag === "string") {
      if (t === "") {
        return bail(`an empty <${part.tag}> part inside a code span`);
      }
      decorations.push({
        start: text.length,
        end: text.length + t.length,
        tagName: part.tag,
        // vnode props are already attribute-shaped (the reader authored them); hast takes them as-is
        properties: { ...part.props } as DecorationItem["properties"]
      });
    }
    // a fragment part contributes its text with no decoration
    text += t;
  }
  return { text, decorations, plain: false };
}

// ---------------------------------------------------------------------------------------------
// The default components
// ---------------------------------------------------------------------------------------------

/** Resolve the effective language, warning once on an unknown one. `undefined` → plain. */
function effectiveLang(explicit: string | undefined): string | undefined {
  const lang = explicit ?? config().language;
  if (lang !== undefined && !hasLang(lang)) {
    warnOnce(
      `no grammar loaded for language "${lang}" (load one via lstset({ languages: [...] }))`
    );
    return undefined;
  }
  return lang;
}

/**
 * The default `CodeBlock`. Props: `lang` (the fence tag; wins over `lstset({language})`).
 * Highlighted output is shiki's `<pre class="shiki …">` HTML as a `raw` leaf inside a block
 * `<div class="nota-code-block">` (so `struct` never paragraph-wraps a `<pre>`); the fallback is a
 * plain `<pre><code>` with the span's parts rendered as ordinary markup.
 */
export function DefaultCodeBlock(props: CompProps): unknown {
  const explicit = typeof props.lang === "string" ? props.lang : undefined;
  const recon = reconstruct(props.children);
  const lang = effectiveLang(explicit);
  if (!recon.plain && lang !== undefined) {
    const out = highlighter().codeToHtml(recon.text, {
      lang,
      theme: config().theme,
      decorations: recon.decorations
    });
    // block raw: shiki's own <pre> root must not be paragraph-wrapped inside the flow wrapper
    return h("div", { class: "nota-code-block" }, raw(out, { block: true }));
  }
  return h("pre", { class: "nota-code-block" }, [
    h("code", {}, props.children)
  ]);
}

/**
 * The default `CodeInline`. No per-span language syntax exists, so highlighting applies only
 * under a global `lstset({language})` (the `\lstinline` analogue); otherwise a plain `<code>`.
 * Highlighted output uses shiki's `structure: "inline"` (span runs only) inside the `<code>` host.
 */
export function DefaultCodeInline(props: CompProps): unknown {
  const recon = reconstruct(props.children);
  const lang = effectiveLang(undefined);
  if (!recon.plain && lang !== undefined) {
    const out = highlighter().codeToHtml(recon.text, {
      lang,
      theme: config().theme,
      structure: "inline",
      decorations: recon.decorations
    });
    return h("code", { class: "nota-code-inline" }, raw(out));
  }
  return h("code", { class: "nota-code-inline" }, props.children);
}
