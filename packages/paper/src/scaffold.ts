/**
 * Paper scaffolding — plain static templates (no islands) for the front matter and layout of an
 * academic paper: title block, author block, abstract, small-caps, float/flex layout helpers,
 * and numbered figures with captions.
 *
 * Figures ride the prelude's doc-state machinery: `Figure` emits a `mark("figure")` (the counter
 * unit) and, when it has an `id`, a `mark("definition")` whose **label is a query** computing
 * "Figure N" from `counters(doc, "figure")` — so `&id` references render "Figure N" with a
 * tooltip showing the figure itself. `Caption` finds its nearest *preceding* figure mark by `pos`
 * and prefixes "Figure N: "; a caption with no preceding figure renders unlabeled.
 *
 * `Title` is the prelude's ambient slot (a raw `h1.nota-title`, not the `Heading` slot):
 * unnumbered and absent from the TOC — the paper-title analogue of `\section*`.
 */

import { counters, type DefinitionData } from "@nota-lang/prelude";
import { normChildren } from "@nota-lang/prelude/doc";
import {
  type CompProps,
  Fragment,
  h,
  mark,
  query,
  type VNode
} from "@nota-lang/runtime";

/** The paper title: a raw, unnumbered, un-TOC'd `h1`. */
export { Title } from "@nota-lang/prelude";

/** The author block container (a flex row of `Author`s). */
export function Authors(props: CompProps): unknown {
  return h("div", { class: "nota-authors" }, props.children);
}

/** One author (a column of `Name`/`Affiliation`/…). */
export function Author(props: CompProps): unknown {
  return h("div", { class: "nota-author" }, props.children);
}

/** An author's name. */
export function Name(props: CompProps): unknown {
  return h("div", { class: "nota-author-name" }, props.children);
}

/** An author's affiliation line. */
export function Affiliation(props: CompProps): unknown {
  return h("div", { class: "nota-author-affiliation" }, props.children);
}

/** An institution line. */
export function Institution(props: CompProps): unknown {
  return h("div", { class: "nota-institution" }, props.children);
}

/** The abstract: a titled flow container (children decode as paragraphs). */
export function Abstract(props: CompProps): unknown {
  return h("div", { class: "nota-abstract" }, [
    h("div", { class: "nota-abstract-title" }, ["Abstract"]),
    ...props.children
  ]);
}

/** Small-caps text. */
export function Smallcaps(props: CompProps): unknown {
  return h("span", { style: "font-variant: small-caps;" }, props.children);
}

/** A float wrapper. Props: `align` — `"left"` (default) or `"right"`. */
export function Wrap(props: CompProps): unknown {
  const align = props.align === "right" ? "right" : "left";
  return h("div", { class: `nota-wrap nota-wrap-${align}` }, props.children);
}

/** A flex row. Props: `gap` — a CSS length (a bare number means `em`). */
export function Row(props: CompProps): unknown {
  const gap = props.gap;
  const style =
    typeof gap === "number"
      ? `gap: ${gap}em;`
      : typeof gap === "string" && gap !== ""
        ? `gap: ${gap};`
        : undefined;
  return h("div", { class: "nota-row", style }, props.children);
}

/** Centered content. */
export function Center(props: CompProps): unknown {
  return h("div", { class: "nota-center" }, props.children);
}

/**
 * A numbered figure. Props: optional `id` — when set, the `<figure>` gets `id="fig-<id>"` and a
 * definition registers under the same key with a query-valued "Figure N" label, so `&id`
 * references number correctly and tooltip the figure body (see the module docs).
 */
export function Figure(props: CompProps): unknown {
  const id =
    typeof props.id === "string" && props.id.trim() !== ""
      ? props.id.trim()
      : undefined;
  const children = normChildren(props.children);
  const figMark = mark("figure", { key: id });
  const nodes: VNode[] = [figMark];
  if (id !== undefined) {
    nodes.push(
      mark("definition", {
        key: id,
        label: [
          query(doc => {
            const entry = doc.get(figMark);
            const n = counters(doc, "figure").get(entry);
            return `Figure ${n}`;
          })
        ],
        body: children
      } satisfies DefinitionData)
    );
  }
  nodes.push(
    h(
      "figure",
      { id: id !== undefined ? `fig-${id}` : undefined, class: "nota-figure" },
      children
    )
  );
  return Fragment(...nodes);
}

/** One subfigure within a `Figure` (typically laid out with `Row`). */
export function Subfigure(props: CompProps): unknown {
  return h("div", { class: "nota-subfigure" }, props.children);
}

/**
 * A figure caption: `<figcaption>` prefixed with "Figure N: " for the nearest preceding figure
 * mark (by `pos`); unlabeled when no figure precedes.
 */
export function Caption(props: CompProps): unknown {
  const children = normChildren(props.children);
  const m = mark("figure-caption", { content: children });
  const q = query(doc => {
    const own = doc.get(m);
    const preceding = doc.all("figure").filter(e => e.pos < own.pos);
    const fig = preceding[preceding.length - 1];
    if (fig === undefined) {
      return h("figcaption", { class: "nota-caption" }, children);
    }
    const n = counters(doc, "figure").get(fig);
    return h("figcaption", { class: "nota-caption" }, [
      h("span", { class: "nota-caption-label" }, [`Figure ${n}: `]),
      ...children
    ]);
  });
  return Fragment(m, q);
}
