/**
 * One-shot handoff from a host-rendered Nota route to its document shell. Request objects are
 * safe under concurrency; the module fallback requires synchronous, non-interleaved SSR.
 */

import type { DocState, Snapshot } from "./doc-state";

/** What a Nota route parks for the shell to finish. */
export interface DocPass {
  /** Pass 1's snapshot: what pass 2 rendered against, and what the client must hydrate with. */
  seed: Snapshot;
  /** The pass-2 store, for the shell's convergence check once the document has rendered. */
  state: DocState;
}

const requestPasses = new WeakMap<object, DocPass>();
let parked: DocPass | undefined;

/** Park a pass for the shell, on `event` when there is one. */
export function parkDocPass(event: unknown, pass: DocPass): void {
  if (typeof event === "object" && event !== null) {
    requestPasses.set(event, pass);
  } else {
    parked = pass;
  }
}

/** Take and clear the pass for this request. */
export function takeDocPass(event: unknown): DocPass | undefined {
  if (typeof event === "object" && event !== null) {
    const pass = requestPasses.get(event);
    requestPasses.delete(event);
    return pass;
  }
  const pass = parked;
  parked = undefined;
  return pass;
}
