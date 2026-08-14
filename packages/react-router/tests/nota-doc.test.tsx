/**
 * The React Router bridge, both halves:
 *
 * - **server half** — `renderToString(<NotaDoc/>)` emits the document's static render inside the
 *   container (what prerender/SSR writes), and `renderDoc` memoizes per document module (the
 *   hydration-parity requirement: route remounts must reuse the exact bytes).
 * - **client half (jsdom)** — mounting `NotaDoc` hydrates the document's islands via the replay
 *   pipeline scoped to the container (a click flips island state), and unmounting tears them
 *   down.
 *
 * The package sets the React adapter at module load (importing it is choosing React), so no
 * per-test adapter management.
 */

import { decode, Fragment, h, inlineComponent } from "@nota-lang/runtime";
import { act, useState } from "react";
import { createRoot } from "react-dom/client";
import { renderToString } from "react-dom/server";
import { describe, expect, test } from "vitest";
import { type DocFn, docMeta, NotaDoc, renderDoc } from "../src/lib";

(
  globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

/** Await React's async hydration/commit (a microtask + a macrotask). */
async function flush(): Promise<void> {
  await Promise.resolve();
  await new Promise(r => setTimeout(r, 0));
}

/** A fresh document (cache is keyed by function identity): a paragraph + one Colorized island. */
function makeDoc(): { Doc: DocFn; calls: () => number } {
  let calls = 0;
  const Colorized = inlineComponent(children => {
    const [color, setColor] = useState("red");
    return h("span", { onClick: () => setColor("green"), style: { color } }, [
      children
    ]);
  }, "Colorized");
  function Doc() {
    calls += 1;
    return decode(
      Fragment("Hello ", h(Colorized, {}, ["world"]), "\n", "\n", "Tail.")
    );
  }
  return { Doc, calls: () => calls };
}

describe("renderDoc", () => {
  test("renders the document once and memoizes per module", () => {
    const { Doc, calls } = makeDoc();
    const a = renderDoc(Doc);
    const b = renderDoc(Doc);
    expect(b).toBe(a);
    expect(calls()).toBe(1);
    expect(a.html).toContain("<p>Hello ");
    expect(a.html).toContain("nota-island");
    expect(a.html).toContain('style="color:red"');
    expect(Object.keys(a.manifest)).toHaveLength(1);
  });
});

describe("NotaDoc (server half)", () => {
  test("renderToString emits the static render inside the container", () => {
    const { Doc } = makeDoc();
    const html = renderToString(<NotaDoc doc={Doc} />);
    expect(html).toContain('class="nota-document"');
    expect(html).toContain("<p>Hello ");
    expect(html).toContain("<p>Tail.</p>");
  });

  test("className is overridable", () => {
    const { Doc } = makeDoc();
    const html = renderToString(<NotaDoc doc={Doc} className="post" />);
    expect(html).toContain('class="post"');
  });
});

describe("docMeta", () => {
  test("title + og:title from the document metadata", () => {
    expect(docMeta({ title: "My Post" })()).toEqual([
      { title: "My Post" },
      { property: "og:title", content: "My Post" }
    ]);
    expect(docMeta({})()).toEqual([
      { title: "Nota" },
      { property: "og:title", content: "Nota" }
    ]);
  });
});

describe("NotaDoc (client half, jsdom)", () => {
  test("islands hydrate scoped to the container; unmount tears them down", async () => {
    const { Doc } = makeDoc();
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(<NotaDoc doc={Doc} />);
    });
    await flush();

    const span = container.querySelector<HTMLElement>("nota-island span");
    expect(span).not.toBeNull();
    expect(span?.style.color).toBe("red");

    await act(async () => {
      span?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    await flush();
    expect(
      container.querySelector<HTMLElement>("nota-island span")?.style.color
    ).toBe("green");

    await act(async () => {
      root.unmount();
    });
    document.body.removeChild(container);
  });
});
