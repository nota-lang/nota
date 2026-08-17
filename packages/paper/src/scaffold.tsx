/**
 * Paper scaffolding — plain Solid components for the front matter and layout of an academic
 * paper: title block, author block, abstract, small-caps, float/flex layout helpers, and
 * numbered figures with captions.
 *
 * Figures ride the doc-state store: `Figure` registers a `"figure"` fact — its per-kind `seq`
 * IS the figure number — and, when it has an `id`, a `"definition"` fact whose `labelText` is
 * `"Figure N"` and whose tooltip bank renders the figure body, so `&id` references render
 * "Figure N" with a tooltip showing the figure itself. `Caption` counts the figures registered
 * at positions before its own (`pos`) and prefixes "Figure N: "; a caption with no preceding
 * figure renders unlabeled.
 *
 * `Title` is the prelude's component (a raw `h1.nota-title`, not `Heading`): unnumbered and
 * absent from the TOC — the paper-title analogue of `\section*`.
 */

import { DefBank } from "@nota-lang/prelude";
import { type Fact, Reforest, useDocState } from "@nota-lang/core";
import { type JSX, type ParentProps, Show } from "solid-js";

/** The paper title: a raw, unnumbered, un-TOC'd `h1`. */
export { Title } from "@nota-lang/prelude";

/** The author block container (a flex row of `Author`s). */
export function Authors(props: ParentProps): JSX.Element {
  return <div class="nota-authors">{props.children}</div>;
}

/** One author (a column of `Name`/`Affiliation`/…). */
export function Author(props: ParentProps): JSX.Element {
  return <div class="nota-author">{props.children}</div>;
}

/** An author's name. */
export function Name(props: ParentProps): JSX.Element {
  return <div class="nota-author-name">{props.children}</div>;
}

/** An author's affiliation line. */
export function Affiliation(props: ParentProps): JSX.Element {
  return <div class="nota-author-affiliation">{props.children}</div>;
}

/** An institution line. */
export function Institution(props: ParentProps): JSX.Element {
  return <div class="nota-institution">{props.children}</div>;
}

/** The abstract: a titled flow container (children reforest into paragraphs). */
export function Abstract(props: ParentProps): JSX.Element {
  return (
    <div class="nota-abstract">
      <div class="nota-abstract-title">Abstract</div>
      <Reforest>{props.children}</Reforest>
    </div>
  );
}

/** Small-caps text. */
export function Smallcaps(props: ParentProps): JSX.Element {
  return <span style="font-variant: small-caps;">{props.children}</span>;
}

/** A float wrapper. Props: `align` — `"left"` (default) or `"right"`. */
export function Wrap(props: ParentProps & { align?: string }): JSX.Element {
  const align = props.align === "right" ? "right" : "left";
  return <div class={`nota-wrap nota-wrap-${align}`}>{props.children}</div>;
}

/** A flex row. Props: `gap` — a CSS length (a bare number means `em`). */
export function Row(
  props: ParentProps & { gap?: number | string }
): JSX.Element {
  const gap = props.gap;
  const style =
    typeof gap === "number"
      ? `gap: ${gap}em;`
      : typeof gap === "string" && gap !== ""
        ? `gap: ${gap};`
        : undefined;
  return (
    <div class="nota-row" style={style}>
      {props.children}
    </div>
  );
}

/** Centered content. */
export function Center(props: ParentProps): JSX.Element {
  return <div class="nota-center">{props.children}</div>;
}

/**
 * A numbered figure. Props: optional `id` — when set, the `<figure>` gets `id="fig-<id>"` and a
 * definition registers under the same key with the label "Figure N" and the figure body as its
 * tooltip bank, so `&id` references number correctly and tooltip the figure (see module docs).
 */
export function Figure(props: ParentProps & { id?: string }): JSX.Element {
  const state = useDocState();
  const id =
    typeof props.id === "string" && props.id.trim() !== ""
      ? props.id.trim()
      : undefined;
  const handle = state.register("figure", { key: id });
  if (id !== undefined) {
    state.register("definition", {
      key: id,
      labelText: `Figure ${handle.seq}`,
      bank: () => <div class="nota-figure-tooltip">{props.children}</div>
    });
    // The bank renders from the shared "definitions" trailer; registering it here (idempotent)
    // covers documents whose only definitions are figures.
    state.trailer("definitions", () => <DefBank />);
  }
  return (
    <figure id={id !== undefined ? `fig-${id}` : undefined} class="nota-figure">
      {props.children}
    </figure>
  );
}

/** One subfigure within a `Figure` (typically laid out with `Row`). */
export function Subfigure(props: ParentProps): JSX.Element {
  return <div class="nota-subfigure">{props.children}</div>;
}

/**
 * A figure caption: `<figcaption>` prefixed with "Figure N: " for the nearest preceding figure
 * fact (by `pos`); unlabeled when no figure precedes.
 */
export function Caption(props: ParentProps): JSX.Element {
  const state = useDocState();
  const handle = state.register("figure-caption", {});
  const ownPos = handle.fact.pos as number;
  const number = () => {
    const figures = state.read("figure") as Fact[];
    const preceding = figures.filter(f => (f.pos as number) < ownPos);
    return preceding.length > 0 ? preceding.length : undefined;
  };
  return (
    <figcaption class="nota-caption">
      <Show when={number() !== undefined}>
        <span class="nota-caption-label">{`Figure ${number()}: `}</span>
      </Show>
      {props.children}
    </figcaption>
  );
}
