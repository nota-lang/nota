/**
 * The default math component: KaTeX → MathML, as a plain Solid component.
 *
 * `$…$` / `$$` fences lower to `<Tex display?>{parts}</Tex>`. Parts are verbatim raw runs plus
 * armed splices; KaTeX renders a *string*, so:
 *
 * - **string/number parts** (raw runs, armed scalars) concatenate into the TeX source —
 *   `$a_|@i$` with `i = 3` renders `a_3`;
 * - a **markup part** (`$x |@em{y}$`) is a **hard error** — KaTeX cannot host HTML mid-formula.
 *   `%import` a custom `Tex` for richer math.
 *
 * The part inspection uses Solid's `children()` resolution (strings/numbers pass through;
 * an element node or SSR chunk = a markup part). Output lands via `innerHTML` — a `<span>` for
 * inline (joins the paragraph run under Reforest's categorization) and a `<div>` for display
 * (a block). MathML needs no KaTeX stylesheet or fonts.
 */

import type { ResolvedChild } from "@nota-lang/solid";
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
