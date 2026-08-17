/**
 * The unified reference registry — pure derivations over two doc-state fact kinds
 * (design/references.md). Everything referenceable is an **anchor** (`{id?, kind, …data}`);
 * every use is a **ref** (`{target, …data}`); numbering, resolution, and backlinks are the
 * pure functions below, computed at read time (never baked into facts — the convergence and
 * reactive-renumbering guarantees both depend on that).
 *
 * ## The namespace
 * One flat id space across kinds. **Strong** anchors have authored ids (`@Label`,
 * `@Footnote[id]`, `@Definition`, figures, explicit heading ids); a strong/strong collision
 * throws. **Weak** anchors have derived ids (heading slugs, deduped `-N` among themselves);
 * they resolve when unshadowed and are silently shadowed by a strong anchor — a derived name
 * must never explode a document. Bib entries are **config-virtual**: `bibset({src})` keys
 * resolve as `bib`-kind anchors without a registration. Anchors may be **anonymous** (no id:
 * the inline `@Footnote{…}`) — unreferenceable, keyed by `pos` in derivations.
 */

import type { Fact } from "@nota-lang/core";
import type { JSX } from "solid-js";

/**
 * The doc-state **fact kinds** the unified registry stores — the JSON keys of the SSG
 * snapshot wire format (`@nota-lang/core`'s `Snapshot`). One named copy: other packages
 * extending the store (paper's `Figure` registers an `anchor` fact of anchor-kind `figure`)
 * import these instead of re-typing the strings.
 */
export const FACT_KINDS = {
  anchor: "anchor",
  ref: "ref"
} as const;

/** The prelude's own anchor kinds (the `kind` field of an {@link AnchorFact}); open-ended —
 * paper adds `"figure"`. */
export const ANCHOR_KINDS = {
  heading: "heading",
  label: "label",
  footnote: "footnote",
  bib: "bib",
  definition: "definition"
} as const;

/**
 * A referenceable target. JSON fields survive the snapshot; thunk-valued fields (`content`,
 * `bank`) are live-only (trailer-read). Kind-specific data rides flat on the fact:
 * - `heading`: `rank`, `title`, `explicitId?` (effective id is *derived* — slug dedup).
 * - `label`: `id` (strong).
 * - `footnote`: `id?` (strong when present; anonymous = the inline one-shot), `content`.
 * - `definition`: `id`, `labelText?`, `bank?`.
 * - generic/extension kinds (paper's `figure`): `id?`, `href?`, `refPrefix?`, `bank?` —
 *   enough JSON for the generic `Ref` arm; no renderer registry needed.
 */
export interface AnchorFact extends Fact {
  kind: string;
  id?: string;
  rank?: number;
  title?: string;
  explicitId?: string;
  labelText?: string;
  href?: string;
  refPrefix?: string;
  content?: () => JSX.Element;
  bank?: () => JSX.Element;
  pos?: number;
}

/** A recorded use. `target` is the referenced id; an anonymous fused use (the inline
 * `@Footnote{…}` marking itself) carries `targetPos` instead. */
export interface RefFact extends Fact {
  target?: string;
  targetPos?: number;
  page?: string;
  pos?: number;
}

/** A resolved anchor: the fact plus its *effective* id (headings: the deduped slug). */
export interface ResolvedAnchor {
  fact: AnchorFact;
  id: string;
  virtual?: boolean;
}

/** Slugify title text: lowercase, non-alphanumeric runs → `-`, trim edge `-`; empty → `"section"`. */
export function slugify(text: string): string {
  const s = text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return s === "" ? "section" : s;
}

/** The anchors of one kind, in document order. */
export function anchorsOf(anchors: AnchorFact[], kind: string): AnchorFact[] {
  return anchors.filter(a => a.kind === kind);
}

/** Deduplicated effective ids for the heading anchors, in document order
 * (explicit id ?? slug; `-N` dedup). */
export function headingIds(headings: AnchorFact[]): string[] {
  const ids: string[] = [];
  const seen = new Map<string, number>();
  for (const f of headings) {
    const base = f.explicitId ?? slugify(f.title ?? "");
    const n = seen.get(base);
    if (n === undefined) {
      seen.set(base, 1);
      ids.push(base);
    } else {
      seen.set(base, n + 1);
      ids.push(`${base}-${n + 1}`);
    }
  }
  return ids;
}

/**
 * Hierarchical section numbers for heading anchors of rank ≤ `depth` (`undefined` beyond it;
 * all `undefined` when depth = 0). The standard outline algorithm over a rank-stack: a deeper
 * heading opens a level, an equal-rank one increments, a shallower one pops — skipped ranks
 * collapse gracefully (`# / ###` → `1 / 1.1`).
 */
export function headingNumbers(
  headings: AnchorFact[],
  depth: number
): (string | undefined)[] {
  const nums: (string | undefined)[] = [];
  const stack: { rank: number; count: number }[] = [];
  for (const f of headings) {
    const rank = f.rank ?? 1;
    if (depth <= 0 || rank > depth) {
      nums.push(undefined);
      continue;
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
    nums.push(stack.map(s => s.count).join("."));
  }
  return nums;
}

/**
 * Resolve the id namespace: strong anchors (authored ids — including explicit heading ids)
 * with duplicate detection, then virtual `bib` anchors from `bibKeys`, then unshadowed weak
 * heading slugs. Returns the id → anchor map. Throws on a strong/strong or strong/bib
 * collision, naming both kinds — more facts never fix a duplicate, so this throws wherever
 * it is derived (seeded or not).
 */
export function resolveAnchors(
  anchors: AnchorFact[],
  bibKeys: string[] = []
): Map<string, ResolvedAnchor> {
  const byId = new Map<string, ResolvedAnchor>();
  const claim = (id: string, entry: ResolvedAnchor) => {
    const prior = byId.get(id);
    if (prior !== undefined) {
      const kindOf = (e: ResolvedAnchor) =>
        e.virtual ? "bibliography entry" : e.fact.kind;
      const a = kindOf(prior);
      const b = kindOf(entry);
      throw new Error(
        a === b
          ? `nota: duplicate ${a} anchors for id "${id}"`
          : `nota: duplicate anchor id "${id}" (a ${a} and a ${b})`
      );
    }
    byId.set(id, entry);
  };
  const headings = anchorsOf(anchors, ANCHOR_KINDS.heading);
  const hIds = headingIds(headings);
  // Strong: authored ids. A heading's *explicit* id is strong; its slot in the deduped slug
  // sequence is claimed under the effective id (identical unless another heading collided).
  for (const a of anchors) {
    if (a.kind === ANCHOR_KINDS.heading) {
      if (a.explicitId !== undefined) {
        const i = headings.indexOf(a);
        claim(hIds[i], { fact: a, id: hIds[i] });
      }
      continue;
    }
    if (typeof a.id === "string" && a.id !== "") {
      claim(a.id, { fact: a, id: a.id });
    }
  }
  // Virtual: bibliography keys resolve without a registration.
  for (const key of bibKeys) {
    claim(key, {
      fact: { kind: ANCHOR_KINDS.bib, id: key },
      id: key,
      virtual: true
    });
  }
  // Weak: derived heading slugs — resolvable when unshadowed, silently shadowed otherwise.
  headings.forEach((a, i) => {
    if (a.explicitId === undefined && !byId.has(hIds[i])) {
      byId.set(hIds[i], { fact: a, id: hIds[i] });
    }
  });
  return byId;
}

/** The derivation key of a ref's target: its id, or `#pos` for an anonymous fused use. */
export function refTargetKey(r: RefFact): string {
  return r.target ?? `#${r.targetPos}`;
}

/** The derivation key of an anchor: its id, or `#pos` when anonymous. */
export function anchorKey(a: AnchorFact): string {
  return typeof a.id === "string" && a.id !== "" ? a.id : `#${a.pos}`;
}

/** The recorded uses of `id`, in document order — the backlink feed. */
export function refsTo(refs: RefFact[], id: string): RefFact[] {
  return refs.filter(r => refTargetKey(r) === id);
}

/**
 * Use-order numbering: one 1-based number per distinct target, by **first-reference order**,
 * over the refs selected by `targets` (the caller filters to one anchor kind by resolving
 * each ref). Repeated references to one anchor share the number. Returns the number per
 * target key and the `pos` of each target's first (backlink-carrying) ref.
 */
export function useNumbers(
  refs: RefFact[],
  targets: (key: string) => boolean
): { numOf: Map<string, number>; firstRefPos: Map<string, number> } {
  const numOf = new Map<string, number>();
  const firstRefPos = new Map<string, number>();
  let next = 1;
  for (const r of refs) {
    const key = refTargetKey(r);
    if (!targets(key)) {
      continue;
    }
    if (!numOf.has(key)) {
      numOf.set(key, next);
      next += 1;
      firstRefPos.set(key, r.pos as number);
    }
  }
  return { numOf, firstRefPos };
}

/**
 * Anchor-order numbering: the 1-based ordinal of each anchor of `kind`, keyed by `pos`
 * (figures "Figure 3"; the future theorem/listing counter).
 */
export function anchorOrdinals(
  anchors: AnchorFact[],
  kind: string
): Map<number, number> {
  const map = new Map<number, number>();
  let n = 0;
  for (const a of anchorsOf(anchors, kind)) {
    n += 1;
    map.set(a.pos as number, n);
  }
  return map;
}

/**
 * A 1-based count per fact of a kind in document (`pos`) order, keyed by `pos`, resetting
 * after each `resetFacts` fact — the generic sectioned-counter helper (kept from the
 * pre-unification prelude; `anchorOrdinals` is its no-reset special case).
 */
export function counters(
  facts: Fact[],
  resetFacts: Fact[] = []
): Map<number, number> {
  const events: { pos: number; count: boolean }[] = [
    ...facts.map(f => ({ pos: f.pos as number, count: true })),
    ...resetFacts.map(f => ({ pos: f.pos as number, count: false }))
  ].sort((a, b) => a.pos - b.pos);
  const map = new Map<number, number>();
  let n = 0;
  for (const ev of events) {
    if (!ev.count) {
      n = 0;
    } else {
      n += 1;
      map.set(ev.pos, n);
    }
  }
  return map;
}
