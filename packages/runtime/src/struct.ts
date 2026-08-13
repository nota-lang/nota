/**
 * The structural pass `struct`.
 *
 * `struct` turns a *flat* sibling stream of small content pieces into the *nested* HTML structure
 * a document wants, via three sibling-grouping passes over a child list — then recurses, **stopping
 * at component boundaries**. The core skeleton:
 *
 * ```
 * struct(v):
 *   v is string         → v
 *   plain fn tag        → struct(expand(v))    // static template: invoke + splice (expandTemplates)
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
 * ## Container gate
 *
 * Applying all three passes to *every* host node uniformly would over-group: it would
 * wrap `@p{Hello}`'s text in a *second* `<p>`, paragraph-wrap a list item's single inline child
 * (contradicting the worked example in design/decode.md, whose `<li>` holds the `Colorized` boundary directly with
 * no `<p>`), and re-section a `<section>`'s own heading on the recursive descent. So paragraph- and
 * section-grouping apply only inside **flow containers**; the rest are "tight" and receive only
 * `groupLists` (which is context-free — lists can nest anywhere). Concretely, for a host node:
 *
 * - `groupLists` — **always** (sentinels may appear in any container, e.g. a nested list inside an
 *   `<li>`). Idempotent: `ul`/`ol` carry no sentinels, so a re-run is a no-op. A run is *maximal*
 *   over same-kind sentinels with interior whitespace-only text bridged/consumed (whitespace bridging), so
 *   blank lines between items — however the stream was assembled — do not split the list; edge
 *   whitespace and whitespace fencing a list off from prose is preserved.
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

import { isComp } from "./component.js";
import { isMark, isQuery } from "./doc.js";
import { isRaw } from "./raw.js";
import {
  type ChildArg,
  type ElementVNode,
  FRAG,
  flatten,
  isElement,
  isFragment,
  type TemplateFn,
  type VNode
} from "./vnode.js";

// ---------------------------------------------------------------------------------------------
// Contract constants (the reader must honor these)
// ---------------------------------------------------------------------------------------------

/**
 * The host tags that count as **block-level** for paragraph grouping (`isBlock`), i.e. the
 * standard HTML block-level element set. A block sibling flushes the current paragraph run and
 * passes through unwrapped; everything else (including inline host tags like `em`/`strong`/`a`,
 * and bare text) is inline and joins the run.
 *
 * Membership is by the *resolved* host tag string. `ul`/`ol`/`li`/`section`/`h1`–`h6` are here so
 * that the products of `groupLists`/`groupSections` and headings are treated as blocks by
 * `groupParas`. This set is a **cross-package contract point**: the reader's notion of which tags
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
 * separately in {@link struct} since it is a symbol, not a string). This set is a **cross-package
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
  "nota-ul-li": "ul",
  "nota-ol-li": "ol"
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
 * Block-level test for paragraph grouping (`isBlock`):
 * `⟨t,…⟩ ∧ ( t ∈ HOST_BLOCK_TAGS ∨ (isComp(t) ∧ t.kind == "block") )`.
 *
 * A fragment (`tag === FRAG`) is *not* block: `FRAG` is neither in `HOST_BLOCK_TAGS` nor a
 * component, so `isBlock(FRAG) = false` → a fragment is treated as inline and joins the surrounding
 * paragraph run.
 */
function isBlock(v: VNode): boolean {
  // A RawHtml leaf declares its own blockness: block raw (shiki's <pre>, display
  // math) flushes the paragraph run and passes through unwrapped; inline raw joins the run.
  if (isRaw(v)) {
    return v.block === true;
  }
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
 * A **paragraph break** is a blank line in the child stream: a newline, optional non-newline
 * whitespace, another newline. It splits paragraph runs and is consumed (not emitted into output).
 *
 * The reader emits each interior newline as an *individual* `"\n"` text child and does NOT
 * pre-coalesce them (pinned in design/decode.md §struct), so a blank source line surfaces as **two or more adjacent
 * whitespace-only siblings** (e.g. `"\n", "\n"`), not a single `"\n\n"` node. {@link groupParas}
 * therefore accumulates a maximal run of whitespace-only siblings and tests the *concatenation*
 * with `PARA_BREAK`: a run containing a blank line is a break; softer whitespace (a single `"\n"`,
 * spaces) stays **inline** so the `<p>` keeps the author's line breaks.
 */
const PARA_BREAK = /\n[^\S\n]*\n/;

/** Is `v` a whitespace-only text node (a candidate piece of an inter-paragraph gap)? */
function isWhitespaceText(v: VNode): v is string {
  return typeof v === "string" && v.trim() === "";
}

/**
 * Scan the maximal run of whitespace-only siblings starting at index `start`, returning the run's
 * nodes, the concatenated whitespace text (for the {@link PARA_BREAK} test), and the index just past
 * the run. Shared by {@link groupParas} and {@link consumeParaBreaks}: both accumulate such a run and
 * branch on whether its concatenation contains a blank line (a paragraph break vs. soft whitespace).
 */
function whitespaceRun(
  k: readonly VNode[],
  start: number
): { nodes: readonly VNode[]; ws: string; next: number } {
  let ws = "";
  let next = start;
  while (next < k.length && isWhitespaceText(k[next])) {
    ws += k[next] as string;
    next++;
  }
  return { nodes: k.slice(start, next), ws, next };
}

// ---------------------------------------------------------------------------------------------
// struct
// ---------------------------------------------------------------------------------------------

/** Chain-expansion fuel for {@link expandTemplates} — a template returning a template-tagged node
 *  is fine (composition); an unbounded chain is a cycle. */
const MAX_TEMPLATE_EXPANSION = 1024;

/**
 * Expand a **plain-function tag** (a static template): invoke it with
 * `{ children, …props }` and keep expanding while the result is itself template-tagged. Marked
 * components (`isComp`) are boundaries and are never expanded — the constructors buy deferral.
 * The invocation runs under `▸ = false`, so markup inside the template builds static vnodes; the
 * result is normalized like any `h` child (numbers → text, nullish/booleans dropped → empty
 * fragment) and splices into the caller's sibling stream via {@link flattenFragments}, *before*
 * grouping — a template's list sentinels coalesce with its siblings'.
 */
function expandTemplates(v: VNode): VNode {
  let node = v;
  let fuel = MAX_TEMPLATE_EXPANSION;
  while (
    isElement(node) &&
    typeof node.tag === "function" &&
    !isComp(node.tag)
  ) {
    if (fuel-- === 0) {
      throw new Error(
        `template expansion did not terminate: <${node.tag.name || "anonymous"}> keeps returning template-tagged nodes (a cycle?)`
      );
    }
    const template: TemplateFn = node.tag;
    const result = template({ children: node.children, ...node.props });
    const flat = flatten([result as ChildArg]);
    node =
      flat.length === 1 ? flat[0] : { tag: FRAG, props: {}, children: flat };
  }
  return node;
}

/**
 * Splice **transparent fragments**: a `FRAG` *sibling* contributes its children to the
 * parent's sibling stream — recursively — so a fragment is transparent to grouping. This is what
 * dissolves `@for`'s per-iteration keyed `Fragment({key:_i}, …)` at `▸=false`: the wrapped
 * `nota-ul-li` sentinels become direct siblings and `groupLists` coalesces them into one `<ul>`. The FRAG's
 * own props (the `key`) are dropped here — static HTML needs no key; the `▸=true` path keeps the key
 * via `adapter.Fragment`. (A bare `@{…}` fragment splices identically.)
 *
 * Plain-function tags are expanded first ({@link expandTemplates}), so a template returning a
 * fragment splices its children into this stream too. Host elements and component boundaries pass
 * through untouched.
 */
function flattenFragments(children: readonly VNode[]): VNode[] {
  const out: VNode[] = [];
  for (const raw of children) {
    const c = expandTemplates(raw);
    if (isFragment(c)) {
      out.push(...flattenFragments(c.children));
    } else {
      out.push(c);
    }
  }
  return out;
}

/**
 * Hoist static-template expansion + transparent-fragment splicing to a **whole-tree pre-pass**
 * of the decode pipeline, reusing `expandTemplates`/`flattenFragments`. Recursively: expand a
 * plain-function tag, splice a transparent `FRAG` sibling's children into its parent's stream
 * (dropping the FRAG's own props, e.g. a keyed `@for`'s `key` — exactly as `decodeChildren` does), over
 * the WHOLE tree including component-boundary children. The root node itself is kept (a root `FRAG`
 * stays a `FRAG` node with normalized children). Opaque leaves — {@link RawHtml} and the
 * doc-state mark/query leaves — pass through untouched (they are not elements).
 *
 * This is **observationally identical** to what `struct`'s interleaved expansion path would have
 * produced (both expansion and fragment-splicing are context-free, and grouping never introduces a
 * template/fragment): `normalize` fully expands *before* the index sees the tree, so marks produced
 * by templates are indexed. `struct`'s own interleaved expansion path stays in place unchanged — it
 * simply becomes vacuous after `normalize` (direct `struct` callers still exercise it).
 */
export function normalize(root: VNode): VNode {
  const v = expandTemplates(root);
  if (typeof v === "string") {
    return v;
  }
  if (isRaw(v)) {
    return v;
  }
  // Doc-state leaves (and any non-element value) pass through untouched. Note: a mark's vnode-valued
  // `data.content` is data, not tree, so it is deliberately NOT normalized here (see indexDoc).
  if (!isElement(v)) {
    return v;
  }
  // A non-vnode object (e.g. reaching the tree via `@(expr)`): leave as-is for `struct` to coerce.
  if (!Array.isArray(v.children)) {
    return v;
  }
  return {
    tag: v.tag,
    props: v.props,
    children: flattenFragments(v.children).map(normalize)
  };
}

/**
 * Run the grouping passes over a sibling stream per the gate flags, then recurse `struct` into
 * each result. Fragments are spliced transparently first (so their children join this stream's
 * grouping); `groupLists` always runs (lists nest anywhere); `paras`/`sections` run only when
 * requested.
 */
function decodeChildren(
  children: readonly VNode[],
  paras: boolean,
  sections: boolean
): VNode[] {
  let k = groupLists(flattenFragments(children));
  // Flow containers wrap inline runs in <p> (which also consumes paragraph-break markers); tight
  // containers (p/li/hN/…) do not wrap, but must still CONSUME the break marker so that a blank line
  // authored inside a tight element does not leak as a literal "\n\n".
  k = paras ? groupParas(k) : consumeParaBreaks(k);
  if (sections) {
    k = groupSections(k);
  }
  return k.map(struct);
}

/** @see module docs. */
export function struct(root: VNode): VNode {
  if (typeof root === "string") {
    return root;
  }
  // A RawHtml leaf is opaque: no structure to decode, passes through verbatim.
  // As a *sibling* it is inline (isBlock → false), so inline raw output (e.g. KaTeX MathML) joins
  // the surrounding paragraph run; a block default wraps its raw in a HOST_BLOCK_TAGS host.
  if (isRaw(root)) {
    return root;
  }
  // Direct entry with a template-tagged node (children go through flattenFragments instead).
  const v = expandTemplates(root);
  if (typeof v === "string") {
    return v;
  }
  // A template may *return* a RawHtml leaf (e.g. the prelude's KaTeX default) — opaque, as above.
  if (isRaw(v)) {
    return v;
  }
  // A doc-state MarkLeaf/QueryLeaf leaf is opaque here — `struct` passes it through
  // untouched (like `isRaw`) so it survives to `serialize`, which then fails pointedly on it. In the
  // full decode pipeline `force` has already removed marks / spliced queries before `struct` runs,
  // so this only fires for a direct `struct` caller that skipped the doc-state passes.
  if (isMark(v) || isQuery(v)) {
    return v;
  }
  // A child that is not a real vnode (e.g. an object/Date reaching the tree via `@(expr)`, which is
  // not renderable markup) has no `children` array; recursing into it would crash with "children is
  // not iterable". Coerce it to its string form instead of crashing.
  if (!Array.isArray(v.children)) {
    return String(v);
  }
  if (isComp(v.tag)) {
    // Boundary stop: a component's children were authored *outside* the component, so they are
    // static nota vnodes — decode them (lists/paras in `@Aside{…}` still group) — but do NOT
    // descend into the component body.
    //
    // The children slot is treated like the component's own grouping context, keyed on `kind`: a
    // BLOCK component holds flow content (paras + sections + lists group, like `@Aside{…}`); an
    // INLINE component holds inline content (only `groupLists`, no paragraph-wrapping — so the
    // worked example's `@Colorized{a}` keeps `"a"` bare rather than `<p>a</p>`). `groupLists`
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
 * Coalesce each maximal run of identical `"nota-ul-li"`/`"nota-ol-li"` sentinel nodes into one
 * `⟨ul|ol, {}, [⟨li, {}, itemᵢ.children⟩ …]⟩` (`groupLists`).
 *
 * "Identical" means the *same* sentinel string: a `nota-ul-li` run and an adjacent `nota-ol-li` run stay
 * separate lists. Non-sentinel children pass through unchanged. Each `<li>` carries the original
 * item's children verbatim — `struct` recurses into the produced `ul`/`ol` afterward, which
 * recurses into each `<li>`, so a deeper sentinel run nested inside an item's children forms the
 * inner list with no special case here.
 *
 * **Whitespace bridging (design/decode.md §struct).** A run is *maximal* over the same-kind sentinels with
 * interior whitespace-only text bridged: while accumulating a run, a maximal group of
 * whitespace-only text siblings (`isWhitespaceText`) that is *immediately followed by another
 * sentinel of the same kind* is **consumed** (skipped, emitted nowhere) and the run continues.
 * Anything else — a non-whitespace sibling, a different-kind sentinel, or end-of-stream — ends the
 * run, and that trailing whitespace is **not** consumed: `i` is left at the whitespace start so the
 * outer loop re-emits it verbatim (it must still reach {@link groupParas}/`consumeParaBreaks`
 * for paragraph-break handling). Whitespace *before* the first sentinel is likewise untouched. Blank
 * lines between items therefore do **not** split the list — matching the reader, which absorbs
 * textual between-item blank lines into item extents and edge-trims them, so `- a`␤␤`- b` already
 * arrives as adjacent sentinels; bridging extends the same semantics to streams assembled via control
 * flow (a keyed `@for`), templates, fragments, and hand-written `h`, where the whitespace survives
 * fragment splicing and would otherwise split the run.
 *
 * *p-interaction invariant:* output whitespace = input whitespace minus the runs *interior* to a
 * produced list. Only whitespace bracketed by same-kind sentinels is dropped; whitespace separating
 * a list from non-list content is preserved, so the paragraph-break markers that {@link groupParas}
 * relies on to fence a list off from surrounding prose still survive this pass.
 */
export function groupLists(k: readonly VNode[]): VNode[] {
  const out: VNode[] = [];
  let i = 0;
  while (i < k.length) {
    const item = k[i];
    if (isListSentinel(item)) {
      const sentinel: ListSentinel = item.tag;
      const items: VNode[] = [];
      // accumulate the maximal run of the *same* sentinel, bridging interior whitespace
      while (i < k.length) {
        const cur = k[i];
        if (isListSentinel(cur) && cur.tag === sentinel) {
          items.push({ tag: "li", props: {}, children: cur.children });
          i++;
          continue;
        }
        // A whitespace-only run bridges the list iff a same-kind sentinel follows it: consume it
        // (advance `i` past it) and keep accumulating. Otherwise leave `i` at the whitespace start so
        // the outer loop re-emits it — the whitespace still owes a visit to groupParas.
        if (isWhitespaceText(cur)) {
          const { next } = whitespaceRun(k, i);
          const after = k[next];
          if (
            after !== undefined &&
            isListSentinel(after) &&
            after.tag === sentinel
          ) {
            i = next;
            continue;
          }
        }
        break;
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
 * Wrap each maximal run of inline siblings in a `⟨p, {}, [...run]⟩` (`groupParas`).
 *
 * - **Inline siblings** (text, inline host elements, inline components, fragments) accumulate into
 *   the current run.
 * - A **paragraph-break marker** (a blank line matching `PARA_BREAK`) flushes the current run and is consumed.
 * - A **block sibling** (`isBlock`) flushes the current run and passes through unwrapped.
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

  let i = 0;
  while (i < k.length) {
    const c = k[i];
    if (isWhitespaceText(c)) {
      // The reader emits one "\n" per interior newline, so a blank line is ≥2 adjacent "\n" nodes: a
      // whitespace run whose concatenation contains a blank line is a paragraph break (flush +
      // consume); softer whitespace joins the run inline so the <p> keeps the author's line breaks.
      const { nodes, ws, next } = whitespaceRun(k, i);
      i = next;
      if (PARA_BREAK.test(ws)) {
        flush();
      } else {
        run.push(...nodes);
      }
      continue;
    }
    if (isBlock(c)) {
      flush();
      out.push(c);
    } else {
      run.push(c);
    }
    i++;
  }
  flush();
  return out;
}

/**
 * Consume **paragraph-break markers** ({@link PARA_BREAK}, a blank line) from a TIGHT container's
 * child stream without wrapping inline runs in `<p>`. This mirrors {@link groupParas}'s whitespace
 * handling: a whitespace run containing a blank line is dropped (consumed); softer whitespace (a
 * single `"\n"` or spaces) stays inline so an author's line break inside `@p{…}` is preserved.
 * Non-whitespace passes through unchanged. (Flow containers use {@link groupParas} instead, which
 * already consumes the marker as it wraps runs.)
 */
function consumeParaBreaks(k: readonly VNode[]): VNode[] {
  const out: VNode[] = [];
  let i = 0;
  while (i < k.length) {
    const c = k[i];
    if (isWhitespaceText(c)) {
      // A whitespace run with a blank line is a break marker → consume; softer whitespace stays inline.
      const { nodes, ws, next } = whitespaceRun(k, i);
      i = next;
      if (!PARA_BREAK.test(ws)) {
        out.push(...nodes);
      }
      continue;
    }
    out.push(c);
    i++;
  }
  return out;
}

// ---------------------------------------------------------------------------------------------
// Pass 3 — groupSections
// ---------------------------------------------------------------------------------------------

/**
 * Make each heading own the siblings beneath it, up to the next heading of rank ≤ its own, inside a
 * `⟨section, {}, [heading, …groupSections(owned)]⟩` (`groupSections`).
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
