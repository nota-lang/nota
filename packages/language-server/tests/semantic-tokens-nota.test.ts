/**
 * **Reader-driven semantic tokens** (contract D2) — the flattening + the token stream.
 *
 * Asserts the tinymist-style slicing: overlapping paint-order spans become non-overlapping runs, the
 * innermost overlay wins the token *type*, and the four under-layer kinds (heading / emphasis /
 * math) ride as *modifier* bits. Exercises an embedded-JS region (a `%` statement's `const`/number),
 * a heading (marker type + heading modifier on the text), and an emphasis span.
 */

import { describe, expect, test } from "vitest";
import {
  flattenSpans,
  makeByteToPosition,
  NOTA_TOKEN_MODIFIERS,
  NOTA_TOKEN_TYPES,
  notaSemanticTokens
} from "../src/semantic-tokens";

const typeName = (i: number) => NOTA_TOKEN_TYPES[i];
const modNames = (mask: number) =>
  NOTA_TOKEN_MODIFIERS.filter((_, i) => mask & (1 << i));

/** All tokens as `{ text, type, mods }` over the source (decoding line/char back to text). */
function tokensOf(source: string) {
  const tokens = notaSemanticTokens(source);
  const lines = source.split("\n");
  return tokens.map(([line, char, length, type, mods]) => ({
    text: lines[line]?.slice(char, char + length),
    type: typeName(type),
    mods: modNames(mods)
  }));
}

describe("flattenSpans (tinymist-style slicing)", () => {
  test("non-overlapping runs; innermost overlay wins the type", () => {
    // heading under-layer [0,10) with an overlay sigil [2,3) and tag [3,5).
    const runs = flattenSpans([
      { start: 0, end: 10, kind: "heading" },
      { start: 0, end: 1, kind: "heading-marker" },
      { start: 2, end: 3, kind: "sigil" },
      { start: 3, end: 5, kind: "tag-host" }
    ]);
    // Runs are sorted, non-overlapping, and cover the boundary set.
    for (let i = 1; i < runs.length; i++) {
      expect(runs[i].start).toBeGreaterThanOrEqual(runs[i - 1].end);
    }
    // The `@` sigil run carries type notaSigil AND the heading modifier (under-layer rides).
    const sigilRun = runs.find(r => r.start === 2 && r.end === 3);
    expect(sigilRun).toBeDefined();
    expect(typeName(sigilRun!.tokenType)).toBe("notaSigil");
    expect(modNames(sigilRun!.modifiers)).toContain("notaHeading");
    // The heading-only text run (5..10) gets the base notaHeading type + heading modifier.
    const textRun = runs.find(r => r.start === 5 && r.end === 10);
    expect(textRun).toBeDefined();
    expect(typeName(textRun!.tokenType)).toBe("notaHeading");
    expect(modNames(textRun!.modifiers)).toContain("notaHeading");
  });
});

describe("makeByteToPosition (UTF-8 byte → UTF-16 position)", () => {
  test("ASCII offsets coincide; a newline advances the line", () => {
    const posAt = makeByteToPosition("ab\ncd");
    expect(posAt(0)).toEqual({ line: 0, character: 0 });
    expect(posAt(2)).toEqual({ line: 0, character: 2 });
    expect(posAt(3)).toEqual({ line: 1, character: 0 });
    expect(posAt(5)).toEqual({ line: 1, character: 2 });
  });

  test("a multibyte prefix does not misplace the column", () => {
    // "π" is 2 UTF-8 bytes but 1 UTF-16 unit; "x" then sits at byte 2, character 1.
    const posAt = makeByteToPosition("πx");
    expect(posAt(2)).toEqual({ line: 0, character: 1 });
  });
});

describe("notaSemanticTokens (end-to-end token stream)", () => {
  test("embedded-JS `%` statement: `const` is a keyword, the number a number", () => {
    const toks = tokensOf("% const n = 1\n");
    expect(toks).toContainEqual({ text: "const", type: "keyword", mods: [] });
    expect(toks).toContainEqual({ text: "1", type: "number", mods: [] });
  });

  test("heading: `#` marker + the text carries the heading modifier", () => {
    const toks = tokensOf("# Title\n");
    expect(toks).toContainEqual({
      text: "#",
      type: "notaHeadingMarker",
      mods: ["notaHeading"]
    });
    const title = toks.find(t => t.text?.includes("Title"));
    expect(title?.mods).toContain("notaHeading");
  });

  test("emphasis: the text carries the strong modifier", () => {
    const toks = tokensOf("a *bold* b\n");
    const bold = toks.find(t => t.text === "bold");
    expect(bold, JSON.stringify(toks)).toBeDefined();
    expect(bold!.mods).toContain("notaStrong");
  });

  test("a component tag is `class`; a host tag is notaTag", () => {
    const toks = tokensOf("@Aside{x} @p{y}\n");
    expect(toks.some(t => t.text === "Aside" && t.type === "class")).toBe(true);
    expect(toks.some(t => t.text === "p" && t.type === "notaTag")).toBe(true);
  });

  test("the token stream is stable (deterministic) across calls", () => {
    const src = "# H @em{x}\n$a+b$ `c`\n% let z = 2\n";
    expect(notaSemanticTokens(src)).toEqual(notaSemanticTokens(src));
  });
});
