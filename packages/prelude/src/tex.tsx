/**
 * KaTeX rendering for inline and display math. String and number parts form the TeX source;
 * markup parts are rejected because KaTeX cannot embed JSX inside a formula.
 */

import type { ResolvedChild } from "@nota-lang/core";
import katex from "katex";
import { children, type JSX, type ParentProps } from "solid-js";

import { sessionConfig } from "./session-config";

/** Concatenate the TeX source from the resolved parts; throw pointedly on a markup part. */
function texSource(parts: ResolvedChild[]): string {
  let out = "";
  for (const part of parts) {
    if (typeof part === "string") {
      out += part;
    } else if (typeof part === "number") {
      out += String(part);
    } else if (
      part === null ||
      part === undefined ||
      typeof part === "boolean"
    ) {
      // dropped, JSX child semantics
    } else {
      throw new Error(
        "Tex: a markup part inside math cannot be rendered by KaTeX (armed interpolation in $…$ " +
          "must produce a string or number, e.g. $a_|@i$ with a scalar i). For markup-bearing " +
          "math, %import a custom Tex component."
      );
    }
  }
  return out;
}

/**
 * The trust policy for the HTML-extension commands `texRef` rides on (`\htmlData` et al.). Fixed:
 * a Nota document is its author's own program — the reference wiring is not untrusted input.
 */
const TRUSTED_COMMANDS = new Set([
  "\\htmlData",
  "\\htmlClass",
  "\\htmlId",
  "\\htmlStyle",
  "\\href",
  "\\url"
]);

/** The default `Tex` (see module docs). Props: `display` (the `$$` fence sets it). */
export function Tex(props: ParentProps & { display?: boolean }): JSX.Element {
  const resolved = children(() => props.children);
  const display = props.display === true;
  const html = katex.renderToString(texSource(resolved.toArray()), {
    // `mathset({ output: "html" })` opts into HTML output (KaTeX CSS required; enables texRef
    // definition references — MathML output drops \htmlData attributes).
    output: mathConfig().output,
    displayMode: display,
    trust: ctx => TRUSTED_COMMANDS.has(ctx.command),
    strict: (errorCode: string) =>
      errorCode === "htmlExtension" ? "ignore" : "warn",
    // copy: KaTeX mutates the macros table on \gdef; the doc-global table must stay config-owned
    macros: { ...mathConfig().macros }
  });
  return display ? (
    <div class="nota-tex-display" innerHTML={html} />
  ) : (
    <span class="nota-tex" innerHTML={html} />
  );
}

// Configuration

/** What `mathset` controls: how KaTeX renders this document's math. */
export interface MathConfig {
  /** TeX macros, merged by {@link MathsetOptions.macros}. */
  macros: Record<string, string>;
  /** KaTeX output mode; see {@link MathsetOptions.output}. */
  output: "mathml" | "html" | "htmlAndMathml";
}

const MATH = sessionConfig<MathConfig>(
  () => ({ macros: {}, output: "mathml" }),
  c => ({ ...c, macros: { ...c.macros } })
);

/** The math configuration for the active document session. */
export function mathConfig(): Readonly<MathConfig> {
  return MATH.read();
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

/** Set math options (KaTeX macros + output mode). Positional. */
export function mathset(opts: MathsetOptions): void {
  const config = MATH.update();
  if (opts.macros !== undefined) {
    Object.assign(config.macros, opts.macros);
  }
  if (opts.output !== undefined) {
    config.output = opts.output;
  }
}
