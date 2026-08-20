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
// Shiki's granular packages, never the `shiki` umbrella. `shiki/core` is condition-sensitive --
// under the `unwasm` condition (which Nitro adds by default) it resolves to an entry that
// registers `() => import("shiki/wasm")`, and `shiki/wasm` under the same condition is the raw
// 466 KB `onig.wasm`. That drags Oniguruma into every consumer's graph and breaks bundlers that
// cannot resolve a wasm module's `env` import -- to service a loader that is never called, since
// the engine below is the pure-JS one. `@shikijs/*` have no conditional exports, so there is
// nothing for a downstream build to rewire.
import { createHighlighterCoreSync } from "@shikijs/core";
import type {
  DecorationItem,
  HighlighterCore,
  LanguageRegistration,
  ThemeRegistrationAny
} from "@shikijs/core/types";
import { createJavaScriptRegexEngine } from "@shikijs/engine-javascript";
import githubDark from "@shikijs/themes/github-dark";
import githubLight from "@shikijs/themes/github-light";
import { children, type JSX, type ParentProps } from "solid-js";

import { sessionConfig } from "./session-config";

// Highlighter

/**
 * No grammar is bundled by default. A shiki grammar is ~50-190 KB of generated TextMate JSON, so
 * a preloaded set is paid for by every document on every page whether or not it highlights
 * anything — the eleven this package used to preload were 1 MB. A document registers what it
 * needs and ships only that:
 *
 * ```
 * %import rust from "@shikijs/langs/rust"
 * % lstset({ langs: [rust] })
 * ```
 *
 * `@nota-lang/prelude/langs` re-exports the old curated set as `COMMON_LANGS` for callers that
 * want all eleven back in one line — opt-in, so the cost is visible at the import site.
 */
const BASE_LANGS: LanguageRegistration[] = [];
const BASE_THEMES = [githubLight, githubDark];

/**
 * The grammar names and aliases the highlighter will accept right now — the bundled set plus
 * everything `lstset({ langs })` has registered in the current document session. Dynamic by
 * necessity: with grammars opt-in there is no static answer.
 */
export function loadedLangNames(): readonly string[] {
  return highlighter().getLoadedLanguages();
}

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
  const cfg = codeConfig();
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
  const lang = explicit ?? codeConfig().lang;
  if (lang !== undefined && !hasLang(lang)) {
    warnOnce(
      `no grammar loaded for lang "${lang}". Grammars are opt-in: import one from shiki ` +
        `(%import ${lang} from "@shikijs/langs/${lang}") and register it with ` +
        `lstset({ langs: [${lang}] }), or import { COMMON_LANGS } from ` +
        `"@nota-lang/prelude/langs" for the common set.`
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
      theme: codeConfig().theme,
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
      theme: codeConfig().theme,
      structure: "inline",
      decorations
    });
    return <code class="nota-code-inline" innerHTML={out} />;
  }
  return <code class="nota-code-inline">{resolved()}</code>;
}

// Configuration

/** What `lstset` controls: the grammars and theme the code components highlight with. */
export interface CodeConfig {
  /** Default highlight language for fences without a tag and for inline code. */
  lang: string | undefined;
  /** The active theme name. */
  theme: string;
  /** Grammars registered through {@link LstsetOptions.langs}. */
  extraLangs: LanguageRegistration[];
  /** Themes registered through {@link LstsetOptions.themes}. */
  extraThemes: ThemeRegistrationAny[];
}

const CODE = sessionConfig<CodeConfig>(
  () => ({
    lang: undefined,
    theme: "github-light",
    extraLangs: [],
    extraThemes: []
  }),
  c => ({
    ...c,
    extraLangs: [...c.extraLangs],
    extraThemes: [...c.extraThemes]
  })
);

/** The code configuration for the active document session. */
export function codeConfig(): Readonly<CodeConfig> {
  return CODE.read();
}

/** Options for {@link lstset}. All fields merge into the current document config. */
export interface LstsetOptions {
  /** Default highlight language for fences without a tag and for inline code. */
  lang?: string;
  /** Shiki theme name. Must be a preloaded theme (`github-light`/`github-dark`) or one
   *  registered via {@link LstsetOptions.themes}. */
  theme?: string;
  /** Extension grammars (shiki `LanguageRegistration`s). Accumulate. */
  langs?: LanguageRegistration[] | LanguageRegistration[][];
  /** Extension themes (shiki theme registrations). Accumulate. */
  themes?: ThemeRegistrationAny[];
}

/** Set code options (listings-style). Positional; see module docs. */
export function lstset(opts: LstsetOptions): void {
  const config = CODE.update();
  if (opts.lang !== undefined) {
    config.lang = opts.lang;
  }
  if (opts.theme !== undefined) {
    config.theme = opts.theme;
  }
  if (opts.langs !== undefined) {
    config.extraLangs.push(...(opts.langs.flat() as LanguageRegistration[]));
  }
  if (opts.themes !== undefined) {
    config.extraThemes.push(...opts.themes);
  }
}
