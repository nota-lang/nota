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
  rendered: boolean = false;
  availableLanguages: { [lang: string]: LanguageSupport } = {};
  runtimeError?: Error = undefined;

  constructor() {
    this.connect();
    makeAutoObservable(this);
  }

  connect() {
    let host = window.location.host;
    let ws = new WebSocket(`ws://${host}`);

    ws.onerror = evt => {
      console.error(evt);
    };

    ws.onopen = async () => {
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
          ws.send(JSON.stringify(sync));
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

    ws.onmessage = action(event => {
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

    ws.onclose = () => {
      // TODO: need to show somewhere that the connection is dropped
      setTimeout(() => this.connect(), 1000);
    };
  }
}
