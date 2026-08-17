/**
 * NotaDoc — what a document desugars to: a document-state provider around a Reforest pass plus
 * a trailer outlet.
 */

import { type JSX, type ParentProps, useContext } from "solid-js";
import { createDocState, DocStateContext, useDocState } from "./doc-state";
import { Reforest } from "./reforest";

/** Renders the registered trailer thunks (footnote list, definition bank) at document end. */
function TrailerOutlet(): JSX.Element {
  const state = useDocState();
  return <>{state.trailers().map(thunk => thunk())}</>;
}

/**
 * The document wrapper every `.nota` emit returns: adopts an outer {@link DocStateContext}
 * store when a driver (`renderDocument`/`hydrateDocument`) provides one — else self-sufficient
 * with a fresh store (tests, pure CSR) — and renders the reforested children in an
 * `<article class="nota-doc">` followed by the trailers.
 */
export function NotaDoc(props: ParentProps): JSX.Element {
  const outer = useContext(DocStateContext);
  const state = outer ?? createDocState();
  return (
    <DocStateContext.Provider value={state}>
      <article class="nota-doc">
        <Reforest>{props.children}</Reforest>
        <TrailerOutlet />
      </article>
    </DocStateContext.Provider>
  );
}
