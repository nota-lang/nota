/**
 * Figures use the unified anchor registry for numbering and references. Caption numbering comes
 * from context; tooltip support is installed once through a document trailer.
 *
 * The layout lives in `./figure.css`, imported here so it rides this module: a bundler extracts
 * and minifies it once per page, and a document that never renders a figure never pulls it in.
 */

import { useDocState } from "@nota-lang/core";

import "./figure.css";
import {
  createContext,
  createMemo,
  type JSX,
  type ParentProps,
  Show,
  splitProps,
  useContext
} from "solid-js";
import { DefBank } from "./def";
import { mergeClass, withClass } from "./html-attrs";
import { type AnchorFact, anchorOrdinals, FACT_KINDS } from "./refs";

/** The anchor kind figures register. */
export const FIGURE_KIND = "figure";

/** The enclosing figure's ordinal accessor, provided by `Figure` for its `Caption`. */
const FigureContext = createContext<() => number | undefined>();

/**
 * A numbered figure — a `figure`-kind anchor. Optional `id`: when set, the `<figure>` gets
 * `id="fig-<id>"` and the anchor is strong (`&id` renders "Figure N" via the generic `Ref` arm,
 * links here, and tooltips the figure body); without one the figure is anonymous — it still
 * counts in the numbering.
 */
export function Figure(
  props: ParentProps & { id?: string } & Record<string, unknown>
): JSX.Element {
  const state = useDocState();
  const [local, rest] = splitProps(props, ["id", "children", "class"]);
  const id =
    typeof local.id === "string" && local.id.trim() !== ""
      ? local.id.trim()
      : undefined;
  const handle = state.register(FACT_KINDS.anchor, {
    kind: FIGURE_KIND,
    id,
    refPrefix: "Figure ",
    ...(id !== undefined
      ? {
          href: `#fig-${id}`,
          tooltip: true,
          bankTarget: `fig-${id}`
        }
      : {})
  });
  const location = handle.fact.location;
  const ordinals = createMemo(() =>
    anchorOrdinals(state.read(FACT_KINDS.anchor) as AnchorFact[], FIGURE_KIND)
  );
  const ordinal = () => ordinals().get(location);
  if (id !== undefined) {
    state.trailer("definitions", () => <DefBank />);
  }
  return (
    <FigureContext.Provider value={ordinal}>
      <figure
        id={id !== undefined ? `fig-${id}` : undefined}
        {...(withClass(
          mergeClass("nota-figure", local.class),
          rest
        ) as JSX.HTMLAttributes<HTMLElement>)}
      >
        {local.children}
      </figure>
    </FigureContext.Provider>
  );
}

/** One subfigure within a `Figure` (typically laid out side by side). */
export function Subfigure(
  props: ParentProps & Record<string, unknown>
): JSX.Element {
  const [local, rest] = splitProps(props, ["children", "class"]);
  return (
    <div
      {...(withClass(
        mergeClass("nota-subfigure", local.class),
        rest
      ) as JSX.HTMLAttributes<HTMLDivElement>)}
    >
      {local.children}
    </div>
  );
}

/**
 * A figure caption: `<figcaption>` prefixed with "Figure N: " — N is the enclosing `Figure`'s
 * ordinal, read through context (correct even when an earlier figure mounts later). A caption
 * outside any figure renders unlabeled.
 */
export function Caption(
  props: ParentProps & Record<string, unknown>
): JSX.Element {
  const [local, rest] = splitProps(props, ["children", "class"]);
  const ordinal = useContext(FigureContext);
  const number = () => ordinal?.();
  return (
    <figcaption
      {...(withClass(
        mergeClass("nota-caption", local.class),
        rest
      ) as JSX.HTMLAttributes<HTMLElement>)}
    >
      <Show when={number() !== undefined}>
        <span class="nota-caption-label">{`Figure ${number()}: `}</span>
      </Show>
      {local.children}
    </figcaption>
  );
}

/** Small-caps text. */
export function Smallcaps(
  props: ParentProps & Record<string, unknown>
): JSX.Element {
  const [local, rest] = splitProps(props, ["children", "style", "class"]);
  const style =
    typeof local.style === "string" && local.style.trim() !== ""
      ? `font-variant: small-caps; ${local.style}`
      : "font-variant: small-caps;";
  const cls = typeof local.class === "string" ? local.class : undefined;
  return (
    <span
      style={style}
      {...(withClass(cls, rest) as JSX.HTMLAttributes<HTMLSpanElement>)}
    >
      {local.children}
    </span>
  );
}
