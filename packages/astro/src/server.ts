/**
 * The renderer's server entry: `check` dispatches on the compiled emit's brand
 * (`Doc.isNotaDoc`, appended by the `@nota-lang/vite` transform — exact, no try-render, so
 * other renderers' components fall through untouched), and `renderToStaticMarkup` runs the
 * two-pass `renderDocument` driver.
 *
 * - **Hydrating island** (`client:*` directive): render with a per-island `renderId` so each
 *   document claims its own hydration-key space, and transport the converged doc-state
 *   snapshot + renderId as island attributes (the same channel Astro uses for props) for the
 *   client entry to read.
 * - **Static** (no directive): wrap in Solid's `NoHydration` — no hydration keys, no scripts,
 *   clean zero-JS HTML — and drop the snapshot (nothing will ever read it; the HTML itself is
 *   the converged output).
 */

import { type DocComponent, renderDocument } from "@nota-lang/core";
import type { JSX } from "solid-js";

import { DOC_STATE_ATTR, RENDER_ID_ATTR } from "./markers";
import {
  createComponent,
  generateHydrationScript,
  NoHydration
} from "solid-js/web";

/** What Astro binds as `this` in renderer hooks; `result` is stable per rendered page. */
interface RendererContext {
  result: object;
}

/** The slice of Astro's island metadata the renderer dispatches on. */
interface IslandMetadata {
  hydrate?: string;
}

/** Per-page island counter (WeakMap keyed on the render result, à la @astrojs/solid-js). */
const counters = new WeakMap<object, number>();
function nextIslandId(result: object): string {
  const n = counters.get(result) ?? 0;
  counters.set(result, n + 1);
  return `n${n}`;
}

function isNotaDoc(c: unknown): c is DocComponent {
  return (
    typeof c === "function" && (c as { isNotaDoc?: unknown }).isNotaDoc === true
  );
}

async function check(
  this: RendererContext,
  Component: unknown
): Promise<boolean> {
  return isNotaDoc(Component);
}

async function renderToStaticMarkup(
  this: RendererContext,
  Component: unknown,
  _props: Record<string, unknown>,
  _slots: Record<string, unknown>,
  metadata?: IslandMetadata
): Promise<{ html: string; attrs?: Record<string, string> }> {
  if (!isNotaDoc(Component)) {
    throw new Error(
      "@nota-lang/astro: renderToStaticMarkup called on a non-Nota component"
    );
  }
  if (!metadata?.hydrate) {
    const Static: DocComponent = () =>
      createComponent(NoHydration, {
        get children(): JSX.Element {
          return createComponent(Component, {});
        }
      });
    return { html: renderDocument(Static).html };
  }
  const renderId = nextIslandId(this.result);
  const { html, state } = renderDocument(Component, { renderId });
  return {
    attrs: {
      [RENDER_ID_ATTR]: renderId,
      [DOC_STATE_ATTR]: JSON.stringify(state)
    },
    html
  };
}

const renderer = {
  name: "@nota-lang/astro",
  check,
  renderToStaticMarkup,
  supportsAstroStaticSlot: true,
  renderHydrationScript: () => generateHydrationScript()
};

export default renderer;
