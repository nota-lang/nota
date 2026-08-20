/** The state and layout wrapper emitted around every Nota document. */

import { type JSX, type ParentProps, useContext } from "solid-js";
import { createDocState, DocStateContext, useDocState } from "./doc-state";
import { Reforest } from "./reforest";

/** Renders the registered trailer thunks (note list, definition bank) at document end. */
function TrailerOutlet(): JSX.Element {
  const state = useDocState();
  return <>{state.trailers().map(thunk => thunk())}</>;
}

/** Use a driver's store when present, or create one for standalone client rendering. */
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
