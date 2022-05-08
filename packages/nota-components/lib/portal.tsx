import React from "react";
import ReactDOM from "react-dom";
import { action, makeObservable, observable } from "mobx";
import { observer } from "mobx-react";

import { Pluggable, Plugin, usePlugin } from "./plugin.js";

class PortalData extends Pluggable {
  portal: HTMLDivElement | null = null;

  constructor() {
    super();
    makeObservable(this, { portal: observable });
  }
}

export let PortalPlugin = new Plugin(PortalData);

export let ToplevelElem: React.FC = observer(({ children }) => {
  let portal = usePlugin(PortalPlugin);
  return portal.portal !== null ? ReactDOM.createPortal(children, portal.portal) : null;
});

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
