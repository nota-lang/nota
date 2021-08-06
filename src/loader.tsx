import React, { useState, useRef, useEffect } from "react";
import { default as ReactLoader } from "react-loader-spinner";
import { action, makeObservable, observable } from "mobx";
import { observer, Observer, useLocalObservable } from "mobx-react";

import { ReactReturn, useStateOnInterval } from "./utils";

import "react-loader-spinner/dist/loader/css/react-spinner-loader.css";

export class LoaderData {
  @observable loaded: boolean;

  constructor(initial: boolean) {
    this.loaded = initial;
    makeObservable(this);
  }

  set_loaded = action((loaded: boolean) => {
    this.loaded = loaded;
  });
}

export let LoaderContext = React.createContext<LoaderData>(new LoaderData(false));

export let Loader: React.FC<{ children(): ReactReturn, initial?: boolean }> = observer(({ children: Children, initial }) => {
  let [data] = useState(new LoaderData(initial || true));  

  return (
    <LoaderContext.Provider value={data}>
      <div className="loader">
        {!data.loaded ? (
          <div className="loader-overlay">
            <div className="loader-spinner">
              <ReactLoader type="Oval" color="#aaa" width="100%" height="100%" />
            </div>
          </div>
        ) : null}
        <Children />
      </div>
    </LoaderContext.Provider>
  );
});
