/**
 * KaTeX rendering for inline and display math. String and number parts form the TeX source;
 * markup parts are rejected because KaTeX cannot embed JSX inside a formula.
 */

import type { ResolvedChild } from "@nota-lang/core";
import katex from "katex";
import { children, type JSX, type ParentProps } from "solid-js";

import { config } from "./config";

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
    output: config().mathOutput,
    displayMode: display,
    trust: ctx => TRUSTED_COMMANDS.has(ctx.command),
    strict: (errorCode: string) =>
      errorCode === "htmlExtension" ? "ignore" : "warn",
    // copy: KaTeX mutates the macros table on \gdef; the doc-global table must stay config-owned
    macros: { ...config().macros }
  });
  return display ? (
    <div class="nota-tex-display" innerHTML={html} />
  ) : (
    <span class="nota-tex" innerHTML={html} />
  );
}
