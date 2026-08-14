/**
 * Prelude configuration: `lstset` / `mathset` + `secset` / `bibset` (design/decode.md §The
 * registry & config).
 *
 * `lstset` (after LaTeX's listings package) sets the global code options the default
 * `CodeInline`/`CodeBlock` consult: the default `lang`, the `theme`, and extension
 * grammar/theme registrations. `mathset` sets the KaTeX `macros` the default `Tex` passes through.
 * `secset` sets the doc-state heading `numberDepth` and `bibset` the citation source/style
 * the `@Cite`/`@Bibliography` constructs read — **all four share the same scope machinery**.
 *
 * **Scope semantics (pinned):** config is *document-global, last-write-wins* — the component
 * slots expand as static templates inside `decode`, after the whole `Doc` body has evaluated, so a mid-document
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
  /**
   * KaTeX output mode (last-write-wins). The default `"mathml"` needs no stylesheet or fonts;
   * `"html"` (or the belt-and-suspenders `"htmlAndMathml"`) requires the KaTeX CSS + fonts on the
   * page, and is what makes `texRef` definition references clickable — KaTeX only emits
   * `\htmlData` attributes in HTML output.
   */
  output?: "mathml" | "html" | "htmlAndMathml";
}

/** One bibliography entry (the fields `@Bibliography` renders; all optional). */
export interface BibEntry {
  author?: string;
  title?: string;
  year?: string | number;
  url?: string;
}

/** Options for {@link secset} (heading numbering). */
export interface SecsetOptions {
  /** Number headings of rank ≤ this depth (0 = off, the default). Last-write-wins. */
  numberDepth?: number;
}

/** Options for {@link bibset} (citations). */
export interface BibsetOptions {
  /** The citation source, keyed by cite key. Merges into the current source. */
  src?: Record<string, BibEntry>;
  /** Label style: `"numeric"` (order of first citation; default) or `"alpha"` (sorted by author/title). */
  style?: "numeric" | "alpha";
}

/** The resolved prelude config the default components read. */
export interface PreludeConfig {
  lang: string | undefined;
  theme: string;
  extraLangs: LanguageRegistration[];
  extraThemes: ThemeRegistrationAny[];
  macros: Record<string, string>;
  /** KaTeX output mode (see {@link MathsetOptions.output}). */
  mathOutput: "mathml" | "html" | "htmlAndMathml";
  /** Heading numbering depth. `0` = numbering off. */
  numberDepth: number;
  /** Citation source keyed by cite key. */
  bibSrc: Record<string, BibEntry>;
  /** Citation label style. */
  bibStyle: "numeric" | "alpha";
}

const DEFAULTS: PreludeConfig = {
  lang: undefined,
  theme: "github-light",
  extraLangs: [],
  extraThemes: [],
  macros: {},
  mathOutput: "mathml",
  numberDepth: 0,
  bibSrc: {},
  bibStyle: "numeric"
};

function clone(c: PreludeConfig): PreludeConfig {
  return {
    ...c,
    extraLangs: [...c.extraLangs],
    extraThemes: [...c.extraThemes],
    macros: { ...c.macros },
    bibSrc: { ...c.bibSrc }
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

/** Set global math options (KaTeX macros + output mode). Same scope semantics as {@link lstset}. */
export function mathset(opts: MathsetOptions): void {
  if (opts.macros !== undefined) {
    Object.assign(current.macros, opts.macros);
  }
  if (opts.output !== undefined) {
    current.mathOutput = opts.output;
  }
}

/** Set the heading numbering depth. Same scope semantics as {@link lstset}. */
export function secset(opts: SecsetOptions): void {
  if (opts.numberDepth !== undefined) {
    current.numberDepth = opts.numberDepth;
  }
}

/** Set the citation source/style. Same scope semantics as {@link lstset} (`src` merges). */
export function bibset(opts: BibsetOptions): void {
  if (opts.src !== undefined) {
    Object.assign(current.bibSrc, opts.src);
  }
  if (opts.style !== undefined) {
    current.bibStyle = opts.style;
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

// Per-render reset: render() → runtime reset() → restore the baked baseline.
onRenderReset(() => {
  current = clone(baseline);
});
