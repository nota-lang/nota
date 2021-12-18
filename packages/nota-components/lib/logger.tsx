import React from "react";
import { action, observable, makeObservable } from "mobx";
import { observer } from "mobx-react";
import _ from "lodash";

import { Plugin, Pluggable, usePlugin } from "./plugin";

class LoggerData extends Pluggable {
  @observable queue: { Message: React.FC; duration: number; id: string }[] = [];

  constructor() {
    super();
    makeObservable(this);
  }

  log = action((Message: React.FC, duration: number = 5000) => {
    let id = _.uniqueId("log");
    this.queue.push({
      Message,
      duration,
      id,
    });
    setTimeout(
      action(() => {
        _.remove(this.queue, { id });
      }),
      duration
    );
  });
}

export let LoggerPlugin = new Plugin(LoggerData);

export let Logger: React.FC = observer(() => {
  let logger = usePlugin(LoggerPlugin);

  return (
    <div className="logger">
      {logger.queue.map(({ Message, duration, id }) => (
        <div className="log" key={id} style={{ animation: `fade ${duration}ms` }}>
          <Message />
        </div>
      ))}
    </div>
  );
});
