/**
 * Definitions & definition references — the tooltip system (the flagship of nota v1, rebuilt on
 * `mark`/`query`).
 *
 * `@Definition[id: "nota"]{body}` registers a **definition** (`mark("definition", …)`) and renders
 * its body in place inside an anchor (`<span id="def-nota">`). A `@Ref[id: "nota"]` — usually the
 * `&nota` sugar — that resolves to a definition renders an `<a data-nota-def="nota">` carrying the
 * definition's label; the same `id` space falls back to `@Label`/heading references (see
 * `DefaultRef` in ./doc.ts, which consults definitions first).
 *
 * **Tooltips are progressive enhancement, not islands.** A trailer (registered in ./lib.ts)
 * appends, when any definition exists: a hidden **tooltip bank** (one entry per definition,
 * pre-rendered at SSG time), one inline `<style>`, and one inline `<script>` with a delegated
 * vanilla-JS handler — click a reference to show its definition in context, double-click to jump
 * to the definition, Escape/outside-click to dismiss. No framework JS, no hydration; an
 * island-free document keeps working over `file://`.
 *
 * **Math references.** {@link texRef}`(id, tex)` wraps TeX source in `\htmlData{nota-def=id}{…}`,
 * so rendered math participates in the same delegated handler. KaTeX only emits the data
 * attribute for HTML output — set `mathset({ output: "html" })` (site-wide via a setup module);
 * under the default MathML output the math renders correctly but un-wired.
 *
 * The stored definition body is deliberately **not** placed under the mark's `data.content` (which
 * `indexDoc` walks): the body renders in place, so its nested marks index there; a `data.content`
 * walk would double-index them. The tooltip bank re-renders the same vnodes — their marks are
 * already in the index, so `force` removes them silently (the membership guard), and nested
 * queries re-force against the same frozen index.
 */

import {
  type CompProps,
  type DocIndex,
  Fragment,
  h,
  type IndexedMark,
  isMark,
  mark,
  query,
  raw,
  slot,
  type VNode
} from "@nota-lang/runtime";

import { normChildren } from "./doc.js";

/** The mark payload of one definition. `body` is NOT `content` — see the module docs. */
export interface DefinitionData extends Record<string, unknown> {
  key: string;
  label?: VNode[];
  tooltip?: VNode[];
  body: VNode[];
}

/**
 * Find the definition mark for `key`, or `undefined`. A duplicate definition for one key is a
 * pointed error (same contract as labels).
 */
export function definitionFor(
  doc: DocIndex,
  key: string
): IndexedMark | undefined {
  const defs = doc.all("definition").filter(e => e.data.key === key);
  if (defs.length > 1) {
    throw new Error(`@Definition: duplicate definition for id "${key}"`);
  }
  return defs[0];
}

/** The link content for a reference to `def`: authored children ?? the definition's label ?? the key. */
export function definitionRefLabel(
  def: IndexedMark,
  children: VNode[]
): VNode[] {
  if (children.length > 0) {
    return children;
  }
  const data = def.data as DefinitionData;
  if (data.label !== undefined && data.label.length > 0) {
    return data.label;
  }
  return [data.key];
}

/**
 * The default `Definition`. Props: `id` (required), `label` (markup shown by references),
 * `tooltip` (markup shown in the tooltip; default: the body, else the label), `block`
 * (wrap the body in a `<div>` flow container instead of an inline `<span>`).
 *
 * Doc-state constructs inside the `tooltip`/`label` props are unsupported (they render only in
 * the tooltip bank, where an unindexed mark hits the pipeline's new-mark guard).
 */
export function DefaultDefinition(props: CompProps): unknown {
  const key = typeof props.id === "string" ? props.id.trim() : "";
  if (key === "") {
    throw new Error(
      '@Definition: missing id (e.g. @Definition[id: "nota"]{…})'
    );
  }
  const body = normChildren(props.children);
  const label =
    props.label != null ? normChildren([props.label as VNode]) : undefined;
  const tooltip =
    props.tooltip != null ? normChildren([props.tooltip as VNode]) : undefined;
  const m = mark("definition", {
    key,
    label,
    tooltip,
    body
  } satisfies DefinitionData);
  const tag = props.block === true ? "div" : "span";
  return Fragment(
    m,
    h(tag, { id: `def-${key}`, class: "nota-definition" }, body)
  );
}

/** The ambient `Definition` slot. */
export const Definition = slot("Definition", DefaultDefinition);

/**
 * Wrap TeX source so the rendered math references definition `id`:
 * `texRef("deps", "\\kappa")` → `\htmlData{nota-def=deps}{\kappa}`. Requires
 * `mathset({ output: "html" })` for the attribute to survive (see module docs). The id charset
 * excludes `,`/`=`/`{`/`}` (the `\htmlData` attribute-list syntax).
 */
export function texRef(id: string, tex: string): string {
  if (/[,={}]/.test(id)) {
    throw new Error(
      `texRef: id "${id}" may not contain "," "=" "{" or "}" (it rides inside \\htmlData{nota-def=…})`
    );
  }
  return `\\htmlData{nota-def=${id}}{${tex}}`;
}

/**
 * Does this stored child list render anything? `textContent` alone under-reports: a body that is
 * all `raw` leaves (a shiki `<pre>`, a KaTeX render) or host elements has no reconstructible text
 * but very much renders. Marks render nothing; queries are conservatively counted as renderable.
 */
function renderable(nodes: VNode[]): boolean {
  return nodes.some(n => {
    if (n == null) {
      return false;
    }
    if (typeof n === "string") {
      return n.trim() !== "";
    }
    if (Array.isArray(n)) {
      return renderable(n);
    }
    if (isMark(n)) {
      return false;
    }
    return true;
  });
}

/** The tooltip content for one definition: `tooltip` prop ?? body ?? label ?? the key. */
function tooltipContent(data: DefinitionData): VNode[] {
  if (data.tooltip !== undefined && renderable(data.tooltip)) {
    return data.tooltip;
  }
  if (renderable(data.body)) {
    return data.body;
  }
  if (data.label !== undefined && data.label.length > 0) {
    return data.label;
  }
  return [data.key];
}

/**
 * The delegated tooltip handler (see module docs). Static source — reads only DOM attributes, so
 * one copy serves every document. Exported so an integrator can inline it site-wide (e.g. in a
 * shared page template, for documents rendered client-side after load); it self-guards against
 * double installation.
 */
export const DEF_TOOLTIP_SCRIPT = `(function () {
  if (window.__notaDefTooltips) return;
  window.__notaDefTooltips = true;
  var active = null, activeFor = null;
  function hide() {
    if (active) { active.remove(); active = null; activeFor = null; }
  }
  function show(anchor) {
    if (activeFor === anchor) { hide(); return; }
    hide();
    var key = anchor.getAttribute("data-nota-def");
    var bank = document.querySelector(".nota-def-tooltips");
    var src = bank && bank.querySelector('[data-def="' + (window.CSS && CSS.escape ? CSS.escape(key) : key) + '"]');
    if (!src) return;
    var tip = src.cloneNode(true);
    tip.classList.add("nota-def-tooltip-open");
    document.body.appendChild(tip);
    var r = anchor.getBoundingClientRect();
    var doc = document.documentElement;
    var left = window.scrollX + r.left + r.width / 2 - tip.offsetWidth / 2;
    left = Math.max(8, Math.min(left, window.scrollX + doc.clientWidth - tip.offsetWidth - 8));
    var top = window.scrollY + r.top - tip.offsetHeight - 8;
    if (top < window.scrollY + 4) top = window.scrollY + r.bottom + 8;
    tip.style.left = left + "px";
    tip.style.top = top + "px";
    active = tip; activeFor = anchor;
  }
  document.addEventListener("click", function (ev) {
    var a = ev.target.closest ? ev.target.closest("[data-nota-def]") : null;
    if (a) { ev.preventDefault(); show(a); return; }
    if (active && !(ev.target.closest && ev.target.closest(".nota-def-tooltip-open"))) hide();
  });
  document.addEventListener("dblclick", function (ev) {
    var a = ev.target.closest ? ev.target.closest("[data-nota-def]") : null;
    if (!a) return;
    ev.preventDefault();
    hide();
    var target = document.getElementById("def-" + a.getAttribute("data-nota-def"));
    if (target) {
      target.scrollIntoView({ behavior: "smooth", block: "center" });
      target.classList.add("nota-def-target");
      setTimeout(function () { target.classList.remove("nota-def-target"); }, 1500);
    }
  });
  document.addEventListener("keydown", function (ev) {
    if (ev.key === "Escape") hide();
  });
})();`;

/** Default tooltip styling (override freely — everything hangs off the `nota-def-*` classes). */
export const DEF_TOOLTIP_STYLE = `.nota-def-tooltips { display: none; }
.nota-def-tooltip-open { position: absolute; background: white; border: 1px solid black; padding: 0.4em 0.7em; max-width: 30em; z-index: 1000; box-shadow: 2px 2px 6px rgba(0, 0, 0, 0.2); }
a.nota-def-ref { text-decoration: none; border-bottom: 1px dotted currentColor; cursor: pointer; color: inherit; }
[data-nota-def] { cursor: pointer; }
.nota-definition { transition: background 0.8s; }
.nota-def-target { background: #fff3b0; transition: background 0.2s; }`;

/**
 * The `"definitions"` trailer body (registered in ./lib.ts): when any definition exists, append
 * the hidden tooltip bank + the style/script pair. Returns `null` (nothing at all — zero bytes)
 * for definition-free documents.
 */
export function definitionsTrailer(): unknown {
  return query(doc => {
    const defs = doc.all("definition");
    if (defs.length === 0) {
      return null;
    }
    const seen = new Set<string>();
    const entries: VNode[] = [];
    for (const e of defs) {
      const data = e.data as DefinitionData;
      if (seen.has(data.key)) {
        throw new Error(
          `@Definition: duplicate definition for id "${data.key}"`
        );
      }
      seen.add(data.key);
      entries.push(
        h(
          "div",
          { class: "nota-def-tooltip", "data-def": data.key },
          tooltipContent(data)
        )
      );
    }
    return h("div", { class: "nota-def-tooltips", "aria-hidden": "true" }, [
      ...entries,
      raw(`<style>${DEF_TOOLTIP_STYLE}</style>`, { block: true }),
      raw(`<script>${DEF_TOOLTIP_SCRIPT}</script>`, { block: true })
    ]);
  });
}
