/**
 * Replay hydration — the client-side driver (design/decode.md §Replay hydration).
 *
 * An island may be defined at any depth and close over arbitrary document state, and its props may
 * hold non-JSON values (functions, class instances). None of that can cross the wire as a manifest,
 * so instead of *transporting* per-island data the client **replays the document**: it re-executes
 * `render(Doc)` with {@link "./serialize".island} in *capture* mode (see
 * {@link "./serialize".beginCapture}). Every boundary — at **any** depth, including one nested
 * inside a parent's slot — is recorded as its live `CompFn` (closure intact), live props, and
 * recomputed slot HTML; the produced HTML string is discarded. Hydration ids match the server **by
 * construction** (identical `freshId`-before-slot traversal in both modes). {@link hydrateDocument}
 * then attaches each captured island over its `[data-hydration-id]` node, in ascending id order
 * (outer before inner — the old boot's manifest order).
 *
 * This supersedes the manifest-driven `bootIslands` path: no registry, no JSON props, no
 * `innerHTML` slot-scrape.
 */

import { getAdapter } from "./adapter";
import { raw } from "./raw";
import {
  beginCapture,
  type CapturedIsland,
  endCapture,
  getCaptured,
  render
} from "./serialize";
import type { VNode } from "./vnode";

/** A DOM node the driver reads a hydration id from / hydrates over (real `Element` satisfies it). */
export interface HydrationNode {
  getAttribute(name: string): string | null;
}

/** The DOM surface the driver needs from a hydration root (real `document`/`Element` satisfy it). */
export interface HydrationRoot {
  querySelector(selector: string): HydrationNode | null;
  querySelectorAll(selector: string): ArrayLike<HydrationNode>;
}

/**
 * Replay `Doc` in capture mode and return the islands it recorded (`id → live boundary`). The
 * document's HTML is produced as a side effect and discarded; only the {@link CapturedIsland}
 * recording is returned. The capture flag is set/cleared with a `try`/`finally` (so a throw in
 * `Doc` still restores it), mirroring the `▸` flag's discipline.
 */
export function captureRender(Doc: () => VNode): Map<string, CapturedIsland> {
  beginCapture();
  try {
    render(Doc); // HTML discarded; the side effect is populating the capture recording
    return getCaptured();
  } finally {
    endCapture();
  }
}

/**
 * Hydrate every island in a server-rendered document by replaying it (see module docs).
 *
 * 1. {@link captureRender} the document → the live islands (`id → { tag, props, slotHtml }`).
 * 2. **Determinism guard:** the captured id set must equal the document's `[data-hydration-id]`
 *    set. A mismatch means the replay diverged from the server render (non-deterministic `%` code,
 *    or a non-order-stable island sequence) — throw a pointed error **before hydrating anything**,
 *    so we never half-hydrate a document into an inconsistent state.
 * 3. For each captured island — **in ascending id order** (outer before inner: a nested island's
 *    id is minted after its parent's, and the old boot hydrated manifest ids in that order) —
 *    build the framework element `adapter.h(tag, { ...props }, slot)` (`raw(slotHtml)` when the
 *    boundary had static children, else `[]`) and `adapter.hydrate` it over its marker node.
 *    Per-island `try`/`catch` (matching the old boot's leniency): one island's failure logs and is
 *    skipped, never aborting the rest.
 *
 * @param opts.root optional DOM subtree to hydrate within (defaults to the ambient `document`);
 *   injectable for tests and for an iframe preview.
 * @returns the teardown handles (one per successfully-hydrated island) so a caller can unmount them.
 */
export function hydrateDocument(
  Doc: () => VNode,
  opts?: { root?: HydrationRoot }
): Array<() => void> {
  const root = opts?.root ?? resolveDocument();
  const captured = captureRender(Doc);

  const capturedIds = new Set(captured.keys());
  const domIds = new Set<string>();
  for (const node of Array.from(root.querySelectorAll("[data-hydration-id]"))) {
    const id = node.getAttribute("data-hydration-id");
    if (id != null) {
      domIds.add(id);
    }
  }
  if (!setsEqual(capturedIds, domIds)) {
    throw new Error(
      `nota: document did not replay deterministically — captured islands {${[...capturedIds].join(", ")}} ` +
        `do not match the rendered [data-hydration-id] set {${[...domIds].join(", ")}}. ` +
        "Replay hydration requires the document's % code to be isomorphic across runs and its island sequence order-stable."
    );
  }

  const adapter = getAdapter();
  const teardowns: Array<() => void> = [];
  // Ascending id order = outer-before-inner (a nested island records into the Map *during* its
  // parent's slot serialize, so raw insertion order would be inner-first — sort instead).
  const ordered = [...captured.entries()].sort(
    (a, b) => Number(a[0]) - Number(b[0])
  );
  for (const [id, isle] of ordered) {
    const node = root.querySelector(`[data-hydration-id="${id}"]`);
    if (node == null) {
      continue; // guarded above, but stay defensive against a concurrent DOM mutation
    }
    // Per-island leniency: a single island's hydration failure must not abort the rest.
    try {
      const element = adapter.h(
        isle.tag,
        { ...isle.props },
        isle.slotHtml ? raw(isle.slotHtml) : []
      );
      const teardown = adapter.hydrate(element, node);
      if (typeof teardown === "function") {
        teardowns.push(teardown);
      }
    } catch (err) {
      console.error(
        `nota: failed to hydrate island "${id}" (${isle.tag.compName ?? "anonymous"})`,
        err
      );
    }
  }
  return teardowns;
}

/** Set equality over string ids (small sets; a size check + membership scan). */
function setsEqual(a: Set<string>, b: Set<string>): boolean {
  if (a.size !== b.size) {
    return false;
  }
  for (const x of a) {
    if (!b.has(x)) {
      return false;
    }
  }
  return true;
}

/** Resolve the ambient `document`, or throw a pointed error if there is none (e.g. Node). */
function resolveDocument(): HydrationRoot {
  const doc = (globalThis as { document?: HydrationRoot }).document;
  if (doc == null) {
    throw new Error(
      "hydrateDocument: no `document` in scope. Call it in a browser/jsdom context, or pass an explicit { root }."
    );
  }
  return doc;
}
