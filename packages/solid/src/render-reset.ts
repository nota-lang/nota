/**
 * Render-scoped resets — the seam that keeps module-global, render-scoped state (the prelude's
 * `lstset`/`mathset`/… config; any analogous state in paper or user code) **positional** under
 * the two-pass driver.
 *
 * Config-like modules hold document state as a module global mutated by calls that execute in
 * document order during the component-body run. `renderDocument` renders twice; without a reset
 * between passes, pass 1's end-state becomes pass 2's start-state and positionality is destroyed
 * in the final HTML. The contract: a module owning such state registers its reset here (at module
 * scope), and the drivers run all resets at the start of **every** render of the document —
 * each SSG pass, and on the client before hydration claims (replay must reproduce the server
 * bytes, so both sides start every run from the same state; on a multi-document page each
 * island's render starts clean rather than inheriting the previous island's end-state).
 *
 * What "reset" restores is the callback's business — the prelude resets to its *baked baseline*
 * (site setup code applies config then `bakeConfigBaseline()`), not to factory defaults.
 * Dependency-free and isomorphic: a plain array, no DOM, no Solid.
 */

/** A registered reset. Must be synchronous — the drivers render immediately after. */
export type RenderResetCallback = () => void;

const callbacks: RenderResetCallback[] = [];

/**
 * Register a reset to run at the start of every document render (each SSG pass of
 * `renderDocument`, and `hydrateDocument` before claiming). Call at module scope from the module
 * that owns the state. Runs in registration order. Returns an unregister function (tests;
 * long-lived hosts that unload a config module).
 */
export function onRenderReset(cb: RenderResetCallback): () => void {
  callbacks.push(cb);
  return () => {
    const i = callbacks.indexOf(cb);
    if (i >= 0) {
      callbacks.splice(i, 1);
    }
  };
}

/**
 * Run every registered reset, in registration order. The drivers call this; a custom driver
 * (or a pure-CSR host re-rendering a document, e.g. a playground preview) must call it before
 * each document render to get the same positional semantics.
 */
export function runRenderResets(): void {
  // Snapshot: a reset that (un)registers must not affect this run.
  for (const cb of [...callbacks]) {
    cb();
  }
}
