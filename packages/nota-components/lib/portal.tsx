import { action, makeObservable, observable } from "mobx";
import { observer } from "mobx-react";
import React from "react";
import * as ReactDOM from "react-dom";

import { Pluggable, Plugin, usePlugin } from "./plugin.js";
import { FCC } from "./utils.js";

class PortalData extends Pluggable {
  portal: HTMLDivElement | null = null;

  constructor() {
    super();
    makeObservable(this, { portal: observable });
  }
}

export let PortalPlugin = new Plugin(PortalData);

export let ToplevelElem: FCC = observer(({ children }) => {
  let portal = usePlugin(PortalPlugin);
  return portal.portal !== null ? ReactDOM.createPortal(children, portal.portal) : null;
});
ToplevelElem.displayName = "ToplevelElem";

export let Portal = () => {
  let portal = usePlugin(PortalPlugin);
  return (
    <div
      className="portal"
      ref={action((el: HTMLDivElement) => {
        portal.portal = el;
      })}
    />
  );
};
