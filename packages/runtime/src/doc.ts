/**
 * Doc-state: marks & queries (design/decode.md §Doc-state: marks & queries).
 *
 * The two-pass document constructs — table of contents, heading numbers/counters, `@ref`,
 * footnotes, citations/bibliography — need *whole-document* knowledge before their own position
 * serializes. `Doc()` already produces the **complete** vnode tree before any decoding, so forward
 * reference is a *scoping* problem, not a temporal one (one evaluation, tree passes — Scribble
 * collect/resolve, NOT two evaluations).
 *
 * This module owns the two opaque leaves and the passes that resolve them:
 *
 * - {@link mark}`(kind, data)` — a {@link MarkLeaf}: registers an index entry at its tree position,
 *   removed by {@link force}.
 * - {@link query}`(fn)` — a {@link QueryLeaf}: `fn: (doc: DocIndex) => children`, forced against the
 *   built index (its output normalized like any `h` child).
 *
 * Both survive {@link flatten}, pass through {@link struct} untouched, and are
 * runtime exports the **reader never emits** (prelude/user surface). At `▸ = true` (inside a
 * component body) both constructors throw — doc-state is a static-document construct; islands own
 * any secondary state.
 *
 * The decode pipeline at `▸ = false` (wired in `./serialize` + {@link decode}) is
 * `serialize ∘ struct ∘ force ∘ index ∘ normalize`:
 * - {@link normalize} hoists static-template expansion + transparent-fragment splicing to a
 *   whole-tree pre-pass, so the index sees marks produced *by templates*;
 * - {@link indexDoc} = one DFS collecting mark leaves into a {@link DocIndex};
 * - {@link force} = remove mark leaves and splice each query's (normalized, recursively forced)
 *   output in place — **before** grouping, so forced output participates in list/para/section
 *   grouping like authored content and none of the grouping passes ever see a doc-state leaf.
 *
 * ## Import hygiene ("guard the seams")
 * `doc.ts` may import `vnode`/`component`/`flag`/`struct`, **never** `serialize`/`h` — the decode
 * pipeline lives in `serialize.ts` (which already imports `struct`), so `doc.ts` never depends on
 * it. The `vnode ↔ doc` and `struct ↔ doc` edges are cycles, but every cross-module binding is used
 * only inside a function body (never at module-init), so ESM live bindings resolve them safely.
 */

import { flag } from "./flag.js";
import { isRaw } from "./raw.js";
import { normalize } from "./struct.js";
import {
  type ChildArg,
  type ElementVNode,
  FRAG,
  flatten,
  isElement,
  type VNode
} from "./vnode.js";

// ---------------------------------------------------------------------------------------------
// The two opaque leaves (RawHtml-style: private symbol brand + guard)
// ---------------------------------------------------------------------------------------------

/** Brand key tagging a {@link MarkLeaf} (private symbol → no accidental collision). */
const MARK: unique symbol = Symbol("nota.mark");
/** Brand key tagging a {@link QueryLeaf}. */
const QUERY: unique symbol = Symbol("nota.query");

/**
 * A **mark leaf**: an index entry registered at its tree position. The mark object *is* its own
 * handle — {@link DocIndex.get} looks it up by identity — so a policy layer (the prelude's
 * `@label`/`@ref`) can hold the leaf it emitted and later resolve it against the built index.
 * {@link force} removes marks from the tree (they render nowhere).
 */
export interface MarkLeaf {
  readonly [MARK]: true;
  /** The mark's category (`"heading"`, `"footnote"`, `"cite"`, …); groups it in {@link DocIndex.all}. */
  readonly kind: string;
  /**
   * Arbitrary attached data (defaults to `{}`). A vnode-valued `data.content` field is **walked** by
   * {@link indexDoc} so marks *inside* it (e.g. footnote content) are indexed at the parent mark's
   * position — but it is **not** template-expanded (v1: a mark hidden behind an unexpanded template
   * there surfaces at force time and correctly hits the new-mark error).
   */
  readonly data: Record<string, unknown>;
}

/**
 * A **query leaf**: `fn: (doc: DocIndex) => children`, forced against the built index. {@link force}
 * replaces it with `normalize(fn(doc))`, recursively forced (a query's output may itself hold
 * queries — resolved against the same *frozen* index, so it terminates). Query output may **not**
 * introduce new marks (pointed error; no fixpoint iteration — a doc-state hard rule).
 */
export interface QueryLeaf {
  readonly [QUERY]: true;
  /** The resolver: reads the whole-document {@link DocIndex}, returns children (normalized on splice). */
  readonly fn: (doc: DocIndex) => unknown;
}

/** The shared `▸ = true` rejection message (mark/query throw inside a component body). */
const DOC_STATE_IN_ISLAND =
  "doc-state primitives are static-document constructs; islands own their own secondary state";

/**
 * Register a {@link MarkLeaf} at this tree position. `data` defaults to `{}`. Throws at `▸ = true`
 * (inside a component body): doc-state is static-document-only.
 */
export function mark(
  kind: string,
  data: Record<string, unknown> = {}
): MarkLeaf {
  if (flag()) {
    throw new Error(`mark(${JSON.stringify(kind)}): ${DOC_STATE_IN_ISLAND}`);
  }
  return { [MARK]: true, kind, data };
}

/**
 * Register a {@link QueryLeaf}: `fn` runs against the built {@link DocIndex} during {@link force}.
 * Throws at `▸ = true` (see {@link mark}).
 */
export function query(fn: (doc: DocIndex) => unknown): QueryLeaf {
  if (flag()) {
    throw new Error(`query(): ${DOC_STATE_IN_ISLAND}`);
  }
  return { [QUERY]: true, fn };
}

/** True when `v` is a {@link MarkLeaf}. */
export function isMark(v: unknown): v is MarkLeaf {
  return (
    typeof v === "object" &&
    v !== null &&
    (v as Partial<MarkLeaf>)[MARK] === true
  );
}

/** True when `v` is a {@link QueryLeaf}. */
export function isQuery(v: unknown): v is QueryLeaf {
  return (
    typeof v === "object" &&
    v !== null &&
    (v as Partial<QueryLeaf>)[QUERY] === true
  );
}

// ---------------------------------------------------------------------------------------------
// DocIndex
// ---------------------------------------------------------------------------------------------

/**
 * One resolved mark. `seq` is the per-kind 1-based ordinal (heading #3 of the headings); `pos` is
 * the global DFS ordinal — a *total* order across kinds — so a policy layer can interleave kinds by
 * position (a label binds to the nearest preceding heading by `pos`).
 */
export interface IndexedMark {
  readonly kind: string;
  readonly data: Record<string, unknown>;
  /** Per-kind 1-based ordinal (document order within the kind). */
  readonly seq: number;
  /** Global DFS ordinal (total order across all kinds). */
  readonly pos: number;
}

const EMPTY_MARKS: readonly IndexedMark[] = Object.freeze([]);

/**
 * The built document index: the whole-document knowledge a {@link query} resolves against. Built
 * once by {@link indexDoc} and frozen for the {@link force} pass.
 *
 * Surface: {@link all} (document order, empty for an unknown kind) and {@link get}
 * (identity lookup — the mark leaf object is the handle). {@link has} is the membership test
 * {@link force} uses as its new-mark guard (an internal detail of the pass, harmless on the query
 * surface).
 */
export class DocIndex {
  private readonly byMark = new Map<MarkLeaf, IndexedMark>();
  private readonly byKind = new Map<string, IndexedMark[]>();

  /** @internal — populated by {@link indexDoc} in DFS order (so {@link all} is document order). */
  _record(m: MarkLeaf, entry: IndexedMark): void {
    this.byMark.set(m, entry);
    const arr = this.byKind.get(entry.kind);
    if (arr === undefined) {
      this.byKind.set(entry.kind, [entry]);
    } else {
      arr.push(entry);
    }
  }

  /** All marks of `kind` in document order; a fresh **empty** array for an unknown kind. */
  all(kind: string): readonly IndexedMark[] {
    return this.byKind.get(kind) ?? EMPTY_MARKS;
  }

  /** The entry for a mark leaf (identity lookup). Throws a pointed error for an unindexed mark. */
  get(m: MarkLeaf): IndexedMark {
    const entry = this.byMark.get(m);
    if (entry === undefined) {
      throw new Error(
        "DocIndex.get: this mark is not in the index — the handle must be a mark leaf that appeared in the document tree this index was built from"
      );
    }
    return entry;
  }

  /** @internal — membership test; {@link force} uses it as the new-mark guard (query output may not introduce marks). */
  has(m: MarkLeaf): boolean {
    return this.byMark.has(m);
  }
}

// ---------------------------------------------------------------------------------------------
// index — one DFS collecting mark leaves in tree order
// ---------------------------------------------------------------------------------------------

/**
 * Build the {@link DocIndex} in a single DFS over `root` (which must already be
 * {@link normalize}'d, so marks produced by templates are exposed and fragments are
 * spliced). Recurses into element children **including component-boundary children** (they are
 * static tree; bodies are functions and are never invoked). Strings, {@link RawHtml}, and
 * {@link QueryLeaf} leaves are skipped. On a {@link MarkLeaf}: record its entry, then walk a
 * vnode-valued `data.content` field so marks nested there index right under the parent mark's `pos`.
 * Props (other than `data.content`) are not descended into.
 */
export function indexDoc(root: VNode): DocIndex {
  const index = new DocIndex();
  const seqByKind = new Map<string, number>();
  let pos = 0;

  const record = (m: MarkLeaf): void => {
    pos += 1;
    const seq = (seqByKind.get(m.kind) ?? 0) + 1;
    seqByKind.set(m.kind, seq);
    index._record(m, { kind: m.kind, data: m.data, seq, pos });
  };

  const walk = (node: unknown): void => {
    if (node == null || typeof node === "string") {
      return;
    }
    if (isRaw(node) || isQuery(node)) {
      return;
    }
    if (isMark(node)) {
      record(node);
      // A vnode-valued data.content is walked (marks inside footnote content index under the parent
      // mark's pos). Templates there are NOT expanded (v1 — see MarkLeaf.data).
      walkContent(node.data.content);
      return;
    }
    if (!isElement(node as VNode)) {
      return;
    }
    const el = node as ElementVNode;
    if (!Array.isArray(el.children)) {
      return;
    }
    for (const child of el.children) {
      walk(child);
    }
  };

  const walkContent = (content: unknown): void => {
    if (content == null) {
      return;
    }
    if (Array.isArray(content)) {
      for (const c of content) {
        walkContent(c);
      }
      return;
    }
    walk(content);
  };

  walk(root);
  return index;
}

// ---------------------------------------------------------------------------------------------
// force — remove marks, splice query output (both BEFORE grouping)
// ---------------------------------------------------------------------------------------------

/**
 * Resolve doc-state leaves against `doc`, rebuilding the tree (pure map over element nodes). Per
 * child:
 * - a **mark leaf in the index** → dropped (rendered nowhere);
 * - a **mark leaf not in the index** → pointed error (membership doubles as the new-mark check,
 *   since every tree mark was indexed);
 * - a **query leaf** → `normalize` each of `flatten([fn(doc)])`, then recursively force it (queries
 *   may nest; the index is frozen, so it terminates), spliced into the sibling stream.
 *
 * {@link RawHtml} leaves are opaque; props are untouched; component-boundary children are
 * descended into (they are static tree). Runs **before** grouping, so the grouping passes never see
 * a doc-state leaf.
 */
export function force(root: VNode, doc: DocIndex): VNode {
  if (isMark(root) || isQuery(root)) {
    // A leaf at the very root (edge case; normally the root is an element/FRAG): splice it out.
    const out: VNode[] = [];
    forceInto(root, doc, out);
    return out.length === 1 ? out[0] : { tag: FRAG, props: {}, children: out };
  }
  return forceNode(root, doc);
}

/** Force an element/string/raw node, rebuilding an element's children through {@link forceInto}. */
function forceNode(v: VNode, doc: DocIndex): VNode {
  if (typeof v === "string" || isRaw(v)) {
    return v;
  }
  if (!isElement(v)) {
    return v;
  }
  if (!Array.isArray(v.children)) {
    return v;
  }
  const kids: VNode[] = [];
  for (const child of v.children) {
    forceInto(child, doc, kids);
  }
  return { tag: v.tag, props: v.props, children: kids };
}

/** Resolve one child into the parent's rebuilt sibling stream `out` (marks drop; queries splice). */
function forceInto(child: VNode, doc: DocIndex, out: VNode[]): void {
  if (isMark(child)) {
    if (!doc.has(child)) {
      throw new Error(
        `force: query output introduced a new mark (kind ${JSON.stringify(child.kind)}) — query output may not create marks (no fixpoint iteration; author the mark in the document tree instead)`
      );
    }
    // In the index → drop the mark (it renders nowhere).
    return;
  }
  if (isQuery(child)) {
    const produced = flatten([child.fn(doc)] as ChildArg[]);
    for (const r of produced) {
      // Normalize each result (template expansion + fragment splicing) then recursively force (nested queries).
      forceInto(normalize(r), doc, out);
    }
    return;
  }
  out.push(forceNode(child, doc));
}

// ---------------------------------------------------------------------------------------------
// Trailer registry — the doc-end auto-append seam
// ---------------------------------------------------------------------------------------------

/**
 * Trailers: name-keyed thunks whose children `decode` appends after the document content (before
 * indexing, so trailer queries force normally). Like {@link registerComponents}, this
 * is **global-persistent** — site policy, deliberately NOT reset per `render()` (a re-register
 * replaces the same-named entry but keeps its registration position). The prelude registers
 * `"footnotes"` here.
 */
const trailers = new Map<string, () => unknown>();

/** Register (or replace) a named trailer thunk. Persistent across renders. */
export function registerTrailer(name: string, thunk: () => unknown): void {
  trailers.set(name, thunk);
}

/**
 * Clear all trailers (or just the named ones). A test/dev hook mirroring
 * {@link clearRegisteredComponents}; production registers once and never clears.
 */
export function clearTrailers(...names: string[]): void {
  if (names.length === 0) {
    trailers.clear();
    return;
  }
  for (const name of names) {
    trailers.delete(name);
  }
}

/** @internal — the decode pipeline runs each trailer thunk in registration order. */
export function runTrailers(): unknown[] {
  const out: unknown[] = [];
  for (const thunk of trailers.values()) {
    out.push(thunk());
  }
  return out;
}

/** @internal — does any trailer exist? (decode wraps the doc in a FRAG only when it does). */
export function hasTrailers(): boolean {
  return trailers.size > 0;
}
