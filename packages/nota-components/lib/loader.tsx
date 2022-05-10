import React, { useState } from "react";
import { default as ReactLoader } from "react-loader-spinner";
import { action, makeAutoObservable } from "mobx";
import { observer } from "mobx-react";
import { default as classNames } from "classnames";

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

export let Loader: React.FC<{ initial?: boolean }> = observer(({ children, initial }) => {
  let [data] = useState(new LoaderData(initial || true));
  let loaded = data.loaded;

  return (
    <LoaderContext.Provider value={data}>
      <div className={classNames("loader", { loaded })}>
        {!loaded ? (
          <div className="loader-overlay">
            <div className="loader-spinner">
              <ReactLoader type="Oval" color="#aaa" width="100%" height="100%" />
            </div>
          </div>
        ) : null}
        {children}
      </div>
    </LoaderContext.Provider>
  );
});
