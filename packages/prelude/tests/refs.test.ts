/** The unified reference registry's pure derivations (src/refs.ts) — no rendering. */
import { describe, expect, test } from "vitest";
import {
  type AnchorFact,
  anchorKey,
  anchorOrdinals,
  headingIds,
  headingNumbers,
  type RefFact,
  refsTo,
  refTargetKey,
  resolveAnchors,
  useNumbers
} from "../src/refs";

const heading = (title: string, pos: number, explicitId?: string): AnchorFact =>
  ({ kind: "heading", rank: 1, title, explicitId, pos }) as AnchorFact;
const anchor = (
  kind: string,
  id: string | undefined,
  pos: number
): AnchorFact => ({ kind, id, pos }) as AnchorFact;
const ref = (
  target: string | undefined,
  pos: number,
  targetPos?: number
): RefFact => ({ target, targetPos, pos }) as RefFact;

describe("resolveAnchors — the flat namespace", () => {
  test("strong ids resolve; a strong/strong collision throws with both kinds", () => {
    const res = resolveAnchors([
      anchor("label", "a", 1),
      anchor("definition", "b", 2)
    ]);
    expect(res.get("a")?.fact.kind).toBe("label");
    expect(res.get("b")?.fact.kind).toBe("definition");
    expect(() =>
      resolveAnchors([anchor("label", "x", 1), anchor("definition", "x", 2)])
    ).toThrow(/duplicate anchor id "x" \(a label and a definition\)/);
    expect(() =>
      resolveAnchors([anchor("footnote", "x", 1), anchor("footnote", "x", 2)])
    ).toThrow(/duplicate footnote anchors for id "x"/);
  });

  test("heading slugs are weak: resolvable, deduped, silently shadowed by strong", () => {
    const h1 = heading("Same", 1);
    const h2 = heading("Same", 2);
    const res = resolveAnchors([h1, h2]);
    expect(res.get("same")?.fact).toBe(h1);
    expect(res.get("same-2")?.fact).toBe(h2);
    // A strong anchor takes the id; the slug is shadowed without error.
    const shadowed = resolveAnchors([
      heading("Nota", 1),
      anchor("definition", "nota", 2)
    ]);
    expect(shadowed.get("nota")?.fact.kind).toBe("definition");
  });

  test("an explicit heading id is strong: it collides like any authored id", () => {
    expect(() =>
      resolveAnchors([heading("T", 1, "x"), anchor("label", "x", 2)])
    ).toThrow(/duplicate anchor id "x"/);
  });

  test("bib keys resolve virtually and collide with authored ids", () => {
    const res = resolveAnchors([], ["knuth84"]);
    expect(res.get("knuth84")?.fact.kind).toBe("bib");
    expect(res.get("knuth84")?.virtual).toBe(true);
    expect(() =>
      resolveAnchors([anchor("label", "knuth84", 1)], ["knuth84"])
    ).toThrow(/a label and a bibliography entry/);
  });

  test("anonymous anchors never enter the namespace", () => {
    const res = resolveAnchors([anchor("footnote", undefined, 1)]);
    expect(res.size).toBe(0);
  });
});

describe("numbering derivations", () => {
  test("useNumbers: first-use order per distinct target, filtered, with first-ref pos", () => {
    const refs = [
      ref("a", 1),
      ref("skip", 2),
      ref("b", 3),
      ref("a", 4),
      ref(undefined, 5, 99)
    ];
    const { numOf, firstRefPos } = useNumbers(refs, key => key !== "skip");
    expect(numOf.get("a")).toBe(1);
    expect(numOf.get("b")).toBe(2);
    expect(numOf.get("#99")).toBe(3);
    expect(numOf.has("skip")).toBe(false);
    expect(firstRefPos.get("a")).toBe(1);
    expect(firstRefPos.get("#99")).toBe(5);
  });

  test("anchorOrdinals: 1-based per kind in pos order", () => {
    const ords = anchorOrdinals(
      [
        anchor("figure", "f1", 2),
        anchor("label", "l", 3),
        anchor("figure", "f2", 7)
      ],
      "figure"
    );
    expect(ords.get(2)).toBe(1);
    expect(ords.get(7)).toBe(2);
    expect(ords.has(3)).toBe(false);
  });

  test("headingNumbers/headingIds over anchor facts keep the outline semantics", () => {
    const hs = [heading("A", 1), { ...heading("B", 2), rank: 3 }];
    expect(headingNumbers(hs, 6)).toEqual(["1", "1.1"]);
    expect(headingIds([heading("Same", 1), heading("Same", 2)])).toEqual([
      "same",
      "same-2"
    ]);
  });
});

describe("keys + backlink feed", () => {
  test("refTargetKey/anchorKey agree on the anonymous #pos convention", () => {
    expect(refTargetKey(ref("x", 1))).toBe("x");
    expect(refTargetKey(ref(undefined, 1, 42))).toBe("#42");
    expect(anchorKey(anchor("footnote", "x", 3))).toBe("x");
    expect(anchorKey(anchor("footnote", undefined, 3))).toBe("#3");
  });

  test("refsTo lists a target's uses in order", () => {
    const refs = [ref("a", 1), ref("b", 2), ref("a", 3)];
    expect(refsTo(refs, "a").map(r => r.pos)).toEqual([1, 3]);
    expect(refsTo(refs, "c")).toEqual([]);
  });
});
