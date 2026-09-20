/** Document layout, state, and self-hosted SSR/hydration. */

import { getHydrationKey, isServer, type JSX, useHead } from "@solidjs/web";
import {
  createMemo,
  onSettled,
  type ParentProps,
  sharedConfig,
  untrack,
  useContext
} from "solid-js";
import {
  createDocState,
  type DocState,
  DocStateContext,
  type Snapshot,
  useDocState
} from "./doc-state";
import { Reforest } from "./reforest";
import {
  checkMaxPasses,
  DEFAULT_MAX_PASSES,
  DOC_STATE_ID,
  docRenderDefaults,
  docStateJson,
  proveDocFixpoint,
  readPageDocState
} from "./render";
import type { SmartOptions } from "./smart";

/** Same length, same thunks — the only change a trailer renderer must react to. */
function sameTrailers(
  prev: (() => JSX.Element)[],
  next: (() => JSX.Element)[]
): boolean {
  return prev.length === next.length && prev.every((t, i) => t === next[i]);
}

/** Renders the registered trailer thunks (note list, definition bank) at document end. */
function TrailerOutlet(): JSX.Element {
  const state = useDocState();
  // Keep unchanged trailers from replacing hydrated DOM; transparent preserves hydration ids.
  const trailers = createMemo(() => state.trailers(), {
    equals: sameTrailers,
    transparent: true
  });
  return <>{trailers().map(thunk => thunk())}</>;
}

/** Props of {@link NotaDoc}. */
export type NotaDocProps = ParentProps & {
  /**
   * Self-hosted pass budget: 0 is unlimited. Falls back to module defaults, then DEFAULT_MAX_PASSES.
   * Ignored when a driver owns the store.
   */
  maxPasses?: number;
  /**
   * Smart punctuation; server and client must agree. Defaults to the module setting.
   * Ignored when a driver owns the store.
   */
  smart?: SmartOptions | false;
};

/** Shared by fixpoint passes and the final render. A plain function adds no owner or hydration id. */
function docBody(props: NotaDocProps): JSX.Element {
  return (
    <article class="nota-doc">
      <Reforest>{props.children}</Reforest>
      <TrailerOutlet />
    </article>
  );
}

/** Detect hydration, including streaming. Client navigation must not reuse the previous page's seed. */
function hydrating(): boolean {
  const cfg = sharedConfig as {
    hydrating?: boolean;
    isHydrationInProgress?: () => boolean;
  };
  return cfg.hydrating === true || cfg.isHydrationInProgress?.() === true;
}

/** Key seeds by hydration id so multiple documents can share a page. */
function headKeyFor(hk: string | undefined): string {
  return hk === undefined ? DOC_STATE_ID : `${DOC_STATE_ID}:${hk}`;
}

/** The `id` attribute of this document's doc-state script. See {@link headKeyFor}. */
function elementIdFor(hk: string | undefined): string {
  return hk === undefined ? DOC_STATE_ID : `${DOC_STATE_ID}-${hk}`;
}

/** The doc-state script, registered identically on both sides so the client adopts the server's. */
function registerSeedTag(seed: Snapshot, hk: string | undefined): void {
  useHead({
    tag: "script",
    key: headKeyFor(hk),
    props: {
      type: "application/json",
      id: elementIdFor(hk),
      children: docStateJson(seed)
    }
  });
}

/**
 * Prove convergence before registering the seed: useHead swallows getter errors, and streaming
 * may commit head tags before the subtree finishes. Hydration adopts the seed; CSR starts fresh.
 */
function hostState(props: NotaDocProps): DocState {
  // Consume the same hydration id on both sides; it identifies this document's seed.
  const hk = isServer || hydrating() ? getHydrationKey() : undefined;
  const smart = untrack(() => props.smart) ?? docRenderDefaults().smart;
  if (isServer) {
    const maxPasses = checkMaxPasses(
      untrack(() => props.maxPasses) ??
        docRenderDefaults().maxPasses ??
        DEFAULT_MAX_PASSES
    );
    const seed = proveDocFixpoint(() => docBody(props), { smart }, maxPasses);
    registerSeedTag(seed, hk);
    return createDocState(seed, { smart });
  }
  const seed = hydrating() ? readPageDocState(elementIdFor(hk)) : undefined;
  // Adopt the server tag and tie its lifetime to this document.
  if (seed !== undefined) registerSeedTag(seed, hk);
  return createDocState(seed, { smart });
}

/** Use an enclosing store, or own the fixpoint, seed, and hydration lifecycle. */
export function NotaDoc(props: NotaDocProps): JSX.Element {
  const outer = useContext(DocStateContext);
  if (outer !== null) {
    return <DocStateContext value={outer}>{docBody(props)}</DocStateContext>;
  }
  const state = hostState(props);
  // Call on both sides: even the server no-op consumes a hydration id.
  onSettled(() => state.release());
  return <DocStateContext value={state}>{docBody(props)}</DocStateContext>;
}
