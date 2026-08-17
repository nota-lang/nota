/**
 * Prelude configuration: `lstset` / `mathset` + `secset` / `bibset` (design/solid.md §The
 * prelude).
 *
 * `lstset` (after LaTeX's listings package) sets the code options the default
 * `CodeInline`/`CodeBlock` consult; `mathset` the KaTeX macros/output the default `Tex` passes
 * through; `secset` the heading `numberDepth`; `bibset` the citation source/style.
 *
 * **Scope semantics (changed from decode.md, intentionally):** config calls are **positional** —
 * statements execute in document order during the single component-body run, so a mid-document
 * `% lstset(…)` affects subsequent code blocks only (matching LaTeX's actual `\lstset`), not
 * "last write wins globally". Config is module-global with a bakeable baseline: a site setup
 * module calls `lstset`/… then {@link bakeConfigBaseline}; {@link resetConfig} restores the
 * baseline. The reset is registered with `@nota-lang/core`'s render-reset seam
 * ({@link onRenderReset}) at module load, so every document render — **each SSG pass** of
 * `renderDocument`, and `hydrateDocument` before claiming — starts from the baseline. Without
 * the per-pass reset, pass 1's end-state would seed pass 2 and positionality would be destroyed
 * in the converged HTML.
 */

import { onRenderReset } from "@nota-lang/core";
import type { LanguageRegistration, ThemeRegistrationAny } from "shiki/core";

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

/** Options for {@link mathset}. */
export interface MathsetOptions {
  /** KaTeX macros (`{ "\\R": "\\mathbb{R}" }`). Merge into the current macro table. */
  macros?: Record<string, string>;
  /**
   * KaTeX output mode. The default `"mathml"` needs no stylesheet or fonts; `"html"` (or
   * `"htmlAndMathml"`) requires the KaTeX CSS + fonts on the page, and is what makes `texRef`
   * definition references clickable — KaTeX only emits `\htmlData` attributes in HTML output.
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
  /** Number headings of rank ≤ this depth (0 = off, the default). */
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
  mathOutput: "mathml" | "html" | "htmlAndMathml";
  /** Heading numbering depth. `0` = numbering off. */
  numberDepth: number;
  bibSrc: Record<string, BibEntry>;
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

/** Set code options (listings-style). Positional; see module docs. */
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

/** Set math options (KaTeX macros + output mode). Positional. */
export function mathset(opts: MathsetOptions): void {
  if (opts.macros !== undefined) {
    Object.assign(current.macros, opts.macros);
  }
  if (opts.output !== undefined) {
    current.mathOutput = opts.output;
  }
}

/** Set the heading numbering depth. Positional (place before the headings it should govern). */
export function secset(opts: SecsetOptions): void {
  if (opts.numberDepth !== undefined) {
    current.numberDepth = opts.numberDepth;
  }
}

/** Set the citation source/style (`src` merges). Positional. */
export function bibset(opts: BibsetOptions): void {
  if (opts.src !== undefined) {
    Object.assign(current.bibSrc, opts.src);
  }
  if (opts.style !== undefined) {
    current.bibStyle = opts.style;
  }
}

/**
 * Commit the *current* config as the reset baseline. Call once from site setup code (after your
 * `lstset`/`mathset` calls); {@link resetConfig} then restores this configuration.
 */
export function bakeConfigBaseline(): void {
  baseline = clone(current);
}

/**
 * Restore the baked baseline. Registered as a render reset below, so the drivers run it at the
 * start of every document render (each SSG pass; hydration before claiming) — callable directly
 * by hosts with their own render loop.
 */
export function resetConfig(): void {
  current = clone(baseline);
}

// Module-scope registration: config is render-scoped state, reset per pass (module docs above).
onRenderReset(resetConfig);

/** The live config (read by the default components at render time). */
export function config(): Readonly<PreludeConfig> {
  return current;
}

/** Test hook: restore the shipped defaults as both current config and baseline. */
export function resetConfigForTest(): void {
  baseline = clone(DEFAULTS);
  current = clone(baseline);
}
