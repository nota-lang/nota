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
  Def,
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
      <Def id="nota" Label={() => "Nota"} tooltip="A document language.">
        {"Nota"}
      </Def>
      {" is referenced as "}
      <Ref id="nota" />
      {"."}
    </NotaDoc>
  );
}

describe("def tooltips (CSR)", () => {
  test("the default tooltip clones the rendered definition body", () => {
    resetDefTooltipHandlersForTest();
    let evaluations = 0;
    const Body = () => {
      evaluations += 1;
      return <strong>{"The rendered definition."}</strong>;
    };
    const DefaultDoc = () => (
      <NotaDoc>
        <Def id="term" Label={() => "Term"}>
          <Body />
        </Def>
        <Ref id="term" />
      </NotaDoc>
    );
    root = document.createElement("div");
    document.body.appendChild(root);
    dispose = render(() => <DefaultDoc />, root);

    expect(evaluations).toBe(1);
    const ref = root.querySelector("a[data-nota-def]");
    if (!ref) throw new Error("no def ref");
    click(ref);

    const tip = document.querySelector(".nota-def-tooltip-open");
    expect(tip?.textContent).toBe("The rendered definition.");
    expect(tip?.querySelector(".nota-def")?.hasAttribute("id")).toBe(false);
    expect(evaluations).toBe(1);
  });

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
          <Def id="shared" Label={() => "One"} tooltip="Doc ONE's tooltip.">
            {"shared"}
          </Def>{" "}
          <Ref id="shared" />
        </NotaDoc>
      );
    }
    function Doc2() {
      return (
        <NotaDoc>
          <Def id="shared" Label={() => "Two"} tooltip="Doc TWO's tooltip.">
            {"shared"}
          </Def>{" "}
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

/**
 * jsdom has no layout engine — every rect is 0×0 and the viewport is empty — so Floating UI
 * would have nothing to flip or shift against. Stub the three measurements it reads (the
 * viewport box, the floating element's size, the reference's rects) and the real middleware
 * chain runs.
 */
const VIEWPORT = { width: 800, height: 600 };
const TIP = { width: 200, height: 100 };

const rect = (
  left: number,
  top: number,
  width: number,
  height: number
): DOMRect =>
  ({
    x: left,
    y: top,
    left,
    top,
    right: left + width,
    bottom: top + height,
    width,
    height,
    toJSON: () => ({})
  }) as DOMRect;

const clickAt = (el: Element, x: number, y: number) =>
  el.dispatchEvent(
    new MouseEvent("click", {
      bubbles: true,
      detail: 1,
      clientX: x,
      clientY: y
    })
  );

/** Render `Doc`, hand back its reference `<a>` with layout under the test's control. */
function openable(): HTMLElement {
  resetDefTooltipHandlersForTest();
  root = document.createElement("div");
  document.body.appendChild(root);
  dispose = render(() => <Doc />, root);
  const ref = root.querySelector("a[data-nota-def]") as HTMLElement | null;
  if (!ref) throw new Error("no def ref");
  return ref;
}

const openTip = (): HTMLElement => {
  const tip = document.querySelector(".nota-def-tooltip-open");
  if (!tip) throw new Error("no open tooltip");
  return tip as HTMLElement;
};

describe("def tooltip placement (Floating UI)", () => {
  let sizeDescriptors: [string, PropertyDescriptor | undefined][] = [];

  beforeEach(() => {
    for (const [prop, value] of [
      ["clientWidth", VIEWPORT.width],
      ["clientHeight", VIEWPORT.height]
    ] as const) {
      Object.defineProperty(document.documentElement, prop, {
        configurable: true,
        get: () => value
      });
    }
    sizeDescriptors = (["offsetWidth", "offsetHeight"] as const).map(prop => [
      prop,
      Object.getOwnPropertyDescriptor(HTMLElement.prototype, prop)
    ]);
    for (const [prop, size] of [
      ["offsetWidth", TIP.width],
      ["offsetHeight", TIP.height]
    ] as const) {
      Object.defineProperty(HTMLElement.prototype, prop, {
        configurable: true,
        get(this: HTMLElement) {
          return this.classList.contains("nota-def-tooltip-open") ? size : 0;
        }
      });
    }
  });

  afterEach(() => {
    for (const prop of ["clientWidth", "clientHeight"] as const) {
      delete (document.documentElement as unknown as Record<string, unknown>)[
        prop
      ];
    }
    for (const [prop, descriptor] of sizeDescriptors) {
      if (descriptor)
        Object.defineProperty(HTMLElement.prototype, prop, descriptor);
    }
  });

  test("the tooltip centers above its reference, and flips below when the top is tight", async () => {
    const ref = openable();
    ref.getBoundingClientRect = () => rect(400, 300, 40, 14);

    click(ref);
    const tip = openTip();
    await vi.waitFor(() => expect(tip.dataset.placement).toBe("top"));
    // Centered on the reference (400 + 40/2 − 200/2), one 8px gap above it (300 − 100 − 8).
    expect(tip.style.left).toBe("320px");
    expect(tip.style.top).toBe("192px");
    // `size` publishes the room the chosen placement actually has: the viewport minus the
    // 8px margin on each side, and above the reference minus the gap.
    expect(tip.style.getPropertyValue("--nota-tooltip-available-width")).toBe(
      "784px"
    );
    expect(tip.style.getPropertyValue("--nota-tooltip-available-height")).toBe(
      "284px"
    );

    // Same reference, now near the top of the viewport: `flip` puts the tooltip underneath.
    click(ref); // toggle closed
    ref.getBoundingClientRect = () => rect(400, 10, 40, 14);
    click(ref);
    const flipped = openTip();
    await vi.waitFor(() => expect(flipped.dataset.placement).toBe("bottom"));
    expect(flipped.style.left).toBe("320px");
    expect(flipped.style.top).toBe("32px"); // 10 + 14 + 8
  });

  test("a reference broken across two lines anchors to the line that was clicked", async () => {
    const ref = openable();
    // The tail of one line and the head of the next — disjoint boxes, as `inline` expects.
    const first = rect(600, 300, 180, 14);
    const second = rect(300, 320, 100, 14);
    ref.getClientRects = () => [first, second] as unknown as DOMRectList;
    ref.getBoundingClientRect = () => rect(300, 300, 480, 34);

    clickAt(ref, 350, 327); // inside the second line's box
    const tip = openTip();
    // Centered on the second line (300 + 100/2 − 100), NOT on the union of both lines
    // (which would be 440), and sitting above that line (320 − 100 − 8).
    await vi.waitFor(() => expect(tip.style.left).toBe("250px"));
    expect(tip.style.top).toBe("212px");
  });

  test("an open tooltip tracks its reference, and dismissal stops the tracking", async () => {
    const ref = openable();
    let top = 300;
    ref.getBoundingClientRect = () => rect(400, top, 40, 14);

    click(ref);
    const tip = openTip();
    await vi.waitFor(() => expect(tip.style.top).toBe("192px"));

    // The page scrolls under the reference: `autoUpdate` repositions the open tooltip, which
    // the old one-shot measurement never did.
    top = 200;
    window.dispatchEvent(new Event("scroll"));
    await vi.waitFor(() => expect(tip.style.top).toBe("92px"));

    const removals = vi.spyOn(window, "removeEventListener");
    try {
      document.dispatchEvent(
        new KeyboardEvent("keydown", { key: "Escape", bubbles: true })
      );
      expect(document.querySelector(".nota-def-tooltip-open")).toBeNull();
      expect(removals.mock.calls.some(([type]) => type === "scroll")).toBe(
        true
      );
    } finally {
      removals.mockRestore();
    }
  });
});
