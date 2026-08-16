/**
 * The definition tooltip system, client-side (dom project): click a reference → the bank entry
 * clones open; outside-click / Escape dismiss. CSR render (a bare NotaDoc self-store) — the
 * hydration path is covered structurally by @nota-lang/solid's e2e.
 */
import { NotaDoc } from "@nota-lang/solid";
import { render } from "solid-js/web";
import { afterEach, beforeEach, describe, expect, test } from "vitest";
import {
  Definition,
  Ref,
  resetConfigForTest,
  resetDefTooltipHandlersForTest
} from "../src/lib";

let dispose: (() => void) | null = null;
let root: HTMLDivElement | null = null;

beforeEach(() => {
  resetConfigForTest();
});

afterEach(() => {
  dispose?.();
  root?.remove();
  dispose = null;
  root = null;
  for (const tip of document.querySelectorAll(".nota-def-tooltip-open")) {
    tip.remove();
  }
});

const click = (el: Element) =>
  el.dispatchEvent(new MouseEvent("click", { bubbles: true }));

function Doc() {
  return (
    <NotaDoc>
      <Definition id="nota" label="Nota" tooltip="A document language.">
        {"Nota"}
      </Definition>
      {" is referenced as "}
      <Ref id="nota" />
      {"."}
    </NotaDoc>
  );
}

describe("def tooltips (CSR)", () => {
  test("click shows the tooltip; outside-click and Escape dismiss", () => {
    resetDefTooltipHandlersForTest();
    root = document.createElement("div");
    document.body.appendChild(root);
    dispose = render(() => <Doc />, root);

    const ref = root.querySelector("a[data-nota-def]");
    if (!ref) throw new Error("no def ref");
    expect(ref.getAttribute("href")).toBe("#def-nota"); // no-JS fallback: anchor jump

    // Click the reference: the bank entry clones open onto the body.
    click(ref);
    const tip = document.querySelector(".nota-def-tooltip-open");
    expect(tip).toBeTruthy();
    expect(tip?.textContent).toBe("A document language.");

    // A second click on the same anchor toggles it away.
    click(ref);
    expect(document.querySelector(".nota-def-tooltip-open")).toBeNull();

    // Reopen, dismiss via outside click.
    click(ref);
    expect(document.querySelector(".nota-def-tooltip-open")).toBeTruthy();
    click(document.body);
    expect(document.querySelector(".nota-def-tooltip-open")).toBeNull();

    // Reopen, dismiss via Escape.
    click(ref);
    expect(document.querySelector(".nota-def-tooltip-open")).toBeTruthy();
    document.dispatchEvent(
      new KeyboardEvent("keydown", { key: "Escape", bubbles: true })
    );
    expect(document.querySelector(".nota-def-tooltip-open")).toBeNull();
  });
});
