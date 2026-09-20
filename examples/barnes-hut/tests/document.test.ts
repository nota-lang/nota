// @vitest-environment jsdom
/**
 * The document end-to-end: `nota build` the real barnes-hut.nota, then boot the emitted page
 * in jsdom the way a browser would (install the body, eval the hydration bootstrap + client
 * IIFE in document order) and drive the prose controls — the acceptance test that the
 * explorable actually explores:
 *
 * - SSR bakes the whole article (title, diagram, sliders, plots, note);
 * - hydration claims it, and an @Do action link flips the diagram into construction mode;
 * - the step slider inserts points (quadtree cells appear and grow);
 * - a legend button focuses a θ series (the other series dim in BOTH charts).
 */
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { beforeAll, describe, expect, test } from "vitest";

const here = dirname(fileURLToPath(import.meta.url));
const exampleDir = join(here, "..");
const outDir = join(exampleDir, "barnes-hut");

let html = "";

beforeAll(() => {
  execFileSync(
    process.execPath,
    [
      join(exampleDir, "..", "..", "packages", "cli", "bin", "nota.mjs"),
      "build",
      join(exampleDir, "barnes-hut.nota"),
      "--title",
      "The Barnes-Hut Approximation"
    ],
    { stdio: "pipe" }
  );
  html = readFileSync(join(outDir, "index.html"), "utf8");
});

function bodyOf(doc: string): string {
  const m = doc.match(/<body>([\s\S]*)<\/body>/i);
  if (!m) {
    throw new Error("no <body> in emitted HTML");
  }
  return m[1];
}

/** Boot the page: install the body, then eval head bootstrap + client IIFE in order. */
function boot() {
  // Reset Solid's hydration handshake (a realm global) — see cli/tests/hydration.test.ts.
  // v2 sets `_$HY.done` on a `setTimeout` right after hydration, and `hydrate()` silently
  // falls back to a client `render()` once it is up, so the delete is load-bearing.
  delete (globalThis as { _$HY?: unknown })._$HY;
  const headScript = html.match(/<head>[\s\S]*?<script>([\s\S]*?)<\/script>/i);
  const src = html.match(/<script src="\.\/(assets\/[^"]+)"><\/script>/);
  if (!headScript || !src) {
    throw new Error("expected hydration scripts in the page");
  }
  document.body.innerHTML = bodyOf(html).replace(
    /<script src="[^"]*"><\/script>/,
    ""
  );
  // biome-ignore lint/security/noGlobalEval: faithfully simulates the browser running the page's scripts.
  globalThis.eval(headScript[1]);
  // biome-ignore lint/security/noGlobalEval: faithfully simulates the browser running the page's scripts.
  globalThis.eval(readFileSync(join(outDir, src[1]), "utf8"));
}

const click = (el: Element) =>
  el.dispatchEvent(new MouseEvent("click", { bubbles: true }));

const sleep = (ms: number) =>
  new Promise<void>(resolve => setTimeout(resolve, ms));

describe("the built page", () => {
  test("SSR bakes the whole article", () => {
    expect(html).toContain("<h1 _hk="); // headings hydratable
    expect(html).toContain("The Barnes-Hut Approximation");
    expect(html).toContain('class="bh"');
    expect((html.match(/<input type="range"/g) ?? []).length).toBe(3);
    expect((html.match(/class="plot-line"/g) ?? []).length).toBe(7);
    expect(html).toContain("To promote visibility"); // the note's body
    expect(html).toContain('<link rel="stylesheet"');
  });

  test("hydration + the explorable arc: actions, slider, focus", async () => {
    boot();
    const q = <T extends Element>(sel: string) =>
      document.querySelector(sel) as T | null;
    const qa = (sel: string) => [...document.querySelectorAll(sel)];

    // Hydrated: the action links are live buttons.
    const actions = qa("button.nota-action");
    expect(actions.length).toBeGreaterThan(10);

    // Initial network phase: no quadtree cells.
    expect(qa(".bh-quads rect").length).toBe(0);

    // "insert the first point into the quadtree" → construction mode, cells appear.
    const insertFirst = actions.find(a =>
      a.textContent?.includes("insert the first point")
    );
    expect(insertFirst).toBeTruthy();
    click(insertFirst as Element);
    await Promise.resolve();
    const cellsAt1 = qa(".bh-quads rect").length;
    expect(cellsAt1).toBeGreaterThan(0);
    expect(qa(".bh-inserted").length).toBe(1); // the insertion pop

    // The step slider follows the outside write (value moved to 1)...
    const slider = qa("input[type=range]").find(
      i => (i as HTMLInputElement).max === "77"
    ) as HTMLInputElement;
    expect(slider.value).toBe("1");

    // ...and driving it inserts more points: the subdivision grows.
    slider.value = "40";
    slider.dispatchEvent(new Event("input", { bubbles: true }));
    await Promise.resolve();
    expect(qa(".bh-quads rect").length).toBeGreaterThan(cellsAt1);

    // An action whose patch READS the store (`step: Math.min(S.step + 1, 77)`): the prop
    // getter must see the settled value, not the setter's draft.
    const insertMore = actions.find(a => a.textContent?.includes("insertion"));
    expect(insertMore).toBeTruthy();
    click(insertMore as Element);
    await Promise.resolve();
    expect(slider.value).toBe("41");

    // "we can compute interactions with centers of mass" → estimation with θ=1:
    // probe + net-force vector + approximated cells appear.
    // (Button text spans a source line, so its textContent holds a soft "\n" break —
    // match on a fragment that doesn't cross it.)
    const estimate = actions.find(a =>
      a.textContent?.includes("compute interactions")
    );
    expect(estimate).toBeTruthy();
    click(estimate as Element);
    await Promise.resolve();
    expect(q(".bh-probe")).toBeTruthy();
    expect(q(".bh-force-vector")).toBeTruthy();
    expect(qa(".bh-used-cell").length).toBeGreaterThan(0);
    // ...and the θ slider tracked the action's write.
    const theta = qa("input[type=range]").find(
      i => (i as HTMLInputElement).max === "2"
    ) as HTMLInputElement;
    expect(theta.value).toBe("1");

    // Focusing θ=1 in a legend dims the other series in BOTH charts (7 series total,
    // one θ=1 line per chart stays: 5 dimmed).
    const legend = qa("button.plot-legend-item").find(b =>
      b.textContent?.includes("θ = 1")
    ) as HTMLButtonElement;
    legend.dispatchEvent(new FocusEvent("focusin", { bubbles: true }));
    legend.focus();
    legend.dispatchEvent(new FocusEvent("focus"));
    await Promise.resolve();
    expect(qa(".plot-series.is-dimmed").length).toBe(5);
  });

  /**
   * The live layout: d3's tick handler writes every point into the store as ONE draft and the
   * SVG follows. Under Solid 2 that write is only visible after the flush, so this pins the
   * tick → draft → DOM path end to end (it is what `batch` used to buy).
   */
  test("the running simulation moves the rendered nodes", async () => {
    boot();
    const qa = (sel: string) => [...document.querySelectorAll(sel)];
    const cxs = () => qa(".bh-nodes circle").map(c => c.getAttribute("cx"));

    const before = cxs();
    expect(before).toHaveLength(77);
    await sleep(200);
    expect(cxs()).not.toEqual(before);

    // Park the simulation so it does not keep ticking past this test.
    const reset = qa("button.nota-action").find(a =>
      a.textContent?.includes("a set of two-dimensional input points")
    );
    click(reset as Element);
    await Promise.resolve();
  });

  /**
   * The center-of-mass arc, which the phase actions above never reach. It is the one place a
   * single store write carries BOTH a phase change (`layout: false`) and the `accumulate` bump
   * that starts the animation: under Solid 2 those land in one flush, so the "a phase changed,
   * cancel the animation" rule and the "accumulate bumped, start it" rule have to be decided
   * together rather than by two effects racing in creation order.
   */
  test("the centers-of-mass action plays the accumulation animation", async () => {
    boot();
    const qa = (sel: string) => [...document.querySelectorAll(sel)];

    const accumulate = qa("button.nota-action").find(a =>
      a.textContent?.includes("we calculate centers of mass")
    );
    expect(accumulate).toBeTruthy();
    expect(qa(".bh-accum").length).toBe(0);

    click(accumulate as Element);
    await Promise.resolve();
    expect(qa(".bh-accum").length).toBe(1);

    // Stage 0 pops 600 ms in (real timers: the page's own setTimeout chain).
    await sleep(750);
    expect(qa(".bh-com-pop").length).toBeGreaterThan(0);
    expect(qa(".bh-flash-box").length).toBeGreaterThan(0);
  });

  test("assets exist on disk", () => {
    const css = html.match(/href="\.\/(assets\/[^"]+\.css)"/);
    expect(css).toBeTruthy();
    expect(existsSync(join(outDir, (css as RegExpMatchArray)[1]))).toBe(true);
  });
});
