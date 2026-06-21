/**
 * The structural pass `struct` (decode.md §"Structural pass — struct"; contract §1).
 *
 * `struct` turns a *flat* sibling stream of small content pieces into the *nested* HTML structure
 * a document wants, via three sibling-grouping passes over a child list — then recurses, **stopping
 * at component boundaries**. decode.md's core skeleton:
 *
 * ```
 * struct(v):
 *   v is string         → v
 *   isComp(v.tag)       → ⟨v.tag, v.props, map(struct, v.children)⟩   // decode static CHILDREN,
 *                                                                      // do NOT descend into body
 *   k = groupSections(groupParas(groupLists(v.children)))
 *   return ⟨v.tag, v.props, map(struct, k)⟩                           // recurse into host nodes
 * ```
 *
 * Order matters: lists and headings must survive paragraph grouping (so `groupLists` runs first
 * and `groupParas` passes block-level `ul`/`ol`/`hN` through), and sections must see the
 * lists/paras they own (so `groupSections` runs last).
 *
 * ## Container gate (a decision decode.md leaves implicit — see report §2)
 *
 * decode.md applies all three passes to *every* host node uniformly, but that over-groups: it would
 * wrap `@p{Hello}`'s text in a *second* `<p>`, paragraph-wrap a list item's single inline child
 * (contradicting the canonical golden, whose `<li>` holds the `Colorized` boundary directly with
 * no `<p>`), and re-section a `<section>`'s own heading on the recursive descent. So paragraph- and
 * section-grouping apply only inside **flow containers**; the rest are "tight" and receive only
 * `groupLists` (which is context-free — lists can nest anywhere). Concretely, for a host node:
 *
 * - `groupLists` — **always** (sentinels may appear in any container, e.g. a nested list inside an
 *   `<li>`). Idempotent: `ul`/`ol` carry no sentinels, so a re-run is a no-op.
 * - `groupParas` — only when the tag is a **flow** container ({@link HOST_FLOW_TAGS}, plus `FRAG`).
 *   Idempotent: its product `<p>` is a block tag, so a re-run passes it through.
 * - `groupSections` — only in a flow container that is **not itself a `<section>`** (a section's
 *   children were already sectioned by its parent's recursive `groupSections`; re-running would
 *   re-wrap the section's leading heading). This is what lets `groupSections` be fully recursive
 *   while `struct` still descends into the sections it produced.
 *
 * The pass is pure (`VNode → VNode`).
 *
 * @see groupLists, groupParas, groupSections
 */

import { isComp } from "./component";
import { type ElementVNode, FRAG, isElement, type VNode } from "./vnode";

// ---------------------------------------------------------------------------------------------
// Contract constants (the reader must honor these — see report §2)
// ---------------------------------------------------------------------------------------------

/**
 * The host tags that count as **block-level** for paragraph grouping (`isBlock`), i.e. the
 * standard HTML block-level element set. A block sibling flushes the current paragraph run and
 * passes through unwrapped; everything else (including inline host tags like `em`/`strong`/`a`,
 * and bare text) is inline and joins the run.
 *
 * Membership is by the *resolved* host tag string. `ul`/`ol`/`li`/`section`/`h1`–`h6` are here so
 * that the products of `groupLists`/`groupSections` and headings are treated as blocks by
 * `groupParas`. This set is a **cross-stream contract point**: the reader's notion of which tags
 * never get wrapped in a `<p>` must match it.
 */
export const HOST_BLOCK_TAGS: ReadonlySet<string> = new Set([
  // sectioning / grouping
  "section",
  "article",
  "aside",
  "nav",
  "header",
  "footer",
  "main",
  "div",
  // headings
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
  // lists
  "ul",
  "ol",
  "li",
  "dl",
  "dt",
  "dd",
  // text blocks
  "p",
  "blockquote",
  "pre",
  "figure",
  "figcaption",
  "hr",
  "address",
  // tables (block-level)
  "table",
  "thead",
  "tbody",
  "tfoot",
  "tr",
  "td",
  "th",
  "caption",
  // forms (block-level)
  "form",
  "fieldset"
]);

/**
 * The host tags that are **flow containers**: their child stream receives implicit paragraph
 * grouping (`groupParas`) and — unless the tag is `section` itself — section grouping
 * (`groupSections`). Everything *not* in this set (inline host tags like `em`/`strong`/`a`/`span`,
 * and the "tight" blocks `p`/`li`/`h1`–`h6`/`pre`) is left alone by paras/sections and receives
 * only `groupLists`.
 *
 * `FRAG` (the document body / a `@{…}` fragment) is treated as a flow container too (handled
 * separately in {@link struct} since it is a symbol, not a string). This set is a **cross-stream
 * contract point**: it determines where bare prose becomes `<p>` and where headings form
 * `<section>`s.
 */
export const HOST_FLOW_TAGS: ReadonlySet<string> = new Set([
  "section",
  "article",
  "aside",
  "nav",
  "header",
  "footer",
  "main",
  "div",
  "blockquote",
  "figure",
  // table cells hold flow content
  "td",
  "th"
]);

/** The list-item sentinels the reader emits for `-` / `+`, and the list tag each coalesces into. */
const LIST_SENTINEL = {
  ulli: "ul",
  olli: "ol"
} as const;
type ListSentinel = keyof typeof LIST_SENTINEL;

/** The heading tags, with their rank (h1 = 1 … h6 = 6), for `groupSections`. */
const HEADING_RANK: Record<string, number> = {
  h1: 1,
  h2: 2,
  h3: 3,
  h4: 4,
  h5: 5,
  h6: 6
};

// ---------------------------------------------------------------------------------------------
// Small predicates
// ---------------------------------------------------------------------------------------------

function isListSentinel(v: VNode): v is ElementVNode & { tag: ListSentinel } {
  return isElement(v) && typeof v.tag === "string" && v.tag in LIST_SENTINEL;
}

function headingRank(v: VNode): number | undefined {
  if (isElement(v) && typeof v.tag === "string") {
    return HEADING_RANK[v.tag];
  }
  return undefined;
}

/**
 * Block-level test for paragraph grouping (decode.md `isBlock`):
 * `⟨t,…⟩ ∧ ( t ∈ HOST_BLOCK_TAGS ∨ (isComp(t) ∧ t.kind == "block") )`.
 *
 * Following the spec **literally**, a fragment (`tag === FRAG`) is *not* block: `FRAG` is neither
 * in `HOST_BLOCK_TAGS` nor a component, so `isBlock(FRAG) = false` → a fragment is treated as
 * inline and joins the surrounding paragraph run. (This is the chosen interpretation of the
 * underspecified fragment case; documented as a contract point.)
 */
function isBlock(v: VNode): boolean {
  if (!isElement(v)) {
    return false;
  }
  if (typeof v.tag === "string") {
    return HOST_BLOCK_TAGS.has(v.tag);
  }
  if (isComp(v.tag)) {
    return v.tag.kind === "block";
  }
  // FRAG (symbol): not block — inline, per the literal isBlock definition.
  return false;
}

/**
 * A **paragraph-break marker** in the child stream: a whitespace-only text child that contains a
 * blank line (a newline, optional non-newline whitespace, another newline). It *splits* paragraph
 * runs and is consumed (not emitted into output).
 *
 * Rationale (contract point — the reader must match): the reader emits each interior newline as an
 * individual `"\n"` text child (notation.md §Whitespace / contract §3). A *single* `"\n"` (or other
 * whitespace with no blank line) is a soft break and stays **inline** — it joins the run, so the
 * `<p>` keeps the author's line breaks. A *blank line* (two or more newlines, i.e. an empty source
 * line between paragraphs) is the paragraph boundary. Matching on `/\n[^\S\n]*\n/` captures exactly
 * the blank-line case regardless of surrounding indentation that survived per-line trimming.
 */
const PARA_BREAK = /\n[^\S\n]*\n/;
function isParaBreak(v: VNode): boolean {
  return typeof v === "string" && v.trim() === "" && PARA_BREAK.test(v);
}

// ---------------------------------------------------------------------------------------------
// struct
// ---------------------------------------------------------------------------------------------

/**
 * Run the grouping passes over a sibling stream per the gate flags, then recurse `struct` into
 * each result. `groupLists` always runs (lists nest anywhere); `paras`/`sections` run only when
 * requested.
 */
function decodeChildren(
  children: readonly VNode[],
  paras: boolean,
  sections: boolean
): VNode[] {
  let k = groupLists(children);
  if (paras) {
    k = groupParas(k);
  }
  if (sections) {
    k = groupSections(k);
  }
  return k.map(struct);
}

/** @see module docs. */
export function struct(v: VNode): VNode {
  if (typeof v === "string") {
    return v;
  }
  if (isComp(v.tag)) {
    // Boundary stop: a component's children were authored *outside* the component, so they are
    // static nota vnodes — decode them (per decode.md §"Component slots", "lists/paras in @Aside{…}
    // still group") — but do NOT descend into the component body.
    //
    // The children slot is treated like the component's own grouping context, keyed on `kind`: a
    // BLOCK component holds flow content (paras + sections + lists group, like `@Aside{…}`); an
    // INLINE component holds inline content (only `groupLists`, no paragraph-wrapping — so the
    // canonical golden's `@Colorized{a}` keeps `"a"` bare rather than `<p>a</p>`). `groupLists`
    // runs in both cases, so a `-`/`+` list authored inside any component still coalesces.
    const flow = v.tag.kind === "block";
    return {
      tag: v.tag,
      props: v.props,
      children: decodeChildren(v.children, flow, flow)
    };
  }

  // Container gate (see module docs): groupLists always; paras/sections only in flow containers.
  const isFlow =
    v.tag === FRAG || (typeof v.tag === "string" && HOST_FLOW_TAGS.has(v.tag));
  // A <section>'s children were already sectioned by the parent's recursive groupSections; do not
  // re-section, or its own leading heading would be re-wrapped.
  const doSections = isFlow && v.tag !== "section";

  return {
    tag: v.tag,
    props: v.props,
    children: decodeChildren(v.children, isFlow, doSections)
  };
}

// ---------------------------------------------------------------------------------------------
// Pass 1 — groupLists
// ---------------------------------------------------------------------------------------------

/**
 * Coalesce each maximal run of identical `"ulli"`/`"olli"` sentinel nodes into one
 * `⟨ul|ol, {}, [⟨li, {}, itemᵢ.children⟩ …]⟩` (decode.md `groupLists`).
 *
 * "Identical" means the *same* sentinel string: a `ulli` run and an adjacent `olli` run stay
 * separate lists. Non-sentinel children pass through unchanged. Each `<li>` carries the original
 * item's children verbatim — `struct` recurses into the produced `ul`/`ol` afterward, which
 * recurses into each `<li>`, so a deeper sentinel run nested inside an item's children forms the
 * inner list with no special case here.
 */
export function groupLists(k: readonly VNode[]): VNode[] {
  const out: VNode[] = [];
  let i = 0;
  while (i < k.length) {
    const item = k[i];
    if (isListSentinel(item)) {
      const sentinel: ListSentinel = item.tag;
      const items: VNode[] = [];
      // accumulate the maximal run of the *same* sentinel
      while (i < k.length) {
        const cur = k[i];
        if (isListSentinel(cur) && cur.tag === sentinel) {
          items.push({ tag: "li", props: {}, children: cur.children });
          i++;
        } else {
          break;
        }
      }
      out.push({ tag: LIST_SENTINEL[sentinel], props: {}, children: items });
    } else {
      out.push(item);
      i++;
    }
  }
  return out;
}

// ---------------------------------------------------------------------------------------------
// Pass 2 — groupParas
// ---------------------------------------------------------------------------------------------

/**
 * Wrap each maximal run of inline siblings in a `⟨p, {}, [...run]⟩` (decode.md `groupParas`).
 *
 * - **Inline siblings** (text, inline host elements, inline components, fragments) accumulate into
 *   the current run.
 * - A **paragraph-break marker** ({@link isParaBreak}) flushes the current run and is consumed.
 * - A **block sibling** ({@link isBlock}) flushes the current run and passes through unwrapped.
 *   Block components flush; inline components join the run (land inside the `<p>`).
 *
 * A flushed run becomes a `<p>` only if it holds at least one non-whitespace child — a run of pure
 * soft-whitespace (e.g. a lone `"\n"` between two blocks) is dropped rather than wrapped in an
 * empty `<p>`.
 */
export function groupParas(k: readonly VNode[]): VNode[] {
  const out: VNode[] = [];
  let run: VNode[] = [];

  const flush = () => {
    if (run.length === 0) {
      return;
    }
    // drop a run that is only whitespace (no real paragraph content)
    const hasContent = run.some(c => typeof c !== "string" || c.trim() !== "");
    if (hasContent) {
      out.push({ tag: "p", props: {}, children: run });
    }
    run = [];
  };

  for (const c of k) {
    if (isParaBreak(c)) {
      flush();
    } else if (isBlock(c)) {
      flush();
      out.push(c);
    } else {
      run.push(c);
    }
  }
  flush();
  return out;
}

// ---------------------------------------------------------------------------------------------
// Pass 3 — groupSections
// ---------------------------------------------------------------------------------------------

/**
 * Make each heading own the siblings beneath it, up to the next heading of rank ≤ its own, inside a
 * `⟨section, {}, [heading, …groupSections(owned)]⟩` (decode.md `groupSections`).
 *
 * Siblings appearing before any heading pass through unwrapped. The owned span is processed
 * recursively, so a deeper heading (greater rank) nests inside the shallower section; a heading of
 * equal-or-shallower rank ends the current section and starts (or continues) at the outer level.
 *
 * The recursion is total — `groupSections` alone produces the full section nesting — so `struct`
 * must *not* re-run it when it descends into a produced `<section>` (handled by the container gate
 * in {@link struct}: `<section>` interiors get paras/lists but not re-sectioning).
 */
export function groupSections(k: readonly VNode[]): VNode[] {
  const out: VNode[] = [];
  let i = 0;
  while (i < k.length) {
    const node = k[i];
    const rank = headingRank(node);
    if (rank === undefined) {
      // content before/between sections at this level: pass through
      out.push(node);
      i++;
    } else {
      // this heading owns following siblings until a heading of rank <= its own
      const owned: VNode[] = [];
      i++;
      while (i < k.length) {
        const r = headingRank(k[i]);
        if (r !== undefined && r <= rank) {
          break;
        }
        owned.push(k[i]);
        i++;
      }
      out.push({
        tag: "section",
        props: {},
        children: [node, ...groupSections(owned)]
      });
    }
  }
  return out;
}
