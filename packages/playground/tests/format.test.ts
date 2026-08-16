/**
 * Output-pane formatter tests over the *real* artifact the panes show — the emitted Solid JSX
 * module from the same wasm reader + shim the app uses. Formatting is display-only: it must
 * reflow the output while preserving every token, and be a no-op fallback on un-parseable input.
 */

import { compile } from "@nota-lang/compiler";
import { describe, expect, it } from "vitest";
import { formatCode } from "../src/format";
import { GOLDEN_NOTA } from "../src/golden";

const emit = (): string => compile(GOLDEN_NOTA).code;

describe("formatCode", () => {
  it("reflows the raw JSX emit (prettier babel parser handles JSX)", async () => {
    const raw = emit();
    const pretty = await formatCode(raw, "babel");
    // It actually ran (a thrown Prettier would fall back to `raw` unchanged).
    expect(pretty).not.toBe(raw);
    // The codegen indents with tabs; Prettier's default is two spaces.
    expect(raw).toContain("\t");
    expect(pretty).not.toContain("\t");
  });

  it("preserves the emit's meaningful tokens", async () => {
    const pretty = await formatCode(emit(), "babel");
    for (const token of [
      "NotaDoc",
      "UlLi",
      "Colorized",
      "createSignal",
      "For"
    ]) {
      expect(pretty).toContain(token);
    }
  });

  it("falls back to the raw text on un-parseable input", async () => {
    const broken = "let ] nope";
    expect(await formatCode(broken, "babel")).toBe(broken);
  });
});
