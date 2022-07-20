import React, { useContext, useState } from "react";

import { FCC } from "./utils";

export class Pluggable {
  stateful: boolean = false;
  init() {}
}

export class Plugin<T extends Pluggable> {
  context: React.Context<T>;
  ctor: { new (): T };

  constructor(ctor: { new (): T }) {
    this.ctor = ctor;
    this.context = React.createContext(new ctor());
  }

  Provide: FCC = ({ children }) => {
    let t = new this.ctor();
    if (t.stateful) {
      t = useState(t)[0];
    }

    if (t.init) {
      t.init();
    }

    return <this.context.Provider value={t}>{children}</this.context.Provider>;
  };
}

export function usePlugin<T extends Pluggable>(plugin: Plugin<T>): T {
  return useContext(plugin.context);
}
