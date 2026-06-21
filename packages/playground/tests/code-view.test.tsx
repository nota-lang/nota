/**
 * Generated-JS pane view tests (feature: CM6-highlighted, read-only JS viewer). Two concerns:
 *   1. {@link jsLanguage} wires the JS parser + a Catppuccin highlight built from Lezer tags — a
 *      mistyped tag throws at define-time, so we assert it constructs.
 *   2. {@link JsPane} formats its `code` (async Prettier) into a *read-only* {@link CodeView}.
 * Runs headless in jsdom; CM6 still builds its content DOM, so we assert against `.cm-content`.
 */

import { render, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { CodeView } from "../src/CodeView";
import { JsPane } from "../src/JsPane";
import { jsLanguage } from "../src/js-mode";

describe("jsLanguage", () => {
  it("builds the JS language + highlight extension without throwing", () => {
    // The real failure mode is a mistyped `@lezer/highlight` tag — it throws when the style is defined.
    const ext = jsLanguage();
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

describe("JsPane", () => {
  it("Prettier-formats the emitted code into the viewer", async () => {
    const { getByTestId, container } = render(<JsPane code={"const  x=1\n"} />);
    expect(getByTestId("pane-js")).toBeTruthy();
    // The async format normalizes the messy spacing to canonical `const x = 1;`.
    await waitFor(() =>
      expect(container.querySelector(".cm-content")?.textContent).toContain(
        "const x = 1;"
      )
    );
  });
});
