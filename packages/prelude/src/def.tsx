/**
 * Definitions & definition references — the tooltip system, Solid-native (design/solid.md).
 *
 * `@Definition[id: "nota"]{body}` registers a definition fact and renders its body in place
 * inside an anchor (`<span id="def-nota">`). A `@Ref[id: "nota"]` — usually the `&nota` sugar —
 * resolves to it (see ./doc-state's `Ref`) and renders `<a href="#def-nota" data-nota-def>`:
 * the **no-JS fallback is a real anchor jump** to the definition; with hydration, the delegated
 * handler intercepts the click and shows the tooltip in context (double-click jumps,
 * Escape/outside-click dismisses).
 *
 * The old vanilla-JS trailer (a script/style string pair injected into static HTML) is gone:
 * the tooltip bank is a Solid trailer component (`DefBank`) whose handlers attach in `onMount`
 * — SSR renders the bank inert; hydration arms it.
 *
 * **Bank content** = the `tooltip` prop if provided, else the definition's `label`, else its
 * key. (The old default also fell back to re-rendering the *body* — under replay-free Solid a
 * second body render would double-register any doc-state constructs inside it, so the body is
 * no longer a tooltip fallback; pass `tooltip` explicitly for rich tooltips.)
 *
 * **Math references.** {@link texRef}`(id, tex)` wraps TeX source in `\htmlData{nota-def=id}{…}`,
 * so rendered math participates in the same delegated handler. KaTeX only emits the data
 * attribute for HTML output — set `mathset({ output: "html" })`; under the default MathML
 * output the math renders correctly but un-wired.
 */

import { textOf, useDocState } from "@nota-lang/core";
import { For, type JSX, onMount, type ParentProps } from "solid-js";

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

let handlersInstalled = false;

/**
 * The delegated tooltip behavior (the old DEF_TOOLTIP_SCRIPT, as real code): click a reference
 * to show its definition's bank entry in context, double-click to jump to the definition,
 * Escape/outside-click to dismiss. Installed once per document environment.
 */
export function installDefTooltipHandlers(): void {
  if (handlersInstalled) {
    return;
  }
  handlersInstalled = true;
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
    // Resolve the bank within the triggering anchor's OWN document root (core render.tsx's
    // `<article class="nota-doc">`) — a page hosting several documents (Astro islands) has one
    // bank per document, and a page-global `document.querySelector` would always find the
    // first, leaving every later document's refs silently un-tooltipped. Fall back to a
    // page-wide lookup when no enclosing root is found (e.g. a bare CSR mount in tests).
    const root = anchor.closest("article.nota-doc");
    const bank =
      root?.querySelector(".nota-def-tooltips") ??
      document.querySelector(".nota-def-tooltips");
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
    tip.classList.add("nota-def-tooltip-open");
    document.body.appendChild(tip);
    const r = anchor.getBoundingClientRect();
    const doc = document.documentElement;
    let left = window.scrollX + r.left + r.width / 2 - tip.offsetWidth / 2;
    left = Math.max(
      8,
      Math.min(left, window.scrollX + doc.clientWidth - tip.offsetWidth - 8)
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
  document.addEventListener("click", ev => {
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
  });
  document.addEventListener("dblclick", ev => {
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
        ? document.getElementById(href.slice(1))
        : document.getElementById(`def-${a.getAttribute("data-nota-def")}`);
    if (target) {
      target.scrollIntoView({ behavior: "smooth", block: "center" });
      target.classList.add("nota-def-target");
      setTimeout(() => target.classList.remove("nota-def-target"), 1500);
    }
  });
  document.addEventListener("keydown", ev => {
    if (ev.key === "Escape") {
      hide();
    }
  });
}

/** Test hook: allow a fresh handler installation (jsdom documents are per-test). */
export function resetDefTooltipHandlersForTest(): void {
  handlersInstalled = false;
}

/**
 * The `"definitions"` trailer: the hidden tooltip bank — one entry per **bank-carrying
 * anchor** of any kind (definitions; paper's tooltipped figures), SSR'd inert — + the
 * `onMount` handler installation. Duplicate ids throw here (via the namespace resolution) —
 * the trailer position sees every anchor above it, so a duplicate with no references is still
 * caught.
 */
export function DefBank(): JSX.Element {
  const state = useDocState();
  const entries = () => {
    const anchors = state.live(FACT_KINDS.anchor) as AnchorFact[];
    resolveAnchors(anchors, Object.keys(config().bibSrc)); // throws on duplicate ids
    return anchors.filter(a => a.bank !== undefined);
  };
  onMount(installDefTooltipHandlers);
  return (
    <div class="nota-def-tooltips" aria-hidden="true">
      <For each={entries()}>
        {a => (
          <div class="nota-def-tooltip" data-def={anchorKey(a)}>
            {a.bank?.()}
          </div>
        )}
      </For>
      <style innerHTML={DEF_TOOLTIP_STYLE} />
    </div>
  );
}
