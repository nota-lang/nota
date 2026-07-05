/**
 * Output-pane view tests (CM6-highlighted, read-only viewers). Three concerns:
 *   1. `jsLanguage`/`htmlLanguage`/`jsonLanguage` wire a Lezer parser + the shared Catppuccin
 *      highlight — a mistyped tag throws at define-time, so we assert each constructs.
 *   2. `CodePane` formats its `code` (async Prettier) into a *read-only* `CodeView`.
 *   3. `SsgPane` composes the formatted/highlighted HTML block + the highlighted JSON manifest.
 * Runs headless in jsdom; CM6 still builds its content DOM, so we assert against `.cm-content`.
 */

import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { generateClientEntry } from "@nota-lang/vite/registry";
import { render, waitFor } from "@testing-library/react";
import { beforeAll, describe, expect, it } from "vitest";
import { CodePane } from "../src/CodePane";
import { CodeView } from "../src/CodeView";
import { compileNota, ensureCompiler } from "../src/compiler";
import { GOLDEN_NOTA } from "../src/golden";
import { htmlLanguage } from "../src/html-mode";
import { jsLanguage } from "../src/js-mode";
import { jsonLanguage } from "../src/json-mode";
import { SsgPane } from "../src/SsgPane";
import { runSSG } from "../src/ssg";

beforeAll(async () => {
  const require = createRequire(import.meta.url);
  const wasmPath = require
    .resolve("nota_wasm")
    .replace(/nota_wasm\.js$/, "nota_wasm_bg.wasm");
  await ensureCompiler(readFileSync(wasmPath));
});

describe("language extensions build without throwing", () => {
  // The real failure mode is a mistyped `@lezer/highlight` tag — it throws when the style is defined.
  it.each([
    ["js", jsLanguage],
    ["html", htmlLanguage],
    ["json", jsonLanguage]
  ])("%s", (_name, lang) => {
    const ext = lang();
    expect(Array.isArray(ext)).toBe(true);
    expect((ext as unknown[]).length).toBeGreaterThan(0);
  });
});

describe("CodeView", () => {
  it("mounts a read-only CM6 editor showing the value", async () => {
    const { container } = render(
      <CodeView value={'h("span", {}, [x]);'} language={jsLanguage()} />
    );
    await waitFor(() =>
      expect(container.querySelector(".cm-editor")).toBeTruthy()
    );

    const content = container.querySelector(".cm-content");
    expect(content?.getAttribute("contenteditable")).toBe("false");
    expect(content?.textContent).toContain('h("span"');
  });
});

describe("CodePane", () => {
  it("Prettier-formats the emitted code into the viewer", async () => {
    const { getByTestId, container } = render(
      <CodePane code={"const  x=1\n"} mode="js" testid="pane-js" fill />
    );
    expect(getByTestId("pane-js")).toBeTruthy();
    // The async format normalizes the messy spacing to canonical `const x = 1;`.
    await waitFor(() =>
      expect(container.querySelector(".cm-content")?.textContent).toContain(
        "const x = 1;"
      )
    );
  });
});

describe("SsgPane", () => {
  it("shows read-only HTML, JSON manifest, and JS hydration-entry blocks", async () => {
    const { html, manifest } = runSSG(compileNota(GOLDEN_NOTA));
    const clientJs = generateClientEntry(manifest, {
      moduleId: "./doc.compiled.mjs"
    });
    const { getByTestId } = render(
      <SsgPane html={html} manifest={manifest} clientJs={clientJs} />
    );

    const htmlPane = getByTestId("pane-ssg-html");
    const manifestPane = getByTestId("pane-ssg-manifest");
    const clientPane = getByTestId("pane-ssg-client-js");

    await waitFor(() =>
      expect(htmlPane.querySelector(".cm-editor")).toBeTruthy()
    );
    await waitFor(() =>
      expect(clientPane.querySelector(".cm-editor")).toBeTruthy()
    );
    // All blocks are read-only CM6 views.
    for (const pane of [htmlPane, manifestPane, clientPane]) {
      expect(
        pane.querySelector(".cm-content")?.getAttribute("contenteditable")
      ).toBe("false");
    }
    // The manifest (already pretty JSON) shows the island component name.
    expect(manifestPane.querySelector(".cm-content")?.textContent).toContain(
      "Colorized"
    );
    // The hydration entry shows the boot call (Prettier-formatted JS, highlighted).
    expect(clientPane.querySelector(".cm-content")?.textContent).toContain(
      "bootIslandsWithSlots(manifest, registry)"
    );
  });

  it("an island-free doc shows the zero-JS note instead of a JS block", () => {
    const { getByTestId, queryByTestId } = render(
      <SsgPane html="<p>hi</p>" manifest={{}} clientJs="" />
    );
    expect(getByTestId("pane-ssg-client-js-empty").textContent).toContain(
      "zero-JS"
    );
    expect(queryByTestId("pane-ssg-client-js")).toBeNull();
  });
});
