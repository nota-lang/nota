/**
 * `hydrateDocument` end-to-end with the real `@nota-lang/react` adapter under jsdom (contract R15 —
 * replay hydration). The client re-executes `Doc` in capture mode to recover each island's live
 * boundary, then hydrates it over the server DOM. Three angles, the last two **impossible before
 * R15**:
 *
 * - **golden replay** — the canonical `Colorized` document replay-hydrates and a click flips one
 *   island's state without touching the other.
 * - **island inside `@for` closing over the loop variable** — each iteration defines a *document-
 *   local* island capturing its `x`; replay recovers the per-iteration closure on the client, and
 *   the islands are independently interactive (nested F1 hoist never permitted this).
 * - **function-valued island prop** — a prop holding a live handler (closing over document state)
 *   crosses SSG (`render(Doc)` — E4 is retired) AND the replay, and fires on the client; the old
 *   JSON manifest rejected function props outright.
 *
 * Emit is hand-written in the shape the reader produces today (keyed `@for`, `decode(...)` on Doc +
 * component bodies), per `tests/fixtures/golden.compiled.ts` — until the R15 reader phase.
 */

import reactAdapter from "@nota-lang/react";
import {
  type CompProps,
  clearAdapter,
  decode,
  Fragment,
  h,
  hydrateDocument,
  inlineComponent,
  render,
  setAdapter
} from "@nota-lang/runtime";
import { useState } from "react";
import { afterEach, beforeEach, describe, expect, test } from "vitest";

beforeEach(() => setAdapter(reactAdapter));
afterEach(() => {
  clearAdapter();
  document.body.innerHTML = "";
});

/** Await React's async hydration/commit (a microtask + a macrotask). */
async function flush(): Promise<void> {
  await Promise.resolve();
  await new Promise(r => setTimeout(r, 0));
}

// =============================================================================================
// golden replay — Colorized document, click flips one island only
// =============================================================================================

describe("golden document replay-hydrates", () => {
  const Colorized = inlineComponent((children: CompProps["children"]) => {
    const [color, setColor] = useState("red");
    return decode(
      h(
        "span",
        { onClick: () => setColor("green"), style: { color } },
        children
      )
    );
  }, "Colorized");

  const Doc = () =>
    decode(
      Fragment(
        ["a", "b"].map((x, _i) =>
          Fragment({ key: _i }, h("nota-ul-li", {}, [h(Colorized, {}, [x])]))
        )
      )
    );

  test("both islands hydrate; clicking one flips only its own state", async () => {
    const { html, manifest } = render(Doc);
    expect(Object.keys(manifest)).toEqual(["1", "2"]);
    document.body.innerHTML = html;

    const teardowns = hydrateDocument(Doc);
    await flush();

    const spans = Array.from(document.querySelectorAll("span"));
    expect(spans).toHaveLength(2);
    expect(spans.map(s => s.textContent)).toEqual(["a", "b"]);
    expect(spans.map(s => s.style.color)).toEqual(["red", "red"]);

    spans[0].dispatchEvent(new MouseEvent("click", { bubbles: true }));
    await flush();

    // only the clicked island re-rendered green; its neighbor is untouched (independent state).
    expect(spans[0].style.color).toBe("green");
    expect(spans[1].style.color).toBe("red");

    expect(teardowns).toHaveLength(2);
    for (const t of teardowns) {
      t();
    }
  });
});

// =============================================================================================
// island inside @for closing over the loop variable (impossible before R15)
// =============================================================================================

describe("island in @for closing over the loop variable", () => {
  // Each iteration defines a DOCUMENT-LOCAL island (nested %let) that closes over its `x`. This is
  // exactly the plan's headline program `@for (x of xs) { %let E = inlineComponent(() => x); - @E{} }`
  // (with a counter added to prove independent hydration), impossible under the old F1 hoist.
  const DocFor = () =>
    decode(
      Fragment(
        [1, 2].map((x, _i) => {
          // Each `.map` iteration constructs a distinct island component that closes over its `x`
          // (the R15 document-local island); the hook is unconditional within that component body.
          const Example = inlineComponent(() => {
            // biome-ignore lint/correctness/useHookAtTopLevel: hook is unconditional in this island body.
            const [n, setN] = useState(0);
            return decode(
              h("button", { type: "button", onClick: () => setN(v => v + 1) }, [
                `x=${x} n=${n}`
              ])
            );
          }, "Example");
          return Fragment(
            { key: _i },
            h("nota-ul-li", {}, [h(Example, {}, [])])
          );
        })
      )
    );

  test("each island shows its own captured x and is independently interactive", async () => {
    const { html, manifest } = render(DocFor);
    expect(Object.keys(manifest)).toEqual(["1", "2"]);
    document.body.innerHTML = html;

    hydrateDocument(DocFor);
    await flush();

    const buttons = Array.from(document.querySelectorAll("button"));
    expect(buttons).toHaveLength(2);
    // the per-iteration closure over `x` survived to the client (1 and 2, not both the same).
    expect(buttons.map(b => b.textContent)).toEqual(["x=1 n=0", "x=2 n=0"]);

    buttons[0].dispatchEvent(new MouseEvent("click", { bubbles: true }));
    await flush();

    // only island 1's counter advanced — the two islands hydrated with independent state.
    expect(
      Array.from(document.querySelectorAll("button")).map(b => b.textContent)
    ).toEqual(["x=1 n=1", "x=2 n=0"]);
  });
});

// =============================================================================================
// function-valued island prop (impossible before R15 — E4 rejected it)
// =============================================================================================

describe("function-valued island prop", () => {
  test("a live handler prop crosses render(Doc) AND the replay, and fires on click", async () => {
    const state = { fired: 0 };
    const Fires = inlineComponent(
      (children: CompProps["children"], props: CompProps) =>
        decode(
          h(
            "button",
            { type: "button", onClick: props.onFire as () => void },
            children
          )
        ),
      "Fires"
    );
    // The handler closes over document-local `state` — it cannot be JSON, so the old manifest could
    // never transport it. Under replay it is recovered live on the client.
    const DocFn = () => {
      const onFire = () => {
        state.fired += 1;
      };
      return decode(h(Fires, { onFire }, ["fire"]));
    };

    // The REAL server path: render(DocFn) islands the function prop without throwing (E4 retired)
    // and the manifest carries only the debug name — the prop never crosses as data.
    const { html, manifest } = render(DocFn);
    expect(manifest).toEqual({ "1": { comp: "Fires" } });
    expect(html).toContain('data-hydration-id="1"');
    expect(html).not.toContain("onFire"); // no handler leaks into the static HTML
    document.body.innerHTML = html;

    const teardowns = hydrateDocument(DocFn);
    await flush();

    const button = document.querySelector("button");
    expect(button?.textContent).toBe("fire");
    expect(state.fired).toBe(0);

    button?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    await flush();

    expect(state.fired).toBe(1);
    for (const t of teardowns) {
      t();
    }
  });
});
