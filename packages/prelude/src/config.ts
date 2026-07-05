/**
 * Prelude configuration: `lstset` / `mathset` (contract R14d).
 *
 * `lstset` (after LaTeX's listings package) sets the global code options the default
 * `CodeInline`/`CodeBlock` consult: the default `lang`, the `theme`, and extension
 * grammar/theme registrations. `mathset` sets the KaTeX `macros` the default `Tex` passes through.
 *
 * **Scope semantics (pinned R14d):** config is *document-global, last-write-wins* — R10 expands the
 * component slots inside `decode`, after the whole `Doc` body has evaluated, so a mid-document
 * `% lstset(…)` is NOT positional (unlike `\lstset`). Config is **reset to a baseline on every
 * `render()`** (via the runtime's `onRenderReset` hook), so one document's config never leaks into
 * the next in a multi-document build.
 *
 * The **baseline** starts as the shipped defaults. A site-wide setup module (the CLI's `--setup`
 * hook) may call `lstset`/`mathset` and then {@link bakeConfigBaseline} — from then on, per-render
 * resets restore *that* configuration instead of the shipped defaults. (Contrast
 * `registerComponents`, which is global-persistent and needs no baking.)
 */

import { onRenderReset } from "@nota-lang/runtime";
import type { LanguageRegistration, ThemeRegistrationAny } from "shiki/core";

/** Options for {@link lstset}. All fields merge into the current document config. */
export interface LstsetOptions {
  /** Default highlight language for fences without a tag and for inline code. */
  lang?: string;
  /** Shiki theme name. Must be a preloaded theme (`github-light`/`github-dark`) or one
   *  registered via {@link LstsetOptions.themes}. */
  theme?: string;
  /** Extension grammars (shiki `LanguageRegistration`s, e.g. `import hs from
   *  "shiki/langs/haskell.mjs"` → `langs: hs`). Accumulate. */
  langs?: LanguageRegistration[] | LanguageRegistration[][];
  /** Extension themes (shiki theme registrations). Accumulate. */
  themes?: ThemeRegistrationAny[];
}

/** Options for {@link mathset}. */
export interface MathsetOptions {
  /** KaTeX macros (`{ "\\R": "\\mathbb{R}" }`). Merge into the current macro table. */
  macros?: Record<string, string>;
}

/** The resolved prelude config the default components read. */
export interface PreludeConfig {
  lang: string | undefined;
  theme: string;
  extraLangs: LanguageRegistration[];
  extraThemes: ThemeRegistrationAny[];
  macros: Record<string, string>;
}

const DEFAULTS: PreludeConfig = {
  lang: undefined,
  theme: "github-light",
  extraLangs: [],
  extraThemes: [],
  macros: {}
};

function clone(c: PreludeConfig): PreludeConfig {
  return {
    ...c,
    extraLangs: [...c.extraLangs],
    extraThemes: [...c.extraThemes],
    macros: { ...c.macros }
  };
}

let baseline: PreludeConfig = clone(DEFAULTS);
let current: PreludeConfig = clone(baseline);

/** Set global code options (listings-style). Document-global, last-write-wins; see module docs. */
export function lstset(opts: LstsetOptions): void {
  if (opts.lang !== undefined) {
    current.lang = opts.lang;
  }
  if (opts.theme !== undefined) {
    current.theme = opts.theme;
  }
  if (opts.langs !== undefined) {
    current.extraLangs.push(...(opts.langs.flat() as LanguageRegistration[]));
  }
  if (opts.themes !== undefined) {
    current.extraThemes.push(...opts.themes);
  }
}

/** Set global math options (KaTeX macros). Same scope semantics as {@link lstset}. */
export function mathset(opts: MathsetOptions): void {
  if (opts.macros !== undefined) {
    Object.assign(current.macros, opts.macros);
  }
}

/**
 * Commit the *current* config as the per-render reset baseline. Call once from site setup code
 * (after your `lstset`/`mathset` calls); the CLI's `--setup` path does this automatically.
 */
export function bakeConfigBaseline(): void {
  baseline = clone(current);
}

/** The live config (read by the default components at expansion time). */
export function config(): Readonly<PreludeConfig> {
  return current;
}

/** Test hook: restore the shipped defaults as both current config and baseline. */
export function resetConfigForTest(): void {
  baseline = clone(DEFAULTS);
  current = clone(baseline);
}

// Per-render reset (R14d): render() → runtime reset() → restore the baked baseline.
onRenderReset(() => {
  current = clone(baseline);
});
