/**
 * The **shell seam** (server only): the counterpart to {@link notaRoute}.
 *
 * `NotaDocState` goes in the host's document shell *after* the app's children, which is what makes it
 * work: SSR evaluates the shell's expressions in source order, so by the time this renders the
 * route's document has finished and parked its pass on the request event. Two jobs:
 *
 * 1. emit the converged snapshot as `<script type="application/json" id="nota-doc-state">`.
 *    It lands in `StartServer`'s `NoHydration` region — never claimed, so it imposes no
 *    server/client symmetry — and the client reads it out of the DOM before hydrating.
 * 2. run the convergence check. Pass 2 is complete at this point, so a document whose facts
 *    depend on reading other facts (which can never stabilize) fails loudly here rather than
 *    silently shipping pass-1 numbers.
 */

import { docStateScript } from "./render";
import type { JSX } from "solid-js";
import { getRequestEvent, ssr } from "solid-js/web";
import { takeDocPass } from "./doc-pass";

/**
 * The document-state script tag. Render it in the shell after the app:
 *
 * ```tsx
 * <body>
 *   {props.children}
 *   <NotaDocState />
 *   {props.scripts}
 * </body>
 * ```
 *
 * Renders nothing on routes that are not Nota documents.
 */
export function NotaDocState(): JSX.Element {
  const pass = takeDocPass(getRequestEvent());
  if (!pass) return null;
  const post = pass.state.snapshot();
  if (JSON.stringify(post) !== JSON.stringify(pass.seed)) {
    throw new Error(
      "nota: document did not converge — a registration changed between passes " +
        "(doc-state facts may not depend on reading other doc-state facts)\n" +
        `pass 1: ${JSON.stringify(pass.seed)}\npass 2: ${JSON.stringify(post)}`
    );
  }
  return ssr(docStateScript(pass.seed)) as unknown as JSX.Element;
}
