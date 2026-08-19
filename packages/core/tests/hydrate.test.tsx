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
import { createSignal, Show, sharedConfig } from "solid-js";
import { render } from "solid-js/web";
import { beforeAll, describe, expect, test } from "vitest";
import {
  createDocState,
  DOC_STATE_ID,
  DocStateContext,
  hydrateDocument,
  useDocState
} from "../src/lib";
import { Doc, PlainDoc } from "./fixtures/doc";

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
  ssrPlainBody = readFileSync(
    join(pkgRoot, "tests/.built/body-plain.html"),
    "utf8"
  );
}, 60_000);

let ssrScopedBody: string;
let ssrPlainBody: string;

/** The fixture's smart-punct sentence, as the server must have transformed it. */
const SMART_SENTENCE = "She said “stop”–then—a pause… done.";

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

  test("smart punctuation is baked into the served HTML", () => {
    // The straight forms went in (fixture); the curly/em-dash forms come out. The zero-mutation
    // assertion in the hydration test below then proves the client re-derives this exact text
    // while claiming (the transform runs identically server- and client-side).
    expect(ssrBody).toContain(SMART_SENTENCE);
    expect(ssrBody).not.toContain('"stop"');
    expect(ssrBody).not.toContain("-- then"); // (bare `--` occurs in comment markers)
    expect(ssrBody).not.toContain("pause...");
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
    // The observed DOM includes the smart-transformed prose — the zero-mutation assertion below
    // therefore proves hydration CLAIMED the transformed text (client re-ran the same transform).
    expect(htmlBefore).toContain(SMART_SENTENCE);

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
    const toggle = article.querySelector("button.toggle-heading");
    if (!toggle) throw new Error("no toggle button");
    click(toggle);
    expect(article.querySelector("#gamma")).toBeTruthy();
    expect(nav.querySelectorAll("a")).toHaveLength(3);
    expect(nav.textContent).toContain("Gamma");

    // Toggling OFF unmounts the heading — onCleanup unregisters it, and the Toc shrinks back.
    click(toggle);
    expect(article.querySelector("#gamma")).toBeNull();
    expect(nav.querySelectorAll("a")).toHaveLength(2);
    expect([...nav.querySelectorAll("a")].map(a => a.textContent)).toEqual([
      "Alpha",
      "Beta"
    ]);

    // And back ON: a fresh registration restores the final heading.
    click(toggle);
    expect([...nav.querySelectorAll("a")].map(a => a.textContent)).toEqual([
      "Alpha",
      "Beta",
      "Gamma"
    ]);

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
});

describe("hydrateDocument fallbacks", () => {
  test("default root resolves #nota-root; default seed reads the page script", () => {
    Object.assign(globalThis, {
      _$HY: { events: [], completed: new WeakSet(), r: {} }
    });
    sharedConfig.done = false;
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

    const observer = new MutationObserver(() => {});
    observer.observe(article, {
      childList: true,
      characterData: true,
      subtree: true
    });
    const dispose = hydrateDocument(Doc); // no opts at all: root + seed both defaulted
    const visible = observer
      .takeRecords()
      .filter(r =>
        [...r.addedNodes, ...r.removedNodes].some(n => n.nodeType !== 8)
      );
    observer.disconnect();
    expect(visible).toEqual([]); // claimed in the default root, under the page seed
    expect(root.querySelector("article.nota-doc")).toBe(article);
    const counter = article.querySelector("button.counter");
    if (!counter) throw new Error("no counter");
    click(counter);
    expect(counter.textContent).toBe("clicks: 1");

    dispose();
    root.remove();
    stateEl.remove();
  });

  test("no #nota-root falls back to document.body; no seed script means unseeded hydration", () => {
    Object.assign(globalThis, {
      _$HY: { events: [], completed: new WeakSet(), r: {} }
    });
    sharedConfig.done = false;
    // PlainDoc reads no doc-state, so seedless hydration must still claim byte-for-byte.
    document.body.innerHTML = ssrPlainBody;
    expect(document.getElementById("nota-root")).toBeNull(); // → body fallback
    expect(document.getElementById(DOC_STATE_ID)).toBeNull(); // → readPageSeed() undefined
    const article = document.body.querySelector("article.nota-doc");
    if (!article) throw new Error("no article");

    const observer = new MutationObserver(() => {});
    observer.observe(article, {
      childList: true,
      characterData: true,
      subtree: true
    });
    const dispose = hydrateDocument(PlainDoc);
    const visible = observer
      .takeRecords()
      .filter(r =>
        [...r.addedNodes, ...r.removedNodes].some(n => n.nodeType !== 8)
      );
    observer.disconnect();
    expect(visible).toEqual([]); // claimed into <body>, unseeded
    expect(document.body.querySelector("article.nota-doc")).toBe(article);
    const counter = article.querySelector("button.counter");
    if (!counter) throw new Error("no counter");
    click(counter);
    expect(counter.textContent).toBe("clicks: 1");

    dispose();
    document.body.innerHTML = "";
  });
});

describe("doc-state unregistration (client)", () => {
  test("unmount unregisters via onCleanup; remount registers at the end", () => {
    const state = createDocState();
    const Reg = (p: { id: string }) => {
      useDocState().register("heading", { id: p.id });
      return null;
    };
    const [mid, setMid] = createSignal(true);
    const root = document.createElement("div");
    document.body.appendChild(root);
    const dispose = render(
      () => (
        <DocStateContext.Provider value={state}>
          <Reg id="a" />
          <Show when={mid()}>
            <Reg id="b" />
          </Show>
          <Reg id="c" />
        </DocStateContext.Provider>
      ),
      root
    );
    expect(state.live("heading").map(f => f.id)).toEqual(["a", "b", "c"]);

    setMid(false); // <Show> unmounts b → onCleanup unregisters it
    expect(state.live("heading").map(f => f.id)).toEqual(["a", "c"]);

    setMid(true); // Without a NotaSource boundary, the remount appends.
    expect(state.live("heading").map(f => f.id)).toEqual(["a", "c", "b"]);

    dispose();
    root.remove();
  });
});
