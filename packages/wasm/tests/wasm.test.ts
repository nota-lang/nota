import {
  compile,
  compileVirtual,
  compileWithMappings,
  highlight,
  highlightKindNames,
  parseAst
} from "@nota-lang/wasm";
import { expect, test } from "vitest";

test("compile emits the document module (no runtime import — the integrator prepends it)", () => {
  const { code } = compile("# Hello World");
  expect(code).toContain("export default function Doc()");
  expect(code).toContain('<Heading rank={1}>{"Hello World"}</Heading>');
  expect(code).not.toContain("@nota-lang/runtime");
});

test("compile throws the rendered diagnostics on malformed input", () => {
  expect(() => compile("@em{unterminated")).toThrow(/Expected `\}`/);
});

test("parseAst returns the post-parse Nota tree as ESTree JSON with offsets", () => {
  const { ast } = parseAst("# Hi");
  const tree = JSON.parse(ast);
  expect(tree.type).toBe("Program");
  const doc = tree.body[0].expression.kind;
  expect(doc.type).toBe("NotaDocument");
  const heading = doc.items[0];
  expect(heading.type).toBe("NotaHeading");
  expect(heading.level).toBe(1);
  expect(heading.children[0]).toMatchObject({
    type: "NotaText",
    value: "Hi",
    start: 2,
    end: 4
  });
});

test("compileWithMappings returns the mapped result shape", () => {
  const { code, mappings } = compileWithMappings("# Hi");
  expect(code).toContain("export default function Doc()");
  expect(Array.isArray(mappings)).toBe(true);
});

test("compileVirtual recovers, reporting diagnostics instead of throwing", () => {
  const { code, mappings, errors } = compileVirtual("@em{unterminated");
  expect(typeof code).toBe("string");
  expect(Array.isArray(mappings)).toBe(true);
  expect(errors).toHaveLength(1);
  expect(errors[0]).toMatchObject({ message: expect.stringContaining("`}`") });
  expect(typeof errors[0].start).toBe("number");
  expect(typeof errors[0].len).toBe("number");
});

// `generatedLengths` is a Rust `Option`, which serde-wasm-bindgen serializes as `undefined` by
// default — contradicting the declared `number[] | null`. `#[tsify(missing_as_null)]` on the
// reader's result types makes the emitted value match the declaration; assert that it does, since
// only a round-trip through the real wasm can catch a regression here.
test("an absent generatedLengths arrives as null, matching its declared type", () => {
  const { mappings } = compileVirtual(
    "# Hi\n\nsome @em{text} and @Foo[x=1]{y}\n"
  );
  expect(mappings.length).toBeGreaterThan(0);
  for (const m of mappings) {
    expect(
      m.generatedLengths === null || Array.isArray(m.generatedLengths)
    ).toBe(true);
    expect(m.generatedLengths).not.toBeUndefined();
  }
});

test("highlight returns [start, end, kind] triples indexing highlightKindNames", () => {
  const flat = highlight("# Hi");
  expect(flat).toBeInstanceOf(Uint32Array);
  expect(flat.length % 3).toBe(0);
  expect(flat.length).toBeGreaterThan(0);
  const names = highlightKindNames();
  for (let i = 0; i + 2 < flat.length; i += 3) {
    expect(flat[i]).toBeLessThanOrEqual(flat[i + 1]);
    expect(flat[i + 2]).toBeLessThan(names.length);
  }
  expect(names).toContain("heading");
});
