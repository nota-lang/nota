import React from "react";
import { makeAutoObservable, reaction, action } from "mobx";
import type { Message, SyncText, TranslationResult } from "../bin/server";
import { ok, unwrap } from "@wcrichto/nota-common";
import _ from "lodash";

export class State {
  contents: string = "";
  translation: TranslationResult = ok("");
  ready: boolean = false;

  private ws: WebSocket;

  constructor() {
    this.ws = new WebSocket("ws://localhost:8000");

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

      const SYNC_INTERVAL = 100;
      setInterval(() => {
        if (needs_sync) {
          needs_sync = false;
          let sync: SyncText = {
            type: "SyncText",
            contents: this.contents,
          };
          this.ws.send(JSON.stringify(sync));
        }
      }, SYNC_INTERVAL);
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

export let StateContext = React.createContext<State | null>(null);
