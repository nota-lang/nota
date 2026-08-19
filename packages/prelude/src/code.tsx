/**
 * Synchronous Shiki components for inline code and fences. Resolved element parts become
 * decorations over their extracted text; unknown languages fall back to plain code.
 */

import {
  HYDRATION_KEY_ATTR,
  isSSRChunk,
  parseOpeningTag,
  type ResolvedChild,
  textOf
} from "@nota-lang/core";
import {
  createHighlighterCoreSync,
  type DecorationItem,
  type HighlighterCore,
  type LanguageRegistration,
  type ThemeRegistrationAny
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

// Highlighter

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

/** Names and aliases available to editors without extra registration. */
export const BASE_LANG_NAMES: readonly string[] = BASE_LANGS.flatMap(g => [
  g.name,
  ...(g.aliases ?? [])
]);

/** The preloaded theme names (`lstset({ theme })` accepts these without extra registration). */
export const BASE_THEME_NAMES: readonly string[] = BASE_THEMES.flatMap(t =>
  t.name === undefined ? [] : [t.name]
);

const engine = createJavaScriptRegexEngine();
let cached: {
  langs: LanguageRegistration[];
  themes: ThemeRegistrationAny[];
  highlighter: HighlighterCore;
} | null = null;

function sameItems<T>(left: T[], right: T[]): boolean {
  return (
    left.length === right.length && left.every((item, i) => item === right[i])
  );
}

/** The current highlighter, rebuilt only when the grammar/theme registration set changes. */
function highlighter(): HighlighterCore {
  const cfg = config();
  const langs = [...BASE_LANGS, ...cfg.extraLangs];
  const themes = [...BASE_THEMES, ...cfg.extraThemes];
  if (
    cached === null ||
    !sameItems(cached.langs, langs) ||
    !sameItems(cached.themes, themes)
  ) {
    cached = {
      langs,
      themes,
      highlighter: createHighlighterCoreSync({ langs, themes, engine })
    };
  }
  return cached.highlighter;
}

/** Is `lang` a loaded grammar name or alias? */
function hasLang(lang: string): boolean {
  return highlighter().getLoadedLanguages().includes(lang);
}

// Warnings

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

// Source recovery

/** Hydration bookkeeping attributes that must not ride into a decoration's properties. */
const BOOKKEEPING_ATTRS = new Set([HYDRATION_KEY_ATTR]);

/** The root tag + attributes of a resolved element part (DOM node or SSR chunk), if any. */
function partElement(
  part: ResolvedChild
): { tagName: string; properties: Record<string, string> } | null {
  if (part === null || part === undefined || typeof part !== "object") {
    return null;
  }
  if (isSSRChunk(part)) {
    const opening = parseOpeningTag(part.t);
    if (!opening) {
      return null; // marker-led chunk (dynamic-rooted component) — no recoverable root
    }
    const properties: Record<string, string> = {};
    for (const [name, value] of Object.entries(opening.attrs)) {
      if (!BOOKKEEPING_ATTRS.has(name)) {
        properties[name] = value;
      }
    }
    return { tagName: opening.tag, properties };
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

/** Reconstruct source text and decoration ranges from resolved parts. */
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

// Components

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

/** Render a highlighted fence, or plain code when no grammar is available. */
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

/** Render inline code, highlighted when `lstset` provides a language. */
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
