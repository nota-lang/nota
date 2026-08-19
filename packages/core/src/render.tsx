/** Two-pass static rendering and hydration for documents with forward references. */

import { type JSX, sharedConfig } from "solid-js";
import { renderToString, hydrate as solidHydrate } from "solid-js/web";
import { createDocState, DocStateContext, type Snapshot } from "./doc-state";
import type { SmartOptions } from "./smart";

/** A document component (the `.nota` emit's default export). */
export type DocComponent = () => JSX.Element;

/** Options for {@link renderDocument}. */
export interface RenderDocumentOptions {
  /**
   * Hydration-key prefix, forwarded to both passes' `renderToString`. A host page holding
   * several hydrating documents (e.g. Astro islands) allocates one per document so each claims
   * its own key space; the client must pass the same id to {@link hydrateDocument}.
   */
  renderId?: string;
  /**
   * Smart punctuation (Pollen's quote/dash/ellipsis rules; default all on; `false` disables).
   * The client must pass the same setting to {@link hydrateDocument} — the transform runs
   * identically on both sides, which is what makes hydration claim the transformed text.
   */
  smart?: SmartOptions | false;
}

/** The result of {@link renderDocument}. */
export interface RenderedDocument {
  /** The document HTML (pass 2 — forward references resolved). */
  html: string;
  /** The converged doc-state snapshot; embed via {@link docStateScript} for hydration. */
  state: Snapshot;
}

/**
 * Run the collection pass. Saving `sharedConfig.context` keeps a nested `renderToString` from
 * disturbing the host render's hydration-key counter.
 */
export function collectDocState(
  Doc: DocComponent,
  options: RenderDocumentOptions = {}
): Snapshot {
  const outer = sharedConfig.context;
  const state = createDocState(undefined, { smart: options.smart });
  try {
    renderToString(
      () => (
        <DocStateContext.Provider value={state}>
          <Doc />
        </DocStateContext.Provider>
      ),
      { renderId: options.renderId }
    );
  } finally {
    sharedConfig.context = outer;
  }
  return state.snapshot();
}

/**
 * Render once to collect state, then again against that seed. The second pass must reproduce
 * the first pass's registrations.
 */
export function renderDocument(
  Doc: DocComponent,
  options: RenderDocumentOptions = {}
): RenderedDocument {
  const renderOptions = { renderId: options.renderId };
  const stateOptions = { smart: options.smart };
  const seed = collectDocState(Doc, options);

  const pass2 = createDocState(seed, stateOptions);
  const html = renderToString(
    () => (
      <DocStateContext.Provider value={pass2}>
        <Doc />
      </DocStateContext.Provider>
    ),
    renderOptions
  );
  const post = pass2.snapshot();
  assertDocStateConverged(seed, post);
  return { html, state: seed };
}

/** Throw when pass 2 did not reproduce pass 1's registrations. */
export function assertDocStateConverged(seed: Snapshot, post: Snapshot): void {
  const before = JSON.stringify(seed);
  const after = JSON.stringify(post);
  if (after !== before) {
    throw new Error(
      "nota: document did not converge — a registration changed between passes " +
        "(doc-state facts may not depend on reading other doc-state facts)\n" +
        `pass 1: ${before}\npass 2: ${after}`
    );
  }
}

/** The id of the embedded doc-state snapshot script. */
export const DOC_STATE_ID = "nota-doc-state";

/**
 * The snapshot as embeddable script *content*: JSON with `<` escaped, so `</script>`-shaped
 * content cannot break out of the element. Exported for hosts that build the `<script>` as a
 * framework element rather than raw HTML (`@nota-lang/solid-start` renders it as JSX so both
 * sides of hydration produce identical bytes).
 */
export function docStateJson(state: Snapshot): string {
  return JSON.stringify(state).replace(/</g, "\\u003c");
}

/**
 * The embeddable snapshot: `<script type="application/json" id="nota-doc-state">…</script>`.
 */
export function docStateScript(state: Snapshot): string {
  return `<script type="application/json" id="${DOC_STATE_ID}">${docStateJson(state)}</script>`;
}

/** Read the snapshot embedded by {@link docStateScript}, if present. */
export function readPageDocState(): Snapshot | undefined {
  const seedEl = document.getElementById(DOC_STATE_ID);
  return seedEl?.textContent != null && seedEl.textContent !== ""
    ? (JSON.parse(seedEl.textContent) as Snapshot)
    : undefined;
}

/** Options for {@link hydrateDocument}. */
export interface HydrateOptions {
  /** The container holding the server-rendered document. Default: `#nota-root`, else `<body>`. */
  root?: Element;
  /**
   * Hydration-key prefix — must equal the {@link RenderDocumentOptions.renderId} the server
   * render used, or claiming finds no keys and rebuilds the DOM.
   */
  renderId?: string;
  /**
   * The doc-state seed. Default: parse the page's embedded `#nota-doc-state` script
   * ({@link docStateScript}). A host that transports the snapshot another way (e.g. an island
   * attribute) passes it directly.
   */
  seed?: Snapshot;
  /**
   * Smart punctuation — must equal the {@link RenderDocumentOptions.smart} the server render
   * used (claiming reproduces the server text by re-running the same transform).
   */
  smart?: SmartOptions | false;
}

/** Hydrate against the embedded seed, then release the store to live reactivity. */
export function hydrateDocument(
  Doc: DocComponent,
  opts: HydrateOptions = {}
): () => void {
  const root =
    opts.root ?? document.getElementById("nota-root") ?? document.body;
  const seed = opts.seed ?? readPageDocState();
  const state = createDocState(seed, { smart: opts.smart });
  const dispose = solidHydrate(
    () => (
      <DocStateContext.Provider value={state}>
        <Doc />
      </DocStateContext.Provider>
    ),
    root,
    { renderId: opts.renderId }
  );
  state.release();
  return dispose;
}
