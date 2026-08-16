/**
 * The default code components: sync shiki, as plain Solid components.
 *
 * `` `…` `` lowers to `<CodeInline>{parts}</CodeInline>` and a fence to
 * `<CodeBlock lang?>{parts}</CodeBlock>`. The source text is recovered from the resolved parts
 * (`textOf` — strings verbatim, armed scalars stringified, elements contribute their text
 * content), tokenized whole, and rendered via `innerHTML`.
 *
 * **v0 regression, flagged in design/solid.md:** armed-part *decorations* (an element inside
 * code becoming a shiki decoration over its range) are dropped — armed elements contribute
 * their text only, with a one-time build warning. Restoring them means mapping resolved-child
 * offsets to decoration ranges; deferred with the reader-vNext work.
 *
 * The highlighter is a **sync** core (JS regex engine; grammars/themes eagerly imported).
 * Language resolution: the fence `lang` tag wins, else `lstset({lang})`; no lang (or an unknown
 * one, with a warning) → plain `<pre><code>`.
 */

import { type ResolvedChild, textOf } from "@nota-lang/solid";
import { createHighlighterCoreSync, type HighlighterCore } from "shiki/core";
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
// Source recovery
// ---------------------------------------------------------------------------------------------

/** The code text of the resolved parts; warns once when an armed element loses its decoration. */
function sourceText(parts: ResolvedChild[]): string {
  let out = "";
  for (const part of parts) {
    if (typeof part === "string" || typeof part === "number") {
      out += textOf(part);
      continue;
    }
    if (part === null || part === undefined || typeof part === "boolean") {
      continue;
    }
    // An armed element (or component output): its text joins the code; the decoration is
    // dropped (the flagged v0 regression).
    warnOnce(
      "an armed markup part inside a code span contributes its text only " +
        "(decorations are not yet supported in the Solid runtime)"
    );
    out += textOf(part);
  }
  return out;
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
    const out = highlighter().codeToHtml(sourceText(resolved.toArray()), {
      lang,
      theme: config().theme
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
    const out = highlighter().codeToHtml(sourceText(resolved.toArray()), {
      lang,
      theme: config().theme,
      structure: "inline"
    });
    return <code class="nota-code-inline" innerHTML={out} />;
  }
  return <code class="nota-code-inline">{resolved()}</code>;
}
