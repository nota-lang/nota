/** Fixpoint static rendering and hydration for documents with forward references. */

import { type JSX, sharedConfig } from "solid-js";
import { renderToString, hydrate as solidHydrate } from "solid-js/web";
import { createDocState, DocStateContext, type Snapshot } from "./doc-state";
import type { SmartOptions } from "./smart";

/** Render defaults a build step may bake into a document component. */
export interface DocRenderDefaults {
  /** See {@link RenderDocumentOptions.maxPasses}. */
  maxPasses?: number;
}

/** A document component (the `.nota` emit's default export). */
export interface DocComponent {
  (): JSX.Element;
  /** Branded by `@nota-lang/vite`, for host renderers that dispatch on component kind. */
  isNotaDoc?: boolean;
  /** Defaults baked in by `@nota-lang/vite`; an explicit call-site option overrides them. */
  notaRenderOptions?: DocRenderDefaults;
}

/** The pass budget a document gets to reach its fixpoint when nothing configures one. */
export const DEFAULT_MAX_PASSES = 5;

/**
 * Check a pass budget, returning it. `1` is rejected along with the negatives and non-integers:
 * the first pass has no seed to reproduce, so convergence is only observable from the second,
 * and a budget of one could only ever fail.
 */
export function checkMaxPasses(maxPasses: number): number {
  if (!Number.isInteger(maxPasses) || maxPasses < 0 || maxPasses === 1) {
    throw new Error(
      `nota: maxPasses must be 0 (no cap) or an integer >= 2, got ${maxPasses}`
    );
  }
  return maxPasses;
}

/** Options for {@link renderDocument}. */
export interface RenderDocumentOptions {
  /**
   * Hydration-key prefix, forwarded to every pass' `renderToString`. A host page holding
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
  /**
   * How many passes the document gets to reach its fixpoint before {@link renderDocument}
   * gives up and throws. Two is the minimum that can converge; each pass beyond it lets a fact
   * that reads other facts settle one level deeper. `0` means no cap — a document that never
   * stabilizes then renders forever, so only set it where divergence is impossible.
   *
   * Default: the {@link DocComponent.notaRenderOptions} the build baked into `Doc` (see
   * `@nota-lang/vite`'s `maxPasses`), else {@link DEFAULT_MAX_PASSES}.
   */
  maxPasses?: number;
}

/** The result of {@link renderDocument}. */
export interface RenderedDocument {
  /** The document HTML (the converged pass — forward references resolved). */
  html: string;
  /** The converged doc-state snapshot; embed via {@link docStateScript} for hydration. */
  state: Snapshot;
}

/** The pass budget in force for `Doc`: call site, else the component's baked-in default. */
function resolveMaxPasses(
  Doc: DocComponent,
  options: RenderDocumentOptions
): number {
  return checkMaxPasses(
    options.maxPasses ?? Doc.notaRenderOptions?.maxPasses ?? DEFAULT_MAX_PASSES
  );
}

/** One pass' output. `json` is the snapshot's wire form, the identity passes compare on. */
interface PassResult {
  html: string;
  snapshot: Snapshot;
  json: string;
}

/**
 * Render `Doc` once against `seed` (`undefined` on the first pass, whose forward reads see only
 * what precedes them). Saving `sharedConfig.context` keeps a nested `renderToString` from
 * disturbing the host render's hydration-key counter.
 */
function renderPass(
  Doc: DocComponent,
  seed: Snapshot | undefined,
  options: RenderDocumentOptions
): PassResult {
  const outer = sharedConfig.context;
  const state = createDocState(seed, { smart: options.smart });
  try {
    const html = renderToString(
      () => (
        <DocStateContext.Provider value={state}>
          <Doc />
        </DocStateContext.Provider>
      ),
      { renderId: options.renderId }
    );
    const snapshot = state.snapshot();
    return { html, snapshot, json: JSON.stringify(snapshot) };
  } finally {
    sharedConfig.context = outer;
  }
}

/** Where {@link iterate} stopped. */
interface FixpointResult extends PassResult {
  /** The wire form of the snapshot the last pass rendered against (`undefined` if it was first). */
  seedJson: string | undefined;
  /** Passes actually run. */
  passes: number;
  /** Did the last pass reproduce the snapshot it rendered against? */
  converged: boolean;
}

/**
 * Re-render, each pass seeded with the one before it, until a pass reproduces its own seed or
 * `cap` passes have run (`0` = no cap). The seeded store pins reads to the seed, so a pass that
 * reproduces it is a fixpoint: rendering again could only produce the same HTML.
 */
function iterate(
  Doc: DocComponent,
  options: RenderDocumentOptions,
  cap: number
): FixpointResult {
  let prev = renderPass(Doc, undefined, options);
  let passes = 1;
  let seedJson: string | undefined;
  while (cap === 0 || passes < cap) {
    const pass = renderPass(Doc, prev.snapshot, options);
    passes += 1;
    seedJson = prev.json;
    if (pass.json === prev.json) {
      return { ...pass, seedJson, passes, converged: true };
    }
    prev = pass;
  }
  return { ...prev, seedJson, passes, converged: false };
}

/**
 * {@link collectDocState}, plus the passes it took — a host that owns the final render parks
 * this so its convergence check can name the budget that ran out.
 */
export function collectDocPasses(
  Doc: DocComponent,
  options: RenderDocumentOptions = {}
): { seed: Snapshot; passes: number } {
  const cap = resolveMaxPasses(Doc, options);
  // One pass of the budget belongs to the host's own render, which is the one the shell checks.
  const result = iterate(Doc, options, cap === 0 ? 0 : cap - 1);
  return { seed: result.snapshot, passes: result.passes };
}

/**
 * Run the collection passes for a host that owns the final render (`notaRoute`): the seed the
 * host's pass must reproduce. Stops one pass short of the budget, leaving the host's render to
 * spend the last one; a document still moving by then is reported by the shell's convergence
 * check rather than here.
 *
 * A host page costs one render more than its fixpoint depth, because the seed has to be *proven*
 * before the host commits bytes it cannot take back — unlike {@link renderDocument}, which owns
 * the last pass and can keep going. `maxPasses: 2` spends nothing on proof: one collection pass,
 * and the host's render is the check.
 */
export function collectDocState(
  Doc: DocComponent,
  options: RenderDocumentOptions = {}
): Snapshot {
  return collectDocPasses(Doc, options).seed;
}

/**
 * Render to a fixpoint: each pass is seeded with the previous pass's registrations, so forward
 * references (a Toc above its headings) resolve, and facts derived from other facts settle over
 * successive passes. Returns the first pass that reproduced its own seed; throws once
 * {@link RenderDocumentOptions.maxPasses} passes have run without one.
 */
export function renderDocument(
  Doc: DocComponent,
  options: RenderDocumentOptions = {}
): RenderedDocument {
  const cap = resolveMaxPasses(Doc, options);
  const result = iterate(Doc, options, cap);
  if (!result.converged) {
    throw notConverged(result.seedJson ?? "(none)", result.json, result.passes);
  }
  return { html: result.html, state: result.snapshot };
}

/** Throw when the final pass did not reproduce the snapshot it rendered against. */
export function assertDocStateConverged(
  seed: Snapshot,
  post: Snapshot,
  passes?: number
): void {
  const before = JSON.stringify(seed);
  const after = JSON.stringify(post);
  if (after !== before) {
    throw notConverged(before, after, passes);
  }
}

/**
 * The divergence error. A fact may read other facts — that is what the extra passes buy — but
 * one that keeps changing every pass has no fixpoint and no budget will settle it.
 */
function notConverged(before: string, after: string, passes?: number): Error {
  const budget = passes === undefined ? "" : ` in ${passes} passes`;
  return new Error(
    `nota: document did not converge${budget} — a registration changed between the last two ` +
      "passes (raise maxPasses if the document needs more of them; a fact that changes on " +
      "every pass has no fixpoint to reach)\n" +
      `before: ${before}\nafter: ${after}`
  );
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
