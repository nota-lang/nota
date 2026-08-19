/**
 * Adapts a Nota component to a host that owns the render loop. The server performs the
 * collection pass here; the shell emits and verifies the resulting state.
 */

import { createComponent, type JSX, onMount, sharedConfig } from "solid-js";
import { getRequestEvent, isServer } from "solid-js/web";
import { parkDocPass } from "./doc-pass";
import { createDocState, DocStateContext, type Snapshot } from "./doc-state";
import { collectDocState, type DocComponent, readPageDocState } from "./render";
import { runRenderResets } from "./render-reset";
import type { SmartOptions } from "./smart";

/** Options for {@link notaRoute}. */
export interface NotaRouteOptions {
  /**
   * Smart punctuation, forwarded to every pass. Server and client must agree — claiming
   * reproduces the server text by re-running the same transform.
   */
  smart?: SmartOptions | false;
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
    const seed = isServer ? collectDocState(Doc, options) : pageSeed();
    runRenderResets();
    const state = createDocState(seed, { smart: options.smart });
    if (isServer) {
      // The shell emits the snapshot and checks convergence once this subtree has rendered.
      parkDocPass(getRequestEvent(), { seed: seed as Snapshot, state });
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
