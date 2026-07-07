/**
 * `@nota-lang/compiler` — `compileVirtual` / `validateVirtual` tests.
 *
 * The virtual (`.tsx`) emit is what `@nota-lang/language-server` consumes: the type-preserving
 * codegen plus the Volar `CodeMapping`s. This file pins the **shape validation** guarding the wasm
 * entry's return value against hand-written samples, and drives the live wasm reader.
 */

import { describe, expect, test } from "vitest";
import { type CodeMapping, compileVirtual, validateVirtual } from "../src/lib";

/** A hand-built virtual-emit object, so the validation is tested independent of the reader. */
const SAMPLE = {
  code: 'export default function Doc() {\n  return decode(h("p", {}, [count]));\n}\n',
  mappings: [
    {
      // `count` (an embedded interpolation) — full caps. Generated offset 60 is the byte index of
      // "count" in `code` above (kept consistent so the round-trip test below holds).
      sourceOffsets: [5],
      generatedOffsets: [60],
      lengths: [5],
      generatedLengths: null,
      data: {
        completion: true,
        format: true,
        navigation: true,
        semantic: true,
        structure: true,
        verification: true
      }
    },
    {
      // `Aside` (a component identifier) — navigation/hover only.
      sourceOffsets: [20],
      generatedOffsets: [40],
      lengths: [5],
      generatedLengths: null,
      data: {
        completion: false,
        format: false,
        navigation: true,
        semantic: true,
        structure: false,
        verification: true
      }
    }
  ]
};

// The validator mutates nothing, but hand each call a fresh deep copy anyway (JSON round-trip)
// so one test's input can't leak shape changes into another's.
const sample = () => JSON.parse(JSON.stringify(SAMPLE));

describe("validateVirtual (shape)", () => {
  test("passes code + mappings through; preserves parallel arrays and capability flags", () => {
    const { code, mappings } = validateVirtual(sample());

    expect(code).toContain("export default function Doc()");
    expect(mappings).toHaveLength(2);

    const [embedded, component] = mappings as [CodeMapping, CodeMapping];

    // Embedded JS → full caps; arrays line up. (`count` sits at generated offset 60 in the sample
    // `code` above; `validateVirtual` passes offsets through unchanged.)
    expect(embedded.sourceOffsets).toEqual([5]);
    expect(embedded.generatedOffsets).toEqual([60]);
    expect(embedded.lengths).toEqual([5]);
    expect(embedded.generatedLengths).toBeNull();
    expect(embedded.data).toEqual({
      completion: true,
      format: true,
      navigation: true,
      semantic: true,
      structure: true,
      verification: true
    });

    // Component identifier → navigation/hover only (completion/format/structure off).
    expect(component.data.navigation).toBe(true);
    expect(component.data.semantic).toBe(true);
    expect(component.data.verification).toBe(true);
    expect(component.data.completion).toBe(false);
    expect(component.data.format).toBe(false);
    expect(component.data.structure).toBe(false);
  });

  test("normalizes an `undefined` generatedLengths to null (serde-wasm-bindgen None)", () => {
    const raw = sample();
    delete raw.mappings[0].generatedLengths; // arrives as `undefined` from the wasm boundary
    const { mappings } = validateVirtual(raw);
    expect(mappings[0].generatedLengths).toBeNull();
  });

  test("the validated mapping round-trips a source offset to its generated slice", () => {
    // The core mapping invariant at the shim boundary: the mapping's generated offset, taken
    // against the returned `code`, yields the same text as the source token it claims to map.
    const { code, mappings } = validateVirtual(sample());
    const m = mappings[0];
    const gen = code.slice(
      m.generatedOffsets[0],
      m.generatedOffsets[0] + m.lengths[0]
    );
    expect(gen).toBe("count");
  });

  test("offsets are UTF-8 byte offsets, not UTF-16 string indices (non-ASCII)", () => {
    // Regression guard for the byte-vs-UTF-16 offset contract. The reader emits offsets in UTF-8
    // *bytes* (Rust string indexing), but JS strings index in UTF-16 code units. For ASCII the two
    // coincide; for any non-ASCII glyph they diverge, and a consumer that slices the generated
    // string with a byte offset via `String.prototype.slice` mis-maps. This pins the unit so that a
    // future conversion to UTF-16 indices at the shim boundary is a deliberate, test-visible change.
    const code = "// café\ncount"; // "café" — é is 1 UTF-16 unit but 2 UTF-8 bytes.
    const byteOffset = Buffer.byteLength("// café\n", "utf8"); // 9 — the byte index of "count"
    const utf16Index = "// café\n".length; // 8 — the UTF-16 index of "count"
    expect(byteOffset).toBe(9);
    expect(utf16Index).toBe(8);

    const raw = {
      code,
      mappings: [
        {
          sourceOffsets: [0],
          generatedOffsets: [byteOffset],
          lengths: [5],
          generatedLengths: null,
          data: {
            completion: true,
            format: true,
            navigation: true,
            semantic: true,
            structure: true,
            verification: true
          }
        }
      ]
    };

    const { code: out, mappings } = validateVirtual(raw);
    const m = mappings[0];

    // `validateVirtual` passes offsets through verbatim — they remain byte offsets.
    expect(m.generatedOffsets[0]).toBe(byteOffset);

    // Slicing as UTF-8 bytes recovers the mapped token...
    const byteSlice = Buffer.from(out, "utf8")
      .subarray(m.generatedOffsets[0], m.generatedOffsets[0] + m.lengths[0])
      .toString("utf8");
    expect(byteSlice).toBe("count");

    // ...but slicing the JS string (UTF-16) with the same byte offset does NOT — the leading
    // multi-byte glyph shifts the byte offset one past the true UTF-16 index. This is the documented
    // gap that consumers (the language-server preamble shift, the byte-offset round-trip below) must
    // account for once documents contain non-ASCII. Flip this assertion to `.toBe("count")` when the
    // shim is taught to convert byte offsets to UTF-16 indices.
    expect(
      out.slice(m.generatedOffsets[0], m.generatedOffsets[0] + m.lengths[0])
    ).not.toBe("count");
  });

  test("throws when `code` / `mappings` are absent (desynced wasm build)", () => {
    expect(() =>
      validateVirtual({ code: "x" } as Parameters<typeof validateVirtual>[0])
    ).toThrow(/missing `code`\/`mappings`/);
    expect(() =>
      validateVirtual({
        mappings: []
      } as unknown as Parameters<typeof validateVirtual>[0])
    ).toThrow(/missing `code`\/`mappings`/);
  });

  test("throws when a mapping's parallel arrays are mismatched in length", () => {
    const bad = {
      code: "x",
      mappings: [
        {
          sourceOffsets: [0, 1],
          generatedOffsets: [0], // length mismatch
          lengths: [1, 1],
          generatedLengths: null,
          data: {
            completion: true,
            format: true,
            navigation: true,
            semantic: true,
            structure: true,
            verification: true
          }
        }
      ]
    };
    expect(() => validateVirtual(bad)).toThrow(/mismatched-length/);
  });
});

describe("validateVirtual (recovered errors)", () => {
  test("passes an `errors` array of {message, start, len} through", () => {
    const raw = {
      code: 'export default function Doc() { return decode(h("a", {}, [])); }\n',
      mappings: [],
      errors: [{ message: "Expected `]` but found `EOF`", start: 3, len: 0 }]
    };
    const { errors } = validateVirtual(raw);
    expect(errors).toEqual([
      { message: "Expected `]` but found `EOF`", start: 3, len: 0 }
    ]);
  });

  test("defaults `errors` to [] when the field is absent (build predating recovered errors)", () => {
    const { errors } = validateVirtual(sample());
    expect(errors).toEqual([]);
  });

  test("coerces error fields defensively (numeric start/len, string message)", () => {
    const raw = {
      code: "",
      mappings: [],
      errors: [{ message: "x", start: 2, len: 4 }]
    };
    const { errors } = validateVirtual(raw);
    expect(errors[0]).toEqual({ message: "x", start: 2, len: 4 });
  });
});

// ===================================================================================================
// Live path — the in-process wasm reader.
// ===================================================================================================

describe("compileVirtual (live — wasm reader)", () => {
  test("emits a type-preserving virtual .tsx and byte-exact mappings", () => {
    const src = "% const n: number = count();\n@p{@(user)}\n";
    const { code, mappings } = compileVirtual(src, { sourcePath: "live.nota" });

    // The TS annotation survives (no strip step).
    expect(code).toContain(": number");

    // Every segment round-trips byte-for-byte against the bare virtual code (no preamble here).
    for (const m of mappings) {
      for (let k = 0; k < m.sourceOffsets.length; k++) {
        const so = m.sourceOffsets[k];
        const go = m.generatedOffsets[k];
        const len = m.lengths[k];
        expect(src.slice(so, so + len)).toBe(code.slice(go, go + len));
      }
    }

    // `count` and `user` are embedded → mapped with full caps.
    const flatSrcOffsets = mappings.flatMap(m => m.sourceOffsets);
    expect(flatSrcOffsets).toContain(src.indexOf("count"));
    expect(flatSrcOffsets).toContain(src.indexOf("user"));
  });

  test("a well-formed file recovers with no errors", () => {
    const { errors } = compileVirtual("@p{hi}\n", { sourcePath: "ok.nota" });
    expect(errors).toEqual([]);
  });

  test("EOF recovery: `@a[` yields the props object + anchor mapping + a diagnostic", () => {
    const { code, mappings, errors } = compileVirtual("@a[", {
      sourcePath: "broken.nota"
    });

    // The virtual still contains the props object literal (recovered `h("a", {}, …)`).
    expect(code).toContain('h("a", {');

    // A syntax diagnostic is reported (not swallowed), spanning into the `.nota`.
    expect(errors.length).toBe(1);
    expect(errors[0].message).toMatch(/]/);
    expect(errors[0].start).toBe(3); // just after `[`

    // The prop-completion anchor: a zero-width mapping at source offset 3 with `completion`.
    const anchor = mappings.find(
      m => m.sourceOffsets[0] === 3 && m.lengths[0] === 0
    );
    expect(anchor, JSON.stringify(mappings)).toBeDefined();
    expect(anchor?.data.completion).toBe(true);
  });
});
