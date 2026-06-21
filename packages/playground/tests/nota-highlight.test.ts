/**
 * Nota editor highlighting tests (Option B: the project's TextMate grammar run through Shiki). The
 * substantive assertions are at the tokenizer level — that the grammar colors Nota's element heads
 * and that the embedded TS inside `[props]` is colored by the bundled `source.ts` grammar — plus a
 * CM6 smoke that the bridge actually paints inline-styled spans into the editor DOM (jsdom).
 */

import { EditorView } from "@codemirror/view";
import { describe, expect, it } from "vitest";
import { GOLDEN_NOTA } from "../src/golden";
import {
  createNotaHighlighter,
  NOTA_LANG,
  NOTA_THEME,
  notaHighlighting
} from "../src/nota-mode";

const OPTS = { lang: NOTA_LANG, theme: NOTA_THEME };

describe("Nota grammar via Shiki", () => {
  it("colors % statements, component heads, and embedded TS, with valid offsets", async () => {
    const hl = await createNotaHighlighter();
    const tokens = hl.codeToTokens(GOLDEN_NOTA, OPTS).tokens.flat();

    // The `%let …` statement line is recognized and colored (the grammar's `%`-no-space fix).
    const first = tokens.find(t => t.content.trim());
    expect(first?.content.startsWith("%")).toBe(true);
    expect(first?.color).toBeTruthy();
    // A component head in a clean markup body (`- @Colorized{@x}`) is colored.
    expect(tokens.find(t => t.content === "Colorized")?.color).toBeTruthy();
    // Embedded TS (here the `setColor("green")` string inside the component body) is colored by
    // the bundled source.ts grammar.
    expect(tokens.find(t => t.content.includes("green"))?.color).toBeTruthy();

    // Real highlighting ⇒ several distinct colors (the probe sees 7).
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

  it("colors `#` headings (the catppuccin-latte theme has no generic markup.heading rule)", async () => {
    const hl = await createNotaHighlighter();
    const tokens = hl
      .codeToTokens("# A heading\n\nprose\n", OPTS)
      .tokens.flat();

    // The heading line is colored and bold — not left in the default prose color. (Without the
    // theme supplement in nota-mode, `markup.heading.nota` matches no rule and renders as plain text.)
    const heading = tokens.find(t => t.content.includes("A heading"));
    const prose = tokens.find(t => t.content.includes("prose"));
    expect(heading?.color).toBeTruthy();
    expect(heading?.color).not.toBe(prose?.color);
    expect((heading?.fontStyle ?? 0) & 2).toBe(2); // FontStyle bold
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
