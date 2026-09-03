/** Emits and verifies the state parked by {@link notaRoute}. Render it after the app. */

import type { JSX } from "solid-js";
import { getRequestEvent } from "solid-js/web";
import { takeDocPassScript } from "./doc-pass-script";

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
  return takeDocPassScript(getRequestEvent());
}
