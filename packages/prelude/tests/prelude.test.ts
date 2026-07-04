/**
 * `@nota-lang/prelude` unit tests (contract R14c/R14d), driven through the real static pipeline
 * (`serialize(struct(…))` — the ▸=false decode) so the slots, R10 expansion, RawHtml passthrough,
 * and the defaults are exercised together.
 */

import {
  type CompProps,
  clearRegisteredComponents,
  type ElementVNode,
  FRAG,
  h,
  registerComponents,
  reset,
  serialize,
  struct,
  type VNode
} from "@nota-lang/runtime";
import { afterEach, describe, expect, test, vi } from "vitest";

import {
  CodeBlock,
  CodeInline,
  lstset,
  mathset,
  resetConfigForTest,
  Tex
} from "../src/lib";

const el = (
  tag: ElementVNode["tag"],
  children: VNode[] = [],
  props: Record<string, unknown> = {}
): ElementVNode => ({ tag, props, children });
const decodeStatic = (v: VNode): string => serialize(struct(v));

afterEach(() => {
  resetConfigForTest();
  clearRegisteredComponents();
  vi.restoreAllMocks();
});

// =============================================================================================
// Tex (R14c: KaTeX → MathML)
// =============================================================================================

describe("Tex default (KaTeX → MathML)", () => {
  test("inline: MathML inside a <span class=nota-tex> (raw, unescaped)", () => {
    const out = decodeStatic(el(Tex, ["x^2"]));
    expect(out).toMatch(/^<span class="nota-tex">/);
    expect(out).toContain("<math");
    expect(out).toContain("</math>");
    expect(out).not.toContain("&lt;math"); // raw leaf: never re-escaped
  });

  test("display: block <div class=nota-tex-display> + MathML display=block", () => {
    const out = decodeStatic(el(Tex, ["\\sum_n x_n"], { display: true }));
    expect(out).toMatch(/^<div class="nota-tex-display">/);
    expect(out).toContain('display="block"');
  });

  test("display math between paragraphs is NOT paragraph-wrapped; inline math is", () => {
    const doc = el(FRAG, [
      "before",
      "\n",
      "\n",
      el(Tex, ["y"], { display: true }),
      "\n",
      "\n",
      "after ",
      el(Tex, ["z"])
    ]);
    const out = decodeStatic(doc);
    expect(out).toMatch(/<p>before<\/p><div class="nota-tex-display">/);
    expect(out).toMatch(/<p>after <span class="nota-tex">/);
    // the block raw inside the display wrapper is not paragraph-wrapped either
    expect(out).not.toContain('nota-tex-display"><p>');
  });

  test("armed scalar splices into the TeX source ($a_|@i$, i=3 → a_3)", () => {
    // flatten() has already stringified the number by the time parts reach the component.
    const out = decodeStatic(el(Tex, ["a_", "3"]));
    expect(out).toContain("<mn>3</mn>"); // the 3 parsed as TeX, not appended as text
  });

  test("a markup part inside math is a hard error (R14c)", () => {
    const bad = el(Tex, ["x + ", el("em", ["y"])]);
    expect(() => decodeStatic(bad)).toThrow(/registerComponents\(\{ Tex/);
  });

  test("mathset macros apply (and reset with the config)", () => {
    // NB: \R itself is a KaTeX *built-in* macro — use a custom name to observe the config.
    mathset({ macros: { "\\foo": "\\mathbb{F}" } });
    expect(() => decodeStatic(el(Tex, ["\\foo"]))).not.toThrow();
    reset(); // per-render reset restores the shipped baseline (no \foo)
    expect(() => decodeStatic(el(Tex, ["\\foo"]))).toThrow();
  });

  test("the Tex slot honors a registered override", () => {
    registerComponents({
      Tex: ({ children }: CompProps) => h("i", { class: "mymath" }, children)
    });
    expect(decodeStatic(el(Tex, ["x"]))).toBe('<i class="mymath">x</i>');
  });
});

// =============================================================================================
// CodeBlock / CodeInline (R14c: sync shiki + decorations)
// =============================================================================================

describe("CodeBlock default (sync shiki)", () => {
  test("fence lang → highlighted <pre class=shiki> inside the block wrapper", () => {
    const out = decodeStatic(
      el(CodeBlock, ["def f(x):\n    return x"], { lang: "python" })
    );
    expect(out).toMatch(/^<div class="nota-code-block"><pre class="shiki/);
    expect(out).toContain("<span"); // token spans present
    expect(out).toContain("github-light"); // default theme
  });

  test("alias languages resolve (bash → shellscript grammar)", () => {
    const out = decodeStatic(el(CodeBlock, ["echo hi"], { lang: "bash" }));
    expect(out).toContain('<pre class="shiki');
  });

  test("no lang and no lstset → plain <pre><code> with escaped text", () => {
    const out = decodeStatic(el(CodeBlock, ["a < b"]));
    expect(out).toBe(
      '<pre class="nota-code-block"><code>a &lt; b</code></pre>'
    );
  });

  test("lstset({language}) supplies the default; the fence tag wins over it", () => {
    lstset({ language: "python" });
    expect(decodeStatic(el(CodeBlock, ["def f(): pass"]))).toContain(
      '<pre class="shiki'
    );
    // explicit fence lang beats the global
    const rs = decodeStatic(el(CodeBlock, ["fn main() {}"], { lang: "rust" }));
    expect(rs).toContain('<pre class="shiki');
  });

  test("lstset is reset per render (R14d)", () => {
    lstset({ language: "python" });
    reset();
    expect(decodeStatic(el(CodeBlock, ["def f(): pass"]))).toMatch(
      /^<pre class="nota-code-block">/
    );
  });

  test("unknown language warns once and falls back to plain", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const out = decodeStatic(el(CodeBlock, ["x"], { lang: "no-such-lang" }));
    expect(out).toMatch(/^<pre class="nota-code-block">/);
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining('no grammar loaded for language "no-such-lang"')
    );
  });

  test("armed element → decoration: full-text tokenization + the element's tag/props", () => {
    // `def f(x):⏎    return |@hl[class:spot]{x}` — the hl wraps the final x.
    const out = decodeStatic(
      el(
        CodeBlock,
        ["def f(x):\n    return ", el("hl", ["x"], { class: "spot" })],
        { lang: "python" }
      )
    );
    expect(out).toMatch(/<hl[^>]*class="spot"[^>]*>x<\/hl>/);
    // and the surrounding code is still tokenized (the `return` keyword got a token span)
    expect(out).toMatch(/<span style="color:[^"]*">\s*return<\/span>/);
  });

  test("a text-less armed part → plain fallback with the splice intact + warning", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const out = decodeStatic(
      el(CodeBlock, ["a = ", el("img", [], { src: "x.png" })], {
        lang: "python"
      })
    );
    expect(out).toBe(
      '<pre class="nota-code-block"><code>a = <img src="x.png" /></code></pre>'
    );
    expect(warn).toHaveBeenCalledOnce();
  });
});

describe("CodeInline default", () => {
  test("plain <code> by default (no global language)", () => {
    expect(decodeStatic(el(CodeInline, ["f(x)"]))).toBe(
      '<code class="nota-code-inline">f(x)</code>'
    );
  });

  test("lstset({language}) highlights inline code (structure: inline, no <pre>)", () => {
    lstset({ language: "python" });
    const out = decodeStatic(el(CodeInline, ["f(1)"]));
    expect(out).toMatch(/^<code class="nota-code-inline"><span/);
    expect(out).not.toContain("<pre");
  });

  test("armed element inside inline code decorates the range", () => {
    lstset({ language: "python" });
    const out = decodeStatic(el(CodeInline, ["f(", el("em", ["x"]), ")"]));
    expect(out).toMatch(/<em[^>]*>x<\/em>/);
  });

  test("the CodeInline slot honors a registered override", () => {
    registerComponents({ CodeInline: "kbd" });
    expect(decodeStatic(el(CodeInline, ["ls"]))).toBe("<kbd>ls</kbd>");
  });
});
