import React from "react";
import type { Result } from "@nota-lang/nota-common/dist/result";

export type TranslationResult = Result<
  {
    transpiled: string;
    lowered: string;
    css: string | null;
  },
  string
>;

export interface State {
  contents: string;
  translation: TranslationResult;
  ready: boolean;
}

export let StateContext = React.createContext<State | null>(null);

export { Editor } from "./editor.js";
export { LocalState } from "./local-state.js";
export { RemoteState } from "./remote-state.js";
export { JsView, OutputView, ParseView } from "./viewer.js";
