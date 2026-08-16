/**
 * **CLI hydration e2e: the acceptance test.** Headless-load the emitted document directory into
 * jsdom, execute its scripts the way a browser would, and assert the page is server-complete
 * AND interactive after hydration.
 *
 * - **golden.nota** — the canonical `Colorized` arc: SSR bakes `color:red`; a click flips the
 *   claimed span to green.
 * - **closure.nota** — a document-local component inside `@for` closing over the loop variable
 *   with per-instance signals. No replay machinery: the document hydrates as one Solid app and
 *   the closures are the program's own.
 *
 * **How a page is "loaded".** jsdom does not execute scripts, so we reproduce a browser load:
 * install the `<body>` markup (keeping the JSON state script — `hydrateDocument` reads it),
 * then eval each executable script in document order — the inline Solid hydration bootstrap
 * from `<head>`, then the client IIFE the `<script src>` names — in the jsdom realm. Faithful:
 * the bundle uses its own bundled Solid + jsdom's `document`, nothing from the test's module
 * graph.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, beforeAll, describe, expect, test } from "vitest";
import { BUILT_DIR, CLOSURE_BUILT_DIR, indexHtmlOf } from "./builtHtmlPath";

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
 * Simulate a browser load: install the body markup (executable scripts stripped — they run by
 * hand; the `application/json` state script stays in the DOM), then eval every executable
 * script in document order. `globalThis.eval` is *indirect* eval — global scope, exactly like
 * the browser running a classic script.
 */
function loadAndBoot(dir: string, html: string): void {
  document.body.innerHTML = bodyOf(html).replace(
    /<script(?![^>]*application\/json)[\s\S]*?<\/script>/gi,
    ""
  );
  const scripts = [
    ...html.matchAll(/<script(\s[^>]*)?>([\s\S]*?)<\/script>/gi)
  ];
  for (const [, attrs = "", inline] of scripts) {
    if (/application\/json/.test(attrs)) {
      continue;
    }
    const src = /src="([^"]+)"/.exec(attrs)?.[1];
    const code = src
      ? readFileSync(join(dir, src.replace(/^\.\//, "")), "utf8")
      : inline;
    // biome-ignore lint/security/noGlobalEval: faithfully simulates the browser running the page's scripts.
    globalThis.eval(code);
  }
}

const click = (el: Element) =>
  el.dispatchEvent(new MouseEvent("click", { bubbles: true }));

describe("golden.nota: served page hydrates and reacts", () => {
  test("the SSR-baked span claims and flips color on click", () => {
    loadAndBoot(BUILT_DIR, HTML);
    const spans = Array.from(document.querySelectorAll("ul li span"));
    expect(spans).toHaveLength(2);
    const before = spans[0];
    expect((before as HTMLElement).style.color).toBe("red");

    click(before);
    // Same node (claimed, not rebuilt), new signal-driven style.
    expect(document.querySelectorAll("ul li span")[0]).toBe(before);
    expect((before as HTMLElement).style.color).toBe("green");
    // The sibling is an independent instance.
    expect((spans[1] as HTMLElement).style.color).toBe("red");
  });
});

describe("closure.nota: document-local components with per-instance state", () => {
  test("each loop-defined button closes over its x and counts independently", () => {
    loadAndBoot(CLOSURE_BUILT_DIR, CLOSURE_HTML);
    const buttons = Array.from(document.querySelectorAll("ul li button"));
    expect(buttons).toHaveLength(2);
    expect(buttons[0].textContent).toContain("x=1");
    expect(buttons[0].textContent).toContain("n=0");
    expect(buttons[1].textContent).toContain("x=2");

    click(buttons[0]);
    click(buttons[0]);
    click(buttons[1]);
    expect(buttons[0].textContent).toContain("n=2");
    expect(buttons[1].textContent).toContain("n=1");
    // Claimed nodes, not rebuilt.
    expect(document.querySelectorAll("ul li button")[0]).toBe(buttons[0]);
  });
});
