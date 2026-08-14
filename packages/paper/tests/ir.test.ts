/**
 * Inference rules: `inferRule` must emit KaTeX-legal TeX (validated by rendering through
 * `katex.renderToString` with the prelude's trust/strict settings), and the `IR` component must
 * decode to a display-Tex block.
 */

import { resetConfigForTest } from "@nota-lang/prelude";
import {
  decode,
  type ElementVNode,
  FRAG,
  reset,
  type VNode
} from "@nota-lang/runtime";
import katex from "katex";
import { afterEach, describe, expect, test } from "vitest";

import { IR, inferRule } from "../src/lib";

const el = (
  tag: ElementVNode["tag"],
  children: VNode[] = [],
  props: Record<string, unknown> = {}
): ElementVNode => ({ tag, props, children });
const frag = (children: VNode[] = []): ElementVNode => el(FRAG, children);
const doc = (v: VNode): string => decode(v) as string;

afterEach(() => {
  resetConfigForTest();
  reset();
});

/** Render TeX like the prelude's DefaultTex would in HTML-output mode; throws on illegal TeX. */
const renderTex = (tex: string): string =>
  katex.renderToString(tex, {
    output: "html",
    displayMode: true,
    trust: true,
    strict: (errorCode: string) =>
      errorCode === "htmlExtension" ? "ignore" : "warn"
  });

describe("inferRule", () => {
  test("TeX shapes", () => {
    expect(inferRule({ premises: ["P"], conclusion: "C" })).toBe(
      "\\dfrac{P}{C}"
    );
    expect(inferRule({ premises: ["P_1", "P_2"], conclusion: "C" })).toBe(
      "\\dfrac{P_1 \\quad P_2}{C}"
    );
    expect(inferRule({ conclusion: "C" })).toBe("\\dfrac{\\,}{C}");
    expect(inferRule({ conclusion: "C", name: "Var" })).toBe(
      "{\\dfrac{\\,}{C}}\\;\\textsf{\\small Var}"
    );
    expect(
      inferRule({
        premises: ["P_1", "P_2", "P_3"],
        conclusion: "C",
        premisesPerRow: 2
      })
    ).toBe("\\dfrac{\\begin{array}{c}P_1 \\quad P_2 \\\\ P_3\\end{array}}{C}");
  });

  test("every variant is KaTeX-legal (renderToString does not throw)", () => {
    expect(() => renderTex(inferRule({ conclusion: "C" }))).not.toThrow();
    expect(() =>
      renderTex(inferRule({ premises: ["\\Gamma \\vdash e"], conclusion: "C" }))
    ).not.toThrow();
    expect(() =>
      renderTex(
        inferRule({
          premises: ["P_1", "P_2", "P_3"],
          conclusion: "C",
          premisesPerRow: 2
        })
      )
    ).not.toThrow();
    expect(() =>
      renderTex(inferRule({ premises: ["P"], conclusion: "C", name: "T-App" }))
    ).not.toThrow();
  });
});

describe("IR component", () => {
  test("decodes to a display-Tex block", () => {
    const out = doc(
      frag([el(IR, [], { top: ["P_1", "P_2"], bot: "C", name: "Var" })])
    );
    expect(out).toContain("nota-tex-display");
  });

  test("a single string top works", () => {
    const out = doc(frag([el(IR, [], { top: "P", bot: "C" })]));
    expect(out).toContain("nota-tex-display");
  });

  test("missing bot is a pointed error", () => {
    expect(() => doc(frag([el(IR, [], { top: ["P"] })]))).toThrow(
      /@IR: missing bot/
    );
  });
});
