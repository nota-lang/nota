/**
 * The default code components: sync shiki, as plain Solid components.
 *
 * `` `…` `` lowers to `<CodeInline>{parts}</CodeInline>` and a fence to
 * `<CodeBlock lang?>{parts}</CodeBlock>`. The source text is recovered from the resolved parts
 * (`textOf` — strings verbatim, armed scalars stringified, elements contribute their text
 * content), tokenized whole, and rendered via `innerHTML`.
 *
 * **Armed parts are decorations** (the restored old model, now over *resolved* children): an
 * armed element contributes its text content to the source AND records a shiki decoration over
 * that range — `tagName` and attribute `properties` recovered from the resolved node (DOM
 * inspection client-side, opening-tag sniffing on SSR chunks; hydration bookkeeping attrs are
 * dropped). A text-less armed part contributes nothing and warns once.
 *
 * The highlighter is a **sync** core (JS regex engine; grammars/themes eagerly imported).
 * Language resolution: the fence `lang` tag wins, else `lstset({lang})`; no lang (or an unknown
 * one, with a warning) → plain `<pre><code>`.
 */

import { type ResolvedChild, textOf } from "@nota-lang/solid";
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
import { children, type JSX, type ParentProps } from "solid-js";

import { config } from "./config";

// ---------------------------------------------------------------------------------------------
// The sync highlighter (curated grammars + lstset extensions; memoized on the registration set)
// ---------------------------------------------------------------------------------------------

/** The curated default grammar set. Extend at runtime via `lstset({ langs })`. */
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

/** Test hook: forget which warnings fired. */
export function resetCodeWarningsForTest(): void {
  warned.clear();
}

// ---------------------------------------------------------------------------------------------
// Source recovery: parts → contiguous text + decorations
// ---------------------------------------------------------------------------------------------

/** Hydration bookkeeping attributes that must not ride into a decoration's properties. */
const BOOKKEEPING_ATTRS = new Set(["data-hk"]);

const ENTITIES: Record<string, string> = {
  "&amp;": "&",
  "&lt;": "<",
  "&gt;": ">",
  "&quot;": '"',
  "&#39;": "'"
};
const decodeEntities = (v: string): string =>
  v.replace(/&(?:amp|lt|gt|quot|#39);/g, m => ENTITIES[m]);

/** The root tag + attributes of a resolved element part (DOM node or SSR chunk), if any. */
function partElement(
  part: ResolvedChild
): { tagName: string; properties: Record<string, string> } | null {
  if (part === null || part === undefined || typeof part !== "object") {
    return null;
  }
  const chunk = (part as { t?: string }).t;
  if (typeof chunk === "string") {
    const m = /^<([a-zA-Z][a-zA-Z0-9-]*)((?:[^>"]|"[^"]*")*)>/.exec(chunk);
    if (!m) {
      return null; // marker-led chunk (dynamic-rooted component) — no recoverable root
    }
    const properties: Record<string, string> = {};
    for (const [, name, value] of m[2].matchAll(
      /([a-zA-Z_][\w-]*)="([^"]*)"/g
    )) {
      if (!BOOKKEEPING_ATTRS.has(name)) {
        properties[name] = decodeEntities(value);
      }
    }
    return { tagName: m[1].toLowerCase(), properties };
  }
  const node = part as Node;
  if (node.nodeType === 1) {
    const el = node as Element;
    const properties: Record<string, string> = {};
    for (const attr of Array.from(el.attributes)) {
      if (!BOOKKEEPING_ATTRS.has(attr.name)) {
        properties[attr.name] = attr.value;
      }
    }
    return { tagName: el.tagName.toLowerCase(), properties };
  }
  return null;
}

interface Reconstruction {
  text: string;
  decorations: DecorationItem[];
}

/**
 * Reconstruct one contiguous source text from the resolved parts: strings/scalars append
 * verbatim; an armed element contributes its text content and records a decoration over that
 * range (a text-less part contributes nothing, with a build warning).
 */
function reconstruct(parts: ResolvedChild[]): Reconstruction {
  let text = "";
  const decorations: DecorationItem[] = [];
  for (const part of parts) {
    if (part === null || part === undefined || typeof part === "boolean") {
      continue;
    }
    if (typeof part === "string" || typeof part === "number") {
      text += textOf(part);
      continue;
    }
    const partText = textOf(part);
    if (partText === "") {
      warnOnce(
        "a text-less armed part inside a code span contributes nothing (no range to decorate)"
      );
      continue;
    }
    const el = partElement(part);
    if (el) {
      decorations.push({
        start: text.length,
        end: text.length + partText.length,
        tagName: el.tagName,
        properties: el.properties
      });
    }
    text += partText;
  }
  return { text, decorations };
}

// ---------------------------------------------------------------------------------------------
// The default components
// ---------------------------------------------------------------------------------------------

/** Resolve the effective lang, warning once on an unknown one. `undefined` → plain. */
function effectiveLang(explicit: string | undefined): string | undefined {
  const lang = explicit ?? config().lang;
  if (lang !== undefined && !hasLang(lang)) {
    warnOnce(
      `no grammar loaded for lang "${lang}" (load one via lstset({ langs: [...] }))`
    );
    return undefined;
  }
  return lang;
}

/**
 * The default `CodeBlock`. Props: `lang` (the fence tag; wins over `lstset({lang})`).
 * Highlighted output is shiki's `<pre class="shiki …">` HTML inside a
 * `<div class="nota-code-block">` (a block under Reforest's categorization); the fallback is a
 * plain `<pre><code>` with the resolved parts.
 */
export function CodeBlock(props: ParentProps & { lang?: string }): JSX.Element {
  const resolved = children(() => props.children);
  const explicit = typeof props.lang === "string" ? props.lang : undefined;
  const lang = effectiveLang(explicit);
  if (lang !== undefined) {
    const { text, decorations } = reconstruct(resolved.toArray());
    const out = highlighter().codeToHtml(text, {
      lang,
      theme: config().theme,
      decorations
    });
    return <div class="nota-code-block" innerHTML={out} />;
  }
  return (
    <pre class="nota-code-block">
      <code>{resolved()}</code>
    </pre>
  );
}

/**
 * The default `CodeInline`. No per-span lang syntax exists, so highlighting applies only under a
 * global `lstset({lang})` (the `\lstinline` analogue); otherwise a plain `<code>`. Highlighted
 * output uses shiki's `structure: "inline"` (span runs only) inside the `<code>` host.
 */
export function CodeInline(props: ParentProps): JSX.Element {
  const resolved = children(() => props.children);
  const lang = effectiveLang(undefined);
  if (lang !== undefined) {
    const { text, decorations } = reconstruct(resolved.toArray());
    const out = highlighter().codeToHtml(text, {
      lang,
      theme: config().theme,
      structure: "inline",
      decorations
    });
    return <code class="nota-code-inline" innerHTML={out} />;
  }
  return <code class="nota-code-inline">{resolved()}</code>;
}
