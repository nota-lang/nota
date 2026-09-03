/** Emits and verifies the state parked by {@link notaRoute}. Render it after the app. */

import type { JSX } from "solid-js";
import { getRequestEvent, ssr } from "solid-js/web";
import { takeDocPass } from "./doc-pass";
import { assertDocStateConverged, docStateScript } from "./render";

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
  assertDocStateConverged(pass.seed, post, pass.passes);
  return ssr(docStateScript(pass.seed)) as unknown as JSX.Element;
}
