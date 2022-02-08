import React from "react";
import ReactDOM from "react-dom";
import { observable } from "mobx";
import { observer } from "mobx-react";

import { Pluggable, Plugin, usePlugin } from "./plugin";

class PortalData extends Pluggable {
  @observable portal: HTMLDivElement | null = null;
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
      ref={el => {
        portal.portal = el;
      }}
    />
  );
};
