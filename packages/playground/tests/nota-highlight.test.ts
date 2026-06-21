/**
 * Nota editor highlighting tests (Option B: the project's TextMate grammar run through Shiki). The
 * substantive assertions are at the tokenizer level — that the grammar colors Nota's element heads
 * and that the embedded TS inside `[props]` is colored by the bundled `source.ts` grammar — plus a
 * CM6 smoke that the bridge actually paints inline-styled spans into the editor DOM (jsdom).
 */

import { EditorView } from "@codemirror/view";
import { describe, expect, it } from "vitest";
import { GOLDEN_NOTA } from "../src/golden";
import { createNotaHighlighter, notaHighlighting } from "../src/nota-mode";

const OPTS = { lang: "nota", theme: "catppuccin-mocha" };

describe("Nota grammar via Shiki", () => {
  it("colors element heads and embedded TS, with valid absolute offsets", async () => {
    const hl = await createNotaHighlighter();
    const tokens = hl.codeToTokens(GOLDEN_NOTA, OPTS).tokens.flat();

    const find = (content: string) => tokens.find(t => t.content === content);
    // Element heads tokenize even though they sit in markup: `@span` (host) and `@Colorized` (comp).
    expect(find("span")?.color).toBeTruthy();
    expect(find("Colorized")?.color).toBeTruthy();
    // Embedded TS inside `[onClick: () => setColor("green")]` is colored by the source.ts grammar.
    const green = tokens.find(t => t.content.includes("green"));
    expect(green?.color).toBeTruthy();

    // Real highlighting ⇒ several distinct colors (the probe sees 6).
    const colors = new Set(tokens.map(t => t.color).filter(Boolean));
    expect(colors.size).toBeGreaterThanOrEqual(4);

    // Offsets are absolute, in-range, and strictly increasing across non-empty tokens.
    let prev = -1;
    for (const t of tokens) {
      if (!t.content) continue;
      expect(t.offset).toBeGreaterThan(prev);
      expect(t.offset + t.content.length).toBeLessThanOrEqual(
        GOLDEN_NOTA.length
      );
      prev = t.offset;
    }
  });
});

describe("notaHighlighting CM6 bridge", () => {
  it("paints inline-styled token spans into the editor DOM", async () => {
    const hl = await createNotaHighlighter();
    const view = new EditorView({
      doc: GOLDEN_NOTA,
      extensions: [notaHighlighting(hl)],
      parent: document.body
    });
    try {
      const colored = view.dom.querySelectorAll(
        '.cm-line span[style*="color"]'
      );
      expect(colored.length).toBeGreaterThan(0);
    } finally {
      view.destroy();
    }
  });
});
