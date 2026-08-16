/**
 * `jsxify` unit tests — the h-call → Solid JSX bridge, driven on hand-written emit shapes (the
 * reader's mechanical output patterns, pinned in design/solid.md §The pipeline). These are the
 * executable spec for reader vNext's native JSX emit.
 */
import { describe, expect, test } from "vitest";
import { jsxify } from "../src/jsxify";

const strip = (s: string) => s.replace(/\s+/g, " ").trim();

describe("jsxify: h calls", () => {
  test("host tag with props and children", () => {
    const { code } = jsxify(
      `let x = h("span", { class: "c", onClick: () => go() }, ["hi"]);`
    );
    expect(strip(code)).toBe(
      `let x = <span class="c" onClick={() => go()}>{"hi"}</span>;`
    );
  });

  test("component tag", () => {
    const { code } = jsxify(`let x = h(Colorized, {}, [y]);`);
    expect(strip(code)).toBe(`let x = <Colorized>{y}</Colorized>;`);
  });

  test("childless tag self-closes", () => {
    const { code } = jsxify(`let x = h("br", {});`);
    expect(strip(code)).toBe(`let x = <br />;`);
  });

  test("adjacent string children coalesce (the paragraph-break contract)", () => {
    const { code } = jsxify(`let x = h("p", {}, ["a", "\\n", "\\n", "b"]);`);
    expect(code).toContain(`{"a\\n\\nb"}`);
    expect((code.match(/\{"/g) ?? []).length).toBe(1);
  });

  test("list sentinels become UlLi/OlLi", () => {
    const { code, used } = jsxify(
      `let x = [h("nota-ul-li", {}, ["a"]), h("nota-ol-li", {}, ["b"])];`
    );
    expect(strip(code)).toBe(
      `let x = [<UlLi>{"a"}</UlLi>, <OlLi>{"b"}</OlLi>];`
    );
    expect(used.UlLi).toBe(true);
    expect(used.OlLi).toBe(true);
  });

  test("flow-container tags wrap their interior in <Reforest>; tight tags do not", () => {
    const { code, used } = jsxify(
      `let x = [h("blockquote", {}, ["q"]), h("p", {}, ["p"])];`
    );
    expect(strip(code)).toBe(
      `let x = [<blockquote><Reforest>{"q"}</Reforest></blockquote>, <p>{"p"}</p>];`
    );
    expect(used.Reforest).toBe(true);
  });

  test("data-/aria- props become attributes; dynamic props spread", () => {
    const { code } = jsxify(
      `let x = h("a", { "data-nota-def": key1, href: "#x" }, ["r"]);`
    );
    expect(strip(code)).toBe(
      `let x = <a data-nota-def={key1} href="#x">{"r"}</a>;`
    );
  });

  test("an unsupported tag expression throws", () => {
    expect(() => jsxify(`let x = h(tags[0], {}, []);`)).toThrow(
      /unsupported h\(\) tag/
    );
  });
});

describe("jsxify: Fragment and decode", () => {
  test("decode(Fragment(…)) becomes NotaDoc with spliced children", () => {
    const { code, used } = jsxify(
      `export default function Doc() { return decode(Fragment(h("em", {}, ["a"]), "b")); }`
    );
    expect(strip(code)).toBe(
      `export default function Doc() { return <NotaDoc><em>{"a"}</em>{"b"}</NotaDoc>; }`
    );
    expect(used.NotaDoc).toBe(true);
  });

  test("a bare Fragment becomes <>…</> (props dropped)", () => {
    const { code } = jsxify(`let x = Fragment({ key: 1 }, "a", "b");`);
    expect(strip(code)).toBe(`let x = <>{"ab"}</>;`);
  });
});

describe("jsxify: the @for shape", () => {
  test("a reader-keyed map becomes <For>", () => {
    const { code, used } = jsxify(
      `let x = decode(Fragment(xs.map((y, _i) => Fragment({ key: _i }, h("nota-ul-li", {}, [h(C, {}, [y])])))));`
    );
    expect(strip(code)).toBe(
      `let x = <NotaDoc><For each={xs}>{(y, _i) => <><UlLi><C>{y}</C></UlLi></>}</For></NotaDoc>;`
    );
    expect(used.For).toBe(true);
  });

  test("a user .map is untouched", () => {
    const { code, used } = jsxify(`let x = xs.map(y => y * 2);`);
    expect(strip(code)).toBe(`let x = xs.map(y => y * 2);`);
    expect(used.For).toBe(false);
  });
});

describe("jsxify: pass-through", () => {
  test("statements and the compat constructors survive; nested h in bodies rewrites", () => {
    const src = `export default function Doc() {
  let [color, setColor] = createSignal("red");
  let C = inlineComponent(children => {
    return h("span", { style: { color: color() } }, [children]);
  }, "C");
  return decode(Fragment(h(C, {}, ["x"])));
}`;
    const { code } = jsxify(src);
    expect(code).toContain(`createSignal("red")`);
    expect(code).toContain(`inlineComponent(`);
    expect(code).toContain(`"C")`);
    expect(strip(code)).toContain(
      `return <span style={{ color: color() }}>{children}</span>;`
    );
    expect(code).not.toMatch(/\bh\(/);
  });
});
