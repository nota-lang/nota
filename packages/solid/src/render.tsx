/**
 * Render drivers — SSG (two-pass) + hydration (design/solid.md §Doc-state).
 *
 * A document's meaning is a fixpoint: forward references (a Toc above its headings, a `@ref` to
 * a later section) need whole-document knowledge no single pass has. {@link renderDocument} is
 * the LaTeX model collapsed into one process — render, snapshot, render again seeded — plus a
 * convergence check; {@link hydrateDocument} seeds the client store from the page so claiming
 * reproduces the server bytes, then releases to live reactivity.
 */

import type { JSX } from "solid-js";
import { hydrate as solidHydrate, renderToString } from "solid-js/web";
import { createDocState, DocStateContext, type Snapshot } from "./doc-state";

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
}

/** The result of {@link renderDocument}. */
export interface RenderedDocument {
  /** The document HTML (pass 2 — forward references resolved). */
  html: string;
  /** The converged doc-state snapshot; embed via {@link docStateScript} for hydration. */
  state: Snapshot;
}

/**
 * SSG: render `Doc` twice. Pass 1 populates the store (forward reads see placeholders; its HTML
 * is discarded). Pass 2 renders with pass 1's snapshot pinned as the seed, so forward references
 * are correct in the static HTML. Pass 2's registrations must reproduce the seed — a mismatch
 * throws "did not converge" (a fact that depends on reading another fact cannot stabilize; the
 * old "query output may not introduce new marks" rule, now emergent).
 */
export function renderDocument(
  Doc: DocComponent,
  options: RenderDocumentOptions = {}
): RenderedDocument {
  const renderOptions = { renderId: options.renderId };
  const pass1 = createDocState();
  renderToString(
    () => (
      <DocStateContext.Provider value={pass1}>
        <Doc />
      </DocStateContext.Provider>
    ),
    renderOptions
  );
  const seed = pass1.snapshot();

  const pass2 = createDocState(seed);
  const html = renderToString(
    () => (
      <DocStateContext.Provider value={pass2}>
        <Doc />
      </DocStateContext.Provider>
    ),
    renderOptions
  );
  const post = pass2.snapshot();
  if (JSON.stringify(post) !== JSON.stringify(seed)) {
    throw new Error(
      "nota: document did not converge — a registration changed between passes " +
        "(doc-state facts may not depend on reading other doc-state facts)\n" +
        `pass 1: ${JSON.stringify(seed)}\npass 2: ${JSON.stringify(post)}`
    );
  }
  return { html, state: seed };
}

/** The id of the embedded doc-state snapshot script. */
export const DOC_STATE_ID = "nota-doc-state";

/**
 * The embeddable snapshot: `<script type="application/json" id="nota-doc-state">…</script>`.
 * `<` is escaped so `</script>`-shaped content cannot break out of the element.
 */
export function docStateScript(state: Snapshot): string {
  const json = JSON.stringify(state).replace(/</g, "\\u003c");
  return `<script type="application/json" id="${DOC_STATE_ID}">${json}</script>`;
}

/** The default seed transport: the page's embedded `#nota-doc-state` snapshot script. */
function readPageSeed(): Snapshot | undefined {
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
}

/**
 * Client boot: read the page's embedded snapshot ({@link docStateScript}), seed a store with it,
 * and `hydrate` — every doc-state read during claiming matches the server bytes. Once hydration
 * returns the seed is released: resolved reads switch to the (identical, converged) live facts
 * and reactivity owns the numbers from then on. Returns Solid's dispose function.
 */
export function hydrateDocument(
  Doc: DocComponent,
  opts: HydrateOptions = {}
): () => void {
  const root =
    opts.root ?? document.getElementById("nota-root") ?? document.body;
  const seed = opts.seed ?? readPageSeed();
  const state = createDocState(seed);
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
