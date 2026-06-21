/**
 * Generated-JS formatter tests (feature: Prettier-format the stage-3 pane). We format the *real*
 * golden emit (compiled through the same wasm reader the pane uses), so the test tracks the actual
 * codegen. The formatter is display-only — it must reflow the emit (break the pathological one-line
 * `Doc()` body, drop the codegen's tabs) while preserving every token, and be a no-op on empty or
 * un-parseable input (it falls back to the raw text rather than blanking the pane).
 */

import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { beforeAll, describe, expect, it } from "vitest";
import { compileNotaRaw, ensureCompiler } from "../src/compiler";
import { formatJs } from "../src/format";
import { GOLDEN_NOTA } from "../src/golden";

beforeAll(async () => {
  const require = createRequire(import.meta.url);
  const wasmPath = require
    .resolve("nota_wasm")
    .replace(/nota_wasm\.js$/, "nota_wasm_bg.wasm");
  await ensureCompiler(readFileSync(wasmPath));
});

describe("formatJs", () => {
  it("reflows the raw emit: no tabs, no pathological long lines", async () => {
    const raw = compileNotaRaw(GOLDEN_NOTA);
    const pretty = await formatJs(raw);

    // It actually ran (a thrown Prettier would fall back to `raw` unchanged).
    expect(pretty).not.toBe(raw);
    // The codegen indents with tabs; Prettier's default is two spaces.
    expect(raw).toContain("\t");
    expect(pretty).not.toContain("\t");
    // The raw `Doc()` body is one ~110-char line; formatting breaks it under the 80-col print width.
    expect(Math.max(...raw.split("\n").map(l => l.length))).toBeGreaterThan(
      100
    );
    expect(
      Math.max(...pretty.split("\n").map(l => l.length))
    ).toBeLessThanOrEqual(85);
  });

  it("preserves every token of the emitted module", async () => {
    const pretty = await formatJs(compileNotaRaw(GOLDEN_NOTA));
    for (const token of [
      "export let Colorized = inlineComponent(",
      'useState("red")',
      // `h("span", {…}, [children])` exceeds the print width and reflows across lines, but every
      // piece survives — assert the reflow-robust fragments rather than the one-line call shape.
      '"span"',
      'onClick: () => setColor("green")',
      "decode(",
      "export default function Doc()",
      'h("ulli", {}',
      "h(Colorized, {}"
    ]) {
      expect(pretty).toContain(token);
    }
  });

  it("is idempotent", async () => {
    const once = await formatJs(compileNotaRaw(GOLDEN_NOTA));
    expect(await formatJs(once)).toBe(once);
  });

  it("returns empty/whitespace input unchanged (nothing to format)", async () => {
    expect(await formatJs("")).toBe("");
    expect(await formatJs("  \n ")).toBe("  \n ");
  });

  it("falls back to the input on unparseable JS rather than throwing", async () => {
    const broken = "const x = ";
    expect(await formatJs(broken)).toBe(broken);
  });
});
