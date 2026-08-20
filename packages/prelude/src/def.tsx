/**
 * Def anchors and delegated tooltips. References remain usable as anchor links without
 * JavaScript; hydration adds click tooltips. `texRef` uses KaTeX's HTML extensions to join the
 * same system when HTML output is enabled.
 */

import {
  autoUpdate,
  computePosition,
  flip,
  inline,
  offset,
  shift,
  size
} from "@floating-ui/dom";
import { useDocState } from "@nota-lang/core";
import {
  type Component,
  createMemo,
  For,
  type JSX,
  onMount,
  type ParentProps
} from "solid-js";

import { bibConfig } from "./doc-state";
import {
  ANCHOR_KINDS,
  type AnchorFact,
  anchorKey,
  FACT_KINDS,
  resolveAnchors
} from "./refs";

import "./def.css";

/**
 * The default `Def`. Props: `id` (required), `Label` (component shown by
 * references), `tooltip` (optional override for the definition body shown by the tooltip),
 * `block` (wrap the body in a `<div>` flow container instead of an inline `<span>`).
 */
export function Def(
  props: ParentProps & {
    id?: string;
    Label?: Component;
    tooltip?: JSX.Element;
    block?: boolean;
  }
): JSX.Element {
  const state = useDocState();
  const key = typeof props.id === "string" ? props.id.trim() : "";
  if (key === "") {
    throw new Error('@Def: missing id (e.g. @Def[id: "nota"]{…})');
  }
  if ("label" in props) {
    throw new Error("@Def: label was replaced by the component prop Label");
  }
  const Label = props.Label;
  if (Label !== undefined && typeof Label !== "function") {
    throw new Error("@Def: Label must be a component (e.g. Label: () => @{…})");
  }
  const tooltip = props.tooltip;
  state.register(FACT_KINDS.anchor, {
    kind: ANCHOR_KINDS.def,
    id: key,
    label: Label === undefined ? undefined : () => <Label />,
    tooltip: true,
    ...(tooltip != null
      ? { bank: () => tooltip }
      : { bankTarget: `def-${key}` })
  });
  state.trailer("defs", () => <DefBank />);
  return props.block === true ? (
    <div id={`def-${key}`} class="nota-def">
      {props.children}
    </div>
  ) : (
    <span id={`def-${key}`} class="nota-def">
      {props.children}
    </span>
  );
}

/**
 * Wrap TeX source so the rendered math references definition `id`:
 * `texRef("deps", "\\kappa")` → `\htmlData{nota-def=deps}{\kappa}`. Requires
 * `mathset({ output: "html" })` for the attribute to survive. The id charset excludes
 * `,`/`=`/`{`/`}` (the `\htmlData` attribute-list syntax).
 */
export function texRef(id: string, tex: string): string {
  if (/[,={}]/.test(id)) {
    throw new Error(
      `texRef: id "${id}" may not contain "," "=" "{" or "}" (it rides inside \\htmlData{nota-def=…})`
    );
  }
  return `\\htmlData{nota-def=${id}}{${tex}}`;
}

/** Gap between a reference and its tooltip, and the viewport margin flip/shift respect. */
const TOOLTIP_GAP = 8;
const VIEWPORT_PADDING = 8;
/** Page-anchored: the tooltip scrolls with its reference even between `autoUpdate` frames. */
const TOOLTIP_STRATEGY = "absolute";

let handlerInstallations = new WeakMap<Document, () => void>();

/** Install delegated tooltip behavior once on the current document. */
export function installDefTooltipHandlers(): void {
  const doc = document;
  if (handlerInstallations.has(doc)) {
    return;
  }
  let active: HTMLElement | null = null;
  let activeFor: Element | null = null;
  let stopTracking: (() => void) | null = null;
  const hide = () => {
    stopTracking?.();
    stopTracking = null;
    if (active) {
      active.remove();
      active = null;
      activeFor = null;
    }
  };
  const show = (anchor: Element, point?: { x: number; y: number }) => {
    if (activeFor === anchor) {
      hide();
      return;
    }
    hide();
    const key = anchor.getAttribute("data-nota-def") ?? "";
    // Prefer the bank in the triggering reference's document root.
    const root = anchor.closest("article.nota-doc");
    const bank =
      root?.querySelector(".nota-def-tooltips") ??
      doc.querySelector(".nota-def-tooltips");
    // CSS.escape is absent in some DOM shims (jsdom); keys are author-controlled, so fall back.
    const escaped =
      typeof CSS !== "undefined" && CSS.escape ? CSS.escape(key) : key;
    const src = bank?.querySelector(
      `[data-def="${escaped}"]`
    ) as HTMLElement | null;
    if (!src) {
      return;
    }
    const tip = src.cloneNode(true) as HTMLElement;
    const targetId = src.dataset.target;
    if (targetId) {
      const candidates = root?.querySelectorAll("[id]") ?? [];
      const target =
        Array.from(candidates).find(element => element.id === targetId) ??
        doc.getElementById(targetId);
      if (!target) {
        return;
      }
      const content = target.cloneNode(true) as HTMLElement;
      content.removeAttribute("id");
      for (const child of content.querySelectorAll("[id]")) {
        child.removeAttribute("id");
      }
      tip.append(content);
    }
    tip.classList.add("nota-def-tooltip-open");
    // Floating UI measures the tooltip where it lands, so park it at the origin first.
    tip.style.position = TOOLTIP_STRATEGY;
    tip.style.left = "0";
    tip.style.top = "0";
    doc.body.appendChild(tip);
    active = tip;
    activeFor = anchor;
    // `autoUpdate` keeps the tooltip pinned to its reference while the page scrolls, resizes,
    // or reflows around it; `hide` is what tears the tracking down.
    stopTracking = autoUpdate(anchor, tip, () => {
      computePosition(anchor, tip, {
        placement: "top",
        strategy: TOOLTIP_STRATEGY,
        middleware: [
          offset(TOOLTIP_GAP),
          // References are inline, so an `<a>` broken over two lines has two rects: the click
          // point picks the one the reader actually hit.
          inline(point),
          flip({ padding: VIEWPORT_PADDING }),
          shift({ padding: VIEWPORT_PADDING }),
          size({
            padding: VIEWPORT_PADDING,
            apply: ({ availableWidth, availableHeight, elements }) => {
              const style = elements.floating.style;
              style.setProperty(
                "--nota-tooltip-available-width",
                `${Math.max(0, availableWidth)}px`
              );
              style.setProperty(
                "--nota-tooltip-available-height",
                `${Math.max(0, availableHeight)}px`
              );
            }
          })
        ]
      }).then(({ x, y, placement }) => {
        // Positioning is async: the reader may have dismissed this tooltip meanwhile.
        if (active !== tip) {
          return;
        }
        tip.dataset.placement = placement;
        tip.style.left = `${x}px`;
        tip.style.top = `${y}px`;
      });
    });
  };
  const handleClick = (ev: MouseEvent) => {
    const t = ev.target as Element | null;
    const a = t?.closest?.("[data-nota-def]");
    if (a) {
      ev.preventDefault();
      // A synthetic or keyboard-driven click reports (0, 0) and `detail === 0`; only a real
      // pointer press carries coordinates worth handing to `inline`.
      show(a, ev.detail > 0 ? { x: ev.clientX, y: ev.clientY } : undefined);
      return;
    }
    if (active && !t?.closest?.(".nota-def-tooltip-open")) {
      hide();
    }
  };
  const handleDoubleClick = (ev: MouseEvent) => {
    const t = ev.target as Element | null;
    const a = t?.closest?.("[data-nota-def]");
    if (!a) {
      return;
    }
    ev.preventDefault();
    hide();
    // Jump to the reference's own target: its href when it is an in-page anchor (a figure ref
    // points at `#fig-…`), else the `def-` convention (a `texRef`'d math span has no href).
    const href = a.getAttribute("href") ?? "";
    const target =
      href.startsWith("#") && href.length > 1
        ? doc.getElementById(href.slice(1))
        : doc.getElementById(`def-${a.getAttribute("data-nota-def")}`);
    if (target) {
      target.scrollIntoView({ behavior: "smooth", block: "center" });
      target.classList.add("nota-def-target");
      setTimeout(() => target.classList.remove("nota-def-target"), 1500);
    }
  };
  const handleKeyDown = (ev: KeyboardEvent) => {
    if (ev.key === "Escape") {
      hide();
    }
  };
  doc.addEventListener("click", handleClick);
  doc.addEventListener("dblclick", handleDoubleClick);
  doc.addEventListener("keydown", handleKeyDown);
  handlerInstallations.set(doc, () => {
    hide();
    doc.removeEventListener("click", handleClick);
    doc.removeEventListener("dblclick", handleDoubleClick);
    doc.removeEventListener("keydown", handleKeyDown);
  });
}

/** Test hook: remove the current document's handlers. */
export function resetDefTooltipHandlersForTest(): void {
  handlerInstallations.get(document)?.();
  handlerInstallations.delete(document);
}

/** Render tooltip payloads and validate the complete anchor namespace. */
export function DefBank(): JSX.Element {
  const state = useDocState();
  const entries = createMemo(() => {
    const anchors = state.live(FACT_KINDS.anchor) as AnchorFact[];
    resolveAnchors(anchors, Object.keys(bibConfig().src)); // throws on duplicate ids
    return anchors.filter(
      anchor => anchor.bank !== undefined || anchor.bankTarget !== undefined
    );
  });
  onMount(installDefTooltipHandlers);
  return (
    <div class="nota-def-tooltips" aria-hidden="true">
      <For each={entries()}>
        {a => (
          <div
            class="nota-def-tooltip"
            data-def={anchorKey(a)}
            data-target={a.bankTarget}
          >
            {a.bank?.()}
          </div>
        )}
      </For>
    </div>
  );
}
