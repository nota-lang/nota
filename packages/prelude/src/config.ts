/** Positional, document-session configuration for the prelude. */

import { type DocState, useOptionalDocState } from "@nota-lang/core";
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

let setup: PreludeConfig = clone(DEFAULTS);
const CONFIG_KEY = {};

function current(session?: DocState): PreludeConfig {
  const active = session ?? useOptionalDocState();
  return active?.local(CONFIG_KEY, () => clone(setup)) ?? setup;
}

/** Set code options (listings-style). Positional; see module docs. */
export function lstset(opts: LstsetOptions): void {
  const config = current();
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

/** Set math options (KaTeX macros + output mode). Positional. */
export function mathset(opts: MathsetOptions): void {
  const config = current();
  if (opts.macros !== undefined) {
    Object.assign(config.macros, opts.macros);
  }
  if (opts.output !== undefined) {
    config.mathOutput = opts.output;
  }
}

/** Set the heading numbering depth. Positional (place before the headings it should govern). */
export function secset(opts: SecsetOptions): void {
  const config = current();
  if (opts.numberDepth !== undefined) {
    config.numberDepth = opts.numberDepth;
  }
}

/** Set the citation source/style (`src` merges). Positional. */
export function bibset(opts: BibsetOptions): void {
  const config = current();
  if (opts.src !== undefined) {
    Object.assign(config.bibSrc, opts.src);
  }
  if (opts.style !== undefined) {
    config.bibStyle = opts.style;
  }
}

/** The live config (read by the default components at render time). */
export function config(session?: DocState): Readonly<PreludeConfig> {
  return current(session);
}

/** Test hook: restore the shipped defaults as both current config and baseline. */
export function resetConfigForTest(): void {
  setup = clone(DEFAULTS);
}
