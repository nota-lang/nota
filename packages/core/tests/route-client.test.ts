/**
 * The client half (dom project): hydrate the server bytes tests/ssr.mjs produced and assert the
 * seed did its job.
 *
 * The property that matters is **claiming, not rebuilding**: a document whose Toc lists headings
 * it has not reached yet renders the resolved list on the server, so an unseeded client would
 * paint an empty Toc on its first pass and correct it after — a visible flash, and every node
 * below it replaced. Seeded, the client reproduces the server bytes exactly, so the nodes are the
 * same objects afterwards.
 */
import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createComponent, sharedConfig } from "solid-js";
import { hydrate, render } from "solid-js/web";
import { beforeAll, beforeEach, describe, expect, test } from "vitest";
import { notaRoute } from "../src/route";
import { Doc, OtherDoc } from "./fixtures/route-doc";

const pkgRoot = process.cwd();
let pageHtml: string;

beforeAll(() => {
  execSync("node tests/route-ssr.mjs", { cwd: pkgRoot, stdio: "pipe" });
  pageHtml = readFileSync(join(pkgRoot, "tests/.built/route-page.html"), "utf8");
}, 60_000);

beforeEach(() => {
  // A fresh page: Solid's hydration bootstrap global, and sharedConfig.done reset (a delegated
  // event handler flips it — "hydration era over").
  Object.assign(globalThis, {
    _$HY: { events: [], completed: new WeakSet(), r: {} }
  });
  sharedConfig.done = false;
  document.body.innerHTML = pageHtml;
});

const tocLinks = () =>
  [...document.querySelectorAll("nav.toc a")].map(a => a.textContent);

describe("notaRoute (client)", () => {
  test("the server bytes already carry the resolved forward reference", () => {
    expect(tocLinks()).toEqual(["Alpha", "Beta"]);
  });

  test("hydration claims the server DOM instead of rebuilding it", () => {
    const root = document.getElementById("app") as HTMLElement;
    const before = [...root.querySelectorAll("*")];
    const Route = notaRoute(Doc);
    hydrate(() => createComponent(Route, {}), root);
    const after = [...root.querySelectorAll("*")];
    // Same element objects, in the same order: nothing was replaced.
    expect(after).toEqual(before);
    // ...and the Toc still reads correctly (no flash to empty).
    expect(tocLinks()).toEqual(["Alpha", "Beta"]);
  });

  test("interactivity attaches to the claimed nodes", () => {
    const root = document.getElementById("app") as HTMLElement;
    const Route = notaRoute(Doc);
    hydrate(() => createComponent(Route, {}), root);
    const button = root.querySelector("button.counter") as HTMLButtonElement;
    expect(button.textContent).toContain("clicks: 0");
    button.click();
    expect(button.textContent).toContain("clicks: 1");
  });

  test("a client-navigated document takes no seed and resolves reactively", () => {
    const root = document.getElementById("app") as HTMLElement;
    hydrate(() => createComponent(notaRoute(Doc), {}), root);
    // A second document, reached the way the router reaches one — render, not hydrate. The
    // page's snapshot belongs to the first document, so seeding from it would pin this one's Toc
    // to the wrong headings.
    const fresh = document.createElement("div");
    document.body.appendChild(fresh);
    render(() => createComponent(notaRoute(OtherDoc), {}), fresh);
    const links = [...fresh.querySelectorAll("nav.toc a")].map(
      a => a.textContent
    );
    expect(links).toEqual(["Gamma"]);
  });
});
