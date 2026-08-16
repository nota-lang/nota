/**
 * The definition tooltip system, client-side (dom project): click a reference → the bank entry
 * clones open; outside-click / Escape dismiss; double-click jumps to the definition. CSR render
 * (a bare NotaDoc self-store) — the hydration path is covered by the CLI acceptance suite.
 */
import { NotaDoc } from "@nota-lang/solid";
import { render } from "solid-js/web";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
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

  test("double-click dismisses the tooltip and jumps to the flashed definition", () => {
    resetDefTooltipHandlersForTest();
    root = document.createElement("div");
    document.body.appendChild(root);
    dispose = render(() => <Doc />, root);

    const ref = root.querySelector("a[data-nota-def]");
    if (!ref) throw new Error("no def ref");
    const target = document.getElementById("def-nota");
    if (!target) throw new Error("no definition anchor");
    // jsdom implements no layout: stub scrollIntoView to observe the jump.
    const scrolled = vi.fn();
    (target as HTMLElement).scrollIntoView = scrolled;

    vi.useFakeTimers();
    try {
      // Open a tooltip first: the double-click must dismiss it.
      click(ref);
      expect(document.querySelector(".nota-def-tooltip-open")).toBeTruthy();
      ref.dispatchEvent(new MouseEvent("dblclick", { bubbles: true }));
      expect(document.querySelectorAll(".nota-def-tooltip-open")).toHaveLength(
        0
      );
      // The jump: smooth-scroll to the definition, flash the nota-def-target class…
      expect(scrolled).toHaveBeenCalledWith({
        behavior: "smooth",
        block: "center"
      });
      expect(target.classList.contains("nota-def-target")).toBe(true);
      // …which clears after the 1500ms flash window.
      vi.advanceTimersByTime(1500);
      expect(target.classList.contains("nota-def-target")).toBe(false);
    } finally {
      vi.useRealTimers();
    }
  });
});
