/** Hydrate a self-hosted document from host-ssr.mjs; verify adoption, interactivity, and CSR navigation. */
import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { hydrate, render } from "@solidjs/web";
import { createComponent, flush, sharedConfig } from "solid-js";
import { beforeAll, beforeEach, describe, expect, test, vi } from "vitest";
import { DOC_STATE_ID } from "../src/lib";
import { Doc, OtherDoc, Pair } from "./fixtures/host-doc";

const pkgRoot = process.cwd();
let pageHtml: string;
let pairPageHtml: string;

beforeAll(() => {
  execSync("node tests/host-ssr.mjs", { cwd: pkgRoot, stdio: "pipe" });
  pageHtml = readFileSync(join(pkgRoot, "tests/.built/host-page.html"), "utf8");
  pairPageHtml = readFileSync(
    join(pkgRoot, "tests/.built/host-pair-page.html"),
    "utf8"
  );
}, 60_000);

/** Install one of the server pages, with a fresh hydration bootstrap. */
function installPage(html: string): void {
  // A fresh page: Solid's hydration bootstrap global (still `_$HY` in 2.0 — `hydrate()` reads
  // `_$HY.r` and the delegated-event queue lives on it), and `sharedConfig.done` reset. Setting
  // `hydrating = true` clears `done` by itself in 2.0, but the reset keeps the intent explicit.
  Object.assign(globalThis, {
    _$HY: { events: [], completed: new WeakSet(), r: {} }
  });
  sharedConfig.done = false;
  const page = new DOMParser().parseFromString(html, "text/html");
  document.head.innerHTML = page.head.innerHTML;
  document.body.innerHTML = page.body.innerHTML;
}

beforeEach(() => installPage(pageHtml));

const app = () => document.getElementById("app") as HTMLElement;
const tocLinks = () =>
  [...document.querySelectorAll("#app nav.toc a")].map(a => a.textContent);
const stateScripts = () => [
  ...document.head.querySelectorAll<HTMLScriptElement>(
    `script[id^="${DOC_STATE_ID}"]`
  )
];

describe("a self-hosted document (client)", () => {
  test("the server bytes already carry the resolved forward reference", () => {
    expect(tocLinks()).toEqual(["Alpha", "Beta"]);
    const scripts = stateScripts();
    expect(scripts).toHaveLength(1);
    // Hydration-keyed, so a second document on the page would not collide with it.
    expect(scripts[0].id).toMatch(new RegExp(`^${DOC_STATE_ID}-.+$`));
  });

  test("`sharedConfig.hydrating` is how a document knows it is claiming", () => {
    // The 1.x test (`sharedConfig.context`) is gone: that field is server-only in 2.0. `hydrating`
    // is set for the whole synchronous window of hydrate() and never set by render().
    const flags: { hydrating: boolean; inProgress: boolean | undefined }[] = [];
    const Probe = () => {
      const cfg = sharedConfig as {
        hydrating?: boolean;
        isHydrationInProgress?: () => boolean;
      };
      flags.push({
        hydrating: cfg.hydrating === true,
        inProgress: cfg.isHydrationInProgress?.()
      });
      return null;
    };
    const claimed = document.createElement("div");
    const fresh = document.createElement("div");
    document.body.append(claimed, fresh);
    hydrate(() => createComponent(Probe, {}), claimed);
    render(() => createComponent(Probe, {}), fresh);
    expect(flags.map(f => f.hydrating)).toEqual([true, false]);
    // `isHydrationInProgress` agrees but is optional (absent in CSR-only bundles), so the
    // `hydrating` field is the primary signal and this is the fallback.
    expect(flags.map(f => f.inProgress)).toEqual([true, false]);
  });

  test("hydration claims the server DOM instead of rebuilding it", () => {
    const root = app();
    const before = [...root.querySelectorAll("*")];
    // Identity alone is not enough: a client whose hydration ids are misaligned builds a
    // *detached* tree and leaves the page untouched, which looks identical. Solid 2 reports that
    // as "Hydration key miss" / "unclaimed server-rendered node(s)", so watch for it.
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    hydrate(() => createComponent(Doc, {}), root);
    flush();
    const noise = warn.mock.calls
      .flat()
      .map(String)
      .filter(m => /[Hh]ydration/.test(m));
    warn.mockRestore();
    expect(noise).toEqual([]);
    const after = [...root.querySelectorAll("*")];
    // Same element objects, in the same order: nothing was replaced.
    expect(after).toEqual(before);
    // ...and the Toc still reads correctly (no flash to empty).
    expect(tocLinks()).toEqual(["Alpha", "Beta"]);
  });

  test("the trailer subtree is claimed, not rebuilt, across the post-hydration flush", () => {
    // The regression: `DocState.trailers()` returned a fresh array on every read and tracked the
    // store's single `version` signal. Solid 2 commits signal writes at the next flush, so the
    // bumps the client's `register()`/`trailer()` calls queue during the hydration walk landed
    // *after* `TrailerOutlet`'s first read — the outlet re-ran, re-`.map`ped its thunks, and
    // Solid replaced the trailer DOM it had just claimed. On a real page that is the definition
    // bank and the note list blinking. Every other doc-state reader was immune because
    // `read(kind)` hands back identity-stable seeded arrays while the seed is pinned.
    const root = app();
    const trailer = root.querySelector("footer.colophon");
    if (!trailer) throw new Error("no trailer in the server bytes");
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    let noise: string[];
    try {
      hydrate(() => createComponent(Doc, {}), root);
      // The write barrier is the whole point: everything the walk registered commits HERE.
      flush();
      noise = [...warn.mock.calls, ...error.mock.calls].flat().map(String);
    } finally {
      warn.mockRestore();
      error.mockRestore();
    }
    // The very same element object, still in the page: claimed, not rebuilt.
    expect(root.querySelector("footer.colophon")).toBe(trailer);
    expect(trailer.isConnected).toBe(true);
    expect(root.querySelectorAll("footer.colophon")).toHaveLength(1);
    expect(noise).toEqual([]);
  });

  test("the client adopts the server's head tag instead of adding a second", () => {
    const before = stateScripts();
    expect(before).toHaveLength(1);
    const content = before[0].textContent;
    hydrate(() => createComponent(Doc, {}), app());
    flush();
    const after = stateScripts();
    expect(after).toHaveLength(1);
    expect(after[0].textContent).toBe(content);
    // The very same element — adopted, not re-inserted.
    expect(after[0]).toBe(before[0]);
  });

  test("two documents on one page each claim their own DOM and their own head tag", () => {
    installPage(pairPageHtml);
    const root = app();
    const before = stateScripts();
    expect(before).toHaveLength(2);
    expect(before[0].id).not.toBe(before[1].id);
    const beforeNodes = [...root.querySelectorAll("*")];
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    let noise: string[];
    try {
      hydrate(() => createComponent(Pair, {}), root);
      flush();
      noise = [...warn.mock.calls, ...error.mock.calls].flat().map(String);
    } finally {
      warn.mockRestore();
      error.mockRestore();
    }
    expect(noise).toEqual([]);
    // Both documents claimed; nothing replaced.
    expect([...root.querySelectorAll("*")]).toEqual(beforeNodes);
    expect(
      [...root.querySelectorAll("nav.toc")].map(nav =>
        [...nav.querySelectorAll("a")].map(a => a.textContent)
      )
    ).toEqual([["Alpha", "Beta"], ["Gamma"]]);
    // Both tags adopted — not four scripts in the head.
    const after = stateScripts();
    expect(after).toHaveLength(2);
    expect(after[0]).toBe(before[0]);
    expect(after[1]).toBe(before[1]);
  });

  test("interactivity attaches to the claimed nodes", () => {
    const root = app();
    hydrate(() => createComponent(Doc, {}), root);
    flush();
    const button = root.querySelector("button.counter") as HTMLButtonElement;
    expect(button.textContent).toContain("clicks: 0");
    button.click();
    flush();
    expect(button.textContent).toContain("clicks: 1");
  });

  test("a client-navigated document takes no seed and resolves reactively", () => {
    hydrate(() => createComponent(Doc, {}), app());
    flush();
    // A second document, reached the way the router reaches one — render, not hydrate. The
    // page's snapshot belongs to the first document, so seeding from it would pin this one's Toc
    // to the wrong headings.
    const fresh = document.createElement("div");
    document.body.appendChild(fresh);
    render(() => createComponent(OtherDoc, {}), fresh);
    flush();
    const links = [...fresh.querySelectorAll("nav.toc a")].map(
      a => a.textContent
    );
    expect(links).toEqual(["Gamma"]);
    // ...and it registered no second doc-state script of its own.
    expect(stateScripts()).toHaveLength(1);
  });
});
