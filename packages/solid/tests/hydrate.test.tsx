/**
 * The load-bearing e2e (dom project): server-render the fixture document out-of-process
 * (tests/ssg.mjs — SSR-compiled, two-pass, seeded), then hydrate the resulting HTML with the
 * client-compiled program and verify that Solid CLAIMS the reforested, forward-referencing DOM —
 * wrappers, Toc-above-its-headings, and all — without mutating it; that interactivity works on
 * the claimed nodes; and that doc-state turns reactive after the seed is released.
 */
import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { sharedConfig } from "solid-js";
import { beforeAll, describe, expect, test } from "vitest";
import { DOC_STATE_ID, hydrateDocument, onRenderReset } from "../src/lib";
import { Doc } from "./fixtures/doc";

// vitest runs with cwd at the package root.
const pkgRoot = process.cwd();
let ssrBody: string;
let ssrState: string;

beforeAll(() => {
  execSync("node tests/ssg.mjs", { cwd: pkgRoot, stdio: "pipe" });
  ssrBody = readFileSync(join(pkgRoot, "tests/.built/body.html"), "utf8");
  ssrState = readFileSync(join(pkgRoot, "tests/.built/state.json"), "utf8");
  ssrScopedBody = readFileSync(
    join(pkgRoot, "tests/.built/body-scoped.html"),
    "utf8"
  );
}, 60_000);

let ssrScopedBody: string;

const click = (el: Element) =>
  el.dispatchEvent(new MouseEvent("click", { bubbles: true }));

// Hydration keys and insertion-marker comments are claim-time bookkeeping (Solid removes a
// `<!--!$-->` marker when claiming a null dynamic slot); strip both when comparing markup.
const normalize = (html: string) =>
  html.replace(/\s*data-hk="[^"]*"/g, "").replace(/<!--\/?!?\$?-->/g, "");

describe("ssg + hydration", () => {
  test("the static HTML is reforested with forward references resolved", () => {
    const host = document.createElement("div");
    host.innerHTML = ssrBody;
    const article = host.querySelector("article.nota-doc");
    if (!article) throw new Error("no article");
    // Paragraph inference + list coalescing in dead HTML.
    expect(article.querySelectorAll("p.nota-para").length).toBeGreaterThan(2);
    expect(article.querySelectorAll("ul.nota-list > li")).toHaveLength(2);
    expect(article.querySelectorAll("section.nota-section")).toHaveLength(2);
    // The Toc PRECEDES the headings yet lists them (two-pass seed).
    const nav = article.querySelector("nav.toc");
    if (!nav) throw new Error("no nav");
    expect(nav.textContent).toContain("Alpha");
    expect(nav.textContent).toContain("Beta");
    expect(
      nav.compareDocumentPosition(article.querySelector("#alpha") as Element) &
        Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy();
    // The trailer landed at document end.
    expect(article.lastElementChild?.matches("footer.colophon")).toBe(true);
  });

  test("hydration claims the reforested DOM; doc-state goes reactive after release", () => {
    Object.assign(globalThis, {
      _$HY: { events: [], completed: new WeakSet(), r: {} }
    });
    const root = document.createElement("div");
    root.id = "nota-root";
    document.body.appendChild(root);
    root.innerHTML = ssrBody;
    const stateEl = document.createElement("script");
    stateEl.type = "application/json";
    stateEl.id = DOC_STATE_ID;
    stateEl.textContent = ssrState;
    document.body.appendChild(stateEl);

    const article = root.querySelector("article.nota-doc");
    if (!article) throw new Error("no article");
    const counter = article.querySelector("button.counter");
    if (!counter) throw new Error("no counter");
    const htmlBefore = normalize(article.innerHTML);

    // Watch for any structural or text mutation during hydration + seed release.
    const observer = new MutationObserver(() => {});
    observer.observe(article, {
      childList: true,
      characterData: true,
      subtree: true
    });

    const dispose = hydrateDocument(Doc, { root });

    const records = observer.takeRecords();
    observer.disconnect();
    // Solid's hydration removes its own `<!--!$-->` insertion markers when claiming a null
    // dynamic slot (the false <Show>); comment-node bookkeeping is invisible. Anything else —
    // element or text churn — means the DOM was rebuilt rather than claimed.
    const visible = records.filter(r =>
      [...r.addedNodes, ...r.removedNodes].some(n => n.nodeType !== 8)
    );
    expect(visible).toEqual([]); // claimed, not rebuilt — including through release()
    expect(root.querySelector("article.nota-doc")).toBe(article);
    expect(normalize(article.innerHTML)).toBe(htmlBefore);

    // Interactivity attached to the claimed nodes.
    click(counter);
    click(counter);
    expect(counter.textContent).toBe("clicks: 2");

    // Doc-state is live now: mounting a new heading updates the (claimed) Toc.
    const nav = article.querySelector("nav.toc");
    if (!nav) throw new Error("no nav");
    expect(nav.querySelectorAll("a")).toHaveLength(2);
    const add = article.querySelector("button.add-heading");
    if (!add) throw new Error("no add button");
    click(add);
    expect(article.querySelector("#gamma")).toBeTruthy();
    expect(nav.querySelectorAll("a")).toHaveLength(3);
    expect(nav.textContent).toContain("Gamma");

    dispose();
    root.remove();
    stateEl.remove();
  });

  test("host-embedded shape: explicit root + seed + matching renderId claims without mutation", () => {
    // The Astro-island transport: no page-global state script, no #nota-root — the host hands
    // the driver everything (renderDocument was called with renderId "s0" server-side).
    Object.assign(globalThis, {
      _$HY: { events: [], completed: new WeakSet(), r: {} }
    });
    // Simulate a fresh page: the previous test's click() ran Solid's delegated-event handler,
    // which flips module-level sharedConfig.done ("hydration era over" — later hydrates rebuild
    // instead of claim). A real page load starts with it unset, like _$HY above.
    sharedConfig.done = false;
    const island = document.createElement("div");
    document.body.appendChild(island);
    island.innerHTML = ssrScopedBody;
    const article = island.querySelector("article.nota-doc");
    if (!article) throw new Error("no article");
    expect(ssrScopedBody).toContain('data-hk="s0'); // precondition: scoped keys

    const observer = new MutationObserver(() => {});
    observer.observe(article, {
      childList: true,
      characterData: true,
      subtree: true
    });
    const dispose = hydrateDocument(Doc, {
      root: island,
      renderId: "s0",
      seed: JSON.parse(ssrState)
    });
    const visible = observer
      .takeRecords()
      .filter(r =>
        [...r.addedNodes, ...r.removedNodes].some(n => n.nodeType !== 8)
      );
    observer.disconnect();
    expect(visible).toEqual([]); // claimed, not rebuilt
    expect(island.querySelector("article.nota-doc")).toBe(article);

    // Interactivity attached to the claimed nodes.
    const counter = article.querySelector("button.counter");
    if (!counter) throw new Error("no counter");
    click(counter);
    expect(counter.textContent).toBe("clicks: 1");

    dispose();
    island.remove();
  });

  test("hydrateDocument runs the render resets once, before claiming", () => {
    Object.assign(globalThis, {
      _$HY: { events: [], completed: new WeakSet(), r: {} }
    });
    sharedConfig.done = false;
    let runs = 0;
    const off = onRenderReset(() => {
      runs += 1;
    });
    const root = document.createElement("div");
    document.body.appendChild(root);
    root.innerHTML = ssrBody;
    const dispose = hydrateDocument(Doc, {
      root,
      seed: JSON.parse(ssrState)
    });
    // One render on the client = one reset (replay starts from the baseline, like each SSG pass).
    expect(runs).toBe(1);
    dispose();
    off();
    root.remove();
  });
});
