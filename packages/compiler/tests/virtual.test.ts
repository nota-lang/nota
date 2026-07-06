/**
 * `@nota-lang/compiler` — `compileVirtual` / `parseVirtualJson` tests.
 *
 * The virtual (`.tsx`) emit is what `@nota-lang/language-server` consumes: the type-preserving
 * codegen plus the Volar `CodeMapping`s. This file pins the **JSON-shape parsing** the
 * shim does over the binary's `--virtual` stdout — tested against a *hand-written* sample, since the
 * binary's `--virtual` mode is still being added to the reader and may not exist yet. If the binary
 * already speaks `--virtual`, the live path is exercised too.
 */

import { execFileSync } from "node:child_process";
import { describe, expect, test } from "vitest";
import { type CodeMapping, compileVirtual, parseVirtualJson } from "../src/lib";

/** The `--virtual` JSON, hand-built so the parse is tested independent of the binary. */
const SAMPLE_JSON = JSON.stringify({
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
});

describe("parseVirtualJson (JSON shape)", () => {
  test("parses code + mappings; preserves parallel arrays and capability flags", () => {
    const { code, mappings } = parseVirtualJson(SAMPLE_JSON);

    expect(code).toContain("export default function Doc()");
    expect(mappings).toHaveLength(2);

    const [embedded, component] = mappings as [CodeMapping, CodeMapping];

    // Embedded JS → full caps; arrays line up. (`count` sits at generated offset 60 in the sample
    // `code` above; `parseVirtualJson` passes offsets through unchanged.)
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

  test("the parsed mapping round-trips a source offset to its generated slice", () => {
    // The core mapping invariant at the parse layer: the mapping's generated offset, taken against
    // the parsed `code`, yields the same text as the source token it claims to map.
    const { code, mappings } = parseVirtualJson(SAMPLE_JSON);
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

    const json = JSON.stringify({
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
    });

    const { code: out, mappings } = parseVirtualJson(json);
    const m = mappings[0];

    // `parseVirtualJson` passes offsets through verbatim — they remain byte offsets.
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

  test("throws a clear error on invalid JSON", () => {
    expect(() => parseVirtualJson("not json", "foo.nota")).toThrow(
      /invalid JSON.*foo\.nota/s
    );
  });

  test("throws when `code` / `mappings` are absent (desynced binary)", () => {
    expect(() => parseVirtualJson(JSON.stringify({ code: "x" }))).toThrow(
      /missing `code`\/`mappings`/
    );
    expect(() => parseVirtualJson(JSON.stringify({ mappings: [] }))).toThrow(
      /missing `code`\/`mappings`/
    );
  });

  test("throws when a mapping's parallel arrays are mismatched in length", () => {
    const bad = JSON.stringify({
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
    });
    expect(() => parseVirtualJson(bad)).toThrow(/mismatched-length/);
  });
});

describe("parseVirtualJson (recovered errors — contract D5)", () => {
  test("parses an `errors` array of {message, start, len}", () => {
    const json = JSON.stringify({
      code: 'export default function Doc() { return decode(h("a", {}, [])); }\n',
      mappings: [],
      errors: [{ message: "Expected `]` but found `EOF`", start: 3, len: 0 }]
    });
    const { errors } = parseVirtualJson(json);
    expect(errors).toEqual([
      { message: "Expected `]` but found `EOF`", start: 3, len: 0 }
    ]);
  });

  test("defaults `errors` to [] when the field is absent (pre-D5 binary)", () => {
    const { errors } = parseVirtualJson(SAMPLE_JSON);
    expect(errors).toEqual([]);
  });

  test("coerces error fields defensively (numeric start/len, string message)", () => {
    const json = JSON.stringify({
      code: "",
      mappings: [],
      errors: [{ message: "x", start: 2, len: 4 }]
    });
    const { errors } = parseVirtualJson(json);
    expect(errors[0]).toEqual({ message: "x", start: 2, len: 4 });
  });
});

// ===================================================================================================
// Live path — only if the binary already implements `--virtual`. Otherwise the whole describe is
// skipped, and the parse tests above are the guarantee until the reader catches up.
// ===================================================================================================

/** Resolve the binary the same way the shim does, to probe for `--virtual` support. */
function binarySupportsVirtual(): boolean {
  const bin =
    process.env.NOTA_COMPILE_BIN && process.env.NOTA_COMPILE_BIN.length > 0
      ? process.env.NOTA_COMPILE_BIN
      : new URL(
          "../../../oxc/target/release/examples/nota_compile",
          import.meta.url
        ).pathname;
  try {
    // `--virtual` with no file → the binary should fail *about a missing file*, not about an
    // unknown flag / "usage". We treat any run that doesn't mention "usage" as flag-aware. A binary
    // that panics on `expect("usage: …")` (the pre-`--virtual` example) prints "usage".
    execFileSync(bin, ["--virtual"], { encoding: "utf8", stdio: "pipe" });
    return true;
  } catch (e) {
    const err = e as { stderr?: Buffer | string; stdout?: Buffer | string };
    const text = `${String(err.stderr ?? "")}${String(err.stdout ?? "")}`;
    return !/usage:/i.test(text);
  }
}

const liveSuite = binarySupportsVirtual() ? describe : describe.skip;

liveSuite("compileVirtual (live — binary --virtual present)", () => {
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

  test("EOF recovery: `@a[` yields the props object + anchor mapping + a diagnostic (D4/D5)", () => {
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
