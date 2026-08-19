/**
 * Resets module-owned configuration before each server pass and client hydration. This keeps
 * positional configuration deterministic across repeated renders.
 */

/** A registered reset. Must be synchronous — the drivers render immediately after. */
export type RenderResetCallback = () => void;

const callbacks: RenderResetCallback[] = [];

/** Register a reset callback. Callbacks run in registration order. */
export function onRenderReset(cb: RenderResetCallback): () => void {
  callbacks.push(cb);
  return () => {
    const i = callbacks.indexOf(cb);
    if (i >= 0) {
      callbacks.splice(i, 1);
    }
  };
}

/** Run a stable snapshot of the registered callbacks. */
export function runRenderResets(): void {
  for (const cb of [...callbacks]) {
    cb();
  }
}
