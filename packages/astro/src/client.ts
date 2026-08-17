/// <reference lib="dom" />
/**
 * The renderer's client entry: read the renderId + doc-state snapshot off the island element
 * (the server entry's attribute transport) and `hydrateDocument` into it — the seed pins every
 * doc-state read through claiming so the client bytes match the server's, then releases to live
 * reactivity. `client:only` documents (no server HTML) render CSR instead: no seed, forward
 * references resolve reactively — correct by construction, just not pre-resolved.
 */

import {
  type DocComponent,
  hydrateDocument,
  type Snapshot
} from "@nota-lang/core";
import { createComponent, render } from "solid-js/web";

export default (element: HTMLElement) =>
  (
    Component: unknown,
    _props: Record<string, unknown>,
    _slotted: Record<string, unknown>,
    { client }: { client: string }
  ) => {
    if (!element.hasAttribute("ssr")) return;
    const Doc = Component as DocComponent;
    let dispose: () => void;
    if (client === "only") {
      element.innerHTML = "";
      dispose = render(() => createComponent(Doc, {}), element);
    } else {
      const state = element.dataset.notaDocState;
      dispose = hydrateDocument(Doc, {
        root: element,
        renderId: element.dataset.notaRenderId,
        seed: state !== undefined ? (JSON.parse(state) as Snapshot) : undefined
      });
    }
    element.addEventListener("astro:unmount", () => dispose(), { once: true });
  };
