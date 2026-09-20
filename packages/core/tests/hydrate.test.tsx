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
import { render } from "@solidjs/web";
import { createSignal, flush, Show, sharedConfig } from "solid-js";
import { beforeAll, describe, expect, test, vi } from "vitest";
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
const SMART_SENTENCE = "She said “stop” – then — a pause… done.";

// Solid 2 batches signal writes to a microtask, so a handler's effect has not run when
// dispatchEvent returns; `flush()` drains the queue synchronously.
const click = (el: Element) => {
  el.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  flush();
};

// Hydration keys (`_hk=…`, unquoted in Solid 2) and insertion-marker comments (`<!--$-->` /
// `<!--/-->`, plus the `<!--!$-->` a claimed null slot drops) are claim-time bookkeeping; strip
// both when comparing markup.
/**
 * Claim-time bookkeeping the rendered page does not show: Solid's own insertion-marker comments,
 * and (new in 2.0) the empty text node it drops beside one when claiming a dynamic slot. Anything
 * else — an element, or text with content — means the DOM was rebuilt rather than claimed.
 */
const visibleMutations = (records: MutationRecord[]) =>
  records.filter(r =>
    [...r.addedNodes, ...r.removedNodes].some(
      n => n.nodeType !== 8 && !(n.nodeType === 3 && n.nodeValue === "")
    )
  );

const normalize = (html: string) =>
  html.replace(/\s*_hk=[^\s>]+/g, "").replace(/<!--\/?!?\$?-->/g, "");

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

    const visible = visibleMutations(observer.takeRecords());
    observer.disconnect();
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
    expect(ssrScopedBody).toMatch(/\s_hk=s0/); // precondition: scoped keys

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
    const visible = visibleMutations(observer.takeRecords());
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
    const visible = visibleMutations(observer.takeRecords());
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
    const visible = visibleMutations(observer.takeRecords());
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

/** Hydrate under console capture, then drain the queue the walk filled. */
function claimAndFlush(hydrateIt: () => () => void): {
  noise: string[];
  dispose: () => void;
} {
  const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
  const error = vi.spyOn(console, "error").mockImplementation(() => {});
  try {
    const dispose = hydrateIt();
    // The write barrier is the whole point: Solid 2 commits signal writes at the next microtask,
    // so everything the hydration walk registered lands HERE, one read too late for any store
    // reader that ran during the walk.
    flush();
    return {
      // Everything, not just /[Hh]ydration/: the dom project runs Solid's dev build, whose
      // diagnostics (key misses, unclaimed nodes, strict-read, owned-write) all land here.
      noise: [...warn.mock.calls, ...error.mock.calls].flat().map(String),
      dispose
    };
  } finally {
    warn.mockRestore();
    error.mockRestore();
  }
}

describe("the trailer outlet", () => {
  test("the trailer subtree is claimed, and survives the post-hydration flush", () => {
    // The `hydrateDocument` (SSG / `nota build`) half of the trailer-claim property. The
    // *regression* test for the rebuild lives in tests/doc-host.test.ts, on the self-hosted
    // path where the outlet's first read lands before the walk's signal writes commit; here the
    // reads happen to fall the other way. Both paths must end with the server's trailer element
    // still in the page.
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
    const trailerBefore = article.querySelector("footer.colophon");
    if (!trailerBefore) throw new Error("no trailer in the server bytes");

    const observer = new MutationObserver(() => {});
    observer.observe(article, {
      childList: true,
      characterData: true,
      subtree: true
    });
    const { noise, dispose } = claimAndFlush(() =>
      hydrateDocument(Doc, { root })
    );
    const visible = visibleMutations(observer.takeRecords());
    observer.disconnect();

    expect(noise).toEqual([]);
    expect(visible).toEqual([]);
    // The very same element object, still in the page: claimed, not rebuilt.
    expect(article.querySelector("footer.colophon")).toBe(trailerBefore);
    expect(trailerBefore.isConnected).toBe(true);
    expect(article.lastElementChild).toBe(trailerBefore);

    dispose();
    root.remove();
    stateEl.remove();
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
        <DocStateContext value={state}>
          <Reg id="a" />
          <Show when={mid()}>
            <Reg id="b" />
          </Show>
          <Reg id="c" />
        </DocStateContext>
      ),
      root
    );
    expect(state.live("heading").map(f => f.id)).toEqual(["a", "b", "c"]);

    setMid(false); // <Show> unmounts b → onCleanup unregisters it
    flush();
    expect(state.live("heading").map(f => f.id)).toEqual(["a", "c"]);

    setMid(true); // A remount is a new registration, so it appends.
    flush();
    expect(state.live("heading").map(f => f.id)).toEqual(["a", "c", "b"]);

    dispose();
    root.remove();
  });
});
