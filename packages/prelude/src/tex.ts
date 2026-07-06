/**
 * The default math component (a shipped prelude default): KaTeX → MathML.
 *
 * `$…$` / `$$` fences lower to `h(Tex, {display?}, parts)`; the prelude's `Tex` slot resolves here
 * unless overridden. Parts are verbatim raw runs plus armed splices; KaTeX renders a *string*, so:
 *
 * - **string parts** (raw runs, and armed scalars already stringified by `flatten`) concatenate
 *   into the TeX source — `$a_|@i$` with `i = 3` renders `a_3`;
 * - a **markup part** (`$x |@em{y}$`) is a **hard error** — KaTeX cannot host HTML mid-formula.
 *   Register a custom component (`registerComponents({ Tex: … })`) for richer math.
 *
 * Output is `renderToString(tex, { output: "mathml", displayMode })` wrapped as a `raw` leaf inside
 * a host element — a `<span>` for inline (joins the paragraph run) and a block `<div>` for display
 * (a `HOST_BLOCK_TAGS` member, so `struct` never wraps display math in a `<p>`). The host wrapper
 * also serves `▸ = true`: a framework adapter renders a `raw` child as the host's innerHTML.
 *
 * MathML needs no KaTeX stylesheet or fonts — the browser's math engine renders it.
 */

import { type CompProps, h, raw } from "@nota-lang/runtime";
import katex from "katex";

import { config } from "./config";

/** Concatenate the TeX source from the span's parts; throw pointedly on a markup part. */
function texSource(children: CompProps["children"]): string {
  let out = "";
  for (const part of children) {
    if (typeof part !== "string") {
      throw new Error(
        "Tex: a markup part inside math cannot be rendered by KaTeX (armed interpolation in $…$ " +
          "must produce a string or number, e.g. $a_|@i$ with a scalar i). For markup-bearing math, " +
          "register a custom component: registerComponents({ Tex: … })."
      );
    }
    out += part;
  }
  return out;
}

/** The default `Tex` (see module docs). Props: `display` (the `$$` fence sets it). */
export function DefaultTex(props: CompProps): unknown {
  const display = props.display === true;
  const html = katex.renderToString(texSource(props.children), {
    output: "mathml",
    displayMode: display,
    // copy: KaTeX mutates the macros table on \gdef; the doc-global table must stay config-owned
    macros: { ...config().macros }
  });
  return display
    ? h("div", { class: "nota-tex-display" }, raw(html, { block: true }))
    : h("span", { class: "nota-tex" }, raw(html));
}
