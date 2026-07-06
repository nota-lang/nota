/**
 * **Completions** (contract R22 / D2 P5).
 *
 * - `@|` head completions (this plugin): tags + prelude slots + in-scope components; suppressed on a
 *   `%` statement line and inside embedded JS.
 * - `@tag[|` prop completions: served by TS through the P1 recovery anchor + the P3 typed overload —
 *   asserted end-to-end via the feature harness (`h("a", { | })` → `<a>` attributes).
 */

import { describe, expect, test } from "vitest";
import {
  headCompletions,
  headContext,
  NOTA_PRELUDE_SLOTS,
  notaCompletionsPlugin,
  scanComponents
} from "../src/completions";
import { completionsAt, createFeatureHarness } from "./feature-harness";

describe("headContext (the `@|` line-prefix classifier)", () => {
  test("matches a bare `@` and a partial head at end of prefix", () => {
    expect(headContext("hello @")).toBe("");
    expect(headContext("hello @em")).toBe("em");
    expect(headContext("@my-wid")).toBe("my-wid");
  });
  test("does not match after a space, or an `@(expr)` head", () => {
    // In Nota markup `@` is ALWAYS a form trigger (even glued to preceding text: `a@x` = "a" + an
    // `@x` form), so a mid-text `@x` legitimately offers completions — the regex is deliberately loose.
    expect(headContext("email@x")).toBe("x");
    expect(headContext("@em ")).toBeNull(); // trailing space — the head already ended
    expect(headContext("@(")).toBeNull(); // dynamic-tag head, TS handles the expr
  });
  test("is suppressed on a `%`/`%%%` statement line (embedded JS)", () => {
    expect(headContext("% const x = @")).toBeNull();
    expect(headContext("%%% @")).toBeNull();
  });
});

describe("scanComponents (document scan for capitalized bindings)", () => {
  test("finds %let/%const/%export component bindings, ignores lowercase", () => {
    const src =
      "%let Colorized = inlineComponent(f)\n%const Note = blockComponent(g)\n%export let Aside = x\n% let helper = 1\n";
    const found = scanComponents(src);
    expect(found).toContain("Colorized");
    expect(found).toContain("Note");
    expect(found).toContain("Aside");
    expect(found).not.toContain("helper");
  });
});

describe("headCompletions (the merged `@|` item set)", () => {
  test("includes host tags, prelude slots, and in-scope components; de-duped", () => {
    const src = "%let Widget = inlineComponent(f)\n@p{x}\n";
    const items = headCompletions(src);
    const labels = items.map(i => i.label);
    expect(labels).toContain("p"); // host tag
    expect(labels).toContain("Tex"); // prelude slot
    expect(labels).toContain("Widget"); // in-scope component
    // De-duped (no label appears twice).
    expect(new Set(labels).size).toBe(labels.length);
    // Every prelude slot is offered.
    for (const slot of NOTA_PRELUDE_SLOTS) {
      expect(labels).toContain(slot);
    }
  });
});

describe("the completion plugin", () => {
  const instance = notaCompletionsPlugin.create({} as never);

  function complete(source: string, offset: number) {
    // Build a minimal TextDocument-shaped stub: the plugin only uses languageId + getText.
    const lines = source.slice(0, offset).split("\n");
    const line = lines.length - 1;
    const character = lines[lines.length - 1].length;
    const doc = {
      languageId: "nota",
      uri: "file:///x.nota",
      getText: (range?: {
        start: { line: number; character: number };
        end: { line: number; character: number };
      }) =>
        range
          ? source
              .split("\n")
              [range.start.line]?.slice(range.start.character, range.end.character) ?? ""
          : source
    };
    return instance.provideCompletionItems?.(
      doc as never,
      { line, character },
      {} as never,
      {} as never
    );
  }

  test("registers `@` and `[` as trigger characters", () => {
    expect(
      notaCompletionsPlugin.capabilities.completionProvider?.triggerCharacters
    ).toEqual(["@", "["]);
  });

  test("offers head completions at `@|`", () => {
    const src = "@";
    const result = complete(src, 1);
    const labels = (result as { items: { label: string }[] })?.items.map(
      i => i.label
    );
    expect(labels).toContain("p");
    expect(labels).toContain("Tex");
  });

  test("returns undefined on a `%` line (embedded JS) — TS handles it", () => {
    const src = "% const x = @";
    expect(complete(src, src.length)).toBeUndefined();
  });

  test("returns undefined at a `[` prop trigger — TS serves props via the mapping", () => {
    const src = "@a[";
    expect(complete(src, src.length)).toBeUndefined();
  });
});

describe("`@tag[|` prop completions via TS (P1 anchor + P3 overload)", () => {
  test("`@a[` proposes <a> attributes (href, target, …) with no Nota-specific code", () => {
    const h = createFeatureHarness("@a[");
    const items = completionsAt(h, 3); // just after `[` — the recovery anchor
    expect(items.has("href")).toBe(true);
    expect(items.has("target")).toBe(true);
  });
});
