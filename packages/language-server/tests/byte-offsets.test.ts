/**
 * **`makeByteConverter`** — the package-shared UTF-8-byte-offset → UTF-16 converter (`./byte-offsets.ts`).
 *
 * Every consumer (semantic-tokens, the Volar mapping boundary, diagnostics) is covered by its own
 * fixtures; this file pins the converter itself in isolation: identity on ASCII, the two ways a
 * UTF-8/UTF-16 divergence arises (a BMP character needing 2-3 bytes but 1 UTF-16 unit, and an
 * astral character needing a UTF-16 surrogate PAIR), and that `toUtf16`/`toPosition` agree.
 */

import { describe, expect, test } from "vitest";
import { makeByteConverter } from "../src/byte-offsets";

describe("makeByteConverter — ASCII (identity)", () => {
  test("toUtf16 is the identity function", () => {
    const c = makeByteConverter("hello\nworld");
    for (let i = 0; i <= 11; i++) {
      expect(c.toUtf16(i)).toBe(i);
    }
  });

  test("toPosition tracks lines/columns exactly like a naive ASCII walk", () => {
    const c = makeByteConverter("ab\ncd");
    expect(c.toPosition(0)).toEqual({ line: 0, character: 0 });
    expect(c.toPosition(2)).toEqual({ line: 0, character: 2 });
    expect(c.toPosition(3)).toEqual({ line: 1, character: 0 });
    expect(c.toPosition(5)).toEqual({ line: 1, character: 2 });
  });
});

describe("makeByteConverter — BMP multibyte (2-3 UTF-8 bytes, 1 UTF-16 unit)", () => {
  test("a 2-byte character (é, U+00E9) shifts every following byte offset back by 1", () => {
    // "é" = 2 UTF-8 bytes, 1 UTF-16 unit; "x" therefore sits at byte 2 but UTF-16 offset 1.
    const c = makeByteConverter("éx");
    expect(c.toUtf16(0)).toBe(0);
    expect(c.toUtf16(2)).toBe(1);
    expect(c.toPosition(2)).toEqual({ line: 0, character: 1 });
  });

  test("a 3-byte character (—, U+2014 em dash) shifts every following byte offset back by 2", () => {
    const c = makeByteConverter("—x");
    expect(c.toUtf16(0)).toBe(0);
    expect(c.toUtf16(3)).toBe(1);
    expect(c.toPosition(3)).toEqual({ line: 0, character: 1 });
  });

  test("a multibyte prefix does not misplace the column (matches the semantic-tokens fixture)", () => {
    const c = makeByteConverter("πx");
    expect(c.toPosition(2)).toEqual({ line: 0, character: 1 });
  });
});

describe("makeByteConverter — astral characters (4 UTF-8 bytes, a UTF-16 surrogate pair)", () => {
  test("an astral character (😀, U+1F600) is 4 bytes / 2 UTF-16 units", () => {
    const c = makeByteConverter("😀x");
    expect(c.toUtf16(0)).toBe(0);
    // 4 UTF-8 bytes consumed by the emoji; "x" starts at UTF-16 offset 2 (the surrogate pair).
    expect(c.toUtf16(4)).toBe(2);
    expect(c.toPosition(4)).toEqual({ line: 0, character: 2 });
  });
});

describe("makeByteConverter — boundaries", () => {
  test("byte offset 0 on an empty string", () => {
    const c = makeByteConverter("");
    expect(c.toUtf16(0)).toBe(0);
    expect(c.toPosition(0)).toEqual({ line: 0, character: 0 });
  });

  test("the end-of-text byte offset resolves past the last character", () => {
    const c = makeByteConverter("café");
    const totalBytes = new TextEncoder().encode("café").length;
    expect(c.toUtf16(totalBytes)).toBe("café".length);
  });
});
