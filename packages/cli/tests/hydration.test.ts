/**
 * Load built CLI pages in jsdom, execute their scripts, and verify DOM adoption and interactivity.
 * Covers closures, conditionals, dynamic tags, and definition tooltips.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterAll, afterEach, beforeAll, describe, expect, test } from "vitest";
import {
  BUILT_DIR,
  CLOSURE_BUILT_DIR,
  CONDITIONAL_BUILT_DIR,
  DYNAMIC_BUILT_DIR,
  indexHtmlOf
} from "./builtHtmlPath";

let HTML = "";
let CLOSURE_HTML = "";
let CONDITIONAL_HTML = "";
let DYNAMIC_HTML = "";
beforeAll(() => {
  HTML = readFileSync(indexHtmlOf(BUILT_DIR), "utf8");
  CLOSURE_HTML = readFileSync(indexHtmlOf(CLOSURE_BUILT_DIR), "utf8");
  CONDITIONAL_HTML = readFileSync(indexHtmlOf(CONDITIONAL_BUILT_DIR), "utf8");
  DYNAMIC_HTML = readFileSync(indexHtmlOf(DYNAMIC_BUILT_DIR), "utf8");
});

/**
 * Capture page console output to catch silent hydration failures. Production bundles omit
 * Solid dev diagnostics, but retain uncaught-error reporting.
 */
const consoleOutput: string[] = [];
const CAPTURED = ["error", "warn", "log", "info"] as const;
const originalConsole = CAPTURED.map(m => [m, console[m]] as const);

beforeAll(() => {
  for (const [method, original] of originalConsole) {
    console[method] = (...args: unknown[]) => {
      consoleOutput.push(`console.${method}: ${args.map(String).join(" ")}`);
      // Still forward: a captured failure should be readable in the run's output too.
      (original as (...a: unknown[]) => void)(...args);
    };
  }
});

afterAll(() => {
  for (const [method, original] of originalConsole) {
    console[method] = original;
  }
});

afterEach(() => {
  document.body.innerHTML = "";
  const spoke = [...consoleOutput];
  consoleOutput.length = 0;
  expect(spoke, "the page's scripts wrote to the console").toEqual([]);
});

/** Extract the `<body>…</body>` inner HTML from a full document string. */
function bodyOf(html: string): string {
  const m = html.match(/<body>([\s\S]*)<\/body>/i);
  if (!m) {
    throw new Error("no <body> in emitted HTML");
  }
  return m[1];
}

/**
 * Install body markup, retaining the JSON seed, then evaluate scripts in document order.
 * Reset the global hydration handshake between boots. afterInstall inspects pre-hydration DOM.
 */
function loadAndBoot(
  dir: string,
  html: string,
  afterInstall?: () => void
): void {
  delete (globalThis as { _$HY?: unknown })._$HY;
  consoleOutput.length = 0;
  document.body.innerHTML = bodyOf(html).replace(
    /<script(?![^>]*application\/json)[\s\S]*?<\/script>/gi,
    ""
  );
  afterInstall?.();
  const scripts = [
    ...html.matchAll(/<script(\s[^>]*)?>([\s\S]*?)<\/script>/gi)
  ];
  for (const [, attrs = "", inline] of scripts) {
    if (/application\/json/.test(attrs)) {
      continue;
    }
    const src = /src="([^"]+)"/.exec(attrs)?.[1];
    const code = src
      ? readFileSync(join(dir, src.replace(/^\.\//, "")), "utf8")
      : inline;
    // biome-ignore lint/security/noGlobalEval: faithfully simulates the browser running the page's scripts.
    globalThis.eval(code);
  }
}

/** Let the separately bundled Solid runtime flush after a click. */
const click = async (el: Element): Promise<void> => {
  el.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  await Promise.resolve();
};

/** {@link click}'s counterpart for a document-level key press. */
const keydown = async (key: string): Promise<void> => {
  document.dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true }));
  await Promise.resolve();
};

describe("golden.nota: served page hydrates and reacts", () => {
  test("the SSR-baked span claims and flips color on click", async () => {
    loadAndBoot(BUILT_DIR, HTML);
    const spans = Array.from(document.querySelectorAll("ul li span"));
    expect(spans).toHaveLength(2);
    const before = spans[0];
    expect((before as HTMLElement).style.color).toBe("red");

    await click(before);
    // Same node (claimed, not rebuilt), new signal-driven style.
    expect(document.querySelectorAll("ul li span")[0]).toBe(before);
    expect((before as HTMLElement).style.color).toBe("green");
    // The sibling is an independent instance.
    expect((spans[1] as HTMLElement).style.color).toBe("red");
  });
});

describe("closure.nota: document-local components with per-instance state", () => {
  test("SSR bakes the destructured @for forms", () => {
    // Interpolated text carries hydration markers (`<!--$-->a<!--/-->…`) in the raw HTML —
    // strip them (and the unquoted `_hk=…` keys) to assert the readable shape.
    const clean = CLOSURE_HTML.replace(/\s*_hk=[^\s>]+/g, "").replace(
      /<!--\/?!?\$?-->/g,
      ""
    );
    // `{ key } of` — object-pattern binding, one cell per row, all counters at 0.
    expect(clean).toContain('class="cell">a=0</button>');
    expect(clean).toContain('class="cell">b=0</button>');
    // `[k, v] of` — array-pattern binding over pair literals.
    expect(clean).toContain('class="kv">p=1</span>');
    expect(clean).toContain('class="kv">q=2</span>');
  });

  test("each loop-defined button closes over its x and counts independently", async () => {
    loadAndBoot(CLOSURE_BUILT_DIR, CLOSURE_HTML);
    // The sugar list only (`- @Example{}` coalesces to ul.nota-list); the Grid's explicit
    // @ul holds its own buttons.
    const buttons = Array.from(
      document.querySelectorAll("ul.nota-list li button")
    );
    expect(buttons).toHaveLength(2);
    expect(buttons[0].textContent).toContain("x=1");
    expect(buttons[0].textContent).toContain("n=0");
    expect(buttons[1].textContent).toContain("x=2");

    await click(buttons[0]);
    await click(buttons[0]);
    await click(buttons[1]);
    expect(buttons[0].textContent).toContain("n=2");
    expect(buttons[1].textContent).toContain("n=1");
    // Claimed nodes, not rebuilt.
    expect(document.querySelectorAll("ul.nota-list li button")[0]).toBe(
      buttons[0]
    );
  });

  test("<For> over a signal-backed array reconciles without rebuilding stateful rows", async () => {
    loadAndBoot(CLOSURE_BUILT_DIR, CLOSURE_HTML);
    const cells = Array.from(
      document.querySelectorAll("#grid-list button.cell")
    );
    expect(cells.map(c => c.textContent)).toEqual(["a=0", "b=0"]);

    // Per-row signal state accumulates independently…
    await click(cells[0]);
    await click(cells[0]);
    await click(cells[1]);
    expect(cells.map(c => c.textContent)).toEqual(["a=2", "b=1"]);

    // …and survives a prepend: `@for` lowers to `<For>` (reference-keyed), so the existing
    // rows' nodes are MOVED, not rebuilt — same node, same counter — while the new row mounts
    // fresh at the front.
    const prepend = document.getElementById("prepend");
    if (!prepend) throw new Error("no prepend button");
    await click(prepend);
    const after = Array.from(
      document.querySelectorAll("#grid-list button.cell")
    );
    expect(after.map(c => c.textContent)).toEqual(["c=0", "a=2", "b=1"]);
    expect(after[1]).toBe(cells[0]);
    expect(after[2]).toBe(cells[1]);
  });
});

describe("conditional.nota: `@if` renders and reacts through `<Show>`", () => {
  test("SSR bakes only the taken branches", () => {
    // A fallback-less `<Show>` renders nothing when false — the untaken branch must not be in
    // the served HTML at all (the ternary emit's `: null` had the same effect; this pins that
    // the `<Show>` rewrite kept it).
    expect(CONDITIONAL_HTML).toContain("always here");
    expect(CONDITIONAL_HTML).not.toContain("never here");
    // The reactive branch starts false, so SSR bakes its `fallback`, not its consequent.
    expect(CONDITIONAL_HTML).toContain("hidden");
    expect(CONDITIONAL_HTML).not.toContain("shown");
    // The else-if chain (nested <Show> fallbacks) bakes exactly the taken MIDDLE arm:
    // n starts at 1, so `else if (n() === 1)` wins over both the head and the tail.
    expect(CONDITIONAL_HTML).toContain('id="c-one"');
    expect(CONDITIONAL_HTML).not.toContain('id="c-zero"');
    expect(CONDITIONAL_HTML).not.toContain('id="c-two"');
  });

  test("a click swaps the branch on the claimed nodes", async () => {
    loadAndBoot(CONDITIONAL_BUILT_DIR, CONDITIONAL_HTML);
    const toggle = document.querySelector("#toggle");
    const btn = toggle?.querySelector("button");
    if (!btn) throw new Error("no toggle button");
    // Hydration claimed the server's fallback rather than rebuilding it.
    expect(document.querySelector("#no")?.textContent).toBe("hidden");
    expect(document.querySelector("#yes")).toBeNull();

    await click(btn);
    expect(document.querySelector("#yes")?.textContent).toBe("shown");
    expect(document.querySelector("#no")).toBeNull();

    // And back — `<Show>` is unkeyed, so the branch swap is driven purely by `when` crossing
    // truthiness, in both directions.
    await click(btn);
    expect(document.querySelector("#no")?.textContent).toBe("hidden");
    expect(document.querySelector("#yes")).toBeNull();

    // The surrounding document is untouched by the swaps.
    expect(document.querySelector("#taken")?.textContent).toBe("always here");
    expect(document.querySelector("#untaken")).toBeNull();
  });

  test("the else-if chain walks all three arms on the claimed nodes", async () => {
    loadAndBoot(CONDITIONAL_BUILT_DIR, CONDITIONAL_HTML);
    const cycle = document.getElementById("cycle");
    const btn = document.getElementById("advance");
    if (!btn) throw new Error("no advance button");
    // Hydration claimed the SSR-baked middle arm.
    expect(document.getElementById("c-one")?.textContent).toBe("one");

    // n: 1 → 2 → 0 → 1 — the else arm, the head arm, back to the else-if arm.
    await click(btn);
    expect(document.getElementById("c-two")?.textContent).toBe("two");
    expect(document.getElementById("c-one")).toBeNull();
    await click(btn);
    expect(document.getElementById("c-zero")?.textContent).toBe("zero");
    expect(document.getElementById("c-two")).toBeNull();
    await click(btn);
    expect(document.getElementById("c-one")?.textContent).toBe("one");
    expect(document.getElementById("c-zero")).toBeNull();

    // The container is the same claimed node throughout the walk.
    expect(document.getElementById("cycle")).toBe(cycle);
  });
});

// KEEP THIS DESCRIBE LAST: booting dynamic.nota installs the def-tooltip's document-level
// listeners, which outlive the per-test body reset (the file shares one jsdom document). They
// are inert for the other fixtures (no `[data-nota-def]` targets), but last placement keeps the
// earlier tests listener-free — and the fixture must boot exactly ONCE per file, or the second
// bundle eval would stack a duplicate tooltip listener set and a click would show+hide in one go.
describe("dynamic.nota: the <Dynamic> surface + defs hydrate by claiming", () => {
  test("zero-mutation claiming; counter reacts; the def tooltip pops after hydration", async () => {
    // Observe between body install and script eval: hydration must CLAIM the server DOM, not
    // rebuild it. A mutation-free claim is the load-bearing reforest-spike property, and this
    // fixture is the exact surface where a split Solid shows up as `template is not a function`
    // inside <Dynamic> (prelude Heading) — a rebuild would light the observer up.
    let preH1: Element | null = null;
    let preFancy: Element | null = null;
    let takeRecords: () => MutationRecord[] = () => {
      throw new Error("observer never installed");
    };
    loadAndBoot(DYNAMIC_BUILT_DIR, DYNAMIC_HTML, () => {
      preH1 = document.querySelector("h1");
      preFancy = document.getElementById("fancy");
      const observer = new MutationObserver(() => {});
      observer.observe(document.body, {
        childList: true,
        subtree: true,
        attributes: true,
        characterData: true
      });
      takeRecords = () => {
        const records = observer.takeRecords();
        observer.disconnect();
        return records;
      };
    });
    // The one thing Solid 2 *adds*: an empty text node inside every dynamic range the server
    // rendered EMPTY (`<!--$--><!--/-->`) — its insertion point for a later update. This
    // fixture has two, the nested-sublist slot of each Toc entry. Nothing existing is touched:
    // no element is created, moved or removed, no attribute and no text changes, which is the
    // whole of what a rebuild would show. So the assertion is on those records, with the empty
    // placeholders excluded by shape rather than by count.
    const rebuildRecords = takeRecords().filter(
      record =>
        record.type !== "childList" ||
        [...record.addedNodes, ...record.removedNodes].some(
          node => node.nodeType !== Node.TEXT_NODE || node.textContent !== ""
        )
    );
    expect(rebuildRecords).toEqual([]);

    // The Dynamic-rendered heading and the dynamic-tag element are claimed, not rebuilt.
    expect(preH1).not.toBeNull();
    expect(document.querySelector("h1")).toBe(preH1);
    expect(document.getElementById("fancy")).toBe(preFancy);
    expect(document.getElementById("fancy")?.tagName).toBe("MARK");
    // The forward Toc resolved during SSG and survived claiming.
    const toc = document.querySelector("nav.nota-toc");
    expect(toc?.textContent).toContain("1 Alpha");
    expect(toc?.textContent).toContain("2 Beta");

    // Interactivity: the signal-driven counter reacts on the claimed node.
    const counter = document.getElementById("counter");
    if (!counter) throw new Error("no counter button");
    expect(counter.textContent).toBe("n=0");
    await click(counter);
    expect(counter.textContent).toBe("n=1");
    expect(document.getElementById("counter")).toBe(counter);

    // The def tooltip's hydration path (DefBank's onSettled handler installation — the arc
    // prelude/tests/tooltip.test.tsx attributes to this suite): click the reference → the bank
    // entry clones open; Escape dismisses.
    const ref = document.querySelector("a[data-nota-def]");
    if (!ref) throw new Error("no def ref");
    expect(ref.getAttribute("href")).toBe("#def-nota"); // no-JS fallback intact
    await click(ref);
    const tip = document.querySelector(".nota-def-tooltip-open");
    expect(tip?.textContent).toBe("A document language.");
    await keydown("Escape");
    expect(document.querySelector(".nota-def-tooltip-open")).toBeNull();
  });
});
