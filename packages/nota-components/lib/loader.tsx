import { default as classNames } from "classnames";
import { action, makeAutoObservable } from "mobx";
import { observer } from "mobx-react";
import React, { useState } from "react";

import { FCC } from "./utils";

export class LoaderData {
  loaded: boolean;

  constructor(initial: boolean) {
    this.loaded = initial;
    makeAutoObservable(this);
  }

  set_loaded = action((loaded: boolean) => {
    this.loaded = loaded;
  });
}

export let LoaderContext = React.createContext<LoaderData>(new LoaderData(false));

// By Sam Herbert (@sherb), for everyone. More @ http://goo.gl/7AJzbL
let spinner = `
  <svg width="58" height="58" viewBox="0 0 58 58" xmlns="http://www.w3.org/2000/svg">
    <g fill="none" fill-rule="evenodd">
      <g transform="translate(2 1)" stroke="#FFF" stroke-width="1.5">
        <circle cx="42.601" cy="11.462" r="5" fill-opacity="1" fill="#fff">
          <animate
            attributeName="fill-opacity"
            begin="0s"
            dur="1.3s"
            values="1;0;0;0;0;0;0;0"
            calcMode="linear"
            repeatCount="indefinite"
          />
        </circle>
        <circle cx="49.063" cy="27.063" r="5" fill-opacity="0" fill="#fff">
          <animate
            attributeName="fill-opacity"
            begin="0s"
            dur="1.3s"
            values="0;1;0;0;0;0;0;0"
            calcMode="linear"
            repeatCount="indefinite"
          />
        </circle>
        <circle cx="42.601" cy="42.663" r="5" fill-opacity="0" fill="#fff">
          <animate
            attributeName="fill-opacity"
            begin="0s"
            dur="1.3s"
            values="0;0;1;0;0;0;0;0"
            calcMode="linear"
            repeatCount="indefinite"
          />
        </circle>
        <circle cx="27" cy="49.125" r="5" fill-opacity="0" fill="#fff">
          <animate
            attributeName="fill-opacity"
            begin="0s"
            dur="1.3s"
            values="0;0;0;1;0;0;0;0"
            calcMode="linear"
            repeatCount="indefinite"
          />
        </circle>
        <circle cx="11.399" cy="42.663" r="5" fill-opacity="0" fill="#fff">
          <animate
            attributeName="fill-opacity"
            begin="0s"
            dur="1.3s"
            values="0;0;0;0;1;0;0;0"
            calcMode="linear"
            repeatCount="indefinite"
          />
        </circle>
        <circle cx="4.938" cy="27.063" r="5" fill-opacity="0" fill="#fff">
          <animate
            attributeName="fill-opacity"
            begin="0s"
            dur="1.3s"
            values="0;0;0;0;0;1;0;0"
            calcMode="linear"
            repeatCount="indefinite"
          />
        </circle>
        <circle cx="11.399" cy="11.462" r="5" fill-opacity="0" fill="#fff">
          <animate
            attributeName="fill-opacity"
            begin="0s"
            dur="1.3s"
            values="0;0;0;0;0;0;1;0"
            calcMode="linear"
            repeatCount="indefinite"
          />
        </circle>
        <circle cx="27" cy="5" r="5" fill-opacity="0" fill="#fff">
          <animate
            attributeName="fill-opacity"
            begin="0s"
            dur="1.3s"
            values="0;0;0;0;0;0;0;1"
            calcMode="linear"
            repeatCount="indefinite"
          />
        </circle>
      </g>
    </g>
  </svg>
`;

export let Loader: FCC<{ initial?: boolean }> = observer(({ children, initial }) => {
  let [data] = useState(new LoaderData(initial || true));
  let loaded = data.loaded;

  return (
    <LoaderContext.Provider value={data}>
      <div className={classNames("loader", { loaded })}>
        {!loaded ? (
          <div className="loader-overlay">
            <div className="loader-spinner" dangerouslySetInnerHTML={{ __html: spinner }} />
          </div>
        ) : null}
        {children}
      </div>
    </LoaderContext.Provider>
  );
});
Loader.displayName = "Loader";
