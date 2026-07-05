/**
 * The live **Rendered** pane: the SSG HTML booted live in a sandboxed iframe, with every island
 * hydrated in place so it becomes interactive (the golden's `Colorized` click → red→green works).
 *
 * Mechanism (contract R15 — replay hydration): write the SSG HTML into the (same-origin) iframe's
 * document, then `hydrateDocument(Doc, { root: iframeDoc })` — the runtime **replays** the document
 * (re-executes `render(Doc)` with `island()` in capture mode), recovering each island's live
 * component, live props, and recomputed slot, and hydrates every `[data-hydration-id]` marker.
 * `Doc` is the *same* evaluated closure that produced the SSG HTML (from `runSSG`), so the replay's
 * ids match by construction. No registry, no manifest transport, no `innerHTML` slot-scrape — and
 * document-local islands (closures over `@for` variables etc.) hydrate correctly.
 */

import reactAdapter from "@nota-lang/react";
import { hydrateDocument, setAdapter } from "@nota-lang/runtime";
import { useEffect, useRef } from "react";
import type { DocFn, ManifestEntry } from "./ssg";

export interface RenderedPaneProps {
  /** The SSG HTML to boot. */
  html: string;
  /** The island manifest from `render` (debug metadata; used only as the has-islands gate). */
  manifest: Record<string, ManifestEntry>;
  /** The evaluated document component (from `runSSG`), replayed to hydrate. `null` = no SSG yet. */
  Doc: DocFn | null;
  /** Whether this tab is currently shown (avoid work when hidden). */
  active: boolean;
}

const FRAME_CSS =
  "body{margin:1rem;font-family:system-ui,-apple-system,sans-serif;color:#111;line-height:1.5}";

export function RenderedPane({
  html,
  manifest,
  Doc,
  active
}: RenderedPaneProps) {
  const ref = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    if (!active) return;
    const frameDoc = ref.current?.contentDocument;
    if (!frameDoc) return;

    // 1. Boot the SSG HTML into the sandboxed (same-origin) iframe.
    frameDoc.open();
    frameDoc.write(
      `<!doctype html><html><head><meta charset="utf-8"><style>${FRAME_CSS}</style></head><body>${html}</body></html>`
    );
    frameDoc.close();

    // 2. Replay-hydrate every island in place (R15), using the parent's React adapter on the
    //    iframe's nodes. hydrateDocument returns the islands' teardowns so the next run (every
    //    debounced keystroke re-runs this effect and rewrites the iframe document) unmounts the
    //    prior React roots instead of leaking them. Island-free docs skip the replay entirely
    //    (nothing to hydrate — mirrors the zero-JS property).
    let unmounts: Array<() => void> = [];
    if (Doc && Object.keys(manifest ?? {}).length > 0) {
      setAdapter(reactAdapter as Parameters<typeof setAdapter>[0]);
      try {
        unmounts = hydrateDocument(Doc, { root: frameDoc });
      } catch (err) {
        // A replay failure (e.g. the determinism guard, or a runtime error re-executing the
        // document) shouldn't break the preview — the static SSR markup still shows — but log it
        // (with its stack) so it's visible in the JS console. Per-island failures are already
        // caught inside hydrateDocument (lenient).
        console.error("[nota] replay hydration failed:", err);
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
  }, [html, manifest, Doc, active]);

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
