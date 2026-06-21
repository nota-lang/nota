/**
 * Injector + `▸` lifecycle: the `▸` flag's save/restore
 * (`withFlag`), the "no adapter injected" throw, and the one-adapter singleton (`setAdapter`/
 * `getAdapter`/`clearAdapter`). No framework — a trivial fake adapter suffices.
 */

import { afterEach, describe, expect, test } from "vitest";

import {
  type Adapter,
  clearAdapter,
  Fragment,
  flag,
  getAdapter,
  h,
  setAdapter,
  withFlag
} from "../src/lib";

const fakeA: Adapter = {
  h: () => "A.h",
  Fragment: () => "A.Fragment",
  renderToString: () => "A",
  hydrate: () => {}
};
const fakeB: Adapter = {
  h: () => "B.h",
  Fragment: () => "B.Fragment",
  renderToString: () => "B",
  hydrate: () => {}
};

afterEach(() => clearAdapter());

// =============================================================================================
// ▸ save / restore
// =============================================================================================

describe("withFlag (▸ save/restore)", () => {
  test("default ▸ is false", () => {
    expect(flag()).toBe(false);
  });

  test("withFlag(true, …) sets ▸ inside and restores after", () => {
    expect(flag()).toBe(false);
    const inside = withFlag(true, () => flag());
    expect(inside).toBe(true);
    expect(flag()).toBe(false); // restored
  });

  test("nesting restores the *previous* value, not a hard false", () => {
    withFlag(true, () => {
      expect(flag()).toBe(true);
      withFlag(false, () => expect(flag()).toBe(false));
      expect(flag()).toBe(true); // restored to the enclosing true, not false
    });
    expect(flag()).toBe(false);
  });

  test("▸ is restored even when the thunk throws", () => {
    expect(() =>
      withFlag(true, () => {
        throw new Error("boom");
      })
    ).toThrow("boom");
    expect(flag()).toBe(false); // restored despite the throw
  });

  test("withFlag returns the thunk's result", () => {
    expect(withFlag(true, () => 42)).toBe(42);
  });
});

// =============================================================================================
// no adapter injected
// =============================================================================================

describe("no adapter injected", () => {
  test("getAdapter() throws a pointed error when none is set", () => {
    clearAdapter();
    expect(() => getAdapter()).toThrow(/no adapter injected/);
  });

  test("h/Fragment under ▸=true with no adapter throw the same pointed error", () => {
    clearAdapter();
    expect(() => withFlag(true, () => h("p", {}, "x"))).toThrow(
      /no adapter injected/
    );
    expect(() => withFlag(true, () => Fragment("x"))).toThrow(
      /no adapter injected/
    );
  });

  test("under ▸=false, h/Fragment never touch the adapter (build inert vnodes)", () => {
    clearAdapter();
    expect(h("p", {}, "x")).toMatchObject({ tag: "p", children: ["x"] });
    expect(Fragment("x")).toMatchObject({ children: ["x"] });
  });
});

// =============================================================================================
// one-adapter singleton
// =============================================================================================

describe("singleton adapter", () => {
  test("getAdapter returns the set adapter; h/Fragment dispatch through it", () => {
    setAdapter(fakeA);
    expect(getAdapter()).toBe(fakeA);
    expect(withFlag(true, () => h("p", {}, "x"))).toBe("A.h");
    expect(withFlag(true, () => Fragment("x"))).toBe("A.Fragment");
  });

  test("setAdapter replaces the previous adapter (last write wins)", () => {
    setAdapter(fakeA);
    setAdapter(fakeB);
    expect(getAdapter()).toBe(fakeB);
    expect(withFlag(true, () => h("p", {}, "x"))).toBe("B.h");
  });

  test("clearAdapter unsets it (back to throwing)", () => {
    setAdapter(fakeA);
    clearAdapter();
    expect(() => getAdapter()).toThrow(/no adapter injected/);
  });
});
