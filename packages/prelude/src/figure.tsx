/**
 * Numbered figures — `Figure`/`Subfigure`/`Caption` (design/references.md).
 *
 * A figure rides the **unified reference registry** like every other anchor: `Figure` registers a
 * `figure`-kind anchor — an extension kind, pure JSON data — whose number is its anchor-order
 * ordinal, derived at read time and never baked. An id'd figure is a strong anchor carrying
 * `href: "#fig-id"`, `refPrefix: "Figure "`, and a tooltip bank of the figure body, so `&id`
 * references render "Figure N" through {@link Ref}'s generic arm, link to the real `fig-`
 * element, and tooltip the figure itself. `Caption` reads its enclosing figure's ordinal through
 * context and prefixes "Figure N: "; a caption outside any figure renders unlabeled.
 *
 * Styling follows the prelude's rule of shipping no stylesheet: the layout rules ride in a
 * `<style>` rendered once per document, next to the anchor's tooltip bank.
 */

import { useDocState } from "@nota-lang/core";
import {
  createContext,
  type JSX,
  type ParentProps,
  Show,
  useContext
} from "solid-js";
import { DefBank } from "./def";
import { type AnchorFact, anchorOrdinals, FACT_KINDS } from "./refs";

/** The anchor kind figures register. */
export const FIGURE_KIND = "figure";

/** The layout rules for the figure family (see the module note on styling). */
export const FIGURE_STYLE = `.nota-figure { margin: 1.5em auto; text-align: center; }
.nota-figure img { max-width: 100%; }
.nota-subfigure { display: inline-block; vertical-align: top; }
.nota-caption { font-size: 90%; text-align: center; margin-top: 0.5em; }
.nota-caption-label { font-weight: bold; }`;

/** The enclosing figure's ordinal accessor, provided by `Figure` for its `Caption`. */
const FigureContext = createContext<() => number | undefined>();

/**
 * A numbered figure — a `figure`-kind anchor. Optional `id`: when set, the `<figure>` gets
 * `id="fig-<id>"` and the anchor is strong (`&id` renders "Figure N" via the generic `Ref` arm,
 * links here, and tooltips the figure body); without one the figure is anonymous — it still
 * counts in the numbering.
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
  // Idempotent per document, like the bank above: one `<style>` however many figures there are.
  state.trailer("figure-style", () => <style innerHTML={FIGURE_STYLE} />);
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

/** One subfigure within a `Figure` (typically laid out side by side). */
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

/** Small-caps text. */
export function Smallcaps(props: ParentProps): JSX.Element {
  return <span style="font-variant: small-caps;">{props.children}</span>;
}
