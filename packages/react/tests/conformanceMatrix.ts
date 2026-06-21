/**
 * The **shared** adapter-conformance matrix. Defined ONCE here and
 * run against BOTH `@nota-lang/react` and `@nota-lang/solid`, to prove the two frameworks are
 * substitutable behind the Nota {@link Adapter} contract.
 *
 * Split into two halves because Solid ships *two builds* selected by export conditions — a server
 * build (`solid-js/web` → `…/server.js`, where `renderToString` works) and a DOM build
 * (`…/web.js`/`dev.js`, where `hydrate` works) — and they cannot coexist in one module graph
 * (mixing them corrupts Solid's global `sharedConfig`). This mirrors a real deployment, where SSR
 * and client hydration are *separate builds/processes*. So the matrix exposes:
 *
 * - {@link runRenderMatrix} — the `renderToString`/`h`/`Fragment` half, run under **node/server**
 *   conditions (`ssr` vitest project);
 * - {@link runHydrateMatrix} — the `hydrate`-over-server-HTML half, run under **jsdom/browser**
 *   conditions (`dom` vitest project).
 *
 * Both halves run identically for each adapter — the same `cases` array drives both.
 */

import reactAdapter from "@nota-lang/react";
import {
  type Adapter,
  clearAdapter,
  inlineComponent,
  raw,
  setAdapter
} from "@nota-lang/runtime";
import solidAdapter from "@nota-lang/solid";
import * as React from "react";
import { createSignal } from "solid-js";
// Solid's client `render` (used only in the DOM project to mount Solid's live island; its SSR is
// cross-process — see runHydrateMatrix). Under `node` conditions this is a no-op stub, but the SSR
// project never calls it.
import { render as solidRender } from "solid-js/web";
import { afterEach, describe, expect, test } from "vitest";

/**
 * Normalize framework-specific HTML noise so output can be matched uniformly: Solid's hydration
 * markers (`data-hk="…"`), self-closing slashes, and SSR comment/marker nodes (`<!--…-->`,
 * `<!$>`/`<!/$>`).
 */
export function normalize(html: string): string {
  return html
    .replace(/\s*data-hk="[^"]*"/g, "")
    .replace(/\s*\/>/g, ">")
    .replace(/<!--[^>]*-->/g, "")
    .replace(/<!\$>|<!\/\$>/g, "");
}

export interface Case {
  label: string;
  adapter: Adapter;
  /** A framework-native interactive component: a button showing `count`, +1 on click. */
  makeCounter(initial: number): unknown;
}

// Each counter builds its elements through *its adapter's* `h` (not the framework hyperscript
// directly) so it renders in BOTH environments — server (`ssrElement`/`createComponent`) and client
// (DOM). The reactive child differs by framework: React re-renders a plain string; Solid tracks a
// `() => …` thunk. The component itself is a marked Nota `CompFn`, so `adapter.h(Counter, …)` routes
// it through `createComponent` / `createElement` (React/Solid *call* it during render → hooks run).

const reactCase: Case = {
  label: "react",
  adapter: reactAdapter,
  makeCounter(initial) {
    const Counter = inlineComponent(() => {
      const [n, setN] = React.useState(initial);
      return reactAdapter.h(
        "button",
        { type: "button", onClick: () => setN(v => v + 1) },
        [`count: ${n}`]
      );
    }, "Counter");
    return reactAdapter.h(Counter, {}, []);
  }
};

const solidCase: Case = {
  label: "solid",
  adapter: solidAdapter,
  makeCounter(initial) {
    const Counter = inlineComponent(() => {
      const [n, setN] = createSignal(initial);
      return solidAdapter.h(
        "button",
        { type: "button", onClick: () => setN(v => v + 1) },
        [() => `count: ${n()}`]
      );
    }, "Counter");
    return solidAdapter.h(Counter, {}, []);
  }
};

export const cases: Case[] = [reactCase, solidCase];

// =============================================================================================
// SSR half — h / Fragment / renderToString (server conditions)
// =============================================================================================

export function runRenderMatrix(): void {
  afterEach(() => clearAdapter());

  describe.each(cases)("adapter conformance (render): $label", ({
    adapter
  }) => {
    test("renderToString of a host element emits the tag + text", () => {
      const html = normalize(
        adapter.renderToString(adapter.h("p", {}, ["Hello"]))
      );
      expect(html).toMatch(/<p[^>]*>Hello<\/p>/);
    });

    test("renderToString serializes attributes", () => {
      const html = normalize(
        adapter.renderToString(adapter.h("a", { href: "/x" }, ["go"]))
      );
      expect(html).toContain('href="/x"');
      expect(html).toContain("go");
    });

    test("nested host elements", () => {
      const html = normalize(
        adapter.renderToString(
          adapter.h("p", {}, ["Hi ", adapter.h("em", {}, ["there"])])
        )
      );
      expect(html).toMatch(/<p[^>]*>Hi <em[^>]*>there<\/em><\/p>/);
    });

    test("Fragment renders children with no wrapper element", () => {
      const html = normalize(
        adapter.renderToString(
          adapter.Fragment(null, ["a", adapter.h("b", {}, ["c"])])
        )
      );
      expect(html).toContain("a");
      expect(html).toMatch(/<b[^>]*>c<\/b>/);
    });

    test("Fragment forwards a leading props object (key) without a wrapper", () => {
      // The keyed `@for` shape: `adapter.Fragment({ key: 0 }, kids)`. The key drives reconciliation
      // (React) / is ignored (Solid), but never surfaces as a DOM wrapper or attribute either way.
      const html = normalize(
        adapter.renderToString(
          adapter.Fragment({ key: 0 }, ["a", adapter.h("b", {}, ["c"])])
        )
      );
      expect(html).toContain("a");
      expect(html).toMatch(/<b[^>]*>c<\/b>/);
      expect(html).not.toContain("key");
    });

    test("raw() slot is injected as innerHTML, not escaped", () => {
      const html = normalize(
        adapter.renderToString(adapter.h("span", {}, raw("<i>x</i>")))
      );
      expect(html).toMatch(/<span[^>]*><i>x<\/i><\/span>/);
    });

    test("raw() slot inside an array of children (the component-forwarding shape)", () => {
      const html = normalize(
        adapter.renderToString(
          adapter.h("span", { id: "s" }, [raw("<i>y</i>")])
        )
      );
      expect(html).toMatch(/<span[^>]*id="s"[^>]*><i>y<\/i><\/span>/);
    });

    test("renderToString is synchronous (returns a string)", () => {
      const out = adapter.renderToString(adapter.h("p", {}, ["x"]));
      expect(typeof out).toBe("string");
    });

    test("a component renders through the adapter", () => {
      const html = normalize(
        adapter.renderToString(makeCounterFor(adapter)(7))
      );
      expect(html).toMatch(/count: 7/);
    });
  });
}

/** Pick the right `makeCounter` for an adapter (keeps the component framework-native). */
function makeCounterFor(adapter: Adapter): (n: number) => unknown {
  return (cases.find(c => c.adapter === adapter) as Case).makeCounter;
}

// =============================================================================================
// DOM half — hydrate over server HTML (browser conditions)
// =============================================================================================

export function runHydrateMatrix(): void {
  afterEach(() => clearAdapter());

  describe.each(cases)("adapter conformance (hydrate): $label", ({
    label,
    adapter,
    makeCounter
  }) => {
    test("yields a live, interactive island (SSR→hydrate / client mount)", async () => {
      setAdapter(adapter);
      const container = document.createElement("div");
      document.body.appendChild(container);

      // React: `react-dom/server`'s `renderToString` runs in jsdom, so this is a *true* SSR
      // string + `hydrateRoot` over the existing DOM — the full islands arc in one process.
      //
      // Solid: its DOM build returns `undefined` from `renderToString` (string SSR lives in the
      // *server* build — exercised in the `ssr` project), and `hydrate` requires the server's
      // `_$HY` resume data, i.e. a *cross-process* handshake not reproducible in one jsdom
      // process. So we prove Solid's live, interactive island via its client `render` instead —
      // the same `adapter.h` element/event/reactivity path a real hydrate would resume. (See
      // report: Solid SSR↔hydrate is cross-process; both halves are covered, separately.)
      const ssr = tryRenderToString(adapter, makeCounter(0));
      if (ssr !== undefined) {
        expect(normalize(ssr)).toMatch(/count: 0/);
        container.innerHTML = ssr;
        adapter.hydrate(makeCounter(0), container);
      } else {
        expect(label).toBe("solid");
        solidRender(() => makeCounter(0) as never, container);
      }
      await flush();

      const button = container.querySelector("button");
      expect(button).not.toBeNull();
      expect(container.textContent).toMatch(/count: 0/);

      // Click → the count updates → the island is interactive, not static markup.
      button?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      await flush();

      expect(container.textContent).toMatch(/count: 1/);
      document.body.removeChild(container);
    });
  });
}

/**
 * `adapter.renderToString` if the framework's current build supports it, else `undefined`. React's
 * server renderer works in jsdom; Solid's DOM build returns `undefined` (and may warn) — both are
 * treated as "no string SSR available here".
 */
function tryRenderToString(adapter: Adapter, el: unknown): string | undefined {
  try {
    const out = adapter.renderToString(el);
    return typeof out === "string" && out.length > 0 ? out : undefined;
  } catch {
    return undefined;
  }
}

/** Let the framework flush its microtask + macrotask queues (hydration / state updates). */
async function flush(): Promise<void> {
  await Promise.resolve();
  await new Promise(r => setTimeout(r, 0));
}
