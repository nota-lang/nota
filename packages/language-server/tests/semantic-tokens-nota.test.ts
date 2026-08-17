/**
 * **Reader-driven semantic tokens** — the flattening + the token stream.
 *
 * Asserts the tinymist-style slicing: overlapping paint-order spans become non-overlapping runs, the
 * innermost overlay wins the token *type*, and the four under-layer kinds (heading / emphasis /
 * math) ride as *modifier* bits. Exercises an embedded-JS region (a `%` statement's `const`/number),
 * a heading (marker type + heading modifier on the text), and an emphasis span.
 */

import { afterEach, describe, expect, test, vi } from "vitest";
import {
  delegatedLines,
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
  test("`%` statement line: JS classes are SUPPRESSED (TextMate's source.ts owns them)", () => {
    // Delegation-aware suppression (module doc): the grammar delegates the `%` line to source.ts,
    // whose paint is richer than our coarse classes — emitting ours caused the flicker/mixed-color
    // arrow bug. The `%` sigil itself (a markup kind) still paints.
    const toks = tokensOf("% const n = () => 1\n");
    expect(toks).toContainEqual({ text: "%", type: "notaSigil", mods: [] });
    expect(toks.some(t => t.type === "keyword")).toBe(false);
    expect(toks.some(t => t.type === "number")).toBe(false);
    expect(toks.some(t => t.text === "=>")).toBe(false);
  });

  test("embedded JS in props (grammar-blind): classes DO paint — the arrow is one operator", () => {
    const toks = tokensOf("@div[onClick: () => setN(1)]{x}\n");
    expect(toks).toContainEqual({ text: "=>", type: "operator", mods: [] });
    expect(toks).toContainEqual({ text: "1", type: "number", mods: [] });
  });

  test("markup re-entry on a delegated line keeps its markup kinds", () => {
    // `@div` inside the `%` statement is exactly what source.ts mis-reads (decorator/array); the
    // reader's sigil/tag kinds must still overlay there even though the JS classes are suppressed.
    const toks = tokensOf('%let a = @div[class: "x"]{y}\n');
    expect(toks.some(t => t.text === "div" && t.type === "notaTag")).toBe(true);
    expect(toks.some(t => t.text === '"x"')).toBe(false); // js-string suppressed
  });

  test("ts-fence interior is suppressed; unknown-lang fence keeps the flat code paint", () => {
    const ts = tokensOf("```ts\nconst a = 1;\n```\n");
    expect(
      ts.some(t => t.text?.includes("const") && t.type === "notaCode")
    ).toBe(false);
    const unknown = tokensOf("```pascal\nbegin end.\n```\n");
    expect(
      unknown.some(t => t.text?.includes("begin") && t.type === "notaCode")
    ).toBe(true);
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

describe("delegatedLines (backtick-fence mirror, transliterating the reader's scan_fenced_code)", () => {
  test("a close fence with trailing content after the ticks still closes (reader allows it)", () => {
    const lines = [
      "before", // 0 — markup
      "```ts", // 1 — open, 3 ticks
      "code()", // 2 — content, delegated
      "``` and more", // 3 — close: 3 ticks + trailing content; the reader closes here
      "after" // 4 — AFTER the fence: back to markup
    ];
    const delegated = delegatedLines(lines.join("\n"));
    expect(delegated.has(1)).toBe(false); // the open (delimiter) line is never delegated
    expect(delegated.has(2)).toBe(true);
    expect(delegated.has(3)).toBe(false); // the close (delimiter) line is never delegated
    expect(delegated.has(4)).toBe(false);
  });

  test("a close fence with MORE ticks than the open still closes (reader requires only ≥)", () => {
    const lines = [
      "before", // 0
      "```ts", // 1 — open, 3 ticks
      "code()", // 2 — content, delegated
      "````", // 3 — close: 4 ticks, more than the open's 3
      "after" // 4 — AFTER the fence: back to markup
    ];
    const delegated = delegatedLines(lines.join("\n"));
    expect(delegated.has(2)).toBe(true);
    expect(delegated.has(3)).toBe(false);
    expect(delegated.has(4)).toBe(false);
  });

  test("an indented open fence is recognized, and an indented close with trailing content still closes it", () => {
    const lines = [
      "before", // 0
      "  ```ts", // 1 — open: 2-space indent + 3 ticks (reader allows leading whitespace)
      "  code()", // 2 — content, delegated
      "  ``` trailing", // 3 — close: indented + trailing content (both rules at once)
      "after" // 4 — AFTER the fence: back to markup
    ];
    const delegated = delegatedLines(lines.join("\n"));
    expect(delegated.has(2)).toBe(true);
    expect(delegated.has(3)).toBe(false);
    expect(delegated.has(4)).toBe(false);
  });

  test("negative control: fewer ticks than the open does NOT close — the fence runs to EOF", () => {
    // Guards the ">=" direction: a close needs to actually MEET the open's tick count, not just
    // be a backtick run of any length.
    const lines = [
      "````ts", // 0 — open: 4 ticks
      "code()", // 1 — content, delegated
      "```", // 2 — only 3 ticks (< 4 required): stays fence content, not a close
      "after" // 3 — the fence never closes: still fence content (unterminated-fence semantics)
    ];
    const delegated = delegatedLines(lines.join("\n"));
    expect(delegated.has(0)).toBe(false);
    expect(delegated.has(1)).toBe(true);
    expect(delegated.has(2)).toBe(true);
    expect(delegated.has(3)).toBe(true);
  });
});

describe("notaSemanticTokens without a global Buffer (browser Web Worker parity)", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  test("still produces tokens — regression for the shared pipeline's `Buffer.from` call", () => {
    // Browser Web Workers have no `Buffer` global. `notaSemanticTokens` is the pipeline both the
    // node and browser server flavors share (server-core.ts's `readerTokens` and the (dead but
    // still-imported) service-plugin path both call straight through it) — a `Buffer` reference
    // there throws under a worker, and the throw is swallowed by the last-good-cache `catch` in
    // both callers, so the browser flavor silently served an empty token list forever. Stubbing
    // `Buffer` to `undefined` around the call reproduces the worker environment without a real one.
    vi.stubGlobal("Buffer", undefined);
    const toks = notaSemanticTokens("# Title\n@p{hello *world*}\n");
    expect(toks.length).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------------------------------

describe("kind coverage (reader ↔ token-map sync)", () => {
  // The reader's kind list is the wire truth (`highlightKindNames()`); every kind must map to a
  // token when flattened alone — as an overlay type or an under-layer base+modifier. This is the
  // guard that caught `comment` and `emphasis-strike` being silently dropped after the 2026-08
  // sugar wave added them.
  test("every reader highlight kind yields a token (none silently dropped)", async () => {
    const { highlightKindNames } = await import("@nota-lang/compiler/reader");
    for (const kind of highlightKindNames()) {
      const runs = flattenSpans([{ start: 0, end: 1, kind }]);
      expect(runs.length, `kind "${kind}" produced no run`).toBeGreaterThan(0);
      expect(
        runs[0].tokenType,
        `kind "${kind}" mapped to no token type`
      ).toBeGreaterThanOrEqual(0);
    }
  });
});
