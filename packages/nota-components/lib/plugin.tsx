import _ from "lodash";
import React, { useContext, useState } from "react";

export class Pluggable {
  readonly stateful: boolean = false;
  init() {}
}

export class Plugin<T extends Pluggable> {
  constructor(readonly ctor: { new (): T }) {}

  name = () => this.ctor.name;
}

export class Plugins {
  plugins: { [key: string]: any };

  constructor(plugins: Plugin<any>[]) {
    let pluginInsts = plugins.map(p => [p.name(), new p.ctor()]);
    let [stateful, stateless] = _.partition(pluginInsts, ([_1, p]) => p.stateful);
    let [savedStateful] = useState(stateful);
    this.plugins = _.fromPairs(savedStateful.concat(stateless));
  }

  getPlugin<T extends Pluggable>(plugin: Plugin<T>): T {
    return this.plugins[plugin.name()];
  }
}

export let PluginContext = React.createContext<Plugins | null>(null);

export function usePlugin<T extends Pluggable>(plugin: Plugin<T>): T {
  let ctx = useContext(PluginContext);
  if (!ctx) throw new Error("Error: tried to usePlugin outside of Document");
  return ctx.getPlugin(plugin);
}
