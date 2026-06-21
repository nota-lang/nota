/**
 * The **Generated-JS** pane (decode.md stage 3): the emitted module, Prettier-formatted for reading
 * ({@link formatJs}) and syntax-highlighted in a read-only CM6 view ({@link CodeView} + {@link
 * jsLanguage}). Formatting is async (Prettier's `format()` returns a promise + lazy-loads), so we run
 * it in an effect and hold the result in state, showing the raw `code` until the first format lands.
 */

import { useEffect, useMemo, useState } from "react";
import { CodeView } from "./CodeView";
import { formatJs } from "./format";
import { jsLanguage } from "./js-mode";

export function JsPane({ code }: { code: string }) {
  const language = useMemo(() => jsLanguage(), []);
  const [pretty, setPretty] = useState(code);

  useEffect(() => {
    let live = true;
    formatJs(code).then(out => {
      // Drop a stale format if `code` changed while we were awaiting.
      if (live) setPretty(out);
    });
    return () => {
      live = false;
    };
  }, [code]);

  return (
    <div className="pane-js" data-testid="pane-js">
      <CodeView value={pretty} language={language} />
    </div>
  );
}
