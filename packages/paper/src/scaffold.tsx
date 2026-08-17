/**
 * Paper scaffolding — plain Solid components for the front matter and layout of an academic
 * paper: title block, author block, abstract, small-caps, float/flex layout helpers, and
 * numbered figures with captions.
 *
 * Figures ride the **unified reference registry** (design/references.md): `Figure` registers a
 * `figure`-kind anchor — an extension kind, pure JSON data — whose number is its anchor-order
 * ordinal, derived at read time (never baked). An id'd figure is a strong anchor carrying
 * `href: "#fig-id"`, `refPrefix: "Figure "`, and a tooltip bank of the figure body, so `&id`
 * references render "Figure N" through `Ref`'s generic arm, link to the real `fig-` element,
 * and tooltip the figure itself. `Caption` reads its enclosing figure's ordinal through
 * context and prefixes "Figure N: "; a caption outside any figure renders unlabeled.
 *
 * `Title` is the prelude's component (a raw `h1.nota-title`, not `Heading`): unnumbered and
 * absent from the TOC — the paper-title analogue of `\section*`.
 */

import { Reforest, useDocState } from "@nota-lang/core";
import {
  type AnchorFact,
  anchorOrdinals,
  DefBank,
  FACT_KINDS
} from "@nota-lang/prelude";
import {
  createContext,
  type JSX,
  type ParentProps,
  Show,
  useContext
} from "solid-js";

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

/** The anchor kind paper's figures register (paper-owned; the prelude ships none of it). */
export const FIGURE_KIND = "figure";

/** The enclosing figure's ordinal accessor, provided by `Figure` for its `Caption`. */
const FigureContext = createContext<() => number | undefined>();

/**
 * A numbered figure — a `figure`-kind anchor. Optional `id`: when set, the `<figure>` gets
 * `id="fig-<id>"` and the anchor is strong (`&id` renders "Figure N" via the generic `Ref`
 * arm, links here, and tooltips the figure body); without one the figure is anonymous — it
 * still counts in the numbering.
 */
export function Figure(props: ParentProps & { id?: string }): JSX.Element {
  const state = useDocState();
  const id =
    typeof props.id === "string" && props.id.trim() !== ""
      ? props.id.trim()
      : undefined;
  const handle = state.register(FACT_KINDS.anchor, {
    kind: FIGURE_KIND,
    id,
    refPrefix: "Figure ",
    ...(id !== undefined
      ? {
          href: `#fig-${id}`,
          tooltip: true,
          bank: () => <div class="nota-figure-tooltip">{props.children}</div>
        }
      : {})
  });
  const myPos = handle.fact.pos as number;
  const ordinal = () =>
    anchorOrdinals(
      state.read(FACT_KINDS.anchor) as AnchorFact[],
      FIGURE_KIND
    ).get(myPos);
  if (id !== undefined) {
    // The bank renders from the shared "definitions" trailer; registering it here (idempotent)
    // covers documents whose only tooltip anchors are figures.
    state.trailer("definitions", () => <DefBank />);
  }
  return (
    <FigureContext.Provider value={ordinal}>
      <figure
        id={id !== undefined ? `fig-${id}` : undefined}
        class="nota-figure"
      >
        {props.children}
      </figure>
    </FigureContext.Provider>
  );
}

/** One subfigure within a `Figure` (typically laid out with `Row`). */
export function Subfigure(props: ParentProps): JSX.Element {
  return <div class="nota-subfigure">{props.children}</div>;
}

/**
 * A figure caption: `<figcaption>` prefixed with "Figure N: " — N is the enclosing `Figure`'s
 * ordinal, read through context (correct even when an earlier figure mounts later). A caption
 * outside any figure renders unlabeled.
 */
export function Caption(props: ParentProps): JSX.Element {
  const ordinal = useContext(FigureContext);
  const number = () => ordinal?.();
  return (
    <figcaption class="nota-caption">
      <Show when={number() !== undefined}>
        <span class="nota-caption-label">{`Figure ${number()}: `}</span>
      </Show>
      {props.children}
    </figcaption>
  );
}
