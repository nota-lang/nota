/**
 * Inference rules — premises over a conclusion with an optional small-caps rule name.
 *
 * {@link inferRule} builds KaTeX-legal TeX (`\dfrac`, `\quad`-joined premises, optional
 * `\begin{array}{c}` chunking via `premisesPerRow`, and `\textsf{\small …}` for the name —
 * KaTeX has no `\textsc`, empirically);
 * {@link IR} is the component form, rendering through the prelude's `Tex` as display math.
 * A rule with no premises uses a thin-space numerator (`\dfrac{\,}{c}`) so the bar still draws.
 */

import { Tex } from "@nota-lang/prelude";
import type { JSX } from "solid-js";

/** Options for {@link inferRule}. */
export interface InferRuleOptions {
  /** Premise TeX strings (joined with `\quad`). Default: none. */
  premises?: string[];
  /** The conclusion TeX. */
  conclusion: string;
  /** Small-caps rule name set beside the fraction. */
  name?: string;
  /** Chunk premises into rows of this many (a `\begin{array}{c}` numerator). */
  premisesPerRow?: number;
}

/** TeX for one inference rule (see the module docs). */
export function inferRule(opts: InferRuleOptions): string {
  const premises = opts.premises ?? [];
  const per = opts.premisesPerRow;
  let top: string;
  if (premises.length === 0) {
    top = "\\,";
  } else if (per !== undefined && per > 0 && premises.length > per) {
    const rows: string[] = [];
    for (let i = 0; i < premises.length; i += per) {
      rows.push(premises.slice(i, i + per).join(" \\quad "));
    }
    top = `\\begin{array}{c}${rows.join(" \\\\ ")}\\end{array}`;
  } else {
    top = premises.join(" \\quad ");
  }
  let out = `\\dfrac{${top}}{${opts.conclusion}}`;
  if (opts.name !== undefined && opts.name !== "") {
    out = `{${out}}\\;\\textsf{\\small ${opts.name}}`;
  }
  return out;
}

/**
 * The inference-rule component. Props: `top` (premise TeX, a string or string array), `bot`
 * (the conclusion TeX — required), `name` (rule name), `perRow` (premises per numerator row).
 * Renders as display math through `Tex`.
 */
export function IR(props: {
  top?: string | string[];
  bot?: string;
  name?: string;
  perRow?: number;
}): JSX.Element {
  const bot = props.bot;
  if (typeof bot !== "string" || bot.trim() === "") {
    throw new Error(
      '@IR: missing bot (the conclusion TeX), e.g. @IR[top: "\\Gamma \\vdash e : \\tau", bot: "…"]'
    );
  }
  const top = props.top;
  const premises =
    top == null
      ? undefined
      : Array.isArray(top)
        ? top.map(String)
        : [String(top)];
  const name = typeof props.name === "string" ? props.name : undefined;
  const perRow = typeof props.perRow === "number" ? props.perRow : undefined;
  return (
    <Tex display>
      {inferRule({ premises, conclusion: bot, name, premisesPerRow: perRow })}
    </Tex>
  );
}
