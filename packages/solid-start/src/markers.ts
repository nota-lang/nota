/**
 * The request-scoped channel the route wrapper and the document shell share.
 *
 * A Nota route computes its converged seed *while rendering* (inside SolidStart's own
 * `renderToString`), but the snapshot has to reach the client as a `<script>` in the page shell —
 * outside the hydrated region, so it never has to match a client render. The shell renders after
 * the route, so the route parks its pass here and `<NotaDocState/>` picks it up.
 *
 * Two transports, preferred in order:
 *
 * 1. **SolidStart's request event**, when one is reachable. Correct under any amount of
 *    concurrency, since the object is per-request. It is not always reachable: `getRequestEvent`
 *    resolves through an AsyncLocalStorage that only `solid-js/web/storage` installs, and
 *    SolidStart imports that module on the server-function path — not on the page path.
 * 2. **A module slot** otherwise. Sound because a document render is synchronous: `renderToString`
 *    cannot be interrupted, so the route's park and the shell's take are one uninterrupted span.
 *    The exception is streaming SSR (`mode: "stream"`) serving concurrent requests, where two
 *    renders can interleave across an async boundary — hence the `mode: "sync"` in the documented
 *    `entry-server` (and prerendering, the case this package is built for, is never concurrent).
 */

import type { DocState, Snapshot } from "@nota-lang/core";

/** Property name on SolidStart's request event. */
const SEED_KEY = "__notaDocPass";

/** What a Nota route parks for the shell to finish. */
export interface DocPass {
  /** Pass 1's snapshot: what pass 2 rendered against, and what the client must hydrate with. */
  seed: Snapshot;
  /** The pass-2 store, for the shell's convergence check once the document has rendered. */
  state: DocState;
}

/** Transport 2: the module slot. */
let parked: DocPass | undefined;

/** Park a pass for the shell, on `event` when there is one. */
export function parkDocPass(event: unknown, pass: DocPass): void {
  parked = pass;
  if (event) {
    (event as Record<string, DocPass>)[SEED_KEY] = pass;
  }
}

/**
 * Take the parked pass, clearing it — the shell renders once per request, and a stale pass must
 * never leak into the next render (it would ship the previous document's snapshot).
 */
export function takeDocPass(event: unknown): DocPass | undefined {
  const fromEvent = (
    event as Record<string, DocPass | undefined> | undefined
  )?.[SEED_KEY];
  const pass = fromEvent ?? parked;
  parked = undefined;
  if (event) {
    (event as Record<string, DocPass | undefined>)[SEED_KEY] = undefined;
  }
  return pass;
}
