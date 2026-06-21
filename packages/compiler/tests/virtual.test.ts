/**
 * `@nota-lang/compiler` — `compileVirtual` / `parseVirtualJson` tests (contract §9, impl §5.1/§5.3).
 *
 * The virtual (`.tsx`) emit is what `@nota-lang/language-server` consumes: the type-preserving
 * codegen tail (H2) + the Volar `CodeMapping`s (H1). This file pins the **JSON-shape parsing** the
 * shim does over the binary's `--virtual` stdout (contract §9) — tested against a *hand-written*
 * sample, since the binary's `--virtual` mode is being added by a parallel oxc stream and may not
 * exist yet. If the binary already speaks `--virtual`, the live path is exercised too.
 */

import { describe, expect, test } from "vitest";
import {
  type CodeMapping,
  compileVirtual,
  parseVirtualJson
} from "../src/lib";

/** The contract §9 `--virtual` JSON, hand-built so the parse is tested independent of the binary. */
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

describe("parseVirtualJson (contract §9 shape)", () => {
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
    // The headline H1 invariant at the parse layer: the mapping's generated offset, taken against
    // the parsed `code`, yields the same text as the source token it claims to map.
    const { code, mappings } = parseVirtualJson(SAMPLE_JSON);
    const m = mappings[0];
    const gen = code.slice(
      m.generatedOffsets[0],
      m.generatedOffsets[0] + m.lengths[0]
    );
    expect(gen).toBe("count");
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
    expect(() =>
      parseVirtualJson(JSON.stringify({ mappings: [] }))
    ).toThrow(/missing `code`\/`mappings`/);
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

// ===================================================================================================
// Live path — only if the binary already implements `--virtual` (parallel oxc stream). Otherwise the
// whole describe is skipped, and the parse tests above are the contract guarantee until sync.
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

    // H2: the TS annotation survives (no strip step).
    expect(code).toContain(": number");

    // H1: every segment round-trips byte-for-byte against the bare virtual code (no preamble here).
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
});
