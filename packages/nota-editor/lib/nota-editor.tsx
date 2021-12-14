import React, { useState } from "react";
import ReactDOM from "react-dom";
import { observer } from "mobx-react";

import { Editor } from "./editor";
import { Viewer, ViewerConfig, ViewerState, ViewerStateContext } from "./viewer";
import { State, StateContext } from "./state";

import "@wcrichto/nota/dist/nota.css";
import "@wcrichto/nota-theme-acm/dist/nota-theme-acm.css";
import "../css/app.scss";

let App = observer(() => {
  let [state] = useState(() => new State());
  let [viewer_state] = useState(() => new ViewerState());
  return (
    <div>
      {!state.ready ? (
        <>Loading...</>
      ) : (
        <StateContext.Provider value={state}>
          <ViewerStateContext.Provider value={viewer_state}>
            <div className="header">
              <h1>Nota Editor</h1>
              <ViewerConfig />
            </div>
            <div className="panels">
              <Editor />
              <Viewer />
            </div>
          </ViewerStateContext.Provider>
        </StateContext.Provider>
      )}
    </div>
  );
});

ReactDOM.render(<App />, document.getElementById("container"));
