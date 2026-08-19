/**
 * Definition anchors and delegated tooltips. References remain usable as anchor links without
 * JavaScript; hydration adds click tooltips. `texRef` uses KaTeX's HTML extensions to join the
 * same system when HTML output is enabled.
 */

import { textOf, useDocState } from "@nota-lang/core";
import { createMemo, For, type JSX, onMount, type ParentProps } from "solid-js";

import { config } from "./config";
import {
  ANCHOR_KINDS,
  type AnchorFact,
  anchorKey,
  FACT_KINDS,
  resolveAnchors
} from "./refs";

/** The plain text of a non-children JSX prop value (string | number | node | chunk | getter). */
function textOfValue(v: unknown): string | undefined {
  if (v == null) {
    return undefined;
  }
  const resolved = typeof v === "function" ? (v as () => unknown)() : v;
  if (resolved == null) {
    return undefined;
  }
  // biome-ignore lint/suspicious/noExplicitAny: structural probe over the resolved-child union.
  return textOf(resolved as any);
}

/**
 * The default `Definition`. Props: `id` (required), `label` (text shown by references),
 * `tooltip` (markup shown in the tooltip; rendered only in the bank), `block` (wrap the body in
 * a `<div>` flow container instead of an inline `<span>`).
 */
export function Definition(
  props: ParentProps & {
    id?: string;
    label?: JSX.Element;
    tooltip?: JSX.Element;
    block?: boolean;
  }
): JSX.Element {
  const state = useDocState();
  const key = typeof props.id === "string" ? props.id.trim() : "";
  if (key === "") {
    throw new Error(
      '@Definition: missing id (e.g. @Definition[id: "nota"]{…})'
    );
  }
  const labelText = textOfValue(props.label);
  state.register(FACT_KINDS.anchor, {
    kind: ANCHOR_KINDS.definition,
    id: key,
    labelText,
    tooltip: true,
    bank: () => (props.tooltip != null ? props.tooltip : (labelText ?? key))
  });
  state.trailer("definitions", () => <DefBank />);
  return props.block === true ? (
    <div id={`def-${key}`} class="nota-definition">
      {props.children}
    </div>
  ) : (
    <span id={`def-${key}`} class="nota-definition">
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

/** Default tooltip styling (override freely — everything hangs off the `nota-def-*` classes). */
export const DEF_TOOLTIP_STYLE = `.nota-def-tooltips { display: none; }
.nota-def-tooltip-open { position: absolute; background: white; border: 1px solid black; padding: 0.4em 0.7em; max-width: 30em; z-index: 1000; box-shadow: 2px 2px 6px rgba(0, 0, 0, 0.2); }
a.nota-def-ref { text-decoration: none; border-bottom: 1px dotted currentColor; cursor: pointer; color: inherit; }
[data-nota-def] { cursor: pointer; }
.nota-definition { transition: background 0.8s; }
.nota-def-target { background: #fff3b0; transition: background 0.2s; }`;

let handlerInstallations = new WeakMap<Document, () => void>();

/** Install delegated tooltip behavior once on the current document. */
export function installDefTooltipHandlers(): void {
  const doc = document;
  if (handlerInstallations.has(doc)) {
    return;
  }
  let active: HTMLElement | null = null;
  let activeFor: Element | null = null;
  const hide = () => {
    if (active) {
      active.remove();
      active = null;
      activeFor = null;
    }
  };
  const show = (anchor: Element) => {
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
      content.classList.add("nota-figure-tooltip");
      content.removeAttribute("id");
      for (const child of content.querySelectorAll("[id]")) {
        child.removeAttribute("id");
      }
      tip.append(content);
    }
    tip.classList.add("nota-def-tooltip-open");
    doc.body.appendChild(tip);
    const r = anchor.getBoundingClientRect();
    const rootElement = doc.documentElement;
    let left = window.scrollX + r.left + r.width / 2 - tip.offsetWidth / 2;
    left = Math.max(
      8,
      Math.min(
        left,
        window.scrollX + rootElement.clientWidth - tip.offsetWidth - 8
      )
    );
    let top = window.scrollY + r.top - tip.offsetHeight - 8;
    if (top < window.scrollY + 4) {
      top = window.scrollY + r.bottom + 8;
    }
    tip.style.left = `${left}px`;
    tip.style.top = `${top}px`;
    active = tip;
    activeFor = anchor;
  };
  const handleClick = (ev: MouseEvent) => {
    const t = ev.target as Element | null;
    const a = t?.closest?.("[data-nota-def]");
    if (a) {
      ev.preventDefault();
      show(a);
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
    resolveAnchors(anchors, Object.keys(config().bibSrc)); // throws on duplicate ids
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
      <style innerHTML={DEF_TOOLTIP_STYLE} />
    </div>
  );
}
