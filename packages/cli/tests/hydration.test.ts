/**
 * **CLI hydration e2e: the acceptance test** (the same hydration arc the dev server proves, but now
 * against a *file* rather than a dev server).
 *
 * Headless-load the emitted single-file HTML into jsdom, execute its inlined client bundle, and
 * assert the islands are **server-present AND interactive after hydration**. Two fixtures:
 *
 * - **golden.nota** — the canonical `Colorized` click → color-change (red → green), exactly the
 *   decode.md arc end to end, driven through the CLI's single-file output.
 * - **closure.nota** — the R15 headline: a **document-local** island defined inside `@for`, closing
 *   over the loop variable, with per-island `useState` counters. Impossible under the old
 *   manifest/registry boot (the nested binding is not module-scoped and its closure cannot cross as
 *   JSON); replay hydration re-executes the document client-side and recovers each closure live.
 *
 * **Where the files come from.** esbuild cannot run under jsdom (its `TextEncoder` invariant), so the
 * builds happen in a Node **globalSetup** (`buildGolden.globalSetup.ts`) that writes the single-file
 * HTML to `tests/.golden.built.html` / `tests/.closure.built.html`; these tests *load those files* —
 * the literal "load the emitted file" the spec asks for.
 *
 * **How a file is "loaded".** jsdom does not execute scripts (and never `type="module"`), so we
 * reproduce a browser load: install the `<body>` markup into the document (the server-rendered
 * `<nota-island>` shells), then `eval` the inlined client bundle (an esbuild **IIFE** carrying its own
 * React client + the runtime) in the jsdom realm — running `hydrateDocument(Doc)`, which replays the
 * document in capture mode and hydrates each island over its server DOM (contract R15). Faithful to a
 * real browser: the bundle uses its bundled React + jsdom's `document`, nothing from the test's own
 * module graph.
 */

import { readFileSync } from "node:fs";
import { afterEach, beforeAll, describe, expect, test } from "vitest";
import { BUILT_HTML_PATH, CLOSURE_BUILT_HTML_PATH } from "./builtHtmlPath";

/** The single-file HTML fixtures, produced by the Node globalSetup, loaded here. */
let HTML = "";
let CLOSURE_HTML = "";
beforeAll(() => {
  HTML = readFileSync(BUILT_HTML_PATH, "utf8");
  CLOSURE_HTML = readFileSync(CLOSURE_BUILT_HTML_PATH, "utf8");
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

/** Extract the inlined client bundle (the `<script type="module">…</script>` content). */
function clientBundleOf(html: string): string {
  const m = html.match(/<script type="module">([\s\S]*?)<\/script>/i);
  if (!m) {
    throw new Error("no inlined client <script> in emitted HTML");
  }
  return m[1];
}

/**
 * Simulate a browser loading the file: install the body markup (sans the `<script>` tags, which we
 * run by hand), then eval the client bundle in the jsdom realm so `hydrateDocument(Doc)` runs (the
 * R15 replay: capture-render the document, then hydrate each `[data-hydration-id]` marker).
 */
function loadAndBoot(html: string): void {
  const body = bodyOf(html).replace(/<script[\s\S]*?<\/script>/gi, "");
  document.body.innerHTML = body;
  // The esbuild IIFE references the ambient `document`/`window` (jsdom) + its own bundled React.
  // `globalThis.eval` is *indirect* eval — it runs in the global scope, exactly like the browser
  // executing the inline module script.
  // biome-ignore lint/security/noGlobalEval: faithfully simulates the browser running the inline bundle.
  globalThis.eval(clientBundleOf(html));
}

async function flush(): Promise<void> {
  await Promise.resolve();
  await new Promise(r => setTimeout(r, 0));
}

describe("CLI hydration e2e (the acceptance test — against the FILE)", () => {
  test("self-contained: the emitted DOM has no external src/href attributes", () => {
    document.body.innerHTML = bodyOf(HTML);
    const external = Array.from(
      document.querySelectorAll("[src], [href]")
    ).filter(el => {
      const v = el.getAttribute("src") ?? el.getAttribute("href") ?? "";
      return v.length > 0;
    });
    expect(external).toEqual([]);
    // and the script tags themselves carry no src (inline only).
    for (const s of Array.from(document.querySelectorAll("script"))) {
      expect(s.getAttribute("src")).toBeNull();
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
    loadAndBoot(HTML);
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
// the R15 headline — a document-local island inside @for, closing over the loop variable
// =============================================================================================

describe("CLI closure e2e (island in @for closing over the loop var — R15 headline)", () => {
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
    loadAndBoot(CLOSURE_HTML);
    await flush();

    let buttons = Array.from(document.querySelectorAll("button"));
    expect(buttons.map(b => b.textContent)).toEqual(["x=1 n=0", "x=2 n=0"]);

    // Click the FIRST island: its counter increments; its captured x stays 1; the second island
    // (its own closure over x=2, its own useState) is untouched. This is the program that was
    // impossible before R15 — the binding is document-local and the body closes over the loop var.
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
