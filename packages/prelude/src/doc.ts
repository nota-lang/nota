/**
 * The prelude doc-state constructs (contract R18e/f) — policy over the runtime's `mark`/`query`.
 *
 * The runtime (contract R18a–d) ships the *mechanism*: two opaque leaves (`mark`/`query`), the
 * `DocIndex` a query resolves against, the `normalize → index → force` decode passes, and the
 * trailer registry. This module is the *policy* (R18e, the R14 slots-over-primitives pattern):
 * headings + numbering + a table of contents, `@Label`/`@Ref`, footnotes, and `@Cite`/`@Bibliography`
 * — each a **registry slot** (`slot(name, Default)`) so `registerComponents` overrides it site-wide,
 * built only on `mark`/`query`. Doc config (`secset`/`bibset`) lives in `./config` and follows
 * `lstset` exactly (doc-global, last-write-wins, reset per render).
 *
 * ## Two structural invariants this module honors
 * - **The concrete `hN` comes from the query, not beside the mark.** `force` runs *before* grouping,
 *   so a `Heading`'s `query` output `<hN>` participates in `groupSections` like authored content; a
 *   heading built eagerly next to the mark would be seen twice / grouped wrong.
 * - **Marks stored in `data.content` must be *direct*.** `indexDoc` walks a mark's vnode-valued
 *   `data.content` but does **not** template-expand it, so a `@Cite` slot *inside* a `@Footnote`
 *   would never index. We therefore `normChildren` (= runtime `normalize`) the stored children,
 *   which expands the slot to its direct `mark`/`query` leaves before storing — so the nested cite
 *   indexes at the footnote's position and forces cleanly when the footnote list renders.
 */

import {
  type CompProps,
  type DocIndex,
  type ElementVNode,
  FRAG,
  Fragment,
  flatten,
  h,
  type IndexedMark,
  isElement,
  isMark,
  isQuery,
  isRaw,
  type MarkLeaf,
  mark,
  normalize,
  query,
  slot,
  type VNode
} from "@nota-lang/runtime";

import { config } from "./config.js";
import { definitionFor, definitionRefLabel } from "./def.js";

// =============================================================================================
// Shared helpers
// =============================================================================================

/**
 * Flatten arbitrary markup to its plain text (the R14c `textContent` precedent, generalized): host
 * and fragment and slot elements recurse into their children; strings/numbers stringify; doc-state
 * leaves ({@link isMark}/{@link isQuery}) and {@link isRaw} leaves contribute nothing (no
 * reconstructible source text); nullish/booleans drop. Used for heading slugs and TOC/ref link text.
 */
export function textContent(node: unknown): string {
  if (node == null || node === true || node === false) {
    return "";
  }
  if (typeof node === "string") {
    return node;
  }
  if (typeof node === "number") {
    return String(node);
  }
  if (Array.isArray(node)) {
    return node.map(textContent).join("");
  }
  if (isMark(node) || isQuery(node) || isRaw(node)) {
    return "";
  }
  if (isElement(node as VNode)) {
    const el = node as ElementVNode;
    return Array.isArray(el.children)
      ? el.children.map(textContent).join("")
      : "";
  }
  return "";
}

/**
 * Pre-expand stored child markup so any nested slot's `mark`/`query` leaves become **direct** (see
 * module docs): wrap in a `FRAG`, run the runtime `normalize` (R10 expansion + fragment splicing),
 * and return the resulting flat children. `indexDoc` then walks these direct marks in `data.content`.
 */
export function normChildren(children: unknown): VNode[] {
  const arr = flatten([children as VNode]);
  const norm = normalize({
    tag: FRAG,
    props: {},
    children: arr
  }) as ElementVNode;
  return norm.children;
}

/** Slugify title text: lowercase, non-alphanumeric runs → `-`, trim edge `-`; empty → `"section"`. */
function slugify(text: string): string {
  const s = text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return s === "" ? "section" : s;
}

/** A per-{@link DocIndex} memo table (the `DocIndex` has no memo hook — R18e memoizes here). */
function memoize<T>(
  table: WeakMap<DocIndex, T>,
  doc: DocIndex,
  build: () => T
): T {
  const hit = table.get(doc);
  if (hit !== undefined) {
    return hit;
  }
  const value = build();
  table.set(doc, value);
  return value;
}

// =============================================================================================
// Heading (R18f) + numbering
// =============================================================================================

interface HeadingData extends Record<string, unknown> {
  rank: number;
  title: VNode[];
  content: VNode[];
  explicitId?: string;
}

const headingIdMemo = new WeakMap<DocIndex, Map<IndexedMark, string>>();
const headingNumMemo = new WeakMap<DocIndex, Map<IndexedMark, string>>();

/** Document-wide, deduplicated ids for every heading mark (one memoized pass, document order). */
function headingIds(doc: DocIndex): Map<IndexedMark, string> {
  return memoize(headingIdMemo, doc, () => {
    const ids = new Map<IndexedMark, string>();
    const seen = new Map<string, number>();
    for (const e of doc.all("heading")) {
      const data = e.data as HeadingData;
      const base = data.explicitId ?? slugify(textContent(data.title));
      let id = base;
      if (seen.has(base)) {
        const n = (seen.get(base) as number) + 1;
        id = `${base}-${n}`;
        seen.set(base, n);
      } else {
        seen.set(base, 1);
      }
      ids.set(e, id);
    }
    return ids;
  });
}

/**
 * Hierarchical section numbers for headings of rank ≤ `numberDepth` (empty when depth = 0). The
 * standard outline algorithm over a rank-stack: a deeper heading opens a level, an equal-rank one
 * increments the current, a shallower one pops — so skipped ranks collapse gracefully (`# / ###` →
 * `1 / 1.1`, not `1 / 1.0.1`). Memoized per index; `numberDepth` is read once (config is final by
 * force time — R14d).
 */
function headingNumbers(doc: DocIndex): Map<IndexedMark, string> {
  return memoize(headingNumMemo, doc, () => {
    const nums = new Map<IndexedMark, string>();
    const depth = config().numberDepth;
    if (depth <= 0) {
      return nums;
    }
    const stack: { rank: number; count: number }[] = [];
    for (const e of doc.all("heading")) {
      const rank = (e.data as HeadingData).rank;
      if (rank > depth) {
        continue; // beyond the numbered depth: no number, no counter effect
      }
      while (stack.length > 0 && stack[stack.length - 1].rank > rank) {
        stack.pop();
      }
      const top = stack[stack.length - 1];
      if (top !== undefined && top.rank === rank) {
        top.count += 1;
      } else {
        stack.push({ rank, count: 1 });
      }
      nums.set(e, stack.map(s => s.count).join("."));
    }
    return nums;
  });
}

/** Clamp a rank prop to 1–6 (defaults to 1). */
function clampRank(rank: unknown): number {
  const n = Math.round(Number(rank));
  if (!Number.isFinite(n)) {
    return 1;
  }
  return Math.min(6, Math.max(1, n));
}

/**
 * The default `Heading` (R18f — the future `#` sugar target). Props: `rank` (1–6), optional `id`.
 * Emits `mark("heading", …)` + a `query` producing the concrete `hN` (which `force` splices *before*
 * grouping, so `groupSections` sees it). `id` = explicit prop ?? deduped slug; a section number
 * prefix appears when `rank ≤ secset({numberDepth})`.
 */
export function DefaultHeading(props: CompProps): unknown {
  const rank = clampRank(props.rank);
  const explicitId = typeof props.id === "string" ? props.id : undefined;
  const title = normChildren(props.children);
  const m = mark("heading", {
    rank,
    title,
    // `content` is the field indexDoc walks: marks inside the title (a footnote/cite) index here.
    content: title,
    explicitId
  } satisfies HeadingData);
  const q = query(doc => {
    const entry = doc.get(m);
    const id = headingIds(doc).get(entry);
    const num = headingNumbers(doc).get(entry);
    const prefix: VNode[] =
      num !== undefined
        ? [h("span", { class: "nota-secnum" }, [num]), " "]
        : [];
    return h(`h${rank}`, { id }, [...prefix, ...title]);
  });
  return Fragment(m, q);
}

/** The ambient `Heading` slot (R18f). */
export const Heading = slot("Heading", DefaultHeading);

// =============================================================================================
// Toc (R18e)
// =============================================================================================

/** Link content for a heading entry in the TOC / a numeric `@Ref`: `[secnum?, titleText]`. */
function headingLinkLabel(
  entry: IndexedMark,
  ids: Map<IndexedMark, string>,
  nums: Map<IndexedMark, string>
): { id: string; children: VNode[] } {
  const id = ids.get(entry) as string;
  const num = nums.get(entry);
  const title = textContent((entry.data as HeadingData).title);
  const children: VNode[] = num !== undefined ? [`${num} `, title] : [title];
  return { id, children };
}

/**
 * The default `Toc`: a `query` rendering a nested list of heading links. Nesting is expressed with
 * `nota-ul-li` sentinels — a child sentinel run inside an item — which the runtime's `groupLists`
 * recursion turns into nested `<ul>`s. Optional `depth` prop caps the ranks shown (default: all).
 * Empty document → renders nothing.
 */
export function DefaultToc(props: CompProps): unknown {
  const depth = typeof props.depth === "number" ? props.depth : 6;
  return query(doc => {
    const ids = headingIds(doc);
    const nums = headingNumbers(doc);
    const headings = doc
      .all("heading")
      .filter(e => (e.data as HeadingData).rank <= depth);
    if (headings.length === 0) {
      return null;
    }
    let i = 0;
    // Recursive descent: gather items whose rank is deeper than `parentRank`; a heading's own deeper
    // followers become a sublist nested inside its item (a child sentinel run).
    const build = (parentRank: number): VNode[] => {
      const items: VNode[] = [];
      while (i < headings.length) {
        const entry = headings[i];
        const rank = (entry.data as HeadingData).rank;
        if (rank <= parentRank) {
          break;
        }
        i += 1;
        const { id, children } = headingLinkLabel(entry, ids, nums);
        const link = h("a", { href: `#${id}` }, children);
        const sub = build(rank);
        items.push(
          h("nota-ul-li", {}, sub.length > 0 ? [link, ...sub] : [link])
        );
      }
      return items;
    };
    return build(0);
  });
}

/** The ambient `Toc` slot. */
export const Toc = slot("Toc", DefaultToc);

// =============================================================================================
// Label / Ref (R18e)
// =============================================================================================

/**
 * The default `Label`: a position marker (`mark("label", {key})`) that renders nothing. The key is
 * the authored `id` prop (R20b — the `<sec:intro>` sugar sets it); children are ignored.
 */
export function DefaultLabel(props: CompProps): unknown {
  const id = typeof props.id === "string" ? props.id.trim() : "";
  if (id === "") {
    throw new Error(
      '@Label: missing id (e.g. @Label[id: "sec:intro"]{}, or the <sec:intro> sugar)'
    );
  }
  return mark("label", { key: id });
}

/** The ambient `Label` slot. */
export const Label = slot("Label", DefaultLabel);

/**
 * The default `Ref`: a `query` resolving the `id` prop (R20b — the `&sec:intro` sugar sets it),
 * first against **definitions** (`@Definition[id: …]` — rendering a tooltip-wired
 * `<a data-nota-def>` carrying the definition's label; see ./def.ts), then against `@Label`s,
 * binding to the nearest **preceding** heading (LaTeX semantics — by `pos`) and linking to its id.
 * Authored children override the link content on every path. Pointed errors: missing/empty `id`,
 * no definition or label for the key, duplicates, or no heading precedes the label. Heading link
 * text is the section number when the target is numbered, else its title text.
 */
export function DefaultRef(props: CompProps): unknown {
  const key = typeof props.id === "string" ? props.id.trim() : "";
  if (key === "") {
    throw new Error(
      '@Ref: missing id (e.g. @Ref[id: "sec:intro"]{}, or the &sec:intro sugar)'
    );
  }
  const children = normChildren(props.children);
  return query(doc => {
    const def = definitionFor(doc, key);
    if (def !== undefined) {
      return h(
        "a",
        {
          href: `#def-${key}`,
          class: "nota-ref nota-def-ref",
          "data-nota-def": key
        },
        definitionRefLabel(def, children)
      );
    }
    const labels = doc.all("label").filter(e => e.data.key === key);
    if (labels.length === 0) {
      throw new Error(`@Ref: no @Definition or @Label found for key "${key}"`);
    }
    if (labels.length > 1) {
      throw new Error(`@Ref: duplicate @Label for key "${key}"`);
    }
    const label = labels[0];
    const preceding = doc.all("heading").filter(e => e.pos < label.pos);
    if (preceding.length === 0) {
      throw new Error(
        `@Ref: no heading precedes @Label "${key}" (a ref binds to the nearest preceding heading)`
      );
    }
    // all() is document (pos) order → the last preceding entry is the nearest.
    const target = preceding[preceding.length - 1];
    const ids = headingIds(doc);
    const nums = headingNumbers(doc);
    const id = ids.get(target) as string;
    const num = nums.get(target);
    const content: VNode[] =
      children.length > 0
        ? children
        : num !== undefined
          ? [num]
          : [textContent((target.data as HeadingData).title)];
    return h("a", { href: `#${id}` }, content);
  });
}

/** The ambient `Ref` slot. */
export const Ref = slot("Ref", DefaultRef);

// =============================================================================================
// Footnotes (R18d/e, R20b) — labeled (Markdown) definitions/references + anonymous one-shots
// =============================================================================================

/**
 * The resolved footnote model for one {@link DocIndex} (R20b — Markdown labeled-footnote semantics).
 * **One number per distinct referenced label**, assigned by the *first-appearance order of references*
 * (kind-`"footnote"` marks in `pos` order); repeated references to a label share its number/href. An
 * anonymous `@Footnote{…}` one-shot is a fresh synthetic label (keyed by its own entry identity), so
 * it always takes the next number and is its own sole reference. Definitions (`"footnote-text"` marks)
 * carry no number and their document position is irrelevant (definition-before-reference works).
 */
interface FootnoteModel {
  /** The number assigned to each footnote *reference* entry (kind `"footnote"`). */
  readonly numberOf: Map<IndexedMark, number>;
  /** The first reference entry for each number — it alone carries the `fnref-N` id (v1 backlink). */
  readonly firstRef: Map<number, IndexedMark>;
  /** One list entry per number in order; `content` is the (already-normalized) rendered body. */
  readonly entries: { num: number; content: VNode[] }[];
}

const footnoteMemo = new WeakMap<DocIndex, FootnoteModel>();

/** Coerce a mark's stored `content` (array | single node | absent) to a fresh child array. */
function contentChildren(content: unknown): VNode[] {
  return Array.isArray(content)
    ? [...(content as VNode[])]
    : content != null
      ? [content as VNode]
      : [];
}

/**
 * Build (and memoize per index — matching the heading id/number memo pattern) the
 * {@link FootnoteModel}. Pointed errors (naming the label): a **duplicate** `@FootnoteText` for one
 * label; a labeled reference with **no** `@FootnoteText`. An **unreferenced** definition is dropped
 * silently (Markdown draft semantics — never looked up below).
 */
function footnoteModel(doc: DocIndex): FootnoteModel {
  return memoize(footnoteMemo, doc, () => {
    // Definitions: label → content (a duplicate is a pointed error).
    const defs = new Map<string, VNode[]>();
    for (const e of doc.all("footnote-text")) {
      const label = e.data.label as string;
      if (defs.has(label)) {
        throw new Error(
          `@FootnoteText: duplicate definition for footnote "${label}"`
        );
      }
      defs.set(label, contentChildren(e.data.content));
    }
    // References (pos order): number by first appearance of a distinct label; anonymous one-shots
    // are keyed by their own entry identity, so each takes a fresh number.
    const numberOf = new Map<IndexedMark, number>();
    const firstRef = new Map<number, IndexedMark>();
    const numberByKey = new Map<unknown, number>();
    let next = 1;
    for (const e of doc.all("footnote")) {
      const label = e.data.label;
      const key = typeof label === "string" && label !== "" ? label : e;
      let num = numberByKey.get(key);
      if (num === undefined) {
        num = next;
        next += 1;
        numberByKey.set(key, num);
        firstRef.set(num, e);
      }
      numberOf.set(e, num);
    }
    // One list entry per number, in order: the definition body for a labeled reference (missing =
    // pointed error), else the anonymous one-shot's own inline content.
    const entries: { num: number; content: VNode[] }[] = [];
    for (let num = 1; num < next; num += 1) {
      const e = firstRef.get(num) as IndexedMark;
      const label = e.data.label;
      if (typeof label === "string" && label !== "") {
        const def = defs.get(label);
        if (def === undefined) {
          throw new Error(
            `@FootnoteMark: no @FootnoteText definition for footnote "${label}"`
          );
        }
        entries.push({ num, content: def });
      } else {
        entries.push({ num, content: contentChildren(e.data.content) });
      }
    }
    return { numberOf, firstRef, entries };
  });
}

/**
 * Render a footnote reference marker `<sup class="nota-fnref"><a>N</a></sup>` for reference mark `m`.
 * The **first** reference to a number carries `id="fnref-N"` (v1 backlinks the first reference only);
 * later references to the same label link to `#fn-N` with no id.
 */
function footnoteRef(doc: DocIndex, m: MarkLeaf): VNode {
  const entry = doc.get(m);
  const model = footnoteModel(doc);
  const num = model.numberOf.get(entry) as number;
  const anchorProps =
    model.firstRef.get(num) === entry
      ? { id: `fnref-${num}`, href: `#fn-${num}` }
      : { href: `#fn-${num}` };
  return h("sup", { class: "nota-fnref" }, [
    h("a", anchorProps, [String(num)])
  ]);
}

/**
 * The default `Footnote` (inline, anonymous one-shot — R18e): `mark("footnote", {content})` + a query
 * rendering the reference `<sup>`. It shares the labeled numbering (R20b) as a fresh synthetic label,
 * so it always takes the next number. Content is `normChildren`'d so a nested `@Cite` indexes at
 * this footnote's position.
 */
export function DefaultFootnote(props: CompProps): unknown {
  const content = normChildren(props.children);
  const m = mark("footnote", { content });
  return Fragment(
    m,
    query(doc => footnoteRef(doc, m))
  );
}

/** The ambient `Footnote` slot. */
export const Footnote = slot("Footnote", DefaultFootnote);

/**
 * The default `FootnoteMark` (inline — R20b): a **labeled reference**, `mark("footnote", {label})` +
 * the reference `<sup>` query. Repeated marks with the same `label` share one number and href. Pointed
 * error if `label` is missing/empty; a label with no `@FootnoteText` errors at render (see
 * `footnoteModel`).
 */
export function DefaultFootnoteMark(props: CompProps): unknown {
  const label = typeof props.label === "string" ? props.label.trim() : "";
  if (label === "") {
    throw new Error(
      '@FootnoteMark: missing label (e.g. @FootnoteMark[label: "n1"]{}, or the [^n1] sugar)'
    );
  }
  const m = mark("footnote", { label });
  return Fragment(
    m,
    query(doc => footnoteRef(doc, m))
  );
}

/** The ambient `FootnoteMark` slot. */
export const FootnoteMark = slot("FootnoteMark", DefaultFootnoteMark);

/**
 * The default `FootnoteText` (block — R20b): a **labeled definition**. Emits
 * `mark("footnote-text", {label, content})` (children `normChildren`'d at store time, so a
 * nested `@Cite` indexes here) and renders **nothing** in place. Pointed error if `label` is
 * missing/empty; a **duplicate** definition for one label, or a reference to it with no definition,
 * errors at render (see `footnoteModel`); an **unreferenced** definition is dropped silently.
 */
export function DefaultFootnoteText(props: CompProps): unknown {
  const label = typeof props.label === "string" ? props.label.trim() : "";
  if (label === "") {
    throw new Error(
      '@FootnoteText: missing label (e.g. @FootnoteText[label: "n1"]: …, or the "[^n1]: …" sugar)'
    );
  }
  const content = normChildren(props.children);
  return mark("footnote-text", { label, content });
}

/** The ambient `FootnoteText` slot. */
export const FootnoteText = slot("FootnoteText", DefaultFootnoteText);

/**
 * The default `FootnotesList` (block): a pure `query` rendering the footnote section (`<ol>` of
 * per-number `<li id="fn-N"><div>…content ↩</div></li>`) from the `footnoteModel`, or `null`
 * when there are no referenced footnotes. Split from placement so it can never introduce a new mark —
 * it only *reads* the index.
 *
 * **Entry content decodes as flow (R20b).** An `<li>` is contractually *tight* (§7 — it receives only
 * `groupLists`, and `consumeParaBreaks` swallows the §7 paragraph-break marker), so a multi-paragraph
 * footnote body spliced straight into the `<li>` would collapse to one run. We wrap each entry's
 * content in a `div` (a HOST_FLOW_TAG → `groupParas` runs), so a blank line inside a `[^x]:` body is a
 * real paragraph break: `<li><div><p>…</p><p>… ↩</p></div></li>`. The backlink is appended **inside**
 * the div (after the content + a space) so it joins the final paragraph run; a single-paragraph
 * footnote becomes `<li><div><p>body ↩</p></div></li>`.
 */
export function DefaultFootnotesList(_props: CompProps): unknown {
  return query(doc => {
    const { entries } = footnoteModel(doc);
    if (entries.length === 0) {
      return null;
    }
    const items = entries.map(({ num, content }) =>
      h("li", { id: `fn-${num}` }, [
        h("div", { class: "nota-fn-content" }, [
          ...content,
          " ",
          h("a", { href: `#fnref-${num}`, class: "nota-fnbacklink" }, ["↩"])
        ])
      ])
    );
    return h("section", { class: "nota-footnotes" }, [h("ol", {}, items)]);
  });
}

/** The ambient `FootnotesList` slot (a site override reaches BOTH placements — R18d). */
export const FootnotesList = slot("FootnotesList", DefaultFootnotesList);

/**
 * The default `Footnotes` (block): explicit placement of the footnote list. Emits a
 * `mark("footnotes-here")` (which suppresses the auto-append trailer — R18d) beside the list itself.
 */
export function DefaultFootnotes(_props: CompProps): unknown {
  return Fragment(mark("footnotes-here"), h(FootnotesList, {}, []));
}

/** The ambient `Footnotes` slot. */
export const Footnotes = slot("Footnotes", DefaultFootnotes);

// =============================================================================================
// Cite / Bibliography (R18e)
// =============================================================================================

const citeLabelMemo = new WeakMap<DocIndex, Map<string, number>>();

/**
 * Assign each cited key a 1-based label, validating every key against the `bibset` source (pointed
 * error naming a missing key — this is also the "no `bibset` at all" case, since the empty default
 * source contains no keys). `"numeric"` labels by first-citation order; `"alpha"` labels after
 * sorting the cited keys by (author, title). Memoized per index.
 */
function citeLabels(doc: DocIndex): Map<string, number> {
  return memoize(citeLabelMemo, doc, () => {
    const { bibSrc, bibStyle } = config();
    const orderKeys: string[] = [];
    const seen = new Set<string>();
    for (const e of doc.all("cite")) {
      const key = e.data.key as string;
      if (!seen.has(key)) {
        seen.add(key);
        orderKeys.push(key);
      }
    }
    for (const key of orderKeys) {
      if (!(key in bibSrc)) {
        throw new Error(
          `@Cite: no bibliography entry for key "${key}" (add it via bibset({ src: { "${key}": { … } } }))`
        );
      }
    }
    const ordered =
      bibStyle === "alpha"
        ? [...orderKeys].sort((a, b) => {
            const ea = bibSrc[a];
            const eb = bibSrc[b];
            const aa = ea.author ?? "";
            const ab = eb.author ?? "";
            if (aa !== ab) {
              return aa < ab ? -1 : 1;
            }
            const ta = ea.title ?? "";
            const tb = eb.title ?? "";
            return ta < tb ? -1 : ta > tb ? 1 : 0;
          })
        : orderKeys;
    const labels = new Map<string, number>();
    ordered.forEach((key, i) => {
      labels.set(key, i + 1);
    });
    return labels;
  });
}

/** Split a `@Cite` body into keys (comma-separated; multi-key supported). Pointed error if empty. */
function citeKeys(children: CompProps["children"]): string[] {
  const keys = textContent(children)
    .split(",")
    .map(s => s.trim())
    .filter(s => s !== "");
  if (keys.length === 0) {
    throw new Error(
      "@Cite: empty key (the cite's body is its key(s), e.g. @Cite{knuth84})"
    );
  }
  return keys;
}

/**
 * The default `Cite`: one `mark("cite", {key})` per key + a `query` rendering `[N]` links to the
 * bibliography. Multi-key `@Cite{a, b}` renders `[<a>1</a>, <a>2</a>]`.
 */
export function DefaultCite(props: CompProps): unknown {
  const keys = citeKeys(props.children);
  const marks = keys.map(key => mark("cite", { key }));
  const q = query(doc => {
    const labels = citeLabels(doc);
    if (keys.length === 1) {
      const key = keys[0];
      return h("a", { href: `#bib-${key}`, class: "nota-cite" }, [
        `[${labels.get(key)}]`
      ]);
    }
    const parts: VNode[] = ["["];
    keys.forEach((key, idx) => {
      if (idx > 0) {
        parts.push(", ");
      }
      parts.push(
        h("a", { href: `#bib-${key}`, class: "nota-cite" }, [
          String(labels.get(key))
        ])
      );
    });
    parts.push("]");
    return parts;
  });
  return Fragment(...marks, q);
}

/** The ambient `Cite` slot. */
export const Cite = slot("Cite", DefaultCite);

/** Render one bibliography entry's text: `"Author. Title. Year."` from present fields. */
function bibEntryChildren(key: string): VNode[] {
  const entry = config().bibSrc[key];
  const text = [entry.author, entry.title, entry.year]
    .filter(f => f != null && f !== "")
    .map(f => `${String(f)}.`)
    .join(" ");
  const children: VNode[] = text === "" ? [] : [text];
  if (entry.url != null && entry.url !== "") {
    children.push(" ", h("a", { href: entry.url }, [entry.url]));
  }
  return children;
}

/**
 * The default `Bibliography` (block): a `query` rendering the cited entries as an `<ol>` in label
 * order (`<li id="bib-key">`). Uncited source entries are omitted; a cited key missing from the
 * source is a pointed error (via `citeLabels`). Renders `null` when nothing is cited.
 */
export function DefaultBibliography(_props: CompProps): unknown {
  return query(doc => {
    const labels = citeLabels(doc);
    if (labels.size === 0) {
      return null;
    }
    const keys = [...labels.keys()].sort(
      (a, b) => (labels.get(a) as number) - (labels.get(b) as number)
    );
    const items = keys.map(key =>
      h("li", { id: `bib-${key}` }, bibEntryChildren(key))
    );
    return h("ol", { class: "nota-bibliography" }, items);
  });
}

/** The ambient `Bibliography` slot. */
export const Bibliography = slot("Bibliography", DefaultBibliography);

// =============================================================================================
// counters (R18e generic helper)
// =============================================================================================

const counterMemo = new WeakMap<
  DocIndex,
  Map<string, Map<IndexedMark, number>>
>();

/**
 * A 1-based count per mark of `kind` in document (`pos`) order, optionally resetting to 0 after each
 * `resetOn`-kind mark (the future figure/theorem numbering primitive — R18e). Memoized per index +
 * params.
 */
export function counters(
  doc: DocIndex,
  kind: string,
  opts: { resetOn?: string } = {}
): Map<IndexedMark, number> {
  const resetOn = opts.resetOn;
  const memoKey = `${kind} ${resetOn ?? ""}`;
  let perDoc = counterMemo.get(doc);
  if (perDoc === undefined) {
    perDoc = new Map();
    counterMemo.set(doc, perDoc);
  }
  const cached = perDoc.get(memoKey);
  if (cached !== undefined) {
    return cached;
  }
  // Interleave the counted + reset marks by their global pos, then sweep.
  const events: { pos: number; entry?: IndexedMark }[] = [];
  for (const e of doc.all(kind)) {
    events.push({ pos: e.pos, entry: e });
  }
  if (resetOn !== undefined) {
    for (const r of doc.all(resetOn)) {
      events.push({ pos: r.pos });
    }
  }
  events.sort((a, b) => a.pos - b.pos);
  const map = new Map<IndexedMark, number>();
  let n = 0;
  for (const ev of events) {
    if (ev.entry === undefined) {
      n = 0; // a resetOn mark: restart the count for what follows
    } else {
      n += 1;
      map.set(ev.entry, n);
    }
  }
  perDoc.set(memoKey, map);
  return map;
}
