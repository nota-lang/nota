/**
 * **The typed `h` overloads** (contract R22, the typed emit surface) — runtime smoke.
 *
 * The *type-level* guarantees (a wrong prop value on a known tag errors; an unknown tag stays legal;
 * a prelude-slot's real prop type flows without the old contravariant tag-assignability failure) are
 * validated end-to-end through the real editor pipeline in the language server
 * (`packages/language-server/tests/typed-surface.test.ts` — the virtual `.tsx` is type-checked by
 * the actual TS service). `depot`'s package `tsc` only covers `src/`, so a bare `@ts-expect-error`
 * here would not be enforced; this file instead pins that the overloads still build the same inert
 * vnodes at runtime (the types are fully erased — behaviour is unchanged).
 */

import { describe, expect, test } from "vitest";
import { inlineComponent } from "../src/component";
import { h } from "../src/h";

describe("typed h overloads — runtime behaviour is unchanged (types erased)", () => {
  test("known host tag builds a plain vnode", () => {
    const v = h("a", { href: "/x" }, "link");
    expect(v.tag).toBe("a");
    expect(v.props).toEqual({ href: "/x" });
    expect(v.children).toEqual(["link"]);
  });

  test("unknown / nota-* tag is legal and builds a vnode", () => {
    const v = h("nota-ul-li", {}, "item");
    expect(v.tag).toBe("nota-ul-li");
    expect(v.children).toEqual(["item"]);
  });

  test("a prelude-slot-shaped function tag records the function as the boundary tag", () => {
    const Heading: (props: { rank: number; id?: string }) => unknown = () =>
      null;
    const v = h(Heading, { rank: 1 }, "Title");
    expect(v.tag).toBe(Heading);
    expect(v.props).toEqual({ rank: 1 });
  });

  test("a component tag is recorded, not invoked, under the static build", () => {
    let invoked = false;
    const Comp = inlineComponent(children => {
      invoked = true;
      return h("span", {}, children);
    }, "Comp");
    const v = h(Comp, { color: "red" }, "child");
    expect(v.tag).toBe(Comp);
    expect(invoked).toBe(false); // ▸ = false: the boundary is recorded, body deferred
  });

  test("null props default to {}", () => {
    expect(h("p", null, "hi").props).toEqual({});
  });
});
