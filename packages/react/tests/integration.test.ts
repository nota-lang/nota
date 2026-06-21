/**
 * HEADLINE integration test (implementation.md §2.7 layer 5) — **the canonical golden**, contract §2
 * / decode.md's worked example, end-to-end from the runtime side with the real `@nota-lang/react`
 * adapter.
 *
 * We hand-write contract §2's **stage-3** emitted module (the `Colorized` example, WITH the F1 name
 * arg `inlineComponent(fn, "Colorized")`, importing `useState` from `react`), run `render(Doc)`, and
 * assert **stage-5**: the `<ul><li>…<span … style="color: red">a</span>…</li>…</ul>` HTML (modulo
 * formatting / attr-order / our hydration-id mechanism) plus the island manifest
 * `{"1":{comp:"Colorized",props:{}},"2":{comp:"Colorized",props:{}}}`.
 *
 * Runs in the `dom` vitest project (jsdom): React's `react-dom/server` `renderToString` runs there,
 * and `island` SSRs each `Colorized` shell with `▸ = true` so `useState("red")` bakes `color: red`.
 */

import reactAdapter from "@nota-lang/react";
import {
  type CompProps,
  clearAdapter,
  decode,
  Fragment,
  h,
  inlineComponent,
  render,
  setAdapter
} from "@nota-lang/runtime";
import { useState } from "react";
import { afterEach, beforeEach, describe, expect, test } from "vitest";

// ---------------------------------------------------------------------------------------------
// contract §2 stage-3 — the emitted module, hand-written verbatim (keyless @for form, per R6)
// ---------------------------------------------------------------------------------------------

const Colorized = inlineComponent((children: CompProps["children"]) => {
  const [color, setColor] = useState("red");
  return decode(
    h("span", { onClick: () => setColor("green"), style: { color } }, children)
  );
}, "Colorized");

function Doc() {
  return decode(
    Fragment(["a", "b"].map(x => h("ulli", {}, [h(Colorized, {}, x)])))
  );
}

// ---------------------------------------------------------------------------------------------

beforeEach(() => setAdapter(reactAdapter));
afterEach(() => clearAdapter());

describe("headline integration (contract §2 stage-5)", () => {
  test("render(Doc) → stage-5 HTML + manifest", () => {
    const { html, manifest } = render(Doc);

    // --- manifest: two islands, both Colorized, empty props ---
    expect(manifest).toEqual({
      "1": { comp: "Colorized", props: {} },
      "2": { comp: "Colorized", props: {} }
    });

    // --- structure: <ul> with two <li>, each an island wrapping a <span> with the slot text ---
    // the two `ulli` sentinels coalesced into one <ul> (groupLists); each <li> holds the island.
    expect(html.startsWith("<ul><li>")).toBe(true);
    expect(html.endsWith("</li></ul>")).toBe(true);

    // island wrappers carry our hydration-id mechanism (data-hydration-id on <nota-island>).
    expect(html).toContain('<nota-island data-hydration-id="1">');
    expect(html).toContain('<nota-island data-hydration-id="2">');

    // each island's SSR'd <span> baked color:red from useState("red") and holds the slot text.
    // React serializes the style object as `color:red` (no space) and omits the onClick handler.
    expect(html).toMatch(
      /<nota-island data-hydration-id="1"><span style="color:red"[^>]*>a<\/span><\/nota-island>/
    );
    expect(html).toMatch(
      /<nota-island data-hydration-id="2"><span style="color:red"[^>]*>b<\/span><\/nota-island>/
    );

    // no event handler leaked into static HTML
    expect(html).not.toContain("onClick");
    expect(html).not.toContain("onclick");
  });

  test("the exact rendered HTML (snapshot of the literal stage-5 output)", () => {
    const { html } = render(Doc);
    // Pinned literal — the actual bytes `render` produces (report pastes this vs §2's idealized form).
    expect(html).toBe(
      '<ul><li><nota-island data-hydration-id="1"><span style="color:red">a</span></nota-island></li>' +
        '<li><nota-island data-hydration-id="2"><span style="color:red">b</span></nota-island></li></ul>'
    );
  });

  test("ids are deterministic across renders (reset() each time)", () => {
    const first = render(Doc);
    const second = render(Doc);
    expect(first.html).toBe(second.html);
    expect(Object.keys(second.manifest)).toEqual(["1", "2"]);
  });
});
