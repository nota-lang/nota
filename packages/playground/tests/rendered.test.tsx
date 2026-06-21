/**
 * Phase S test (impl §4.5): the **Rendered** pane boots the Post-SSG HTML in the iframe and hydrates
 * each island so it becomes interactive — the golden's `Colorized` click flips red→green. Same
 * hydrate-then-click assertion as the CLI's acceptance test, but driving the live `RenderedPane`.
 */

import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { cleanup, render as rtlRender } from "@testing-library/react";
import { afterEach, beforeAll, describe, expect, it } from "vitest";
import { compileNota, ensureCompiler } from "../src/compiler";
import { GOLDEN_NOTA } from "../src/golden";
import { RenderedPane } from "../src/RenderedPane";
import { runSSG } from "../src/ssg";

beforeAll(async () => {
  const require = createRequire(import.meta.url);
  const wasmPath = require
    .resolve("nota_wasm")
    .replace(/nota_wasm\.js$/, "nota_wasm_bg.wasm");
  await ensureCompiler(readFileSync(wasmPath));
});

afterEach(cleanup);

/** Let the `RenderedPane` effect (iframe write + hydrate) flush. */
const tick = () => new Promise(r => setTimeout(r, 0));

describe("Rendered pane (stage hydrated)", () => {
  it("boots the SSG HTML into the iframe and hydrates islands interactively", async () => {
    const { html, manifest, registry } = runSSG(compileNota(GOLDEN_NOTA));

    const { container } = rtlRender(
      <RenderedPane
        html={html}
        manifest={manifest}
        registry={registry}
        active={true}
      />
    );
    const iframe = container.querySelector("iframe") as HTMLIFrameElement;
    expect(iframe).toBeTruthy();
    await tick();

    const doc = iframe.contentDocument;
    if (!doc) throw new Error("iframe has no contentDocument");

    // The Post-SSG structure is booted into the iframe: the coalesced <ul> + both islands.
    expect(doc.body.innerHTML).toContain("<ul>");
    expect(doc.querySelector('[data-hydration-id="1"]')).toBeTruthy();

    // The island hydrated: its <span> baked color:red from useState, and clicking flips it green.
    const span = doc.querySelector(
      '[data-hydration-id="1"] span'
    ) as HTMLElement | null;
    expect(span).toBeTruthy();
    expect(span?.style.color).toBe("red");

    span?.click();
    await tick();
    expect(span?.style.color).toBe("green");
  });

  it("renders an island-free doc with no hydration and no error", async () => {
    const { html, manifest, registry } = runSSG(
      compileNota("# Hello\n\nA paragraph with @em{emphasis}.\n")
    );
    const { container } = rtlRender(
      <RenderedPane
        html={html}
        manifest={manifest}
        registry={registry}
        active={true}
      />
    );
    await tick();
    const doc = (container.querySelector("iframe") as HTMLIFrameElement)
      .contentDocument;
    expect(doc?.body.textContent).toContain("Hello");
    expect(Object.keys(manifest)).toHaveLength(0);
  });
});
