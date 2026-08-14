/**
 * The Language/BNF DSL, driven through the real decode pipeline (`decode(v)` from the runtime —
 * marks/queries/trailers all resolve, so the prelude's definitions trailer appends the tooltip
 * bank when the `Bnf` table's `Definition`s exist).
 */

import { resetConfigForTest } from "@nota-lang/prelude";
import {
  decode,
  type ElementVNode,
  FRAG,
  reset,
  type VNode
} from "@nota-lang/runtime";
import { afterEach, describe, expect, test } from "vitest";

import { type Language, language } from "../src/lib";

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

const stlc = (): Language =>
  language({
    ty: {
      name: "Type",
      meta: "\\tau",
      forms: {
        unit: { tex: () => "\\mathbf{1}", desc: "unit type" },
        arrow: {
          tex: (a, b) => `${a} \\to ${b}`,
          sig: l => [l.ty, l.ty],
          desc: "function type"
        }
      }
    },
    sessty: {
      name: "Session type",
      meta: "\\sigma"
    }
  });

describe("language handles", () => {
  test("kind handles are texRef-wrapped metavariables", () => {
    const L = stlc();
    expect(L.ty).toBe("\\htmlData{nota-def=gram-ty}{\\tau}");
    expect(L.sessty).toBe("\\htmlData{nota-def=gram-sessty}{\\sigma}");
  });

  test("form fns fill their arguments and wrap in the kind's texRef", () => {
    const L = stlc();
    expect(L.unit()).toBe("\\htmlData{nota-def=gram-ty}{\\mathbf{1}}");
    expect(L.arrow("\\alpha", "\\beta")).toBe(
      "\\htmlData{nota-def=gram-ty}{\\alpha \\to \\beta}"
    );
  });

  test("a form name colliding with a kind name is a pointed error", () => {
    expect(() =>
      language({
        ty: {
          name: "Type",
          meta: "\\tau",
          forms: { ty: { tex: () => "x" } }
        }
      })
    ).toThrow(/form "ty" of kind "ty" collides with kind "ty"/);
  });

  test("a form name colliding with another form name is a pointed error", () => {
    expect(() =>
      language({
        ty: {
          name: "Type",
          meta: "\\tau",
          forms: { app: { tex: () => "x" } }
        },
        tm: {
          name: "Term",
          meta: "e",
          forms: { app: { tex: () => "y" } }
        }
      })
    ).toThrow(/form "app" of kind "tm" collides with form "app" of kind "ty"/);
  });
});

describe("Bnf", () => {
  test("renders one Definition-anchored display block per kind", () => {
    const L = stlc();
    const out = doc(frag([el(L.Bnf, [], {})]));
    expect(out).toContain('id="def-gram-ty"');
    expect(out).toContain('id="def-gram-sessty"');
    expect(out).toContain('class="nota-bnf"');
    // two display-Tex blocks, one per kind (the tooltip bank re-renders them after this)
    const body = out.slice(0, out.indexOf("nota-def-tooltips"));
    expect(body.match(/nota-tex-display/g)).toHaveLength(2);
    // …and the grammar rows now appear inside the tooltip bank too (renderable raw bodies)
    const bank = out.slice(out.indexOf("nota-def-tooltips"));
    expect(bank).toContain("<math");
  });

  test("rows contain names, plain (unwrapped) metas, ::= and mid", () => {
    const L = stlc();
    const out = doc(frag([el(L.Bnf, [], {})]));
    // the KaTeX MathML annotation carries the TeX source verbatim
    expect(out).toContain("\\text{Type}");
    expect(out).toContain("\\text{Session type}");
    expect(out).toContain("::=");
    expect(out).toContain("\\mid");
    expect(out).toContain("\\text{unit type}");
    expect(out).toContain("\\text{function type}");
    // the form display resolves sig against PLAIN handles: raw metas, no \htmlData inside the table
    expect(out).toContain("\\tau \\to \\tau");
    expect(out).not.toContain("htmlData");
  });

  test("the tooltip bank contains the grammar rows", () => {
    const L = stlc();
    const out = doc(frag([el(L.Bnf, [], {})]));
    expect(out).toContain('class="nota-def-tooltips"');
    expect(out).toContain('data-def="gram-ty"');
    expect(out).toContain('data-def="gram-sessty"');
  });

  test("descs with TeX specials are escaped and render through KaTeX", () => {
    const L = language({
      k: {
        name: "Kind",
        meta: "\\kappa",
        forms: {
          weird: {
            tex: () => "\\star",
            desc: "50% of $x_1$ & {stuff} #^~\\"
          }
        }
      }
    });
    const out = doc(frag([el(L.Bnf, [], {})]));
    expect(out).toContain("nota-tex-display");
    expect(out).toContain("\\%");
    expect(out).toContain("\\textbackslash");
  });
});
