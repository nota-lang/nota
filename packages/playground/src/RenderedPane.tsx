/** Mount the latest evaluated document into the rendered pane. */

import { createEffect, onCleanup } from "solid-js";
import { createComponent, render } from "solid-js/web";
import type { DocFn } from "./solid-eval";

export interface RenderedPaneProps {
  Doc: DocFn | null;
  docVersion: number;
  active: boolean;
}

export function RenderedPane(props: RenderedPaneProps) {
  let host!: HTMLDivElement;
  let dispose: (() => void) | null = null;

  createEffect(() => {
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
