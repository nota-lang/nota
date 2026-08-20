/**
 * Pure derivations for the unified anchor/reference registry. Authored ids are strong, heading
 * slugs are weak, bibliography keys are virtual, and anonymous anchors use their location.
 * See `design/references.md`.
 */

import type { LocatedFact, Location } from "@nota-lang/core";
import type { JSX } from "solid-js";

/** Fact-kind keys in the document snapshot. */
export const FACT_KINDS = {
  anchor: "anchor",
  ref: "ref"
} as const;

/** Built-in anchor kinds. The registry also accepts extension kinds. */
export const ANCHOR_KINDS = {
  heading: "heading",
  label: "label",
  note: "note",
  bib: "bib",
  def: "def"
} as const;

/** A referenceable target. Function fields are available only during the live render. */
export interface AnchorFact extends LocatedFact {
  kind: string;
  id?: string;
  rank?: number;
  title?: string;
  explicitId?: string;
  /** Rich reference label, available only during the live render. */
  label?: () => JSX.Element;
  href?: string;
  refPrefix?: string;
  content?: () => JSX.Element;
  bank?: () => JSX.Element;
  /** DOM id to clone when opening a tooltip for an already-rendered target. */
  bankTarget?: string;
}

/** A recorded use. Anonymous inline notes point directly to a target location. */
export interface RefFact extends LocatedFact {
  target?: string;
  targetLocation?: Location;
  page?: string;
}

/** A resolved anchor: the fact plus its *effective* id (headings: the deduped slug). */
export interface ResolvedAnchor {
  fact: AnchorFact;
  id: string;
  virtual?: boolean;
}

type HeadingData = Pick<AnchorFact, "rank" | "title" | "explicitId">;

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

/** Effective heading ids. Authored ids are fixed; derived slugs avoid them and each other. */
export function headingIds(headings: HeadingData[]): string[] {
  const authored = new Set<string>();
  for (const f of headings) {
    if (f.explicitId === undefined) continue;
    if (authored.has(f.explicitId)) {
      throw new Error(
        `nota: duplicate heading anchors for id "${f.explicitId}"`
      );
    }
    authored.add(f.explicitId);
  }

  const used = new Set(authored);
  return headings.map(f => {
    if (f.explicitId !== undefined) return f.explicitId;
    const base = slugify(f.title ?? "");
    let id = base;
    let suffix = 2;
    while (used.has(id)) {
      id = `${base}-${suffix}`;
      suffix += 1;
    }
    used.add(id);
    return id;
  });
}

/** Hierarchical section numbers. Skipped ranks collapse (`# / ###` becomes `1 / 1.1`). */
export function headingNumbers(
  headings: HeadingData[],
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

/** Resolve strong ids, virtual bibliography ids, then unshadowed heading slugs. */
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
  const headingIndex = new Map(headings.map((heading, i) => [heading, i]));
  // Strong authored ids.
  for (const a of anchors) {
    if (a.kind === ANCHOR_KINDS.heading) {
      if (a.explicitId !== undefined) {
        const i = headingIndex.get(a) as number;
        claim(hIds[i], { fact: a, id: hIds[i] });
      }
      continue;
    }
    if (typeof a.id === "string" && a.id !== "") {
      claim(a.id, { fact: a, id: a.id });
    }
  }
  // Bibliography keys resolve without registrations.
  for (const key of bibKeys) {
    claim(key, {
      fact: {
        kind: ANCHOR_KINDS.bib,
        id: key,
        location: `bib:${key}`
      },
      id: key,
      virtual: true
    });
  }
  // Derived heading slugs are silently shadowed by strong ids.
  headings.forEach((a, i) => {
    if (a.explicitId === undefined && !byId.has(hIds[i])) {
      byId.set(hIds[i], { fact: a, id: hIds[i] });
    }
  });
  return byId;
}

/** The derivation key of a ref's target: its id, or an anonymous location. */
export function refTargetKey(r: RefFact): string {
  return r.target ?? `#${r.targetLocation}`;
}

/** The derivation key of an anchor: its id, or its anonymous location. */
export function anchorKey(a: AnchorFact): string {
  return typeof a.id === "string" && a.id !== "" ? a.id : `#${a.location}`;
}

/** The recorded uses of `id`, in document order — the backlink feed. */
export function refsTo(refs: RefFact[], id: string): RefFact[] {
  return refs.filter(r => refTargetKey(r) === id);
}

/** Number selected targets by first use and record each first-use location. */
export function useNumbers(
  refs: RefFact[],
  targets: (key: string) => boolean
): { numOf: Map<string, number>; firstRefLocation: Map<string, Location> } {
  const numOf = new Map<string, number>();
  const firstRefLocation = new Map<string, Location>();
  let next = 1;
  for (const r of refs) {
    const key = refTargetKey(r);
    if (!targets(key)) {
      continue;
    }
    if (!numOf.has(key)) {
      numOf.set(key, next);
      next += 1;
      firstRefLocation.set(key, r.location);
    }
  }
  return { numOf, firstRefLocation };
}

/** Return the 1-based ordinal of each anchor of `kind`, keyed by location. */
export function anchorOrdinals(
  anchors: AnchorFact[],
  kind: string
): Map<Location, number> {
  const map = new Map<Location, number>();
  let n = 0;
  for (const a of anchorsOf(anchors, kind)) {
    n += 1;
    map.set(a.location, n);
  }
  return map;
}
