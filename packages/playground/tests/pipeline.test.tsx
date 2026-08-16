/**
 * The full client-side pipeline, end to end in jsdom: `.nota` source → wasm reader → JSX emit →
 * babel-preset-solid (in-page) → eval → a LIVE Solid document. The golden's `Colorized` click
 * (red → green) proves the evaluated module shares this page's Solid instance (events delegate,
 * signals propagate).
 */

import { render } from "solid-js/web";
import { describe, expect, it } from "vitest";
import { DEFAULT_SNIPPET } from "../src/default-snippet";
import { GOLDEN_NOTA } from "../src/golden";
import { EMPTY, runPipeline } from "../src/pipeline";

const click = (el: Element) =>
  el.dispatchEvent(new MouseEvent("click", { bubbles: true }));

describe("runPipeline", () => {
  it("the seed document compiles clean through every stage", () => {
    const r = runPipeline(DEFAULT_SNIPPET, EMPTY);
    expect(r.error).toBeNull();
    expect(r.ast).toContain("NotaDocument");
    expect(r.jsx).toContain("<NotaDoc>");
    expect(r.jsx).toContain("<UlLi>");
    // babel-preset-solid output: dom-mode template calls, no JSX left.
    expect(r.compiled).not.toContain("<NotaDoc>");
    expect(r.compiled).toMatch(/template|createComponent/);
    expect(r.Doc).toBeTypeOf("function");
  });

  it("a parse error keeps the last-good result and surfaces the message", () => {
    const good = runPipeline(DEFAULT_SNIPPET, EMPTY);
    const bad = runPipeline("@p{unterminated", good);
    expect(bad.error).toBeTruthy();
    expect(bad.jsx).toBe(good.jsx);
    expect(bad.Doc).toBe(good.Doc);
  });

  it("the golden renders live and reacts: Colorized flips red → green on click", () => {
    const { Doc, error } = runPipeline(GOLDEN_NOTA, EMPTY);
    expect(error).toBeNull();
    if (!Doc) throw new Error("no Doc");

    const host = document.createElement("div");
    document.body.appendChild(host);
    const dispose = render(() => Doc() as never, host);

    // The reforested document: one coalesced <ul> with two items.
    expect(host.querySelectorAll("ul.nota-list > li")).toHaveLength(2);
    const spans = Array.from(host.querySelectorAll("li span"));
    expect(spans).toHaveLength(2);
    expect((spans[0] as HTMLElement).style.color).toBe("red");

    click(spans[0]);
    expect((spans[0] as HTMLElement).style.color).toBe("green");
    expect((spans[1] as HTMLElement).style.color).toBe("red"); // independent instance

    dispose();
    host.remove();
  });
});
