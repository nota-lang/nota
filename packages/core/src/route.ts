/**
 * Adapts a Nota component to a host that owns the render loop. The server performs the
 * collection pass here; the shell, or a late streaming asset, emits and verifies the resulting
 * state.
 */

import { createComponent, type JSX, onMount, sharedConfig } from "solid-js";
import { getRequestEvent, isServer, useAssets } from "solid-js/web";
import { parkDocPass } from "./doc-pass";
import { takeDocPassScript } from "./doc-pass-script";
import { createDocState, DocStateContext, type Snapshot } from "./doc-state";
import {
  collectDocPasses,
  type DocComponent,
  readPageDocState
} from "./render";
import type { SmartOptions } from "./smart";

/** Options for {@link notaRoute}. */
export interface NotaRouteOptions {
  /**
   * Smart punctuation, forwarded to every pass. Server and client must agree — claiming
   * reproduces the server text by re-running the same transform.
   */
  smart?: SmartOptions | false;
  /**
   * The document's fixpoint pass budget, counting the host's own render as the last pass. `0`
   * means no cap. Default: the budget the build baked into `Doc`, else
   * {@link DEFAULT_MAX_PASSES}. See {@link RenderDocumentOptions.maxPasses}.
   */
  maxPasses?: number;
}

/** Client navigations must not reuse the snapshot left by the server-rendered route. */
function pageSeed(): Snapshot | undefined {
  if (!sharedConfig.context) return undefined;
  return readPageDocState();
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
    const collected = isServer ? collectDocPasses(Doc, options) : undefined;
    const seed = collected ? collected.seed : pageSeed();
    const state = createDocState(seed, { smart: options.smart });
    if (collected) {
      const event = getRequestEvent();
      // The shell emits the snapshot and checks convergence once this subtree has rendered —
      // that render is the last pass of the budget, hence the +1.
      parkDocPass(event, {
        seed: collected.seed,
        state,
        passes: collected.passes + 1
      });
      // A streaming shell can render <NotaDocState/> before a suspended lazy route reaches this
      // point. Solid evaluates asset thunks after all async fragments settle, so give that late
      // route a second chance to consume the same one-shot pass. If the shell already consumed
      // it, this thunk is inert. Keep synchronous renders on the direct shell path: an asset
      // registered in a fragment rendered separately from its <head> would otherwise be dropped.
      if (
        (sharedConfig.context as { async?: boolean } | undefined)?.async ===
        true
      ) {
        useAssets(() => takeDocPassScript(event));
      }
    } else {
      // Switch from the hydration seed to live registrations after claiming.
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
