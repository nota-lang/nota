/**
 * The live **Rendered** pane: the SSG HTML booted live in a sandboxed iframe, with each island
 * hydrated in place so it becomes interactive (the golden's `Colorized` click → red→green works).
 *
 * Mechanism: write the SSG HTML into the (same-origin) iframe's document, then for each manifest
 * island find its `[data-hydration-id]` node and `adapter.hydrate` the island component over it —
 * recovering the component's `@children` slot from the SSR'd root's `innerHTML` (the
 * `bootIslandsWithSlots` approach, so the client render matches the SSR and React doesn't bail).
 * The island components come from `runSSG`'s `registry` (the emitted module's named exports), so they
 * are the *same* component instances that produced the SSR HTML.
 */

import reactAdapter from "@nota-lang/react";
import { raw, setAdapter } from "@nota-lang/runtime";
import { useEffect, useRef } from "react";
import type { ManifestEntry } from "./ssg";

export interface RenderedPaneProps {
  /** The SSG HTML to boot. */
  html: string;
  /** The island manifest from `render`. */
  manifest: Record<string, ManifestEntry>;
  /** The island components, keyed by name (from `runSSG`). */
  registry: Record<string, unknown>;
  /** Whether this tab is currently shown (avoid work when hidden). */
  active: boolean;
}

const FRAME_CSS =
  "body{margin:1rem;font-family:system-ui,-apple-system,sans-serif;color:#111;line-height:1.5}";

export function RenderedPane({
  html,
  manifest,
  registry,
  active
}: RenderedPaneProps) {
  const ref = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    if (!active) return;
    const doc = ref.current?.contentDocument;
    if (!doc) return;

    // 1. Boot the SSG HTML into the sandboxed (same-origin) iframe.
    doc.open();
    doc.write(
      `<!doctype html><html><head><meta charset="utf-8"><style>${FRAME_CSS}</style></head><body>${html}</body></html>`
    );
    doc.close();

    // 2. Hydrate each island in place, using the parent's React adapter on the iframe's nodes.
    setAdapter(reactAdapter as Parameters<typeof setAdapter>[0]);
    // Collect each island's teardown so the next run (every debounced keystroke re-runs this effect
    // and rewrites the iframe document) unmounts the prior React roots instead of leaking them.
    const unmounts: Array<() => void> = [];
    for (const [id, entry] of Object.entries(manifest ?? {})) {
      const node = doc.querySelector(`[data-hydration-id="${id}"]`);
      const Component = registry?.[entry.comp];
      if (!node || typeof Component !== "function") continue;
      // Recover the component's `@children` slot from its SSR'd root so the client render matches.
      const slot = node.firstElementChild
        ? node.firstElementChild.innerHTML
        : node.innerHTML;
      try {
        unmounts.push(
          reactAdapter.hydrate(
            reactAdapter.h(
              Component as Parameters<typeof reactAdapter.h>[0],
              entry.props,
              raw(slot)
            ),
            node
          )
        );
      } catch (err) {
        // A runtime error in an island shouldn't break the preview — the static SSR markup still
        // shows — but log it (with its stack) so it's visible in the JS console.
        console.error("[nota] island hydration failed:", err);
      }
    }

    // Cleanup before the next run (and on unmount): release the roots created above. React runs this
    // before re-executing the effect, so the previous mounts are torn down ahead of the next
    // `doc.write`, which would otherwise orphan them with no handle to unmount.
    return () => {
      for (const unmount of unmounts) {
        try {
          unmount();
        } catch (err) {
          // Best-effort teardown of the live preview — log it (with its stack) so it's visible
          // in the JS console, but don't let it break the next render.
          console.error("[nota] island teardown failed:", err);
        }
      }
    };
  }, [html, manifest, registry, active]);

  return (
    <iframe
      ref={ref}
      className="rendered-frame"
      data-testid="pane-rendered"
      title="Rendered preview"
      sandbox="allow-scripts allow-same-origin"
    />
  );
}
