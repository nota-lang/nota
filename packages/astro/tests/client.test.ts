/**
 * The client entry's contract test (dom project): construct the `<astro-island>` DOM shape the
 * server entry emits (attributes verified against a real `astro build` of the fixture site) and
 * invoke the entry the way Astro's island element does — `hydrator = mod.default(element)`, then
 * `hydrator(Component, props, slots, { client })` — asserting:
 *
 * - **hydrate** (`client:load` + `ssr`): claims the server DOM (node identity, zero visible
 *   mutations), interactivity attaches to the claimed nodes, the seeded forward Toc survives;
 * - **CSR** (`client:only` + `ssr`, no server HTML): renders fresh, forward references resolve
 *   reactively;
 * - **dispose** (`astro:unmount`, dispatched by Astro on view-transition swap-out): the Solid
 *   root is disposed and the island emptied;
 * - **ssr guard** (no `ssr` attribute — Astro removes it after the first hydration, and
 *   `attributeChangedCallback` re-invokes the hydrator on `props` changes): a no-op.
 *
 * The island's server bytes are built out-of-process by tests/ssg.mjs (SSR-compiled, renderId
 * "n0", exactly the server entry's renderDocument call); this project compiles the same fixture
 * document for the DOM.
 */
import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { sharedConfig } from "solid-js";
import { beforeAll, beforeEach, describe, expect, test } from "vitest";
import clientEntry from "../src/client";
import { Doc } from "./fixtures/doc";

// vitest runs with cwd at the package root.
const pkgRoot = process.cwd();
let islandHtml: string;
let stateJson: string;

beforeAll(() => {
  execSync("node tests/ssg.mjs", { cwd: pkgRoot, stdio: "pipe" });
  islandHtml = readFileSync(join(pkgRoot, "tests/.built/island.html"), "utf8");
  stateJson = readFileSync(join(pkgRoot, "tests/.built/state.json"), "utf8");
}, 60_000);

beforeEach(() => {
  // A fresh page: Solid's hydration bootstrap global (renderHydrationScript's _$HY), and
  // sharedConfig.done reset (a delegated event handler flips it — "hydration era over").
  Object.assign(globalThis, {
    _$HY: { events: [], completed: new WeakSet(), r: {} }
  });
  sharedConfig.done = false;
});

/** The island element as the server emits it (attribute shape from the e2e's real build). */
function buildIsland(opts: {
  client: string;
  ssr?: boolean;
  serverHtml?: boolean;
}): HTMLElement {
  const island = document.createElement("astro-island");
  island.setAttribute("uid", "Ztest");
  island.setAttribute("client", opts.client);
  island.setAttribute("component-export", "default");
  island.setAttribute("props", "{}");
  if (opts.ssr !== false) island.setAttribute("ssr", "");
  if (opts.serverHtml !== false) {
    island.setAttribute("data-nota-render-id", "n0");
    island.setAttribute("data-nota-doc-state", stateJson);
    island.innerHTML = islandHtml;
  }
  document.body.appendChild(island);
  return island;
}

/** Invoke the entry exactly as Astro's island element does. */
function invoke(island: HTMLElement, client: string): void {
  const hydrator = clientEntry(island);
  hydrator(Doc, {}, {}, { client });
}

const click = (el: Element) =>
  el.dispatchEvent(new MouseEvent("click", { bubbles: true }));

// Hydration keys and insertion-marker comments are claim-time bookkeeping; strip both when
// comparing markup.
const normalize = (html: string) =>
  html.replace(/\s*data-hk="[^"]*"/g, "").replace(/<!--\/?!?\$?-->/g, "");

const unmount = (island: HTMLElement) =>
  island.dispatchEvent(new CustomEvent("astro:unmount"));

describe("hydration (client:load island)", () => {
  test("claims the server DOM without mutation; interactivity attaches", () => {
    const island = buildIsland({ client: "load" });
    const article = island.querySelector("article.nota-doc");
    if (!article) throw new Error("no article");
    expect(islandHtml).toContain('data-hk="n0'); // precondition: renderId-scoped keys
    const htmlBefore = normalize(article.innerHTML);

    const observer = new MutationObserver(() => {});
    observer.observe(island, {
      childList: true,
      characterData: true,
      subtree: true
    });
    invoke(island, "load");
    const records = observer.takeRecords();
    observer.disconnect();
    // Comment-node bookkeeping (Solid removes its own insertion markers while claiming) is
    // invisible; any element or text churn means the DOM was rebuilt rather than claimed.
    const visible = records.filter(r =>
      [...r.addedNodes, ...r.removedNodes].some(n => n.nodeType !== 8)
    );
    expect(visible).toEqual([]);
    expect(island.querySelector("article.nota-doc")).toBe(article);
    expect(normalize(article.innerHTML)).toBe(htmlBefore);

    // The seeded forward reference (Toc above its headings) survived claiming.
    const nav = article.querySelector("nav.toc");
    if (!nav) throw new Error("no nav");
    expect([...nav.querySelectorAll("a")].map(a => a.textContent)).toEqual([
      "Alpha",
      "Beta"
    ]);

    // Interactivity attached to the claimed nodes.
    const counter = article.querySelector("button.counter");
    if (!counter) throw new Error("no counter");
    click(counter);
    click(counter);
    expect(counter.textContent).toBe("clicks: 2");

    unmount(island);
    island.remove();
  });

  test("astro:unmount disposes the Solid root and empties the island", () => {
    const island = buildIsland({ client: "load" });
    invoke(island, "load");
    const counter = island.querySelector("button.counter");
    if (!counter) throw new Error("no counter");
    click(counter);
    expect(counter.textContent).toBe("clicks: 1");

    unmount(island);
    // Solid's dispose (render/hydrate) tears down the reactive root and clears the container.
    expect(island.innerHTML).toBe("");
    // The disposed graph is inert: the detached counter's effect no longer runs.
    click(counter);
    expect(counter.textContent).toBe("clicks: 1");
    island.remove();
  });
});

describe("CSR (client:only island)", () => {
  test("renders fresh with no server HTML; forward references resolve reactively", () => {
    // Astro emits `ssr` on client:only islands too (it marks "hydration pending", removed
    // after); there is no server HTML and no renderer attrs.
    const island = buildIsland({ client: "only", serverHtml: false });
    invoke(island, "only");

    const article = island.querySelector("article.nota-doc");
    if (!article) throw new Error("no article");
    // Forward Toc: registered reactively during the same synchronous render.
    const nav = article.querySelector("nav.toc");
    if (!nav) throw new Error("no nav");
    expect([...nav.querySelectorAll("a")].map(a => a.textContent)).toEqual([
      "Alpha",
      "Beta"
    ]);
    const counter = article.querySelector("button.counter");
    if (!counter) throw new Error("no counter");
    click(counter);
    expect(counter.textContent).toBe("clicks: 1");

    unmount(island);
    expect(island.innerHTML).toBe("");
    island.remove();
  });

  test("client:only clears any fallback content before rendering", () => {
    const island = buildIsland({ client: "only", serverHtml: false });
    island.innerHTML = "<p class='fallback'>loading…</p>";
    invoke(island, "only");
    expect(island.querySelector(".fallback")).toBeNull();
    expect(island.querySelector("article.nota-doc")).toBeTruthy();
    unmount(island);
    island.remove();
  });
});

describe("ssr-attribute guard", () => {
  test("no `ssr` attribute → no-op (Astro removes it after the first hydration)", () => {
    const island = buildIsland({ client: "load", ssr: false });
    const before = island.innerHTML;
    invoke(island, "load");
    expect(island.innerHTML).toBe(before); // bytes untouched — not even marker cleanup
    // No interactivity was attached.
    const counter = island.querySelector("button.counter");
    if (!counter) throw new Error("no counter");
    click(counter);
    expect(counter.textContent).toBe("clicks: 0");
    island.remove();
  });
});
