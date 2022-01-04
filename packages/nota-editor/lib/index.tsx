import React from "react";
import { Result } from "@nota-lang/nota-common";

export type TranslationResult = Result<{
  transpiled: string;
  lowered: string;
  css: string | null;
}, string>;

export interface State {
  contents: string;
  translation: TranslationResult;
  ready: boolean;
}

export let StateContext = React.createContext<State | null>(null);

export { Editor } from "./editor";
export { LocalState } from "./local-state";
export { RemoteState } from "./remote-state";
export { JsView, OutputView, ParseView } from "./viewer";

import "../css/nota-editor.scss";
