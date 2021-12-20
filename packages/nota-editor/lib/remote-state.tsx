import { makeAutoObservable, reaction, action } from "mobx";
import _ from "lodash";
import { err } from "@nota-lang/nota-common";

import { TranslationResult, State } from "./nota-editor";

export interface InitialContent {
  type: "InitialContent";
  contents: string;
  translation: TranslationResult;
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

  private ws: WebSocket;

  constructor() {
    let host = window.location.host;
    this.ws = new WebSocket(`ws://${host}`);

    this.ws.onerror = evt => {
      console.error(evt);
    };

    this.ws.onopen = async () => {
      let needs_sync = false;
      reaction(
        () => [this.contents],
        () => {
          needs_sync = true;
        }
      );

      let sync = () => {
        if (needs_sync) {
          needs_sync = false;
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
        this.ready = true;
      } else if (msg.type == "NewOutput") {
        this.translation = msg.translation;
      }
    });

    makeAutoObservable(this);
  }
}
