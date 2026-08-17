/**
 * **Document line classification** (`../src/line-context`) — the shared fence/line-tracking walk
 * `semantic-tokens.ts` (`delegatedLines`, tested in `semantic-tokens-nota.test.ts`) and
 * `completions.ts`/`server-core.ts` (`literalFenceLines`, `statementFenceLines`) both derive from.
 * This file exercises the two exports specific to the completion-suppression/component-scanning
 * consumers — the split between "a bare `%` line" (NOT included) and "a fence interior" (included)
 * is the whole point of the split, so every case below pins one side of it.
 */

import { describe, expect, test } from "vitest";
import { literalFenceLines, statementFenceLines } from "../src/line-context";

describe("literalFenceLines", () => {
  test("excludes a bare `%` statement line", () => {
    const src = "% const x = 1\nprose\n";
    expect(literalFenceLines(src).has(0)).toBe(false);
  });

  test("includes `%%%` fence body lines but not its delimiter lines", () => {
    const src = "before\n%%%\nconst a = 1;\nconst b = 2;\n%%%\nafter\n";
    const lines = literalFenceLines(src);
    expect(lines.has(0)).toBe(false); // "before" — markup
    expect(lines.has(1)).toBe(false); // opening `%%%` delimiter
    expect(lines.has(2)).toBe(true); // body
    expect(lines.has(3)).toBe(true); // body
    expect(lines.has(4)).toBe(false); // closing `%%%` delimiter
    expect(lines.has(5)).toBe(false); // "after" — markup
  });

  test("includes a delegated-language backtick code-fence body but not an undelegated one", () => {
    const ts = "```ts\ncode()\n```\n";
    expect(literalFenceLines(ts).has(1)).toBe(true);
    const pascal = "```pascal\nbegin end.\n```\n";
    expect(literalFenceLines(pascal).has(1)).toBe(false);
  });
});

describe("statementFenceLines", () => {
  test("includes `%%%` fence body lines only — not a bare `%` line, not a code-fence body", () => {
    const src = "% const x = 1\n%%%\nconst a = 1;\n%%%\n```ts\ncode()\n```\n";
    const lines = statementFenceLines(src);
    expect(lines.has(0)).toBe(false); // bare `%` line
    expect(lines.has(2)).toBe(true); // `%%%` fence body
    expect(lines.has(5)).toBe(false); // ts code-fence body
  });
});
