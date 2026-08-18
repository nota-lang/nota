/**
 * The **route seam**: a Nota document rendered as a route of a host that owns the render loop.
 *
 * A `.nota` module compiles to a plain Solid component, which is already what a route is in a
 * router-based framework (SolidStart, say) — so there is no page-module wrapper, no renderer to
 * register and no island. The one thing a document needs that an ordinary component does not is
 * the **two-pass render**: forward references (a `Toc` above its headings, a `@ref` to a later
 * section) are a whole-document fact no single pass has.
 *
 * This is {@link renderDocument}'s sibling for the case where the host, not Nota, calls
 * `renderToString`: it drives the same fixpoint from *inside* someone else's render.
 *
 * {@link notaRoute} supplies it from inside the host's own render:
 *
 * - **Server** — run pass 1 via core's {@link collectDocState} (which handles the nested-render
 *   bookkeeping), then render the document against that seed, so the prerendered bytes are
 *   converged. The seed is parked on the request event for `<NotaDocState/>` to emit into the
 *   shell.
 * - **Client** — seed the store from the page's embedded snapshot so claiming reproduces the
 *   server bytes exactly, then release to live reactivity once mounted. A document reached by
 *   *client-side navigation* has no server bytes and takes no seed: its references resolve
 *   reactively, which is correct by construction.
 */

import { createDocState, DocStateContext, type Snapshot } from "./doc-state";
import { collectDocState, type DocComponent, DOC_STATE_ID } from "./render";
import { runRenderResets } from "./render-reset";
import type { SmartOptions } from "./smart";
import { createComponent, type JSX, onMount, sharedConfig } from "solid-js";
import { getRequestEvent, isServer } from "solid-js/web";
import { parkDocPass } from "./doc-pass";

/** Options for {@link notaRoute}. */
export interface NotaRouteOptions {
  /**
   * Smart punctuation, forwarded to every pass. Server and client must agree — claiming
   * reproduces the server text by re-running the same transform.
   */
  smart?: SmartOptions | false;
}

/**
 * The page seed — read only by a document that is *hydrating*.
 *
 * Only the document the server rendered has bytes in the DOM to claim; one reached by
 * client-side navigation must start unseeded, or it would pin its references to the previous
 * document's facts. `sharedConfig.context` is exactly that distinction: Solid sets it for the
 * duration of a hydrating render and leaves it unset for an ordinary client render.
 */
function pageSeed(): Snapshot | undefined {
  if (!sharedConfig.context) return undefined;
  const text = document.getElementById(DOC_STATE_ID)?.textContent;
  return text ? (JSON.parse(text) as Snapshot) : undefined;
}

/**
 * Wrap a `.nota` document's default export as a SolidStart route component.
 *
 * ```tsx
 * import Home from "./docs/home.nota";
 * <Route path="/" component={notaRoute(Home)} />
 * ```
 */
export function notaRoute(
  Doc: DocComponent,
  options: NotaRouteOptions = {}
): () => JSX.Element {
  return () => {
    const seed = isServer ? collectDocState(Doc, options) : pageSeed();
    runRenderResets();
    const state = createDocState(seed, { smart: options.smart });
    if (isServer) {
      // The shell emits the snapshot and checks convergence once this subtree has rendered.
      parkDocPass(getRequestEvent(), { seed: seed as Snapshot, state });
    } else {
      // Claiming is done by the time this subtree mounts; from here the live facts (identical to
      // the seed — the document converged) own the numbers.
      onMount(() => state.release());
    }
    return createComponent(DocStateContext.Provider, {
      value: state,
      get children(): JSX.Element {
        return createComponent(Doc, {});
      }
    });
  };
}
