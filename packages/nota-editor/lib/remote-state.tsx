import { LanguageSupport } from "@codemirror/language";
import { err } from "@nota-lang/nota-common/dist/result";
import _ from "lodash";
import { action, makeAutoObservable, reaction } from "mobx";

import { State, TranslationResult } from ".";
import { dynamicLoad } from "./dynamic-load.js";

export interface InitialContent {
  type: "InitialContent";
  contents: string;
  translation: TranslationResult;
  availableLanguages: { [lang: string]: string };
}

export interface SyncText {
  type: "SyncText";
  contents: string;
}

export interface NewOutput {
  type: "NewOutput";
  translation: TranslationResult;
}

export type Message = SyncText | NewOutput | InitialContent;

export class RemoteState implements State {
  contents: string = "";
  translation: TranslationResult = err("");
  ready: boolean = false;
  availableLanguages: { [lang: string]: LanguageSupport } = {};
  runtimeError?: Error = undefined;

  private ws: WebSocket;

  constructor() {
    let host = window.location.host;
    this.ws = new WebSocket(`ws://${host}`);

    this.ws.onerror = evt => {
      console.error(evt);
    };

    this.ws.onopen = async () => {
      let needsSync = false;
      reaction(
        () => [this.contents],
        () => {
          needsSync = true;
        }
      );

      let sync = () => {
        if (needsSync) {
          needsSync = false;
          let sync: SyncText = {
            type: "SyncText",
            contents: this.contents,
          };
          this.ws.send(JSON.stringify(sync));
        }
      };

      // TODO: make auto-compile configurable
      document.addEventListener("keydown", (evt: KeyboardEvent) => {
        if ((evt.metaKey || evt.ctrlKey) && evt.key == "s") {
          evt.stopPropagation();
          evt.preventDefault();
          sync();
        }
      });
      // setInterval(sync, 1000);
    };

    this.ws.onmessage = action(event => {
      let msg: Message = JSON.parse(event.data);
      if (msg.type == "InitialContent") {
        this.contents = msg.contents;
        this.translation = msg.translation;

        Object.keys(msg.availableLanguages).forEach(lang => {
          let script = (msg as InitialContent).availableLanguages[lang];
          let { [lang]: support } = dynamicLoad({ script });
          this.availableLanguages[lang] = support();
        });

        this.ready = true;
      } else if (msg.type == "NewOutput") {
        this.translation = msg.translation;
      }
    });

    makeAutoObservable(this);
  }
}
