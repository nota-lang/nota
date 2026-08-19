import { describe, expect, test } from "vitest";
import { analyze } from "../src/lib";

describe("analyze", () => {
  test("derives editor views from type-preserving TSX", () => {
    const src = "% const n: number = count();\n@p{@(user)}\n";
    const result = analyze(src);

    expect(result.code).toContain(": number");
    expect(result.ast).toContain("NotaDocument");
    expect(result.highlights.length).toBeGreaterThan(0);
    expect(result.errors).toEqual([]);

    for (const mapping of result.mappings) {
      for (let i = 0; i < mapping.sourceOffsets.length; i++) {
        const sourceOffset = mapping.sourceOffsets[i];
        const generatedOffset = mapping.generatedOffsets[i];
        const length = mapping.lengths[i];
        expect(src.slice(sourceOffset, sourceOffset + length)).toBe(
          result.code.slice(generatedOffset, generatedOffset + length)
        );
      }
    }

    const sourceOffsets = result.mappings.flatMap(m => m.sourceOffsets);
    expect(sourceOffsets).toContain(src.indexOf("count"));
    expect(sourceOffsets).toContain(src.indexOf("user"));
  });

  test("recovers an incomplete props group", () => {
    const { code, mappings, errors } = analyze("@a[");

    expect(code).toContain("<a");
    expect(errors).toHaveLength(1);
    expect(errors[0]).toMatchObject({ start: 3 });
    expect(errors[0].message).toMatch(/]/);

    const anchor = mappings.find(
      mapping => mapping.sourceOffsets[0] === 3 && mapping.lengths[0] === 0
    );
    expect(anchor?.data.completion).toBe(true);
  });

  test("caches analysis by source", () => {
    const source = "# Cached\n";
    expect(analyze(source)).toBe(analyze(source));
  });
});
