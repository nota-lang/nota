/** Mount the latest evaluated document into the rendered pane. */

import { createComponent, render } from "@solidjs/web";
import { createEffect, onCleanup } from "solid-js";
import type { DocFn } from "./solid-eval";

export interface RenderedPaneProps {
  Doc: DocFn | null;
  docVersion: number;
  active: boolean;
}

export function RenderedPane(props: RenderedPaneProps) {
  let host!: HTMLDivElement;
  let dispose: (() => void) | null = null;
  /** Mount ticket: a queued mount that is no longer the latest request is dropped. */
  let generation = 0;

  const teardown = () => {
    dispose?.();
    dispose = null;
  };

  // Keep the preview mounted while hidden. Dispose only on remount or pane teardown.
  createEffect(
    () => [props.Doc, props.docVersion, props.active] as const,
    ([Doc, , active]) => {
      if (!active) {
        return;
      }
      const ticket = ++generation;
      // render() flushes, which is forbidden inside an effect callback.
      queueMicrotask(() => {
        if (ticket !== generation) {
          return;
        }
        teardown();
        host.textContent = "";
        if (Doc) {
          try {
            dispose = render(
              () => createComponent(Doc as () => never, {}),
              host
            );
          } catch (err) {
            console.error("[nota] preview render failed:", err);
          }
        }
      });
    }
  );

  onCleanup(() => {
    generation++;
    teardown();
  });

  return <div class="rendered-frame" data-testid="pane-rendered" ref={host} />;
}
