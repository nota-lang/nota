/**
 * **CLI hydration e2e: the acceptance test** (the same hydration arc the dev server proves, but now
 * against the emitted *files* rather than a dev server).
 *
 * Headless-load the emitted document directory into jsdom, execute its client bundle, and assert
 * the islands are **server-present AND interactive after hydration**. Two fixtures:
 *
 * - **golden.nota** — the canonical `Colorized` click → color-change (red → green), exactly the
 *   decode.md arc end to end, driven through the CLI's directory output.
 * - **closure.nota** — the replay-hydration headline: a **document-local** island defined inside
 *   `@for`, closing over the loop variable, with per-island `useState` counters. Impossible under
 *   the old manifest/registry boot (the nested binding is not module-scoped and its closure cannot
 *   cross as JSON); replay hydration re-executes the document client-side and recovers each closure
 *   live.
 *
 * **Where the files come from.** A Node **globalSetup** (`buildGolden.globalSetup.ts`) builds each
 * fixture once into `tests/.golden.built/` / `tests/.closure.built/` (`index.html` + `assets/`);
 * these tests *load those files* — the literal "load the emitted page" the spec asks for.
 *
 * **How a page is "loaded".** jsdom does not execute scripts, so we reproduce a browser load:
 * install the `<body>` markup into the document (the server-rendered `<nota-island>` shells), then
 * `eval` the client bundle the page's `<script src>` names (a vite-built **IIFE** carrying its own
 * React client + the runtime) in the jsdom realm — running `hydrateDocument(Doc)`, which replays
 * the document in capture mode and hydrates each island over its server DOM (design/decode.md
 * §Replay hydration). Faithful to a real browser: the bundle uses its bundled React + jsdom's
 * `document`, nothing from the test's own module graph.
 */

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, beforeAll, describe, expect, test } from "vitest";
import {
  BUILT_DIR,
  CLOSURE_BUILT_DIR,
  clientJsOf,
  indexHtmlOf
} from "./builtHtmlPath";

/** The built pages (produced by the Node globalSetup), loaded here. */
let HTML = "";
let CLOSURE_HTML = "";
beforeAll(() => {
  HTML = readFileSync(indexHtmlOf(BUILT_DIR), "utf8");
  CLOSURE_HTML = readFileSync(indexHtmlOf(CLOSURE_BUILT_DIR), "utf8");
});

afterEach(() => {
  document.body.innerHTML = "";
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
 * Simulate a browser loading the page: install the body markup (sans the `<script>` tags, which we
 * run by hand), then eval the client bundle — the file the page's `<script src>` references — in
 * the jsdom realm so `hydrateDocument(Doc)` runs (the replay: capture-render the document, then
 * hydrate each `[data-hydration-id]` marker).
 */
function loadAndBoot(dir: string, html: string): void {
  const body = bodyOf(html).replace(/<script[\s\S]*?<\/script>/gi, "");
  document.body.innerHTML = body;
  // The vite IIFE references the ambient `document`/`window` (jsdom) + its own bundled React.
  // `globalThis.eval` is *indirect* eval — it runs in the global scope, exactly like the browser
  // executing the classic script.
  // biome-ignore lint/security/noGlobalEval: faithfully simulates the browser running the bundle.
  globalThis.eval(readFileSync(clientJsOf(dir), "utf8"));
}

async function flush(): Promise<void> {
  await Promise.resolve();
  await new Promise(r => setTimeout(r, 0));
}

describe("CLI hydration e2e (the acceptance test — against the FILES)", () => {
  test("relocatable: every src/href is ./assets/-relative and exists in the out dir", () => {
    document.body.innerHTML = bodyOf(HTML);
    // The document dir must be self-sufficient: no absolute or off-site URL, every reference a
    // page-relative ./assets/… file that was actually emitted.
    const refs = Array.from(document.querySelectorAll("[src], [href]")).map(
      el => el.getAttribute("src") ?? el.getAttribute("href") ?? ""
    );
    expect(refs.length).toBeGreaterThan(0); // at least the island <script src>
    for (const ref of refs) {
      expect(ref).toMatch(/^\.\/assets\//);
      expect(existsSync(join(BUILT_DIR, ref))).toBe(true);
    }
  });

  test("server-present: the island shells are in the served HTML before any JS runs", () => {
    document.body.innerHTML = bodyOf(HTML);
    const islands = document.querySelectorAll("nota-island[data-hydration-id]");
    expect(islands.length).toBe(2);
    const spans = document.querySelectorAll("nota-island span");
    expect(spans.length).toBe(2);
    // SSR baked color:red from useState("red").
    expect((spans[0] as HTMLElement).style.color).toBe("red");
    expect(spans[0].textContent).toBe("a");
    expect(spans[1].textContent).toBe("b");
  });

  test("interactive after boot: Colorized click flips color red → green", async () => {
    loadAndBoot(BUILT_DIR, HTML);
    await flush();

    const span = document.querySelector(
      'nota-island[data-hydration-id="1"] span'
    ) as HTMLElement | null;
    expect(span).not.toBeNull();
    // hydrated, still showing the SSR'd state.
    expect(span?.style.color).toBe("red");
    expect(span?.textContent).toBe("a");

    // click → the island's onClick (setColor("green")) runs → re-render → color changes.
    span?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    await flush();

    const after = document.querySelector(
      'nota-island[data-hydration-id="1"] span'
    ) as HTMLElement | null;
    expect(after?.style.color).toBe("green");
    // the second island is independent — untouched by the first's click.
    const second = document.querySelector(
      'nota-island[data-hydration-id="2"] span'
    ) as HTMLElement | null;
    expect(second?.style.color).toBe("red");
  });
});

// =============================================================================================
// the replay-hydration headline — a document-local island inside @for, closing over the loop variable
// =============================================================================================

describe("CLI closure e2e (island in @for closing over the loop var — the replay-hydration headline)", () => {
  test("server-present: one <ul>, two islands, each button shows its own captured x", () => {
    document.body.innerHTML = bodyOf(CLOSURE_HTML);
    // The per-iteration fragments dissolved and the `-` sentinels coalesced into one <ul>.
    expect(document.querySelectorAll("ul").length).toBe(1);
    const islands = document.querySelectorAll("nota-island[data-hydration-id]");
    expect(islands.length).toBe(2);
    const buttons = Array.from(document.querySelectorAll("button"));
    expect(buttons.map(b => b.textContent)).toEqual(["x=1 n=0", "x=2 n=0"]);
  });

  test("interactive after hydration: each island keeps its own closure + state", async () => {
    loadAndBoot(CLOSURE_BUILT_DIR, CLOSURE_HTML);
    await flush();

    let buttons = Array.from(document.querySelectorAll("button"));
    expect(buttons.map(b => b.textContent)).toEqual(["x=1 n=0", "x=2 n=0"]);

    // Click the FIRST island: its counter increments; its captured x stays 1; the second island
    // (its own closure over x=2, its own useState) is untouched. This is the program that was
    // impossible before replay hydration — the binding is document-local and the body closes over
    // the loop var.
    buttons[0].dispatchEvent(new MouseEvent("click", { bubbles: true }));
    await flush();
    buttons = Array.from(document.querySelectorAll("button"));
    expect(buttons.map(b => b.textContent)).toEqual(["x=1 n=1", "x=2 n=0"]);

    // And the second island is independently interactive.
    buttons[1].dispatchEvent(new MouseEvent("click", { bubbles: true }));
    await flush();
    buttons = Array.from(document.querySelectorAll("button"));
    expect(buttons.map(b => b.textContent)).toEqual(["x=1 n=1", "x=2 n=1"]);
  });
});
