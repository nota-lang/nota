/**
 * Output-pane formatter tests. We format the *real* artifacts the panes show — the emitted JS
 * and the SSG HTML, both produced by the same wasm reader + runtime the app uses — so the
 * tests track the actual codegen/serializer. Formatting is display-only: it must reflow the output
 * (break the one-line `Doc()` body / indent the unindented HTML) while preserving every token, and be
 * a no-op on empty or un-parseable input (it falls back to the raw text rather than blanking a pane).
 */

import { describe, expect, it } from "vitest";
import { formatCode } from "../src/format";
import { GOLDEN_NOTA } from "../src/golden";
import { runSSG } from "../src/ssg";
import { compileNota, compileNotaRaw } from "./util";

describe("formatCode (babel) — Generated JS", () => {
  it("reflows the raw emit: no tabs, no pathological long lines", async () => {
    const raw = compileNotaRaw(GOLDEN_NOTA);
    const pretty = await formatCode(raw, "babel");

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
    const pretty = await formatCode(compileNotaRaw(GOLDEN_NOTA), "babel");
    for (const token of [
      // The component binding is document-local (inside Doc, no export).
      "let Colorized = inlineComponent(",
      'useState("red")',
      // `h("span", {…}, [children])` exceeds the print width and reflows across lines, but every
      // piece survives — assert the reflow-robust fragments rather than the one-line call shape.
      '"span"',
      'onClick: () => setColor("green")',
      "decode(",
      "export default function Doc()",
      'h("nota-ul-li", {}',
      "h(Colorized, {}"
    ]) {
      expect(pretty).toContain(token);
    }
  });

  it("is idempotent", async () => {
    const once = await formatCode(compileNotaRaw(GOLDEN_NOTA), "babel");
    expect(await formatCode(once, "babel")).toBe(once);
  });
});

describe("formatCode (html) — SSG-output HTML", () => {
  it("indents the unindented renderToString output", async () => {
    const { html } = runSSG(compileNota(GOLDEN_NOTA));
    const pretty = await formatCode(html, "html");

    // renderToString emits no newlines; Prettier breaks the markup across indented lines.
    expect(pretty).not.toBe(html);
    expect(pretty.split("\n").length).toBeGreaterThan(html.split("\n").length);
    expect(pretty).toContain("\n");
  });

  it("preserves the island markers, coalesced list, and baked styles", async () => {
    const { html } = runSSG(compileNota(GOLDEN_NOTA));
    const pretty = await formatCode(html, "html");
    for (const token of [
      "nota-island",
      'data-hydration-id="1"',
      'data-hydration-id="2"',
      "color:red",
      "<ul"
    ]) {
      expect(pretty).toContain(token);
    }
  });
});

describe("formatCode — degenerate input", () => {
  it("returns empty/whitespace input unchanged (nothing to format)", async () => {
    expect(await formatCode("", "babel")).toBe("");
    expect(await formatCode("  \n ", "html")).toBe("  \n ");
  });

  it("falls back to the input on unparseable JS rather than throwing", async () => {
    const broken = "const x = ";
    expect(await formatCode(broken, "babel")).toBe(broken);
  });
});
