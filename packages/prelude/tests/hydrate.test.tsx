/**
 * Hydrate prelude components from separately built server bytes. Check DOM adoption and
 * diagnostics, including lifecycle hydration-id parity.
 */
import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { hydrate } from "@solidjs/web";
import { createComponent, flush, sharedConfig } from "solid-js";
import {
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  test,
  vi
} from "vitest";
import { resetConfigForTest, resetDefTooltipHandlersForTest } from "../src/lib";
import { Doc } from "./fixtures/hydrate-doc";

const pkgRoot = process.cwd();
let pageHtml: string;

beforeAll(() => {
  execSync("node tests/hydrate-ssr.mjs", { cwd: pkgRoot, stdio: "pipe" });
  pageHtml = readFileSync(
    join(pkgRoot, "tests/.built/hydrate-page.html"),
    "utf8"
  );
}, 60_000);

beforeEach(() => {
  resetConfigForTest();
  resetDefTooltipHandlersForTest();
  // A fresh page: Solid's hydration bootstrap global (still `_$HY` in 2.0) and `sharedConfig.done`.
  Object.assign(globalThis, {
    _$HY: { events: [], completed: new WeakSet(), r: {} }
  });
  sharedConfig.done = false;
  const page = new DOMParser().parseFromString(pageHtml, "text/html");
  document.head.innerHTML = page.head.innerHTML;
  document.body.innerHTML = page.body.innerHTML;
});

afterEach(() => {
  resetDefTooltipHandlersForTest();
  for (const tip of document.querySelectorAll(".nota-def-tooltip-open")) {
    tip.remove();
  }
});

const app = () => document.getElementById("app") as HTMLElement;
const tocLinks = () =>
  [...document.querySelectorAll("#app nav.nota-toc a")].map(a => a.textContent);

/** Hydrate the fixture, returning everything it printed to the console. */
function claim(): { noise: string[]; root: HTMLElement } {
  const root = app();
  const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
  const error = vi.spyOn(console, "error").mockImplementation(() => {});
  try {
    hydrate(() => createComponent(Doc, {}), root);
    flush();
    return {
      // Everything, not just /[Hh]ydration/: the dom project runs Solid's dev build, whose
      // diagnostics (hydration key misses, STRICT_READ_UNTRACKED, owned-write) all land here,
      // and a clean claim of this document prints none of them.
      noise: [...warn.mock.calls, ...error.mock.calls].flat().map(String),
      root
    };
  } finally {
    warn.mockRestore();
    error.mockRestore();
  }
}

/** Snapshot elements, including trailers, to detect replacement during hydration. */
const claimedBody = (root: HTMLElement) => [...root.querySelectorAll("*")];

describe("prelude components hydrate in id parity with the server", () => {
  test("the server bytes already carry the resolved forward references", () => {
    expect(tocLinks()).toEqual(["Alpha", "Beta"]);
    const refs = [...document.querySelectorAll("#app p a.nota-ref")].map(
      a => a.textContent
    );
    expect(refs).toEqual(["Beta", "Nota", "Alpha"]);
    expect(document.body.innerHTML).not.toContain("?</a>");
  });

  test("hydration claims the document — no key misses, no rebuilt nodes", () => {
    const before = claimedBody(app());
    // Named, because the trailer outlet is the part this suite used to exempt.
    const bankBefore = app().querySelector(".nota-def-tooltips");
    const notesBefore = app().querySelector(".nota-notes");
    if (!bankBefore || !notesBefore)
      throw new Error("no trailers in the bytes");
    const { noise, root } = claim();
    expect(noise).toEqual([]);
    expect(root.querySelector(".nota-def-tooltips")).toBe(bankBefore);
    expect(root.querySelector(".nota-notes")).toBe(notesBefore);
    // Identity is the other half of the proof: a client whose ids are misaligned builds a
    // *detached* tree and leaves the page untouched, which an innerHTML comparison cannot see.
    // These are the very same element objects — including the `Toc`/`Ref` nodes whose content
    // only the seed can produce.
    expect(claimedBody(root)).toEqual(before);
    expect(tocLinks()).toEqual(["Alpha", "Beta"]);
  });

  test("DefBank's onSettled install runs on the client, so tooltips work on the claimed DOM", () => {
    const { root } = claim();
    const ref = root.querySelector("a[data-nota-def]");
    if (!ref) throw new Error("no def ref");
    ref.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    const tip = document.querySelector(".nota-def-tooltip-open");
    expect(tip?.textContent).toBe("A document language.");
  });
});
