import { LanguageSupport } from "@codemirror/language";
import type { Result } from "@nota-lang/nota-common/dist/result";
import React from "react";

export interface Translation {
  transpiled: string;
  lowered: string;
  map: string;
  css: string | null;
}
export type TranslationResult = Result<Translation, string>;

export interface State {
  contents: string;
  translation: TranslationResult;
  runtimeError?: Error;
  ready: boolean;
  rendered: boolean;
  availableLanguages: { [lang: string]: LanguageSupport };
  imports?: { [key: string]: any };
}

export let StateContext = React.createContext<State | null>(null);

export { Editor } from "./editor.js";
export { LocalState } from "./local-state.js";
export { RemoteState } from "./remote-state.js";
export { JsView, OutputView, ParseView } from "./viewer.js";
