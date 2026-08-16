/**
 * The live **Rendered** pane: the evaluated document rendered as a plain Solid app (pure CSR).
 *
 * Rendering happens **in-page** (a scroll container, not an iframe): Solid delegates events on
 * the owning `document`, and the evaluated module shares this page's Solid instance (see
 * `solid-eval`'s MODULE_MAP), so interactivity works with zero extra machinery. Doc-state
 * resolves reactively here — a Toc above its headings fills in live, the CSR half of
 * design/solid.md's model (the converged two-pass form is the CLI's build-time concern).
 */

import { createEffect, onCleanup } from "solid-js";
import { createComponent, render } from "solid-js/web";
import type { DocFn } from "./solid-eval";

export interface RenderedPaneProps {
  /** The evaluated document component; `null` = nothing to show yet. */
  Doc: DocFn | null;
  /** Bumped per successful eval — re-render even when the component identity is stable. */
  docVersion: number;
  /** Whether this tab is currently shown (avoid work when hidden). */
  active: boolean;
}

export function RenderedPane(props: RenderedPaneProps) {
  let host!: HTMLDivElement;
  let dispose: (() => void) | null = null;

  createEffect(() => {
    // Track: a new Doc/version, or the tab becoming active.
    const Doc = props.Doc;
    void props.docVersion;
    if (!props.active) {
      return;
    }
    dispose?.();
    dispose = null;
    host.textContent = "";
    if (Doc) {
      try {
        dispose = render(() => createComponent(Doc as () => never, {}), host);
      } catch (err) {
        // A render failure shouldn't break the playground shell — log it with its stack.
        console.error("[nota] preview render failed:", err);
      }
    }
  });

  onCleanup(() => {
    dispose?.();
    dispose = null;
  });

  return <div class="rendered-frame" data-testid="pane-rendered" ref={host} />;
}
