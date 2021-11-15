import React from "react";
import {makeAutoObservable, autorun} from "mobx";

const LOCALSTORAGE_KEY: string = "nota-editor-code";

export class State {
    contents: string;

  constructor() {
    this.contents = localStorage.getItem(LOCALSTORAGE_KEY) || "";
    makeAutoObservable(this);

    autorun(() => {
      localStorage.setItem(LOCALSTORAGE_KEY, this.contents);
    })
  }

  set_contents(contents: string) {
    this.contents = contents;
  }
}

export let StateContext = React.createContext(new State());
