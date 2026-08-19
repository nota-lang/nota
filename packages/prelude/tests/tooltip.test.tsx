/**
 * The definition tooltip system, client-side (dom project): click a reference → the bank entry
 * clones open; outside-click / Escape dismiss; double-click jumps to the definition. CSR render
 * (a bare NotaDoc self-store) — the hydration path is covered by the CLI acceptance suite.
 */
import { NotaDoc } from "@nota-lang/core";
import { render } from "solid-js/web";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import {
  Caption,
  Definition,
  Figure,
  installDefTooltipHandlers,
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
    resetDefTooltipHandlersForTest();
    installDefTooltipHandlers();

    const ref = root.querySelector("a[data-nota-def]");
    if (!ref) throw new Error("no def ref");
    expect(ref.getAttribute("href")).toBe("#def-nota"); // no-JS fallback: anchor jump

    // Click the reference: the bank entry clones open onto the body.
    click(ref);
    expect(document.querySelectorAll(".nota-def-tooltip-open")).toHaveLength(1);
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

  test("figure tooltips clone the rendered figure without evaluating children again", () => {
    resetDefTooltipHandlersForTest();
    let evaluations = 0;
    const Body = () => {
      evaluations += 1;
      return <Caption>{"A plotted result."}</Caption>;
    };
    const FigureDoc = () => (
      <NotaDoc>
        <Figure id="plot">
          <Body />
        </Figure>
        <Ref id="plot" />
      </NotaDoc>
    );
    root = document.createElement("div");
    document.body.appendChild(root);
    dispose = render(() => <FigureDoc />, root);
    resetDefTooltipHandlersForTest();
    installDefTooltipHandlers();

    expect(evaluations).toBe(1);
    const ref = root.querySelector('a[data-nota-def="plot"]');
    if (!ref) throw new Error("no figure ref");
    click(ref);

    expect(evaluations).toBe(1);
    const tip = document.querySelector(".nota-def-tooltip-open");
    expect(tip?.textContent).toContain("A plotted result.");
    expect(tip?.querySelector("#fig-plot")).toBeNull();
  });
});

describe("def tooltips on a multi-document page (Astro-islands scenario)", () => {
  test("a ref in the SECOND document resolves against that document's OWN bank, not the first's", () => {
    resetDefTooltipHandlersForTest();
    const root1 = document.createElement("div");
    const root2 = document.createElement("div");
    document.body.appendChild(root1);
    document.body.appendChild(root2);

    // Two INDEPENDENT documents (two bare <NotaDoc> islands, each self-provisioning its own
    // doc-state store — the Astro shape) that happen to share a definition id, so a page-global
    // ".nota-def-tooltips" lookup would resolve the first bank and silently render doc 1's
    // content for a doc-2 ref.
    function Doc1() {
      return (
        <NotaDoc>
          <Definition id="shared" label="One" tooltip="Doc ONE's tooltip.">
            {"shared"}
          </Definition>{" "}
          <Ref id="shared" />
        </NotaDoc>
      );
    }
    function Doc2() {
      return (
        <NotaDoc>
          <Definition id="shared" label="Two" tooltip="Doc TWO's tooltip.">
            {"shared"}
          </Definition>{" "}
          <Ref id="shared" />
        </NotaDoc>
      );
    }

    const dispose1 = render(() => <Doc1 />, root1);
    const dispose2 = render(() => <Doc2 />, root2);
    try {
      const ref2 = root2.querySelector("a[data-nota-def]");
      if (!ref2) throw new Error("no def ref in doc2");
      click(ref2);
      const tip = document.querySelector(".nota-def-tooltip-open");
      expect(tip).toBeTruthy();
      // The SECOND document's own bank must be consulted — not the first (page-first) bank.
      expect(tip?.textContent).toBe("Doc TWO's tooltip.");
      expect(tip?.textContent).not.toBe("Doc ONE's tooltip.");
    } finally {
      dispose1();
      dispose2();
      root1.remove();
      root2.remove();
    }
  });
});
